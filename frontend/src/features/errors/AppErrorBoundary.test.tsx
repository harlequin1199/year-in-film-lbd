import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('AppErrorBoundary', () => {
  it('renders technical fallback on crash path', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/features/errors/AppErrorBoundary.tsx'), 'utf-8')
    expect(source).toMatch(/class AppErrorBoundary/)
    expect(source).toMatch(/TechnicalFallback/)
  })
})
