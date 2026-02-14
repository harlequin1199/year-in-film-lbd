import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Analytics } from '@vercel/analytics/react'
import './styles.css'
import App from './App'
import { AppErrorBoundary } from './features/errors/AppErrorBoundary'

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Root element not found')
}

createRoot(rootElement).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
      <Analytics />
    </AppErrorBoundary>
  </StrictMode>,
)
