import { create } from 'zustand'
import { ROOMS, type RoomId } from '../rooms'
import { DEFAULT_LOOK, sanitizeLook, type ClinicId, type ExpressionId, type SavedLook, type SceneChoice, type StudioLook } from '../../shared/studio/look'

/**
 * Where the player is: the boot loader, picking a doll, the Hub (the corridor of doors), a room
 * behind a door ('studio' + room), choosing a scene, or out at the scene (Make a Scene).
 */
export type Phase = 'boot' | 'onboard' | 'hub' | 'studio' | 'scenes' | 'event'

/** A room's left-rail categories (see rooms.ts for which room has which). */
export type Category =
  // Skincare Bay
  | 'wake'
  | 'cleanse'
  | 'treat'
  | 'tone'
  | 'moisturise'
  // Makeup Studio
  | 'base'
  | 'sculpt'
  | 'eyes'
  | 'browsLashes'
  | 'lips'
  | 'looks'
  | 'nails'
  | 'jewellery'
  // Hair Studio
  | 'hairstyles'
  | 'haircolour'
  | 'haircare'
  // stores
  | 'outfits'
  | 'shoes'
  // Beauty Doctor
  | 'clinicFace'
  | 'clinicBody'

/** Camera framing. Angle is separate so any framing can be seen from any side. */
export type Framing = 'face' | 'eyes' | 'lips' | 'hair' | 'bust' | 'hands' | 'full'
export type Angle = 'front' | 'three-quarter' | 'side' | 'back'
export type Connection = 'connecting' | 'live' | 'test' | 'preview' | 'offline'

/** A running animated action (a skincare step, a brush stroke, a manicure...). */
export interface ActionStatus {
  id: string
  label: string
  /** 0..1 */
  progress: number
}

export interface Toast {
  id: number
  text: string
  tone: 'info' | 'success' | 'error'
}

/** Make a Scene: the pose, expression and camera the player has chosen. */
export interface PhotoState {
  pose: PoseId
  expression: ExpressionPreset
  /** Orbit around the character: yaw and pitch in radians, distance multiplier. */
  yaw: number
  pitch: number
  zoom: number
  /** Camera height offset in metres. */
  lift: number
}

export const POSES = ['relaxed', 'hand-on-hip', 'hands-on-hips', 'wave', 'peace', 'blow-kiss', 'selfie', 'thinking', 'hair-touch', 'arms-crossed', 'hands-clasped'] as const
export type PoseId = (typeof POSES)[number]
export const EXPRESSION_PRESETS = ['neutral', 'smile', 'laugh', 'kiss', 'wink', 'surprised', 'sad', 'soft', 'pout'] as const
export type ExpressionPreset = (typeof EXPRESSION_PRESETS)[number]

export interface ConfirmRequest {
  title: string
  body: string
  confirm: string
  cancel?: string
  resolve: (ok: boolean) => void
}

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

  phase: Phase
  /** The room behind the door the player went through (null in the Hub). */
  room: RoomId | null
  category: Category
  framing: Framing
  angle: Angle
  /** Extra yaw from dragging, radians. */
  spin: number
  /** Controls hidden for an unobstructed view. */
  uiHidden: boolean
  sheetOpen: boolean

  /** Clinic procedures being previewed (not saved until confirmed). */
  clinicPreview: Partial<Record<ClinicId, number>> | null
  /** Live facial expression weights driven by animations and photo mode. */
  expression: Partial<Record<ExpressionId, number>>
  action: ActionStatus | null

  /** The 3D character has loaded and its hands/anchors are bound (routines can run). */
  characterReady: boolean
  photo: PhotoState
  /** The scene before the last Change Scene (for "go back"). */
  prevScene: SceneChoice | null

  paused: boolean
  connection: Connection
  player: { id: string; name: string; avatar: string | null } | null
  saved: SavedLook[]
  entitlements: string[]
  xp: number
  todayBest: number | null
  toasts: Toast[]
  confirm: ConfirmRequest | null

  /** Live change (slider drag). Call commit() when the gesture ends. */
  preview: (fn: (l: StudioLook) => void) => void
  commit: () => void
  /** Drop an uncommitted live change and restore the look it started from. */
  cancelPreview: () => void
  /** One-shot change that lands in history at once. */
  apply: (fn: (l: StudioLook) => void) => void
  replace: (look: StudioLook) => void
  undo: () => void
  redo: () => void
  setPhase: (p: Phase) => void
  /** Enter a room: its first category (or `category`), studio phase. */
  enterRoom: (r: RoomId, category?: Category) => void
  setCategory: (c: Category) => void
  setFraming: (f: Framing) => void
  setAngle: (a: Angle) => void
  setSpin: (s: number) => void
  setComparing: (c: boolean) => void
  markBefore: () => void
  notify: (text: string, tone?: Toast['tone']) => void
  dismissToast: (id: number) => void
  ask: (req: Omit<ConfirmRequest, 'resolve'>) => Promise<boolean>
  setPhoto: (p: Partial<PhotoState>) => void
  /** Move to another scene without touching the rest of the look. */
  changeScene: (scene: SceneChoice) => void
}

/**
 * The base face and body are chosen at creation and then locked: outside onboarding, a change
 * that would move a morph or the height is dropped (the beauty clinic changes the shown shape
 * only through look.clinic, after an explicit confirmation).
 */
