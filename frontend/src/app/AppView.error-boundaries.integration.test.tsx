import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('AppView feature boundaries', () => {
  it('wires root and feature boundaries', () => {
    const appView = readFileSync(resolve(process.cwd(), 'src/app/AppView.tsx'), 'utf-8')
    const main = readFileSync(resolve(process.cwd(), 'src/main.tsx'), 'utf-8')
    expect(appView).toMatch(/FeatureErrorBoundary/)
    expect(main).toMatch(/AppErrorBoundary/)
  })
})
