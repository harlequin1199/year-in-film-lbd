const DB_NAME = 'year-in-film-cache'
const DB_VERSION = 2
const STORES = ['searchCache', 'movieCache', 'creditsCache', 'keywordsCache', 'resumeState', 'lastReport']

let dbPromise = null

function openDb() {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onerror = () => reject(req.error)
    req.onsuccess = () => resolve(req.result)
    req.onupgradeneeded = (e) => {
      const db = e.target.result
      for (const name of STORES) {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name)
        }
      }
    }
  })
  return dbPromise
}

function normalizeKey(key) {
  return typeof key === 'string' ? key : String(key)
}

export async function getSearch(title, year) {
  const db = await openDb()
  const key = `${(title || '').trim().toLowerCase()}:${year ?? 0}`
  return new Promise((resolve, reject) => {
    const tx = db.transaction('searchCache', 'readonly')
    const req = tx.objectStore('searchCache').get(key)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function setSearch(title, year, tmdbId) {
  const db = await openDb()
  const key = `${(title || '').trim().toLowerCase()}:${year ?? 0}`
  return new Promise((resolve, reject) => {
    const tx = db.transaction('searchCache', 'readwrite')
    tx.objectStore('searchCache').put(tmdbId, key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function getMovie(tmdbId) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('movieCache', 'readonly')
    const req = tx.objectStore('movieCache').get(normalizeKey(tmdbId))
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function setMovie(tmdbId, data) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('movieCache', 'readwrite')
    tx.objectStore('movieCache').put(data, normalizeKey(tmdbId))
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function getCredits(tmdbId) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('creditsCache', 'readonly')
    const req = tx.objectStore('creditsCache').get(normalizeKey(tmdbId))
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function setCredits(tmdbId, data) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('creditsCache', 'readwrite')
    tx.objectStore('creditsCache').put(data, normalizeKey(tmdbId))
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function getKeywords(tmdbId) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('keywordsCache', 'readonly')
    const req = tx.objectStore('keywordsCache').get(normalizeKey(tmdbId))
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function setKeywords(tmdbId, data) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('keywordsCache', 'readwrite')
    tx.objectStore('keywordsCache').put(data, normalizeKey(tmdbId))
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function clearCache() {
  const db = await openDb()
  const storesToClear = ['searchCache', 'movieCache', 'creditsCache', 'keywordsCache']
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storesToClear, 'readwrite')
    storesToClear.forEach((name) => tx.objectStore(name).clear())
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function getResumeState() {
  const db = await openDb()
  if (!db.objectStoreNames.contains('resumeState')) return null
  return new Promise((resolve, reject) => {
    const tx = db.transaction('resumeState', 'readonly')
    const req = tx.objectStore('resumeState').get('current')
    req.onsuccess = () => resolve(req.result ?? null)
    req.onerror = () => reject(req.error)
  })
}

export async function setResumeState(state) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('resumeState', 'readwrite')
    tx.objectStore('resumeState').put(state, 'current')
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function clearResumeState() {
  const db = await openDb()
  if (!db.objectStoreNames.contains('resumeState')) return
  return new Promise((resolve, reject) => {
    const tx = db.transaction('resumeState', 'readwrite')
    tx.objectStore('resumeState').delete('current')
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function getLastReport() {
  const db = await openDb()
  if (!db.objectStoreNames.contains('lastReport')) return null
  return new Promise((resolve, reject) => {
    const tx = db.transaction('lastReport', 'readonly')
    const req = tx.objectStore('lastReport').get('report')
    req.onsuccess = () => resolve(req.result ?? null)
    req.onerror = () => reject(req.error)
  })
}

export async function setLastReport(report) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('lastReport', 'readwrite')
    tx.objectStore('lastReport').put(report, 'report')
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}
