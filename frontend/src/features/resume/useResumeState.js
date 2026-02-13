import { useCallback, useEffect, useState } from 'react'
import { clearResumeState, getLastReport, getResumeState, setResumeState as persistResumeState } from '../../utils/indexedDbCache.js'

export const RESUME_PERSIST_INTERVAL_MS = 3000

export function useResumeState() {
  const [resumeState, setResumeState] = useState(null)
  const [showResumeModal, setShowResumeModal] = useState(false)
  const [lastReportAvailable, setLastReportAvailable] = useState(false)

  useEffect(() => {
    getResumeState().then((state) => {
      if (state && state.stage && state.updatedAt) setResumeState(state)
    })
    getLastReport().then((report) => setLastReportAvailable(Boolean(report)))
  }, [])

  const updateResumeModalVisibility = useCallback((loading) => {
    if (resumeState && !loading) setShowResumeModal(true)
  }, [resumeState])

  const clearResume = useCallback(async () => {
    setResumeState(null)
    setShowResumeModal(false)
    await clearResumeState().catch(() => {})
  }, [])

  const persistResume = useCallback(async (payload) => {
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
