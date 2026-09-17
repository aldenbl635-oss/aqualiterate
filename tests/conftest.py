"""
pytest-django configuration.
Sets up the Django environment for all tests.
"""
import django
from django.conf import settings


def pytest_configure():
    """Configure Django settings for test run."""
    if not settings.configured:
        settings.configure(
            DATABASES={
                'default': {
                    'ENGINE': 'django.contrib.gis.db.backends.postgis',
                    'NAME': 'aquaiterate_test',
                    'USER': 'aquauser',
                    'PASSWORD': 'aquapass',
                    'HOST': 'localhost',
                    'PORT': '5432',
                    'TEST': {'NAME': 'aquaiterate_test'},
                }
            },
            INSTALLED_APPS=[
                'django.contrib.contenttypes',
                'django.contrib.auth',
                'django.contrib.gis',
                'rest_framework',
                'rest_framework_gis',
                'apps.users',
                'apps.sites',
                'apps.network',
                'apps.water_quality',
                'apps.optimization',
                'apps.reports',
                'apps.ai_advisory',
                'apps.dashboard',
            ],
            AUTH_USER_MODEL='users.User',
            DEFAULT_AUTO_FIELD='django.db.models.BigAutoField',
            SECRET_KEY='test-secret-key',
            USE_TZ=True,
            REST_FRAMEWORK={
                'DEFAULT_AUTHENTICATION_CLASSES': [
                    'rest_framework_simplejwt.authentication.JWTAuthentication',
                ],
            },
        )
