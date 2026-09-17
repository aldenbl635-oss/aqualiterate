from django.db import models
from django.conf import settings


class ContaminationReport(models.Model):
    SEVERITY_CHOICES = [
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
        ('critical', 'Critical'),
    ]
    STATUS_CHOICES = [
        ('open', 'Open'),
        ('under_review', 'Under Review'),
        ('action_required', 'Action Required'),
        ('resolved', 'Resolved'),
        ('closed', 'Closed'),
    ]
    site = models.ForeignKey('sites.Site', on_delete=models.CASCADE, related_name='contamination_reports')
    zone = models.ForeignKey('sites.Zone', on_delete=models.SET_NULL, null=True, blank=True, related_name='contamination_reports')
    reported_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    title = models.CharField(max_length=500)
    description = models.TextField()
    severity = models.CharField(max_length=20, choices=SEVERITY_CHOICES, default='medium')
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default='open')
    location = models.JSONField(null=True, blank=True)
    reported_at = models.DateTimeField(auto_now_add=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    resolution_notes = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'contamination_reports'
        ordering = ['-reported_at']

    def __str__(self):
        return f"[{self.severity.upper()}] {self.title}"
