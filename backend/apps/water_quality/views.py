from rest_framework import viewsets, permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import OrderingFilter, SearchFilter

from .models import WaterQualityProfile, WaterQualityRequirement, TNPCBReading
from .serializers import (
    WaterQualityProfileSerializer, WaterQualityRequirementSerializer,
    TNPCBReadingSerializer, TNPCBImportRowSerializer
)
from apps.sites.models import Site
from apps.users.permissions import IsAdminOrReadOnly


class WaterQualityProfileViewSet(viewsets.ModelViewSet):
    queryset = WaterQualityProfile.objects.all()
    serializer_class = WaterQualityProfileSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]


class WaterQualityRequirementViewSet(viewsets.ModelViewSet):
    queryset = WaterQualityRequirement.objects.all()
    serializer_class = WaterQualityRequirementSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]


class TNPCBReadingViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = TNPCBReadingSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, OrderingFilter, SearchFilter]
    filterset_fields = ['site', 'parameter_name', 'dataset_name']
    search_fields = ['source_reference', 'parameter_name', 'dataset_name']
    ordering_fields = ['sample_time', 'parameter_name']
    ordering = ['-sample_time']

    def get_queryset(self):
        site_id = self.kwargs.get('site_pk')
        if site_id:
            return TNPCBReading.objects.filter(site_id=site_id)
        return TNPCBReading.objects.all()


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def tnpcb_import(request, site_pk):
    """
    Import TNPCB readings for a site.
    Expects: { "readings": [ { row }, ... ] }
    Original values are preserved; not modified.
    """
    try:
        site = Site.objects.get(pk=site_pk)
    except Site.DoesNotExist:
        return Response({'error': 'Site not found'}, status=status.HTTP_404_NOT_FOUND)

    rows = request.data.get('readings', [])
    if not isinstance(rows, list) or not rows:
        return Response(
            {'error': 'Payload must contain a non-empty "readings" list.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    errors = []
    created = []

    for i, row in enumerate(rows):
        serializer = TNPCBImportRowSerializer(data=row)
        if not serializer.is_valid():
            errors.append({'row': i, 'errors': serializer.errors})
            continue

        data = serializer.validated_data
        lat = data.get('latitude')
        lon = data.get('longitude')
        location = {'type': 'Point', 'coordinates': [lon, lat]} if (lat is not None and lon is not None) else None

        reading = TNPCBReading.objects.create(
            site=site,
            source_reference=data['source_reference'],
            location=location,
            sample_time=data.get('sample_time'),
            parameter_name=data['parameter_name'],
            parameter_value=data['parameter_value'],
            unit=data.get('unit', ''),
            dataset_name=data['dataset_name'],
            dataset_reference=data.get('dataset_reference', ''),
        )
        created.append(reading.id)

    return Response({
        'imported': len(created),
        'errors': errors,
        'created_ids': created,
    }, status=status.HTTP_201_CREATED if created else status.HTTP_400_BAD_REQUEST)
