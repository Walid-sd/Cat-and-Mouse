import React from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import './progression.css'
import App from './App'
import ErrorBoundary from './ErrorBoundary'

if (import.meta.env.PROD) {
  const preloadRecoveryKey = 'cat-and-mouse-preload-recovery'
  window.addEventListener('vite:preloadError', event => {
    event.preventDefault()
    try {
      if (sessionStorage.getItem(preloadRecoveryKey) === '1') return
      sessionStorage.setItem(preloadRecoveryKey, '1')
    } catch {
      // If session storage is unavailable, avoid blocking the recovery attempt.
    }
    window.location.reload()
  })

  window.addEventListener('load', () => {
    try { sessionStorage.removeItem(preloadRecoveryKey) } catch { /* optional */ }
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Offline support is an enhancement; the game remains fully playable online.
      })
    }
  })
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)
