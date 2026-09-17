from rest_framework import serializers
from apps.simulation.models import SimulationState, MonitoringReading

class SimulationStateSerializer(serializers.ModelSerializer):
    class Meta:
        model = SimulationState
        fields = ['status', 'current_timestamp', 'speed_multiplier', 'step_interval_seconds', 'current_scenario']

class MonitoringReadingSerializer(serializers.ModelSerializer):
    source_name = serializers.CharField(source='source.name', read_only=True)
    sink_name = serializers.CharField(source='sink.name', read_only=True)
    
    class Meta:
        model = MonitoringReading
        fields = ['id', 'timestamp', 'source_name', 'sink_name', 'flow_rate', 'ph', 'tds', 'turbidity', 'bod', 'cod', 'scenario']
