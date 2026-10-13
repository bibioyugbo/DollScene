import { Vector3, type Bone } from 'three'
import type { ExpressionId } from '../../shared/studio/look'
import { defaultPole, headUp, landmark, localDir, localVec, type Character, type HandGoal } from '../actions/engine'
import { hairPoint } from '../actions/moves'
import type { ExpressionPreset, PoseId } from '../state/store'
import type { PropState } from './props'
import { reach, resetHand, setGrip, type Side } from './rig'

/**
 * Photo poses and expressions for Make a Scene, on the same two-bone hand IK the routines use.
 * Goals are relative to the character's own bones and face, so every body shape strikes the
 * same pose. Poses blend in over ~0.4 s and only run while no routine owns the hands.
 */

const bonePos = (c: Character, name: string) => (c.root.getObjectByName(name) as Bone | undefined)?.getWorldPosition(new Vector3()) ?? null

type Goal = (c: Character, t: number) => HandGoal | null

const S = (side: Side) => (side === 'Left' ? 1 : -1)

const POSE_GOALS: Record<PoseId | 'present', Partial<Record<Side, Goal>>> = {
  relaxed: {},
  'hand-on-hip': {
    Left: (c) => {
      const hip = bonePos(c, 'LeftUpLeg')
      if (!hip) return null
      return {
        target: hip.add(localVec(c, new Vector3(0.11, 0.1, 0.0))),
        fingers: localDir(c, new Vector3(-0.3, -0.5, 0.8)).normalize(),
        palm: localDir(c, new Vector3(-1, 0, 0)),
        effector: 'palm',
        grip: 'flat',
        weight: 1,
        pole: (bonePos(c, 'LeftArm') ?? hip).add(localVec(c, new Vector3(0.5, -0.1, -0.4))),
      }
    },
  },
  wave: {
    // elbow down and out, forearm up, open palm facing forward beside the head; the wrist sways
    Right: (c, t) => {
      const sh = bonePos(c, 'RightArm')
      if (!sh) return null
      const sway = Math.sin(t * 7) * 0.32
      const target = sh.clone().add(localVec(c, new Vector3(-0.16, 0.2, 0.12)))
      return {
        target,
        fingers: localDir(c, new Vector3(-sway, 1, 0.08)).normalize(),
        palm: localDir(c, new Vector3(0, 0, 1)),
        effector: 'palm',
        grip: 'open',
        weight: 1,
        pole: sh.clone().add(localVec(c, new Vector3(-0.45, -0.35, -0.05))),
      }
    },
  },
  peace: {
    Right: (c) => {
      const cheek = landmark(c, 'cheekR')
      if (!cheek) return null
      return {
        target: cheek.add(localVec(c, new Vector3(-0.07, 0.03, 0.09))),
        fingers: localDir(c, new Vector3(-0.15, 1, 0.1)).normalize(),
        palm: localDir(c, new Vector3(0, 0, 1)),
        effector: 'palm',
        grip: 'peace',
        weight: 1,
      }
    },
  },
  'hair-touch': {
    Right: (c) => {
      const { p, n } = hairPoint(c, -95, 25, 0.01)
      return { target: p, fingers: headUp(c).addScaledVector(n, -0.3).normalize(), palm: n.clone().negate(), effector: 'palm', grip: 'cup', weight: 1 }
    },
  },
  'hands-on-hips': {
    Left: (c) => onHip(c, 'Left'),
    Right: (c) => onHip(c, 'Right'),
  },
  selfie: {
    // phone held up and out at arm's length, a little above eye level, screen toward her face
    Right: (c, t) => {
      const head = c.head.getWorldPosition(new Vector3())
      const bob = Math.sin(t * 1.3) * 0.008
      const target = head.clone().add(localVec(c, new Vector3(-0.2, 0.12 + bob, 0.42)))
      return {
        target,
        fingers: localDir(c, new Vector3(0.15, 0.85, -0.35)).normalize(),
        palm: localDir(c, new Vector3(0.3, -0.1, -1)).normalize(),
        effector: 'palm',
        grip: 'hold',
        weight: 1,
        pole: target.clone().add(localVec(c, new Vector3(-0.5, -0.6, -0.1))),
      }
    },
    Left: (c) => {
      const cheek = landmark(c, 'cheekL')
      if (!cheek) return null
      return { target: cheek.add(localVec(c, new Vector3(0.07, 0.03, 0.09))), fingers: localDir(c, new Vector3(0.15, 1, 0.1)).normalize(), palm: localDir(c, new Vector3(0, 0, 1)), effector: 'palm', grip: 'peace', weight: 1 }
    },
  },
  thinking: {
    // chin resting on a loose fist, the other arm across the waist supporting that elbow
    Right: (c) => {
      const chin = landmark(c, 'chin')
      if (!chin) return null
      return {
        target: chin.add(localVec(c, new Vector3(-0.005, -0.03, 0.035))),
        fingers: localDir(c, new Vector3(0.25, 0.3, 0.9)).normalize(),
        palm: localDir(c, new Vector3(0.2, 0.9, -0.3)).normalize(),
        effector: 'palm',
        grip: 'cup',
        weight: 1,
        pole: chin.clone().add(localVec(c, new Vector3(-0.15, -0.6, 0.15))),
      }
    },
    Left: (c) => {
      const hips = bonePos(c, 'Spine')
      if (!hips) return null
      const target = hips.add(localVec(c, new Vector3(-0.06, 0.02, 0.17)))
      return { target, fingers: localDir(c, new Vector3(-1, 0.1, 0.1)).normalize(), palm: localDir(c, new Vector3(0, 0.3, -1)).normalize(), effector: 'palm', grip: 'flat', weight: 1, pole: target.clone().add(localVec(c, new Vector3(0.5, -0.5, 0.1))) }
    },
  },
  'arms-crossed': {
    Left: (c) => crossTo(c, 'Left'),
    Right: (c) => crossTo(c, 'Right'),
  },
  'hands-clasped': {
    Left: (c) => clasp(c, 'Left'),
    Right: (c) => clasp(c, 'Right'),
  },
  'blow-kiss': {
    Right: (c, t) => {
      const lips = landmark(c, 'lips')
      if (!lips) return null
      const k = (Math.sin(t * 1.6) + 1) / 2
      return {
        target: lips.add(localVec(c, new Vector3(-0.02, -0.01, 0.04 + 0.16 * k))),
        fingers: localDir(c, new Vector3(-0.2, 0.8, 0.4)).normalize(),
        palm: localDir(c, new Vector3(0, 0.3, 1)).normalize(),
        effector: 'index',
        grip: k > 0.5 ? 'open' : 'pinch',
        weight: 1,
      }
    },
  },
  present: {
    Left: (c) => presentHand(c, 'Left'),
    Right: (c) => presentHand(c, 'Right'),
  },
}

