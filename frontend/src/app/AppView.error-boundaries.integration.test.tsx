import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('AppView feature boundaries', () => {
  it('wires root and feature boundaries', () => {
    const appView = readFileSync(new URL('./AppView.tsx', import.meta.url), 'utf-8')
    const main = readFileSync(new URL('../main.tsx', import.meta.url), 'utf-8')
    expect(appView).toMatch(/FeatureErrorBoundary/)
    expect(main).toMatch(/AppErrorBoundary/)
  })
})
