import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useSite } from '../hooks/useSite';

const NAV_SECTIONS = [
    {
        label: 'Admin',
        links: [
            { to: '/admin/dashboard', icon: '⬡', label: 'Dashboard' },
            { to: '/admin/network', icon: '🗺', label: 'Digital Twin' },
            { to: '/admin/optimization', icon: '⚡', label: 'Optimization' },
            { to: '/admin/water-quality', icon: '💧', label: 'Water Quality' },
            { to: '/admin/reports', icon: '⚠', label: 'Reports' },
            { to: '/admin/ai-advisory', icon: '🤖', label: 'AI Advisory' },
        ]
    },
    {
        label: 'Portal',
        links: [
            { to: '/worker', icon: '👷', label: 'Worker Portal' },
        ]
    }
];

export default function AdminLayout() {
    const { user, logout } = useAuth();
    const { sites, activeSiteId, selectSite } = useSite();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <div className="app-shell">
            <aside className="sidebar">
                <div className="sidebar-logo">
                    <div className="sidebar-logo-text">AquaIterate</div>
                    <div className="sidebar-logo-sub">Water Reuse Intelligence</div>
                </div>

                {/* Site selector */}
                {sites.length > 0 && (
                    <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)' }}>
                        <div className="form-label">Active Site</div>
                        <select
                            className="form-select"
                            style={{ padding: '6px 10px', fontSize: '0.8rem' }}
                            value={activeSiteId || ''}
                            onChange={(e) => selectSite(parseInt(e.target.value))}
                        >
                            {sites.map((s) => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                    </div>
                )}

                <nav className="sidebar-nav">
                    {NAV_SECTIONS.map((section) => (
                        <div key={section.label}>
                            <div className="sidebar-section-label">{section.label}</div>
                            {section.links.map((link) => (
                                <NavLink
                                    key={link.to}
                                    to={link.to}
                                    className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
                                >
                                    <span className="nav-icon">{link.icon}</span>
                                    {link.label}
                                </NavLink>
                            ))}
                        </div>
                    ))}
                </nav>

                {/* User info */}
                <div style={{
                    padding: '16px',
                    borderTop: '1px solid var(--color-border)',
                    marginTop: 'auto'
                }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginBottom: 8 }}>
                        <strong style={{ color: 'var(--color-text-primary)' }}>{user?.username}</strong>
                        <span className="badge badge-cyan" style={{ marginLeft: 8, verticalAlign: 'middle' }}>
                            {user?.role}
                        </span>
                    </div>
                    <button className="btn btn-secondary btn-sm" onClick={handleLogout} style={{ width: '100%' }}>
                        Sign Out
                    </button>
                </div>
            </aside>

            <main className="main-content">
                <Outlet />
            </main>
        </div>
    );
}
