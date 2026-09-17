from rest_framework import serializers
from .models import WaterSource, WaterSink, TreatmentOption, NetworkConnection


class WaterSourceSerializer(serializers.ModelSerializer):
    quality_profile_name = serializers.CharField(source='quality_profile.name', read_only=True)
    zone_name = serializers.CharField(source='zone.name', read_only=True)

    class Meta:
        model = WaterSource
        fields = '__all__'


class WaterSinkSerializer(serializers.ModelSerializer):
    quality_requirement_name = serializers.CharField(source='quality_requirement.name', read_only=True)
    zone_name = serializers.CharField(source='zone.name', read_only=True)

    class Meta:
        model = WaterSink
        fields = '__all__'


class TreatmentOptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = TreatmentOption
        fields = '__all__'


class NetworkConnectionSerializer(serializers.ModelSerializer):
    source_name = serializers.CharField(source='source.name', read_only=True)
    sink_name = serializers.CharField(source='sink.name', read_only=True)
    treatment_name = serializers.CharField(source='treatment_option.name', read_only=True)

    class Meta:
        model = NetworkConnection
        fields = '__all__'
