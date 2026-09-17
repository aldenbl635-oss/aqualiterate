import React, { useState } from 'react';
import { login } from '../services/api';
import { getMe } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';

export default function LoginPage() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { setUser } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            await login({ username, password });
            const user = await getMe();
            setUser(user);
            navigate(user.role === 'worker' ? '/worker' : '/admin/dashboard');
        } catch (err) {
            setError('Invalid credentials. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-page">
            <div className="login-card">
                <div className="login-logo">
                    <div className="login-logo-text">AquaIterate</div>
                    <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem', marginTop: 6 }}>
                        Industrial Water Reuse Intelligence Platform
                    </div>
                </div>

                <div className="demo-banner mb-4">
                    ⚠ Demo: admin / admin123 &nbsp;|&nbsp; worker1 / worker123
                </div>

                {error && <div className="alert alert-danger">{error}</div>}

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label">Username</label>
                        <input
                            id="username"
                            type="text"
                            className="form-input"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                            autoFocus
                            placeholder="e.g. admin"
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Password</label>
                        <input
                            id="password"
                            type="password"
                            className="form-input"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            placeholder="••••••••"
                        />
                    </div>
                    <button
                        id="login-submit"
                        type="submit"
                        className="btn btn-primary"
                        style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}
                        disabled={loading}
                    >
                        {loading ? <><div className="spinner" /> Signing in…</> : 'Sign In'}
                    </button>
                </form>
            </div>
        </div>
    );
}