function onHip(c: Character, side: Side): HandGoal | null {
  const s = S(side)
  const hip = bonePos(c, `${side}UpLeg`)
  const arm = bonePos(c, `${side}Arm`)
  if (!hip || !arm) return null
  // the hand rests on the side of the hip, fingers forward and down, elbow out to the side
  const w = Math.abs(hip.x - (bonePos(c, 'Hips')?.x ?? 0))
  return {
    target: hip.add(localVec(c, new Vector3(s * (0.05 + w * 0.6), 0.11, 0.0))),
    fingers: localDir(c, new Vector3(-0.3 * s, -0.5, 0.8)).normalize(),
    palm: localDir(c, new Vector3(-s, 0, 0)),
    effector: 'palm',
    grip: 'flat',
    weight: 1,
    pole: arm.add(localVec(c, new Vector3(0.5 * s, -0.1, -0.4))),
  }
}

function crossTo(c: Character, side: Side): HandGoal | null {
  const s = S(side)
  const other = side === 'Left' ? 'Right' : 'Left'
  const arm = bonePos(c, `${other}Arm`)
  const fore = bonePos(c, `${other}ForeArm`)
  if (!arm || !fore) return null
  // the hand rests on the other upper arm, in front of the body; the left arm sits a touch higher
  const target = arm.lerp(fore, 0.7).add(localVec(c, new Vector3(0, s * 0.015, 0.075)))
  return {
    target,
    fingers: localDir(c, new Vector3(-s, -0.15, 0.15)).normalize(),
    palm: localDir(c, new Vector3(0, 0, -1)),
    effector: 'palm',
    grip: 'flat',
    weight: 1,
    pole: target.clone().add(localVec(c, new Vector3(s * 0.5, -0.4, 0.2))),
  }
}

