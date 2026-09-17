from django.db import models


class WaterQualityProfile(models.Model):
    """Represents a water quality measurement profile for a source."""
    name = models.CharField(max_length=255)
    source = models.CharField(max_length=255, help_text="Source dataset or measurement reference")
    measurement_time = models.DateTimeField(null=True, blank=True)
    ph = models.FloatField(null=True, blank=True)
    tss = models.FloatField(null=True, blank=True, help_text="Total Suspended Solids (mg/L)")
    cod = models.FloatField(null=True, blank=True, help_text="Chemical Oxygen Demand (mg/L)")
    bod = models.FloatField(null=True, blank=True, help_text="Biological Oxygen Demand (mg/L)")
    tds = models.FloatField(null=True, blank=True, help_text="Total Dissolved Solids (mg/L)")
    temperature = models.FloatField(null=True, blank=True, help_text="Temperature (°C)")
    conductivity = models.FloatField(null=True, blank=True, help_text="Conductivity (µS/cm)")
    other_parameters = models.JSONField(default=dict, blank=True,
                                        help_text="Additional site-specific parameters as key-value pairs")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'water_quality_profiles'

    def __str__(self):
        return f"{self.name} [{self.source}]"


class WaterQualityRequirement(models.Model):
    """Acceptable water quality thresholds for a water sink."""
    name = models.CharField(max_length=255)
    ph_min = models.FloatField(null=True, blank=True)
    ph_max = models.FloatField(null=True, blank=True)
    tss_max = models.FloatField(null=True, blank=True)
    cod_max = models.FloatField(null=True, blank=True)
    bod_max = models.FloatField(null=True, blank=True)
    tds_max = models.FloatField(null=True, blank=True)
    temperature_min = models.FloatField(null=True, blank=True)
    temperature_max = models.FloatField(null=True, blank=True)
    other_limits = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'water_quality_requirements'

    def __str__(self):
        return self.name


class TNPCBReading(models.Model):
    """
    Raw TNPCB water-quality readings.
    Values must NOT be altered after import.
    """
    site = models.ForeignKey('sites.Site', on_delete=models.CASCADE, related_name='tnpcb_readings')
    source_reference = models.CharField(max_length=512, help_text="Original TNPCB station/source identifier")
    location = models.JSONField(null=True, blank=True)
    sample_time = models.DateTimeField(null=True, blank=True)
    parameter_name = models.CharField(max_length=255)
    parameter_value = models.FloatField()
    unit = models.CharField(max_length=50, blank=True, default='')
    dataset_name = models.CharField(max_length=255)
    dataset_reference = models.CharField(max_length=512, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'tnpcb_readings'

    def __str__(self):
        return f"TNPCB {self.parameter_name}={self.parameter_value} [{self.dataset_name}]"
