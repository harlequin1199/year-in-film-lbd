import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

describe('sentry deps/env docs contract', () => {
  it('declares @sentry/react and sentry env vars in docs', () => {
    const pkg = readFileSync('package.json', 'utf-8')
    const readme = readFileSync('../README.md', 'utf-8')
    expect(pkg).toMatch(/@sentry\/react/)
    expect(readme).toMatch(/SENTRY_DSN/)
  })
})
