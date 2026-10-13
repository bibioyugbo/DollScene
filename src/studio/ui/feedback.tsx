import { Component, useEffect, useRef, type ErrorInfo, type ReactNode } from 'react'
import { useStudio, type Toast } from '../state/store'
import { Icon } from './icons'

/* ------------------------------------------------------------------ toasts */

function ToastItem({ t }: { t: Toast }) {
  const dismiss = useStudio((s) => s.dismissToast)
  useEffect(() => {
    const id = window.setTimeout(() => dismiss(t.id), t.tone === 'error' ? 5200 : 3200)
    return () => window.clearTimeout(id)
  }, [t, dismiss])
  const tone = t.tone === 'error' ? 'border-rose/60' : t.tone === 'success' ? 'border-accent/50' : 'border-line'
  return (
    <li className={`ds-pop ds-sheet pointer-events-auto flex items-center gap-2.5 rounded-2xl border px-3.5 py-2.5 text-[13px] shadow-lg ${tone}`}>
      <span className={t.tone === 'error' ? 'text-rose' : 'text-accent'}>
        <Icon name={t.tone === 'error' ? 'warning' : 'sparkle'} className="h-4 w-4" />
      </span>
      <span className="flex-1">{t.text}</span>
      <button type="button" aria-label="Dismiss" onClick={() => dismiss(t.id)} className="-mr-1 grid h-7 w-7 place-items-center rounded-full text-muted hover:text-text">
        <Icon name="close" className="h-3.5 w-3.5" />
      </button>
    </li>
  )
}

