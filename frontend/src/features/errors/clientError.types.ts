export type ClientErrorBoundaryScope = 'global' | 'feature'

export type ClientErrorEventInput = {
  errorId: string
  message: string
  stack: string | null
  componentStack: string | null
  boundaryScope: ClientErrorBoundaryScope
  featureName: string | null
  route: string | null
  userAgent: string | null
  timestamp: string
}
