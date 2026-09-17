from django.db import models


class OptimizationRun(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('running', 'Running'),
        ('optimal', 'Optimal'),
        ('infeasible', 'Infeasible'),
        ('error', 'Error'),
    ]
    site = models.ForeignKey('sites.Site', on_delete=models.CASCADE, related_name='optimization_runs')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    objective_value = models.FloatField(null=True, blank=True)
    freshwater_consumption = models.FloatField(null=True, blank=True)
    reuse_flow = models.FloatField(null=True, blank=True)
    treatment_flow = models.FloatField(null=True, blank=True)
    estimated_operating_cost = models.FloatField(null=True, blank=True)
    unmet_demand_json = models.JSONField(default=dict, blank=True)
    solver_name = models.CharField(max_length=100, default='PuLP/CBC')
    solver_status = models.CharField(max_length=100, blank=True, default='')
    parameters = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'optimization_runs'
        ordering = ['-created_at']

    def __str__(self):
        return f"OptRun {self.id} [{self.site.name}] – {self.status}"


class OptimizationRoute(models.Model):
    optimization_run = models.ForeignKey(
        OptimizationRun, on_delete=models.CASCADE, related_name='routes'
    )
    source = models.ForeignKey('network.WaterSource', on_delete=models.CASCADE)
    sink = models.ForeignKey('network.WaterSink', on_delete=models.CASCADE)
    treatment_option = models.ForeignKey(
        'network.TreatmentOption', on_delete=models.SET_NULL, null=True, blank=True
    )
    allocated_flow = models.FloatField()
    quality_status = models.CharField(max_length=50, default='compatible')
    treatment_required = models.BooleanField(default=False)
    routing_cost = models.FloatField(default=0.0)
    treatment_cost = models.FloatField(default=0.0)
    total_cost = models.FloatField(default=0.0)
    geometry = models.JSONField(null=True, blank=True)

    class Meta:
        db_table = 'optimization_routes'

    def __str__(self):
        return f"Route {self.source.name} → {self.sink.name} [{self.allocated_flow}]"
