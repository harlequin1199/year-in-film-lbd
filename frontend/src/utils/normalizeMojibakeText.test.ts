import { describe, expect, it } from 'vitest'
import { normalizeMojibakeText } from './normalizeMojibakeText'

describe('normalizeMojibakeText', () => {
  it('keeps readable text unchanged', () => {
    const input = 'Сервис временно недоступен.'
    expect(normalizeMojibakeText(input)).toBe(input)
  })

  it('normalizes cp1251-latin1 mojibake', () => {
    const input = 'Ñåðâèñ âðåìåííî íåäîñòóïåí.'
    expect(normalizeMojibakeText(input)).toBe('Сервис временно недоступен.')
  })
})
