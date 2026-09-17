from rest_framework import serializers
from .models import OptimizationRun, OptimizationRoute


class OptimizationRouteSerializer(serializers.ModelSerializer):
    source_name = serializers.CharField(source='source.name', read_only=True)
    sink_name = serializers.CharField(source='sink.name', read_only=True)
    treatment_name = serializers.CharField(source='treatment_option.name', read_only=True)

    class Meta:
        model = OptimizationRoute
        fields = '__all__'


class OptimizationRunSerializer(serializers.ModelSerializer):
    routes = OptimizationRouteSerializer(many=True, read_only=True)

    class Meta:
        model = OptimizationRun
        fields = '__all__'


class OptimizationRunListSerializer(serializers.ModelSerializer):
    class Meta:
        model = OptimizationRun
        exclude = []
