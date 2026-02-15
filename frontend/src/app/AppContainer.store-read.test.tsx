import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('AppContainer store read path', () => {
  it('uses analysis store selectors for business read path', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/app/AppContainer.tsx'), 'utf-8')
    expect(source).toMatch(/useAnalysisStore/)
    expect(source).toMatch(/selectAnalysisSummary/)
    expect(source).toMatch(/selectProgressView/)
  })

  it('keeps progress message for TMDb search in readable Russian', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/app/AppContainer.tsx'), 'utf-8')
    expect(source).toMatch(/Поиск фильмов в TMDb/)
  })
})
