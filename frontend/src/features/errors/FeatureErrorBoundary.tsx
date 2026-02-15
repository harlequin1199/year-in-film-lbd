import React from 'react'
import * as Sentry from '@sentry/react'
import { TechnicalFallback } from './TechnicalFallback'

type FeatureErrorBoundaryProps = React.PropsWithChildren<{
  featureName: string
}>

type FeatureErrorBoundaryState = {
  hasError: boolean
  errorId: string
  message: string
}

export class FeatureErrorBoundary extends React.Component<FeatureErrorBoundaryProps, FeatureErrorBoundaryState> {
  state: FeatureErrorBoundaryState = {
    hasError: false,
    errorId: '',
    message: '',
  }

  static getDerivedStateFromError(error: Error): FeatureErrorBoundaryState {
    return {
      hasError: true,
      errorId: crypto.randomUUID(),
      message: error.message || 'Feature failed to render',
    }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    Sentry.captureException(error, {
      tags: { boundary_scope: 'feature', feature_name: this.props.featureName },
      extra: { componentStack: info.componentStack },
    })
  }

  private reset = () => {
    this.setState({ hasError: false, errorId: '', message: '' })
  }

  override render() {
    if (this.state.hasError) {
      return (
        <TechnicalFallback
          mode="feature"
          errorId={`${this.props.featureName}-${this.state.errorId}`}
          message={this.state.message}
          onRetry={this.reset}
        />
      )
    }

    return this.props.children
  }
}
