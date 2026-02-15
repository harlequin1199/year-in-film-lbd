import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('ProgressStatus copy', () => {
  it('contains readable Russian labels for progress steps', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/ProgressStatus.tsx'), 'utf-8')
    expect(source).toMatch(/\\u041f\\u043e\\u0438\\u0441\\u043a \\u0444\\u0438\\u043b\\u044c\\u043c\\u043e\\u0432 \\u0432 TMDb/)
    expect(source).toMatch(/\\u0417\\u0430\\u0433\\u0440\\u0443\\u0437\\u043a\\u0430 \\u0434\\u0430\\u043d\\u043d\\u044b\\u0445 TMDb/)
    expect(source).toMatch(/\\u041e\\u0441\\u0442\\u0430\\u043d\\u043e\\u0432\\u0438\\u0442\\u044c \\u0430\\u043d\\u0430\\u043b\\u0438\\u0437/)
  })
})
