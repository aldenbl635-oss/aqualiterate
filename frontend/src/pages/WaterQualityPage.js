import React, { useState, useEffect } from 'react';
import { getTNPCBReadings } from '../services/api';
import { useSite } from '../hooks/useSite';

export default function WaterQualityPage() {
    const { activeSiteId } = useSite();
    const [readings, setReadings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({ parameter_name: '', dataset_name: '' });

    useEffect(() => {
        if (!activeSiteId) return;
        setLoading(true);
        getTNPCBReadings(activeSiteId, {
            ...(filters.parameter_name ? { parameter_name: filters.parameter_name } : {}),
            ...(filters.dataset_name ? { dataset_name: filters.dataset_name } : {}),
        })
            .then(setReadings)
            .catch(() => { })
            .finally(() => setLoading(false));
    }, [activeSiteId, filters]);

    const params = [...new Set(readings.map(r => r.parameter_name))].sort();
    const datasets = [...new Set(readings.map(r => r.dataset_name))].sort();

    return (
        <>
            <div className="page-header">
                <div className="flex items-center justify-between" style={{ paddingBottom: 20 }}>
                    <div>
                        <h1 className="page-title">Water Quality Data</h1>
                        <p className="page-subtitle" style={{ paddingBottom: 0 }}>
                            TNPCB readings and demo water quality profiles
                        </p>
                    </div>
                </div>
            </div>

            <div className="page-body">
                <div className="alert alert-info mb-4">
                    ℹ TNPCB data is displayed as imported — original values are never altered.
                    Demo data is explicitly labelled below.
                </div>

                {/* Filters */}
                <div className="card mb-4">
                    <div className="card-body" style={{ padding: '14px 20px' }}>
                        <div className="flex gap-4 items-center flex-wrap">
                            <div style={{ flex: '0 0 200px' }}>
                                <select
                                    className="form-select"
                                    value={filters.parameter_name}
                                    onChange={(e) => setFilters(f => ({ ...f, parameter_name: e.target.value }))}
                                >
                                    <option value="">All Parameters</option>
                                    {params.map(p => <option key={p} value={p}>{p}</option>)}
                                </select>
                            </div>
                            <div style={{ flex: '0 0 260px' }}>
                                <select
                                    className="form-select"
                                    value={filters.dataset_name}
                                    onChange={(e) => setFilters(f => ({ ...f, dataset_name: e.target.value }))}
                                >
                                    <option value="">All Datasets</option>
                                    {datasets.map(d => <option key={d} value={d}>{d}</option>)}
                                </select>
                            </div>
                            <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => setFilters({ parameter_name: '', dataset_name: '' })}
                            >
                                Clear Filters
                            </button>
                            <span className="text-muted" style={{ fontSize: '0.8rem' }}>
                                {readings.length} records
                            </span>
                        </div>
                    </div>
                </div>

                <div className="card">
                    <div className="card-body" style={{ padding: 0 }}>
                        {loading ? (
                            <div className="loading-state"><div className="spinner" /><span>Loading readings…</span></div>
                        ) : (
                            <div style={{ overflowX: 'auto' }}>
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>Source Reference</th>
                                            <th>Parameter</th>
                                            <th>Value</th>
                                            <th>Unit</th>
                                            <th>Sample Time</th>
                                            <th>Dataset</th>
                                            <th>Dataset Reference</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {readings.map((r) => (
                                            <tr key={r.id}>
                                                <td className="text-secondary">{r.source_reference}</td>
                                                <td className="text-cyan">{r.parameter_name}</td>
                                                <td style={{ fontFamily: 'monospace' }}>{r.parameter_value}</td>
                                                <td className="text-muted">{r.unit}</td>
                                                <td className="text-muted">
                                                    {r.sample_time ? new Date(r.sample_time).toLocaleString() : '—'}
                                                </td>
                                                <td>
                                                    {r.dataset_name.includes('DEMO') ? (
                                                        <span className="badge badge-amber">{r.dataset_name}</span>
                                                    ) : (
                                                        <span className="badge badge-cyan">TNPCB: {r.dataset_name}</span>
                                                    )}
                                                </td>
                                                <td className="text-muted" style={{ fontSize: '0.75rem' }}>{r.dataset_reference || '—'}</td>
                                            </tr>
                                        ))}
                                        {readings.length === 0 && (
                                            <tr>
                                                <td colSpan={7} style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: 32 }}>
                                                    No water quality readings found. Import TNPCB data or load demo data.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}
