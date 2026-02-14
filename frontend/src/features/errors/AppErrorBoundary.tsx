import React from 'react'
import { TechnicalFallback } from './TechnicalFallback'

type AppErrorBoundaryState = {
  hasError: boolean
  errorId: string
  message: string
}

export class AppErrorBoundary extends React.Component<React.PropsWithChildren, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = {
    hasError: false,
    errorId: '',
    message: '',
  }

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return {
      hasError: true,
      errorId: crypto.randomUUID(),
      message: error.message || 'Unexpected error',
    }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    void error
    void info
    // Client error reporting hook point.
  }

  private reset = () => {
    this.setState({ hasError: false, errorId: '', message: '' })
  }

  private goHome = () => {
    window.location.assign('/')
  }

  override render() {
    if (this.state.hasError) {
      return (
        <TechnicalFallback
          mode="global"
          errorId={this.state.errorId}
          message={this.state.message}
          onRetry={this.reset}
          onGoHome={this.goHome}
        />
      )
    }

    return this.props.children
  }
}
