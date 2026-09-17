from django.contrib import admin
from .models import ContaminationReport


@admin.register(ContaminationReport)
class ContaminationReportAdmin(admin.ModelAdmin):
    list_display = ('id', 'title', 'site', 'zone', 'severity', 'status', 'reported_by', 'reported_at')
    list_filter = ('site', 'zone', 'severity', 'status')
    search_fields = ('title', 'description')
    readonly_fields = ('reported_at', 'created_at', 'updated_at')
    list_editable = ('status',)
