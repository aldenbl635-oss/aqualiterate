from rest_framework import serializers
from .models import ContaminationReport


class ContaminationReportSerializer(serializers.ModelSerializer):
    reported_by_username = serializers.CharField(source='reported_by.username', read_only=True)
    zone_name = serializers.CharField(source='zone.name', read_only=True)

    class Meta:
        model = ContaminationReport
        fields = '__all__'
        read_only_fields = ['id', 'reported_at', 'created_at', 'updated_at', 'reported_by', 'site']

    def create(self, validated_data):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            validated_data['reported_by'] = request.user
        return super().create(validated_data)
