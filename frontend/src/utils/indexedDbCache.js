const DB_NAME = 'year-in-film-cache'
const DB_VERSION = 2
const STORES = ['searchCache', 'movieCache', 'creditsCache', 'keywordsCache', 'resumeState', 'lastReport']

let dbPromise = null

function openDb() {
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
  dbPromise = new Promise((resolve, reject) => {
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
  try {
    const db = await openDb()
    const key = `${(title || '').trim().toLowerCase()}:${year ?? 0}`
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction('searchCache', 'readonly')
        const req = tx.objectStore('searchCache').get(key)
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => {
          if (req.error?.name === 'InvalidStateError' || req.error?.message?.includes('closing')) {
            dbPromise = null
          }
          reject(req.error)
        }
      } catch (err) {
        if (err?.name === 'InvalidStateError' || err?.message?.includes('closing')) {
          dbPromise = null
        }
        reject(err)
      }
    })
  } catch (err) {
    if (err?.name === 'InvalidStateError' || err?.message?.includes('closing')) {
      dbPromise = null
    }
    throw err
  }
}

export async function setSearch(title, year, tmdbId) {
  try {
    const db = await openDb()
    const key = `${(title || '').trim().toLowerCase()}:${year ?? 0}`
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction('searchCache', 'readwrite')
        tx.objectStore('searchCache').put(tmdbId, key)
        tx.oncomplete = () => resolve()
        tx.onerror = () => {
          if (tx.error?.name === 'InvalidStateError' || tx.error?.message?.includes('closing')) {
            dbPromise = null
          }
          reject(tx.error)
        }
      } catch (err) {
        if (err?.name === 'InvalidStateError' || err?.message?.includes('closing')) {
          dbPromise = null
        }
        reject(err)
      }
    })
  } catch (err) {
    if (err?.name === 'InvalidStateError' || err?.message?.includes('closing')) {
      dbPromise = null
    }
    throw err
  }
}

export async function getMovie(tmdbId) {
  try {
    const db = await openDb()
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction('movieCache', 'readonly')
        const req = tx.objectStore('movieCache').get(normalizeKey(tmdbId))
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => {
          if (req.error?.name === 'InvalidStateError' || req.error?.message?.includes('closing')) {
            dbPromise = null
          }
          reject(req.error)
        }
      } catch (err) {
        if (err?.name === 'InvalidStateError' || err?.message?.includes('closing')) {
          dbPromise = null
        }
        reject(err)
      }
    })
  } catch (err) {
    if (err?.name === 'InvalidStateError' || err?.message?.includes('closing')) {
      dbPromise = null
    }
    throw err
  }
}

export async function setMovie(tmdbId, data) {
  try {
    const db = await openDb()
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction('movieCache', 'readwrite')
        tx.objectStore('movieCache').put(data, normalizeKey(tmdbId))
        tx.oncomplete = () => resolve()
        tx.onerror = () => {
          if (tx.error?.name === 'InvalidStateError' || tx.error?.message?.includes('closing')) {
            dbPromise = null
          }
          reject(tx.error)
        }
      } catch (err) {
        if (err?.name === 'InvalidStateError' || err?.message?.includes('closing')) {
          dbPromise = null
        }
        reject(err)
      }
    })
  } catch (err) {
    if (err?.name === 'InvalidStateError' || err?.message?.includes('closing')) {
      dbPromise = null
    }
    throw err
  }
}

export async function getCredits(tmdbId) {
  try {
    const db = await openDb()
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction('creditsCache', 'readonly')
        const req = tx.objectStore('creditsCache').get(normalizeKey(tmdbId))
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => {
          if (req.error?.name === 'InvalidStateError' || req.error?.message?.includes('closing')) {
            dbPromise = null
          }
          reject(req.error)
        }
      } catch (err) {
        if (err?.name === 'InvalidStateError' || err?.message?.includes('closing')) {
          dbPromise = null
        }
        reject(err)
      }
    })
  } catch (err) {
    if (err?.name === 'InvalidStateError' || err?.message?.includes('closing')) {
      dbPromise = null
    }
    throw err
  }
}

export async function setCredits(tmdbId, data) {
  try {
    const db = await openDb()
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction('creditsCache', 'readwrite')
        tx.objectStore('creditsCache').put(data, normalizeKey(tmdbId))
        tx.oncomplete = () => resolve()
        tx.onerror = () => {
          if (tx.error?.name === 'InvalidStateError' || tx.error?.message?.includes('closing')) {
            dbPromise = null
          }
          reject(tx.error)
        }
      } catch (err) {
        if (err?.name === 'InvalidStateError' || err?.message?.includes('closing')) {
          dbPromise = null
        }
        reject(err)
      }
    })
  } catch (err) {
    if (err?.name === 'InvalidStateError' || err?.message?.includes('closing')) {
      dbPromise = null
    }
    throw err
  }
}

export async function getKeywords(tmdbId) {
  try {
    const db = await openDb()
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction('keywordsCache', 'readonly')
        const req = tx.objectStore('keywordsCache').get(normalizeKey(tmdbId))
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => {
          if (req.error?.name === 'InvalidStateError' || req.error?.message?.includes('closing')) {
            dbPromise = null
          }
          reject(req.error)
        }
      } catch (err) {
        if (err?.name === 'InvalidStateError' || err?.message?.includes('closing')) {
          dbPromise = null
        }
        reject(err)
      }
    })
  } catch (err) {
    if (err?.name === 'InvalidStateError' || err?.message?.includes('closing')) {
      dbPromise = null
    }
    throw err
  }
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
