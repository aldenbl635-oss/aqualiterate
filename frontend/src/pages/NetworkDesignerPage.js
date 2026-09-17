import React, { useState, useEffect, useRef } from 'react';
import { useSite } from '../hooks/useSite';
import api from '../services/api';

export default function NetworkDesignerPage() {
    const { activeSiteId } = useSite();
    const [site, setSite] = useState(null);
    const [zones, setZones] = useState([]);
    const [selectedZone, setSelectedZone] = useState(null);
    const [loading, setLoading] = useState(false);
    const [statusText, setStatusText] = useState('');

    // Workflow States
    const [workflowStep, setWorkflowStep] = useState(1);
    const [selectedFile, setSelectedFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [isStale, setIsStale] = useState(false);

    // Edit fields
    const [editMode, setEditMode] = useState(false);
    const [editProcess, setEditProcess] = useState('');

    const imgRef = useRef(null);

    const PROCESS_OPTIONS = ['Cooling', 'Boiler', 'Washing', 'Treatment', 'Storage'];

    const loadData = async () => {
        if (!activeSiteId) return;
        setLoading(true);
        try {
            const siteRes = await api.get(`/api/sites/${activeSiteId}/`);
            setSite(siteRes.data);
            const zoneRes = await api.get(`/api/sites/${activeSiteId}/zones/`);
            setZones(zoneRes.data.results || zoneRes.data);

            if (siteRes.data.layout_image) {
                setWorkflowStep(4);
            }
        } catch (e) {
            console.error("Failed to load designer data", e);
        }
        setLoading(false);
    };

    useEffect(() => {
        loadData();
    }, [activeSiteId]);

    const fileInputRef = useRef(null);

    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
        }

        setSelectedFile(file);
        setPreviewUrl(URL.createObjectURL(file));
        setWorkflowStep(2);

        // Reset the zones and selected zone so they don't carry over to the new preview immediately
        setZones([]);
        setSelectedZone(null);
    };

    const handleReplaceLayout = () => {
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
            fileInputRef.current.click();
        }
    };

    const handleSubmitLayout = async () => {
        if (!selectedFile || !activeSiteId) return;
        setWorkflowStep(3); // Submitting
        setStatusText('Uploading layout and identifying zones...');

        const formData = new FormData();
        formData.append('layout_image', selectedFile);
        try {
            await api.patch(`/api/sites/${activeSiteId}/`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            await api.post(`/api/sites/${activeSiteId}/process_layout/`);

            setStatusText('✓ Layout submitted successfully');
            await loadData();
            setTimeout(() => setStatusText(''), 3000);
            setIsStale(true);
        } catch (err) {
            console.error(err);
            setStatusText('FAILED TO SUBMIT LAYOUT');
        }
    };

    const handleSelectZone = (z) => {
        setSelectedZone(z);
        setWorkflowStep(5);
        setEditMode(false);
    };

    const handleEditClick = () => {
        setEditMode(true);
        setEditProcess(selectedZone.process_type || '');
    };

    const handleSaveChanges = async () => {
        if (!selectedZone) return;
        setStatusText('Saving changes...');
        try {
            const res = await api.patch(`/api/sites/${activeSiteId}/zones/${selectedZone.id}/`, {
                process_type: editProcess
            });
            const updated = res.data;
            setZones(zones.map(z => z.id === updated.id ? updated : z));
            setSelectedZone(updated);
            setEditMode(false);
            setIsStale(true);
            setWorkflowStep(6);
            setStatusText('✓ Changes saved. Optimization model needs to be run.');
        } catch (err) {
            console.error(err);
            setStatusText('Error saving changes');
        }
    };

    const handleRunOptimization = async () => {
        setWorkflowStep(7);
        setStatusText('⟳ OPTIMIZING... (Building PuLP model, validating result)');
        try {
            await api.post(`/api/sites/${activeSiteId}/optimization/run/`, {});
            setStatusText('✓ OPTIMIZATION COMPLETE');
            setIsStale(false);
            setWorkflowStep(8);
        } catch (err) {
            console.error(err);
            setStatusText('⚠ Optimization could not produce a feasible network.');
        }
    };

    if (!activeSiteId) return <div className="page-body">Please select a site.</div>;

    const renderLayoutArea = () => {
        const imageUrl = previewUrl || site?.layout_image;

        if (!imageUrl) {
            return (
                <div style={{ textAlign: 'center', padding: '100px 20px', border: '2px dashed #3a6a84', borderRadius: 8 }}>
                    <h3 style={{ color: '#b0d4e8' }}>INDUSTRIAL LAYOUT</h3>
                    <p style={{ color: '#6b8a9e', maxWidth: 400, margin: '15px auto' }}>Upload your organization's physical layout diagram to create its image-based digital twin. No GPS or geographic location is required.</p>
                    <button className="btn btn-primary mt-4" style={{ fontSize: 16, padding: '10px 24px' }} onClick={() => fileInputRef.current && fileInputRef.current.click()}>
                        UPLOAD LAYOUT
                    </button>
                    <p style={{ marginTop: 15, fontSize: 12, color: '#4a7a94' }}>PNG • JPG • JPEG • SVG</p>
                </div>
            );
        }

        return (
            <div style={{ position: 'relative', width: '100%', height: '65vh', background: '#010810', overflow: 'hidden', border: '1px solid #1a4a7a' }}>
                <img
                    ref={imgRef}
                    src={imageUrl}
                    alt="Industrial Layout"
                    crossOrigin="anonymous"
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = '';
                        setStatusText('⚠ Unable to load submitted layout. Image path error.');
                    }}
                />

                {/* Zones Overlay */}
                {workflowStep >= 4 && zones.map(z => {
                    // Fallback absolute coordinate handling. If normalized is available, use bounding box.
                    // Assuming location coordinates are normalized [x_percent, y_percent]
                    const coords = z.location?.coordinates || [0.5, 0.5];

                    let left = coords[0];
                    let top = coords[1];

                    // If coordinates are large, they are pixel-based demo points, normalize them for display
                    if (left > 1.0) left = (left % 800) / 800; // crude mapping
                    if (top > 1.0) top = (top % 600) / 600;

                    return (
                        <div
                            key={z.id}
                            onClick={(e) => { e.stopPropagation(); handleSelectZone(z); }}
                            style={{
                                position: 'absolute',
                                left: `${left * 100}%`,
                                top: `${top * 100}%`,
                                transform: 'translate(-50%, -50%)',
                                padding: '8px 12px',
                                background: selectedZone?.id === z.id ? 'rgba(0, 232, 255, 0.8)' : 'rgba(26, 74, 122, 0.7)',
                                border: selectedZone?.id === z.id ? '2px solid #fff' : '1px solid #00d4ff',
                                borderRadius: 4,
                                color: '#fff', fontSize: '0.8rem', cursor: 'pointer',
                                boxShadow: selectedZone?.id === z.id ? '0 0 12px #00e8ff' : 'none',
                                whiteSpace: 'nowrap'
                            }}
                        >
                            {z.name} {selectedZone?.id === z.id ? '' : `(${z.process_type || 'Unconfirmed'})`}
                        </div>
                    );
                })}
            </div>
        );
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 20 }}>
            {/* Global Hidden Input to prevent ref overlaps */}
            <input ref={fileInputRef} type="file" hidden accept=".png,.jpg,.jpeg,.svg" onChange={handleFileSelect} />

            <div style={{ marginBottom: 20 }}>
                <h1 className="page-title">Network Designer</h1>

                {/* Workflow Tracker */}
                <div style={{ display: 'flex', gap: 10, fontSize: 13, color: '#6b8a9e', marginTop: 8, alignItems: 'center' }}>
                    <span style={{ color: workflowStep === 1 ? '#00e8ff' : '#4a7a94' }}>① Upload Layout</span> ➔
                    <span style={{ color: workflowStep === 2 ? '#00e8ff' : '#4a7a94' }}>② Review</span> ➔
                    <span style={{ color: workflowStep === 3 ? '#00e8ff' : '#4a7a94' }}>③ Submit</span> ➔
                    <span style={{ color: workflowStep >= 4 && workflowStep < 7 ? '#00e8ff' : '#4a7a94' }}>④ Configure Processes</span> ➔
                    <span style={{ color: workflowStep >= 7 ? '#00e8ff' : '#4a7a94' }}>⑤ Optimize</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 15 }}>
                    <div style={{ color: statusText.includes('FAILED') || statusText.includes('⚠') ? '#ef4444' : '#22c55e', fontWeight: 'bold' }}>
                        {statusText}
                    </div>
                    {isStale && workflowStep >= 4 && (
                        <div style={{ color: '#f59e0b', fontSize: 13, fontWeight: 600 }}>
                            ⚠ Zone characteristics changed. The current layout model requires re-optimization.
                        </div>
                    )}
                </div>
            </div>

            <div className="flex gap-4">
                {/* Left: Layout Area */}
                <div className="card flex-1">
                    <div className="card-header flex justify-between items-center bg-dark">
                        <div>
                            <h3>LAYOUT / DIGITAL TWIN</h3>
                            <div style={{ fontSize: 11, color: '#4a7a94', marginTop: 4 }}>
                                Layout-based digital twin: spatial positions are derived from the uploaded diagram. Geographic coordinates are NOT assumed.
                            </div>
                        </div>
                        <div className="flex gap-2">
                            {workflowStep >= 2 && (
                                <button className="btn btn-secondary btn-sm" onClick={handleReplaceLayout}>
                                    REPLACE LAYOUT
                                </button>
                            )}
                            {workflowStep === 2 && (
                                <button className="btn btn-primary btn-sm" onClick={handleSubmitLayout}>
                                    SUBMIT LAYOUT
                                </button>
                            )}
                            {workflowStep >= 4 && (
                                <button
                                    className={`btn btn-sm ${isStale ? 'btn-primary' : 'btn-secondary'}`}
                                    onClick={handleRunOptimization}
                                    style={{ fontWeight: isStale ? 'bold' : 'normal' }}
                                >
                                    {isStale ? 'RUN OPTIMIZATION' : 'REOPTIMIZE'}
                                </button>
                            )}
                        </div>
                    </div>
                    <div className="card-body p-0">
                        {renderLayoutArea()}
                    </div>
                </div>

                {/* Right: Selected Zone Properties */}
                <div className="card" style={{ width: 380, flexShrink: 0 }}>
                    <div className="card-header">
                        <h3>SELECTED ZONE</h3>
                    </div>
                    <div className="card-body">
                        {selectedZone ? (
                            <div>
                                <h4 style={{ color: '#00e8ff', marginBottom: 5 }}>{selectedZone.name}</h4>
                                <div style={{ color: '#b0d4e8', fontSize: 12, marginBottom: 20 }}>
                                    Detected ID: {selectedZone.id}<br />
                                    From Image Upload
                                </div>

                                {!editMode ? (
                                    <>
                                        <div style={{ marginBottom: 20 }}>
                                            <div style={{ fontSize: 11, color: '#6b8a9e', marginBottom: 2 }}>PROCESS</div>
                                            <div style={{ fontSize: 14, fontWeight: 600 }}>{selectedZone.process_type || 'Unconfirmed'}</div>
                                        </div>

                                        <div style={{ marginBottom: 20 }}>
                                            <div style={{ fontSize: 11, color: '#6b8a9e', marginBottom: 5 }}>ESTIMATED WATER CHARACTERISTICS</div>
                                            {selectedZone.process_type ? (
                                                <div style={{ background: '#04101a', padding: 10, borderRadius: 4, border: '1px solid #1a3a50' }}>
                                                    <div className="flex justify-between" style={{ padding: '4px 0' }}>
                                                        <span style={{ color: '#b0d4e8' }}>Demand Model</span>
                                                        <span>Process standard</span>
                                                    </div>
                                                    <div className="flex justify-between" style={{ padding: '4px 0' }}>
                                                        <span style={{ color: '#b0d4e8' }}>pH Range</span>
                                                        <span>Configuration derived</span>
                                                    </div>
                                                    <div className="flex justify-between" style={{ padding: '4px 0' }}>
                                                        <span style={{ color: '#b0d4e8' }}>Max TSS</span>
                                                        <span>Configuration derived</span>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div style={{ color: '#f59e0b', fontSize: 13 }}>Process not confirmed. Layout lacks characteristics.</div>
                                            )}
                                        </div>

                                        <button className="btn btn-secondary w-100 mt-2" onClick={handleEditClick}>
                                            EDIT CHARACTERISTICS
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <div className="form-group mb-4">
                                            <label style={{ fontSize: 11, color: '#6b8a9e' }}>PROCESS</label>
                                            <select
                                                className="form-select bg-dark border-secondary"
                                                value={editProcess}
                                                onChange={(e) => setEditProcess(e.target.value)}
                                            >
                                                <option value="">-- Unconfirmed --</option>
                                                {PROCESS_OPTIONS.map(p => (
                                                    <option key={p} value={p}>{p}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div style={{ fontSize: 12, color: '#f59e0b', marginBottom: 20 }}>
                                            Note: Changing the process updates the simulation constraints. Saving changes requires running optimization again.
                                        </div>

                                        <div className="flex gap-2">
                                            <button className="btn btn-secondary flex-1" onClick={() => setEditMode(false)}>CANCEL</button>
                                            <button className="btn btn-primary flex-1" onClick={handleSaveChanges}>SAVE CHANGES</button>
                                        </div>
                                    </>
                                )}
                            </div>
                        ) : (
                            <div style={{ color: '#4a7a94', padding: 20, textAlign: 'center' }}>
                                {workflowStep >= 4 ? 'Select a zone on the layout to edit its process characteristics.' : 'Submit a layout first to map physical zones.'}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
