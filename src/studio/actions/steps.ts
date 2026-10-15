import type { StudioLook } from '../../shared/studio/look'
import { resetAllFx } from '../state/fx'
import { useStudio, type Framing } from '../state/store'
import { cancelAction, getCharacter, run, type ActionResult, type Move } from './engine'
import { sfx, type Sfx } from '../ui/sound'

/**
 * The reusable step system behind every routine (skincare, haircare, makeup, nails).
 * A step is data: what it is, which products and targets it offers, the regions it touches,
 * the animation it plays, and the state it leaves on the avatar.
 *
 *  - 'result' steps change the saved look only after the animation really finished (or the
 *    player skipped it, which lands the finished state at once). Cancelled = nothing changes.
 *  - 'preview' steps (makeup, nails) put the final look in place as an uncommitted preview while
 *    the animation reveals it; done/skip commits it to history, cancel restores the look before.
 * Every change goes through the store, so Undo restores it and Replay just plays it again.
 */

export interface Product {
  id: string
  name: string
  blurb: string
  /** Swatch colour for the product card. */
  color: string
}

export interface StepCtx {
  product: Product
  target: string | null
  look: StudioLook
  /** Player prefers reduced motion: shorter, calmer animations. */
  reduced: boolean
  option: string | null
  /** Extra choices (intensity, finish...). */
  extra?: Record<string, string | number>
}

export interface StepDef {
  id: string
  name: string
  blurb: string
  framing: Framing
  /** Avatar regions the step works on (for the UI and the camera). */
  regions: string[]
  products: Product[]
  /** Optional second choice (applicator, removal method...). */
  options?: { label: string; list: { id: string; name: string }[] }
  /** Things the player picks first (which patch, which spot, which section). */
  targets?: (look: StudioLook) => { id: string; name: string }[]
  /** null when the step can run, otherwise why not (shown to the player). */
  blocked?: (look: StudioLook) => string | null
  mode: 'result' | 'preview'
  moves: (ctx: StepCtx) => Move[]
  /** The avatar state the step leaves. */
  apply: (l: StudioLook, ctx: StepCtx) => void
  /** Confirms the state really changed before success is announced. */
  verify?: (l: StudioLook, ctx: StepCtx) => boolean
  /** What the step achieved (screen readers; no toast is shown). */
  done: string | ((ctx: StepCtx) => string)
  /** Optional optional-ness note shown under the step. */
  note?: string
  /** Runs before the animation (e.g. per-frame fx starting values). */
  before?: (ctx: StepCtx) => void
}

let current: Promise<ActionResult> | null = null

/**
 * ASMR while a step plays: each routine has its own satisfying sound on a gentle loop (foam
 * bubbles, slurpy creams, pats, swipes, drips, scrubbing). Muting the game silences them.
 */
const ASMR: Partial<Record<string, { kind: Sfx; every: number; after?: number }>> = {
  wash: { kind: 'bubbles', every: 0.32, after: 1.2 },
  cleanse: { kind: 'bubbles', every: 0.32, after: 0.8 },
  pop: { kind: 'squelch', every: 0.42, after: 0.4 },
  spot: { kind: 'squelch', every: 0.6 },
  toner: { kind: 'swipe', every: 0.55, after: 0.6 },
  serum: { kind: 'drip', every: 0.7 },
  eyeCream: { kind: 'pat', every: 0.22, after: 0.6 },
  moisturiser: { kind: 'squelch', every: 0.45, after: 0.5 },
  sunscreen: { kind: 'squelch', every: 0.45, after: 0.5 },
  lipBalm: { kind: 'swipe', every: 0.5 },
  exfoliate: { kind: 'brush', every: 0.24 },
  soothe: { kind: 'squelch', every: 0.5 },
  brighten: { kind: 'drip', every: 0.7 },
  compress: { kind: 'pat', every: 0.5 },
  patchOn: { kind: 'dab', every: 0.8 },
}

let stepSeq = 0

export async function runStep(step: StepDef, ctx: Omit<StepCtx, 'look' | 'reduced'> & { reduced?: boolean }): Promise<ActionResult> {
  const store = useStudio.getState()
  if (!getCharacter()) {
    store.notify('Your doll is still getting ready. Try again in a moment.', 'info')
    return 'cancelled'
  }
  // Let any running step settle (and roll back) before this one touches the look. Taps can come
  // faster than steps settle: only the LATEST tap goes on, and a step superseded while it ran never
  // rolls the look back over the newer step's change (that left the old hairstyle stuck on).
  const my = ++stepSeq
  if (current) {
    cancelAction()
    await current.catch(() => 'cancelled')
  }
  if (my !== stepSeq) return 'cancelled'
  const reduced = ctx.reduced ?? (typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
  const full: StepCtx = { ...ctx, look: useStudio.getState().look, reduced }
  const blocked = step.blocked?.(full.look)
  if (blocked) {
    store.notify(blocked, 'info')
    return 'cancelled'
  }
  resetAllFx()
  if (step.mode === 'preview') {
    // a clean base: a superseded step's leftover preview never leaks into this one
    useStudio.getState().cancelPreview()
    full.look = useStudio.getState().look
    useStudio.getState().preview((l) => step.apply(l, full))
  }
  step.before?.(full)
  let moves: Move[]
  try {
    moves = step.moves(full)
  } catch (e) {
    console.error(e)
    if (step.mode === 'preview') useStudio.getState().cancelPreview()
    store.notify('That step couldn’t start. Your look is safe.', 'error')
    return 'cancelled'
  }
  if (reduced) moves = moves.map((m) => ({ ...m, dur: m.dur * 0.6 }))
  const p = run(step.name, moves)
  current = p
  const loop = ASMR[step.id]
  let timer: ReturnType<typeof setInterval> | undefined
  const start = loop ? setTimeout(() => (sfx(loop.kind), (timer = setInterval(() => sfx(loop.kind), loop.every * 1000))), (loop.after ?? 0.3) * 1000) : undefined
  const r = await p.finally(() => (clearTimeout(start), clearInterval(timer)))
  if (current === p) current = null
  resetAllFx()
  if (r === 'cancelled') {
    if (step.mode === 'preview' && my === stepSeq) useStudio.getState().cancelPreview()
    return r
  }
  if (my !== stepSeq) return 'cancelled'
  const s = useStudio.getState()
  if (step.mode === 'preview') s.commit()
  else s.apply((l) => step.apply(l, full))
  const after = useStudio.getState().look
  if (step.verify && !step.verify(after, full)) {
    s.notify('That didn’t quite take. Your look is safe, try again.', 'error')
    return 'cancelled'
  }
  // no toast: the change is on the doll (try-ons apply the moment they start)
  return r
}

/** Plays a whole routine in order with each step's first product, stopping if the player leaves. */
export async function runSequence(steps: StepDef[], onStep: (i: number) => void, reduced?: boolean) {
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]
    const look = useStudio.getState().look
    if (step.blocked?.(look)) continue
    const targets = step.targets?.(look) ?? []
    if (step.targets && !targets.length) continue
    onStep(i)
    const r = await runStep(step, { product: step.products[0], target: targets[0]?.id ?? null, option: step.options?.list[0]?.id ?? null, reduced })
    if (r === 'cancelled') return false
  }
  return true
}
