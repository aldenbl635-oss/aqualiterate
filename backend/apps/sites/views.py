from rest_framework import viewsets, permissions
from .models import Site, Zone
from .serializers import SiteSerializer, ZoneSerializer
from apps.users.permissions import IsAdminOrReadOnly
from apps.network.process_logic import apply_process_to_zone
from apps.network.models import WaterSource, WaterSink, NetworkConnection, TreatmentOption


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
            zone = serializer.save(site_id=site_id)
        else:
            zone = serializer.save()
        
        if zone.process_type:
            apply_process_to_zone(zone.id, zone.process_type)
            self._regenerate_connections(zone.site)

    def perform_update(self, serializer):
        old_process = serializer.instance.process_type
        zone = serializer.save()
        if old_process != zone.process_type:
            apply_process_to_zone(zone.id, zone.process_type)
            self._regenerate_connections(zone.site)

    def _regenerate_connections(self, site):
        # Very simple: connect every source to every sink with some arbitrary cost.
        sources = WaterSource.objects.filter(site=site)
        sinks = WaterSink.objects.filter(site=site)
        treatments = TreatmentOption.objects.filter(site=site)
        
        for src in sources:
            for sink in sinks:
                if src.zone == sink.zone and not src.is_freshwater:
                    # don't loop back to itself usually unless it's a specific cycle
                    pass
                NetworkConnection.objects.get_or_create(
                    site=site, source=src, sink=sink, treatment_option=None,
                    defaults={'routing_cost': 0.1, 'is_active': True}
                )
                for tx in treatments:
                    NetworkConnection.objects.get_or_create(
                        site=site, source=src, sink=sink, treatment_option=tx,
                        defaults={'routing_cost': 0.15, 'is_active': True}
                    )

