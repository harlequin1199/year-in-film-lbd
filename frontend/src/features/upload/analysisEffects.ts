import { clearResumeState, setLastReport } from '../../utils/indexedDbCache'
import type { Analysis } from '../../types'

export async function finalizeAnalysisEffects(result: Analysis, onReportSaved: () => void) {
  await setLastReport(result)
  onReportSaved()
  await clearResumeState()
}
