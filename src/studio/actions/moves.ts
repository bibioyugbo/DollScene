import { MathUtils, Quaternion, Vector3, type SkinnedMesh } from 'three'
import type { Region } from '../state/fx'
import type { Effector, Grip, Side } from '../character/rig'
import type { PropState } from '../character/props'
import { headUp, landmark, landmarkNormal, localDir, localVec, touch, type Character, type HandGoal, type Move, type MoveCtx } from './engine'

/**
 * Building blocks for routines. Every contact point comes from the live, skinned face (landmarks
 * and wipe paths measured by the build), every hand comes in along the skin normal and leaves the
 * same way, and holding positions are relative to the character: nothing is a fixed world spot.
 */

export type Contact = (t: number, ctx: MoveCtx) => { p: Vector3; n: Vector3 }

/** The landmark that best represents a region's surface normal. */
export const REGION_KEY: Record<Region | 'underEyeL' | 'underEyeR' | 'lips', string> = {
  forehead: 'foreheadC',
  cheekL: 'cheekL',
  cheekR: 'cheekR',
  nose: 'noseTip',
  chin: 'chin',
  perimeter: 'jawR',
  underEyeL: 'underEyeL',
  underEyeR: 'underEyeR',
  lips: 'lips',
}

const zero = new Vector3()

/** A fixed landmark. */
export const at =
  (key: string, offset?: (c: Character) => Vector3): Contact =>
  (_t, { c }) => {
    const p = landmark(c, key)?.clone() ?? c.head.getWorldPosition(new Vector3())
    if (offset) p.add(offset(c))
    return { p, n: landmarkNormal(c, key) }
  }

/** Along a wipe path from the build (forehead, cheekL/R circles, nose, chin, under-eyes, lips). */
export const along =
  (region: keyof typeof REGION_KEY, from = 0, to = 1): Contact =>
  (t, { c }) => {
    const pts = c.care.strokes[region]
    const n = landmarkNormal(c, REGION_KEY[region])
    if (!pts?.length) return { p: landmark(c, REGION_KEY[region]) ?? zero.clone(), n }
    const f = MathUtils.lerp(from, to, t) * (pts.length - 1)
    const i = Math.min(pts.length - 2, Math.floor(f))
    const a = landmark(c, `stroke:${region}:${Math.max(0, i)}`)
    const b = landmark(c, `stroke:${region}:${Math.min(pts.length - 1, i + 1)}`)
    if (!a || !b) return { p: landmark(c, REGION_KEY[region]) ?? zero.clone(), n }
    return { p: a.clone().lerp(b, f - i), n }
  }

/** Small circles around a landmark (rubbing, buffing). */
export const circles =
  (key: string, radius: number, turns: number): Contact =>
  (t, ctx) => {
    const { p, n } = at(key)(t, ctx)
    const tan = new Vector3().crossVectors(n, headUp(ctx.c)).normalize()
    const bit = new Vector3().crossVectors(tan, n).normalize()
    const a = t * turns * Math.PI * 2
    return { p: p.addScaledVector(tan, Math.cos(a) * radius).addScaledVector(bit, Math.sin(a) * radius), n }
  }

/** Tapping in place: lifts off the skin between taps. */
export const taps =
  (base: Contact, count: number, lift = 0.008): Contact =>
  (t, ctx) => {
    const r = base(t, ctx)
    const k = Math.abs(Math.sin(t * count * Math.PI))
    return { p: r.p.addScaledVector(r.n, lift * k), n: r.n }
  }

/** A glide between two contacts, lifted off the skin in the middle so it never drags through. */
export const glide =
  (a: Contact, b: Contact, lift = 0.025): Contact =>
  (t, ctx) => {
    const ra = a(1, ctx)
    const rb = b(0, ctx)
    const e = t * t * (3 - 2 * t)
    const n = ra.n.clone().lerp(rb.n, e).normalize()
    return { p: ra.p.lerp(rb.p, e).addScaledVector(n, Math.sin(t * Math.PI) * lift), n }
  }

/** Fingers direction for a hand working on the face: up along the skin, tipped into it by `tilt`. */
export const faceFingers =
  (tilt = 0.45) =>
  (n: Vector3, ctx: MoveCtx) => {
    const up = headUp(ctx.c)
    const tan = up.sub(n.clone().multiplyScalar(up.dot(n))).normalize()
    return tan.multiplyScalar(Math.cos(tilt)).addScaledVector(n, -Math.sin(tilt)).normalize()
  }

export interface StrokeOpts {
  side: Side
  contact: Contact
  effector?: Effector
  grip?: Grip
  /** Use the held prop's tip as the effector (brushes, pads, sponges). */
  prop?: PropState | null
  /** Seconds of work. */
  dur?: number
  inDur?: number
  outDur?: number
  gap?: number
  tilt?: number
  standoff?: number
  /** Effect while working (t 0..1 over the work phase). */
  tick?: Move['tick']
  face?: Move['face']
  /** The other hand meanwhile (e.g. holds the bottle). */
  other?: Move['left']
  otherProp?: PropState | null
  /** Skip the approach / retreat (chain strokes without returning to rest). */
  noIn?: boolean
  noOut?: boolean
}

