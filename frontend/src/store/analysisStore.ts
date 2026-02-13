import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

interface AnalysisStoreState {
  analysis: unknown | null
  loading: boolean
  error: string
  lastUploadedFileName: string
  startRun: (fileName: string) => void
  completeRun: (analysis: unknown) => void
}

export const useAnalysisStore = create<AnalysisStoreState>()(devtools((set) => ({
  analysis: null,
  loading: false,
  error: '',
  lastUploadedFileName: '',
  startRun: (fileName) => set({ analysis: null, loading: true, error: '', lastUploadedFileName: fileName }, false, 'startRun'),
  completeRun: (analysis) => set({ analysis, loading: false }, false, 'completeRun'),
})))
