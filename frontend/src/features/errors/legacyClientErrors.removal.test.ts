import { existsSync } from 'node:fs'

import { expect, it } from 'vitest'

it('legacy client error api files are removed', () => {
  expect(existsSync('src/features/errors/clientErrorApi.ts')).toBe(false)
})
