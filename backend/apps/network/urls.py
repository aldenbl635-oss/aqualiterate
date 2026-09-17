from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    WaterSourceViewSet, WaterSinkViewSet,
    TreatmentOptionViewSet, NetworkConnectionViewSet, network_geojson
)

# Standalone router for flat access
local_router = DefaultRouter()
local_router.register('sources', WaterSourceViewSet, basename='source')
local_router.register('sinks', WaterSinkViewSet, basename='sink')
local_router.register('treatments', TreatmentOptionViewSet, basename='treatment')

urlpatterns = [
    path('', include(local_router.urls)),
    # Nested under sites - use explicit URL patterns to avoid circular imports
    path('sites/<int:site_pk>/sources/', WaterSourceViewSet.as_view({'get': 'list', 'post': 'create'}), name='site-sources-list'),
    path('sites/<int:site_pk>/sources/<int:pk>/', WaterSourceViewSet.as_view({
        'get': 'retrieve', 'put': 'update', 'patch': 'partial_update', 'delete': 'destroy'
    }), name='site-sources-detail'),
    path('sites/<int:site_pk>/sinks/', WaterSinkViewSet.as_view({'get': 'list', 'post': 'create'}), name='site-sinks-list'),
    path('sites/<int:site_pk>/sinks/<int:pk>/', WaterSinkViewSet.as_view({
        'get': 'retrieve', 'put': 'update', 'patch': 'partial_update', 'delete': 'destroy'
    }), name='site-sinks-detail'),
    path('sites/<int:site_pk>/treatments/', TreatmentOptionViewSet.as_view({'get': 'list', 'post': 'create'}), name='site-treatments-list'),
    path('sites/<int:site_pk>/connections/', NetworkConnectionViewSet.as_view({'get': 'list', 'post': 'create'}), name='site-connections-list'),
    path('sites/<int:site_pk>/network/', network_geojson, name='network-geojson'),
]
