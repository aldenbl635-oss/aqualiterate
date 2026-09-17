# AquaIterate

**Industrial Water Pinch and Reuse Network Design Platform**

AquaIterate is a full-stack digital-twin platform that converts site-wide water quality data into an optimised water reuse network, reducing freshwater consumption, treatment costs, and contamination response time.

> ⚠ **DEMO DATA NOTICE**: The default demo dataset contains **synthetic values clearly labelled
> "DEMO DATA — NOT TNPCB DATA"**. Real TNPCB datasets can be imported separately via the
> import API (see [TNPCB Data Import](#tnpcb-data-import)).

---

## Table of Contents

1. [Architecture](#architecture)
2. [Setup — Docker (recommended)](#setup-docker)
3. [Setup — Local development](#setup-local)
4. [Database / PostGIS setup](#database--postgis-setup)
5. [Backend setup](#backend-setup)
6. [Frontend setup](#frontend-setup)
7. [Optimizer setup](#optimizer-setup)
8. [Demo data loading](#demo-data-loading)
9. [TNPCB data import](#tnpcb-data-import)
10. [API documentation](#api-documentation)
11. [Test instructions](#test-instructions)
12. [Demo workflow](#demo-workflow)

---

## Architecture

```
React + Leaflet.js
        │
        │ REST API (JWT)
        ▼
Django REST API
        │
        ├─────────────────────┐
        ▼                     ▼
PostgreSQL + PostGIS      PuLP / CBC Optimizer
        │                     │
        └──────────┬──────────┘
                   ▼
         Optimization Results
                   │
                   ▼
          React Digital Twin

Worker Portal
      │
      ▼
Contamination Reports
      │
      ▼
Rule-based + LLM AI Layer
      │
      ▼
Recommended Fix / Authority Flag
```

**Tech stack:**

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Leaflet.js + Recharts |
| Backend | Django 4.2 + Django REST Framework |
| Database | PostgreSQL 15 + PostGIS 3.3 |
| Optimizer | PuLP (CBC solver) |
| AI | Rule-based + OpenAI GPT (optional) |
| Auth | JWT (SimpleJWT) |
| Containerization | Docker Compose |

---

## Setup — Docker

The fastest way to run the full stack.

### Prerequisites

- Docker Desktop ≥ 4.x
- Docker Compose ≥ 2.x

### Steps

```bash
# 1. Clone / extract the project
cd aqualerate

# 2. Copy the environment file
cp .env.example .env
# Edit .env if needed (set OPENAI_API_KEY for LLM advisory)

# 3. Start all services
docker-compose up --build

# The backend auto-runs migrations and loads demo data on first start.
# Frontend: http://localhost:3000
# API:      http://localhost:8000
# API docs: http://localhost:8000/api/docs/
```

Demo credentials:
- **Admin:** `admin` / `admin123`
- **Worker:** `worker1` / `worker123`

---

## Setup — Local development

### Prerequisites

- Python 3.11+
- Node.js 20+
- PostgreSQL 15 with PostGIS 3.3
- GDAL (required by GeoDjango)

### Database / PostGIS setup

```sql
-- As postgres superuser:
CREATE DATABASE aquaiterate;
CREATE USER aquauser WITH PASSWORD 'aquapass';
GRANT ALL PRIVILEGES ON DATABASE aquaiterate TO aquauser;
\c aquaiterate
CREATE EXTENSION postgis;
CREATE EXTENSION postgis_topology;
```

Or use the provided `database/init.sql`.

---

### Backend setup

```bash
cd backend

# Create and activate virtual environment
python -m venv .venv
# Windows:
.venv\Scripts\activate
# Linux/Mac:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Copy and configure environment
cp ../.env.example ../.env
# Edit .env — set DATABASE_URL, POSTGRES_* vars

# Run migrations
python manage.py migrate

# Load demo data (labelled DEMO DATA — NOT TNPCB DATA)
python manage.py load_demo_data

# Start the development server
python manage.py runserver
```

Backend: http://localhost:8000
API docs: http://localhost:8000/api/docs/

---

### Frontend setup

```bash
cd frontend

npm install
npm start
```

Frontend: http://localhost:3000

> **Note:** `REACT_APP_API_URL` in `.env` controls the backend URL (default: `http://localhost:8000`).

---

### Optimizer setup

PuLP (with bundled CBC solver) is installed via `requirements.txt`. No additional setup is required.

To verify:
```bash
cd backend
python -c "import pulp; print(pulp.pulpTestAll())"
```

---

## Demo data loading

```bash
cd backend
python manage.py load_demo_data
```

Creates:
- 1 demo industrial site (Chennai-area demo coordinates)
- 4 zones: Production, Utility, Treatment, Storage
- 4 water sources: Freshwater Intake, Reuse Stream A, Reuse Stream B, Treated Wastewater
- 4 water sinks: Cooling, Process, Utility, Cleaning operations
- Water quality profiles (synthetic — clearly labelled)
- 1 treatment option (Effluent Treatment Plant — DEMO ASSUMPTION)
- Network connections with demo routing costs
- Admin user (`admin` / `admin123`)
- Worker user (`worker1` / `worker123`)

**All demo values are clearly labelled "DEMO DATA — NOT TNPCB DATA".**

---

## TNPCB data import

### API endpoint

```
POST /api/sites/{site_id}/tnpcb/import/
Authorization: Bearer <token>
Content-Type: application/json
```

### Payload format

```json
{
  "readings": [
    {
      "source_reference": "TNPCB-STATION-ID",
      "latitude": 13.0827,
      "longitude": 80.2785,
      "sample_time": "2024-01-15T10:30:00Z",
      "parameter_name": "pH",
      "parameter_value": 7.2,
      "unit": "pH units",
      "dataset_name": "TNPCB Industrial Effluent Dataset 2024",
      "dataset_reference": "TNPCB/IED/2024/Q1"
    }
  ]
}
```

**Important:**
- Original TNPCB values are **never altered** after import.
- `source_reference` and `dataset_name` / `dataset_reference` must identify the original TNPCB source.
- Multiple parameters can be imported in a single call.
- The UI clearly distinguishes TNPCB data from DEMO DATA.

---

## API documentation

Interactive API docs (Swagger UI): `http://localhost:8000/api/docs/`

### Key endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/token/` | Obtain JWT tokens |
| GET | `/api/sites/` | List sites |
| GET | `/api/sites/{id}/sources/` | Site water sources |
| GET | `/api/sites/{id}/sinks/` | Site water sinks |
| GET | `/api/sites/{id}/network/` | GeoJSON network map |
| GET | `/api/sites/{id}/dashboard/kpis/` | Dashboard KPIs |
| POST | `/api/sites/{id}/optimization/run/` | Run LP optimization |
| GET | `/api/sites/{id}/optimization/runs/` | Optimization history |
| GET | `/api/optimization/runs/{id}/` | Run detail |
| GET | `/api/optimization/runs/{id}/routes/` | Optimized routes |
| GET | `/api/sites/{id}/reports/` | Contamination reports |
| POST | `/api/sites/{id}/reports/` | Submit report |
| POST | `/api/reports/{id}/analyze/` | AI advisory analysis |
| GET | `/api/sites/{id}/ai-recommendations/` | AI recommendations |
| POST | `/api/sites/{id}/tnpcb/import/` | Import TNPCB data |
| GET | `/api/sites/{id}/tnpcb/readings/` | View TNPCB readings |

---

## Test instructions

### Optimizer unit tests (no database required)

```bash
cd backend
pip install pytest
pytest ../tests/test_optimizer.py -v
```

Tests A–G:
- **A** — Direct reuse (compatible source → compatible sink)
- **B** — Quality mismatch (non-compliant source not routed directly)
- **C** — Treatment route (source compliant after treatment)
- **D** — Source capacity (never over-allocated)
- **E** — Unmet demand (reported when supply insufficient)
- **F** — Freshwater tracking (separate from reuse flow)
- **G** — Cost calculation (routing + treatment in objective)

### API tests (requires running database)

```bash
cd backend
pip install pytest pytest-django
pytest ../tests/test_api.py -v
```

### Django built-in tests

```bash
cd backend
python manage.py test
```

---

## Demo workflow

Follow this sequence to demonstrate the full AquaIterate concept:

1. **Open Admin Dashboard** → `http://localhost:3000/admin/dashboard`
   - View site-wide KPIs (freshwater, reuse, cost, open reports)

2. **Digital Twin** → `/admin/network`
   - View water sources (blue = freshwater, green = reuse)
   - View sinks (amber markers)
   - Hover for details

3. **Load current network state**
   - Dashboard KPIs show current source/sink availability

4. **Run Optimization** → `/admin/optimization`
   - Set freshwater penalty (e.g. 2.0 to prefer reuse)
   - Click "Run Optimization"
   - View solver status, freshwater/reuse/treatment flows, costs
   - Review the source → sink route table

5. **View optimized routes on map** → `/admin/network`
   - Cyan solid lines = LP-optimized routes
   - Dashed lines = network connections

6. **Worker submits report** → `/worker` (login as worker1/worker123)
   - Fill in observation title, description, severity
   - Submit

7. **AI analyzes report** → `/admin/reports`
   - Click "AI Analyze" on the report
   - View generated recommendation (urgent/high routes → auto-escalation)

8. **Review AI recommendation** → `/admin/ai-advisory`
   - Read reasoning and recommended action
   - Acknowledge / mark implemented after authority review

9. **Dashboard KPIs update** showing resolved reports

---

## Impact goals

- 🌊 Less freshwater drawn from stressed sources
- 🏭 Lower pollution load to TNPCB-monitored water bodies
- 💰 Lower freshwater procurement and treatment cost via optimized reuse routing
- ⚡ Transparent and fast response to contamination reports
- 📡 Scalable to campuses and industrial sites using local water-quality data

---

## Data integrity

- All TNPCB data is stored as-imported without modification
- Demo/synthetic data is always clearly labelled "DEMO DATA — NOT TNPCB DATA"
- AI recommendations are advisory only — no action is claimed unless an authorized user records it
- Cost figures displayed are DEMO ASSUMPTIONS, not real industrial costs

---

*AquaIterate v1.0.0 — Prototype Implementation*
