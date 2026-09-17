from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import SiteViewSet, ZoneViewSet

router = DefaultRouter()
router.register('sites', SiteViewSet, basename='site')

urlpatterns = [
    path('', include(router.urls)),
    # Zone endpoints
    path('sites/<int:site_pk>/zones/', ZoneViewSet.as_view({'get': 'list', 'post': 'create'}), name='site-zones-list'),
    path('sites/<int:site_pk>/zones/<int:pk>/', ZoneViewSet.as_view({
        'get': 'retrieve', 'put': 'update', 'patch': 'partial_update', 'delete': 'destroy'
    }), name='site-zones-detail'),
    path('zones/<int:pk>/', ZoneViewSet.as_view({
        'get': 'retrieve', 'put': 'update', 'delete': 'destroy'
    }), name='zone-detail'),
]
