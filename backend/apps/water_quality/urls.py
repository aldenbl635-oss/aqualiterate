from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    WaterQualityProfileViewSet, WaterQualityRequirementViewSet,
    TNPCBReadingViewSet, tnpcb_import
)

local_router = DefaultRouter()
local_router.register('water-quality', WaterQualityProfileViewSet, basename='water-quality')
local_router.register('water-quality-requirements', WaterQualityRequirementViewSet, basename='water-quality-req')

urlpatterns = [
    path('', include(local_router.urls)),
    path('sites/<int:site_pk>/water-quality/', WaterQualityProfileViewSet.as_view({'get': 'list', 'post': 'create'}), name='site-water-quality-list'),
    path('sites/<int:site_pk>/tnpcb/readings/', TNPCBReadingViewSet.as_view({'get': 'list'}), name='site-tnpcb-readings'),
    path('sites/<int:site_pk>/tnpcb/import/', tnpcb_import, name='tnpcb-import'),
]
