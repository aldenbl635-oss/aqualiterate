from rest_framework import viewsets, permissions
from django_filters.rest_framework import DjangoFilterBackend
from .models import ContaminationReport
from .serializers import ContaminationReportSerializer
from apps.users.permissions import IsAdminOrReadOnly


class ContaminationReportViewSet(viewsets.ModelViewSet):
    serializer_class = ContaminationReportSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['site', 'zone', 'severity', 'status']

    def get_queryset(self):
        user = self.request.user
        site_id = self.kwargs.get('site_pk')
        qs = ContaminationReport.objects.all().select_related('zone', 'reported_by')
        if site_id:
            qs = qs.filter(site_id=site_id)
        # Workers see only their own reports
        if user.role == 'worker':
            qs = qs.filter(reported_by=user)
        return qs

    def perform_create(self, serializer):
        site_id = self.kwargs.get('site_pk')
        if site_id:
            serializer.save(site_id=site_id)
        else:
            serializer.save()

    def get_permissions(self):
        if self.action in ('update', 'partial_update'):
            return [permissions.IsAuthenticated(), IsAdminOrReadOnly()]
        return super().get_permissions()
