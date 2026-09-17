from django.contrib import admin
from .models import WaterSource, WaterSink, TreatmentOption, NetworkConnection


@admin.register(WaterSource)
class WaterSourceAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'site', 'source_type', 'available_flow', 'is_freshwater')
    list_filter = ('site', 'is_freshwater', 'source_type')
    search_fields = ('name', 'site__name')


@admin.register(WaterSink)
class WaterSinkAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'site', 'sink_type', 'required_flow')
    list_filter = ('site', 'sink_type')
    search_fields = ('name', 'site__name')


@admin.register(TreatmentOption)
class TreatmentOptionAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'site', 'treatment_type', 'max_flow', 'cost_per_unit')
    list_filter = ('site', 'treatment_type')


@admin.register(NetworkConnection)
class NetworkConnectionAdmin(admin.ModelAdmin):
    list_display = ('id', 'site', 'source', 'sink', 'routing_cost', 'is_active')
    list_filter = ('site', 'is_active')
