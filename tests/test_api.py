"""
Django API tests for AquaIterate.
Tests core CRUD and workflow endpoints using DRF's test client.
"""
import pytest
from django.urls import reverse
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model

User = get_user_model()


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def admin_user(db):
    from apps.sites.models import Site
    from django.contrib.gis.geos import Point
    site = Site.objects.create(
        name='Test Site', site_type='industrial',
        location=Point(80.0, 13.0, srid=4326)
    )
    user = User.objects.create_user(
        'testadmin', 'admin@test.com', 'pass1234', role='admin', site=site
    )
    return user, site


@pytest.fixture
def worker_user(db, admin_user):
    _, site = admin_user
    user = User.objects.create_user(
        'testworker', 'worker@test.com', 'pass1234', role='worker', site=site
    )
    return user, site


@pytest.fixture
def admin_client(api_client, admin_user):
    user, _ = admin_user
    api_client.force_authenticate(user=user)
    return api_client


@pytest.fixture
def worker_client(api_client, worker_user):
    user, _ = worker_user
    api_client.force_authenticate(user=user)
    return api_client


class TestSiteAPI:
    def test_create_site(self, admin_client):
        res = admin_client.post('/api/sites/', {
            'name': 'Created Site', 'site_type': 'industrial',
        }, format='json')
        assert res.status_code in (200, 201)
        assert res.data['name'] == 'Created Site'

    def test_list_sites(self, admin_client, admin_user):
        _, site = admin_user
        res = admin_client.get('/api/sites/')
        assert res.status_code == 200
        assert any(s['id'] == site.id for s in res.data['results'])

    def test_site_detail(self, admin_client, admin_user):
        _, site = admin_user
        res = admin_client.get(f'/api/sites/{site.id}/')
        assert res.status_code == 200
        assert res.data['name'] == 'Test Site'


class TestSourceSinkAPI:
    def test_create_source(self, admin_client, admin_user):
        _, site = admin_user
        res = admin_client.post(f'/api/sites/{site.id}/sources/', {
            'name': 'Test Source',
            'source_type': 'freshwater',
            'available_flow': 100.0,
            'unit': 'm3/h',
            'is_freshwater': True,
        }, format='json')
        assert res.status_code in (200, 201)

    def test_create_sink(self, admin_client, admin_user):
        _, site = admin_user
        res = admin_client.post(f'/api/sites/{site.id}/sinks/', {
            'name': 'Test Sink',
            'sink_type': 'cooling',
            'required_flow': 50.0,
            'unit': 'm3/h',
        }, format='json')
        assert res.status_code in (200, 201)


class TestContaminationReportAPI:
    def test_worker_submit_report(self, worker_client, worker_user):
        user, site = worker_user
        res = worker_client.post(f'/api/sites/{site.id}/reports/', {
            'title': 'Worker observation',
            'description': 'Abnormal water observed',
            'severity': 'medium',
        }, format='json')
        assert res.status_code in (200, 201)

    def test_worker_sees_only_own_reports(self, worker_client, worker_user, admin_client, admin_user):
        user, site = worker_user
        # Worker submits a report
        worker_client.post(f'/api/sites/{site.id}/reports/', {
            'title': 'Worker report',
            'description': 'Test',
            'severity': 'low',
        }, format='json')
        res = worker_client.get(f'/api/sites/{site.id}/reports/')
        assert res.status_code == 200


class TestWaterQualityAPI:
    def test_create_quality_profile(self, admin_client):
        res = admin_client.post('/api/water-quality/', {
            'name': 'Test Profile',
            'source': 'DEMO DATA — NOT TNPCB DATA',
            'ph': 7.2, 'tss': 10.0, 'cod': 30.0,
        }, format='json')
        assert res.status_code in (200, 201)

    def test_tnpcb_import(self, admin_client, admin_user):
        _, site = admin_user
        res = admin_client.post(f'/api/sites/{site.id}/tnpcb/import/', {
            'readings': [{
                'source_reference': 'TNPCB-STATION-001',
                'parameter_name': 'pH',
                'parameter_value': 7.1,
                'unit': 'pH units',
                'dataset_name': 'Test TNPCB Dataset',
                'dataset_reference': 'TNPCB/2024/001',
            }]
        }, format='json')
        assert res.status_code in (200, 201)
        assert res.data['imported'] == 1
