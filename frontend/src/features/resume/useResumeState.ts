import { useCallback, useEffect, useState } from 'react'
import { clearResumeState, getLastReport, getResumeState, setResumeState as persistResumeState } from '../../utils/indexedDbCache'
import type { ResumeState } from '../../types'
import { useAnalysisStore } from '../../store/analysisStore'

export const RESUME_PERSIST_INTERVAL_MS = 3000

export function useResumeState() {
  const [resumeState, setResumeState] = useState<ResumeState | null>(null)
  const [showResumeModal, setShowResumeModal] = useState(false)
  const [lastReportAvailable, setLastReportAvailable] = useState(false)
  const loading = useAnalysisStore((s) => s.loading)

  useEffect(() => {
    getResumeState().then((state) => {
      if (state && state.stage && state.timestamp) setResumeState(state)
    })
    getLastReport().then((report) => setLastReportAvailable(Boolean(report)))
  }, [])

  const updateResumeModalVisibility = useCallback(() => {
    if (resumeState && !loading) setShowResumeModal(true)
  }, [loading, resumeState])

  const clearResume = useCallback(async () => {
    setResumeState(null)
    setShowResumeModal(false)
    await clearResumeState().catch(() => {})
  }, [])

  const persistResume = useCallback(async (payload: ResumeState & { timestamp?: number }) => {
    await persistResumeState(payload).catch(() => {})
  }, [])

  return {
    resumeState,
    showResumeModal,
    lastReportAvailable,
    setLastReportAvailable,
    setShowResumeModal,
    updateResumeModalVisibility,
    clearResume,
    persistResume,
  }
}
