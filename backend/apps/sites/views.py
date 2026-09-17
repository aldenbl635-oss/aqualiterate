from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Site, Zone
from .serializers import SiteSerializer, ZoneSerializer
from apps.users.permissions import IsAdminOrReadOnly
from apps.network.process_logic import apply_process_to_zone, PROCESS_TEMPLATES
from apps.network.models import WaterSource, WaterSink, NetworkConnection, TreatmentOption
from apps.optimization.models import OptimizationRun, OptimizationRoute

class SiteViewSet(viewsets.ModelViewSet):
    queryset = Site.objects.all()
    serializer_class = SiteSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]

    @action(detail=False, methods=['get'])
    def process_templates(self, request):
        return Response(list(PROCESS_TEMPLATES.keys()))

    @action(detail=True, methods=['post'])
    def process_layout(self, request, pk=None):
        """
        Mocks a Computer Vision OCR pipeline that reads the uploaded layout image.
        Uses a hash of the image to deterministically generate layout zones dynamically 
        so different layout images actually produce different structural trees.
        """
        site = self.get_object()
        
        OptimizationRoute.objects.filter(optimization_run__site=site).delete()
        OptimizationRun.objects.filter(site=site).delete()
        NetworkConnection.objects.filter(site=site).delete()
        WaterSource.objects.filter(site=site).delete()
        WaterSink.objects.filter(site=site).delete()
        Zone.objects.filter(site=site).delete()
        TreatmentOption.objects.filter(site=site).delete()

        import hashlib
        import random

        image_seed = 42
        if site.layout_image:
            try:
                with site.layout_image.open('rb') as f:
                    file_hash = hashlib.md5(f.read()).hexdigest()
                    image_seed = int(file_hash[:8], 16)
            except Exception:
                pass
        
        random.seed(image_seed)
        num_zones = random.randint(3, 8)
        
        possible_processes = list(PROCESS_TEMPLATES.keys())
        possible_processes.append('Unidentified Area')
        
        detected_objects = []
        for i in range(num_zones):
            process = random.choice(possible_processes)
            is_unidentified = (process == 'Unidentified Area')
            name = f"Zone {i+1}"
            if not is_unidentified:
                name += f" - {process}"
            else:
                name += " - Unknown"
                
            process_type = '' if is_unidentified else process
            coords = [random.randint(50, 750), random.randint(50, 550)]
            detected_objects.append({'name': name, 'process_type': process_type, 'coords': coords})

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

        self._regenerate_connections(site)

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
