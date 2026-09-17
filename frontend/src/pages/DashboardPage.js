import React, { useState, useEffect } from 'react';
import { getDashboardKPIs, getReports, getAIRecommendations } from '../services/api';
import { useSite } from '../hooks/useSite';
import SimulationControlPanel from '../components/simulation/SimulationControlPanel';

function KPICard({ label, value, unit, accentColor, icon }) {
    return (
        <div className="kpi-card" style={{ '--kpi-accent': accentColor }}>
            <div className="kpi-label">{icon} {label}</div>
            <div className="kpi-value">{value !== null && value !== undefined ? value : '—'}</div>
            {unit && <div className="kpi-unit">{unit}</div>}
        </div>
    );
}

function SeverityBadge({ severity }) {
    const map = {
        low: 'badge-green', medium: 'badge-amber',
        high: 'badge-red', critical: 'badge-red'
    };
    return <span className={`badge ${map[severity] || 'badge-muted'}`}>{severity}</span>;
}

function StatusBadge({ status }) {
    const map = {
        open: 'badge-red', under_review: 'badge-amber',
        action_required: 'badge-red', resolved: 'badge-green', closed: 'badge-muted',
        pending: 'badge-amber', flagged: 'badge-red',
        acknowledged: 'badge-blue', implemented: 'badge-green', dismissed: 'badge-muted',
    };
    return <span className={`badge ${map[status] || 'badge-muted'}`}>{status?.replace('_', ' ')}</span>;
}

export default function DashboardPage() {
    const { activeSiteId } = useSite();
    const [kpis, setKPIs] = useState(null);
    const [reports, setReports] = useState([]);
    const [aiRecs, setAIRecs] = useState([]);
    const [loading, setLoading] = useState(true);

    const refresh = () => {
        if (!activeSiteId) return;
        setLoading(true);
        Promise.all([
            getDashboardKPIs(activeSiteId),
            getReports(activeSiteId, { status__in: 'open,under_review,action_required' }),
            getAIRecommendations(activeSiteId),
        ]).then(([k, r, a]) => {
            setKPIs(k);
            setReports(Array.isArray(r) ? r.slice(0, 8) : []);
            setAIRecs(Array.isArray(a) ? a.slice(0, 5) : []);
        }).finally(() => setLoading(false));
    };

    useEffect(() => { refresh(); }, [activeSiteId]);

    if (!activeSiteId) {
        return (
            <div className="page-body">
                <div className="alert alert-info">No site selected. Please select a site from the sidebar.</div>
            </div>
        );
    }

    return (
        <>
            <div className="page-header">
                <div className="flex items-center justify-between" style={{ paddingBottom: 20 }}>
                    <div>
                        <h1 className="page-title">Admin Dashboard</h1>
                        <p className="page-subtitle" style={{ paddingBottom: 0 }}>
                            Real-time site-wide water network overview
                        </p>
                    </div>
                    <div className="flex gap-2 items-center">
                        <div className="demo-banner">⚠ DEMO DATA — NOT TNPCB DATA</div>
                        <button className="btn btn-secondary btn-sm" onClick={refresh}>↻ Refresh</button>
                    </div>
                </div>
            </div>

            <div className="page-body">
                <SimulationControlPanel onSimulationUpdate={refresh} />

                {loading && <div className="loading-state"><div className="spinner" /><span>Loading KPIs…</span></div>}

                {!loading && kpis && (
                    <>
                        <p className="section-title">📊 Site KPIs</p>
                        <div className="kpi-grid">
                            <KPICard label="Total Available Water" value={kpis.total_available_water}
                                unit="m³/h" accentColor="var(--gradient-primary)" icon="💧" />
                            <KPICard label="Total Sink Demand" value={kpis.total_sink_demand}
                                unit="m³/h" accentColor="var(--color-accent-blue)" icon="🔽" />
                            <KPICard label="Freshwater Consumed" value={kpis.freshwater_consumption}
                                unit="m³/h" accentColor="var(--color-accent-amber)" icon="🌊" />
                            <KPICard label="Reuse Flow" value={kpis.reuse_flow}
                                unit="m³/h" accentColor="var(--color-accent-green)" icon="♻" />
                            <KPICard label="Treatment Flow" value={kpis.treatment_flow}
                                unit="m³/h" accentColor="var(--color-accent-purple)" icon="⚗" />
                            <KPICard label="Unmet Demand" value={kpis.unmet_demand}
                                unit="m³/h" accentColor={kpis.unmet_demand > 0 ? 'var(--color-accent-red)' : 'var(--color-accent-green)'} icon="⛔" />
                            <KPICard label="Operating Cost" value={kpis.operating_cost}
                                unit="cost units (DEMO)" accentColor="var(--color-accent-teal)" icon="💰" />
                            <KPICard label="Open Reports" value={kpis.contamination_reports_open}
                                unit="reports" accentColor={kpis.contamination_reports_open > 0 ? 'var(--color-accent-red)' : 'var(--color-accent-green)'} icon="⚠" />
                            <KPICard label="AI Recs Pending" value={kpis.ai_recommendations_pending}
                                unit="recommendations" accentColor="var(--color-accent-purple)" icon="🤖" />
                        </div>
                    </>
                )}

                <div className="grid-2 gap-4">
                    {/* Open Reports */}
                    <div className="card">
                        <div className="card-header">⚠ Open Contamination Reports</div>
                        <div className="card-body" style={{ padding: 0 }}>
                            {reports.length === 0 ? (
                                <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-muted)' }}>
                                    No open reports
                                </div>
                            ) : (
                                <table className="data-table">
                                    <thead>
                                        <tr><th>Title</th><th>Zone</th><th>Severity</th><th>Status</th></tr>
                                    </thead>
                                    <tbody>
                                        {reports.map((r) => (
                                            <tr key={r.id}>
                                                <td className="truncate" style={{ maxWidth: 180 }}>{r.title}</td>
                                                <td className="text-secondary">{r.zone_name || '—'}</td>
                                                <td><SeverityBadge severity={r.severity} /></td>
                                                <td><StatusBadge status={r.status} /></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>

                    {/* AI Recommendations */}
                    <div className="card">
                        <div className="card-header">🤖 AI Recommendations</div>
                        <div className="card-body" style={{ padding: 0 }}>
                            {aiRecs.length === 0 ? (
                                <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-muted)' }}>
                                    No pending recommendations
                                </div>
                            ) : (
                                <table className="data-table">
                                    <thead>
                                        <tr><th>Recommendation</th><th>Priority</th><th>Status</th></tr>
                                    </thead>
                                    <tbody>
                                        {aiRecs.map((r) => (
                                            <tr key={r.id}>
                                                <td className="truncate" style={{ maxWidth: 240 }}>{r.recommendation}</td>
                                                <td>
                                                    <span className={`badge ${r.priority === 'urgent' ? 'badge-red' : r.priority === 'high' ? 'badge-amber' : 'badge-blue'}`}>
                                                        {r.priority}
                                                    </span>
                                                </td>
                                                <td><StatusBadge status={r.status} /></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
