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
