"""
Stand-alone optimizer tests — no Django/GDAL required.
Run:  cd backend && python -m pytest ../tests/test_optimizer.py -v -p no:django
"""
import sys
import os

# Put backend/ on sys.path so we can import engine directly
_BACKEND_DIR = os.path.join(os.path.dirname(__file__), '..', 'backend')
if os.path.abspath(_BACKEND_DIR) not in [os.path.abspath(p) for p in sys.path]:
    sys.path.insert(0, os.path.abspath(_BACKEND_DIR))

# The engine module only imports PuLP — no Django models are touched.
from apps.optimization.engine import (
    WaterPinchOptimizer, SourceDTO, SinkDTO, TreatmentDTO, DIRECT_TREATMENT_ID
)


# ─── Helpers ────────────────────────────────────────────────────────────────

def make_source(id_, flow, is_fresh=False, ph=7.0, tss=10.0, cod=30.0, bod=10.0, tds=200.0):
    return SourceDTO(
        id=id_, name=f'Source-{id_}',
        available_flow=flow, is_freshwater=is_fresh,
        ph=ph, tss=tss, cod=cod, bod=bod, tds=tds, temperature=28.0,
    )


def make_sink(id_, flow, ph_min=None, ph_max=None,
              tss_max=None, cod_max=None, bod_max=None, tds_max=None):
    return SinkDTO(
        id=id_, name=f'Sink-{id_}', required_flow=flow,
        ph_min=ph_min, ph_max=ph_max,
        tss_max=tss_max, cod_max=cod_max,
        bod_max=bod_max, tds_max=tds_max,
    )


def make_treatment(id_, max_flow, cost, out_tss=5.0, out_cod=20.0, out_bod=8.0):
    return TreatmentDTO(
        id=id_, name=f'Treatment-{id_}',
        max_flow=max_flow, cost_per_unit=cost,
        output_tss=out_tss, output_cod=out_cod, output_bod=out_bod,
    )


# ─── Test A — Direct reuse ───────────────────────────────────────────────────

def test_a_direct_reuse():
    """A compatible source should be directly routed to a compatible sink."""
    sources = [make_source(1, flow=20.0, ph=7.0, tss=10.0, cod=30.0, bod=10.0)]
    sinks   = [make_sink(1, flow=15.0, tss_max=50.0, cod_max=100.0)]
    opt = WaterPinchOptimizer(
        sources=sources, sinks=sinks, treatments=[],
        routing_costs={(1, 1, DIRECT_TREATMENT_ID): 0.1},
    )
    res = opt.run()
    assert res.status == 'optimal'
    assert len(res.routes) >= 1
    r = res.routes[0]
    assert r.source_id == 1
    assert r.sink_id == 1
    assert r.treatment_required is False
    assert r.allocated_flow >= 14.9


# ─── Test B — Quality mismatch no direct route ───────────────────────────────

def test_b_quality_mismatch_no_direct_route():
    """High-COD source must NOT be routed directly to a strict sink."""
    sources = [make_source(1, flow=20.0, cod=500.0)]   # COD way above limit
    sinks   = [make_sink(1, flow=10.0, cod_max=50.0)]  # strict sink
    opt = WaterPinchOptimizer(
        sources=sources, sinks=sinks, treatments=[],
        routing_costs={},
        allow_partial_demand=True,
    )
    res = opt.run()
    # No feasible direct route → either infeasible result or 0 flow allocated
    if res.status == 'optimal':
        direct_flow = sum(r.allocated_flow for r in res.routes
                          if r.source_id == 1 and r.sink_id == 1
                          and not r.treatment_required)
        assert direct_flow < 1e-6
    # Sink demand must be unmet when no feasible route exists
    assert res.status in ('infeasible', 'optimal')
    if res.status == 'optimal' and res.unmet_demands:
        assert 1 in res.unmet_demands


# ─── Test C — Treatment route ─────────────────────────────────────────────────

