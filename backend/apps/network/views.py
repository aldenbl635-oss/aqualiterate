from rest_framework import viewsets, permissions
from rest_framework.decorators import action
from rest_framework.response import Response

import json

from .models import WaterSource, WaterSink, TreatmentOption, NetworkConnection
from apps.sites.models import Zone
from .serializers import (
    WaterSourceSerializer, WaterSinkSerializer,
    TreatmentOptionSerializer, NetworkConnectionSerializer
)
from apps.users.permissions import IsAdminOrReadOnly


class WaterSourceViewSet(viewsets.ModelViewSet):
    serializer_class = WaterSourceSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]

    def get_queryset(self):
        site_id = self.kwargs.get('site_pk')
        if site_id:
            return WaterSource.objects.filter(site_id=site_id).select_related('quality_profile', 'zone')
        return WaterSource.objects.all().select_related('quality_profile', 'zone')

    def perform_create(self, serializer):
        site_id = self.kwargs.get('site_pk')
        if site_id:
            serializer.save(site_id=site_id)
        else:
            serializer.save()


class WaterSinkViewSet(viewsets.ModelViewSet):
    serializer_class = WaterSinkSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]

    def get_queryset(self):
        site_id = self.kwargs.get('site_pk')
        if site_id:
            return WaterSink.objects.filter(site_id=site_id).select_related('quality_requirement', 'zone')
        return WaterSink.objects.all().select_related('quality_requirement', 'zone')

    def perform_create(self, serializer):
        site_id = self.kwargs.get('site_pk')
        if site_id:
            serializer.save(site_id=site_id)
        else:
            serializer.save()


class TreatmentOptionViewSet(viewsets.ModelViewSet):
    serializer_class = TreatmentOptionSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]

    def get_queryset(self):
        site_id = self.kwargs.get('site_pk')
        if site_id:
            return TreatmentOption.objects.filter(site_id=site_id)
        return TreatmentOption.objects.all()


class NetworkConnectionViewSet(viewsets.ModelViewSet):
    serializer_class = NetworkConnectionSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]

    def get_queryset(self):
        site_id = self.kwargs.get('site_pk')
        if site_id:
            return NetworkConnection.objects.filter(site_id=site_id).select_related('source', 'sink')
        return NetworkConnection.objects.all()


from rest_framework.decorators import api_view, permission_classes
from apps.optimization.models import OptimizationRun, OptimizationRoute
from apps.simulation.models import MonitoringReading
from apps.sites.models import Site


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def network_geojson(request, site_pk):
    """Return GeoJSON of the full network for Leaflet rendering."""
    try:
        site = Site.objects.get(pk=site_pk)
    except Site.DoesNotExist:
        return Response({'error': 'Site not found'}, status=404)

    features = []

    # Get recent readings
    recent_readings = MonitoringReading.objects.filter(site=site).order_by('-timestamp')[:200]
    reading_map = {'sources': {}, 'sinks': {}}
    for r in recent_readings:
        if r.source_id and r.source_id not in reading_map['sources']:
            # grab top 2
            reading_map['sources'][r.source_id] = [r]
        elif r.source_id and len(reading_map['sources'][r.source_id]) < 2:
            reading_map['sources'][r.source_id].append(r)
            
        if r.sink_id and r.sink_id not in reading_map['sinks']:
            reading_map['sinks'][r.sink_id] = [r]
        elif r.sink_id and len(reading_map['sinks'][r.sink_id]) < 2:
            reading_map['sinks'][r.sink_id].append(r)
            
    def append_readings(props, r_list):
        if r_list and len(r_list) > 0:
            c = r_list[0]
            props['flow'] = c.flow_rate
            props['pH'] = c.ph
            props['TSS'] = c.tss
            props['BOD'] = c.bod
            props['COD'] = c.cod
            if len(r_list) > 1:
                p = r_list[1]
                props['old_flow'] = p.flow_rate
                props['old_pH'] = p.ph
                props['old_TSS'] = p.tss
                props['old_BOD'] = p.bod
                props['old_COD'] = p.cod

    # Zones
    for zone in site.zones.all():
        if zone.location:
            features.append({
                'type': 'Feature',
                'geometry': zone.location,
                'properties': {
                    'type': 'zone',
                    'id': zone.id,
                    'name': zone.name,
                    'zone_type': zone.zone_type,
                }
            })

    # Sources
    for src in site.sources.select_related('quality_profile', 'zone').all():
        geom = src.location if src.location else None
        features.append({
            'type': 'Feature',
            'geometry': geom,
            'properties': {
                'type': 'source',
                'id': src.id,
                'name': src.name,
                'source_type': src.source_type,
                'available_flow': src.available_flow,
                'unit': src.unit,
                'is_freshwater': src.is_freshwater,
                'quality_profile': src.quality_profile.id if src.quality_profile else None,
                'zone_name': src.zone.name if src.zone else None,
            }
        })
        append_readings(features[-1]['properties'], reading_map['sources'].get(src.id, []))

    # Sinks
    for sink in site.sinks.select_related('quality_requirement', 'zone').all():
        geom = sink.location if sink.location else None
        features.append({
            'type': 'Feature',
            'geometry': geom,
            'properties': {
                'type': 'sink',
                'id': sink.id,
                'name': sink.name,
                'sink_type': sink.sink_type,
                'required_flow': sink.required_flow,
                'unit': sink.unit,
                'quality_requirement': sink.quality_requirement.id if sink.quality_requirement else None,
                'recovery_source': sink.recovery_source_id,
                'is_terminal': sink.is_terminal,
                'zone_name': sink.zone.name if sink.zone else None,
            }
        })
        append_readings(features[-1]['properties'], reading_map['sinks'].get(sink.id, []))

    # Active network connections
    for conn in site.connections.select_related('source', 'sink').filter(is_active=True):
        geom = conn.geometry if conn.geometry else None
        features.append({
            'type': 'Feature',
            'geometry': geom,
            'properties': {
                'type': 'connection',
                'id': conn.id,
                'source_id': conn.source_id,
                'sink_id': conn.sink_id,
                'routing_cost': conn.routing_cost,
            }
        })

    # Latest optimized routes
    latest_run = OptimizationRun.objects.filter(site=site, status='optimal').order_by('-created_at').first()
    if latest_run:
        for route in latest_run.routes.select_related('source', 'sink').all():
            geom = route.geometry if route.geometry else None
            features.append({
                'type': 'Feature',
                'geometry': geom,
                'properties': {
                    'type': 'optimized_route',
                    'id': route.id,
                    'source_id': route.source_id,
                    'sink_id': route.sink_id,
                    'allocated_flow': route.allocated_flow,
                    'quality_status': route.quality_status,
                    'treatment_required': route.treatment_required,
                    'routing_cost': route.routing_cost,
                    'total_cost': route.total_cost,
                    'source_name': route.source.name if route.source else None,
                    'sink_name': route.sink.name if route.sink else None,
                }
            })
            append_readings(features[-1]['properties'], reading_map['sources'].get(route.source_id, []))

    return Response({
        'type': 'FeatureCollection',
        'features': features
    })
