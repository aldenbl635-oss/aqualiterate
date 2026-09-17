import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import * as THREE from 'three';

// ─── Fixed Zone Layout ────────────────────────────────────────────────────────
// Deterministic grid regardless of sparse coordinates
// 4-quadrant isometric layout
const ZONE_SLOTS = [
    { offset: [-11, 0, -9], buildSize: [8, 5, 6], type: 'production' },
    { offset: [11, 0, -9], buildSize: [7, 4.5, 6], type: 'treatment' },
    { offset: [-11, 0, 9], buildSize: [7, 4, 6], type: 'storage' },
    { offset: [11, 0, 9], buildSize: [7, 4.5, 6], type: 'utility' },
];

const ZONE_PALETTE = {
    production: { wall: '#1a4a7a', emissive: '#0a2a4a', roof: '#0a1e30', accent: '#00aaff', win: '#44ccff', label: '#44ccff' },
    treatment: { wall: '#3a1a6a', emissive: '#200a40', roof: '#180828', accent: '#aa66ff', win: '#cc88ff', label: '#cc88ff' },
    storage: { wall: '#4a2a0a', emissive: '#2a1806', roof: '#201004', accent: '#ffaa00', win: '#ffcc44', label: '#ffcc44' },
    utility: { wall: '#0a4a2a', emissive: '#062a18', roof: '#041a0e', accent: '#00cc66', win: '#44ee88', label: '#44ee88' },
};

const FALLBACK_PALETTE = { wall: '#1a3e5e', emissive: '#0a2040', roof: '#081828', accent: '#00d4ff', win: '#44d4ff', label: '#44d4ff' };

function getSlot(index) {
    return ZONE_SLOTS[index % ZONE_SLOTS.length];
}

function getPalette(type) {
    return ZONE_PALETTE[type] || FALLBACK_PALETTE;
}

// ─── Building ─────────────────────────────────────────────────────────────────
function Building({ position, w, h, d, pal, label, onClick, isSelected }) {
    const ac = isSelected ? '#ffffff' : pal.accent;
    const wc = isSelected ? '#0a3a5a' : pal.wall;

    return (
        <group position={position} onClick={e => { e.stopPropagation(); onClick && onClick(); }}>
            {/* Foundation slab */}
            <mesh position={[0, 0.12, 0]}>
                <boxGeometry args={[w + 1, 0.24, d + 1]} />
                <meshLambertMaterial color="#020a10" />
            </mesh>

            {/* Main walls */}
            <mesh position={[0, h / 2 + 0.24, 0]}>
                <boxGeometry args={[w, h, d]} />
                <meshStandardMaterial color={wc} emissive={isSelected ? '#004488' : (pal.emissive || '#0a2040')} emissiveIntensity={0.6} roughness={0.7} metalness={0.2} />
            </mesh>

            {/* Flat roof */}
            <mesh position={[0, h + 0.38, 0]}>
                <boxGeometry args={[w + 0.5, 0.28, d + 0.5]} />
                <meshStandardMaterial color={pal.roof} roughness={0.9} />
            </mesh>

            {/* Roof accent stripe */}
            <mesh position={[0, h + 0.54, 0]}>
                <boxGeometry args={[w - 0.5, 0.12, 0.4]} />
                <meshLambertMaterial color={ac} emissive={ac} emissiveIntensity={0.8} />
            </mesh>

            {/* Windows front row */}
            {[-w / 3, 0, w / 3].map((wx, i) => (
                <mesh key={`wf${i}`} position={[wx, h * 0.55 + 0.24, d / 2 + 0.07]}>
                    <boxGeometry args={[w / 4.5, h * 0.22, 0.06]} />
                    <meshLambertMaterial color={pal.win} emissive={pal.win} emissiveIntensity={0.9} />
                </mesh>
            ))}

            {/* Windows side row */}
            {[-d / 3, d / 3].map((wz, i) => (
                <mesh key={`ws${i}`} position={[w / 2 + 0.07, h * 0.55 + 0.24, wz]}>
                    <boxGeometry args={[0.06, h * 0.2, d / 5]} />
                    <meshLambertMaterial color={pal.win} emissive={pal.win} emissiveIntensity={0.5} />
                </mesh>
            ))}

            {/* Lower window row front */}
            {[-w / 3 + (w / 6), w / 3 - (w / 6)].map((wx, i) => (
                <mesh key={`wl${i}`} position={[wx, h * 0.28 + 0.24, d / 2 + 0.07]}>
                    <boxGeometry args={[w / 6, h * 0.15, 0.06]} />
                    <meshLambertMaterial color={pal.win} emissive={pal.win} emissiveIntensity={0.4} />
                </mesh>
            ))}

            {/* Door */}
            <mesh position={[0, h * 0.18 + 0.24, d / 2 + 0.07]}>
                <boxGeometry args={[w / 5.5, h * 0.35, 0.06]} />
                <meshLambertMaterial color="#010508" />
            </mesh>

            {/* Glowing base strip */}
            <mesh position={[0, 0.26, 0]}>
                <boxGeometry args={[w + 1.05, 0.06, d + 1.05]} />
                <meshLambertMaterial color={ac} emissive={ac} emissiveIntensity={1.2} />
            </mesh>

            {/* Zone label */}
            <Html position={[0, h + 1.3, 0]} center style={{ pointerEvents: 'none' }}>
                <div style={{
                    background: 'rgba(1,6,14,0.92)',
                    border: `1px solid ${pal.label}`,
                    color: pal.label, padding: '3px 12px',
                    borderRadius: 4, fontSize: 11, fontWeight: 700,
                    whiteSpace: 'nowrap', letterSpacing: '0.07em',
                    textShadow: `0 0 10px ${pal.label}`,
                }}>
                    {label}
                </div>
            </Html>
        </group>
    );
}

