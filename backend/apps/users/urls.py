from django.urls import path
from .views import RegisterView, me

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('me/', me, name='me'),
]
