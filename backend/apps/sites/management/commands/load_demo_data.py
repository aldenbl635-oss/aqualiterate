"""
load_demo_data management command.
Creates clearly labelled DEMO DATA for development and demonstration purposes.

IMPORTANT: All values are synthetic. They are NOT TNPCB measurements.
           All records are tagged with source = 'DEMO DATA — NOT TNPCB DATA'.
"""
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.utils import timezone

User = get_user_model()


class Command(BaseCommand):
    help = 'Load synthetic DEMO DATA for AquaIterate (NOT TNPCB data)'

    def handle(self, *args, **options):
        from apps.sites.models import Site, Zone
        from apps.water_quality.models import WaterQualityProfile, WaterQualityRequirement
        from apps.network.models import WaterSource, WaterSink, TreatmentOption, NetworkConnection

        self.stdout.write('Loading DEMO DATA (synthetic — NOT TNPCB data)...')

        # --- Site ---
        site, _ = Site.objects.get_or_create(
            name='AquaIterate Demo Industrial Site',
            defaults={
                'description': 'Synthetic demo site for AquaIterate development. NOT a real site.',
                'site_type': 'industrial',
                'location': {'type': 'Point', 'coordinates': [80.2785, 13.0827]},  # Chennai area (demo coords)
            }
        )

        # --- Zones ---
        zone_defs = [
            ('Production Zone', 'production', {'type': 'Point', 'coordinates': [80.2780, 13.0832]}),
            ('Utility Zone', 'utility', {'type': 'Point', 'coordinates': [80.2790, 13.0820]}),
            ('Treatment Zone', 'treatment', {'type': 'Point', 'coordinates': [80.2795, 13.0835]}),
            ('Storage Zone', 'storage', {'type': 'Point', 'coordinates': [80.2775, 13.0815]}),
        ]
        zones = {}
        for zname, ztype, zloc in zone_defs:
            zone, _ = Zone.objects.get_or_create(
                site=site, name=zname,
                defaults={'zone_type': ztype, 'description': f'DEMO {zname}'}
            )
            zones[zname] = zone

        # --- Water Quality Profiles (DEMO — synthetic values) ---
        # Source: freshwater intake (good quality)
        qp_fresh, _ = WaterQualityProfile.objects.get_or_create(
            name='Demo Freshwater Profile',
            defaults={
                'source': 'DEMO DATA — NOT TNPCB DATA',
                'measurement_time': timezone.now(),
                'ph': 7.2,
                'tss': 5.0,
                'cod': 8.0,
                'bod': 3.0,
                'tds': 180.0,
                'temperature': 28.0,
                'conductivity': 300.0,
                'other_parameters': {'turbidity_NTU': 1.5, 'data_note': 'DEMO DATA — NOT TNPCB DATA'},
            }
        )

        # Source: process reuse (moderate quality)
        qp_reuse_a, _ = WaterQualityProfile.objects.get_or_create(
            name='Demo Process Reuse A Profile',
            defaults={
                'source': 'DEMO DATA — NOT TNPCB DATA',
                'measurement_time': timezone.now(),
                'ph': 6.8,
                'tss': 40.0,
                'cod': 120.0,
                'bod': 45.0,
                'tds': 650.0,
                'temperature': 32.0,
                'conductivity': 980.0,
                'other_parameters': {'data_note': 'DEMO DATA — NOT TNPCB DATA'},
            }
        )

        # Source: process reuse B (higher load)
        qp_reuse_b, _ = WaterQualityProfile.objects.get_or_create(
            name='Demo Process Reuse B Profile',
            defaults={
                'source': 'DEMO DATA — NOT TNPCB DATA',
                'measurement_time': timezone.now(),
                'ph': 6.2,
                'tss': 90.0,
                'cod': 280.0,
                'bod': 110.0,
                'tds': 1200.0,
                'temperature': 35.0,
                'conductivity': 1600.0,
                'other_parameters': {'data_note': 'DEMO DATA — NOT TNPCB DATA'},
            }
        )

        # Treated wastewater output profile
        qp_treated, _ = WaterQualityProfile.objects.get_or_create(
            name='Demo Treated Wastewater Profile',
            defaults={
                'source': 'DEMO DATA — NOT TNPCB DATA',
                'measurement_time': timezone.now(),
                'ph': 7.0,
                'tss': 15.0,
                'cod': 50.0,
                'bod': 20.0,
                'tds': 400.0,
                'temperature': 29.0,
                'conductivity': 600.0,
                'other_parameters': {'data_note': 'DEMO DATA — NOT TNPCB DATA'},
            }
        )

        # --- Water Quality Requirements ---
        req_cooling, _ = WaterQualityRequirement.objects.get_or_create(
            name='Cooling Operation Requirements',
            defaults={
                'ph_min': 6.5, 'ph_max': 8.5,
                'tss_max': 50.0,
                'cod_max': 150.0,
                'bod_max': 60.0,
                'tds_max': 1000.0,
                'temperature_max': 40.0,
            }
        )

        req_process, _ = WaterQualityRequirement.objects.get_or_create(
            name='Process Operation Requirements',
            defaults={
                'ph_min': 6.8, 'ph_max': 7.5,
                'tss_max': 20.0,
                'cod_max': 80.0,
                'bod_max': 30.0,
                'tds_max': 500.0,
            }
        )

        req_utility, _ = WaterQualityRequirement.objects.get_or_create(
            name='Utility Operation Requirements',
            defaults={
                'ph_min': 6.0, 'ph_max': 9.0,
                'tss_max': 100.0,
                'tds_max': 2000.0,
            }
        )

        req_cleaning, _ = WaterQualityRequirement.objects.get_or_create(
            name='Cleaning Operation Requirements',
            defaults={
                'ph_min': 6.5, 'ph_max': 8.5,
                'tss_max': 30.0,
                'cod_max': 100.0,
            }
        )

        # --- Water Sources ---
        src_fresh, _ = WaterSource.objects.get_or_create(
            site=site, name='Freshwater Intake',
            defaults={
                'zone': zones['Storage Zone'],
                'source_type': 'freshwater_intake',
                'description': 'DEMO: Municipal freshwater supply connection',
                'available_flow': 50.0,
                'unit': 'm3/h',
                'quality_profile': qp_fresh,
                'is_freshwater': True,
                'location': {'type': 'Point', 'coordinates': [80.2775, 13.0817]},
            }
        )

        src_reuse_a, _ = WaterSource.objects.get_or_create(
            site=site, name='Process Reuse Stream A',
            defaults={
                'zone': zones['Production Zone'],
                'source_type': 'process_reuse',
                'description': 'DEMO: Cooling circuit blowdown recirculation stream',
                'available_flow': 30.0,
                'unit': 'm3/h',
                'quality_profile': qp_reuse_a,
                'is_freshwater': False,
                'location': {'type': 'Point', 'coordinates': [80.2781, 13.0833]},
            }
        )

        src_reuse_b, _ = WaterSource.objects.get_or_create(
            site=site, name='Process Reuse Stream B',
            defaults={
                'zone': zones['Production Zone'],
                'source_type': 'process_reuse',
                'description': 'DEMO: High-load process effluent stream',
                'available_flow': 20.0,
                'unit': 'm3/h',
                'quality_profile': qp_reuse_b,
                'is_freshwater': False,
                'location': {'type': 'Point', 'coordinates': [80.2783, 13.0831]},
            }

        )

        src_treated, _ = WaterSource.objects.get_or_create(
            site=site, name='Treated Wastewater',
            defaults={
                'zone': zones['Treatment Zone'],
                'source_type': 'treated_effluent',
                'description': 'DEMO: Effluent treatment plant output',
                'available_flow': 25.0,
                'unit': 'm3/h',
                'quality_profile': qp_treated,
                'is_freshwater': False,
                'location': {'type': 'Point', 'coordinates': [80.2796, 13.0836]},
            }
        )

        # --- Water Sinks ---
        sink_cooling, _ = WaterSink.objects.get_or_create(
            site=site, name='Cooling Operation',
            defaults={
                'zone': zones['Utility Zone'],
                'sink_type': 'cooling',
                'description': 'DEMO: Cooling tower make-up water demand',
                'required_flow': 35.0,
                'unit': 'm3/h',
                'quality_requirement': req_cooling,
                'location': {'type': 'Point', 'coordinates': [80.2791, 13.0821]},
            }
        )

        sink_process, _ = WaterSink.objects.get_or_create(
            site=site, name='Process Operation',
            defaults={
                'zone': zones['Production Zone'],
                'sink_type': 'process',
                'description': 'DEMO: Manufacturing process water demand',
                'required_flow': 20.0,
                'unit': 'm3/h',
                'quality_requirement': req_process,
                'location': {'type': 'Point', 'coordinates': [80.2782, 13.0829]},
            }
        )

        sink_utility, _ = WaterSink.objects.get_or_create(
            site=site, name='Utility Operation',
            defaults={
                'zone': zones['Utility Zone'],
                'sink_type': 'utility',
                'description': 'DEMO: General utility water demand',
                'required_flow': 15.0,
                'unit': 'm3/h',
                'quality_requirement': req_utility,
                'location': {'type': 'Point', 'coordinates': [80.2788, 13.0822]},
            }
        )

        sink_cleaning, _ = WaterSink.objects.get_or_create(
            site=site, name='Cleaning Operation',
            defaults={
                'zone': zones['Production Zone'],
                'sink_type': 'cleaning',
                'description': 'DEMO: Equipment cleaning water demand',
                'required_flow': 10.0,
                'unit': 'm3/h',
                'quality_requirement': req_cleaning,
                'location': {'type': 'Point', 'coordinates': [80.2779, 13.0830]},
            }
        )

        # --- Treatment Option ---
        tx_etp, _ = TreatmentOption.objects.get_or_create(
            site=site, name='Demo Effluent Treatment Plant',
            defaults={
                'description': 'DEMO: Biological + filtration treatment. Costs are DEMO ASSUMPTIONS.',
                'treatment_type': 'biological_filtration',
                'output_quality_profile': qp_treated,
                'max_flow': 40.0,
                'cost_per_unit': 0.5,  # DEMO ASSUMPTION — not a real cost
                'fixed_cost': 10.0,    # DEMO ASSUMPTION
            }
        )

        # --- Network Connections ---
        connections = [
            (src_fresh, sink_cooling, None, 0.1),
            (src_fresh, sink_process, None, 0.1),
            (src_fresh, sink_utility, None, 0.1),
            (src_fresh, sink_cleaning, None, 0.1),
            (src_reuse_a, sink_cooling, None, 0.05),
            (src_reuse_a, sink_utility, None, 0.05),
            (src_reuse_b, sink_cooling, tx_etp, 0.08),
            (src_reuse_b, sink_utility, tx_etp, 0.08),
            (src_treated, sink_cooling, None, 0.06),
            (src_treated, sink_utility, None, 0.06),
            (src_treated, sink_cleaning, None, 0.06),
        ]

        for src, sink, tx, cost in connections:
            NetworkConnection.objects.get_or_create(
                site=site, source=src, sink=sink, treatment_option=tx,
                defaults={
                    'routing_cost': cost,  # DEMO ASSUMPTION
                    'is_active': True,
                    'geometry': {
                        'type': 'LineString',
                        'coordinates': [
                            src.location['coordinates'],
                            sink.location['coordinates']
                        ]
                    } if src.location and sink.location else None,
                }
            )

        # --- Demo Users ---
        if not User.objects.filter(username='admin').exists():
            User.objects.create_superuser('admin', 'admin@aquaiterate.demo', 'admin123', role='admin', site=site)
            self.stdout.write('  Created admin user (username: admin, password: admin123)')

        if not User.objects.filter(username='worker1').exists():
            u = User.objects.create_user('worker1', 'worker1@aquaiterate.demo', 'worker123', role='worker', site=site)
            self.stdout.write('  Created worker user (username: worker1, password: worker123)')

        self.stdout.write(self.style.SUCCESS(
            'DEMO DATA loaded successfully. '
            'These are synthetic values — NOT TNPCB measurements.'
        ))
        self.stdout.write(f'  Site ID: {site.id}')
