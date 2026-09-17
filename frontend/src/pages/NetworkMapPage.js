import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, CircleMarker, Polyline, Tooltip, LayerGroup, GeoJSON } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { getNetworkGeoJSON, getSources, getSinks } from '../services/api';
import { useSite } from '../hooks/useSite';
import DigitalTwinView from '../components/digitalTwin/DigitalTwinView';
import SimulationControlPanel from '../components/simulation/SimulationControlPanel';

const DEMO_CENTER = [13.0827, 80.2785]; // Chennai demo coords

function SourceMarker({ feature }) {
    const p = feature.properties;
    const pos = feature.geometry ? [feature.geometry.coordinates[1], feature.geometry.coordinates[0]] : null;
    if (!pos) return null;
    return (
        <CircleMarker
            center={pos}
            radius={p.is_freshwater ? 12 : 9}
            pathOptions={{
                color: p.is_freshwater ? '#00d4ff' : '#22c55e',
                fillColor: p.is_freshwater ? '#00d4ff' : '#22c55e',
                fillOpacity: 0.7,
                weight: 2,
            }}
        >
            <Tooltip>
                <strong>{p.name}</strong><br />
                Type: {p.source_type}<br />
                Flow: {p.available_flow} {p.unit || 'm³/h'}<br />
                {p.is_freshwater ? '💧 Freshwater' : '♻ Reuse'}<br />
                <em style={{ fontSize: 10, opacity: 0.7 }}>DEMO DATA</em>
            </Tooltip>
        </CircleMarker>
    );
}

function SinkMarker({ feature }) {
    const p = feature.properties;
    const pos = feature.geometry ? [feature.geometry.coordinates[1], feature.geometry.coordinates[0]] : null;
    if (!pos) return null;
    return (
        <CircleMarker
            center={pos}
            radius={10}
            pathOptions={{
                color: p.is_terminal ? '#ef4444' : '#f59e0b',
                fillColor: p.is_terminal ? '#ef4444' : '#f59e0b',
                fillOpacity: 0.6,
                weight: 2,
                dashArray: '4 2',
            }}
        >
            <Tooltip>
                <strong>{p.name}</strong><br />
                Required: {p.required_flow} {p.unit || 'm³/h'}<br />
                {p.is_terminal ? '🚰 Terminal Discharge' : '♻ Recovers to further use'}<br />
                <em style={{ fontSize: 10, opacity: 0.7 }}>DEMO DATA</em>
            </Tooltip>
        </CircleMarker>
    );
}

function RoutePolyline({ positions, isOptimized, isRecovery, featureProps }) {
    if (!positions || positions.length < 2) return null;

    // Choose color based on pipe type
    let color = '#4a7a94'; // default connection
    if (isOptimized) {
        color = '#00d4ff'; // Bright cyan
    } else if (isRecovery) {
        color = '#22c55e'; // Bright green for recovery
    }

    return (
        <>
            {/* Base outer glow line */}
            <Polyline
                positions={positions}
                pathOptions={{
                    color: color,
                    weight: isOptimized || isRecovery ? 6 : 2,
                    opacity: isOptimized || isRecovery ? 0.3 : 0.2,
                }}
            />
            {/* Inner solid core line */}
            <Polyline
                positions={positions}
                pathOptions={{
                    color: color,
                    weight: isOptimized || isRecovery ? 3 : 1.5,
                    opacity: isOptimized || isRecovery ? 0.9 : 0.4,
                    dashArray: isOptimized || isRecovery ? null : '6 4',
                }}
            >
                {(isOptimized || isRecovery) && (
                    <Tooltip>
                        <strong>{isRecovery ? 'Wastewater Recovery Route' : 'Optimized Supply Route'}</strong><br />
                        {featureProps && featureProps.allocated_flow && (
                            <>Flow: {featureProps.allocated_flow} m³/h<br /></>
                        )}
                        {featureProps && featureProps.treatment_required && (
                            <>Treatment: Yes<br /></>
                        )}
                        <em style={{ fontSize: 10, opacity: 0.7 }}>{isRecovery ? 'Cycle completion' : 'DEMO ASSUMPTIONS'}</em>
                    </Tooltip>
                )}
            </Polyline>

            {/* Animated particles layer (on top of active pipes) */}
            {(isOptimized || isRecovery) && (
                <Polyline
                    positions={positions}
                    className="flow-anim-path"
                    pathOptions={{
                        color: '#ffffff',
                        weight: 2,
                        opacity: 1.0,
                        dashArray: '4, 16',
                    }}
                />
            )}
        </>
    );
}



