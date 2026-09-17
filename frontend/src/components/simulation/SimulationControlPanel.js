import React, { useState, useEffect } from 'react';
import { getSimulationState, controlSimulation } from '../../services/api';
import { useSite } from '../../hooks/useSite';

export default function SimulationControlPanel({ onSimulationUpdate }) {
    const { activeSiteId } = useSite();
    const [simState, setSimState] = useState(null);

    const fetchState = () => {
        if (!activeSiteId) return;
        getSimulationState(activeSiteId)
            .then(data => {
                setSimState(data);
                if (onSimulationUpdate) onSimulationUpdate(data);
            })
            .catch(err => console.error(err));
    };

    useEffect(() => {
        fetchState();
        const interval = setInterval(() => {
            if (simState?.simulation?.status === 'RUNNING') {
                fetchState();
            }
        }, 5000); // 5 sec poll
        return () => clearInterval(interval);
    }, [activeSiteId, simState?.simulation?.status]); // Re-bind interval if status changes

    const handleControl = (action, extra = {}) => {
        if (!activeSiteId) return;
        controlSimulation(activeSiteId, { action, ...extra }).then(() => fetchState());
    };

    if (!simState) return null;

    const s = simState.simulation;
    const isRunning = s.status === 'RUNNING';

    // Format timestamp nicely
    const formatTime = (ts) => {
        if (!ts) return 'Not started';
        const d = new Date(ts);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + " · " + d.toLocaleDateString();
    };

    return (
        <div className="card mb-4" style={{ border: isRunning ? '1px solid #22c55e' : '' }}>
            <div className="card-body flex justify-between items-center" style={{ padding: '12px 20px' }}>
                <div className="flex items-center gap-4">
                    <div>
                        <div style={{ fontSize: '0.7rem', color: isRunning ? '#22c55e' : '#f59e0b', fontWeight: 'bold', letterSpacing: '0.05em' }}>
                            {isRunning ? '● SIMULATION ACTIVE' : '⏸ SIMULATED REAL-TIME STATE'}
                        </div>
                        <div style={{ fontFamily: 'monospace', fontSize: '1.2rem', color: '#e8f4f8' }}>
                            {formatTime(s.current_timestamp)}
                        </div>
                    </div>
                    {/* Add scenario selection dropdown maybe? */}
                    <select
                        className="form-select"
                        style={{ width: 200, padding: '4px 8px', fontSize: '0.8rem' }}
                        value={s.current_scenario}
                        onChange={(e) => handleControl('scenario', { scenario: e.target.value })}
                    >
                        <option value="NORMAL">Normal Operation</option>
                        <option value="QUALITY_DEGRADATION">Quality Degradation</option>
                        <option value="HIGH_DEMAND">High Water Demand</option>
                    </select>
                </div>

                <div className="flex gap-2">
                    {!isRunning ? (
                        <button className="btn btn-primary btn-sm" onClick={() => handleControl('start')}>▶ START SIMULATION</button>
                    ) : (
                        <button className="btn btn-secondary btn-sm" onClick={() => handleControl('pause')}>⏸ PAUSE</button>
                    )}
                    <button className="btn btn-secondary btn-sm" onClick={() => handleControl('next')}>⏩ NEXT STEP</button>
                </div>
            </div>
        </div>
    );
}
