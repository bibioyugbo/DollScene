import { useGLTF, useProgress, useTexture } from '@react-three/drei'
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { useMediaQuery, useReducedMotion } from '../hooks/useMediaQuery'
import { url, useCatalog, type CharacterCatalog } from './character/catalog'
import { BodyEditor } from './editors/BodyEditor'
import { FaceEditor } from './editors/FaceEditor'
import { FashionEditor } from './editors/FashionEditor'
import { HairEditor } from './editors/HairEditor'
import { LooksPanel } from './editors/LooksPanel'
import { MakeupEditor } from './editors/MakeupEditor'
import { PlayPanel } from './editors/PlayPanel'
import { TransformStudio } from './editors/TransformStudio'
import { startSession } from './session'
import { StudioStage, type StageTheme } from './stage/StudioStage'
import { useStudio, type Angle, type Framing, type Tab } from './state/store'

const TABS: { id: Tab; name: string }[] = [
  { id: 'makeup', name: 'Makeup' },
  { id: 'face', name: 'Face' },
  { id: 'hair', name: 'Hair' },
  { id: 'fashion', name: 'Fashion' },
  { id: 'body', name: 'Body' },
  { id: 'transform', name: 'Transform' },
  { id: 'looks', name: 'Looks' },
  { id: 'play', name: 'Play' },
]

const DARK: StageTheme = { top: '#2b1c22', bottom: '#0d090b', glow: '#6e4a3c', floor: '#1b1215' }
const LIGHT: StageTheme = { top: '#f1e5dc', bottom: '#d6c3b6', glow: '#ffffff', floor: '#e6d8cd' }

function Icon({ d, className = 'h-5 w-5' }: { d: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  )
}

function IconButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick} className="grid h-11 w-11 place-items-center rounded-full text-text transition-opacity active:bg-raised disabled:opacity-30">
      {children}
    </button>
  )
}

function TopBar() {
  const player = useStudio((s) => s.player)
  const connection = useStudio((s) => s.connection)
  const canUndo = useStudio((s) => s.past.length > 0)
  const canRedo = useStudio((s) => s.future.length > 0)
  const undo = useStudio((s) => s.undo)
  const redo = useStudio((s) => s.redo)
  const setTab = useStudio((s) => s.setTab)
  const badge = { live: null, test: 'Sandbox', preview: 'Preview', offline: 'Offline', connecting: '…' }[connection]
  return (
    <header className="pointer-events-auto absolute inset-x-0 top-0 z-20 flex items-center gap-2 px-3 pt-[max(env(safe-area-inset-top),8px)]">
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        {player?.avatar ? <img src={player.avatar} alt="" className="h-8 w-8 rounded-full border border-line object-cover" /> : <span className="h-8 w-8 rounded-full border border-line bg-raised" aria-hidden />}
        <div className="min-w-0 leading-none">
          <p className="flex items-center gap-1.5">
            <span className="font-display text-[19px] italic tracking-tight">DollScene</span>
            {badge && <span className="rounded-sm border border-line px-1 py-px text-[9px] uppercase tracking-[0.12em] text-accent">{badge}</span>}
          </p>
          <p className="mt-0.5 truncate text-[10px] uppercase tracking-[0.2em] text-muted">{player ? player.name : 'Beauty Studio'}</p>
        </div>
      </div>
      <IconButton label="Undo" onClick={undo} disabled={!canUndo}>
        <Icon d="M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
      </IconButton>
      <IconButton label="Redo" onClick={redo} disabled={!canRedo}>
        <Icon d="m15 14 5-5-5-5m5 5H9.5a5.5 5.5 0 0 0 0 11H13" />
      </IconButton>
      <button type="button" onClick={() => setTab('looks')} className="min-h-10 rounded-full bg-accent px-4 text-[13px] font-semibold text-accent-ink active:opacity-85">
        Save look
      </button>
    </header>
  )
}

const FRAMINGS: { id: Framing; name: string }[] = [
  { id: 'face', name: 'Face' },
  { id: 'bust', name: 'Bust' },
  { id: 'full', name: 'Full' },
]
const ANGLES: { id: Angle; name: string }[] = [
  { id: 'front', name: 'Front' },
  { id: 'three-quarter', name: '¾' },
  { id: 'side', name: 'Side' },
  { id: 'back', name: 'Back' },
]

