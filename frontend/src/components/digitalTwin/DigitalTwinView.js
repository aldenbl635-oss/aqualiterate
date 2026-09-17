import React, { useState, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Html, Line, Sphere, Box } from '@react-three/drei';

function NodeMarker({ position, color, data, onClick, isSelected, typeLabel }) {
    return (
        <group position={position}>
            <Sphere args={[0.5, 32, 32]} onClick={(e) => { e.stopPropagation(); onClick(data); }}>
                <meshStandardMaterial color={isSelected ? '#ffffff' : color} emissive={color} emissiveIntensity={isSelected ? 2 : 0.8} />
            </Sphere>
            <Html position={[0, 1, 0]} center style={{ pointerEvents: 'none' }}>
                <div style={{
                    background: 'rgba(5, 20, 35, 0.85)', padding: '4px 8px', borderRadius: '4px',
                    border: `1px solid ${color}`, color: '#fff', fontSize: '10px', whiteSpace: 'nowrap',
                    textShadow: '0 0 5px rgba(0,0,0,1)'
                }}>
                    <div style={{ color: typeLabel === 'Sink' ? '#f59e0b' : '#00d4ff', fontSize: '8px', marginBottom: '2px', fontWeight: 'bold' }}>
                        {typeLabel.toUpperCase()}
                    </div>
                    {data.properties.name}
                </div>
            </Html>
        </group>
    );
}

function ConnectionLine({ start, end, isOptimized, data, onClick, isSelected }) {
    const color = isOptimized ? '#00d4ff' : '#4a7a94';
    const linewidth = isOptimized ? (isSelected ? 5 : 3) : 1;

    return (
        <group onClick={(e) => { e.stopPropagation(); onClick(data); }}>
            <Line
                points={[start, end]}
                color={isSelected ? '#ffffff' : color}
                lineWidth={linewidth}
                dashed={!isOptimized}
                dashSize={1}
                gapSize={0.5}
            />
        </group>
    );
}

function DigitalTwinScene({ sources, sinks, connections, optimizedRoutes, onSelect }) {
    // Generate deterministic 3D positions based on existing lat/lng logic
    // We'll normalize coordinates around a center point so they fit nicely in 3D space
    const allFeatures = [...sources, ...sinks];
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;

    allFeatures.forEach(f => {
        if (f.geometry && f.geometry.coordinates) {
            const x = f.geometry.coordinates[0];
            const z = f.geometry.coordinates[1];
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (z < minZ) minZ = z;
            if (z > maxZ) maxZ = z;
        }
    });

    const scale = 5000; // rough scale factor for coordinate degrees to 3D units

    const getPos = (f, yOffset = 0) => {
        if (!f.geometry || !f.geometry.coordinates) return [0, yOffset, 0];
        const x = (f.geometry.coordinates[0] - minX) * scale - ((maxX - minX) * scale / 2);
        const z = -((f.geometry.coordinates[1] - minZ) * scale - ((maxZ - minZ) * scale / 2));
        return [x, yOffset, z];
    };

    const nodeDict = {};
    sources.forEach(s => {
        nodeDict[s.properties.name] = getPos(s, 1.5);
    });
    sinks.forEach(s => {
        nodeDict[s.properties.name] = getPos(s, 1.0);
    });

    return (
        <>
            <ambientLight intensity={0.4} />
            <pointLight position={[10, 20, 10]} intensity={1.5} color="#00d4ff" />

            {/* Grid layout */}
            <gridHelper args={[100, 50, '#103040', '#0a1a2a']} position={[0, -0.1, 0]} />

            {/* Simulated Zones via abstract bounding boxes */}
            <Box args={[12, 0.2, 12]} position={[-6, -0.05, -6]}>
                <meshBasicMaterial color="#0c1d29" opacity={0.6} transparent />
            </Box>
            <Box args={[14, 0.2, 10]} position={[8, -0.05, 5]}>
                <meshBasicMaterial color="#0c1d29" opacity={0.6} transparent />
            </Box>

            {/* Render Connections */}
            {connections.map((c, i) => {
                const coords = c.geometry?.coordinates;
                if (!coords || coords.length < 2) return null;
                const startNode = sources.find(s => Math.abs(s.geometry.coordinates[0] - coords[0][0]) < 0.0001);
                const endNode = sinks.find(s => Math.abs(s.geometry.coordinates[0] - coords[1][0]) < 0.0001);

                const start = startNode ? getPos(startNode, 1) : [(coords[0][0] - minX) * scale, 0, -(coords[0][1] - minZ) * scale];
                const end = endNode ? getPos(endNode, 1) : [(coords[1][0] - minX) * scale, 0, -(coords[1][1] - minZ) * scale];

                return <ConnectionLine key={`conn-${i}`} start={start} end={end} isOptimized={false} data={c} onClick={onSelect} />;
            })}

            {/* Render Optimized Routes */}
            {optimizedRoutes.map((c, i) => {
                const coords = c.geometry?.coordinates;
                if (!coords || coords.length < 2) return null;
                const start = [(coords[0][0] - minX) * scale - ((maxX - minX) * scale / 2), 1, -((coords[0][1] - minZ) * scale - ((maxZ - minZ) * scale / 2))];
                const end = [(coords[1][0] - minX) * scale - ((maxX - minX) * scale / 2), 1, -((coords[1][1] - minZ) * scale - ((maxZ - minZ) * scale / 2))];

                return <ConnectionLine key={`opt-${i}`} start={start} end={end} isOptimized={true} data={c} onClick={onSelect} />;
            })}

            {/* Render Nodes */}
            {sources.map((s, i) => (
                <NodeMarker key={`src-${i}`} position={getPos(s, 1.5)} color={s.properties.is_freshwater ? '#00d4ff' : '#22c55e'} typeLabel="Source" data={s} onClick={onSelect} />
            ))}
            {sinks.map((s, i) => (
                <NodeMarker key={`snk-${i}`} position={getPos(s, 1.0)} color="#f59e0b" typeLabel="Sink" data={s} onClick={onSelect} />
            ))}
        </>
    );
}

