from rest_framework.decorators import api_view, permission_classes
from rest_framework import permissions
from rest_framework.response import Response
from django.db.models import Sum, Count, Q

from apps.sites.models import Site
from apps.network.models import WaterSource, WaterSink
from apps.optimization.models import OptimizationRun
from apps.reports.models import ContaminationReport
from apps.ai_advisory.models import AIRecommendation


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def dashboard_kpis(request, site_pk):
    """
    GET /api/sites/{site_pk}/dashboard/kpis/
    Returns aggregated KPIs for the dashboard.
    """
    try:
        site = Site.objects.get(pk=site_pk)
    except Site.DoesNotExist:
        return Response({'error': 'Site not found'}, status=404)

    # Network state
    total_available = WaterSource.objects.filter(site=site).aggregate(
        total=Sum('available_flow')
    )['total'] or 0.0

    total_demand = WaterSink.objects.filter(site=site).aggregate(
        total=Sum('required_flow')
    )['total'] or 0.0

    # Latest optimal optimization run
    latest_run = OptimizationRun.objects.filter(
        site=site, status='optimal'
    ).order_by('-created_at').first()

    freshwater_consumption = 0.0
    reuse_flow = 0.0
    treatment_flow = 0.0
    operating_cost = 0.0
    unmet_demand = 0.0

    if latest_run:
        freshwater_consumption = latest_run.freshwater_consumption or 0.0
        reuse_flow = latest_run.reuse_flow or 0.0
        treatment_flow = latest_run.treatment_flow or 0.0
        operating_cost = latest_run.estimated_operating_cost or 0.0
        unmet_demand = sum(latest_run.unmet_demand_json.values()) if latest_run.unmet_demand_json else 0.0

    # Reports
    open_reports = ContaminationReport.objects.filter(
        site=site, status__in=['open', 'under_review', 'action_required']
    ).count()

    # AI recs
    pending_recs = AIRecommendation.objects.filter(
        site=site, status__in=['pending', 'flagged']
    ).count()

    return Response({
        'freshwater_consumption': round(freshwater_consumption, 3),
        'total_available_water': round(total_available, 3),
        'total_sink_demand': round(total_demand, 3),
        'reuse_flow': round(reuse_flow, 3),
        'treatment_flow': round(treatment_flow, 3),
        'unmet_demand': round(unmet_demand, 3),
        'operating_cost': round(operating_cost, 3),
        'contamination_reports_open': open_reports,
        'ai_recommendations_pending': pending_recs,
        'latest_optimization_run_id': latest_run.id if latest_run else None,
        'latest_optimization_status': latest_run.status if latest_run else None,
    })
