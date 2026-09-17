"""
AquaIterate Water-Pinch LP Optimizer
=====================================
Implements a linear programme using PuLP to match every water source to its
best sink by quality, flow and cost.

Variables
---------
x[i, j, k]  ≥ 0   flow from source i to sink j via treatment option k
fw[i]        ≥ 0   freshwater drawn from freshwater source i

Objective (minimise)
--------------------
  Σ routing_cost[i,j,k] * x[i,j,k]
+ Σ treatment_cost[i,j,k] * x[i,j,k]
+ freshwater_penalty * Σ fw[i]

Constraints
-----------
1. Source capacity:   Σ_{j,k} x[i,j,k] ≤ available_flow[i]
2. Sink demand:       Σ_{i,k} x[i,j,k] ≥ required_flow[j]   (or partial if enabled)
3. Treatment cap:     x[i,j,k] ≤ treatment_capacity[k]       for k ≠ direct
4. Quality:           only feasible (i,j,k) triples are included in the model

NOTE: All cost values in this demo are configurable assumptions, not real
      industrial figures. They are clearly labelled as DEMO ASSUMPTIONS.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

try:
    import pulp
    PULP_AVAILABLE = True
except ImportError:
    PULP_AVAILABLE = False
    logger.warning("PuLP not installed. Optimizer will not be available.")


# ---------------------------------------------------------------------------
# Data transfer objects
# ---------------------------------------------------------------------------

@dataclass
class SourceDTO:
    id: int
    name: str
    available_flow: float
    is_freshwater: bool
    ph: Optional[float] = None
    tss: Optional[float] = None
    cod: Optional[float] = None
    bod: Optional[float] = None
    tds: Optional[float] = None
    temperature: Optional[float] = None
    conductivity: Optional[float] = None
    other_parameters: Dict = field(default_factory=dict)


@dataclass
class SinkDTO:
    id: int
    name: str
    required_flow: float
    ph_min: Optional[float] = None
    ph_max: Optional[float] = None
    tss_max: Optional[float] = None
    cod_max: Optional[float] = None
    bod_max: Optional[float] = None
    tds_max: Optional[float] = None
    temperature_min: Optional[float] = None
    temperature_max: Optional[float] = None
    other_limits: Dict = field(default_factory=dict)


@dataclass
class TreatmentDTO:
    id: int
    name: str
    max_flow: float
    cost_per_unit: float   # DEMO ASSUMPTION
    output_ph: Optional[float] = None
    output_tss: Optional[float] = None
    output_cod: Optional[float] = None
    output_bod: Optional[float] = None
    output_tds: Optional[float] = None
    output_temperature: Optional[float] = None


DIRECT_TREATMENT_ID = 0  # sentinel: no treatment


@dataclass
class RouteResult:
    source_id: int
    sink_id: int
    treatment_option_id: Optional[int]
    allocated_flow: float
    quality_status: str     # 'compatible' | 'treated' | 'incompatible'
    treatment_required: bool
    routing_cost: float
    treatment_cost: float
    total_cost: float


@dataclass
class OptimizationResult:
    status: str             # 'optimal' | 'infeasible' | 'unbounded' | 'error'
    message: str
    solver_status: str
    freshwater_consumption: float
    reuse_flow: float
    treatment_flow: float
    estimated_operating_cost: float
    routes: List[RouteResult] = field(default_factory=list)
    unmet_demands: Dict[int, float] = field(default_factory=dict)


# ---------------------------------------------------------------------------
# Quality compatibility checker
# ---------------------------------------------------------------------------

def _quality_satisfied(source: SourceDTO, sink: SinkDTO) -> bool:
    """
    Check whether source water quality satisfies all available sink requirements.
    Only constraints that are explicitly specified are enforced.
    """
    checks = []

    if sink.ph_min is not None and source.ph is not None:
        checks.append(source.ph >= sink.ph_min)
    if sink.ph_max is not None and source.ph is not None:
        checks.append(source.ph <= sink.ph_max)
    if sink.tss_max is not None and source.tss is not None:
        checks.append(source.tss <= sink.tss_max)
    if sink.cod_max is not None and source.cod is not None:
        checks.append(source.cod <= sink.cod_max)
    if sink.bod_max is not None and source.bod is not None:
        checks.append(source.bod <= sink.bod_max)
    if sink.tds_max is not None and source.tds is not None:
        checks.append(source.tds <= sink.tds_max)
    if sink.temperature_min is not None and source.temperature is not None:
        checks.append(source.temperature >= sink.temperature_min)
    if sink.temperature_max is not None and source.temperature is not None:
        checks.append(source.temperature <= sink.temperature_max)

    # Fail only if there is at least one concrete failing check
    return all(checks)


def _treated_quality_satisfied(treatment: TreatmentDTO, sink: SinkDTO) -> bool:
    """
    Check whether post-treatment water satisfies sink requirements.
    If the treatment has no output quality data, compatibility is assumed
    (conservative: the administrator is responsible for configuring correct data).
    """
    has_output = any([
        treatment.output_ph is not None,
        treatment.output_tss is not None,
        treatment.output_cod is not None,
        treatment.output_bod is not None,
        treatment.output_tds is not None,
    ])
    if not has_output:
        return True  # no output profile — assume compatible (admin must verify)

    checks = []
    if sink.ph_min is not None and treatment.output_ph is not None:
        checks.append(treatment.output_ph >= sink.ph_min)
    if sink.ph_max is not None and treatment.output_ph is not None:
        checks.append(treatment.output_ph <= sink.ph_max)
    if sink.tss_max is not None and treatment.output_tss is not None:
        checks.append(treatment.output_tss <= sink.tss_max)
    if sink.cod_max is not None and treatment.output_cod is not None:
        checks.append(treatment.output_cod <= sink.cod_max)
    if sink.bod_max is not None and treatment.output_bod is not None:
        checks.append(treatment.output_bod <= sink.bod_max)
    if sink.tds_max is not None and treatment.output_tds is not None:
        checks.append(treatment.output_tds <= sink.tds_max)

    return all(checks)


# ---------------------------------------------------------------------------
# Main optimizer
# ---------------------------------------------------------------------------

class WaterPinchOptimizer:
    def __init__(
        self,
        sources: List[SourceDTO],
        sinks: List[SinkDTO],
        treatments: List[TreatmentDTO],
        routing_costs: Dict[Tuple[int, int, int], float],   # (src_id, sink_id, tx_id) -> cost/m³
        freshwater_penalty: float = 1.0,
        allow_partial_demand: bool = True,
    ):
        self.sources = {s.id: s for s in sources}
        self.sinks = {s.id: s for s in sinks}
        self.treatments = {t.id: t for t in treatments}
        self.routing_costs = routing_costs
        self.freshwater_penalty = freshwater_penalty
        self.allow_partial_demand = allow_partial_demand

    def _build_feasible_routes(self):
        """
        Enumerate all (source, sink, treatment) combinations that are
        quality-compatible. Returns a list of (src_id, sink_id, tx_id)
        and populates quality_status into self._route_quality.
        """
        feasible = []
        self._route_quality = {}

        for src_id, src in self.sources.items():
            for sink_id, sink in self.sinks.items():
                # Direct route (no treatment)
                if _quality_satisfied(src, sink):
                    feasible.append((src_id, sink_id, DIRECT_TREATMENT_ID))
                    self._route_quality[(src_id, sink_id, DIRECT_TREATMENT_ID)] = 'compatible'

                # Treatment routes
                for tx_id, tx in self.treatments.items():
                    if _treated_quality_satisfied(tx, sink):
                        feasible.append((src_id, sink_id, tx_id))
                        self._route_quality[(src_id, sink_id, tx_id)] = 'treated'

        return feasible

    def run(self) -> OptimizationResult:
        if not PULP_AVAILABLE:
            return OptimizationResult(
                status='error',
                message='PuLP library not installed.',
                solver_status='error',
                freshwater_consumption=0,
                reuse_flow=0,
                treatment_flow=0,
                estimated_operating_cost=0,
            )

        feasible_routes = self._build_feasible_routes()

        if not feasible_routes:
            return OptimizationResult(
                status='infeasible',
                message='No feasible source-to-sink routes found under current quality constraints.',
                solver_status='infeasible',
                freshwater_consumption=0,
                reuse_flow=0,
                treatment_flow=0,
                estimated_operating_cost=0,
            )

        prob = pulp.LpProblem('WaterPinch', pulp.LpMinimize)

        # Decision variables: flow on each feasible route
        x = {}
        for (si, sj, sk) in feasible_routes:
            x[(si, sj, sk)] = pulp.LpVariable(
                f'x_{si}_{sj}_{sk}', lowBound=0, cat='Continuous'
            )

        # We will build the objective up as a list of terms
        obj_terms = []
        for (si, sj, sk), var in x.items():
            rc = self.routing_costs.get((si, sj, sk), 0.0)
            tc = self.treatments[sk].cost_per_unit if sk != DIRECT_TREATMENT_ID else 0.0
            total_unit_cost = rc + tc

            # Freshwater penalty applied on top for freshwater sources
            if self.sources[si].is_freshwater:
                total_unit_cost += self.freshwater_penalty

            obj_terms.append(total_unit_cost * var)

        # Source capacity constraints
        for src_id, src in self.sources.items():
            routes_from = [(si, sj, sk) for (si, sj, sk) in feasible_routes if si == src_id]
            if routes_from:
                prob += (
                    pulp.lpSum(x[(si, sj, sk)] for (si, sj, sk) in routes_from)
                    <= src.available_flow,
                    f'SourceCap_{src_id}'
                )

        # Sink demand constraints
        unmet_vars = {}
        for sink_id, sink in self.sinks.items():
            routes_to = [(si, sj, sk) for (si, sj, sk) in feasible_routes if sj == sink_id]
            total_flow = pulp.lpSum(x[(si, sj, sk)] for (si, sj, sk) in routes_to) if routes_to else 0

            if self.allow_partial_demand:
                unmet_vars[sink_id] = pulp.LpVariable(
                    f'unmet_{sink_id}', lowBound=0, cat='Continuous'
                )
                prob += (
                    total_flow + unmet_vars[sink_id] >= sink.required_flow,
                    f'SinkDemand_{sink_id}'
                )
                # Penalise unmet demand heavily in the objective
                obj_terms.append(1000 * unmet_vars[sink_id])
            else:
                prob += (
                    total_flow >= sink.required_flow,
                    f'SinkDemand_{sink_id}'
                )
                
        # Set the objective function all at once
        prob += pulp.lpSum(obj_terms), 'Total_Operating_Cost'

        # Treatment capacity constraints
        for tx_id, tx in self.treatments.items():
            routes_via_tx = [(si, sj, sk) for (si, sj, sk) in feasible_routes if sk == tx_id]
            if routes_via_tx and tx.max_flow is not None:
                prob += (
                    pulp.lpSum(x[(si, sj, sk)] for (si, sj, sk) in routes_via_tx)
                    <= tx.max_flow,
                    f'TreatmentCap_{tx_id}'
                )

        # Solve
        solver = pulp.PULP_CBC_CMD(msg=False)
        prob.solve(solver)

        solver_status = pulp.LpStatus[prob.status]

        if prob.status not in (1,):   # 1 = Optimal
            if prob.status == -1:
                return OptimizationResult(
                    status='infeasible',
                    message='No feasible network satisfies the current flow and water-quality constraints.',
                    solver_status=solver_status,
                    freshwater_consumption=0,
                    reuse_flow=0,
                    treatment_flow=0,
                    estimated_operating_cost=0,
                )
            return OptimizationResult(
                status='error',
                message=f'Solver returned status: {solver_status}',
                solver_status=solver_status,
                freshwater_consumption=0,
                reuse_flow=0,
                treatment_flow=0,
                estimated_operating_cost=0,
            )

        # Extract results
        routes_out = []
        freshwater_consumption = 0.0
        reuse_flow = 0.0
        treatment_flow = 0.0
        total_cost = 0.0

        for (si, sj, sk) in feasible_routes:
            flow = pulp.value(x[(si, sj, sk)])
            if flow is None or flow < 1e-6:
                continue

            rc = self.routing_costs.get((si, sj, sk), 0.0)
            tc = self.treatments[sk].cost_per_unit * flow if sk != DIRECT_TREATMENT_ID else 0.0
            rout_cost = rc * flow
            route_total = rout_cost + tc

            if self.sources[si].is_freshwater:
                freshwater_consumption += flow
            else:
                reuse_flow += flow

            if sk != DIRECT_TREATMENT_ID:
                treatment_flow += flow

            total_cost += route_total

            routes_out.append(RouteResult(
                source_id=si,
                sink_id=sj,
                treatment_option_id=sk if sk != DIRECT_TREATMENT_ID else None,
                allocated_flow=round(flow, 4),
                quality_status=self._route_quality.get((si, sj, sk), 'unknown'),
                treatment_required=(sk != DIRECT_TREATMENT_ID),
                routing_cost=round(rout_cost, 4),
                treatment_cost=round(tc, 4),
                total_cost=round(route_total, 4),
            ))

        unmet_demands = {}
        for sink_id, var in unmet_vars.items():
            val = pulp.value(var)
            if val and val > 1e-6:
                unmet_demands[sink_id] = round(val, 4)

        return OptimizationResult(
            status='optimal',
            message='Optimization completed successfully.',
            solver_status=solver_status,
            freshwater_consumption=round(freshwater_consumption, 4),
            reuse_flow=round(reuse_flow, 4),
            treatment_flow=round(treatment_flow, 4),
            estimated_operating_cost=round(total_cost, 4),
            routes=routes_out,
            unmet_demands=unmet_demands,
        )
