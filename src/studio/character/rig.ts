import { Matrix4, Quaternion, Vector3, type Bone, type Object3D, type SkinnedMesh } from 'three'

/**
 * Procedural hands for the beauty routines: two-bone arm IK, hand orientation from a palm normal
 * and finger direction, finger grips, and live face landmarks that follow the skinned, morphed
 * body. Everything is relative to the character (bones and mesh vertices), never fixed world
 * positions, so it works for every face and body shape.
 *
 * glTF space: +Y up, the character faces +Z, her left is +X.
 */

export type Side = 'Left' | 'Right'
export type Grip = 'relaxed' | 'open' | 'flat' | 'point' | 'tap' | 'pinch' | 'hold' | 'cup' | 'peace' | 'fist'

const FINGERS = ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky'] as const
type Finger = (typeof FINGERS)[number]

/** Joint flexion (radians) per finger [joint1, joint2, joint3] for each grip. */
const GRIPS: Record<Grip, Record<Finger, [number, number, number]>> = {
  relaxed: { Thumb: [0.1, 0.15, 0.1], Index: [0.2, 0.25, 0.15], Middle: [0.25, 0.3, 0.2], Ring: [0.3, 0.35, 0.2], Pinky: [0.35, 0.4, 0.25] },
  open: { Thumb: [0, 0, 0], Index: [0, 0.05, 0], Middle: [0, 0.05, 0], Ring: [0, 0.05, 0], Pinky: [0, 0.05, 0] },
  flat: { Thumb: [0.15, 0.1, 0], Index: [0.05, 0.08, 0.05], Middle: [0.05, 0.08, 0.05], Ring: [0.05, 0.1, 0.05], Pinky: [0.08, 0.1, 0.05] },
  point: { Thumb: [0.5, 0.6, 0.4], Index: [0.02, 0.05, 0.02], Middle: [1.3, 1.4, 0.8], Ring: [1.35, 1.45, 0.8], Pinky: [1.4, 1.5, 0.8] },
  tap: { Thumb: [0.45, 0.5, 0.3], Index: [0.1, 0.15, 0.08], Middle: [0.12, 0.18, 0.1], Ring: [1.3, 1.4, 0.8], Pinky: [1.35, 1.45, 0.8] },
  pinch: { Thumb: [0.55, 0.45, 0.35], Index: [0.55, 0.65, 0.45], Middle: [0.9, 1.0, 0.6], Ring: [1.1, 1.2, 0.7], Pinky: [1.2, 1.3, 0.7] },
  hold: { Thumb: [0.6, 0.5, 0.4], Index: [0.95, 1.0, 0.6], Middle: [1.0, 1.05, 0.65], Ring: [1.05, 1.1, 0.65], Pinky: [1.1, 1.15, 0.65] },
  cup: { Thumb: [0.3, 0.25, 0.15], Index: [0.35, 0.45, 0.3], Middle: [0.4, 0.5, 0.3], Ring: [0.45, 0.55, 0.3], Pinky: [0.5, 0.6, 0.35] },
  // index and middle up and apart, ring and pinky curled into the palm, the thumb folded over them
  peace: { Thumb: [0.95, 0.75, 0.55], Index: [0.02, 0.04, 0.02], Middle: [0.02, 0.04, 0.02], Ring: [1.45, 1.55, 0.85], Pinky: [1.5, 1.6, 0.85] },
  fist: { Thumb: [0.7, 0.6, 0.5], Index: [1.3, 1.45, 0.8], Middle: [1.35, 1.5, 0.8], Ring: [1.4, 1.5, 0.8], Pinky: [1.45, 1.55, 0.8] },
}

const v1 = new Vector3()
const v2 = new Vector3()
const v3 = new Vector3()
const q1 = new Quaternion()
const q2 = new Quaternion()
const m1 = new Matrix4()
const m2 = new Matrix4()

interface FingerJoint {
  bone: Bone
  rest: Quaternion
  /** Flexion axis in the bone's local space (positive angle curls toward the palm). */
  axis: Vector3
}

export interface HandRig {
  side: Side
  arm: Bone
  fore: Bone
  hand: Bone
  armRest: Quaternion
  foreRest: Quaternion
  handRest: Quaternion
  /** Hand-local finger direction and palm normal. */
  fingerDir: Vector3
  palm: Vector3
  fingers: Record<Finger, FingerJoint[]>
  /** Length of the last finger joint, for the fingertip. */
  tipLen: Record<Finger, number>
}

