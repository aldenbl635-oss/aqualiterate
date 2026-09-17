"""
AquaIterate Simulation Engine
Generates deterministic time-series readings, updates source/sink values,
and triggers optimization when conditions change materially.
"""
import math
from datetime import timedelta
from django.utils import timezone

from apps.simulation.models import SimulationState, MonitoringReading
from apps.sites.models import Site
from apps.network.models import WaterSource, WaterSink, NetworkConnection, TreatmentOption
from apps.optimization.models import OptimizationRun, OptimizationRoute
from apps.optimization.engine import (
    WaterPinchOptimizer, SourceDTO, SinkDTO, TreatmentDTO, DIRECT_TREATMENT_ID
)


def _build_source_dto(src):
    qp = src.quality_profile
    return SourceDTO(
        id=src.id, name=src.name,
        available_flow=src.available_flow,
        is_freshwater=src.is_freshwater,
        ph=qp.ph if qp else None,
        tss=qp.tss if qp else None,
        cod=qp.cod if qp else None,
        bod=qp.bod if qp else None,
        tds=qp.tds if qp else None,
        temperature=qp.temperature if qp else None,
        conductivity=qp.conductivity if qp else None,
        other_parameters=qp.other_parameters if qp else {},
    )


def _build_sink_dto(sink):
    qr = sink.quality_requirement
    return SinkDTO(
        id=sink.id, name=sink.name,
        required_flow=sink.required_flow,
        ph_min=qr.ph_min if qr else None,
        ph_max=qr.ph_max if qr else None,
        tss_max=qr.tss_max if qr else None,
        cod_max=qr.cod_max if qr else None,
        bod_max=qr.bod_max if qr else None,
        tds_max=qr.tds_max if qr else None,
        temperature_min=qr.temperature_min if qr else None,
        temperature_max=qr.temperature_max if qr else None,
        other_limits=qr.other_limits if qr else {},
    )


def _build_treatment_dto(tx):
    op = tx.output_quality_profile
    return TreatmentDTO(
        id=tx.id, name=tx.name,
        max_flow=tx.max_flow,
        cost_per_unit=tx.cost_per_unit,
        output_ph=op.ph if op else None,
        output_tss=op.tss if op else None,
        output_cod=op.cod if op else None,
        output_bod=op.bod if op else None,
        output_tds=op.tds if op else None,
        output_temperature=op.temperature if op else None,
    )


def _wave(tick, base, amplitude, period=24):
    """Smooth sinusoidal drift: value oscillates around base."""
    return base + amplitude * math.sin(2 * math.pi * tick / period)


