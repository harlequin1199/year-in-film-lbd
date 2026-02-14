export function selectAnalysisSummary(state: { analysis: unknown | null; loading: boolean; error: string }) {
  return { hasAnalysis: Boolean(state.analysis), loading: state.loading, error: state.error }
}
