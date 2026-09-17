from rest_framework import viewsets, permissions
from .models import Site, Zone
from .serializers import SiteSerializer, ZoneSerializer
from apps.users.permissions import IsAdminOrReadOnly


class SiteViewSet(viewsets.ModelViewSet):
    queryset = Site.objects.all()
    serializer_class = SiteSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]


class ZoneViewSet(viewsets.ModelViewSet):
    serializer_class = ZoneSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]

    def get_queryset(self):
        site_id = self.kwargs.get('site_pk')
        if site_id:
            return Zone.objects.filter(site_id=site_id)
        return Zone.objects.all()

    def perform_create(self, serializer):
        site_id = self.kwargs.get('site_pk')
        if site_id:
            serializer.save(site_id=site_id)
        else:
            serializer.save()
