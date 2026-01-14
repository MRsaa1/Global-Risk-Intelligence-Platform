# 🚀 Quick Start - Alpha Users

## 1. Start Infrastructure

```bash
./start-local.sh
```

## 2. Start Backend

```bash
cd apps/api
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
uvicorn src.main:app --reload --port 9002
```

## 3. Start Frontend

```bash
cd apps/web
npm install
npm run dev
```

## 4. Seed Data & Login

1. Open http://localhost:9002/docs
2. Register: POST `/api/v1/auth/register`
3. Login: POST `/api/v1/auth/login`
4. Seed: POST `/api/v1/seed/seed` (with token)
5. Open http://localhost:5173 and login

**Done! 🎉**
