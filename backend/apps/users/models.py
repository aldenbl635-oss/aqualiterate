from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    ROLE_CHOICES = [
        ('admin', 'Admin'),
        ('worker', 'Worker'),
    ]
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='worker')
    site = models.ForeignKey(
        'sites.Site', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='users'
    )

    class Meta:
        db_table = 'users'

    def is_admin(self):
        return self.role == 'admin'

    def is_worker(self):
        return self.role == 'worker'
