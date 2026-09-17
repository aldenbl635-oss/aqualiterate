import React, { useState, useEffect } from 'react';
import { getReports, updateReport, analyzeReport } from '../services/api';
import { useSite } from '../hooks/useSite';
import { useAuth } from '../hooks/useAuth';

function SeverityBadge({ v }) {
    const m = { low: 'badge-green', medium: 'badge-amber', high: 'badge-red', critical: 'badge-red' };
    return <span className={`badge ${m[v] || 'badge-muted'}`}>{v}</span>;
}
function StatusBadge({ v }) {
    const m = { open: 'badge-red', under_review: 'badge-amber', action_required: 'badge-red', resolved: 'badge-green', closed: 'badge-muted' };
    return <span className={`badge ${m[v] || 'badge-muted'}`}>{v?.replace('_', ' ')}</span>;
}

export default function ReportsPage() {
    const { activeSiteId } = useSite();
    const { user } = useAuth();
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [analyzing, setAnalyzing] = useState({});
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [filterStatus, setFilterStatus] = useState('');

    const load = () => {
        if (!activeSiteId) return;
        setLoading(true);
        getReports(activeSiteId, filterStatus ? { status: filterStatus } : {})
            .then(setReports)
            .catch(() => { })
            .finally(() => setLoading(false));
    };

    useEffect(() => { load(); }, [activeSiteId, filterStatus]);

    const handleStatusChange = async (report, status) => {
        try {
            await updateReport(report.id, { status });
            setMessage(`Report #${report.id} updated to "${status}"`);
            load();
        } catch { setError('Failed to update report status.'); }
    };

    const handleAnalyze = async (report) => {
        setAnalyzing(a => ({ ...a, [report.id]: true }));
        try {
            const rec = await analyzeReport(report.id);
            setMessage(`AI analysis complete for Report #${report.id}: ${rec.priority} priority`);
            load();
        } catch (err) {
            setError('AI analysis failed: ' + (err.response?.data?.error || ''));
        } finally {
            setAnalyzing(a => ({ ...a, [report.id]: false }));
        }
    };

    return (
        <>
            <div className="page-header">
                <div className="flex items-center justify-between" style={{ paddingBottom: 20 }}>
                    <div>
                        <h1 className="page-title">Contamination Reports</h1>
                        <p className="page-subtitle" style={{ paddingBottom: 0 }}>
                            Worker-submitted site water quality observations
                        </p>
                    </div>
                    <button className="btn btn-secondary btn-sm" onClick={load}>↻ Refresh</button>
                </div>
            </div>

            <div className="page-body">
                {message && <div className="alert alert-success mb-4">{message}</div>}
                {error && <div className="alert alert-danger mb-4">{error}</div>}

                {/* Filter */}
                <div className="flex gap-3 mb-4 items-center">
                    <select className="form-select" style={{ width: 200 }}
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}>
                        <option value="">All Statuses</option>
                        <option value="open">Open</option>
                        <option value="under_review">Under Review</option>
                        <option value="action_required">Action Required</option>
                        <option value="resolved">Resolved</option>
                        <option value="closed">Closed</option>
                    </select>
                    <span className="text-muted" style={{ fontSize: '0.8rem' }}>{reports.length} reports</span>
                </div>

                {loading ? (
                    <div className="loading-state"><div className="spinner" /><span>Loading…</span></div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {reports.length === 0 && (
                            <div className="card"><div className="card-body" style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>
                                No reports found
                            </div></div>
                        )}
                        {reports.map((r) => (
                            <div key={r.id} className="card">
                                <div className="card-body">
                                    <div className="flex items-center justify-between mb-4">
                                        <div>
                                            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 4 }}>{r.title}</h3>
                                            <div className="flex gap-2 items-center">
                                                <SeverityBadge v={r.severity} />
                                                <StatusBadge v={r.status} />
                                                <span className="text-muted" style={{ fontSize: '0.78rem' }}>
                                                    Zone: {r.zone_name || '—'} · By: {r.reported_by_username || '—'}
                                                </span>
                                                <span className="text-muted" style={{ fontSize: '0.78rem' }}>
                                                    {new Date(r.reported_at).toLocaleString()}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            {user?.role === 'admin' && (
                                                <>
                                                    <button
                                                        className="btn btn-secondary btn-sm"
                                                        disabled={analyzing[r.id]}
                                                        onClick={() => handleAnalyze(r)}
                                                    >
                                                        {analyzing[r.id] ? <><div className="spinner" /> Analyzing…</> : '🤖 AI Analyze'}
                                                    </button>
                                                    <select
                                                        className="form-select"
                                                        style={{ width: 'auto', padding: '6px 12px', fontSize: '0.8rem' }}
                                                        value={r.status}
                                                        onChange={(e) => handleStatusChange(r, e.target.value)}
                                                    >
                                                        <option value="open">Open</option>
                                                        <option value="under_review">Under Review</option>
                                                        <option value="action_required">Action Required</option>
                                                        <option value="resolved">Resolved</option>
                                                        <option value="closed">Closed</option>
                                                    </select>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: 0 }}>
                                        {r.description}
                                    </p>
                                    {r.resolution_notes && (
                                        <div className="alert alert-success mt-4" style={{ margin: 0 }}>
                                            <strong>Resolution:</strong> {r.resolution_notes}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </>
    );
}
