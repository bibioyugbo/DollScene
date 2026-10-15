import { MathUtils, Quaternion, Vector3, type Bone, type Mesh, type Object3D, type SkinnedMesh } from 'three'
import type { ExpressionId } from '../../shared/studio/look'
import type { CareData } from '../character/catalog'
import type { NailSet } from '../character/nails'
import { propTipLocal, type PropState } from '../character/props'
import { landmarkWorld, reach, resetHand, setGrip, type Effector, type Grip, type HandRig, type LandmarkSource, type Side } from '../character/rig'
import { useStudio } from '../state/store'

/**
 * Animated actions: a routine is a list of timed moves. Each move says, for any moment t (0..1),
 * where each hand reaches (a goal relative to the character), which prop it holds, and what the
 * move does to the skin/hair while it plays (fx). ActionDriver evaluates the running action every
 * frame after the idle pose, so hands, props and fx always agree with the bones.
 *
 * run() resolves 'done' only after the last move has played, 'skipped' when the player skips (the
 * caller then puts the finished state in place at once), or 'cancelled' (category change, new
 * action, unmount): never on a timer guess.
 */

export type { PropId, PropState } from '../character/props'

export interface Character {
  root: Object3D
  body: SkinnedMesh
  head: Bone
  /** Skull centre in head-bone space. */
  headLocalC: Vector3
  hands: Record<Side, HandRig>
  landmarks: LandmarkSource
  care: CareData
  /** Head bone world quaternion at rest (after the relaxed pose), for rotating rest normals. */
  headRestQ: Quaternion
  /** The currently attached hair meshes. */
  hair: () => Mesh[]
  /** The ten nail plates (left thumb..pinky, right thumb..pinky). */
  nails: NailSet | null
  /** Held-pose blend state (each doll blends its own poses). */
  poseBlend?: { pose: string; k: number; from: string }
}

let character: Character | null = null
export const setCharacter = (c: Character | null) => (character = c)
export const getCharacter = () => character

export interface HandGoal {
  target: Vector3
  fingers: Vector3
  palm: Vector3
  effector: Effector
  grip: Grip
  weight: number
  /** Extra offset from the effector to the held prop's working tip (world). */
  propTip?: Vector3
  /** Use the held prop's own tip (from the props table) as the effector. */
  usePropTip?: boolean
  pole?: Vector3
}

export interface MoveCtx {
  c: Character
  /** Seconds since this move started. */
  time: number
  dt: number
}

export interface Move {
  /** Seconds. */
  dur: number
  left?: (t: number, ctx: MoveCtx) => HandGoal | null
  right?: (t: number, ctx: MoveCtx) => HandGoal | null
  props?: Partial<Record<Side, PropState | null>>
  /** Per-frame effect while the move plays (t 0..1). */
  tick?: (t: number, ctx: MoveCtx) => void
  /** Expression weights over the move. */
  face?: (t: number) => Partial<Record<ExpressionId, number>>
  /** Camera focus (world point) while this move plays. */
  focus?: (ctx: MoveCtx) => Vector3 | null
}

export type ActionResult = 'done' | 'skipped' | 'cancelled'

interface Running {
  id: string
  label: string
  moves: Move[]
  index: number
  time: number
  total: number
  elapsed: number
  resolve: (r: ActionResult) => void
}

let running: Running | null = null
let seq = 1
export const actionProps: Record<Side, PropState | null> = { Left: null, Right: null }
export const actionFocus = { point: null as Vector3 | null }

/** Start an action. Any running one is cancelled first. */
export function run(label: string, moves: Move[]): Promise<ActionResult> {
  cancelAction()
  return new Promise<ActionResult>((resolve) => {
    const total = moves.reduce((s, m) => s + m.dur, 0)
    running = { id: `a${seq++}`, label, moves, index: 0, time: 0, total, elapsed: 0, resolve }
    useStudio.setState({ action: { id: running.id, label, progress: 0 } })
  })
}

function finish(r: ActionResult) {
  const cur = running
  running = null
  actionProps.Left = actionProps.Right = null
  actionFocus.point = null
  useStudio.setState({ action: null, expression: {} })
  if (character) {
    resetHand(character.hands.Left)
    resetHand(character.hands.Right)
    setGrip(character.hands.Left, 'relaxed')
    setGrip(character.hands.Right, 'relaxed')
  }
  cur?.resolve(r)
}

export const cancelAction = () => running && finish('cancelled')
export const skipAction = () => running && finish('skipped')
export const isRunning = () => !!running

// Category changes cancel whatever is playing.
useStudio.subscribe((s, p) => {
  if (s.category !== p.category || s.phase !== p.phase) cancelAction()
})

const ease = (t: number) => t * t * (3 - 2 * t)

/** Called by ActionDriver every frame, after the idle pose and before rendering. */
export function stepActions(dt: number) {
  const c = character
  if (!running || !c) return
  const r = running
  let move = r.moves[r.index]
  r.time += dt
  r.elapsed += dt
  while (move && r.time >= move.dur) {
    // Land the end of the move exactly before moving on.
    evalMove(c, move, 1, move.dur, 0)
    r.time -= move.dur
    r.index++
    move = r.moves[r.index]
  }
  if (!move) return finish('done')
  evalMove(c, move, Math.min(1, r.time / Math.max(move.dur, 1e-4)), r.time, dt)
  const progress = Math.min(1, r.elapsed / Math.max(r.total, 1e-4))
  const st = useStudio.getState().action
  if (st && st.id === r.id && Math.abs(st.progress - progress) > 0.02) useStudio.setState({ action: { ...st, progress } })
}

