from django.db import models
from apps.sites.models import Site, Zone
from apps.network.models import WaterSource, WaterSink

class SimulationState(models.Model):
    site = models.OneToOneField(Site, on_delete=models.CASCADE, related_name='simulation_state')
    
    STATUS_CHOICES = [
        ('PAUSED', 'Paused'),
        ('RUNNING', 'Running'),
    ]
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PAUSED')
    
    current_timestamp = models.DateTimeField(null=True, blank=True)
    
    # 1x, 2x, 5x, 10x
    speed_multiplier = models.IntegerField(default=1)
    
    # Seconds between simulation ticks (data points) - e.g. 5 real seconds = X sim minutes
    step_interval_seconds = models.IntegerField(default=300) # 5 minutes by default in simulation time

    # e.g., 'NORMAL', 'QUALITY_DEGRADATION', 'HIGH_DEMAND'
    current_scenario = models.CharField(max_length=50, default='NORMAL')
    
    def __str__(self):
        return f"Simulation for {self.site.name} ({self.status})"

class MonitoringReading(models.Model):
    site = models.ForeignKey(Site, on_delete=models.CASCADE, related_name='readings')
    zone = models.ForeignKey(Zone, on_delete=models.SET_NULL, null=True, blank=True)
    
    # Readings can be tied to a source (availability) or a sink (demand)
    source = models.ForeignKey(WaterSource, on_delete=models.CASCADE, null=True, blank=True)
    sink = models.ForeignKey(WaterSink, on_delete=models.CASCADE, null=True, blank=True)
    
    timestamp = models.DateTimeField()
    
    flow_rate = models.FloatField(null=True, blank=True) 
    ph = models.FloatField(null=True, blank=True)
    tds = models.FloatField(null=True, blank=True)
    turbidity = models.FloatField(null=True, blank=True)
    tss = models.FloatField(null=True, blank=True)
    bod = models.FloatField(null=True, blank=True)
    cod = models.FloatField(null=True, blank=True)
    temperature = models.FloatField(null=True, blank=True)
    
    scenario = models.CharField(max_length=50, default='NORMAL')
    
    class Meta:
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['site', 'timestamp']),
            models.Index(fields=['source', 'timestamp']),
            models.Index(fields=['sink', 'timestamp']),
        ]

    def __str__(self):
        obj = self.source.name if self.source else (self.sink.name if self.sink else 'Zone')
        return f"{obj} at {self.timestamp}"
