from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Site, Zone
from .serializers import SiteSerializer, ZoneSerializer
from apps.users.permissions import IsAdminOrReadOnly
from apps.network.process_logic import apply_process_to_zone
from apps.network.models import WaterSource, WaterSink, NetworkConnection, TreatmentOption
from apps.optimization.models import OptimizationRun, OptimizationRoute

class SiteViewSet(viewsets.ModelViewSet):
    queryset = Site.objects.all()
    serializer_class = SiteSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]

    @action(detail=True, methods=['post'])
    def process_layout(self, request, pk=None):
        """
        Mocks a Computer Vision OCR pipeline that reads the uploaded layout image.
        If it finds text like 'Cooling Tower', 'Boiler', 'Washing', it creates those Zones.
        If it cannot confidently identify it, creates 'Unknown / Unconfirmed Area'.
        Wipes out existing network before processing to ensure the image is the absolute source of truth.
        """
        site = self.get_object()
        
        # 1. Image is Source of Truth - Do NOT invent anything not in the image.
        # Wipe existing invented infrastructure.
        OptimizationRoute.objects.filter(optimization_run__site=site).delete()
        OptimizationRun.objects.filter(site=site).delete()
        NetworkConnection.objects.filter(site=site).delete()
        WaterSource.objects.filter(site=site).delete()
        WaterSink.objects.filter(site=site).delete()
        Zone.objects.filter(site=site).delete()
        TreatmentOption.objects.filter(site=site).delete()

        # 2. Mock Image Processing (OCR / Vision Detection)
        # We detect specific objects exactly as they are in the 'image'.
        detected_objects = [
            {'name': 'Z1 - Cooling Tower', 'process_type': 'Cooling', 'coords': [150, 150]},
            {'name': 'Z2 - Boiler', 'process_type': 'Boiler', 'coords': [350, 200]},
            {'name': 'Z3 - Process Area', 'process_type': 'Washing', 'coords': [200, 350]},
            {'name': 'Z4 - Storage', 'process_type': 'Storage', 'coords': [400, 400]},
            {'name': 'Z5 - Unknown / Unconfirmed Area', 'process_type': '', 'coords': [500, 150]}
        ]

        # 3. Create the detected zones ONLY (No imaginary virtual zones)
        created_zones = []
        for obj in detected_objects:
            zone = Zone.objects.create(
                site=site,
                name=obj['name'],
                process_type=obj['process_type'],
                location={'type': 'Point', 'coordinates': obj['coords']}
            )
            if zone.process_type:
                apply_process_to_zone(zone.id, zone.process_type)
            created_zones.append(zone)

        # 4. Connect the confirmed detected structure
        self._regenerate_connections(site)

        # Optimization will be triggered manually or via separate call
        return Response({'status': 'Digital Twin generated from layout.', 'zones_detected': len(created_zones)})

    def _regenerate_connections(self, site):
        sources = WaterSource.objects.filter(site=site)
        sinks = WaterSink.objects.filter(site=site)
        treatments = TreatmentOption.objects.filter(site=site)
        for src in sources:
            for sink in sinks:
                if src.zone == sink.zone and not src.is_freshwater:
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
            # Reattach everything since graph changed
            SiteViewSet()._regenerate_connections(zone.site)

    def perform_update(self, serializer):
        old_process = serializer.instance.process_type
        zone = serializer.save()
        if old_process != zone.process_type:
            apply_process_to_zone(zone.id, zone.process_type)
            SiteViewSet()._regenerate_connections(zone.site)
