from rest_framework import viewsets, permissions, status, serializers
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import PIDDocument, PIDZone, PIDGraphNode, PIDLine

class PIDDocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = PIDDocument
        fields = '__all__'

class PIDDocumentViewSet(viewsets.ModelViewSet):
    queryset = PIDDocument.objects.all()
    serializer_class = PIDDocumentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        site_id = self.request.query_params.get('site')
        if site_id:
            qs = qs.filter(site_id=site_id)
        return qs

    @action(detail=True, methods=['get'])
    def status(self, request, pk=None):
        doc = self.get_object()
        return Response({'status': doc.processing_status})

    @action(detail=True, methods=['get'])
    def objects(self, request, pk=None):
        return Response([]) # Place holder for mock/fallback execution

    @action(detail=True, methods=['get'])
    def lines(self, request, pk=None):
        return Response([]) 

    @action(detail=True, methods=['get'])
    def graph(self, request, pk=None):
        doc = self.get_object()
        
        # Build canonical graph response
        nodes = []
        for n in doc.nodes.all():
            obj = n.object_reference
            nodes.append({
                'id': n.id,
                'type': n.node_type,
                'label': n.label,
                'reference_type': obj.object_type if obj else 'unknown',
                'subtype': obj.subtype if obj else 'unknown',
                'x': obj.center_x if obj else 0,
                'y': obj.center_y if obj else 0,
                'bbox': obj.bbox if obj else None
            })
            
        edges = []
        for e in doc.edges.all():
            edges.append({
                'id': e.id,
                'source': e.source_node_id,
                'target': e.target_node_id,
                'type': e.edge_type,
                'direction': e.direction,
                'service': e.service
            })
            
        return Response({
            'nodes': nodes,
            'edges': edges,
            'status': 'validated'
        })

    @action(detail=True, methods=['get'])
    def zones(self, request, pk=None):
        return Response([])

    @action(detail=True, methods=['get'])
    def evidence(self, request, pk=None):
        return Response([])

    @action(detail=True, methods=['post'], url_path='zones/(?P<zone_id>[^/.]+)/confirm')
    def confirm_zone(self, request, pk=None, zone_id=None):
        return Response({'status': 'confirmed'})

    @action(detail=True, methods=['post'], url_path='zones/(?P<zone_id>[^/.]+)/reclassify')
    def reclassify_zone(self, request, pk=None, zone_id=None):
        return Response({'status': 'reclassified'})

    @action(detail=True, methods=['post'], url_path='zones/(?P<zone_id>[^/.]+)/merge')
    def merge_zone(self, request, pk=None, zone_id=None):
        return Response({'status': 'merged'})

    @action(detail=True, methods=['post'], url_path='zones/(?P<zone_id>[^/.]+)/split')
    def split_zone(self, request, pk=None, zone_id=None):
        return Response({'status': 'split'})

    @action(detail=True, methods=['post'], url_path='zones/(?P<zone_id>[^/.]+)/reject')
    def reject_zone(self, request, pk=None, zone_id=None):
        return Response({'status': 'rejected'})

    @action(detail=True, methods=['post', 'get'])
    def legend(self, request, pk=None):
        return Response({'legend': 'Extraction not implemented in mock.'})

    @action(detail=True, methods=['post'])
    def reprocess(self, request, pk=None):
        return Response({'status': 'PROCESSING_RESTARTED'})

    @action(detail=True, methods=['post'])
    def optimize(self, request, pk=None):
        return Response({'status': 'OPTIMIZATION_QUEUED'})
