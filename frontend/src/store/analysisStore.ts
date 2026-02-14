import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { Analysis, Progress } from '../types'

interface AnalysisStoreState {
  analysis: Analysis | null
  loading: boolean
  progress: Progress | null
  error: string
  retryMessage: string
  lastUploadedFileName: string
  startRun: (fileName: string) => void
  setProgress: (progress: Progress) => void
  completeRun: (analysis: Analysis) => void
  failRun: (message: string) => void
  abortRun: () => void
  cleanupRun: () => void
}

export const useAnalysisStore = create<AnalysisStoreState>()(devtools((set) => ({
  analysis: null,
  loading: false,
  progress: null,
  error: '',
  retryMessage: '',
  lastUploadedFileName: '',
  startRun: (fileName) => set({ analysis: null, loading: true, error: '', lastUploadedFileName: fileName }, false, 'startRun'),
  setProgress: (progress) => set({ progress }, false, 'setProgress'),
  completeRun: (analysis) => set({ analysis, loading: false }, false, 'completeRun'),
  failRun: (message) => set({ loading: false, progress: null, error: message }, false, 'failRun'),
  abortRun: () => set({ loading: false, progress: null, error: 'Анализ остановлен.' }, false, 'abortRun'),
  cleanupRun: () => set({ loading: false, progress: null, retryMessage: '' }, false, 'cleanupRun'),
})))