export default function NetworkMapPage() {
    const { activeSiteId } = useSite();
    const [geoJSON, setGeoJSON] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [viewMode, setViewMode] = useState('2d');
    const [currentTimestamp, setCurrentTimestamp] = useState(null);

    const fetchGraph = () => {
        if (!activeSiteId) return;
        getNetworkGeoJSON(activeSiteId)
            .then(setGeoJSON)
            .catch(() => setError('Failed to load network data'));
    };

    useEffect(() => {
        setLoading(true);
        fetchGraph();
        setTimeout(() => setLoading(false), 500); // small artificial minimum loading delay
    }, [activeSiteId]);

    const handleSimulationUpdate = (simData) => {
        if (simData?.simulation?.current_timestamp) {
            setCurrentTimestamp(simData.simulation.current_timestamp);
        }
        // If simulation timestamp advances, we re-fetch the geoJSON silently behind the scenes
        fetchGraph();
    };

    const sources = geoJSON?.features?.filter(f => f.properties.type === 'source') || [];
    const sinks = geoJSON?.features?.filter(f => f.properties.type === 'sink') || [];
    const connections = geoJSON?.features?.filter(f => f.properties.type === 'connection') || [];
    const optimizedRoutes = geoJSON?.features?.filter(f => f.properties.type === 'optimized_route') || [];

    // Synthesize physical recovery routes to close the loop based on the backend graph
    const recoveryEdges = [];
    sinks.forEach(sink => {
        const p = sink.properties;
        const sinkPos = sink.geometry ? [sink.geometry.coordinates[1], sink.geometry.coordinates[0]] : null;
        if (!p.is_terminal && p.recovery_source && sinkPos) {
            const rSource = sources.find(s => s.properties.id === p.recovery_source);
            if (rSource && rSource.geometry) {
                const rsPos = [rSource.geometry.coordinates[1], rSource.geometry.coordinates[0]];
                recoveryEdges.push({
                    id: `rev-${sink.id}`,
                    positions: [sinkPos, rsPos],
                    properties: p
                });
            }
        }
    });

    return (
        <>
            <div className="page-header">
                <div className="flex items-center justify-between" style={{ paddingBottom: 20 }}>
                    <div>
                        <h1 className="page-title">Digital Twin — Network Map</h1>
                        <p className="page-subtitle" style={{ paddingBottom: 0 }}>
                            Real-time site water flow visualization
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <button className={`btn ${viewMode === '2d' ? 'btn-primary' : 'btn-secondary'} btn-sm`} onClick={() => setViewMode('2d')}>2D VIEW</button>
                        <button className={`btn ${viewMode === '3d' ? 'btn-primary' : 'btn-secondary'} btn-sm`} onClick={() => setViewMode('3d')}>3D VIEW</button>
                    </div>
                </div>
            </div>

            <div className="page-body">
                <SimulationControlPanel onSimulationUpdate={handleSimulationUpdate} />

                {/* Legend */}
                <div className="card mb-4">
                    <div className="card-body" style={{ padding: '12px 20px' }}>
                        <div className="flex gap-4 items-center flex-wrap">
                            <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Legend:</span>
                            <span style={{ fontSize: '0.8rem', color: '#00d4ff' }}>● Freshwater Source</span>
                            <span style={{ fontSize: '0.8rem', color: '#22c55e' }}>● Reuse Source</span>
                            <span style={{ fontSize: '0.8rem', color: '#f59e0b' }}>⊙ Water Sink</span>
                            <span style={{ fontSize: '0.8rem', color: '#ef4444' }}>⊙ Terminal Sink</span>
                            <span style={{ fontSize: '0.8rem', color: '#00d4ff' }}>━ Supply Route (Flows)</span>
                            <span style={{ fontSize: '0.8rem', color: '#22c55e' }}>━ Recovery Route (Flows)</span>
                        </div>
                    </div>
                </div>

                {loading && <div className="loading-state"><div className="spinner" /><span>Loading map…</span></div>}
                {error && <div className="alert alert-danger">{error}</div>}

                {!loading && !error && viewMode === '2d' && (
                    <div className="map-container" style={{ height: '68vh' }}>
                        <MapContainer
                            center={DEMO_CENTER}
                            zoom={17}
                            style={{ height: '100%', width: '100%' }}
                            zoomControl={true}
                        >
                            <TileLayer
                                attribution='&copy; OpenStreetMap contributors'
                                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                opacity={0.3}
                            />

                            {/* Network connections (background) */}
                            <LayerGroup>
                                {connections.map((f, i) => {
                                    const coords = f.geometry?.coordinates;
                                    if (!coords) return null;
                                    return <RoutePolyline key={`conn-${i}`} positions={coords.map(c => [c[1], c[0]])} isOptimized={false} isRecovery={false} />;
                                })}
                            </LayerGroup>

                            {/* Optimized routes */}
                            <LayerGroup>
                                {optimizedRoutes.map((f, i) => {
                                    const coords = f.geometry?.coordinates;
                                    if (!coords) return null;
                                    return <RoutePolyline key={`opt-${i}`} positions={coords.map(c => [c[1], c[0]])} isOptimized={true} isRecovery={false} featureProps={f.properties} />;
                                })}
                            </LayerGroup>

                            {/* Cycle recovery edges */}
                            <LayerGroup>
                                {recoveryEdges.map((re, i) => (
                                    <RoutePolyline key={`rec-${i}`} positions={re.positions} isOptimized={false} isRecovery={true} featureProps={re.properties} />
                                ))}
                            </LayerGroup>

                            {/* Sources */}
                            <LayerGroup>
                                {sources.map((f, i) => <SourceMarker key={`src-${i}`} feature={f} />)}
                            </LayerGroup>

                            {/* Sinks */}
                            <LayerGroup>
                                {sinks.map((f, i) => <SinkMarker key={`snk-${i}`} feature={f} />)}
                            </LayerGroup>
                        </MapContainer>
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

                {/* Source / Sink summary tables */}
                {!loading && !error && (
                    <div className="grid-2 gap-4 mt-4">
                        <div className="card">
                            <div className="card-header">💧 Water Sources</div>
                            <div className="card-body" style={{ padding: 0 }}>
                                <table className="data-table">
                                    <thead>
                                        <tr><th>Name</th><th>Type</th><th>Flow</th><th>Kind</th></tr>
                                    </thead>
                                    <tbody>
                                        {sources.map((f, i) => {
                                            const p = f.properties;
                                            return (
                                                <tr key={i}>
                                                    <td>{p.name}</td>
                                                    <td className="text-secondary">{p.source_type}</td>
                                                    <td className="text-cyan">{p.available_flow} m³/h</td>
                                                    <td>
                                                        <span className={`badge ${p.is_freshwater ? 'badge-blue' : 'badge-green'}`}>
                                                            {p.is_freshwater ? 'Freshwater' : 'Reuse'}
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        {sources.length === 0 && (
                                            <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>No sources</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="card">
                            <div className="card-header">🔽 Water Sinks</div>
                            <div className="card-body" style={{ padding: 0 }}>
                                <table className="data-table">
                                    <thead>
                                        <tr><th>Name</th><th>Type</th><th>Required</th></tr>
                                    </thead>
                                    <tbody>
                                        {sinks.map((f, i) => {
                                            const p = f.properties;
                                            return (
                                                <tr key={i}>
                                                    <td>{p.name}</td>
                                                    <td className="text-secondary">{p.sink_type}</td>
                                                    <td className="text-amber">{p.required_flow} m³/h</td>
                                                </tr>
                                            );
                                        })}
                                        {sinks.length === 0 && (
                                            <tr><td colSpan={3} style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>No sinks</td></tr>
                                        )}
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
