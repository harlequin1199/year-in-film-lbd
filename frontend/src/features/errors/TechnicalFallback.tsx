interface TechnicalFallbackProps {
  mode: 'global' | 'feature'
  errorId: string
  message: string
  onRetry: () => void
  onGoHome?: () => void
}

export function TechnicalFallback({ mode, errorId, message, onRetry, onGoHome }: TechnicalFallbackProps) {
  return (
    <section role="alert" className={`technical-fallback technical-fallback-${mode}`}>
      <h2>Unexpected error</h2>
      <p>Error ID: {errorId}</p>
      <p>{message}</p>
      <div className="technical-fallback-actions">
        <button type="button" className="btn" onClick={onRetry}>Retry</button>
        <button type="button" className="btn btn-secondary" onClick={() => window.location.reload()}>Reload</button>
        {onGoHome && (
          <button type="button" className="btn btn-secondary" onClick={onGoHome}>Go Home</button>
        )}
      </div>
    </section>
  )
}