// ─── Storage Tank ──────────────────────────────────────────────────────────────
function StorageTank({ position, color, label, onClick, isSelected }) {
    const c = isSelected ? '#ffffff' : color;
    return (
        <group position={position} onClick={e => { e.stopPropagation(); onClick && onClick(); }}>
            {/* 4 support legs */}
            {[[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]].map(([lx, lz], i) => (
                <mesh key={i} position={[lx, 0.55, lz]}>
                    <cylinderGeometry args={[0.09, 0.09, 1.1, 8]} />
                    <meshLambertMaterial color="#040e16" />
                </mesh>
            ))}
            {/* Tank cylinder */}
            <mesh position={[0, 2.0, 0]}>
                <cylinderGeometry args={[1.15, 1.15, 2.4, 24]} />
                <meshLambertMaterial color="#060e16" />
            </mesh>
            {/* Colour band */}
            <mesh position={[0, 2.1, 0]}>
                <cylinderGeometry args={[1.17, 1.17, 0.28, 24]} />
                <meshLambertMaterial color={c} emissive={c} emissiveIntensity={0.9} />
            </mesh>
            {/* Dome cap */}
            <mesh position={[0, 3.22, 0]}>
                <sphereGeometry args={[1.15, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
                <meshLambertMaterial color={color} emissive={color} emissiveIntensity={0.25} />
            </mesh>
            {/* Vent */}
            <mesh position={[0, 3.9, 0]}>
                <cylinderGeometry args={[0.13, 0.13, 0.65, 8]} />
                <meshLambertMaterial color={c} emissive={c} emissiveIntensity={0.6} />
            </mesh>
            {/* Label */}
            <Html position={[0, 4.7, 0]} center style={{ pointerEvents: 'none' }}>
                <div style={{
                    background: 'rgba(1,6,14,0.9)', border: `1px solid ${color}`,
                    color, padding: '2px 8px', borderRadius: 3, fontSize: 10,
                    whiteSpace: 'nowrap', textShadow: `0 0 6px ${color}`,
                }}>{label}</div>
            </Html>
        </group>
    );
}

// ─── Sink Node ─────────────────────────────────────────────────────────────────
function SinkNode({ position, label, onClick, isSelected }) {
    const c = isSelected ? '#ffffff' : '#f59e0b';
    return (
        <group position={position} onClick={e => { e.stopPropagation(); onClick && onClick(); }}>
            {/* Pedestal */}
            <mesh position={[0, 0.3, 0]}>
                <boxGeometry args={[2.2, 0.6, 2.2]} />
                <meshLambertMaterial color="#1a0e00" />
            </mesh>
            {/* Body */}
            <mesh position={[0, 1.15, 0]}>
                <boxGeometry args={[1.8, 1.2, 1.8]} />
                <meshLambertMaterial color="#240e00" />
            </mesh>
            {/* Glow lid */}
            <mesh position={[0, 1.82, 0]}>
                <boxGeometry args={[1.9, 0.12, 1.9]} />
                <meshLambertMaterial color={c} emissive={c} emissiveIntensity={1} />
            </mesh>
            {/* Down-arrow indicator */}
            <mesh position={[0, 0.95, 0]} rotation={[0, 0, Math.PI]}>
                <coneGeometry args={[0.38, 0.75, 8]} />
                <meshLambertMaterial color={c} emissive={c} emissiveIntensity={0.6} />
            </mesh>
            <Html position={[0, 2.5, 0]} center style={{ pointerEvents: 'none' }}>
                <div style={{
                    background: 'rgba(1,6,14,0.9)', border: '1px solid #f59e0b',
                    color: '#f59e0b', padding: '2px 8px', borderRadius: 3, fontSize: 10,
                    whiteSpace: 'nowrap', textShadow: '0 0 6px #f59e0b',
                }}>{label}</div>
            </Html>
        </group>
    );
}

// ─── Treatment Unit ────────────────────────────────────────────────────────────
function TreatmentUnit({ position, onClick, isSelected }) {
    const c = isSelected ? '#ffffff' : '#a855f7';
    return (
        <group position={position} onClick={e => { e.stopPropagation(); onClick && onClick(); }}>
            {/* Base */}
            <mesh position={[0, 0.15, 0]}>
                <boxGeometry args={[7, 0.3, 4.5]} />
                <meshLambertMaterial color="#060210" />
            </mesh>
            {/* Main block */}
            <mesh position={[0, 1.5, 0]}>
                <boxGeometry args={[6, 3, 4]} />
                <meshLambertMaterial color="#120430" />
            </mesh>
            {/* 3 filter vessels on top */}
            {[-1.8, 0, 1.8].map((tx, i) => (
                <group key={i} position={[tx, 3.2, 0]}>
                    <mesh>
                        <cylinderGeometry args={[0.6, 0.6, 1.2, 16]} />
                        <meshLambertMaterial color="#200850" />
                    </mesh>
                    <mesh position={[0, 0.68, 0]}>
                        <cylinderGeometry args={[0.62, 0.62, 0.1, 16]} />
                        <meshLambertMaterial color={c} emissive={c} emissiveIntensity={1.2} />
                    </mesh>
                </group>
            ))}
            {/* Horizontal header pipe connecting vessels */}
            <mesh position={[0, 3.85, 0]}>
                <boxGeometry args={[4.2, 0.16, 0.16]} />
                <meshLambertMaterial color={c} emissive={c} emissiveIntensity={0.8} />
            </mesh>
            {/* Control panel */}
            <mesh position={[0, 1.6, 2.05]}>
                <boxGeometry args={[3, 1.4, 0.06]} />
                <meshLambertMaterial color="#2a0a64" emissive="#6030c0" emissiveIntensity={0.3} />
            </mesh>
            {/* Glow strip on edge */}
            <mesh position={[0, 0.31, 0]}>
                <boxGeometry args={[7.05, 0.06, 4.55]} />
                <meshLambertMaterial color={c} emissive={c} emissiveIntensity={1} />
            </mesh>
            <Html position={[0, 5.2, 0]} center style={{ pointerEvents: 'none' }}>
                <div style={{
                    background: 'rgba(1,6,14,0.9)', border: '1px solid #a855f7',
                    color: '#c084fc', padding: '3px 10px', borderRadius: 3, fontSize: 10,
                    whiteSpace: 'nowrap', textShadow: '0 0 8px #a855f7', fontWeight: 700,
                }}>ETP — Treatment Unit</div>
            </Html>
        </group>
    );
}

// ─── Water Pipe (TubeGeometry) ─────────────────────────────────────────────────
function WaterPipe({ points, isOptimized, isRecovery, isSelected, onClick }) {
    let color = '#0a3050';
    let emissive = '#000000';
    let emissiveIntensity = 0;
    const radius = (isOptimized || isRecovery) ? 0.22 : 0.12;

    if (isSelected) {
        color = '#ffffff'; emissive = '#ffffff'; emissiveIntensity = 1;
    } else if (isOptimized) {
        color = '#00d4ff'; emissive = '#00d4ff'; emissiveIntensity = 0.55;
    } else if (isRecovery) {
        color = '#22c55e'; emissive = '#22c55e'; emissiveIntensity = 0.55;
    }

    const geometry = useMemo(() => {
        const curve = new THREE.CatmullRomCurve3(points.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
        return new THREE.TubeGeometry(curve, 28, radius, 8, false);
    }, [points, radius]);

    useEffect(() => () => geometry.dispose(), [geometry]);

    return (
        <mesh geometry={geometry} onClick={e => { e.stopPropagation(); onClick && onClick(); }}>
            <meshLambertMaterial
                color={color}
                emissive={emissive}
                emissiveIntensity={emissiveIntensity}
            />
        </mesh>
    );
}

// ─── Pipe Connector (vertical drop from pipe to ground level) ─────────────────
function PipeConnector({ x, z, fromY, toY }) {
    const cy = (fromY + toY) / 2;
    const h = Math.abs(fromY - toY);
    return (
        <mesh position={[x, cy, z]}>
            <cylinderGeometry args={[0.12, 0.12, h, 8]} />
            <meshLambertMaterial color="#0a3050" />
        </mesh>
    );
}

// ─── Flow Particle ────────────────────────────────────────────────────────────
function FlowParticle({ points, offset, color }) {
    const ref = useRef();
    const tRef = useRef(offset);
    const curve = useMemo(
        () => new THREE.CatmullRomCurve3(points.map(([x, y, z]) => new THREE.Vector3(x, y, z))),
        [points]
    );
    useFrame((_, dt) => {
        tRef.current = (tRef.current + dt * 0.3) % 1;
        if (ref.current) ref.current.position.copy(curve.getPoint(tRef.current));
    });
    return (
        <mesh ref={ref}>
            <sphereGeometry args={[0.25, 8, 8]} />
            <meshLambertMaterial color={color} emissive={color} emissiveIntensity={2.5} />
        </mesh>
    );
}

// ─── Ground ───────────────────────────────────────────────────────────────────
function Ground() {
    return (
        <>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
                <planeGeometry args={[60, 60]} />
                <meshStandardMaterial color="#010c18" roughness={1} />
            </mesh>
            <gridHelper args={[60, 30, '#0a2535', '#061520']} position={[0, 0.01, 0]} />
            {/* Site boundary */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
                <ringGeometry args={[27, 28, 64]} />
                <meshBasicMaterial color="#00d4ff" transparent opacity={0.2} />
            </mesh>
            {/* Corner markers */}
            {[[-25, -25], [25, -25], [-25, 25], [25, 25]].map(([x, z], i) => (
                <mesh key={i} position={[x, 0.6, z]}>
                    <boxGeometry args={[1.2, 1.2, 1.2]} />
                    <meshStandardMaterial color="#00d4ff" emissive="#00d4ff" emissiveIntensity={1.5} />
                </mesh>
            ))}
        </>
    );
}

// ─── Camera ───────────────────────────────────────────────────────────────────
function CameraController({ resetKey }) {
    const { camera } = useThree();
    const ctrlRef = useRef();
    useEffect(() => {
        camera.position.set(20, 22, 20);
        camera.lookAt(0, 2, 0);
    }, []);
    useEffect(() => {
        if (resetKey > 0) {
            camera.position.set(20, 22, 20);
            if (ctrlRef.current) ctrlRef.current.target.set(0, 2, 0);
        }
    }, [resetKey]);
    return <OrbitControls ref={ctrlRef} makeDefault maxPolarAngle={Math.PI / 2 - 0.04} />;
}

// ─── Scene Content  ────────────────────────────────────────────────────────────
function SceneContent({ sources, sinks, connections, optimizedRoutes, recoveryEdges = [], onSelect, resetKey }) {
    const [sel, setSel] = useState(null);

    const select = (data) => { setSel(data); onSelect(data); };

    // ── Assign each unique zone a fixed slot ──────────────────────────────────
    const zoneNames = useMemo(() => {
        const names = new Set();
        [...sources, ...sinks].forEach(f => {
            const n = f.properties.zone_name || f.properties.zone || 'Site';
            names.add(n);
        });
        return Array.from(names);
    }, [sources, sinks]);

    const zoneMap = useMemo(() => {
        const m = {};
        zoneNames.forEach((name, i) => { m[name] = i; });
        return m;
    }, [zoneNames]);

    // ── Position each source/sink around its zone slot ────────────────────────
    const getSrcPos = (feature, idx) => {
        const zoneName = feature.properties.zone_name || feature.properties.zone || 'Site';
        const slotIdx = zoneMap[zoneName] ?? (idx % ZONE_SLOTS.length);
        const slot = ZONE_SLOTS[slotIdx % ZONE_SLOTS.length];
        // Fan out tanks at fixed offsets beside the building
        const offsets = [[-5, 0], [-5, 4], [-5, -4], [-9, 0], [-9, 4]];
        const [ox, oz] = offsets[idx % offsets.length];
        return [slot.offset[0] + ox, 0, slot.offset[2] + oz];
    };

    const getSnkPos = (feature, idx) => {
        const zoneName = feature.properties.zone_name || feature.properties.zone || 'Site';
        // Sinks go on the opposite side of zone buildings (right side)
        const slotIdx = (zoneMap[zoneName] ?? idx) % ZONE_SLOTS.length;
        const slot = ZONE_SLOTS[(slotIdx + 2) % ZONE_SLOTS.length];
        const offsets = [[5, 0], [5, 4], [5, -4], [9, 0], [9, 4]];
        const [ox, oz] = offsets[idx % offsets.length];
        return [slot.offset[0] + ox, 0, slot.offset[2] + oz];
    };

    const srcPositions = useMemo(() => sources.map((s, i) => getSrcPos(s, i)), [sources, zoneMap]);
    const snkPositions = useMemo(() => sinks.map((s, i) => getSnkPos(s, i)), [sinks, zoneMap]);

    // ── Treatment unit in the centre ─────────────────────────────────────────
    const treatPos = [0, 0, 0];

    // ── Build pipe routes (L-shaped, elevated) ─────────────────────────────
    const PIPE_Y = 2.2;
    const OPT_Y = 3.0;

    const allPipes = useMemo(() => {
        const pipes = [];

        // Source → treatment centre
        sources.forEach((_, i) => {
            const [sx, , sz] = srcPositions[i];
            const [tx, , tz] = treatPos;
            const y = PIPE_Y;
            pipes.push({
                points: [[sx, y, sz], [sx, y, tz], [tx, y, tz]],
                optimized: false,
                data: { properties: { from: sources[i].properties.name, to: 'ETP Treatment', type: 'pipe', route_type: 'network' } },
            });
        });

        // Treatment centre → sinks
        sinks.forEach((_, i) => {
            const [tx, , tz] = treatPos;
            const [ex, , ez] = snkPositions[i];
            const y = PIPE_Y;
            pipes.push({
                points: [[tx, y, tz], [ex, y, tz], [ex, y, ez]],
                optimized: false,
                data: { properties: { from: 'ETP Treatment', to: sinks[i].properties.name, type: 'pipe', route_type: 'network' } },
            });
        });

        // Overlay optimized routes (bright, elevated higher)
        optimizedRoutes.forEach((r, i) => {
            // Pick source/sink indices by name matching
            const fromName = r.properties.source_name || r.properties.from;
            const toName = r.properties.sink_name || r.properties.to;
            const si = sources.findIndex(s => s.properties.name === fromName);
            const ki = sinks.findIndex(s => s.properties.name === toName);
            const [sx, , sz] = si >= 0 ? srcPositions[si] : srcPositions[i % Math.max(srcPositions.length, 1)];
            const [ex, , ez] = ki >= 0 ? snkPositions[ki] : snkPositions[i % Math.max(snkPositions.length, 1)];
            const y = OPT_Y;

            // Go via central treatment if treatment is required, otherwise L-shape
            const pts = r.properties.treatment_required
                ? [[sx, y, sz], [0, y, sz], [0, y, 0], [0, y, ez], [ex, y, ez]]
                : [[sx, y, sz], [sx, y, ez], [ex, y, ez]];

            pipes.push({
                points: pts,
                optimized: true,
                recovery: false,
                data: r,
            });
        });

        // Overlay recovery edges (green, elevated)
        recoveryEdges.forEach((r, i) => {
            const p = r.properties;
            const kIdx = sinks.findIndex(s => s.properties.id === p.id);
            const sIdx = sources.findIndex(s => s.properties.id === p.recovery_source);

            if (kIdx >= 0 && sIdx >= 0) {
                const [kx, , kz] = snkPositions[kIdx];
                const [sx, , sz] = srcPositions[sIdx];
                const y = OPT_Y + 0.5; // elevate recovery slightly higher

                pipes.push({
                    points: [[kx, y, kz], [sx, y, kz], [sx, y, sz]], // L shape from sink back to source
                    optimized: false,
                    recovery: true,
                    data: { properties: Object.assign({}, p, { type: 'recovery_route', from: p.name, to: "Recovery Source" }) }
                });
            }
        });

        return pipes;
    }, [sources, sinks, srcPositions, snkPositions, optimizedRoutes, recoveryEdges]);

    return (
        <>
            {/* Lighting */}
            <ambientLight intensity={1.2} />
            <directionalLight position={[12, 20, 12]} intensity={1.5} color="#c0ddf0" />
            <directionalLight position={[-10, 15, -8]} intensity={0.8} color="#8090cc" />
            <pointLight position={[0, 14, 0]} intensity={2.0} color="#00d4ff" distance={60} decay={1.5} />
            <pointLight position={[-10, 8, 10]} intensity={1.0} color="#aa55ff" distance={35} decay={1.5} />

            <CameraController resetKey={resetKey} />
            <Ground />

            {/* ── Zone buildings ─────────────────────────────────────────────────── */}
            {zoneNames.map((zoneName, i) => {
                const slot = ZONE_SLOTS[i % ZONE_SLOTS.length];
                const [w, h, d] = slot.buildSize;
                const pal = getPalette(slot.type);
                return (
                    <Building
                        key={zoneName}
                        position={slot.offset}
                        w={w} h={h} d={d}
                        pal={pal}
                        label={zoneName}
                        isSelected={sel && sel._zone === zoneName}
                        onClick={() => select({ _zone: zoneName, properties: { name: zoneName, type: 'zone' } })}
                    />
                );
            })}
            {/* Extra building detail beside large zones */}
            {zoneNames.length >= 1 && (
                <mesh position={[ZONE_SLOTS[0].offset[0] + 7, 2.1, ZONE_SLOTS[0].offset[2] - 2]}>
                    <boxGeometry args={[3.5, 4.2, 3]} />
                    <meshLambertMaterial color="#071828" />
                </mesh>
            )}

            {/* ── Treatment unit ────────────────────────────────────────────────── */}
            <TreatmentUnit
                position={treatPos}
                isSelected={sel && sel._type === 'treatment'}
                onClick={() => select({ _type: 'treatment', properties: { name: 'ETP Treatment Unit', type: 'treatment', status: 'Active' } })}
            />

            {/* ── Source tanks ──────────────────────────────────────────────────── */}
            {sources.map((src, i) => {
                const [x, , z] = srcPositions[i];
                const fresh = src.properties.is_freshwater;
                const col = fresh ? '#00d4ff' : '#22c55e';
                return (
                    <StorageTank
                        key={`src-${i}`}
                        position={[x, 0, z]}
                        color={col}
                        label={src.properties.name}
                        isSelected={sel && sel._srcIdx === i}
                        onClick={() => select({ ...src, _srcIdx: i })}
                    />
                );
            })}

            {/* ── Sink nodes ────────────────────────────────────────────────────── */}
            {sinks.map((snk, i) => {
                const [x, , z] = snkPositions[i];
                return (
                    <SinkNode
                        key={`snk-${i}`}
                        position={[x, 0, z]}
                        label={snk.properties.name}
                        isSelected={sel && sel._snkIdx === i}
                        onClick={() => select({ ...snk, _snkIdx: i })}
                    />
                );
            })}

            {/* ── Pipe verticle connectors at nodes (visual polish) ────────────── */}
            {srcPositions.map(([x, , z], i) => (
                <PipeConnector key={`svc-${i}`} x={x} z={z} fromY={3.9} toY={PIPE_Y} />
            ))}
            {snkPositions.map(([x, , z], i) => (
                <PipeConnector key={`dvc-${i}`} x={x} z={z} fromY={1.82} toY={PIPE_Y} />
            ))}

            {/* ── Pipes ─────────────────────────────────────────────────────────── */}
            {allPipes.map((p, i) => (
                <WaterPipe
                    key={`pipe-${i}`}
                    points={p.points}
                    isOptimized={p.optimized}
                    isSelected={sel && sel._pipeIdx === i}
                    onClick={() => select({ ...p.data, _pipeIdx: i })}
                />
            ))}

            {/* ── Flow particles on active pipes (optimized supply or recovery) ────── */}
            {allPipes
                .filter(p => p.optimized || p.recovery)
                .map((p, i) =>
                    [0, 0.33, 0.66].map(off => {
                        const col = p.recovery ? '#22c55e' : '#00d4ff';
                        return <FlowParticle key={`fp-${i}-${off}`} points={p.points} offset={off} color={col} />;
                    })
                )}
            {/* Minimal ambient flow on inactive network pipes */}
            {allPipes
                .filter(p => !p.optimized && !p.recovery)
                .slice(0, 2)
                .map((p, i) => (
                    <FlowParticle key={`fb-${i}`} points={p.points} offset={i * 0.5} color="#4a7a94" />
                ))}
        </>
    );
}

// ─── Info Panel ───────────────────────────────────────────────────────────────
function InfoPanel({ selected, sources, sinks, optimizedRoutes }) {
    const s = selected;
    return (
        <div style={{
            width: 280, background: '#030c16',
            borderLeft: '1px solid #0a3050',
            display: 'flex', flexDirection: 'column',
        }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #0a2a40', background: '#040f1c' }}>
                <div style={{ fontSize: 10, color: '#3a6a84', letterSpacing: '0.1em', fontWeight: 700 }}>
                    {s ? 'SELECTED' : 'SITE OVERVIEW'}
                </div>
                {s && (
                    <div style={{ marginTop: 3, fontSize: 13, color: '#00d4ff', fontWeight: 600 }}>
                        {s.properties?.name || '—'}
                    </div>
                )}
            </div>
            <div style={{ padding: 14, overflowY: 'auto', flex: 1, fontSize: 12 }}>
                {!s ? (
                    <>
                        {[
                            ['Active Sources', sources.length, '#00d4ff'],
                            ['Active Sinks', sinks.length, '#f59e0b'],
                            ['Optimized Routes', optimizedRoutes.length, '#a855f7'],
                            ['Network Status', optimizedRoutes.length > 0 ? 'OPTIMIZED' : 'STANDARD', '#22c55e'],
                        ].map(([k, v, col]) => (
                            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #081828' }}>
                                <span style={{ color: '#3a6a84' }}>{k}</span>
                                <span style={{ color: col, fontWeight: 600 }}>{v}</span>
                            </div>
                        ))}
                        <div style={{ marginTop: 14, color: '#2a5a74', fontSize: 11, lineHeight: 1.6 }}>
                            Click any building, tank, sink or pipe to inspect live data from the API.
                        </div>
                    </>
                ) : (
                    <>
                        {s.properties && Object.entries(s.properties)
                            .filter(([k]) => !['id', 'feature_type', 'type'].includes(k))
                            .map(([k, v]) => (
                                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid #081828' }}>
                                    <span style={{ color: '#3a6a84', textTransform: 'capitalize' }}>{k.replace(/_/g, ' ')}</span>
                                    <span style={{ color: '#b0d4e8', maxWidth: 130, textAlign: 'right', wordBreak: 'break-word' }}>
                                        {v === null ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v)}
                                    </span>
                                </div>
                            ))}
                    </>
                )}
            </div>
        </div>
    );
}

// ─── Legend ───────────────────────────────────────────────────────────────────
function Legend() {
    return (
        <div style={{
            position: 'absolute', bottom: 12, left: 12,
            background: 'rgba(1,6,14,0.92)', border: '1px solid #0a2a40',
            borderRadius: 6, padding: '8px 12px',
            display: 'flex', flexWrap: 'wrap', gap: '4px 14px', maxWidth: 400,
        }}>
            {[
                ['#00d4ff', '● Freshwater Tank'],
                ['#22c55e', '● Reuse Tank'],
                ['#f59e0b', '▼ Water Sink'],
                ['#a855f7', '■ Treatment Unit'],
                ['#00d4ff', '━ Optimized Pipe'],
                ['#0a3050', '╌ Network Pipe'],
            ].map(([c, l]) => (
                <span key={l} style={{ fontSize: 10, color: c, whiteSpace: 'nowrap' }}>{l}</span>
            ))}
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function DigitalTwinView({ sources, sinks, connections, optimizedRoutes }) {
    const [selected, setSelected] = useState(null);
    const [resetKey, setResetKey] = useState(0);

    return (
        <div style={{
            display: 'flex', height: '72vh', width: '100%',
            border: '1px solid #0a2a40', borderRadius: 6,
            overflow: 'hidden', background: '#010810', position: 'relative',
        }}>
            {/* 3-D scene */}
            <div style={{ flex: 1, position: 'relative' }}>
                <Canvas camera={{ fov: 38, near: 0.3, far: 400 }} shadows>
                    <SceneContent
                        sources={sources} sinks={sinks}
                        connections={connections} optimizedRoutes={optimizedRoutes}
                        onSelect={setSelected} resetKey={resetKey}
                    />
                </Canvas>

                <Legend />

                {/* Camera buttons */}
                <div style={{ position: 'absolute', top: 12, right: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {['Reset View', 'Fit Site'].map(label => (
                        <button key={label} onClick={() => setResetKey(k => k + 1)} style={{
                            padding: '7px 14px', background: 'rgba(1,8,20,0.92)',
                            border: '1px solid #0a3050', color: '#3a7a94',
                            borderRadius: 4, cursor: 'pointer', fontSize: 11, letterSpacing: '0.05em',
                        }}>{label}</button>
                    ))}
                </div>

                <div style={{
                    position: 'absolute', bottom: 12, right: 12,
                    color: '#1a4a60', fontSize: 10,
                    background: 'rgba(1,6,14,0.75)', padding: '3px 8px', borderRadius: 3,
                }}>
                    Drag to orbit · Scroll to zoom · Click to select
                </div>
            </div>

            {/* Info panel */}
            <InfoPanel
                selected={selected}
                sources={sources} sinks={sinks}
                optimizedRoutes={optimizedRoutes}
            />
        </div>
    );
}
