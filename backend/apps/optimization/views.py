"""
Optimization views.
Loads the site network, runs the water-pinch LP via `engine.py`, stores and
returns the result.
"""
from django.utils import timezone

from rest_framework import status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from apps.sites.models import Site
from apps.network.models import WaterSource, WaterSink, TreatmentOption
from .models import OptimizationRun, OptimizationRoute
from .serializers import OptimizationRunSerializer, OptimizationRunListSerializer, OptimizationRouteSerializer
from .engine import (
    WaterPinchOptimizer, SourceDTO, SinkDTO, TreatmentDTO, DIRECT_TREATMENT_ID
)
from apps.users.permissions import IsAdminUser


def _build_source_dto(src: WaterSource) -> SourceDTO:
    qp = src.quality_profile
    return SourceDTO(
        id=src.id,
        name=src.name,
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


def _build_sink_dto(sink: WaterSink) -> SinkDTO:
    qr = sink.quality_requirement
    return SinkDTO(
        id=sink.id,
        name=sink.name,
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


def _build_treatment_dto(tx: TreatmentOption) -> TreatmentDTO:
    op = tx.output_quality_profile
    return TreatmentDTO(
        id=tx.id,
        name=tx.name,
        max_flow=tx.max_flow,
        cost_per_unit=tx.cost_per_unit,
        output_ph=op.ph if op else None,
        output_tss=op.tss if op else None,
        output_cod=op.cod if op else None,
        output_bod=op.bod if op else None,
        output_tds=op.tds if op else None,
        output_temperature=op.temperature if op else None,
    )


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated, IsAdminUser])
def run_optimization(request, site_pk):
    """
    POST /api/sites/{site_pk}/optimization/run/
    Body: { "freshwater_penalty": 1.0, "allow_partial_demand": true }
    """
    try:
        site = Site.objects.get(pk=site_pk)
    except Site.DoesNotExist:
        return Response({'error': 'Site not found'}, status=status.HTTP_404_NOT_FOUND)

    freshwater_penalty = float(request.data.get('freshwater_penalty', 1.0))
    allow_partial = bool(request.data.get('allow_partial_demand', True))

    # Load network state
    sources = list(WaterSource.objects.filter(site=site).select_related('quality_profile'))
    sinks = list(WaterSink.objects.filter(site=site).select_related('quality_requirement'))
    treatments = list(TreatmentOption.objects.filter(site=site))

    if not sources:
        return Response({'error': 'No water sources defined for this site.'}, status=400)
    if not sinks:
        return Response({'error': 'No water sinks defined for this site.'}, status=400)

    source_dtos = [_build_source_dto(s) for s in sources]
    sink_dtos = [_build_sink_dto(s) for s in sinks]
    treatment_dtos = [_build_treatment_dto(t) for t in treatments]

    # Build routing costs from NetworkConnection if available, else default 0
    from apps.network.models import NetworkConnection
    routing_costs = {}
    for conn in NetworkConnection.objects.filter(site=site, is_active=True):
        # Direct route cost
        routing_costs[(conn.source_id, conn.sink_id, DIRECT_TREATMENT_ID)] = conn.routing_cost
        # Treatment route costs
        if conn.treatment_option_id:
            routing_costs[(conn.source_id, conn.sink_id, conn.treatment_option_id)] = conn.routing_cost

    # Create pending run record
    opt_run = OptimizationRun.objects.create(
        site=site,
        status='running',
        solver_name='PuLP/CBC',
        parameters={
            'freshwater_penalty': freshwater_penalty,
            'allow_partial_demand': allow_partial,
        }
    )

    optimizer = WaterPinchOptimizer(
        sources=source_dtos,
        sinks=sink_dtos,
        treatments=treatment_dtos,
        routing_costs=routing_costs,
        freshwater_penalty=freshwater_penalty,
        allow_partial_demand=allow_partial,
    )
    result = optimizer.run()

    # Update run record
    opt_run.status = result.status
    opt_run.solver_status = result.solver_status
    opt_run.freshwater_consumption = result.freshwater_consumption
    opt_run.reuse_flow = result.reuse_flow
    opt_run.treatment_flow = result.treatment_flow
    opt_run.estimated_operating_cost = result.estimated_operating_cost
    opt_run.unmet_demand_json = result.unmet_demands
    opt_run.objective_value = result.estimated_operating_cost
    opt_run.completed_at = timezone.now()
    opt_run.save()

    # If infeasible/error, return early
    if result.status in ('infeasible', 'error'):
        return Response({
            'status': result.status,
            'message': result.message,
            'run_id': opt_run.id,
        }, status=status.HTTP_200_OK)

    # Store optimised routes
    # Build source/sink lookup by id
    source_map = {s.id: s for s in sources}
    sink_map = {s.id: s for s in sinks}
    tx_map = {t.id: t for t in treatments}

    route_objects = []
    for r in result.routes:
        src_obj = source_map.get(r.source_id)
        sink_obj = sink_map.get(r.sink_id)
        tx_obj = tx_map.get(r.treatment_option_id) if r.treatment_option_id else None

        # Auto-build geometry from source/sink locations if available
        geom = None
        if src_obj and src_obj.location and sink_obj and sink_obj.location:
            try:
                geom = LineString(
                    (src_obj.location.x, src_obj.location.y),
                    (sink_obj.location.x, sink_obj.location.y),
                    srid=4326
                )
            except Exception:
                geom = None

        route_objects.append(OptimizationRoute(
            optimization_run=opt_run,
            source=src_obj,
            sink=sink_obj,
            treatment_option=tx_obj,
            allocated_flow=r.allocated_flow,
            quality_status=r.quality_status,
            treatment_required=r.treatment_required,
            routing_cost=r.routing_cost,
            treatment_cost=r.treatment_cost,
            total_cost=r.total_cost,
            geometry=geom,
        ))

    OptimizationRoute.objects.bulk_create(route_objects)

    serializer = OptimizationRunSerializer(opt_run)
    return Response(serializer.data, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def list_runs(request, site_pk):
    """GET /api/sites/{site_pk}/optimization/runs/"""
    runs = OptimizationRun.objects.filter(site_id=site_pk)
    serializer = OptimizationRunListSerializer(runs, many=True)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def run_detail(request, run_id):
    """GET /api/optimization/runs/{run_id}/"""
    try:
        run = OptimizationRun.objects.get(pk=run_id)
    except OptimizationRun.DoesNotExist:
        return Response({'error': 'Run not found'}, status=404)
    serializer = OptimizationRunSerializer(run)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def run_routes(request, run_id):
    """GET /api/optimization/runs/{run_id}/routes/"""
    routes = OptimizationRoute.objects.filter(optimization_run_id=run_id).select_related('source', 'sink')
    serializer = OptimizationRouteSerializer(routes, many=True)
    return Response(serializer.data)
