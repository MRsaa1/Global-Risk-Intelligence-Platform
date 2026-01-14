# 🚀 Alpha User Setup Guide

## Quick Start for Alpha Users

### Prerequisites

- Docker Desktop installed and running
- Node.js 20+ installed
- Python 3.11+ installed
- Git installed

---

## Step 1: Start Infrastructure

```bash
cd /Users/artur220513timur110415gmail.com/global-risk-platform
./start-local.sh
```

This starts:
- ✅ PostgreSQL + PostGIS (port 5432)
- ✅ Neo4j Knowledge Graph (port 7474)
- ✅ Redis (port 6379)
- ✅ MinIO Object Storage (port 9000/9001)

**Wait 10-15 seconds** for services to be ready.

---

## Step 2: Setup Backend API

```bash
# Navigate to API directory
cd apps/api

# Create virtual environment
python3 -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install dependencies
pip install --upgrade pip
pip install -e ".[dev]"

# Start API server
uvicorn src.main:app --reload --port 9002
```

**API will be available at:** http://localhost:9002  
**API Docs:** http://localhost:9002/docs

---

## Step 3: Setup Frontend

Open a **new terminal**:

```bash
cd /Users/artur220513timur110415gmail.com/global-risk-platform/apps/web

# Install dependencies
npm install

# Start development server
npm run dev
```

**Frontend will be available at:** http://localhost:5173

---

## Step 4: Seed Sample Data

In a **new terminal**, seed sample data for demos:

```bash
cd /Users/artur220513timur110415gmail.com/global-risk-platform

# Create admin user first (via API or directly)
curl -X POST http://localhost:9002/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "admin123",
    "full_name": "Admin User"
  }'

# Login to get token
TOKEN=$(curl -X POST http://localhost:9002/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com", "password": "admin123"}' \
  | jq -r '.access_token')

# Seed sample data
curl -X POST http://localhost:9002/api/v1/seed/seed \
  -H "Authorization: Bearer $TOKEN"
```

This creates:
- ✅ 5 sample assets across Germany
- ✅ Digital Twins with timelines
- ✅ Knowledge Graph relationships
- ✅ Sample infrastructure nodes

---

## Step 5: Login to Platform

1. Open http://localhost:5173
2. Click **Sign in**
3. Use credentials:
   - Email: `admin@example.com`
   - Password: `admin123`
4. Complete the **onboarding tour** (first time only)

---

## What You Can Do Now

### ✅ Explore Sample Assets

- Go to **Assets** page
- Click on any asset to see:
  - 3D Digital Twin viewer
  - Risk scores (Climate, Physical, Network)
  - Timeline history
  - Financial metrics

### ✅ Run Climate Stress Test

1. Go to **Simulations** page
2. Click **New Simulation**
3. Select assets and scenario
4. View results with exposure scores

### ✅ View Network Dependencies

1. Open an asset detail page
2. Check **Network Risk Score**
3. See infrastructure dependencies
4. Run cascade simulation

### ✅ Monitor with Agents

- **SENTINEL**: Check alerts on dashboard
- **ANALYST**: Run deep analysis on assets
- **ADVISOR**: Get recommendations with ROI

### ✅ Send Feedback

- Click the **feedback button** (bottom right)
- Report bugs, request features, share improvements

---

## Troubleshooting

### Port Already in Use

```bash
# Stop all services
./stop-local.sh

# Or kill specific ports
lsof -ti:9002 | xargs kill -9
lsof -ti:5173 | xargs kill -9
```

### Database Connection Error

```bash
# Check if PostgreSQL is running
docker-compose ps postgres

# Restart if needed
docker-compose restart postgres
```

### Frontend Build Errors

```bash
# Clear node_modules and reinstall
cd apps/web
rm -rf node_modules package-lock.json
npm install
```

### API Import Errors

```bash
# Reinstall Python dependencies
cd apps/api
pip install -e ".[dev]" --force-reinstall
```

---

## Demo Credentials

**Admin Account:**
- Email: `admin@example.com`
- Password: `admin123`

**Demo Account (create via register):**
- Email: `demo@example.com`
- Password: `demo`

---

## Next Steps

1. **Read User Guide**: `/docs/USER_GUIDE.md`
2. **Explore API Docs**: http://localhost:9002/docs
3. **Check Architecture**: `/docs/architecture/FIVE_LAYERS.md`
4. **Send Feedback**: Use feedback button in UI

---

## Support

- **Issues**: Use feedback button in UI
- **Documentation**: See `/docs/` directory
- **API Reference**: http://localhost:9002/docs

---

**Happy exploring! 🚀**
