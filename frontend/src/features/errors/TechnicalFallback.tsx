type TechnicalFallbackProps = {
  mode: 'global' | 'feature'
  errorId: string
  message: string
  onRetry: () => void
  onGoHome?: () => void
}

export function TechnicalFallback(props: TechnicalFallbackProps) {
  return (
    <section role="alert" data-mode={props.mode}>
      <p>Error ID: {props.errorId}</p>
      <p>{props.message}</p>
      <button onClick={props.onRetry}>Retry</button>
      <button onClick={() => window.location.reload()}>Reload</button>
      <button onClick={props.onGoHome}>Go Home</button>
    </section>
  )
}
