import type { ClientErrorEventInput } from './clientError.types'

export async function postClientErrorEvent(payload: ClientErrorEventInput): Promise<void> {
  try {
    await fetch('/api/client-errors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    })
  } catch {
    // Fire-and-forget logging must never crash the UI.
  }
}
