import React, { useState, useRef, useEffect } from 'react';

const OrthogonalEdge = ({ sourceNode, targetNode }) => {
    if (!sourceNode || !targetNode) return null;

    // Use exact x, y from nodes, fall back to bbox center if missing
    const getPos = (n) => {
        if (n.x && n.y) return { x: n.x, y: n.y };
        if (n.bbox && n.bbox.length === 4) return { x: (n.bbox[0] + n.bbox[2]) / 2, y: (n.bbox[1] + n.bbox[3]) / 2 };
        return { x: 0, y: 0 };
    };

    const sPos = getPos(sourceNode);
    const tPos = getPos(targetNode);

    const sx = sPos.x;
    const sy = sPos.y;
    const tx = tPos.x;
    const ty = tPos.y;

    const midX = (sx + tx) / 2;
    const d = `M ${sx} ${sy} L ${midX} ${sy} L ${midX} ${ty} L ${tx} ${ty}`;

    return (
        <path d={d} fill="none" stroke="#2563eb" strokeWidth="4" markerEnd="url(#arrow)" />
    );
};

const SymbolNode = ({ node, onClick, selected }) => {
    const isPump = node.subtype === 'Pump';
    const isTank = node.subtype === 'Tank';
    const isValve = node.subtype === 'Valve';

    // Position using extracted values
    let x = node.x || 0;
    let y = node.y || 0;
    if (node.bbox && node.bbox.length === 4 && !node.x) {
        x = (node.bbox[0] + node.bbox[2]) / 2;
        y = (node.bbox[1] + node.bbox[3]) / 2;
    }

    return (
        <g transform={`translate(${x}, ${y})`} onClick={(e) => { e.stopPropagation(); onClick && onClick(node); }} style={{ cursor: 'pointer' }}>
            {selected && <circle r="55" fill="rgba(8, 112, 184, 0.3)" />}

            {isPump && (
                <g>
                    <circle r="30" fill="#f8fafc" stroke="#334155" strokeWidth="3" />
                    <path d="M 0 -30 L 30 0 L 0 30 Z" fill="#334155" />
                </g>
            )}
            {isTank && (
                <rect x="-35" y="-45" width="70" height="90" rx="8" fill="#f8fafc" stroke="#334155" strokeWidth="3" />
            )}
            {isValve && (
                <path d="M -20 -20 L 20 20 L 20 -20 L -20 20 Z" fill="#f8fafc" stroke="#334155" strokeWidth="3" />
            )}
            {!isPump && !isTank && !isValve && (
                <circle r="25" fill="#f8fafc" stroke="#334155" strokeWidth="3" />
            )}

            <rect x="-40" y="38" width="80" height="18" fill="rgba(255,255,255,0.8)" rx="4" />
            <text y="50" textAnchor="middle" fontSize="14" fill="#1e293b" fontWeight="bold">{node.label}</text>

            <rect x="-40" y="58" width="80" height="15" fill="rgba(255,255,255,0.8)" rx="4" />
            <text y="70" textAnchor="middle" fontSize="12" fill="#64748b">{node.subtype}</text>
        </g>
    );
};

