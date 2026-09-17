from django.contrib import admin
from .models import AIRecommendation


@admin.register(AIRecommendation)
class AIRecommendationAdmin(admin.ModelAdmin):
    list_display = ('id', 'site', 'priority', 'status', 'generated_by', 'created_at')
    list_filter = ('site', 'priority', 'status', 'generated_by')
    search_fields = ('recommendation', 'recommended_action')
    readonly_fields = ('recommendation', 'reasoning_summary', 'recommended_action',
                       'generated_by', 'created_at')
    list_editable = ('status',)
