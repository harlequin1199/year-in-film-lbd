const TMDB_BASE = 'https://api.themoviedb.org/3'
const CACHE_DAYS = 30
const RATE_LIMIT_PER_MIN = 40
const ALLOWED_ORIGINS = [
  'https://year-in-film-lbd.pages.dev',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
]
const TITLE_MAX = 120
const YEAR_MIN = 1800
const YEAR_MAX = 2100
const RATE_429_MSG = 'Слишком много запросов. Подождите минуту и попробуйте снова.'

interface Env {
  TMDB_API_KEY: string
}

const rateMap = new Map<string, { count: number; resetAt: number }>()

function rateLimit(ip: string): boolean {
  const now = Date.now()
  const windowMs = 60_000
  let entry = rateMap.get(ip)
  if (!entry) {
    rateMap.set(ip, { count: 1, resetAt: now + windowMs })
    return true
  }
  if (now >= entry.resetAt) {
    entry.count = 1
    entry.resetAt = now + windowMs
    return true
  }
  entry.count += 1
  return entry.count <= RATE_LIMIT_PER_MIN
}

function corsHeaders(origin: string | null): HeadersInit {
  const o = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': o,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  }
}

function jsonResponse(body: unknown, status = 200, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': `public, max-age=${CACHE_DAYS * 24 * 60 * 60}`,
      ...headers,
    },
  })
}

function getClientIP(request: Request): string {
  const cf = (request as Request & { cf?: { clientAddress?: string } }).cf
  if (cf?.clientAddress) return cf.clientAddress
  return request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() || 'unknown'
}

async function fetchTmdb(path: string, env: Env): Promise<Response> {
  const url = `${TMDB_BASE}${path}${path.includes('?') ? '&' : '?'}api_key=${env.TMDB_API_KEY}`
  return fetch(url)
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const origin = request.headers.get('Origin')
    const headers = corsHeaders(origin)

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers })
    }

    if (request.method !== 'GET') {
      return jsonResponse({ error: 'Method not allowed' }, 405, headers)
    }

    const ip = getClientIP(request)
    if (!rateLimit(ip)) {
      return jsonResponse({ error: RATE_429_MSG }, 429, headers)
    }

    const url = new URL(request.url)
    const path = url.pathname

    try {
      if (path === '/search') {
        const title = url.searchParams.get('title')?.trim() || ''
        const yearRaw = url.searchParams.get('year')?.trim()
        if (title.length > TITLE_MAX) {
          return jsonResponse({ error: 'Title too long' }, 400, headers)
        }
        const year = yearRaw ? parseInt(yearRaw, 10) : undefined
        if (yearRaw !== undefined && yearRaw !== '' && (Number.isNaN(year) || year < YEAR_MIN || year > YEAR_MAX)) {
          return jsonResponse({ error: 'Invalid year' }, 400, headers)
        }

        const cacheKey = new Request(url.toString())
        const cache = caches.default
        let res = await cache.match(cacheKey)
        if (res) {
          const r = new Response(res.body, res)
          Object.entries(headers).forEach(([k, v]) => r.headers.set(k, v as string))
          return r
        }

        const qs = new URLSearchParams({ query: title })
        if (year) qs.set('year', String(year))
        const tmdbRes = await fetchTmdb(`/search/movie?${qs}`, env)
        if (!tmdbRes.ok) {
          return jsonResponse({ error: 'TMDb search failed' }, tmdbRes.status, headers)
        }
        const data = (await tmdbRes.json()) as { results?: Array<{ id?: number; title?: string; release_date?: string; poster_path?: string }> }
        const first = data.results?.[0]
        const out = {
          tmdb_id: first?.id ?? null,
          title: first?.title ?? null,
          year: first?.release_date ? parseInt(first.release_date.slice(0, 4), 10) : null,
          poster_path: first?.poster_path ?? null,
        }
        res = jsonResponse(out, 200, headers)
        ctx.waitUntil(cache.put(cacheKey, res.clone()))
        return res
      }

      const movieMatch = path.match(/^\/movie\/(\d+)(?:\/(credits|keywords))?$/)
      if (movieMatch) {
        const id = movieMatch[1]
        const sub = movieMatch[2]
        const idNum = parseInt(id, 10)
        if (Number.isNaN(idNum) || id !== String(idNum)) {
          return jsonResponse({ error: 'Invalid movie id' }, 400, headers)
        }

        const cacheKey = new Request(url.toString())
        const cache = caches.default
        let res = await cache.match(cacheKey)
        if (res) {
          const r = new Response(res.body, res)
          Object.entries(headers).forEach(([k, v]) => r.headers.set(k, v as string))
          return r
        }

        if (sub === 'credits') {
          const tmdbRes = await fetchTmdb(`/movie/${id}/credits`, env)
          if (!tmdbRes.ok) {
            return jsonResponse({ error: 'TMDb credits failed' }, tmdbRes.status, headers)
          }
          const data = (await tmdbRes.json()) as {
            id?: number
            crew?: Array<{ job?: string; name?: string }>
            cast?: Array<{ name?: string }>
          }
          const directors = (data.crew || []).filter((c) => c.job === 'Director').map((c) => c.name).filter(Boolean) as string[]
          const actors = (data.cast || []).slice(0, 10).map((c) => c.name).filter(Boolean) as string[]
          const out = { id: data.id ?? idNum, directors, actors }
          res = jsonResponse(out, 200, headers)
          ctx.waitUntil(cache.put(cacheKey, res.clone()))
          return res
        }

        if (sub === 'keywords') {
          const tmdbRes = await fetchTmdb(`/movie/${id}/keywords`, env)
          if (!tmdbRes.ok) {
            return jsonResponse({ error: 'TMDb keywords failed' }, tmdbRes.status, headers)
          }
          const data = (await tmdbRes.json()) as { id?: number; keywords?: Array<{ name?: string }> }
          const keywords = (data.keywords || []).slice(0, 20).map((k) => k.name).filter(Boolean) as string[]
          const out = { id: data.id ?? idNum, keywords }
          res = jsonResponse(out, 200, headers)
          ctx.waitUntil(cache.put(cacheKey, res.clone()))
          return res
        }

        const tmdbRes = await fetchTmdb(`/movie/${id}`, env)
        if (!tmdbRes.ok) {
          return jsonResponse({ error: 'TMDb movie failed' }, tmdbRes.status, headers)
        }
        const data = (await tmdbRes.json()) as {
          id?: number
          poster_path?: string
          genres?: Array<{ name?: string }>
          runtime?: number
          vote_average?: number
          vote_count?: number
          original_language?: string
          production_countries?: Array<{ name?: string }>
          release_date?: string
        }
        const out = {
          id: data.id,
          poster_path: data.poster_path ?? null,
          genres: (data.genres || []).map((g) => g.name).filter(Boolean),
          runtime: data.runtime ?? null,
          vote_average: data.vote_average ?? null,
          vote_count: data.vote_count ?? 0,
          original_language: data.original_language ?? null,
          production_countries: (data.production_countries || []).map((c) => c.name).filter(Boolean),
          release_date: data.release_date ?? null,
        }
        res = jsonResponse(out, 200, headers)
        ctx.waitUntil(cache.put(cacheKey, res.clone()))
        return res
      }

      return jsonResponse({ error: 'Not found' }, 404, headers)
    } catch (e) {
      return jsonResponse({ error: 'Internal error' }, 500, headers)
    }
  },
}
