import type { Analysis, ResumeState } from '../types'
import type { TmdbMovie, TmdbCredits, TmdbKeywords } from '../types/api.types'

const DB_NAME = 'year-in-film-cache'
const DB_VERSION = 2
const STORES = ['searchCache', 'movieCache', 'creditsCache', 'keywordsCache', 'resumeState', 'lastReport'] as const

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) {
    return dbPromise.then(db => {
      if (db && !db.objectStoreNames.length) {
        dbPromise = null
        return openDb()
      }
      return db
    }).catch(() => {
      dbPromise = null
      return openDb()
    })
  }
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onerror = () => {
      dbPromise = null
      reject(req.error)
    }
    req.onsuccess = () => {
      const db = req.result
      db.onclose = () => {
        dbPromise = null
      }
      db.onerror = () => {
        dbPromise = null
      }
      resolve(db)
    }
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result
      for (const name of STORES) {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name)
        }
      }
    }
  })
  return dbPromise
}

function normalizeKey(key: string | number): string {
  return typeof key === 'string' ? key : String(key)
}

export async function getSearch(title: string, year: number | null): Promise<number | null | undefined> {
  try {
    const db = await openDb()
    const key = `${(title || '').trim().toLowerCase()}:${year ?? 0}`
    return new Promise<number | null | undefined>((resolve, reject) => {
      try {
        const tx = db.transaction('searchCache', 'readonly')
        const req = tx.objectStore('searchCache').get(key)
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => {
          const error = req.error as DOMException | null
          if (error?.name === 'InvalidStateError' || error?.message?.includes('closing')) {
            dbPromise = null
          }
          reject(error)
        }
      } catch (err) {
        const error = err as DOMException
        if (error?.name === 'InvalidStateError' || error?.message?.includes('closing')) {
          dbPromise = null
        }
        reject(error)
      }
    })
  } catch (err) {
    const error = err as DOMException
    if (error?.name === 'InvalidStateError' || error?.message?.includes('closing')) {
      dbPromise = null
    }
    throw error
  }
}

export async function setSearch(title: string, year: number | null, tmdbId: number | null): Promise<void> {
  try {
    const db = await openDb()
    const key = `${(title || '').trim().toLowerCase()}:${year ?? 0}`
    return new Promise<void>((resolve, reject) => {
      try {
        const tx = db.transaction('searchCache', 'readwrite')
        tx.objectStore('searchCache').put(tmdbId, key)
        tx.oncomplete = () => resolve()
        tx.onerror = () => {
          const error = tx.error as DOMException | null
          if (error?.name === 'InvalidStateError' || error?.message?.includes('closing')) {
            dbPromise = null
          }
          reject(error)
        }
      } catch (err) {
        const error = err as DOMException
        if (error?.name === 'InvalidStateError' || error?.message?.includes('closing')) {
          dbPromise = null
        }
        reject(error)
      }
    })
  } catch (err) {
    const error = err as DOMException
    if (error?.name === 'InvalidStateError' || error?.message?.includes('closing')) {
      dbPromise = null
    }
    throw error
  }
}

export async function getMovie(tmdbId: number): Promise<TmdbMovie | undefined> {
  try {
    const db = await openDb()
    return new Promise<TmdbMovie | undefined>((resolve, reject) => {
      try {
        const tx = db.transaction('movieCache', 'readonly')
        const req = tx.objectStore('movieCache').get(normalizeKey(tmdbId))
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => {
          const error = req.error as DOMException | null
          if (error?.name === 'InvalidStateError' || error?.message?.includes('closing')) {
            dbPromise = null
          }
          reject(error)
        }
      } catch (err) {
        const error = err as DOMException
        if (error?.name === 'InvalidStateError' || error?.message?.includes('closing')) {
          dbPromise = null
        }
        reject(error)
      }
    })
  } catch (err) {
    const error = err as DOMException
    if (error?.name === 'InvalidStateError' || error?.message?.includes('closing')) {
      dbPromise = null
    }
    throw error
  }
}

export async function setMovie(tmdbId: number, data: TmdbMovie): Promise<void> {
  try {
    const db = await openDb()
    return new Promise<void>((resolve, reject) => {
      try {
        const tx = db.transaction('movieCache', 'readwrite')
        tx.objectStore('movieCache').put(data, normalizeKey(tmdbId))
        tx.oncomplete = () => resolve()
        tx.onerror = () => {
          const error = tx.error as DOMException | null
          if (error?.name === 'InvalidStateError' || error?.message?.includes('closing')) {
            dbPromise = null
          }
          reject(error)
        }
      } catch (err) {
        const error = err as DOMException
        if (error?.name === 'InvalidStateError' || error?.message?.includes('closing')) {
          dbPromise = null
        }
        reject(error)
      }
    })
  } catch (err) {
    const error = err as DOMException
    if (error?.name === 'InvalidStateError' || error?.message?.includes('closing')) {
      dbPromise = null
    }
    throw error
  }
}

