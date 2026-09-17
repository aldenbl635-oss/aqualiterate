from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ('username', 'email', 'role', 'site', 'is_staff')
    list_filter = ('role', 'is_staff', 'is_active')
    fieldsets = BaseUserAdmin.fieldsets + (
        ('AquaIterate', {'fields': ('role', 'site')}),
    )
    add_fieldsets = BaseUserAdmin.add_fieldsets + (
        ('AquaIterate', {'fields': ('role', 'site')}),
    )