function clasp(c: Character, side: Side): HandGoal | null {
  const s = S(side)
  const hips = bonePos(c, 'Hips')
  if (!hips) return null
  return {
    target: hips.add(localVec(c, new Vector3(s * 0.025, 0.04, 0.17))),
    fingers: localDir(c, new Vector3(-s, -0.4, 0.3)).normalize(),
    palm: localDir(c, new Vector3(-s, 0, 0.2)).normalize(),
    effector: 'palm',
    grip: 'cup',
    weight: 1,
  }
}

function presentHand(c: Character, side: Side): HandGoal | null {
  const s = S(side)
  const neck = landmark(c, 'neck')
  if (!neck) return null
  return {
    target: neck.add(localVec(c, new Vector3(0.08 * s, -0.17, 0.2))),
    fingers: localDir(c, new Vector3(-0.3 * s, 0.25, 0.9)).normalize(),
    palm: localDir(c, new Vector3(0, -0.6, -0.6)).normalize(),
    effector: 'palm',
    grip: 'flat',
    weight: 1,
  }
}

/** Apply a pose this frame (call only when no routine is running). Blends in once (eased) per change. */
export function applyPose(c: Character, pose: PoseId | 'present', t: number, dt: number) {
  const blend = (c.poseBlend ??= { pose, k: 1, from: 'relaxed' })
  if (blend.pose !== pose) {
    blend.from = blend.pose
    blend.pose = pose
    blend.k = 0
  }
  blend.k = Math.min(1, blend.k + dt / 0.45)
  const w = blend.k * blend.k * (3 - 2 * blend.k)
  const goals = POSE_GOALS[pose]
  for (const side of ['Left', 'Right'] as Side[]) {
    const h = c.hands[side]
    const g = goals[side]?.(c, t)
    if (!g) {
      resetHand(h)
      setGrip(h, 'relaxed')
      continue
    }
    reach(h, { ...g, weight: g.weight * w, pole: g.pole ?? defaultPole(c, side) })
  }
}

/**
 * Expressions from the face's shape keys, symmetrical unless meant not to be (the wink). Weights
 * stay below the keys' extremes so mouths never warp and teeth never show oddly.
 */
export const EXPRESSION_WEIGHTS: Record<ExpressionPreset, Partial<Record<ExpressionId, number>>> = {
  neutral: {},
  smile: { Expr_Smile: 0.8 },
  laugh: { Expr_Smile: 1, Expr_Open: 0.4, Expr_Squint: 0.35, Expr_BrowsUp: 0.2 },
  kiss: { Expr_Pout: 0.9, Expr_Sleepy: 0.35 },
  pout: { Expr_Pout: 0.85 },
  wink: { Expr_BlinkR: 1, Expr_Smile: 0.55 },
  surprised: { Expr_BrowsUp: 1, Expr_Open: 0.45 },
  sad: { Expr_Worried: 0.85, Expr_Sleepy: 0.3, Expr_Pout: 0.2 },
  soft: { Expr_Smile: 0.35, Expr_Sleepy: 0.25 },
}

/** Faces a pose brings with it (a blown kiss puckers the lips). */
export const POSE_FACE: Partial<Record<PoseId | 'present', (t: number) => Partial<Record<ExpressionId, number>>>> = {
  'blow-kiss': (t) => {
    const k = (Math.sin(t * 1.6) + 1) / 2
    return { Expr_Pout: k < 0.5 ? 0.9 : 0.9 * (1 - (k - 0.5) * 2), Expr_Smile: k > 0.5 ? (k - 0.5) * 1.2 : 0, Expr_Sleepy: 0.25 }
  },
  thinking: () => ({ Expr_Worried: 0.25, Expr_Pout: 0.15 }),
  selfie: () => ({ Expr_Smile: 0.7 }),
}

/** Props a held pose shows (the selfie phone). */
export const POSE_PROPS: Partial<Record<PoseId | 'present', { Left?: PropState; Right?: PropState }>> = {
  selfie: { Right: { id: 'phone', hold: 'grip' } },
}
