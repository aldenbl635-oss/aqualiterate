from django.contrib import admin
from .models import WaterQualityProfile, WaterQualityRequirement, TNPCBReading


@admin.register(WaterQualityProfile)
class WaterQualityProfileAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'source', 'ph', 'tss', 'cod', 'measurement_time')
    list_filter = ('source',)
    search_fields = ('name', 'source')


@admin.register(WaterQualityRequirement)
class WaterQualityRequirementAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'ph_min', 'ph_max', 'tss_max', 'cod_max')
    search_fields = ('name',)


@admin.register(TNPCBReading)
class TNPCBReadingAdmin(admin.ModelAdmin):
    list_display = ('id', 'site', 'source_reference', 'parameter_name', 'parameter_value', 'unit', 'dataset_name', 'sample_time')
    list_filter = ('site', 'parameter_name', 'dataset_name')
    search_fields = ('source_reference', 'parameter_name', 'dataset_name')
    readonly_fields = ('parameter_value', 'source_reference', 'dataset_name', 'dataset_reference', 'sample_time', 'created_at')

    def has_change_permission(self, request, obj=None):
        """TNPCB data must not be modified after import."""
        return False
