import React from 'react'
import { postClientErrorEvent } from './clientErrorApi'
import { TechnicalFallback } from './TechnicalFallback'

type BoundaryState = { hasError: boolean; errorId: string; message: string }

export class AppErrorBoundary extends React.Component<React.PropsWithChildren, BoundaryState> {
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
      boundaryScope: 'global',
      featureName: null,
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
          mode="global"
          errorId={this.state.errorId}
          message={this.state.message}
          onRetry={this.reset}
        />
      )
    }
    return this.props.children
  }
}
