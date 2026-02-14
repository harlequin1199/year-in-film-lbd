import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('AppErrorBoundary', () => {
  it('renders technical fallback on crash path', () => {
    const source = readFileSync(new URL('./AppErrorBoundary.tsx', import.meta.url), 'utf-8')
    expect(source).toMatch(/class AppErrorBoundary/)
    expect(source).toMatch(/TechnicalFallback/)
  })
})
