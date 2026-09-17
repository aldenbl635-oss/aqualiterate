from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ContaminationReportViewSet

local_router = DefaultRouter()
local_router.register('reports', ContaminationReportViewSet, basename='report')

urlpatterns = [
    path('', include(local_router.urls)),
    path('sites/<int:site_pk>/reports/', ContaminationReportViewSet.as_view({'get': 'list', 'post': 'create'}), name='site-reports-list'),
    path('sites/<int:site_pk>/reports/<int:pk>/', ContaminationReportViewSet.as_view({
        'get': 'retrieve', 'put': 'update', 'patch': 'partial_update'
    }), name='site-reports-detail'),
]
