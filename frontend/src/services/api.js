import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const api = axios.create({
    baseURL: API_BASE,
    headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Auto-refresh on 401
api.interceptors.response.use(
    (res) => res,
    async (err) => {
        const original = err.config;
        if (err.response?.status === 401 && !original._retry) {
            original._retry = true;
            try {
                const refresh = localStorage.getItem('refresh_token');
                const res = await axios.post(`${API_BASE}/api/auth/token/refresh/`, { refresh });
                localStorage.setItem('access_token', res.data.access);
                original.headers.Authorization = `Bearer ${res.data.access}`;
                return api(original);
            } catch {
                localStorage.removeItem('access_token');
                localStorage.removeItem('refresh_token');
                window.location.href = '/login';
            }
        }
        return Promise.reject(err);
    }
);

// ── Auth ──────────────────────────────────────────────────
export const login = (credentials) =>
    api.post('/api/auth/token/', credentials).then((r) => {
        localStorage.setItem('access_token', r.data.access);
        localStorage.setItem('refresh_token', r.data.refresh);
        return r.data;
    });

export const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
};

export const getMe = () => api.get('/api/auth/me/').then((r) => r.data);

// ── Sites ─────────────────────────────────────────────────
export const getSites = () => api.get('/api/sites/').then((r) => r.data.results || r.data);
export const getSite = (id) => api.get(`/api/sites/${id}/`).then((r) => r.data);
export const createSite = (data) => api.post('/api/sites/', data).then((r) => r.data);

// ── PID Engine ───────────────────────────────────────────
export const getPIDGraph = (pidId) => api.get(`/api/pid/${pidId}/graph/`).then((r) => r.data);
export const getPIDDocumentBySite = (siteId) => api.get(`/api/pid/?site=${siteId}`).then(r => r.data.length ? Math.max(...r.data.map(d => d.id)) : null);

// ── Network ───────────────────────────────────────────────
export const getSources = (siteId) => api.get(`/api/sites/${siteId}/sources/`).then((r) => r.data.results || r.data);
export const getSinks = (siteId) => api.get(`/api/sites/${siteId}/sinks/`).then((r) => r.data.results || r.data);
export const getNetworkGeoJSON = (siteId) => api.get(`/api/sites/${siteId}/network/`).then((r) => r.data);

// ── Water Quality ─────────────────────────────────────────
export const getWaterQualityProfiles = () => api.get('/api/water-quality/').then((r) => r.data.results || r.data);
export const getTNPCBReadings = (siteId, params = {}) =>
    api.get(`/api/sites/${siteId}/tnpcb/readings/`, { params }).then((r) => r.data.results || r.data);
export const importTNPCB = (siteId, payload) =>
    api.post(`/api/sites/${siteId}/tnpcb/import/`, payload).then((r) => r.data);

// ── Optimization ─────────────────────────────────────────
export const runOptimization = (siteId, params) =>
    api.post(`/api/sites/${siteId}/optimization/run/`, params).then((r) => r.data);
export const getOptimizationRuns = (siteId) =>
    api.get(`/api/sites/${siteId}/optimization/runs/`).then((r) => r.data.results || r.data);
export const getOptimizationRun = (runId) =>
    api.get(`/api/optimization/runs/${runId}/`).then((r) => r.data);
export const getOptimizationRoutes = (runId) =>
    api.get(`/api/optimization/runs/${runId}/routes/`).then((r) => r.data.results || r.data);

// ── Dashboard KPIs ────────────────────────────────────────
export const getDashboardKPIs = (siteId) =>
    api.get(`/api/sites/${siteId}/dashboard/kpis/`).then((r) => r.data);

// ── Reports ───────────────────────────────────────────────
export const getReports = (siteId, params = {}) =>
    api.get(`/api/sites/${siteId}/reports/`, { params }).then((r) => r.data.results || r.data);
export const createReport = (siteId, data) =>
    api.post(`/api/sites/${siteId}/reports/`, data).then((r) => r.data);
export const updateReport = (reportId, data) =>
    api.patch(`/api/reports/${reportId}/`, data).then((r) => r.data);

// ── AI Advisory ───────────────────────────────────────────
export const analyzeReport = (reportId) =>
    api.post(`/api/reports/${reportId}/analyze/`).then((r) => r.data);
export const getAIRecommendations = (siteId) =>
    api.get(`/api/sites/${siteId}/ai-recommendations/`).then((r) => r.data.results || r.data);
export const updateAIRecommendation = (recId, data) =>
    api.patch(`/api/ai-recommendations/${recId}/`, data).then((r) => r.data);

// ── Simulation ────────────────────────────────────────────
export const getSimulationState = (siteId) =>
    api.get(`/api/sites/${siteId}/simulation/state/`).then((r) => r.data);
export const controlSimulation = (siteId, data) =>
    api.post(`/api/sites/${siteId}/simulation/control/`, data).then((r) => r.data);

export default api;

