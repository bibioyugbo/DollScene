import { create } from 'zustand'
import { DEFAULT_LOOK, sanitizeLook, type SavedLook, type StudioLook } from '../../shared/studio/look'

export type Tab = 'face' | 'makeup' | 'hair' | 'body' | 'fashion' | 'transform' | 'looks' | 'play'
/** Camera framing. Angle is separate so any framing can be seen from any side. */
export type Framing = 'face' | 'bust' | 'full'
export type Angle = 'front' | 'three-quarter' | 'side' | 'back'
export type Connection = 'connecting' | 'live' | 'test' | 'preview' | 'offline'

const HISTORY = 60

interface StudioState {
  look: StudioLook
  past: StudioLook[]
  future: StudioLook[]
  /** Look when the current drag/edit began; null when not editing. */
  editBase: StudioLook | null
  /** What "hold to compare" shows. */
  before: StudioLook
  comparing: boolean

  tab: Tab
  framing: Framing
  angle: Angle
  /** Extra yaw from dragging, radians. */
  spin: number
  sheetOpen: boolean

  paused: boolean
  connection: Connection
  player: { id: string; name: string; avatar: string | null } | null
  saved: SavedLook[]
  entitlements: string[]
  xp: number
  todayBest: number | null
  toast: { id: number; text: string } | null

  /** Live change (slider drag). Call commit() when the gesture ends. */
  preview: (fn: (l: StudioLook) => void) => void
  commit: () => void
  /** One-shot change that lands in history at once. */
  apply: (fn: (l: StudioLook) => void) => void
  replace: (look: StudioLook) => void
  undo: () => void
  redo: () => void
  setTab: (t: Tab) => void
  setFraming: (f: Framing) => void
  setAngle: (a: Angle) => void
  setSpin: (s: number) => void
  setComparing: (c: boolean) => void
  markBefore: () => void
  notify: (text: string) => void
}

const clone = (l: StudioLook) => structuredClone(l)

/** Each editor opens on the framing that shows its work best. */
const TAB_FRAMING: Record<Tab, Framing> = {
  face: 'face',
  makeup: 'face',
  hair: 'bust',
  body: 'full',
  fashion: 'full',
  transform: 'bust',
  looks: 'full',
  play: 'bust',
}

export const useStudio = create<StudioState>((set, get) => ({
  look: clone(DEFAULT_LOOK),
  past: [],
  future: [],
  editBase: null,
  before: clone(DEFAULT_LOOK),
  comparing: false,

  tab: 'makeup',
  framing: 'face',
  angle: 'front',
  spin: 0,
  sheetOpen: true,

  paused: false,
  connection: 'connecting',
  player: null,
  saved: [],
  entitlements: [],
  xp: 0,
  todayBest: null,
  toast: null,

  preview(fn) {
    const s = get()
    const base = s.editBase ?? s.look
    const next = clone(s.look)
    fn(next)
    set({ look: next, editBase: base })
  },
  commit() {
    const { editBase, look, past } = get()
    if (!editBase) return
    if (JSON.stringify(editBase) === JSON.stringify(look)) return set({ editBase: null })
    set({ past: [...past, editBase].slice(-HISTORY), future: [], editBase: null })
  },
  apply(fn) {
    const { look, past } = get()
    const next = clone(look)
    fn(next)
    set({ look: next, past: [...past, look].slice(-HISTORY), future: [], editBase: null })
  },
  replace(l) {
    const { look, past } = get()
    set({ look: sanitizeLook(l), past: [...past, look].slice(-HISTORY), future: [], editBase: null })
  },
  undo() {
    const { past, look, future } = get()
    const prev = past[past.length - 1]
    if (!prev) return
    set({ look: prev, past: past.slice(0, -1), future: [look, ...future].slice(0, HISTORY), editBase: null })
  },
  redo() {
    const { past, look, future } = get()
    const next = future[0]
    if (!next) return
    set({ look: next, past: [...past, look].slice(-HISTORY), future: future.slice(1), editBase: null })
  },
  setTab(tab) {
    set({ tab, framing: TAB_FRAMING[tab], before: clone(get().look), sheetOpen: true })
  },
  setFraming: (framing) => set({ framing }),
  setAngle: (angle) => set({ angle, spin: 0 }),
  setSpin: (spin) => set({ spin }),
  setComparing: (comparing) => set({ comparing }),
  markBefore: () => set({ before: clone(get().look) }),
  notify: (text) => set({ toast: { id: Date.now(), text } }),
}))

/** The look the character should show right now (the "before" while comparing). */
export const useShownLook = () => useStudio((s) => (s.comparing ? s.before : s.look))
