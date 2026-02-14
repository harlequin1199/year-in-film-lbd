import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('TechnicalFallback', () => {
  it('contains retry and reload actions', () => {
    const source = readFileSync(new URL('./TechnicalFallback.tsx', import.meta.url), 'utf-8')
    expect(source).toMatch(/Retry/)
    expect(source).toMatch(/Reload/)
  })
})
