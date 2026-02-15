import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('ByYearChart regression', () => {
  it('does not call setState from ref callback during render', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/ByYearChart.tsx'), 'utf-8')
    expect(source).not.toMatch(/ref=\{\(el\)\s*=>\s*\{[\s\S]*setContainerWidth\(/m)
  })
})
