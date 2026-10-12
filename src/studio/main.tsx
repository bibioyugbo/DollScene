import { Component, StrictMode, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import StudioApp from './StudioApp'
import './studio.css'

/** Last-resort screen: never a blank frame inside Lagos Life. */
class Crash extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(e: Error) {
    console.error(e)
  }
  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="grid h-dvh place-items-center bg-ink p-6 text-center">
        <div className="flex max-w-xs flex-col items-center gap-3">
          <p className="font-display text-2xl italic">Something glitched</p>
          <p className="text-[13px] text-muted">Your looks are safe. Reload to get back into the studio.</p>
          <button type="button" className="min-h-11 rounded-full bg-accent px-6 text-[13px] font-semibold text-accent-ink" onClick={() => location.reload()}>
            Reload
          </button>
        </div>
      </div>
    )
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Crash>
      <StudioApp />
    </Crash>
  </StrictMode>,
)
