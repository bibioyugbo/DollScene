import { Component, StrictMode, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import App from './App.tsx'
import { SessionProvider } from './app/SessionProvider'
import { track } from './lib/analytics'
import './index.css'

/** Last-resort error screen so a crash never shows a blank page. */
class AppErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  componentDidCatch(error: Error) {
    track('app_error', { message: error.message.slice(0, 100) })
    console.error(error)
  }
  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="grid min-h-dvh place-items-center bg-background p-6 text-center text-foreground">
        <div className="flex max-w-sm flex-col items-center gap-3">
          <p className="font-display text-2xl font-bold">Something glitched</p>
          <p className="text-muted-foreground">Your doll is safe. Reload to get back in.</p>
          <button type="button" className="min-h-12 rounded-full bg-primary px-6 font-semibold text-primary-foreground" onClick={() => location.reload()}>
            Reload
          </button>
        </div>
      </div>
    )
  }
}

// After a deploy, an open tab may request chunks that no longer exist: reload once.
window.addEventListener('vite:preloadError', () => {
  if (sessionStorage.getItem('dc-reloaded')) return
  sessionStorage.setItem('dc-reloaded', '1')
  location.reload()
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <BrowserRouter>
        <SessionProvider>
          <App />
        </SessionProvider>
      </BrowserRouter>
    </AppErrorBoundary>
  </StrictMode>,
)