/** Approach → work → retreat for one hand, as three moves. */
export function stroke(o: StrokeOpts): Move[] {
  const effector = o.effector ?? (o.prop ? 'pinch' : 'index')
  const grip = o.grip ?? (o.prop ? (o.prop.hold === 'grip' ? 'hold' : 'pinch') : 'point')
  const base = { contact: o.contact, effector, grip, gap: o.gap ?? (o.prop ? 0.002 : 0.004), standoff: o.standoff ?? 0.1, fingers: faceFingers(o.tilt ?? (o.prop ? 0.7 : 0.45)), usePropTip: !!o.prop && o.prop.hold === 'pinch' && o.prop.id !== 'dollop' }
  const hand = o.side === 'Left' ? 'left' : 'right'
  const otherHand = o.side === 'Left' ? 'right' : 'left'
  const props = { [o.side]: o.prop ?? null, ...(o.other ? { [o.side === 'Left' ? 'Right' : 'Left']: o.otherProp ?? null } : {}) }
  const mk = (phase: 'in' | 'work' | 'out', dur: number, tick?: Move['tick']): Move => ({
    dur,
    [hand]: touch({ ...base, phase }),
    ...(o.other ? { [otherHand]: o.other } : {}),
    props,
    tick,
    face: o.face,
  })
  const out: Move[] = []
  if (!o.noIn) out.push(mk('in', o.inDur ?? 0.6))
  out.push(mk('work', o.dur ?? 1.4, o.tick))
  if (!o.noOut) out.push(mk('out', o.outDur ?? 0.5))
  return out
}

/** Both hands at once, mirrored regions (e.g. cheeks), sharing one timeline. */
export function both(left: StrokeOpts, right: StrokeOpts): Move[] {
  const l = stroke(left)
  const r = stroke(right)
  return l.map((m, i) => ({ ...m, right: r[i]?.right, props: { ...m.props, ...r[i]?.props }, tick: (t, ctx) => (m.tick?.(t, ctx), r[i]?.tick?.(t, ctx)) }))
}

/** A hand holding something in front of the chest (bottle, jar, tube). */
export function holdAt(side: Side, opts: { out?: number; up?: number; across?: number; tilt?: (t: number) => number; grip?: Grip; palmUp?: boolean } = {}) {
  const s = side === 'Left' ? 1 : -1
  return (t: number, { c }: MoveCtx): HandGoal => {
    const neck = landmark(c, 'neck') ?? c.head.getWorldPosition(new Vector3()).add(localVec(c, new Vector3(0, -0.2, 0.05)))
    const target = neck.clone().add(localVec(c, new Vector3((opts.across ?? 0.1) * s, -(0.09 - (opts.up ?? 0)), opts.out ?? 0.24)))
    const tilt = opts.tilt?.(t) ?? 0
    const fingers = localDir(c, new Vector3(-0.35 * s, 0.35 - tilt, 0.85)).normalize()
    const palm = opts.palmUp ? localDir(c, new Vector3(0, 1, 0)) : localDir(c, new Vector3(-s, 0.1 - tilt * 0.6, 0.1)).normalize()
    return { target, fingers, palm, effector: 'palm', grip: opts.grip ?? 'hold', weight: Math.min(1, t * 4 + 0.001) }
  }
}

/** Keep holding (full weight) for continuation moves. */
export function holding(side: Side, opts: Parameters<typeof holdAt>[1] = {}) {
  const h = holdAt(side, opts)
  return (t: number, ctx: MoveCtx) => ({ ...h(t, ctx), weight: 1 })
}

/** Both arms up in a stretch (the wake-up). */
export function stretch(side: Side) {
  const s = side === 'Left' ? 1 : -1
  return (t: number, { c }: MoveCtx): HandGoal => {
    const head = c.head.getWorldPosition(new Vector3())
    const k = Math.sin(Math.min(1, t) * Math.PI)
    return {
      target: head.clone().add(localVec(c, new Vector3(0.12 * s, 0.32, 0.02))),
      fingers: localDir(c, new Vector3(0.1 * s, 1, 0)),
      palm: localDir(c, new Vector3(0, 0, 1)),
      effector: 'palm',
      grip: 'open',
      weight: k,
    }
  }
}

