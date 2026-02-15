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
  abortRun: () => set({ analysis: null, loading: false, progress: null, error: '\u0410\u043d\u0430\u043b\u0438\u0437 \u043e\u0441\u0442\u0430\u043d\u043e\u0432\u043b\u0435\u043d.' }),
  cleanupRun: () => set({ loading: false, progress: null, retryMessage: '' }),
  resetForTests: () => set({ ...initialState }),
}))
