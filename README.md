# TransactionIQ

TransactionIQ is a production-style duplicate transaction prevention app with:

- React + Vite frontend
- FastAPI backend
- Supabase persistence
- strict admin/staff role separation
- auto-processing upload flow
- duplicate blocking before save

## Local Setup

### Frontend

Optional root `.env`:

```bash
VITE_API_BASE_URL=http://127.0.0.1:8001/api
```

Run:

```bash
npm install
npm run dev
```

### Backend

Create `backend/.env` from `backend/.env.example` and fill the Supabase keys.

Run:

```bash
pip install -r backend/requirements.txt
npm run api:dev
```

## Validation

```bash
npm run check
npm run build
```

## Deployment

### Frontend on Vercel

- Framework preset: `Vite`
- Build command: `npm run build`
- Output directory: `dist`
- Environment variable:

```bash
VITE_API_BASE_URL=https://your-backend-service.onrender.com/api
```

`vercel.json` already includes SPA rewrites.

### Backend on Render

`render.yaml` is included for the API deployment.

Required environment variables:

```bash
SUPABASE_URL=...
SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SECRET_KEY=...
SUPABASE_JWKS_URL=...
```

Render start command:

```bash
python -m uvicorn backend.app.main:app --host 0.0.0.0 --port $PORT
```

## Supabase

Run [schema.sql](file:///c:/Users/m_jaz/Desktop/TransactionIQ_/supabase/schema.sql) in the Supabase SQL editor before first production use.