/** A point on the hair surface along a head direction (az from the front, + = her left; el up). */
export function hairPoint(c: Character, az: number, el: number, out = 0): { p: Vector3; n: Vector3 } {
  const shell = hairShell(c)
  const a = MathUtils.degToRad(az)
  const e = MathUtils.degToRad(el)
  const dir = new Vector3()
    .addScaledVector(shell.left, Math.sin(a) * Math.cos(e))
    .addScaledVector(shell.up, Math.sin(e))
    .addScaledVector(shell.fwd, Math.cos(a) * Math.cos(e))
    .normalize()
  const r = shell.radius(az, el) + out
  // head space → world through the head bone, so it follows every head turn
  c.head.updateWorldMatrix(true, false)
  const p = shell.centre.clone().addScaledVector(dir, r).applyMatrix4(c.head.matrixWorld)
  const n = dir.transformDirection(c.head.matrixWorld)
  return { p, n }
}

/** Representative direction of each scalp section (see hairkit.section_of). */
export const SECTION_DIR: [number, number][] = [
  [25, 32],
  [-25, 32],
  [35, 72],
  [-35, 72],
  [85, 28],
  [-85, 28],
  [150, 30],
  [-150, 30],
]

interface Shell {
  /** Skull centre and the character's left / up / forward, all in head-bone space. */
  centre: Vector3
  left: Vector3
  up: Vector3
  fwd: Vector3
  radius: (az: number, el: number) => number
}

const shellCache = new WeakMap<object, Shell>()

/**
 * Outer surface of the current hairstyle around the skull (in head-bone space), so brushing and
 * section work happen on the hair and never inside it. Measured once per hair module from its
 * geometry, mapped into head space with that module's own inverse bind matrix.
 */
export function hairShell(c: Character): Shell {
  const meshes = c.hair() as SkinnedMesh[]
  const key = meshes[0]?.geometry ?? c.body
  const hit = shellCache.get(key)
  if (hit) return hit
  c.head.updateWorldMatrix(true, false)
  const toHead = c.head.getWorldQuaternion(new Quaternion()).invert()
  const rootQ = c.root.getWorldQuaternion(new Quaternion())
  const axis = (x: number, y: number, z: number) => new Vector3(x, y, z).applyQuaternion(rootQ).applyQuaternion(toHead).normalize()
  const left = axis(1, 0, 0)
  const up = axis(0, 1, 0)
  const fwd = axis(0, 0, 1)
  const centre = c.headLocalC.clone()
  const AZ = 16
  const EL = 6
  const bins = new Float32Array(AZ * EL).fill(0.115)
  const v = new Vector3()
  for (const m of meshes) {
    if (!m.isSkinnedMesh) continue
    const hi = m.skeleton.bones.indexOf(c.head)
    if (hi < 0) continue
    const ibm = m.skeleton.boneInverses[hi]
    const pos = m.geometry.attributes.position
    for (let i = 0; i < pos.count; i += 2) {
      v.fromBufferAttribute(pos, i).applyMatrix4(ibm).sub(centre)
      const y = v.dot(up)
      if (y < -0.06) continue
      const d = v.length()
      const az = Math.atan2(v.dot(left), v.dot(fwd))
      const el = Math.asin(Math.max(-1, Math.min(1, y / Math.max(d, 1e-5))))
      const ai = Math.min(AZ - 1, Math.floor(((az + Math.PI) / (Math.PI * 2)) * AZ))
      const ei = Math.min(EL - 1, Math.max(0, Math.floor(((el + 0.35) / (Math.PI / 2 + 0.35)) * EL)))
      const k = ei * AZ + ai
      if (d > bins[k] && d < 0.32) bins[k] = d
    }
  }
  const shell: Shell = {
    centre,
    left,
    up,
    fwd,
    radius: (az, el) => {
      const ai = Math.min(AZ - 1, Math.max(0, Math.floor(((MathUtils.degToRad(az) + Math.PI) / (Math.PI * 2)) * AZ)))
      const ei = Math.min(EL - 1, Math.max(0, Math.floor(((MathUtils.degToRad(el) + 0.35) / (Math.PI / 2 + 0.35)) * EL)))
      return bins[ei * AZ + ai] + 0.006
    },
  }
  shellCache.set(key, shell)
  return shell
}

/** A hand on the hair at a head direction (brushing, massaging, sectioning). */
export function onHair(_side: Side, path: (t: number) => [number, number], opts: { effector?: Effector; grip?: Grip; out?: number; weightIn?: boolean; prop?: boolean } = {}) {
  return (t: number, { c }: MoveCtx): HandGoal => {
    const [az, el] = path(t)
    const { p, n } = hairPoint(c, az, el, opts.out ?? 0.004)
    // fingers point back over the head (down the hair), palm on the hair
    const up = headUp(c)
    const back = localDir(c, new Vector3(0, 0, -1))
    let fingers = back.clone().addScaledVector(up, -0.4).sub(n.clone().multiplyScalar(back.dot(n))).normalize()
    if (fingers.lengthSq() < 0.1) fingers = up.clone()
    return { target: p, fingers, palm: n.clone().negate(), effector: opts.effector ?? 'palm', grip: opts.grip ?? 'cup', weight: opts.weightIn ? Math.min(1, t * 3) : 1, usePropTip: opts.prop }
  }
}

export { touch }