const PIDRenderer = ({ nodes = [], edges = [], sourceImage = null, onNodeClick }) => {
    const [selectedId, setSelectedId] = useState(null);
    const [viewMode, setViewMode] = useState('original'); // Start with original to see image
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [imgDims, setImgDims] = useState({ width: 2000, height: 1200 }); // Default, updated on load
    const containerRef = useRef(null);
    const svgRef = useRef(null);

    const handleNodeClick = (node) => {
        setSelectedId(node.id);
        if (onNodeClick) onNodeClick(node);
    };

    const handleWheel = (e) => {
        e.preventDefault();
        const scaleAdjust = e.deltaY > 0 ? 0.9 : 1.1;
        setZoom(z => Math.min(Math.max(0.1, z * scaleAdjust), 5));
    };

    const handleMouseDown = (e) => {
        setIsDragging(true);
        setDragStart({ x: e.clientX, y: e.clientY });
    };

    const handleMouseMove = (e) => {
        if (!isDragging) return;
        setPan(p => ({
            x: p.x + (e.clientX - dragStart.x),
            y: p.y + (e.clientY - dragStart.y)
        }));
        setDragStart({ x: e.clientX, y: e.clientY });
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    const handleFitScreen = () => {
        if (!containerRef.current) return;
        const containerWidth = containerRef.current.clientWidth;
        const containerHeight = containerRef.current.clientHeight;

        const scale = Math.min(
            containerWidth / imgDims.width,
            containerHeight / imgDims.height
        );

        setZoom(scale * 0.95); // 95% to leave a tiny padding
        setPan({
            x: (containerWidth - (imgDims.width * scale * 0.95)) / 2,
            y: (containerHeight - (imgDims.height * scale * 0.95)) / 2
        });
    };

    // Auto-fit when dimensions load
    useEffect(() => {
        handleFitScreen();
    }, [imgDims.width, imgDims.height]);

    // Ensure we parse missing nodes nicely
    const safeNodes = (nodes || []).filter(n => n.id);
    const safeEdges = (edges || []).filter(e => e.source && e.target);

    return (
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '10px', background: '#e2e8f0', borderBottom: '1px solid #cbd5e1', display: 'flex', gap: '10px', alignItems: 'center' }}>
                <button onClick={() => setViewMode('original')} className={`btn ${viewMode === 'original' ? 'btn-primary' : 'btn-outline'}`}>
                    📷 Original Image
                </button>
                <button onClick={() => setViewMode('reconstructed')} className={`btn ${viewMode === 'reconstructed' ? 'btn-primary' : 'btn-outline'}`}>
                    🛠️ P&ID Reconstructed Vector
                </button>
                <div style={{ flex: 1 }} />
                <button onClick={() => setZoom(z => z * 1.2)} className="btn btn-outline">+</button>
                <button onClick={() => setZoom(z => z * 0.8)} className="btn btn-outline">-</button>
                <button onClick={handleFitScreen} className="btn btn-outline">Fit Screen</button>
                <span style={{ fontSize: '12px', color: '#64748b' }}>Zoom: {Math.round(zoom * 100)}%</span>
            </div>

            <div
                ref={containerRef}
                style={{ flex: 1, overflow: 'hidden', background: viewMode === 'original' ? '#1e293b' : '#f8fafc', position: 'relative', cursor: isDragging ? 'grabbing' : 'grab' }}
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onClick={() => setSelectedId(null)}
            >
                <div style={{
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                    transformOrigin: '0 0',
                    width: imgDims.width,
                    height: imgDims.height,
                    position: 'absolute',
                    top: 0,
                    left: 0
                }}>

                    {/* Always render the image to get dimensions, hide visually if in reconstructed view */}
                    {sourceImage && (
                        <img
                            src={sourceImage}
                            alt="Original P&ID Source"
                            style={{
                                width: '100%',
                                height: '100%',
                                display: viewMode === 'original' ? 'block' : 'none',
                                pointerEvents: 'none'
                            }}
                            onLoad={(e) => setImgDims({ width: e.target.naturalWidth, height: e.target.naturalHeight })}
                        />
                    )}

                    {viewMode === 'reconstructed' && (
                        <svg
                            ref={svgRef}
                            width="100%"
                            height="100%"
                            viewBox={`0 0 ${imgDims.width} ${imgDims.height}`}
                            style={{ display: 'block', position: 'absolute', top: 0, left: 0 }}
                        >
                            <defs>
                                <marker id="arrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
                                    <path d="M0,0 L0,6 L9,3 z" fill="#2563eb" />
                                </marker>
                            </defs>

                            <rect width="100%" height="100%" fill="#f1f5f9" />

                            {/* Faint overlay of the original image for context */}
                            {sourceImage && (
                                <image href={sourceImage} width="100%" height="100%" opacity="0.15" />
                            )}

                            {safeEdges.map(e => (
                                <OrthogonalEdge
                                    key={e.id}
                                    sourceNode={safeNodes.find(n => n.id === e.source)}
                                    targetNode={safeNodes.find(n => n.id === e.target)}
                                />
                            ))}

                            {safeNodes.map(n => (
                                <SymbolNode
                                    key={n.id}
                                    node={n}
                                    onClick={handleNodeClick}
                                    selected={selectedId === n.id}
                                />
                            ))}
                        </svg>
                    )}
                </div>
            </div>
            {selectedId && (
                <div style={{ padding: '10px', background: '#fff', borderTop: '1px solid #cbd5e1' }}>
                    <strong>Selected Item: </strong> {safeNodes.find(n => n.id === selectedId)?.label}
                    <span style={{ color: '#64748b', marginLeft: '10px' }}>({safeNodes.find(n => n.id === selectedId)?.subtype})</span>
                </div>
            )}
        </div>
    );
};

export default PIDRenderer;
