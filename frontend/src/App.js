import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import LoginPage from './pages/LoginPage';
import AdminLayout from './components/AdminLayout';
import DashboardPage from './pages/DashboardPage';
import NetworkMapPage from './pages/NetworkMapPage';
import NetworkDesignerPage from './pages/NetworkDesignerPage';
import OptimizationPage from './pages/OptimizationPage';
import WaterQualityPage from './pages/WaterQualityPage';
import ReportsPage from './pages/ReportsPage';
import AIAdvisoryPage from './pages/AIAdvisoryPage';
import WorkerPortalPage from './pages/WorkerPortalPage';

function PrivateRoute({ children, role }) {
    const { user, loading } = useAuth();
    if (loading) return <div className="loading-state"><div className="spinner" /><span>Loading AquaIterate…</span></div>;
    if (!user) return <Navigate to="/login" />;
    if (role && user.role !== role) return <Navigate to="/" />;
    return children;
}

function App() {
    return (
        <AuthProvider>
            <BrowserRouter>
                <Routes>
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/worker" element={
                        <PrivateRoute>
                            <WorkerPortalPage />
                        </PrivateRoute>
                    } />
                    <Route path="/" element={
                        <PrivateRoute>
                            <AdminLayout />
                        </PrivateRoute>
                    }>
                        <Route index element={<Navigate to="/admin/dashboard" />} />
                        <Route path="admin/dashboard" element={<DashboardPage />} />
                        <Route path="admin/designer" element={<NetworkDesignerPage />} />
                        <Route path="admin/network" element={<NetworkMapPage />} />
                        <Route path="admin/optimization" element={<OptimizationPage />} />
                        <Route path="admin/water-quality" element={<WaterQualityPage />} />
                        <Route path="admin/reports" element={<ReportsPage />} />
                        <Route path="admin/ai-advisory" element={<AIAdvisoryPage />} />
                    </Route>
                    <Route path="*" element={<Navigate to="/" />} />
                </Routes>
            </BrowserRouter>
        </AuthProvider>
    );
}

export default App;
