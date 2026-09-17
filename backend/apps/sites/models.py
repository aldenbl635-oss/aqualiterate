from django.db import models


class Site(models.Model):
    SITE_TYPES = [
        ('industrial', 'Industrial Process Plant'),
        ('commercial', 'Commercial Complex'),
        ('municipal', 'Municipal Treatment'),
    ]
    name = models.CharField(max_length=200)
    site_type = models.CharField(max_length=50, choices=SITE_TYPES)
    description = models.TextField(blank=True, null=True)
    location = models.JSONField(null=True, blank=True)
    layout_image = models.ImageField(upload_to='site_layouts/', null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name


class Zone(models.Model):
    site = models.ForeignKey(Site, on_delete=models.CASCADE, related_name='zones')
    name = models.CharField(max_length=200)
    zone_type = models.CharField(max_length=50, blank=True)
    process_type = models.CharField(max_length=100, blank=True)
    description = models.TextField(blank=True, null=True)
    location = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('site', 'name')

    def __str__(self):
        return f"{self.site.name} - {self.name}"