function evalMove(c: Character, m: Move, t: number, time: number, dt: number) {
  const ctx: MoveCtx = { c, time, dt }
  for (const side of ['Left', 'Right'] as Side[]) {
    const fn = side === 'Left' ? m.left : m.right
    const h = c.hands[side]
    if (m.props && side in m.props) actionProps[side] = m.props[side] ?? null
    const goal = fn?.(t, ctx)
    if (goal) reach(h, { ...goal, pole: goal.pole ?? defaultPole(c, side), propTipLocal: goal.usePropTip ? propTipLocal(h, actionProps[side]) : undefined })
    else {
      resetHand(h)
      setGrip(h, 'relaxed')
    }
  }
  m.tick?.(t, ctx)
  if (m.face) useStudio.setState({ expression: m.face(t) })
  actionFocus.point = m.focus?.(ctx) ?? actionFocus.point
}

/* ------------------------------------------------------------------ goal helpers */

const tmp = new Vector3()
const up = new Vector3(0, 1, 0)

export function defaultPole(c: Character, side: Side) {
  const s = side === 'Left' ? 1 : -1
  c.hands[side].arm.getWorldPosition(tmp)
  // Elbow down, out to the side and a little forward: never through the chest.
  return tmp.clone().add(localDir(c, new Vector3(0.45 * s, -0.8, 0.25)).multiplyScalar(0.5))
}

/** A character-space direction (glTF: +Z forward, +X her left) in world space, normalised. */
export function localDir(c: Character, d: Vector3) {
  return localVec(c, d).normalize()
}

/** A character-space offset (metres; +Z forward, +X her left) in world space, length kept. */
export function localVec(c: Character, d: Vector3) {
  const q = c.root.getWorldQuaternion(new Quaternion())
  return d.clone().applyQuaternion(q)
}

/** A rest-space normal from character.json, rotated with the head. */
export function headNormal(c: Character, n: readonly [number, number, number] | number[]) {
  const qNow = c.head.getWorldQuaternion(new Quaternion())
  const delta = qNow.multiply(c.headRestQ.clone().invert())
  return new Vector3(n[0], n[1], n[2]).applyQuaternion(c.root.getWorldQuaternion(new Quaternion())).applyQuaternion(delta).normalize()
}

export function landmark(c: Character, key: string) {
  return landmarkWorld(c.landmarks, key, new Vector3())
}

export function landmarkNormal(c: Character, key: string) {
  const lm = c.care.landmarks[key]
  return lm ? headNormal(c, lm.n) : localDir(c, new Vector3(0, 0, 1))
}

/** Head-up direction (world). */
export const headUp = (c: Character) => up.clone().applyQuaternion(c.head.getWorldQuaternion(new Quaternion()).multiply(c.headRestQ.clone().invert())).normalize()

/**
 * The standard approach → work → retreat envelope for one hand, around a moving contact point.
 * `contact(t)` gives the contact point (world) for the work phase; the hand comes in along the
 * surface normal from `standoff` metres away, so it never travels through the face.
 */
export function touch(opts: {
  contact: (t: number, ctx: MoveCtx) => { p: Vector3; n: Vector3 }
  effector: Effector
  grip: Grip
  /** Fingers' direction (world) for the given contact. Default: up along the face. */
  fingers?: (n: Vector3, ctx: MoveCtx) => Vector3
  /** Palm faces the skin by default. */
  palmOut?: boolean
  gap?: number
  standoff?: number
  propTip?: (ctx: MoveCtx) => Vector3 | undefined
  /** Land the held prop's working tip (not the fingers) on the contact. */
  usePropTip?: boolean
  /** 'in' | 'work' | 'out' phase. */
  phase: 'in' | 'work' | 'out'
}) {
  return (t: number, ctx: MoveCtx): HandGoal => {
    const { p, n } = opts.contact(opts.phase === 'in' ? 0 : opts.phase === 'out' ? 1 : t, ctx)
    const gap = opts.gap ?? 0.004
    const standoff = opts.standoff ?? 0.09
    let away = gap
    let weight = 1
    if (opts.phase === 'in') {
      away = MathUtils.lerp(standoff, gap, ease(t))
      weight = ease(Math.min(1, t * 1.6))
    } else if (opts.phase === 'out') {
      away = MathUtils.lerp(gap, standoff, ease(t))
      weight = 1 - ease(Math.max(0, t * 1.4 - 0.4))
    }
    const fingers = opts.fingers ? opts.fingers(n, ctx) : headUp(ctx.c).sub(n.clone().multiplyScalar(headUp(ctx.c).dot(n))).normalize()
    return {
      target: p.clone().addScaledVector(n, away),
      fingers,
      palm: opts.palmOut ? n.clone() : n.clone().negate(),
      effector: opts.effector,
      grip: opts.grip,
      weight,
      propTip: opts.propTip?.(ctx),
      usePropTip: opts.usePropTip,
    }
  }
}