function lockBase(prev: StudioLook, next: StudioLook, phase: Phase) {
  if (phase === 'onboard') return next
  next.morphs = prev.morphs
  next.height = prev.height
  return next
}

const clone = (l: StudioLook) => structuredClone(l)

/** Each category opens on the framing that shows its work best. */
export const CATEGORY_FRAMING: Record<Category, Framing> = {
  wake: 'face',
  cleanse: 'face',
  treat: 'face',
  tone: 'face',
  moisturise: 'face',
  base: 'face',
  sculpt: 'face',
  eyes: 'eyes',
  browsLashes: 'eyes',
  lips: 'lips',
  looks: 'face',
  nails: 'hands',
  jewellery: 'bust',
  hairstyles: 'hair',
  haircolour: 'hair',
  haircare: 'hair',
  outfits: 'full',
  shoes: 'full',
  clinicFace: 'face',
  clinicBody: 'full',
}

let toastSeq = 1

export const useStudio = create<StudioState>((set, get) => ({
  look: clone(DEFAULT_LOOK),
  past: [],
  future: [],
  editBase: null,
  before: clone(DEFAULT_LOOK),
  comparing: false,

  phase: 'boot',
  room: null,
  category: 'cleanse',
  framing: 'face',
  angle: 'front',
  spin: 0,
  uiHidden: false,
  sheetOpen: true,

  clinicPreview: null,
  expression: {},
  action: null,

  characterReady: false,
  photo: { pose: 'relaxed', expression: 'smile', yaw: 0, pitch: 0.05, zoom: 1, lift: 0 },
  prevScene: null,

  paused: false,
  connection: 'connecting',
  player: null,
  saved: [],
  entitlements: [],
  xp: 0,
  todayBest: null,
  toasts: [],
  confirm: null,

  preview(fn) {
    const s = get()
    const base = s.editBase ?? s.look
    const next = clone(s.look)
    fn(next)
    set({ look: lockBase(s.look, next, s.phase), editBase: base })
  },
  commit() {
    const { editBase, look, past } = get()
    if (!editBase) return
    if (JSON.stringify(editBase) === JSON.stringify(look)) return set({ editBase: null })
    set({ past: [...past, editBase].slice(-HISTORY), future: [], editBase: null })
  },
  cancelPreview() {
    const { editBase } = get()
    if (editBase) set({ look: editBase, editBase: null })
  },
  apply(fn) {
    const { look, past, editBase, phase } = get()
    const base = editBase ?? look
    const next = clone(look)
    fn(next)
    set({ look: lockBase(look, next, phase), past: [...past, base].slice(-HISTORY), future: [], editBase: null })
  },
  replace(l) {
    const { look, past, phase } = get()
    const next = sanitizeLook(l)
    // Wearing a saved look changes the styling, never who the doll is or where she is.
    if (phase !== 'onboard') {
      next.morphs = look.morphs
      next.height = look.height
      next.clinic = look.clinic
      next.profile = look.profile
      next.scene = look.scene
    }
    set({ look: next, past: [...past, look].slice(-HISTORY), future: [], editBase: null })
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
  setPhase: (phase) => set(phase === 'hub' ? { phase, room: null } : { phase }),
  enterRoom(room, category) {
    get().cancelPreview()
    const c = category ?? ROOMS[room].categories[0]
    set({ phase: 'studio', room, category: c, framing: CATEGORY_FRAMING[c], before: clone(get().look), sheetOpen: true, clinicPreview: null, uiHidden: false, angle: 'front', spin: 0 })
  },
  setCategory(category) {
    // Leaving a category drops any half-made live change and preview, so nothing leaks across.
    get().cancelPreview()
    set({ category, framing: CATEGORY_FRAMING[category], before: clone(get().look), sheetOpen: true, clinicPreview: null, uiHidden: false })
  },
  setFraming: (framing) => set({ framing }),
  setAngle: (angle) => set({ angle, spin: 0 }),
  setSpin: (spin) => set({ spin }),
  setComparing: (comparing) => set({ comparing }),
  markBefore: () => set({ before: clone(get().look) }),
  notify(text, tone = 'info') {
    // The same message twice in a row is one toast.
    const { toasts } = get()
    if (toasts.some((t) => t.text === text)) return
    set({ toasts: [...toasts, { id: toastSeq++, text, tone }].slice(-3) })
  },
  dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
  ask(req) {
    get().confirm?.resolve(false)
    return new Promise<boolean>((resolve) =>
      set({
        confirm: {
          ...req,
          resolve: (ok) => {
            set({ confirm: null })
            resolve(ok)
          },
        },
      }),
    )
  },
  setPhoto: (p) => set({ photo: { ...get().photo, ...p } }),
  changeScene(scene) {
    const { look } = get()
    if (look.scene.id === scene.id && look.scene.time === scene.time && look.scene.weather === scene.weather) return
    const prev = look.scene
    get().apply((l) => void (l.scene = { ...scene }))
    set({ prevScene: prev })
  },
}))

/** The look the character should show right now (the "before" while comparing). */
export const useShownLook = () => useStudio((s) => (s.comparing ? s.before : s.look))
