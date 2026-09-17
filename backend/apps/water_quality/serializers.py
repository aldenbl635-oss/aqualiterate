from rest_framework import serializers
from .models import WaterQualityProfile, WaterQualityRequirement, TNPCBReading


class WaterQualityProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = WaterQualityProfile
        fields = '__all__'


class WaterQualityRequirementSerializer(serializers.ModelSerializer):
    class Meta:
        model = WaterQualityRequirement
        fields = '__all__'


class TNPCBReadingSerializer(serializers.ModelSerializer):
    class Meta:
        model = TNPCBReading
        fields = '__all__'
        read_only_fields = ['id', 'created_at']


class TNPCBImportRowSerializer(serializers.Serializer):
    """Validates a single row in a TNPCB import payload."""
    source_reference = serializers.CharField(max_length=512)
    latitude = serializers.FloatField(required=False, allow_null=True)
    longitude = serializers.FloatField(required=False, allow_null=True)
    sample_time = serializers.DateTimeField(required=False, allow_null=True)
    parameter_name = serializers.CharField(max_length=255)
    parameter_value = serializers.FloatField()
    unit = serializers.CharField(max_length=50, default='')
    dataset_name = serializers.CharField(max_length=255)
    dataset_reference = serializers.CharField(max_length=512, default='')
