import { create } from 'zustand'
import type { Analysis, Progress } from '../types'

export interface AnalysisStoreState {
  analysis: Analysis | null
  loading: boolean
  error: string
  progress: Progress | null
  retryMessage: string
  lastUploadedFileName: string
  simplifiedMode: boolean
  startRun: (fileName: string) => void
  setProgress: (progress: Progress | null) => void
  completeRun: (analysis: Analysis) => void
  failRun: (message: string) => void
  abortRun: () => void
  cleanupRun: () => void
  resetForTests: () => void
}

const initialState = {
  analysis: null,
  loading: false,
  error: '',
  progress: null,
  retryMessage: '',
  lastUploadedFileName: '',
  simplifiedMode: false,
}

export const useAnalysisStore = create<AnalysisStoreState>((set) => ({
  ...initialState,
  startRun: (fileName) => set({ analysis: null, loading: true, error: '', progress: null, retryMessage: '', lastUploadedFileName: fileName }),
  setProgress: (progress) => set({ progress }),
  completeRun: (analysis) => set({ analysis, loading: false, progress: null, error: '', retryMessage: '', simplifiedMode: analysis.simplifiedMode }),
  failRun: (message) => set({ loading: false, progress: null, error: message }),
  abortRun: () => set({ analysis: null, loading: false, progress: null, error: 'Анализ остановлен.' }),
  cleanupRun: () => set({ loading: false, progress: null, retryMessage: '' }),
  resetForTests: () => set({ ...initialState }),
}))