export default function DigitalTwinView({ sources, sinks, connections, optimizedRoutes }) {
    const [selectedObject, setSelectedObject] = useState(null);

    return (
        <div style={{ display: 'flex', height: '68vh', width: '100%', border: '1px solid var(--color-border)', borderRadius: '6px', overflow: 'hidden', background: '#020a12' }}>
            {/* 3D Viewport */}
            <div style={{ flex: 1, position: 'relative' }}>
                <Canvas camera={{ position: [20, 20, 20], fov: 45 }}>
                    <OrbitControls makeDefault maxPolarAngle={Math.PI / 2 - 0.05} />
                    <DigitalTwinScene
                        sources={sources}
                        sinks={sinks}
                        connections={connections}
                        optimizedRoutes={optimizedRoutes}
                        onSelect={setSelectedObject}
                    />
                </Canvas>
                <div style={{ position: 'absolute', bottom: 10, left: 10, color: 'rgba(255,255,255,0.7)', fontSize: '11px', background: 'rgba(0,0,0,0.5)', padding: '4px 8px', borderRadius: '4px' }}>
                    Tip: Click & Drag to Orbit. Scroll to Zoom. Click nodes for details.
                </div>
            </div>

            {/* Info Panel */}
            <div style={{ width: '320px', background: 'var(--color-bg-panel)', borderLeft: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '16px', borderBottom: '1px solid var(--color-border)' }}>
                    <h3 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--color-text)' }}>
                        {selectedObject ? 'SELECTION DETAILS' : 'SITE OVERVIEW'}
                    </h3>
                </div>

                <div style={{ padding: '16px', overflowY: 'auto', flex: 1 }}>
                    {!selectedObject ? (
                        <div>
                            <div className="mb-4">
                                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Topology</div>
                                <div style={{ color: 'var(--color-text)' }}>Sources: <span style={{ color: '#00d4ff' }}>{sources.length}</span></div>
                                <div style={{ color: 'var(--color-text)' }}>Sinks: <span style={{ color: '#f59e0b' }}>{sinks.length}</span></div>
                                <div style={{ color: 'var(--color-text)' }}>Total Connections: {connections.length}</div>
                            </div>
                            <div className="mb-4">
                                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Optimization Status</div>
                                <div>
                                    {optimizedRoutes.length > 0 ? (
                                        <span className="badge badge-blue">Optimized ({optimizedRoutes.length} active routes)</span>
                                    ) : (
                                        <span className="badge badge-muted">Standard Network</span>
                                    )}
                                </div>
                            </div>
                            <div>
                                <em style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                                    Select any node or highlighted route on the 3D map for detailed live API metrics.
                                </em>
                            </div>
                        </div>
                    ) : (
                        <div>
                            <div className="flex gap-2 items-center mb-3">
                                <span className={`badge ${selectedObject.properties.type === 'source' ? (selectedObject.properties.is_freshwater ? 'badge-blue' : 'badge-green') : selectedObject.properties.type === 'sink' ? 'badge-amber' : 'badge-blue'}`}>
                                    {selectedObject.properties.type.toUpperCase()}
                                </span>
                            </div>
                            <h4 style={{ margin: '0 0 12px 0', color: 'var(--color-primary-light)' }}>
                                {selectedObject.properties.name || 'Network Route'}
                            </h4>

                            <table style={{ width: '100%', fontSize: '0.85rem' }}>
                                <tbody>
                                    {Object.entries(selectedObject.properties).map(([key, value]) => {
                                        if (['type', 'name'].includes(key)) return null;
                                        return (
                                            <tr key={key} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                                <td style={{ color: 'var(--color-text-muted)', padding: '6px 0', textTransform: 'capitalize' }}>
                                                    {key.replace(/_/g, ' ')}
                                                </td>
                                                <td style={{ textAlign: 'right', color: 'var(--color-text)' }}>
                                                    {value !== null && typeof value === 'object' ? JSON.stringify(value) : String(value)}
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                            <button
                                className="btn btn-secondary btn-sm mt-4 w-100"
                                onClick={() => setSelectedObject(null)}
                            >
                                Clear Selection
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
