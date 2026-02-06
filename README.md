# Letterboxd Year in Review

## Setup

1) Create `backend/.env` with:
```
TMDB_API_KEY=your_tmdb_api_key_here
```

2) Install backend dependencies:
```
pip install -r backend/requirements.txt
```

3) Run the API:
```
cd backend
uvicorn main:app --reload --port 8000
```

4) Run the frontend:
```
cd frontend
npm install
npm run dev
```

---

## Deploy

### Backend (Render)

1. **New Web Service**, connect the repo.
2. **Root Directory:** `backend`
3. **Build Command:** `pip install -r requirements.txt`
4. **Start Command (uvicorn):**  
   `uvicorn main:app --host 0.0.0.0 --port $PORT`  
   Or with gunicorn (recommended):  
   `gunicorn -k uvicorn.workers.UvicornWorker main:app --bind 0.0.0.0:$PORT`
5. **Environment variables (required):**
   - `TMDB_API_KEY` — your TMDb API key
   - `FRONTEND_ORIGIN` (optional) — frontend URL for CORS, e.g. `https://your-project.pages.dev`. If unset, CORS allows all origins.
6. Save; Render will build and deploy. Health check: `GET https://your-service.onrender.com/health` → `{"status":"ok"}`.

**Troubleshooting:**

- **App crashes on start:** Ensure `TMDB_API_KEY` is set. Backend fails fast if it is missing.
- **CORS errors from frontend:** Set `FRONTEND_ORIGIN` to the exact frontend URL (e.g. Cloudflare Pages URL).
- **First request very slow:** Free tier spins down after inactivity; cold start can take 30–60 seconds. Consider showing a “server waking up” message in the UI.

---

### Frontend (Cloudflare Pages)

1. **Create project** → Connect repository.
2. **Root directory:** `frontend`
3. **Build command:** `npm run build`
4. **Build output directory:** `dist`
5. **Environment variables (Build):**
   - `VITE_API_URL` — backend API URL, e.g. `https://your-api.onrender.com` (no trailing slash).  
   If missing, production build will still use the fallback; set it so production talks to your Render backend.
6. Save and deploy. SPA routing is handled by `public/_redirects` (`/* /index.html 200`).

**Troubleshooting:**

- **API requests fail in production:** Check `VITE_API_URL` is set and matches the Render backend URL. Check backend CORS: set `FRONTEND_ORIGIN` to your Cloudflare Pages URL.
- **404 on refresh / direct URL:** Ensure `_redirects` is in `frontend/public/` and deployed (rewrites to `index.html`).
