# TMDb Proxy Worker

Cloudflare Worker that proxies TMDb API for the Year in Film frontend. Keeps the API key server-side and adds CORS, rate limiting, and caching.

## Install

```bash
npm install
```

## Run locally

```bash
npm run dev
```

Set the secret for local dev (once):

```bash
wrangler secret put TMDB_API_KEY
```

Enter your TMDb API key when prompted. For local development you can use a `.dev.vars` file (do not commit it):

```
TMDB_API_KEY=your_key_here
```

## Deploy

```bash
npm run deploy
```

Or with Wrangler directly:

```bash
wrangler deploy
```

## Set secret in production

After deploying, set the TMDb API key as a Worker secret:

```bash
wrangler secret put TMDB_API_KEY
```

Enter your key when prompted. Get a key at [themoviedb.org/settings/api](https://www.themoviedb.org/settings/api).

## Endpoints

- `GET /search?title=...&year=...` — search movie, returns `{ tmdb_id, title, year, poster_path }`
- `GET /movie/:id` — movie details (minimal)
- `GET /movie/:id/credits` — directors + actors
- `GET /movie/:id/keywords` — keywords (max 20)

CORS is allowed for `https://year-in-film-lbd.pages.dev` and localhost. CORS headers are sent on all responses, including errors.

**Rate limiting:** 600 requests per minute per IP by default. Configure via env var `RATE_LIMIT_PER_MIN` in `wrangler.toml` (e.g. add to `[vars]`: `RATE_LIMIT_PER_MIN = "600"`) or as a secret. On 429 the worker returns `Retry-After: 10` and a JSON error message in Russian.

**Caching:** Only successful 200 responses are cached (30 days). Error responses (4xx/5xx) are never cached and include `Cache-Control: no-store`.