function ViewRail() {
  const framing = useStudio((s) => s.framing)
  const angle = useStudio((s) => s.angle)
  const spin = useStudio((s) => s.spin)
  const setFraming = useStudio((s) => s.setFraming)
  const setAngle = useStudio((s) => s.setAngle)
  const setComparing = useStudio((s) => s.setComparing)
  const comparing = useStudio((s) => s.comparing)
  const pill = (on: boolean) => `min-h-8 w-11 rounded-full text-[10.5px] tracking-wide transition-colors ${on ? 'bg-text text-ink' : 'text-muted active:bg-raised'}`
  return (
    <nav aria-label="View" className="pointer-events-auto absolute right-2 top-[calc(max(env(safe-area-inset-top),8px)+52px)] z-20 flex flex-col items-center gap-2">
      <div className="ds-sheet flex flex-col gap-0.5 rounded-full border border-line p-1">
        {FRAMINGS.map((f) => (
          <button key={f.id} type="button" aria-pressed={framing === f.id} className={pill(framing === f.id)} onClick={() => setFraming(f.id)}>
            {f.name}
          </button>
        ))}
      </div>
      <div className="ds-sheet flex flex-col gap-0.5 rounded-full border border-line p-1">
        {ANGLES.map((a) => (
          <button key={a.id} type="button" aria-pressed={angle === a.id && Math.abs(spin) < 0.01} className={pill(angle === a.id && Math.abs(spin) < 0.01)} onClick={() => setAngle(a.id)}>
            {a.name}
          </button>
        ))}
      </div>
      <button
        type="button"
        aria-pressed={comparing}
        aria-label="Hold to see before"
        className={`ds-sheet min-h-11 w-[52px] rounded-full border text-[10.5px] leading-tight ${comparing ? 'border-accent text-accent' : 'border-line text-muted'}`}
        onPointerDown={(e) => {
          ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
          setComparing(true)
        }}
        onPointerUp={() => setComparing(false)}
        onPointerCancel={() => setComparing(false)}
        onKeyDown={(e) => e.key === ' ' && setComparing(true)}
        onKeyUp={() => setComparing(false)}
        onContextMenu={(e) => e.preventDefault()}
      >
        Hold
        <br />
        Before
      </button>
    </nav>
  )
}

function Editor({ tab, catalog }: { tab: Tab; catalog: CharacterCatalog }) {
  switch (tab) {
    case 'face':
      return <FaceEditor />
    case 'makeup':
      return <MakeupEditor />
    case 'hair':
      return <HairEditor catalog={catalog} />
    case 'body':
      return <BodyEditor />
    case 'fashion':
      return <FashionEditor catalog={catalog} />
    case 'transform':
      return <TransformStudio />
    case 'looks':
      return <LooksPanel />
    case 'play':
      return <PlayPanel />
  }
}

function Dock({ catalog, onHeight }: { catalog: CharacterCatalog; onHeight: (px: number) => void }) {
  const tab = useStudio((s) => s.tab)
  const open = useStudio((s) => s.sheetOpen)
  const setTab = useStudio((s) => s.setTab)
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(() => onHeight(el.getBoundingClientRect().height))
    ro.observe(el)
    return () => ro.disconnect()
  }, [onHeight])
  return (
    <div ref={ref} className="ds-sheet pointer-events-auto absolute inset-x-0 bottom-0 z-20 flex flex-col rounded-t-[22px] border-t border-line pb-[env(safe-area-inset-bottom)]">
      <button
        type="button"
        aria-label={open ? 'Collapse editor' : 'Expand editor'}
        aria-expanded={open}
        onClick={() => useStudio.setState({ sheetOpen: !open })}
        className="mx-auto flex h-6 w-24 items-center justify-center"
      >
        <span className="h-1 w-10 rounded-full bg-line" />
      </button>
      <div role="tablist" aria-label="Studio" className="ds-scroll-x flex gap-5 border-b border-line px-4">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => (tab === t.id && open ? useStudio.setState({ sheetOpen: false }) : setTab(t.id))}
            className={`relative min-h-11 shrink-0 text-[12px] font-medium uppercase tracking-[0.16em] transition-colors ${tab === t.id ? 'text-text' : 'text-muted'}`}
          >
            {t.name}
            {tab === t.id && <span className="absolute inset-x-0 -bottom-px h-[2px] bg-accent" />}
          </button>
        ))}
      </div>
      {open && (
        <div key={tab} role="tabpanel" className="ds-enter max-h-[38dvh] min-h-[30dvh] overflow-y-auto overscroll-contain px-4 pb-4 pt-3.5">
          <Editor tab={tab} catalog={catalog} />
        </div>
      )}
    </div>
  )
}