/** Rotate `b` so the direction from b to `childWorld` becomes `dir` (world). */
function aimWorld(b: Bone, childWorld: Vector3, dir: Vector3) {
  b.getWorldPosition(v1)
  const cur = v2.copy(childWorld).sub(v1).normalize()
  q1.setFromUnitVectors(cur, v3.copy(dir).normalize())
  b.parent!.getWorldQuaternion(q2)
  const world = b.getWorldQuaternion(new Quaternion())
  b.quaternion.copy(q2.invert().multiply(q1).multiply(world))
  b.updateWorldMatrix(false, true)
}

function boneByName(root: Object3D, name: string) {
  return (root.getObjectByName(name) as Bone | undefined) ?? null
}

export function buildHandRig(root: Object3D, side: Side): HandRig | null {
  const arm = boneByName(root, `${side}Arm`)
  const fore = boneByName(root, `${side}ForeArm`)
  const hand = boneByName(root, `${side}Hand`)
  if (!arm || !fore || !hand) return null
  root.updateWorldMatrix(true, true)
  const child = (f: Finger, j: number) => boneByName(root, `${side}Hand${f}${j}`)
  const mid = child('Middle', 1)
  const idx = child('Index', 1)
  const pinky = child('Pinky', 1)
  const thumb = child('Thumb', 1)
  if (!mid || !idx || !pinky || !thumb) return null
  const fingerDir = mid.position.clone().normalize()
  // Palm normal: across the knuckles, on the side the thumb sits.
  const palm = new Vector3().crossVectors(idx.position, pinky.position).normalize()
  const thumbSide = thumb.position.clone().sub(fingerDir.clone().multiplyScalar(thumb.position.dot(fingerDir)))
  if (palm.dot(thumbSide) < 0) palm.negate()
  // Orthogonalise.
  palm.sub(fingerDir.clone().multiplyScalar(palm.dot(fingerDir))).normalize()

  const fingers = {} as Record<Finger, FingerJoint[]>
  const tipLen = {} as Record<Finger, number>
  hand.updateWorldMatrix(true, true)
  const handWorldQ = hand.getWorldQuaternion(new Quaternion())
  const palmWorld = palm.clone().applyQuaternion(handWorldQ)
  for (const f of FINGERS) {
    const joints: FingerJoint[] = []
    for (let j = 1; j <= 3; j++) {
      const b = child(f, j)
      if (!b) continue
      const next = child(f, j + 1)
      const dirLocal = next ? next.position.clone().normalize() : (joints.length ? joints[joints.length - 1].bone.position.clone().normalize() : fingerDir.clone())
      const bq = b.getWorldQuaternion(new Quaternion())
      const palmLocal = palmWorld.clone().applyQuaternion(bq.clone().invert())
      const axis = new Vector3().crossVectors(dirLocal, palmLocal).normalize()
      // Make positive rotation curl the finger toward the palm.
      const test = dirLocal.clone().applyAxisAngle(axis, 0.3)
      if (test.dot(palmLocal) < dirLocal.dot(palmLocal)) axis.negate()
      joints.push({ bone: b, rest: b.quaternion.clone(), axis })
    }
    fingers[f] = joints
    const last = joints[joints.length - 1]
    const prev = joints[joints.length - 2]
    tipLen[f] = last && prev ? last.bone.position.length() * 0.9 : 0.02
  }
  return { side, arm, fore, hand, armRest: arm.quaternion.clone(), foreRest: fore.quaternion.clone(), handRest: hand.quaternion.clone(), fingerDir, palm, fingers, tipLen }
}

/** Put the arm, hand and fingers back to the relaxed base pose. */
export function resetHand(h: HandRig) {
  h.arm.quaternion.copy(h.armRest)
  h.fore.quaternion.copy(h.foreRest)
  h.hand.quaternion.copy(h.handRest)
  for (const f of FINGERS) for (const j of h.fingers[f]) j.bone.quaternion.copy(j.rest)
  h.arm.updateWorldMatrix(true, true)
}

const qa = new Quaternion()
/** Blend a grip into the fingers (weight 0 = rest). */
export function setGrip(h: HandRig, grip: Grip, weight = 1, from: Grip = 'relaxed', mix = 1) {
  const a = GRIPS[from]
  const b = GRIPS[grip]
  for (const f of FINGERS) {
    h.fingers[f].forEach((j, i) => {
      const ang = (a[f][i] * (1 - mix) + b[f][i] * mix) * weight
      j.bone.quaternion.copy(j.rest).multiply(qa.setFromAxisAngle(j.axis, ang))
    })
  }
  h.hand.updateWorldMatrix(false, true)
}

