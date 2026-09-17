from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import AIRecommendationViewSet, analyze_report

local_router = DefaultRouter()
local_router.register('ai-recommendations', AIRecommendationViewSet, basename='ai-recommendation')

urlpatterns = [
    path('', include(local_router.urls)),
    path('sites/<int:site_pk>/ai-recommendations/', AIRecommendationViewSet.as_view({'get': 'list'}), name='site-ai-recs'),
    path('reports/<int:report_id>/analyze/', analyze_report, name='analyze-report'),
]
