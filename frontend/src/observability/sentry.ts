import * as Sentry from '@sentry/react'

type EnvLike = {
  VITE_SENTRY_ENABLED?: string
  VITE_SENTRY_DSN?: string
  VITE_SENTRY_ENVIRONMENT?: string
  VITE_SENTRY_RELEASE?: string
}

export function shouldEnableSentry(env: EnvLike): boolean {
  return env.VITE_SENTRY_ENABLED === 'true' && Boolean(env.VITE_SENTRY_DSN)
}

export function initSentry(env: EnvLike = import.meta.env): void {
  if (!shouldEnableSentry(env)) return

  Sentry.init({
    dsn: env.VITE_SENTRY_DSN,
    environment: env.VITE_SENTRY_ENVIRONMENT || 'development',
    release: env.VITE_SENTRY_RELEASE,
    tracesSampleRate: 0.05,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0.01,
    beforeSend(event) {
      if (event.request?.headers) {
        delete event.request.headers.Authorization
        delete event.request.headers.authorization
      }
      return event
    },
  })
}
