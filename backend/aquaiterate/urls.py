"""AquaIterate URL configuration."""
from django.contrib import admin
from django.urls import path, include
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    # Auth
    path('api/auth/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/auth/', include('apps.users.urls')),
    # Core resources
    path('api/', include('apps.sites.urls')),
    path('api/', include('apps.network.urls')),
    path('api/', include('apps.water_quality.urls')),
    path('api/', include('apps.optimization.urls')),
    path('api/', include('apps.reports.urls')),
    path('api/', include('apps.ai_advisory.urls')),
    path('api/', include('apps.dashboard.urls')),
    path('api/sites/', include('apps.simulation.urls')),
]
