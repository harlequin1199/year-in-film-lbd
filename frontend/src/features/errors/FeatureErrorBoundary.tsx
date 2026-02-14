import React from 'react'
import { postClientErrorEvent } from './clientErrorApi'
import { TechnicalFallback } from './TechnicalFallback'

type FeatureErrorBoundaryProps = React.PropsWithChildren<{
  featureName: string
}>

type BoundaryState = { hasError: boolean; errorId: string; message: string }

export class FeatureErrorBoundary extends React.Component<FeatureErrorBoundaryProps, BoundaryState> {
  state: BoundaryState = { hasError: false, errorId: '', message: '' }

  static getDerivedStateFromError(error: Error): BoundaryState {
    return {
      hasError: true,
      errorId: crypto.randomUUID(),
      message: error.message || 'Unexpected error',
    }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    void postClientErrorEvent({
      errorId: this.state.errorId,
      message: error.message || 'Unexpected error',
      stack: error.stack ?? null,
      componentStack: info.componentStack ?? null,
      boundaryScope: 'feature',
      featureName: this.props.featureName,
      route: window.location.pathname,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
    })
  }

  private reset = () => this.setState({ hasError: false, errorId: '', message: '' })

  render() {
    if (this.state.hasError) {
      return (
        <TechnicalFallback
          mode="feature"
          errorId={this.state.errorId}
          message={this.state.message}
          onRetry={this.reset}
        />
      )
    }
    return this.props.children
  }
}
