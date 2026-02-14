import type { Analysis, Progress } from '../types'

export function selectAnalysisSummary(state: { analysis: Analysis | null; loading: boolean; error: string }) {
  return {
    hasAnalysis: Boolean(state.analysis),
    loading: state.loading,
    error: state.error,
  }
}

export function selectProgressView(state: { progress: Progress | null; loading: boolean }) {
  return {
    hasProgress: state.progress !== null,
    loading: state.loading,
    percent: state.progress?.percent ?? 0,
    stage: state.progress?.stage ?? '',
    message: state.progress?.message ?? '',
  }
}
