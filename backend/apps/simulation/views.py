from rest_framework import permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from apps.sites.models import Site
from apps.simulation.models import SimulationState, MonitoringReading
from apps.simulation.engine import SimulationEngine
from apps.simulation.serializers import SimulationStateSerializer, MonitoringReadingSerializer


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def get_simulation_state(request, site_pk):
    try:
        site = Site.objects.get(pk=site_pk)
    except Site.DoesNotExist:
        return Response({'error': 'Site not found'}, status=404)

    state, _ = SimulationState.objects.get_or_create(site=site)

    # If running, advance one tick on each poll — frontend polling drives the clock
    if state.status == 'RUNNING':
        engine = SimulationEngine(site.id)
        engine.generate_next_tick()
        state.refresh_from_db()

    if state.current_timestamp:
        readings = MonitoringReading.objects.filter(site=site, timestamp=state.current_timestamp)
    else:
        readings = []

    serializer = SimulationStateSerializer(state)
    reading_serializer = MonitoringReadingSerializer(readings, many=True)

    return Response({
        'mode': 'SIMULATED_REAL_TIME',
        'simulation': serializer.data,
        'readings': reading_serializer.data,
    })


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def control_simulation(request, site_pk):
    try:
        site = Site.objects.get(pk=site_pk)
    except Site.DoesNotExist:
        return Response({'error': 'Site not found'}, status=404)

    state, _ = SimulationState.objects.get_or_create(site=site)
    action = request.data.get('action')

    if action == 'start':
        state.status = 'RUNNING'
        state.save()
    elif action == 'pause':
        state.status = 'PAUSED'
        state.save()
    elif action == 'next':
        engine = SimulationEngine(site.id)
        engine.generate_next_tick()
    elif action == 'scenario':
        scenario = request.data.get('scenario', 'NORMAL')
        state.current_scenario = scenario
        state.save()

    return Response({'status': 'ok'})
