import { describe, expect, it } from 'vitest'
import { assertAnalysisStateInvariants } from './analysisState.contract'

describe('analysis state invariants', () => {
  it('throws when pendingFiles exists but mobile modal is closed', () => {
    expect(() => assertAnalysisStateInvariants({
      loading: false,
      progress: null,
      analysis: null,
      showMobileModal: false,
      pendingFiles: { parsedRows: [] },
    } as never)).toThrow(/pendingFiles/i)
  })
})
