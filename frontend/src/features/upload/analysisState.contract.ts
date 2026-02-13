export function assertAnalysisStateInvariants(state: {
  showMobileModal: boolean
  pendingFiles: unknown
}) {
  if (!state.showMobileModal && state.pendingFiles != null) {
    throw new Error('Invariant failed: pendingFiles requires showMobileModal=true')
  }
}