export async function getCredits(tmdbId: number): Promise<TmdbCredits | undefined> {
  try {
    const db = await openDb()
    return new Promise<TmdbCredits | undefined>((resolve, reject) => {
      try {
        const tx = db.transaction('creditsCache', 'readonly')
        const req = tx.objectStore('creditsCache').get(normalizeKey(tmdbId))
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => {
          const error = req.error as DOMException | null
          if (error?.name === 'InvalidStateError' || error?.message?.includes('closing')) {
            dbPromise = null
          }
          reject(error)
        }
      } catch (err) {
        const error = err as DOMException
        if (error?.name === 'InvalidStateError' || error?.message?.includes('closing')) {
          dbPromise = null
        }
        reject(error)
      }
    })
  } catch (err) {
    const error = err as DOMException
    if (error?.name === 'InvalidStateError' || error?.message?.includes('closing')) {
      dbPromise = null
    }
    throw error
  }
}

export async function setCredits(tmdbId: number, data: TmdbCredits): Promise<void> {
  try {
    const db = await openDb()
    return new Promise<void>((resolve, reject) => {
      try {
        const tx = db.transaction('creditsCache', 'readwrite')
        tx.objectStore('creditsCache').put(data, normalizeKey(tmdbId))
        tx.oncomplete = () => resolve()
        tx.onerror = () => {
          const error = tx.error as DOMException | null
          if (error?.name === 'InvalidStateError' || error?.message?.includes('closing')) {
            dbPromise = null
          }
          reject(error)
        }
      } catch (err) {
        const error = err as DOMException
        if (error?.name === 'InvalidStateError' || error?.message?.includes('closing')) {
          dbPromise = null
        }
        reject(error)
      }
    })
  } catch (err) {
    const error = err as DOMException
    if (error?.name === 'InvalidStateError' || error?.message?.includes('closing')) {
      dbPromise = null
    }
    throw error
  }
}

export async function getKeywords(tmdbId: number): Promise<TmdbKeywords | undefined> {
  try {
    const db = await openDb()
    return new Promise<TmdbKeywords | undefined>((resolve, reject) => {
      try {
        const tx = db.transaction('keywordsCache', 'readonly')
        const req = tx.objectStore('keywordsCache').get(normalizeKey(tmdbId))
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => {
          const error = req.error as DOMException | null
          if (error?.name === 'InvalidStateError' || error?.message?.includes('closing')) {
            dbPromise = null
          }
          reject(error)
        }
      } catch (err) {
        const error = err as DOMException
        if (error?.name === 'InvalidStateError' || error?.message?.includes('closing')) {
          dbPromise = null
        }
        reject(error)
      }
    })
  } catch (err) {
    const error = err as DOMException
    if (error?.name === 'InvalidStateError' || error?.message?.includes('closing')) {
      dbPromise = null
    }
    throw error
  }
}

export async function setKeywords(tmdbId: number, data: TmdbKeywords): Promise<void> {
  const db = await openDb()
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction('keywordsCache', 'readwrite')
    tx.objectStore('keywordsCache').put(data, normalizeKey(tmdbId))
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function clearCache(): Promise<void> {
  const db = await openDb()
  const storesToClear = ['searchCache', 'movieCache', 'creditsCache', 'keywordsCache'] as const
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(storesToClear, 'readwrite')
    storesToClear.forEach((name) => tx.objectStore(name).clear())
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function getResumeState(): Promise<ResumeState | null> {
  const db = await openDb()
  if (!db.objectStoreNames.contains('resumeState')) return null
  return new Promise<ResumeState | null>((resolve, reject) => {
    const tx = db.transaction('resumeState', 'readonly')
    const req = tx.objectStore('resumeState').get('current')
    req.onsuccess = () => resolve(req.result ?? null)
    req.onerror = () => reject(req.error)
  })
}

export async function setResumeState(state: ResumeState & { timestamp?: number }): Promise<void> {
  const db = await openDb()
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction('resumeState', 'readwrite')
    tx.objectStore('resumeState').put(state, 'current')
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function clearResumeState(): Promise<void> {
  const db = await openDb()
  if (!db.objectStoreNames.contains('resumeState')) return
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction('resumeState', 'readwrite')
    tx.objectStore('resumeState').delete('current')
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function getLastReport(): Promise<Analysis | null> {
  const db = await openDb()
  if (!db.objectStoreNames.contains('lastReport')) return null
  return new Promise<Analysis | null>((resolve, reject) => {
    const tx = db.transaction('lastReport', 'readonly')
    const req = tx.objectStore('lastReport').get('report')
    req.onsuccess = () => resolve(req.result ?? null)
    req.onerror = () => reject(req.error)
  })
}

export async function setLastReport(report: Analysis): Promise<void> {
  const db = await openDb()
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction('lastReport', 'readwrite')
    tx.objectStore('lastReport').put(report, 'report')
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}
