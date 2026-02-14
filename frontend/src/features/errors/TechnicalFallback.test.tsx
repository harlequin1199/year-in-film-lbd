import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('TechnicalFallback', () => {
  it('contains retry and reload actions', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/features/errors/TechnicalFallback.tsx'), 'utf-8')
    expect(source).toMatch(/Retry/)
    expect(source).toMatch(/Reload/)
  })
})