/** World position of a fingertip. */
export function fingertip(h: HandRig, f: Finger, out = new Vector3()) {
  const joints = h.fingers[f]
  const last = joints[joints.length - 1]
  if (!last) return h.hand.getWorldPosition(out)
  last.bone.updateWorldMatrix(true, false)
  // The last joint has no child bone: extend along the joint's own direction.
  const dir = joints.length > 1 ? last.bone.position.clone().normalize() : h.fingerDir.clone()
  out.copy(dir.multiplyScalar(h.tipLen[f])).applyMatrix4(last.bone.matrixWorld)
  return out
}

export type Effector = 'index' | 'middle' | 'pinch' | 'palm' | 'thumb'
export function effectorPoint(h: HandRig, e: Effector, out = new Vector3()) {
  if (e === 'index') return fingertip(h, 'Index', out)
  if (e === 'middle') return fingertip(h, 'Middle', out)
  if (e === 'thumb') return fingertip(h, 'Thumb', out)
  if (e === 'pinch') return fingertip(h, 'Index', out).add(fingertip(h, 'Thumb', v3)).multiplyScalar(0.5)
  // palm: just below the middle knuckle, a little off the palm surface
  const mid = h.fingers.Middle[0]?.bone
  h.hand.updateWorldMatrix(true, false)
  out.set(0, 0, 0).applyMatrix4(h.hand.matrixWorld)
  if (mid) out.lerp(mid.getWorldPosition(v1), 0.7)
  const q = h.hand.getWorldQuaternion(q1)
  return out.add(v2.copy(h.palm).applyQuaternion(q).multiplyScalar(0.012))
}

/** Set the hand's world orientation: fingers along `fingers`, palm facing `palm`. */
export function orientHand(h: HandRig, fingers: Vector3, palm: Vector3) {
  const F = fingers.clone().normalize()
  const N = palm.clone().sub(F.clone().multiplyScalar(palm.dot(F))).normalize()
  m1.makeBasis(F, N, new Vector3().crossVectors(F, N))
  const f = h.fingerDir
  const p = h.palm
  m2.makeBasis(f, p, new Vector3().crossVectors(f, p))
  // world = m1 * inverse(m2), as a rotation
  const worldQ = new Quaternion().setFromRotationMatrix(m1.multiply(m2.transpose()))
  h.hand.parent!.getWorldQuaternion(q2)
  h.hand.quaternion.copy(q2.invert().multiply(worldQ))
  h.hand.updateWorldMatrix(false, true)
}

export interface ReachGoal {
  /** Where the effector should be (world). */
  target: Vector3
  /** Direction the fingers should point (world). */
  fingers: Vector3
  /** Direction the palm should face (world). */
  palm: Vector3
  effector: Effector
  grip: Grip
  /** Extra effector offset (world), e.g. a held prop's tip. */
  propTip?: Vector3
  /** The same in hand-local space: rotated with the goal orientation, so a brush tip lands on the target. */
  propTipLocal?: Vector3
  /** 0 = relaxed pose, 1 = fully at the goal. */
  weight: number
  /** Where the elbow should point (world). */
  pole: Vector3
}

const S = new Vector3()
const E = new Vector3()
const W = new Vector3()
const T = new Vector3()
const off = new Vector3()

/**
 * Reach: blend from the relaxed pose to the goal. The effector (a fingertip, the pinch point, the
 * palm, or a held prop's tip) lands on `target`; the wrist is placed by analytic two-bone IK with
 * the elbow toward `pole`.
 */
export function reach(h: HandRig, g: ReachGoal) {
  resetHand(h)
  if (g.weight <= 0.001) return setGrip(h, 'relaxed', 1)
  setGrip(h, g.grip, 1, 'relaxed', g.weight)
  // Orientation blends from the relaxed hand toward the goal orientation.
  const restQ = h.hand.getWorldQuaternion(new Quaternion())
  orientHand(h, g.fingers, g.palm)
  const goalQ = h.hand.getWorldQuaternion(new Quaternion())
  const blendQ = restQ.slerp(goalQ, g.weight)
  h.hand.parent!.getWorldQuaternion(q2)
  h.hand.quaternion.copy(q2.invert().multiply(blendQ))
  h.hand.updateWorldMatrix(false, true)

  h.arm.getWorldPosition(S)
  h.fore.getWorldPosition(E)
  h.hand.getWorldPosition(W)
  const l1 = S.distanceTo(E)
  const l2 = E.distanceTo(W)
  // Effector offset from the wrist under the goal orientation.
  effectorPoint(h, g.effector, off).sub(W)
  if (g.propTip) off.add(g.propTip)
  if (g.propTipLocal) off.add(v2.copy(g.propTipLocal).applyQuaternion(blendQ))
  const restWrist = W.clone()
  T.copy(g.target).sub(off)
  T.lerpVectors(restWrist, T, g.weight)

  const toT = v1.copy(T).sub(S)
  const d = Math.min(Math.max(toT.length(), Math.abs(l1 - l2) + 1e-4), l1 + l2 - 1e-4)
  const u = toT.normalize()
  const cosA = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)
  const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA))
  const pv = v2.copy(g.pole).sub(S)
  pv.sub(v3.copy(u).multiplyScalar(pv.dot(u))).normalize()
  const elbow = new Vector3().copy(S).addScaledVector(u, l1 * cosA).addScaledVector(pv, l1 * sinA)
  const wrist = new Vector3().copy(S).addScaledVector(u, d)

  aimWorld(h.arm, E.clone(), elbow.clone().sub(S))
  h.hand.getWorldPosition(W)
  h.fore.getWorldPosition(E)
  aimWorld(h.fore, W.clone(), wrist.clone().sub(E))
  // Re-apply the world orientation of the hand after the arm moved.
  h.hand.parent!.getWorldQuaternion(q2)
  h.hand.quaternion.copy(q2.invert().multiply(blendQ))
  limitWrist(h)
  h.hand.updateWorldMatrix(false, true)
}

