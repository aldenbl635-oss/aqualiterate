from django.db import models


class AIRecommendation(models.Model):
    PRIORITY_CHOICES = [
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
        ('urgent', 'Urgent'),
    ]
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('flagged', 'Flagged'),
        ('acknowledged', 'Acknowledged'),
        ('implemented', 'Implemented'),
        ('dismissed', 'Dismissed'),
    ]

    site = models.ForeignKey('sites.Site', on_delete=models.CASCADE, related_name='ai_recommendations')
    report = models.ForeignKey(
        'reports.ContaminationReport',
        on_delete=models.SET_NULL, null=True, blank=True,
        related_name='ai_recommendations'
    )
    recommendation = models.TextField()
    reasoning_summary = models.TextField(blank=True, default='')
    recommended_action = models.TextField(blank=True, default='')
    priority = models.CharField(max_length=20, choices=PRIORITY_CHOICES, default='medium')
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default='pending')
    generated_by = models.CharField(max_length=100, default='rule-based',
                                    help_text="'rule-based' or 'llm'")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'ai_recommendations'
        ordering = ['-created_at']

    def __str__(self):
        return f"AIRec [{self.priority}] {self.recommendation[:60]}"
