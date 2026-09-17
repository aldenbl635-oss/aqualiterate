import React, { useState, useEffect } from 'react';
import {
    runOptimization, getOptimizationRuns, getOptimizationRun
} from '../services/api';
import { useSite } from '../hooks/useSite';

export default function OptimizationPage() {
    const { activeSiteId } = useSite();
    const [runs, setRuns] = useState([]);
    const [selectedRun, setSelectedRun] = useState(null);
    const [running, setRunning] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [params, setParams] = useState({ freshwater_penalty: 1.0, allow_partial_demand: true });

    const loadRuns = () => {
        if (!activeSiteId) return;
        getOptimizationRuns(activeSiteId).then(setRuns).catch(() => { });
    };

    useEffect(() => { loadRuns(); }, [activeSiteId]);

    const handleRun = async () => {
        setRunning(true);
        setError('');
        setMessage('');
        try {
            const result = await runOptimization(activeSiteId, params);
            if (result.status === 'infeasible') {
                setError(`Infeasible: ${result.message}`);
            } else if (result.status === 'error') {
                setError(`Error: ${result.message}`);
            } else {
                setMessage(`✓ Optimization complete. Run ID: ${result.id || result.run_id}`);
                setSelectedRun(result);
                loadRuns();
            }
        } catch (err) {
            setError(err.response?.data?.error || 'Optimization request failed.');
        } finally {
            setRunning(false);
        }
    };

    const handleSelectRun = async (run) => {
        try {
            const full = await getOptimizationRun(run.id);
            setSelectedRun(full);
        } catch { setSelectedRun(run); }
    };

    const routes = selectedRun?.routes || [];
    const unmet = selectedRun?.unmet_demand_json || {};

    return (
        <>
            <div className="page-header">
                <div className="flex items-center justify-between" style={{ paddingBottom: 20 }}>
                    <div>
                        <h1 className="page-title">Optimization Engine</h1>
                        <p className="page-subtitle" style={{ paddingBottom: 0 }}>
                            PuLP/CBC water-pinch LP optimization
                        </p>
                    </div>
                    <div className="demo-banner">⚠ DEMO DATA — Costs are DEMO ASSUMPTIONS</div>
                </div>
            </div>

            <div className="page-body">
                {/* Parameters */}
                <div className="card mb-4">
                    <div className="card-header">⚙ Optimization Parameters</div>
                    <div className="card-body">
                        <div className="grid-2 gap-4">
                            <div className="form-group" style={{ margin: 0 }}>
                                <label className="form-label">
                                    Freshwater Penalty
                                    <span className="text-muted" style={{ fontSize: '0.7rem', marginLeft: 6 }}>
                                        (configurable demo parameter)
                                    </span>
                                </label>
                                <input
                                    type="number" step="0.1" min="0"
                                    className="form-input"
                                    value={params.freshwater_penalty}
                                    onChange={(e) => setParams(p => ({ ...p, freshwater_penalty: parseFloat(e.target.value) }))}
                                />
                            </div>
                            <div className="form-group" style={{ margin: 0 }}>
                                <label className="form-label">Allow Partial Demand</label>
                                <select
                                    className="form-select"
                                    value={params.allow_partial_demand ? 'true' : 'false'}
                                    onChange={(e) => setParams(p => ({ ...p, allow_partial_demand: e.target.value === 'true' }))}
                                >
                                    <option value="true">Yes (report unmet demand)</option>
                                    <option value="false">No (strict — must satisfy all demand)</option>
                                </select>
                            </div>
                        </div>
                        <div className="mt-4">
                            <button
                                id="run-optimization-btn"
                                className="btn btn-primary btn-lg"
                                onClick={handleRun}
                                disabled={running || !activeSiteId}
                            >
                                {running ? <><div className="spinner" /> Running Optimizer…</> : '⚡ Run Optimization'}
                            </button>
                        </div>
                    </div>
                </div>

                {error && <div className="alert alert-danger">⛔ {error}</div>}
                {message && <div className="alert alert-success">{message}</div>}

                {/* Selected run result */}
                {selectedRun && selectedRun.status === 'optimal' && (
                    <div className="card mb-4">
                        <div className="card-header">
                            ✓ Run #{selectedRun.id} — Optimal
                            <span className="badge badge-green" style={{ marginLeft: 12 }}>{selectedRun.solver_status}</span>
                        </div>
                        <div className="card-body">
                            <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
                                <div className="kpi-card">
                                    <div className="kpi-label">Freshwater</div>
                                    <div className="kpi-value">{selectedRun.freshwater_consumption}</div>
                                    <div className="kpi-unit">m³/h</div>
                                </div>
                                <div className="kpi-card">
                                    <div className="kpi-label">Reuse Flow</div>
                                    <div className="kpi-value">{selectedRun.reuse_flow}</div>
                                    <div className="kpi-unit">m³/h</div>
                                </div>
                                <div className="kpi-card">
                                    <div className="kpi-label">Treatment Flow</div>
                                    <div className="kpi-value">{selectedRun.treatment_flow}</div>
                                    <div className="kpi-unit">m³/h</div>
                                </div>
                                <div className="kpi-card">
                                    <div className="kpi-label">Operating Cost</div>
                                    <div className="kpi-value">{selectedRun.estimated_operating_cost}</div>
                                    <div className="kpi-unit">cost units (DEMO)</div>
                                </div>
                            </div>

                            {Object.keys(unmet).length > 0 && (
                                <div className="alert alert-warning mt-4">
                                    ⚠ Unmet demand detected (partial demand mode):
                                    {Object.entries(unmet).map(([sinkId, flow]) => (
                                        <span key={sinkId} style={{ marginLeft: 12 }}>
                                            Sink #{sinkId}: <strong>{flow} m³/h</strong> unmet
                                        </span>
                                    ))}
                                </div>
                            )}

                            {/* Route table */}
                            {routes.length > 0 && (
                                <>
                                    <h3 className="section-title mt-4">Source → Sink Routes</h3>
                                    <div style={{ overflowX: 'auto' }}>
                                        <table className="data-table">
                                            <thead>
                                                <tr>
                                                    <th>Source</th><th>Sink</th><th>Flow (m³/h)</th>
                                                    <th>Treatment</th><th>Quality</th>
                                                    <th>Routing Cost</th><th>Treatment Cost</th><th>Total Cost</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {routes.map((r, i) => (
                                                    <tr key={i}>
                                                        <td>{r.source_name || `Source #${r.source}`}</td>
                                                        <td>{r.sink_name || `Sink #${r.sink}`}</td>
                                                        <td className="text-cyan">{r.allocated_flow}</td>
                                                        <td>
                                                            <span className={`badge ${r.treatment_required ? 'badge-purple' : 'badge-green'}`}>
                                                                {r.treatment_required ? r.treatment_name || 'Treatment' : 'Direct'}
                                                            </span>
                                                        </td>
                                                        <td>
                                                            <span className={`badge ${r.quality_status === 'compatible' ? 'badge-green' : 'badge-purple'}`}>
                                                                {r.quality_status}
                                                            </span>
                                                        </td>
                                                        <td className="text-muted">{r.routing_cost}</td>
                                                        <td className="text-muted">{r.treatment_cost || 0}</td>
                                                        <td className="text-amber">{r.total_cost}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    <p className="text-muted mt-4" style={{ fontSize: '0.75rem' }}>
                                        ⚠ All cost figures shown above are DEMO ASSUMPTIONS, not real industrial costs.
                                    </p>
                                </>
                            )}
                        </div>
                    </div>
                )}

                {/* Run history */}
                <div className="card">
                    <div className="card-header">📋 Optimization Run History</div>
                    <div className="card-body" style={{ padding: 0 }}>
                        <table className="data-table">
                            <thead>
                                <tr><th>ID</th><th>Status</th><th>Reuse Flow</th><th>Cost</th><th>Created</th><th></th></tr>
                            </thead>
                            <tbody>
                                {runs.map((r) => (
                                    <tr key={r.id}>
                                        <td className="text-muted">#{r.id}</td>
                                        <td>
                                            <span className={`badge ${r.status === 'optimal' ? 'badge-green' : r.status === 'infeasible' ? 'badge-red' : 'badge-muted'}`}>
                                                {r.status}
                                            </span>
                                        </td>
                                        <td>{r.reuse_flow ?? '—'} m³/h</td>
                                        <td>{r.estimated_operating_cost ?? '—'}</td>
                                        <td className="text-muted">{new Date(r.created_at).toLocaleString()}</td>
                                        <td>
                                            <button className="btn btn-secondary btn-sm" onClick={() => handleSelectRun(r)}>
                                                View
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {runs.length === 0 && (
                                    <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>
                                        No runs yet. Click "Run Optimization" above.
                                    </td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </>
    );
}
