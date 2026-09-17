import React, { useState, useEffect } from 'react';
import api, { getNetworkGeoJSON, getPIDDocumentBySite, getPIDGraph } from '../services/api';
import { useSite } from '../hooks/useSite';
import DigitalTwinView from '../components/digitalTwin/DigitalTwinView';
import SimulationControlPanel from '../components/simulation/SimulationControlPanel';
import PIDRenderer from '../components/pid/PIDRenderer';

export default function NetworkMapPage() {
    const { activeSiteId } = useSite();
    const [geoJSON, setGeoJSON] = useState(null);
    const [site, setSite] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [viewMode, setViewMode] = useState('2d');
    const [currentTimestamp, setCurrentTimestamp] = useState(null);
    const [pidGraph, setPidGraph] = useState(null);

    const fetchGraph = async () => {
        if (!activeSiteId) return;
        try {
            const siteRes = await api.get(`/api/sites/${activeSiteId}/`);
            setSite(siteRes.data);
            const geoRes = await getNetworkGeoJSON(activeSiteId);
            setGeoJSON(geoRes);
            try {
                const pidDocId = await getPIDDocumentBySite(activeSiteId);
                if (pidDocId) {
                    const g = await getPIDGraph(pidDocId);
                    setPidGraph(g);
                }
            } catch (e) {
                console.log("No PID Diagram found for site");
            }
        } catch (e) {
            console.error(e);
            setError('Failed to load network data');
        }
    };

    useEffect(() => {
        setLoading(true);
        fetchGraph();
        setTimeout(() => setLoading(false), 500);
    }, [activeSiteId]);

    const handleSimulationUpdate = (simData) => {
        if (simData?.simulation?.current_timestamp) {
            setCurrentTimestamp(simData.simulation.current_timestamp);
        }
        fetchGraph();
    };

    const sources = geoJSON?.features?.filter(f => f.properties.type === 'source') || [];
    const sinks = geoJSON?.features?.filter(f => f.properties.type === 'sink') || [];
    const connections = geoJSON?.features?.filter(f => f.properties.type === 'connection') || [];
    const optimizedRoutes = geoJSON?.features?.filter(f => f.properties.type === 'optimized_route') || [];
    const recoveryEdges = [];

    // Derive 2D P&ID components
    const pidNodes = pidGraph?.nodes || [];
    const pidEdges = pidGraph?.edges || [];

    return (
        <>
            <div className="page-header">
                <div className="flex items-center justify-between" style={{ paddingBottom: 20 }}>
                    <div>
                        <h1 className="page-title">Engineering Digital Twin — P&ID Viewer</h1>
                        <p className="page-subtitle" style={{ paddingBottom: 0 }}>
                            Native structural reconstruction
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <button className={`btn ${viewMode === '2d' ? 'btn-primary' : 'btn-secondary'} btn-sm`} onClick={() => setViewMode('2d')}>2D ENGINEER VIEW</button>
                        <button className={`btn ${viewMode === '3d' ? 'btn-primary' : 'btn-secondary'} btn-sm`} onClick={() => setViewMode('3d')}>3D VIEW</button>
                    </div>
                </div>
            </div>

            <div className="page-body">
                <SimulationControlPanel onSimulationUpdate={handleSimulationUpdate} />

                {loading && <div className="loading-state"><div className="spinner" /><span>Loading engineering model…</span></div>}
                {error && <div className="alert alert-danger">{error}</div>}

                {!loading && !error && viewMode === '2d' && (
                    <div className="card mt-4" style={{ padding: 0, height: 750, position: 'relative' }}>
                        <PIDRenderer
                            nodes={pidNodes}
                            edges={pidEdges}
                            sourceImage={site?.layout_image}
                            documentWidth={site?.pid_width || 2000}
                            documentHeight={site?.pid_height || 1200}
                        />
                    </div>
                )}

                {!loading && !error && viewMode === '3d' && (
                    <DigitalTwinView
                        sources={sources}
                        sinks={sinks}
                        connections={connections}
                        optimizedRoutes={optimizedRoutes}
                        recoveryEdges={recoveryEdges}
                        currentTimestamp={currentTimestamp}
                    />
                )}

                {/* Legacy Source / Sink summary tables */}
                {!loading && !error && (
                    <div className="grid-2 gap-4 mt-4">
                        <div className="card">
                            <div className="card-header">💧 Logical Water Sources</div>
                            <div className="card-body" style={{ padding: 0 }}>
                                <table className="data-table">
                                    <thead>
                                        <tr><th>Name</th><th>Type</th><th>Flow</th></tr>
                                    </thead>
                                    <tbody>
                                        {sources.map((f, i) => (
                                            <tr key={i}>
                                                <td>{f.properties.name}</td>
                                                <td className="text-secondary">{f.properties.source_type}</td>
                                                <td className="text-cyan">{f.properties.available_flow} m³/h</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="card">
                            <div className="card-header">🔽 Logical Water Sinks</div>
                            <div className="card-body" style={{ padding: 0 }}>
                                <table className="data-table">
                                    <thead>
                                        <tr><th>Name</th><th>Type</th><th>Required</th></tr>
                                    </thead>
                                    <tbody>
                                        {sinks.map((f, i) => (
                                            <tr key={i}>
                                                <td>{f.properties.name}</td>
                                                <td className="text-secondary">{f.properties.sink_type}</td>
                                                <td className="text-amber">{f.properties.required_flow} m³/h</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}
