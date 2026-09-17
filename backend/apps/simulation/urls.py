from django.urls import path
from apps.simulation import views

urlpatterns = [
    path('<int:site_pk>/simulation/state/', views.get_simulation_state, name='simulation-state'),
    path('<int:site_pk>/simulation/control/', views.control_simulation, name='simulation-control'),
]
