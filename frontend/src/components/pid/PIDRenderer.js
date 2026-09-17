import React, { useMemo, useState } from 'react';

const GRID_SIZE = 150;

const computeLayout = (nodes, edges) => {
    // Basic topological sort & layer assignment
    const inDegree = {};
    const adj = {};

    nodes.forEach(n => {
        inDegree[n.id] = 0;
        adj[n.id] = [];
    });

    edges.forEach(e => {
        if (inDegree[e.target] !== undefined) {
            inDegree[e.target]++;
            if (!adj[e.source]) adj[e.source] = [];
            adj[e.source].push(e.target);
        }
    });

    const queue = [];
    const layers = {};

    nodes.forEach(n => {
        if (inDegree[n.id] === 0) {
            queue.push(n.id);
            layers[n.id] = 0;
        }
    });

    while (queue.length > 0) {
        const u = queue.shift();
        const currentLayer = layers[u];

        (adj[u] || []).forEach(v => {
            inDegree[v]--;
            layers[v] = Math.max(layers[v] || 0, currentLayer + 1);
            if (inDegree[v] === 0) {
                queue.push(v);
            }
        });
    }

    // Assign unassigned nodes (cycles)
    nodes.forEach(n => {
        if (layers[n.id] === undefined) {
            layers[n.id] = 0; // fallback
        }
    });

    const layerCounts = {};
    const positionedNodes = nodes.map(n => {
        const L = layers[n.id];
        if (!layerCounts[L]) layerCounts[L] = 0;
        const idx = layerCounts[L];
        layerCounts[L]++;

        return {
            ...n,
            x: 100 + L * GRID_SIZE * 1.5,
            y: 100 + idx * GRID_SIZE
        };
    });

    return positionedNodes;
};

const OrthogonalEdge = ({ sourceNode, targetNode }) => {
    if (!sourceNode || !targetNode) return null;

    const sx = sourceNode.x + 30; // Output right
    const sy = sourceNode.y;
    const tx = targetNode.x - 30; // Input left
    const ty = targetNode.y;

    const midX = (sx + tx) / 2;

    const d = `M ${sx} ${sy} L ${midX} ${sy} L ${midX} ${ty} L ${tx} ${ty}`;

    return (
        <path d={d} fill="none" stroke="#2563eb" strokeWidth="3" markerEnd="url(#arrow)" />
    );
};

const SymbolNode = ({ node, onClick, selected }) => {
    const isPump = node.subtype === 'Pump';
    const isTank = node.subtype === 'Tank';
    const isValve = node.subtype === 'Valve';

    return (
        <g transform={`translate(${node.x}, ${node.y})`} onClick={() => onClick && onClick(node)} style={{ cursor: 'pointer' }}>
            {selected && <circle r="45" fill="rgba(8, 112, 184, 0.2)" />}

            {isPump && (
                <g>
                    <circle r="25" fill="#f8fafc" stroke="#334155" strokeWidth="2" />
                    <path d="M 0 -25 L 25 0 L 0 25 Z" fill="#334155" />
                </g>
            )}
            {isTank && (
                <rect x="-25" y="-35" width="50" height="70" rx="4" fill="#f8fafc" stroke="#334155" strokeWidth="2" />
            )}
            {isValve && (
                <path d="M -15 -15 L 15 15 L 15 -15 L -15 15 Z" fill="#f8fafc" stroke="#334155" strokeWidth="2" />
            )}
            {!isPump && !isTank && !isValve && (
                <circle r="20" fill="#f8fafc" stroke="#334155" strokeWidth="2" />
            )}

            <text y="45" textAnchor="middle" fontSize="12" fill="#1e293b" fontWeight="bold">{node.label}</text>
            <text y="60" textAnchor="middle" fontSize="10" fill="#64748b">{node.subtype}</text>
        </g>
    );
};

const PIDRenderer = ({ nodes = [], edges = [], onNodeClick }) => {
    const [selectedId, setSelectedId] = useState(null);
    const layoutNodes = useMemo(() => computeLayout(nodes, edges), [nodes, edges]);

    const handleNodeClick = (node) => {
        setSelectedId(node.id);
        if (onNodeClick) onNodeClick(node);
    };

    return (
        <div style={{ width: '100%', height: '100%', overflow: 'auto', background: '#f1f5f9' }}>
            <svg width="2000" height="1500" style={{ display: 'block' }}>
                <defs>
                    <marker id="arrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
                        <path d="M0,0 L0,6 L9,3 z" fill="#2563eb" />
                    </marker>
                    <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                        <rect width="20" height="20" fill="none" stroke="#e2e8f0" strokeWidth="0.5" />
                    </pattern>
                </defs>

                <rect width="100%" height="100%" fill="url(#grid)" />

                {edges.map(e => (
                    <OrthogonalEdge
                        key={e.id}
                        sourceNode={layoutNodes.find(n => n.id === e.source)}
                        targetNode={layoutNodes.find(n => n.id === e.target)}
                    />
                ))}

                {layoutNodes.map(n => (
                    <SymbolNode
                        key={n.id}
                        node={n}
                        onClick={handleNodeClick}
                        selected={selectedId === n.id}
                    />
                ))}
            </svg>
        </div>
    );
};

export default PIDRenderer;
