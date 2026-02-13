/**
 * Web Worker: parse CSV without blocking UI.
 * Posts: { type: 'progress', stage, message, done, total }
 *        { type: 'rows', rows } for ratings
 */

import { parseRatings } from './csvParseCore'

self.onmessage = async (e) => {
  const { type, ratingsText } = e.data
  if (type !== 'parse') return
  try {
    self.postMessage({ type: 'progress', stage: 'parsing', message: 'Чтение CSV', done: 0, total: 1, percent: 0 })
    const rows = parseRatings(ratingsText || '')
    self.postMessage({ type: 'progress', stage: 'parsing', message: 'Чтение CSV', done: 1, total: 1, percent: 4 })
    self.postMessage({ type: 'rows', rows })
  } catch (err) {
    self.postMessage({ type: 'error', message: err.message || 'Ошибка парсинга CSV' })
  }
}