class SimulationEngine:
    def __init__(self, site_id):
        self.site = Site.objects.get(pk=site_id)
        self.state, _ = SimulationState.objects.get_or_create(site=self.site)

    def _get_tick_offset(self, ts):
        """Returns number of steps since the day started (for deterministic drift)."""
        midnight = ts.replace(hour=0, minute=0, second=0, microsecond=0)
        elapsed = (ts - midnight).total_seconds()
        return int(elapsed / max(self.state.step_interval_seconds, 1))

    def _generate_source_values(self, src, tick, scenario):
        """Return (flow, quality_updates) for a source at the given tick/scenario."""
        base_flow = float(src._base_flow if hasattr(src, '_base_flow') else src.available_flow)

        # Smooth oscillation: ±5% of base over a 48-step period
        flow = _wave(tick, base_flow, base_flow * 0.05, period=48)

        quality_updates = {}
        qp = src.quality_profile

        if qp:
            # BOD: oscillates ±15% unless degradation scenario
            base_bod = float(qp.bod or 20)
            new_bod = _wave(tick, base_bod, base_bod * 0.15)
            if scenario == 'QUALITY_DEGRADATION' and not src.is_freshwater:
                new_bod = base_bod + (tick % 10) * 2.0  # gradual degradation
            quality_updates['bod'] = max(0, round(new_bod, 2))

            # TDS
            base_tds = float(qp.tds or 350)
            new_tds = _wave(tick, base_tds, base_tds * 0.05)
            if scenario == 'QUALITY_DEGRADATION' and not src.is_freshwater:
                new_tds = base_tds + (tick % 10) * 10
            quality_updates['tds'] = max(0, round(new_tds, 1))

            # TSS
            base_tss = float(qp.tss or 30)
            quality_updates['tss'] = max(0, round(_wave(tick, base_tss, base_tss * 0.1), 2))

            # pH: smalll drift ±0.3
            base_ph = float(qp.ph or 7.0)
            quality_updates['ph'] = round(max(4.0, min(10.0, _wave(tick, base_ph, 0.3, period=24))), 2)

            # COD
            base_cod = float(qp.cod or 100)
            new_cod = _wave(tick, base_cod, base_cod * 0.12)
            if scenario == 'QUALITY_DEGRADATION' and not src.is_freshwater:
                new_cod = base_cod + (tick % 10) * 5
            quality_updates['cod'] = max(0, round(new_cod, 1))

        # Adjust flow for HIGH_DEMAND scenario - push sources harder
        if scenario == 'HIGH_DEMAND':
            flow = flow * 1.1

        return round(float(flow), 1), quality_updates

    def _generate_sink_demand(self, sink, tick, scenario):
        """Return new required_flow for a sink at the given tick/scenario."""
        base_demand = float(sink.required_flow or 50)
        demand = _wave(tick, base_demand, base_demand * 0.08, period=32)

        if scenario == 'HIGH_DEMAND':
            demand = base_demand * (1.15 + 0.05 * math.sin(tick))

        return round(float(max(1.0, demand)), 1)

    def _run_optimization(self, site, sources, sinks):
        """Build optimizer and persist result."""
        source_dtos = [_build_source_dto(s) for s in sources]
        sink_dtos = [_build_sink_dto(s) for s in sinks]
        treatments = list(TreatmentOption.objects.filter(site=site).select_related('output_quality_profile'))
        treatment_dtos = [_build_treatment_dto(t) for t in treatments]

        routing_costs = {}
        for conn in NetworkConnection.objects.filter(site=site, is_active=True):
            routing_costs[(conn.source_id, conn.sink_id, DIRECT_TREATMENT_ID)] = conn.routing_cost
            if conn.treatment_option_id:
                routing_costs[(conn.source_id, conn.sink_id, conn.treatment_option_id)] = conn.routing_cost

        opt_run = OptimizationRun.objects.create(
            site=site,
            status='running',
            solver_name='PuLP/CBC (Simulation)',
            parameters={'simulation_triggered': True, 'scenario': self.state.current_scenario}
        )

        optimizer = WaterPinchOptimizer(
            sources=source_dtos,
            sinks=sink_dtos,
            treatments=treatment_dtos,
            routing_costs=routing_costs,
            freshwater_penalty=1.0,
            allow_partial_demand=True,
        )
        result = optimizer.run()

        from django.utils import timezone as tz
        opt_run.status = result.status
        opt_run.solver_status = result.solver_status
        opt_run.freshwater_consumption = result.freshwater_consumption
        opt_run.reuse_flow = result.reuse_flow
        opt_run.treatment_flow = result.treatment_flow
        opt_run.estimated_operating_cost = result.estimated_operating_cost
        opt_run.unmet_demand_json = result.unmet_demands
        opt_run.objective_value = result.estimated_operating_cost
        opt_run.completed_at = tz.now()
        opt_run.save()

        if result.status == 'optimal':
            source_map = {s.id: s for s in sources}
            sink_map = {s.id: s for s in sinks}
            tx_map = {t.id: t for t in treatments}
            route_objects = []
            for r in result.routes:
                src_obj = source_map.get(r.source_id)
                sink_obj = sink_map.get(r.sink_id)
                tx_obj = tx_map.get(r.treatment_option_id) if r.treatment_option_id else None
                geom = None
                if src_obj and src_obj.location and sink_obj and sink_obj.location:
                    geom = {
                        'type': 'LineString',
                        'coordinates': [
                            src_obj.location['coordinates'],
                            sink_obj.location['coordinates']
                        ]
                    }
                route_objects.append(OptimizationRoute(
                    optimization_run=opt_run,
                    source=src_obj, sink=sink_obj, treatment_option=tx_obj,
                    allocated_flow=r.allocated_flow,
                    quality_status=r.quality_status,
                    treatment_required=r.treatment_required,
                    routing_cost=r.routing_cost,
                    treatment_cost=r.treatment_cost,
                    total_cost=r.total_cost,
                    geometry=geom,
                ))
            OptimizationRoute.objects.bulk_create(route_objects)

        return result

    def generate_next_tick(self):
        """Advance simulation by step_interval_seconds, generate readings, and conditionally re-optimize."""
        if not self.state.current_timestamp:
            now = timezone.now()
            self.state.current_timestamp = now.replace(hour=8, minute=0, second=0, microsecond=0)
        else:
            self.state.current_timestamp += timedelta(seconds=self.state.step_interval_seconds)

        ts = self.state.current_timestamp
        scenario = self.state.current_scenario
        tick = self._get_tick_offset(ts)

        sources = list(self.site.sources.select_related('quality_profile').all())
        sinks = list(self.site.sinks.select_related('quality_requirement').all())

        significant_change = False
        prev_bods = {s.id: (s.quality_profile.bod if s.quality_profile else None) for s in sources}

        # --- Update sources ---
        for src in sources:
            new_flow, quality_updates = self._generate_source_values(src, tick, scenario)
            old_flow = src.available_flow

            if abs(new_flow - (old_flow or 0)) > (old_flow or 1) * 0.06:
                significant_change = True

            src.available_flow = new_flow
            src.save(update_fields=['available_flow'])

            if quality_updates and src.quality_profile:
                qp = src.quality_profile
                old_bod = prev_bods[src.id] or 0
                for field, val in quality_updates.items():
                    setattr(qp, field, val)
                if abs((quality_updates.get('bod', old_bod) or 0) - old_bod) > 10:
                    significant_change = True
                qp.save()

            qp = src.quality_profile
            MonitoringReading.objects.create(
                site=self.site, source=src, timestamp=ts,
                flow_rate=src.available_flow,
                ph=qp.ph if qp else None,
                tds=qp.tds if qp else None,
                tss=qp.tss if qp else None,
                bod=qp.bod if qp else None,
                cod=qp.cod if qp else None,
                temperature=qp.temperature if qp else None,
                scenario=scenario,
            )

        # --- Update sinks ---
        for sink in sinks:
            new_demand = self._generate_sink_demand(sink, tick, scenario)
            old_demand = sink.required_flow or 0

            if abs(new_demand - old_demand) > old_demand * 0.07:
                significant_change = True

            sink.required_flow = new_demand
            sink.save(update_fields=['required_flow'])

            MonitoringReading.objects.create(
                site=self.site, sink=sink, timestamp=ts,
                flow_rate=sink.required_flow,
                scenario=scenario,
            )

        self.state.save()

        # Trigger optimization on significant data change or if no run exists yet
        latest_run = OptimizationRun.objects.filter(site=self.site).order_by('-created_at').first()
        if significant_change or not latest_run:
            self._run_optimization(self.site, sources, sinks)

        return ts
