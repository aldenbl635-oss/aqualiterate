from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import PIDDocumentViewSet

router = DefaultRouter()
router.register('pid', PIDDocumentViewSet, basename='pid')

urlpatterns = [
    path('', include(router.urls)),
]
