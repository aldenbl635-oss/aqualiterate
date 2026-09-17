import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, CircleMarker, Polyline, Tooltip, LayerGroup, GeoJSON } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { getNetworkGeoJSON, getSources, getSinks } from '../services/api';
import { useSite } from '../hooks/useSite';
import DigitalTwinView from '../components/digitalTwin/DigitalTwinView';

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
                color: '#f59e0b',
                fillColor: '#f59e0b',
                fillOpacity: 0.6,
                weight: 2,
                dashArray: '4 2',
            }}
        >
            <Tooltip>
                <strong>{p.name}</strong><br />
                Required: {p.required_flow} {p.unit || 'm³/h'}<br />
                <em style={{ fontSize: 10, opacity: 0.7 }}>DEMO DATA</em>
            </Tooltip>
        </CircleMarker>
    );
}

function RoutePolyline({ feature, isOptimized }) {
    const p = feature.properties;
    const coords = feature.geometry?.coordinates;
    if (!coords || coords.length < 2) return null;
    const positions = coords.map(c => [c[1], c[0]]);
    return (
        <Polyline
            positions={positions}
            pathOptions={{
                color: isOptimized ? '#00d4ff' : '#4a7a94',
                weight: isOptimized ? 3 : 1.5,
                opacity: isOptimized ? 0.85 : 0.4,
                dashArray: isOptimized ? null : '6 4',
            }}
        >
            {isOptimized && (
                <Tooltip>
                    <strong>Optimized Route</strong><br />
                    Flow: {p.allocated_flow} m³/h<br />
                    Quality: {p.quality_status}<br />
                    Treatment: {p.treatment_required ? 'Yes' : 'No'}<br />
                    Routing cost: {p.routing_cost}<br />
                    Total cost: {p.total_cost}<br />
                    <em style={{ fontSize: 10, opacity: 0.7 }}>DEMO DATA — costs are DEMO ASSUMPTIONS</em>
                </Tooltip>
            )}
        </Polyline>
    );
}

export default function NetworkMapPage() {
    const { activeSiteId } = useSite();
    const [geoJSON, setGeoJSON] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [viewMode, setViewMode] = useState('2d');

    useEffect(() => {
        if (!activeSiteId) return;
        setLoading(true);
        getNetworkGeoJSON(activeSiteId)
            .then(setGeoJSON)
            .catch(() => setError('Failed to load network data'))
            .finally(() => setLoading(false));
    }, [activeSiteId]);

    const sources = geoJSON?.features?.filter(f => f.properties.type === 'source') || [];
    const sinks = geoJSON?.features?.filter(f => f.properties.type === 'sink') || [];
    const connections = geoJSON?.features?.filter(f => f.properties.type === 'connection') || [];
    const optimizedRoutes = geoJSON?.features?.filter(f => f.properties.type === 'optimized_route') || [];

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
                {/* Legend */}
                <div className="card mb-4">
                    <div className="card-body" style={{ padding: '12px 20px' }}>
                        <div className="flex gap-4 items-center flex-wrap">
                            <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Legend:</span>
                            <span style={{ fontSize: '0.8rem', color: '#00d4ff' }}>● Freshwater Source</span>
                            <span style={{ fontSize: '0.8rem', color: '#22c55e' }}>● Reuse Source</span>
                            <span style={{ fontSize: '0.8rem', color: '#f59e0b' }}>⊙ Water Sink</span>
                            <span style={{ fontSize: '0.8rem', color: '#00d4ff' }}>━ Optimized Route</span>
                            <span style={{ fontSize: '0.8rem', color: '#4a7a94' }}>╌ Network Connection</span>
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
                                {connections.map((f, i) => (
                                    <RoutePolyline key={`conn-${i}`} feature={f} isOptimized={false} />
                                ))}
                            </LayerGroup>

                            {/* Optimized routes */}
                            <LayerGroup>
                                {optimizedRoutes.map((f, i) => (
                                    <RoutePolyline key={`opt-${i}`} feature={f} isOptimized={true} />
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
