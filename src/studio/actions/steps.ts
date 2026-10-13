import type { StudioLook } from '../../shared/studio/look'
import { resetAllFx } from '../state/fx'
import { useStudio, type Framing } from '../state/store'
import { cancelAction, getCharacter, run, type ActionResult, type Move } from './engine'

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
  /** Toast on success. */
  done: string | ((ctx: StepCtx) => string)
  /** Optional optional-ness note shown under the step. */
  note?: string
  /** Runs before the animation (e.g. per-frame fx starting values). */
  before?: (ctx: StepCtx) => void
}

let current: Promise<ActionResult> | null = null

export async function runStep(step: StepDef, ctx: Omit<StepCtx, 'look' | 'reduced'> & { reduced?: boolean }): Promise<ActionResult> {
  const store = useStudio.getState()
  if (!getCharacter()) {
    store.notify('Your doll is still getting ready. Try again in a moment.', 'info')
    return 'cancelled'
  }
  // Let any running step settle (and roll back) before this one touches the look.
  if (current) {
    cancelAction()
    await current.catch(() => 'cancelled')
  }
  const reduced = ctx.reduced ?? (typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
  const full: StepCtx = { ...ctx, look: useStudio.getState().look, reduced }
  const blocked = step.blocked?.(full.look)
  if (blocked) {
    store.notify(blocked, 'info')
    return 'cancelled'
  }
  resetAllFx()
  if (step.mode === 'preview') useStudio.getState().preview((l) => step.apply(l, full))
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
  const r = await p
  if (current === p) current = null
  resetAllFx()
  if (r === 'cancelled') {
    if (step.mode === 'preview') useStudio.getState().cancelPreview()
    return r
  }
  const s = useStudio.getState()
  if (step.mode === 'preview') s.commit()
  else s.apply((l) => step.apply(l, full))
  const after = useStudio.getState().look
  if (step.verify && !step.verify(after, full)) {
    s.notify('That didn’t quite take. Your look is safe, try again.', 'error')
    return 'cancelled'
  }
  s.notify(typeof step.done === 'function' ? step.done(full) : step.done, 'success')
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