const SWING_LIMIT = 1.22 // ~70 deg: flexion / extension and side-to-side
const TWIST_LIMIT = 1.9 // ~110 deg: the forearm's turn (this rig has no twist bones)
const qr = new Quaternion()
const qt = new Quaternion()
const qs = new Quaternion()
const va = new Vector3()

/** Joint limits for the wrist: swing-twist about the forearm axis, each clamped (no backward bends). */
function limitWrist(h: HandRig) {
  // rotation relative to the relaxed wrist, in hand space
  qr.copy(h.handRest).invert().multiply(h.hand.quaternion)
  if (qr.w < 0) qr.set(-qr.x, -qr.y, -qr.z, -qr.w)
  const a = h.fingerDir
  const p = va.set(qr.x, qr.y, qr.z).dot(a)
  qt.set(a.x * p, a.y * p, a.z * p, qr.w).normalize()
  qs.copy(qr).multiply(qt.clone().invert())
  const twist = 2 * Math.acos(Math.min(1, Math.abs(qt.w)))
  const swing = 2 * Math.acos(Math.min(1, Math.abs(qs.w)))
  if (twist <= TWIST_LIMIT && swing <= SWING_LIMIT) return
  const id = new Quaternion()
  if (twist > TWIST_LIMIT) qt.copy(id.clone().slerp(qt, TWIST_LIMIT / twist))
  if (swing > SWING_LIMIT) qs.copy(id.slerp(qs, SWING_LIMIT / swing))
  h.hand.quaternion.copy(h.handRest).multiply(qs.multiply(qt))
}

/* ------------------------------------------------------------------ live landmarks */

export interface LandmarkSource {
  /** Body mesh (skinned + morphed). */
  body: SkinnedMesh
  /** Vertex index nearest to each landmark/stroke point. */
  index: Map<string, number>
}

/**
 * Find the body vertices nearest to model-space points (once, at load). Compared in the body's
 * local space, so it works wherever the character stands and however the turntable is turned.
 */
export function bindLandmarks(body: SkinnedMesh, points: Record<string, readonly number[]>, model: Object3D): LandmarkSource {
  const pos = body.geometry.attributes.position
  const index = new Map<string, number>()
  model.updateMatrixWorld(true)
  const toLocal = new Matrix4().copy(body.matrixWorld).invert().multiply(model.matrixWorld)
  const p = new Vector3()
  const all = new Float32Array(pos.count * 3)
  for (let i = 0; i < pos.count; i++) {
    body.getVertexPosition(i, p)
    all[i * 3] = p.x
    all[i * 3 + 1] = p.y
    all[i * 3 + 2] = p.z
  }
  const q = new Vector3()
  for (const [k, xyz] of Object.entries(points)) {
    q.set(xyz[0], xyz[1], xyz[2]).applyMatrix4(toLocal)
    let best = -1
    let bd = Infinity
    for (let i = 0; i < pos.count; i++) {
      const dx = all[i * 3] - q.x
      const dy = all[i * 3 + 1] - q.y
      const dz = all[i * 3 + 2] - q.z
      const dd = dx * dx + dy * dy + dz * dz
      if (dd < bd) {
        bd = dd
        best = i
      }
    }
    index.set(k, best)
  }
  return { body, index }
}

const lp = new Vector3()
/** World position of a bound landmark this frame (skinning and morphs included). */
export function landmarkWorld(src: LandmarkSource, key: string, out = new Vector3()) {
  const i = src.index.get(key)
  if (i === undefined || i < 0) return null
  src.body.getVertexPosition(i, lp)
  return out.copy(lp).applyMatrix4(src.body.matrixWorld)
}
