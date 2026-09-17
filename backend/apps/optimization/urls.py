from django.urls import path
from .views import run_optimization, list_runs, run_detail, run_routes

urlpatterns = [
    path('sites/<int:site_pk>/optimization/run/', run_optimization, name='optimization-run'),
    path('sites/<int:site_pk>/optimization/runs/', list_runs, name='optimization-list'),
    path('optimization/runs/<int:run_id>/', run_detail, name='optimization-detail'),
    path('optimization/runs/<int:run_id>/routes/', run_routes, name='optimization-routes'),
]