def test_c_treatment_route():
    """A source that fails direct quality check is routable via treatment."""
    sources = [make_source(1, flow=20.0, cod=400.0, tss=80.0, bod=120.0)]
    sinks   = [make_sink(1, flow=10.0, cod_max=50.0, tss_max=20.0, bod_max=30.0)]
    treatments = [make_treatment(10, max_flow=30.0, cost=0.5,
                                 out_cod=20.0, out_tss=5.0, out_bod=5.0)]
    opt = WaterPinchOptimizer(
        sources=sources, sinks=sinks, treatments=treatments,
        routing_costs={(1, 1, 10): 0.1},
    )
    res = opt.run()
    assert res.status == 'optimal'
    treated = [r for r in res.routes if r.treatment_required]
    assert len(treated) >= 1
    assert treated[0].quality_status == 'treated'


# ─── Test D — Source capacity ─────────────────────────────────────────────────

def test_d_source_capacity():
    """Total allocation from a source must never exceed its available flow."""
    sources = [make_source(1, flow=10.0, tss=5.0)]
    sinks   = [make_sink(1, flow=8.0, tss_max=50.0),
               make_sink(2, flow=8.0, tss_max=50.0)]
    opt = WaterPinchOptimizer(
        sources=sources, sinks=sinks, treatments=[],
        routing_costs={
            (1, 1, DIRECT_TREATMENT_ID): 0.1,
            (1, 2, DIRECT_TREATMENT_ID): 0.1,
        },
        allow_partial_demand=True,
    )
    res = opt.run()
    total_from_1 = sum(r.allocated_flow for r in res.routes if r.source_id == 1)
    assert total_from_1 <= 10.0 + 1e-4


# ─── Test E — Unmet demand ────────────────────────────────────────────────────

def test_e_unmet_demand():
    """When supply < required flow, unmet demand must be reported."""
    sources = [make_source(1, flow=5.0, tss=5.0)]
    sinks   = [make_sink(1, flow=20.0, tss_max=50.0)]     # demand >> supply
    opt = WaterPinchOptimizer(
        sources=sources, sinks=sinks, treatments=[],
        routing_costs={(1, 1, DIRECT_TREATMENT_ID): 0.1},
        allow_partial_demand=True,
    )
    res = opt.run()
    assert res.status == 'optimal'
    assert 1 in res.unmet_demands
    assert res.unmet_demands[1] > 5.0    # at least 15 m³/h unmet


# ─── Test F — Freshwater tracking ────────────────────────────────────────────

def test_f_freshwater_tracking():
    """Freshwater consumption must be tracked separately from reuse flow."""
    sources = [
        make_source(1, flow=20.0, is_fresh=True,  tss=5.0),   # freshwater
        make_source(2, flow=20.0, is_fresh=False, tss=5.0),   # reuse
    ]
    sinks = [make_sink(1, flow=25.0, tss_max=50.0)]
    opt = WaterPinchOptimizer(
        sources=sources, sinks=sinks, treatments=[],
        routing_costs={
            (1, 1, DIRECT_TREATMENT_ID): 0.5,   # freshwater route — more costly
            (2, 1, DIRECT_TREATMENT_ID): 0.1,   # reuse route — cheaper
        },
        freshwater_penalty=2.0,
    )
    res = opt.run()
    assert res.status == 'optimal'
    assert res.freshwater_consumption >= 0
    assert res.reuse_flow >= 0
    total = res.freshwater_consumption + res.reuse_flow
    assert abs(total - 25.0) < 1.0    # total served ≈ demand
    # With higher freshwater penalty, reuse should dominate
    assert res.reuse_flow >= res.freshwater_consumption - 0.1


# ─── Test G — Cost calculation ────────────────────────────────────────────────

def test_g_cost_in_objective():
    """Routing cost + treatment cost = total route cost."""
    sources = [make_source(1, flow=20.0, cod=200.0)]
    sinks   = [make_sink(1, flow=10.0, cod_max=50.0)]
    treatments = [make_treatment(10, max_flow=20.0, cost=0.8, out_cod=10.0)]
    opt = WaterPinchOptimizer(
        sources=sources, sinks=sinks, treatments=treatments,
        routing_costs={(1, 1, 10): 0.2},
    )
    res = opt.run()
    assert res.status == 'optimal'
    for r in res.routes:
        assert abs(r.total_cost - (r.routing_cost + r.treatment_cost)) < 1e-4
    assert res.estimated_operating_cost >= 0