function Toast() {
  const toast = useStudio((s) => s.toast)
  const [shown, setShown] = useState<typeof toast>(null)
  useEffect(() => {
    if (!toast) return
    setShown(toast)
    const t = window.setTimeout(() => setShown(null), 3200)
    return () => window.clearTimeout(t)
  }, [toast])
  if (!shown) return null
  return (
    <div role="status" className="ds-enter ds-sheet pointer-events-none absolute inset-x-6 top-[calc(max(env(safe-area-inset-top),8px)+56px)] z-30 mx-auto max-w-sm rounded-2xl border border-line px-4 py-2.5 text-center text-[13px]">
      {shown.text}
    </div>
  )
}

function Loading({ error, onRetry }: { error: boolean; onRetry: () => void }) {
  const { progress, active } = useProgress()
  const [ready, setReady] = useState(false)
  useEffect(() => {
    if (!active && progress >= 100) {
      const t = window.setTimeout(() => setReady(true), 250)
      return () => window.clearTimeout(t)
    }
    setReady(false)
  }, [active, progress])
  if (ready && !error) return null
  return (
    <div className="absolute inset-0 z-10 grid place-items-center bg-ink/70 transition-opacity">
      <div className="flex w-56 flex-col items-center gap-3 text-center">
        <p className="font-display text-[28px] italic">DollScene</p>
        {error ? (
          <>
            <p className="text-[13px] text-muted">The studio couldn’t load. Check your connection.</p>
            <button type="button" onClick={onRetry} className="min-h-11 rounded-full bg-accent px-6 text-[13px] font-semibold text-accent-ink">
              Try again
            </button>
          </>
        ) : (
          <>
            <p className="text-[11px] uppercase tracking-[0.22em] text-muted">Setting up the studio</p>
            <div className="h-px w-full overflow-hidden bg-line">
              <div className="h-full bg-accent transition-[width]" style={{ width: `${Math.max(6, Math.round(progress))}%` }} />
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default function StudioApp() {
  const { catalog, error: catalogError, retry: retryCatalog } = useCatalog()
  const light = useMediaQuery('(prefers-color-scheme: light)')
  const reduced = useReducedMotion()
  const paused = useStudio((s) => s.paused)
  const [dockPx, setDockPx] = useState(320)
  const [vh, setVh] = useState(() => window.innerHeight)
  const [modelError, setModelError] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    void startSession()
    const onResize = () => setVh(window.innerHeight)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const retry = () => {
    useGLTF.clear(url.body)
    useTexture.clear([url.mask('face_a'), url.mask('face_b'), url.mask('face_c'), url.mask('body')])
    setModelError(false)
    setAttempt((n) => n + 1)
    retryCatalog()
  }

  // The visible stage is the part above the dock; the camera centres the character in it.
  const sheet = Math.min(0.7, Math.max(0, (dockPx - 40) / vh))

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-ink">
      {catalog && (
        <StudioStage catalog={catalog} theme={light ? LIGHT : DARK} sheet={sheet} reducedMotion={reduced || paused} attempt={attempt} onError={() => setModelError(true)} />
      )}
      <div className="pointer-events-none absolute inset-0">
        <TopBar />
        <ViewRail />
        <Toast />
        {catalog && <Dock catalog={catalog} onHeight={setDockPx} />}
      </div>
      <Loading error={!!catalogError || modelError} onRetry={retry} />
    </main>
  )
}
