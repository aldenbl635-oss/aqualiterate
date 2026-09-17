import React, { useState, useEffect } from 'react';
import { getReports, createReport } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { useSite } from '../hooks/useSite';
import { useNavigate } from 'react-router-dom';

function SeverityBadge({ v }) {
    const m = { low: 'badge-green', medium: 'badge-amber', high: 'badge-red', critical: 'badge-red' };
    return <span className={`badge ${m[v] || 'badge-muted'}`}>{v}</span>;
}
function StatusBadge({ v }) {
    const m = { open: 'badge-red', under_review: 'badge-amber', action_required: 'badge-red', resolved: 'badge-green', closed: 'badge-muted' };
    return <span className={`badge ${m[v] || 'badge-muted'}`}>{v?.replace('_', ' ')}</span>;
}

export default function WorkerPortalPage() {
    const { user, logout } = useAuth();
    const { sites, activeSiteId, selectSite } = useSite();
    const navigate = useNavigate();
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [form, setForm] = useState({
        title: '', description: '', severity: 'medium',
    });

    const loadReports = () => {
        if (!activeSiteId) return;
        setLoading(true);
        getReports(activeSiteId).then(setReports).catch(() => { }).finally(() => setLoading(false));
    };

    useEffect(() => { loadReports(); }, [activeSiteId]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.title || !form.description) {
            setError('Title and description are required.');
            return;
        }
        setSubmitting(true);
        setError('');
        try {
            await createReport(activeSiteId, form);
            setMessage('✓ Report submitted successfully. The site administrator will review it.');
            setForm({ title: '', description: '', severity: 'medium' });
            loadReports();
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to submit report.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <div style={{
            minHeight: '100vh',
            background: 'var(--color-bg-deep)',
            backgroundImage: 'radial-gradient(ellipse at 30% 20%, rgba(0,180,160,0.07) 0%, transparent 50%)',
        }}>
            {/* Header */}
            <header style={{
                background: 'var(--color-bg-panel)',
                borderBottom: '1px solid var(--color-border)',
                padding: '16px 24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
            }}>
                <div>
                    <span style={{
                        fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.2rem',
                        background: 'var(--gradient-primary)', WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent', backgroundClip: 'text'
                    }}>
                        AquaIterate
                    </span>
                    <span style={{ color: 'var(--color-text-secondary)', marginLeft: 12, fontSize: '0.85rem' }}>
                        Worker Portal
                    </span>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-secondary" style={{ fontSize: '0.85rem' }}>{user?.username}</span>
                    <span className="badge badge-amber">Worker</span>
                    <button className="btn btn-secondary btn-sm" onClick={handleLogout}>Sign Out</button>
                </div>
            </header>

            <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 24px' }}>
                {/* Site selector */}
                {sites.length > 1 && (
                    <div className="form-group mb-4">
                        <label className="form-label">Site</label>
                        <select className="form-select" value={activeSiteId || ''} onChange={(e) => selectSite(parseInt(e.target.value))}>
                            {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>
                )}

                {/* Submit form */}
                <div className="card mb-6">
                    <div className="card-header">⚠ Report Water Quality Observation</div>
                    <div className="card-body">
                        {message && <div className="alert alert-success mb-4">{message}</div>}
                        {error && <div className="alert alert-danger mb-4">{error}</div>}
                        <form onSubmit={handleSubmit}>
                            <div className="form-group">
                                <label className="form-label">Title <span style={{ color: 'var(--color-accent-red)' }}>*</span></label>
                                <input
                                    id="report-title"
                                    type="text"
                                    className="form-input"
                                    placeholder="Brief description of the observation"
                                    value={form.title}
                                    onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Description <span style={{ color: 'var(--color-accent-red)' }}>*</span></label>
                                <textarea
                                    id="report-description"
                                    className="form-textarea"
                                    placeholder="Describe what you observed in detail..."
                                    value={form.description}
                                    onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Severity</label>
                                <select
                                    id="report-severity"
                                    className="form-select"
                                    value={form.severity}
                                    onChange={(e) => setForm(f => ({ ...f, severity: e.target.value }))}
                                >
                                    <option value="low">Low — Minor observation</option>
                                    <option value="medium">Medium — Notable concern</option>
                                    <option value="high">High — Significant issue</option>
                                    <option value="critical">Critical — Immediate attention</option>
                                </select>
                            </div>
                            <button
                                id="submit-report-btn"
                                type="submit"
                                className="btn btn-primary"
                                disabled={submitting || !activeSiteId}
                            >
                                {submitting ? <><div className="spinner" /> Submitting…</> : 'Submit Report'}
                            </button>
                        </form>
                    </div>
                </div>

                {/* My reports */}
                <div className="card">
                    <div className="card-header">
                        📋 My Submitted Reports
                        <button className="btn btn-secondary btn-sm" style={{ marginLeft: 'auto' }} onClick={loadReports}>
                            ↻ Refresh
                        </button>
                    </div>
                    <div className="card-body" style={{ padding: 0 }}>
                        {loading ? (
                            <div className="loading-state"><div className="spinner" /><span>Loading…</span></div>
                        ) : reports.length === 0 ? (
                            <div style={{ padding: 32, textAlign: 'center', color: 'var(--color-text-muted)' }}>
                                You haven't submitted any reports yet.
                            </div>
                        ) : (
                            <table className="data-table">
                                <thead>
                                    <tr><th>Title</th><th>Severity</th><th>Status</th><th>Submitted</th></tr>
                                </thead>
                                <tbody>
                                    {reports.map(r => (
                                        <tr key={r.id}>
                                            <td>{r.title}</td>
                                            <td><SeverityBadge v={r.severity} /></td>
                                            <td><StatusBadge v={r.status} /></td>
                                            <td className="text-muted">{new Date(r.reported_at).toLocaleString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
