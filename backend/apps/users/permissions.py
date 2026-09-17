from rest_framework.permissions import BasePermission, SAFE_METHODS


class IsAdminOrReadOnly(BasePermission):
    """Allow full access to admins; read-only for workers."""
    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        return request.user and request.user.is_authenticated and request.user.role == 'admin'


class IsAdminUser(BasePermission):
    """Allow access only to admin-role users."""
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.role == 'admin'


class IsWorkerUser(BasePermission):
    """Allow access only to worker-role users."""
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.role == 'worker'


class IsAdminOrWorker(BasePermission):
    """Allow access to both admin and worker users."""
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated
