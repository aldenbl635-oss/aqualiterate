from django.contrib import admin
from .models import Site, Zone


@admin.register(Site)
class SiteAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'site_type', 'created_at')
    list_filter = ('site_type',)
    search_fields = ('name',)


@admin.register(Zone)
class ZoneAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'site', 'zone_type', 'created_at')
    list_filter = ('site', 'zone_type')
    search_fields = ('name', 'site__name')
