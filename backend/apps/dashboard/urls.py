from django.urls import path
from .views import dashboard_kpis

urlpatterns = [
    path('sites/<int:site_pk>/dashboard/kpis/', dashboard_kpis, name='dashboard-kpis'),
]
