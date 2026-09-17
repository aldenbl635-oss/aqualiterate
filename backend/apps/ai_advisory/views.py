from rest_framework import viewsets, permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from apps.reports.models import ContaminationReport
from .models import AIRecommendation
from .serializers import AIRecommendationSerializer
from .engine import AdvisoryInput, generate_advisory
from apps.users.permissions import IsAdminOrReadOnly


class AIRecommendationViewSet(viewsets.ModelViewSet):
    serializer_class = AIRecommendationSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]

    def get_queryset(self):
        site_id = self.kwargs.get('site_pk') or self.request.query_params.get('site')
        qs = AIRecommendation.objects.all().select_related('report')
        if site_id:
            qs = qs.filter(site_id=site_id)
        return qs


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def analyze_report(request, report_id):
    """
    POST /api/reports/{report_id}/analyze/
    Run the AI advisory engine on a contamination report and store the result.
    """
    try:
        report = ContaminationReport.objects.select_related('zone', 'site').get(pk=report_id)
    except ContaminationReport.DoesNotExist:
        return Response({'error': 'Report not found'}, status=status.HTTP_404_NOT_FOUND)

    # Count open reports in the same zone for pattern detection
    open_in_zone = 0
    if report.zone:
        open_in_zone = ContaminationReport.objects.filter(
            zone=report.zone, status__in=['open', 'under_review', 'action_required']
        ).count()

    inp = AdvisoryInput(
        report_id=report.id,
        title=report.title,
        description=report.description,
        severity=report.severity,
        zone_name=report.zone.name if report.zone else None,
        site_name=report.site.name,
        open_reports_in_zone=open_in_zone,
    )

    advisory = generate_advisory(inp)

    rec = AIRecommendation.objects.create(
        site=report.site,
        report=report,
        recommendation=advisory.recommendation,
        reasoning_summary=advisory.reasoning_summary,
        recommended_action=advisory.recommended_action,
        priority=advisory.priority,
        generated_by=advisory.generated_by,
    )

    # Escalate report status if high/critical
    if advisory.priority in ('high', 'urgent') and report.status == 'open':
        report.status = 'action_required'
        report.save(update_fields=['status'])

    serializer = AIRecommendationSerializer(rec)
    return Response(serializer.data, status=status.HTTP_201_CREATED)
