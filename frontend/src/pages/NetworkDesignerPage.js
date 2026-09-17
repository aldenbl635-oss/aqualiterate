import React, { useState, useEffect } from 'react';
import { useSite } from '../hooks/useSite';
import api from '../services/api'; // using direct api for custom calls

export default function NetworkDesignerPage() {
    const { activeSiteId } = useSite();
    const [zones, setZones] = useState([]);
    const [site, setSite] = useState(null);
    const [selectedZone, setSelectedZone] = useState(null);
    const [loading, setLoading] = useState(false);
    const [optStatus, setOptStatus] = useState('');

    const PROCESS_OPTIONS = ['Cooling', 'Boiler', 'Washing', 'Treatment', 'Storage'];

    const loadData = async () => {
        if (!activeSiteId) return;
        setLoading(true);
        try {
            const siteRes = await api.get(`/api/sites/${activeSiteId}/`);
            setSite(siteRes.data);
            const zoneRes = await api.get(`/api/sites/${activeSiteId}/zones/`);
            setZones(zoneRes.data.results || zoneRes.data);
        } catch (e) {
            console.error("Failed to load designer data", e);
        }
        setLoading(false);
    };

    useEffect(() => {
        loadData();
    }, [activeSiteId]);

    const handleProcessChange = async (e) => {
        if (!selectedZone) return;
        const newProcess = e.target.value;
        const updated = { ...selectedZone, process_type: newProcess };
        setSelectedZone(updated);
        try {
            setOptStatus('NETWORK UPDATE REQUIRED. RE-OPTIMIZING...');
            await api.patch(`/api/sites/${activeSiteId}/zones/${selectedZone.id}/`, {
                process_type: newProcess
            });
            await loadData();
            // trigger opt
            await api.post(`/api/sites/${activeSiteId}/optimization/run/`, {});
            setOptStatus('OPTIMIZED NETWORK READY');
            setTimeout(() => setOptStatus(''), 3000);
        } catch (err) {
            console.error(err);
            setOptStatus('FAILED TO UPDATE');
        }
    };

    const handleUploadLayout = async (e) => {
        const file = e.target.files[0];
        if (!file || !activeSiteId) return;
        const formData = new FormData();
        formData.append('layout_image', file);
        try {
            await api.patch(`/api/sites/${activeSiteId}/`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            loadData();
        } catch (err) {
            console.error(err);
        }
    };

    const handleAddZone = async (e) => {
        // click on layout to add zone
        const rect = e.target.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const name = prompt("Zone Name (e.g. Z" + (zones.length + 1) + ")");
        if (!name) return;
        try {
            await api.post(`/api/sites/${activeSiteId}/zones/`, {
                name,
                location: { coordinates: [x, y] },
                process_type: 'Storage'
            });
            loadData();
        } catch (err) {
            console.error(err);
        }
    };

    if (!activeSiteId) return <div className="page-body">Please select a site.</div>;

    return (
        <>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Network Designer</h1>
                    <p className="page-subtitle">Input Layout & Process Mapping</p>
                </div>
                {optStatus && <div style={{ color: '#00e8ff', fontWeight: 'bold' }}>{optStatus}</div>}
            </div>

            <div className="page-body">
                <div className="flex gap-4">
                    {/* Left: Layout Area */}
                    <div className="card flex-1">
                        <div className="card-header flex justify-between items-center">
                            <h3>Industrial Layout</h3>
                            <div>
                                <label className="btn btn-sm btn-secondary cursor-pointer">
                                    Upload Layout
                                    <input type="file" hidden accept="image/*" onChange={handleUploadLayout} />
                                </label>
                            </div>
                        </div>
                        <div className="card-body">
                            <div
                                style={{
                                    width: '100%', height: 500, background: '#010810',
                                    border: '1px dashed #1a4a7a', position: 'relative', overflow: 'hidden'
                                }}
                                onClick={handleAddZone}
                            >
                                {site?.layout_image ? (
                                    <img src={site.layout_image} style={{ width: '100%', height: '100%', objectFit: 'contain' }} alt="Layout" />
                                ) : (
                                    <div style={{ color: '#1a4a7a', textAlign: 'center', marginTop: 220 }}>
                                        No Layout Uploaded. Click Upload Layout.<br />
                                        Or click here to add zones via coordinates.
                                    </div>
                                )}

                                {/* Render Zones */}
                                {zones.map(z => {
                                    const coords = z.location?.coordinates || [100 + (z.id * 50) % 400, 100];
                                    return (
                                        <div
                                            key={z.id}
                                            onClick={(e) => { e.stopPropagation(); setSelectedZone(z); }}
                                            style={{
                                                position: 'absolute', left: coords[0] - 25, top: coords[1] - 25,
                                                width: 50, height: 50, background: selectedZone?.id === z.id ? '#00e8ff' : '#1a4a7a',
                                                border: '2px solid #fff', borderRadius: 4, display: 'flex',
                                                alignItems: 'center', justifyContent: 'center',
                                                color: '#fff', fontSize: '0.8rem', cursor: 'pointer',
                                                boxShadow: selectedZone?.id === z.id ? '0 0 10px #00e8ff' : 'none'
                                            }}
                                        >
                                            {z.name}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Right: Selected Zone Properties */}
                    <div className="card" style={{ width: 350 }}>
                        <div className="card-header">
                            <h3>Selected Zone</h3>
                        </div>
                        <div className="card-body">
                            {selectedZone ? (
                                <div>
                                    <h4 style={{ color: '#00e8ff', marginBottom: 15 }}>{selectedZone.name}</h4>

                                    <div className="form-group mb-4">
                                        <label>Process Type</label>
                                        <select
                                            className="form-select"
                                            value={selectedZone.process_type || ''}
                                            onChange={handleProcessChange}
                                        >
                                            <option value="">-- Select Process --</option>
                                            {PROCESS_OPTIONS.map(p => (
                                                <option key={p} value={p}>{p}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div style={{ fontSize: '0.85rem', color: '#a0b0c0' }}>
                                        <p><strong>Note:</strong> Changing the process automatically updates water demand, quality requirements, and return flow characteristics, triggering a backend PuLP re-optimization.</p>
                                    </div>
                                </div>
                            ) : (
                                <div style={{ color: '#a0b0c0' }}>Select a zone on the layout.</div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
