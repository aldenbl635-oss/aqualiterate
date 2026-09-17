from django.contrib import admin
from .models import OptimizationRun, OptimizationRoute


class OptimizationRouteInline(admin.TabularInline):
    model = OptimizationRoute
    extra = 0
    readonly_fields = ('source', 'sink', 'treatment_option', 'allocated_flow',
                       'quality_status', 'treatment_required', 'routing_cost', 'total_cost')
    can_delete = False


@admin.register(OptimizationRun)
class OptimizationRunAdmin(admin.ModelAdmin):
    list_display = ('id', 'site', 'status', 'freshwater_consumption', 'reuse_flow',
                    'estimated_operating_cost', 'created_at')
    list_filter = ('site', 'status')
    readonly_fields = ('created_at', 'completed_at', 'solver_status')
    inlines = [OptimizationRouteInline]

    def has_add_permission(self, request):
        return False  # runs are created via the API only
