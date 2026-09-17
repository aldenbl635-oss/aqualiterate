from rest_framework import serializers
from .models import AIRecommendation


class AIRecommendationSerializer(serializers.ModelSerializer):
    report_title = serializers.CharField(source='report.title', read_only=True)

    class Meta:
        model = AIRecommendation
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'recommendation', 'reasoning_summary',
                            'recommended_action', 'generated_by']
