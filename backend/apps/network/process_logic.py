from django.db import transaction
from apps.sites.models import Zone
from apps.network.models import WaterSource, WaterSink
from apps.water_quality.models import WaterQualityRequirement, WaterQualityProfile

PROCESS_TEMPLATES = {
    'Cooling': {
        'demand': 400.0,
        'quality_req': {'ph_min': 6.5, 'ph_max': 8.5, 'tss_max': 50, 'tds_max': 1000},
        'recovery_potential': 0.8, # 80% recovered
        'return_quality': {'ph': 7.5, 'tss': 60, 'tds': 1200, 'temperature': 35, 'bod': 20, 'cod': 80}
    },
    'Boiler': {
        'demand': 150.0,
        'quality_req': {'ph_min': 8.5, 'ph_max': 10.5, 'tss_max': 5, 'tds_max': 50, 'hardness_max': 2},
        'recovery_potential': 0.5, 
        'return_quality': {'ph': 9.5, 'tss': 10, 'tds': 80, 'temperature': 80, 'bod': 10, 'cod': 30}
    },
    'Washing': {
        'demand': 250.0,
        'quality_req': {'ph_min': 6.0, 'ph_max': 9.0, 'tss_max': 100, 'tds_max': 1500},
        'recovery_potential': 0.9,
        'return_quality': {'ph': 7.0, 'tss': 300, 'tds': 2000, 'temperature': 25, 'bod': 150, 'cod': 400}
    },
    'Treatment': {
        'demand': 0.0, 
        'quality_req': None, # Depends on what comes in, for now simple
        'recovery_potential': 0.0,
        'return_quality': None,
    },
    'Storage': {
        'demand': 0.0,
        'quality_req': None,
        'recovery_potential': 0.0,
        'return_quality': None,
    }
}

@transaction.atomic
def apply_process_to_zone(zone_id, process_type):
    zone = Zone.objects.get(id=zone_id)
    site = zone.site

    # Update zone process
    zone.process_type = process_type
    zone.save()

    opts = PROCESS_TEMPLATES.get(process_type)
    if not opts:
        return # Do nothing if unknown

    # 1. Handle Demand / Sink
    if opts['demand'] > 0:
        sink, created = WaterSink.objects.get_or_create(
            site=site, zone=zone, name=f"{zone.name} Demand",
            defaults={'sink_type': 'Process', 'required_flow': opts['demand']}
        )
        if not created:
            sink.required_flow = opts['demand']

        # requirements
        if opts['quality_req']:
            reqs = opts['quality_req']
            qr, _ = WaterQualityRequirement.objects.get_or_create(name=f"{zone.name} QReq")
            qr.ph_min = reqs.get('ph_min')
            qr.ph_max = reqs.get('ph_max')
            qr.tss_max = reqs.get('tss_max')
            qr.tds_max = reqs.get('tds_max')
            qr.save()
            sink.quality_requirement = qr
            
        sink.save()
    else:
        # If changed to a process with 0 demand, clean up old sink
        WaterSink.objects.filter(site=site, zone=zone).delete()

    # 2. Handle Recovery / Source
    if opts['recovery_potential'] > 0:
        base_sink = WaterSink.objects.filter(site=site, zone=zone).first()
        available_flow = opts['demand'] * opts['recovery_potential']

        src, created = WaterSource.objects.get_or_create(
            site=site, zone=zone, name=f"{zone.name} Return",
            defaults={'source_type': 'Recovered', 'available_flow': available_flow, 'is_freshwater': False}
        )
        if not created:
            src.available_flow = available_flow
            
        if opts['return_quality']:
            rq = opts['return_quality']
            qp, _ = WaterQualityProfile.objects.get_or_create(name=f"{zone.name} ReturnQuality")
            qp.ph = rq.get('ph')
            qp.tss = rq.get('tss')
            qp.tds = rq.get('tds')
            qp.temperature = rq.get('temperature')
            qp.bod = rq.get('bod')
            qp.cod = rq.get('cod')
            qp.save()
            src.quality_profile = qp

        src.save()

        # Link for physical continuity
        if base_sink:
            base_sink.recovery_source = src
            base_sink.save()
    else:
        WaterSource.objects.filter(site=site, zone=zone, is_freshwater=False).delete()