/** Accessible toasts: polite for news, assertive for errors. Duplicates never stack (see notify). */
export function Toasts() {
  const toasts = useStudio((s) => s.toasts)
  // in a room, keep clear of the tile grid on the right of wide screens
  const inRoom = useStudio((s) => s.phase === 'studio')
  const errors = toasts.filter((t) => t.tone === 'error')
  const rest = toasts.filter((t) => t.tone !== 'error')
  return (
    <div className={`pointer-events-none absolute inset-x-0 top-[calc(max(env(safe-area-inset-top),8px)+58px)] z-50 flex justify-center px-4 ${inRoom ? 'min-[900px]:pr-[470px]' : ''}`}>
      <div className="flex w-full max-w-sm flex-col gap-2">
        <ul role="alert" aria-live="assertive" className="flex flex-col gap-2">
          {errors.map((t) => (
            <ToastItem key={t.id} t={t} />
          ))}
        </ul>
        <ul role="status" aria-live="polite" className="flex flex-col gap-2">
          {rest.map((t) => (
            <ToastItem key={t.id} t={t} />
          ))}
        </ul>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ confirm */

/** The one confirmation dialog (store.ask): explicit, keyboard friendly, never a silent change. */
export function ConfirmDialog() {
  const req = useStudio((s) => s.confirm)
  const ok = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!req) return
    const prev = document.activeElement as HTMLElement | null
    ok.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') req.resolve(false)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      prev?.focus?.()
    }
  }, [req])
  if (!req) return null
  return (
    <div className="absolute inset-0 z-[60] grid place-items-center bg-ink/60 p-6" onPointerDown={(e) => e.target === e.currentTarget && req.resolve(false)}>
      <div role="alertdialog" aria-modal="true" aria-labelledby="ds-confirm-title" aria-describedby="ds-confirm-body" className="ds-pop ds-sheet w-full max-w-sm rounded-3xl border border-line p-5 shadow-2xl">
        <h2 id="ds-confirm-title" className="font-display text-[22px] leading-tight">
          {req.title}
        </h2>
        <p id="ds-confirm-body" className="mt-2 text-[13px] leading-relaxed text-muted">
          {req.body}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={() => req.resolve(false)} className="min-h-11 rounded-full border border-line px-5 text-[13px]">
            {req.cancel ?? 'Not now'}
          </button>
          <button ref={ok} type="button" onClick={() => req.resolve(true)} className="min-h-11 rounded-full bg-accent px-5 font-display text-[15px] text-accent-ink">
            {req.confirm}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ errors */

/** Plain diagnostics a player can paste into a report: no tokens, ids or server data. */
export function diagnostics(e: unknown) {
  const s = useStudio.getState()
  const err = e instanceof Error ? e : new Error(String(e))
  return [
    `DollScene Beauty Studio — ${new Date().toISOString()}`,
    `Where: ${s.phase} / ${s.category}`,
    `Error: ${err.name}: ${err.message}`,
    ...(err.stack ?? '').split('\n').slice(1, 6).map((l) => l.trim()),
    `Browser: ${navigator.userAgent}`,
  ].join('\n')
}

interface BoundaryProps {
  children: ReactNode
  /** Persist the last valid look before showing the fallback. */
  onCrash: () => void
  onBackToStudio: () => void
}

/**
 * Catches render errors in the app tree. Asset, event-handler and async errors are handled where
 * they happen (loaders, steps, session) and through installAsyncHandlers(); this is the net.
 */
export class AppErrorBoundary extends Component<BoundaryProps, { error: Error | null; copied: boolean }> {
  state = { error: null as Error | null, copied: false }
  static getDerivedStateFromError(error: Error) {
    return { error, copied: false }
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack)
    try {
      this.props.onCrash()
    } catch {
      /* the cache is best-effort */
    }
  }
  render() {
    const { error, copied } = this.state
    if (!error) return this.props.children
    return (
      <div className="grid h-dvh place-items-center bg-ink p-6 text-center text-text">
        <div className="ds-pop flex max-w-sm flex-col items-center gap-3">
          <svg viewBox="0 0 120 96" className="h-24 w-28 text-accent" aria-hidden fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            {/* a little compact mirror with a crack and a sparkle */}
            <circle cx="52" cy="50" r="30" />
            <circle cx="52" cy="50" r="22" opacity=".5" />
            <path d="M44 38l8 10-5 8 9 9" opacity=".8" />
            <path d="M94 18l3 8 8 3-8 3-3 8-3-8-8-3 8-3 3-8Z" />
          </svg>
          <h1 className="font-display text-[28px] leading-tight">Oops, the glam team hit a little glitch.</h1>
          <p className="text-[14px] text-muted">Your look is safe. Let’s get you back in the studio.</p>
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            <button type="button" className="min-h-11 rounded-full bg-accent px-5 font-display text-[15px] text-accent-ink" onClick={() => this.setState({ error: null })}>
              Try Again
            </button>
            <button
              type="button"
              className="min-h-11 rounded-full border border-line px-5 text-[13px]"
              onClick={() => {
                this.props.onBackToStudio()
                this.setState({ error: null })
              }}
            >
              Back to Studio
            </button>
            <button
              type="button"
              className="min-h-11 rounded-full border border-line px-5 text-[13px]"
              onClick={() =>
                navigator.clipboard?.writeText(diagnostics(error)).then(
                  () => this.setState({ copied: true }),
                  () => this.setState({ copied: false }),
                )
              }
            >
              {copied ? 'Copied for your report' : 'Report Issue'}
            </button>
          </div>
        </div>
      </div>
    )
  }
}

let installed = false

/** Async and event-handler errors that no boundary sees: one calm toast, never a success message. */
export function installAsyncHandlers() {
  if (installed) return
  installed = true
  window.addEventListener('unhandledrejection', (e) => {
    console.error('Unhandled rejection', e.reason)
    useStudio.getState().notify('Something didn’t load. Your current look is safe.', 'error')
    e.preventDefault()
  })
  window.addEventListener('error', (e) => {
    // Script errors from cross-origin assets carry no detail: log, don't alarm.
    if (!e.error) return
    console.error(e.error)
    useStudio.getState().notify('Something glitched. Your current look is safe.', 'error')
  })
}
