import { Bone, Group, Matrix4, Quaternion, Vector3, type SkinnedMesh } from 'three'
import { setCharacter, stepActions, type Character } from '../../src/studio/actions/engine'
import type { CareData, Landmark } from '../../src/studio/character/catalog'
import { buildHandRig, type LandmarkSource } from '../../src/studio/character/rig'
import { SPOT_IDS } from '../../src/shared/studio/look'

/**
 * A minimal, real three.js rig (arms, hands, fingers, head) with fixed face landmarks, so the
 * action engine and every routine run headless exactly as in the app (minus rendering).
 */
export function fakeCharacter(): Character {
  const root = new Group()
  const hips = new Bone()
  hips.name = 'Hips'
  hips.position.set(0, 1.0, 0)
  root.add(hips)
  const spine = new Bone()
  spine.name = 'Spine2'
  spine.position.set(0, 0.35, 0)
  hips.add(spine)
  const head = new Bone()
  head.name = 'Head'
  head.position.set(0, 0.32, 0)
  spine.add(head)
  for (const side of ['Left', 'Right'] as const) {
    const s = side === 'Left' ? 1 : -1
    const arm = new Bone()
    arm.name = `${side}Arm`
    arm.position.set(0.18 * s, 0.25, 0)
    spine.add(arm)
    const fore = new Bone()
    fore.name = `${side}ForeArm`
    fore.position.set(0, -0.28, 0)
    arm.add(fore)
    const hand = new Bone()
    hand.name = `${side}Hand`
    hand.position.set(0, -0.25, 0)
    fore.add(hand)
    const fingers: [string, number, number][] = [
      ['Thumb', 0.02 * s, 0.03],
      ['Index', 0.025 * s, 0.0],
      ['Middle', 0.0, 0.0],
      ['Ring', -0.02 * s, 0.0],
      ['Pinky', -0.035 * s, 0.0],
    ]
    for (const [f, x, z] of fingers) {
      let parent: Bone = hand
      for (let j = 1; j <= 3; j++) {
        const b = new Bone()
        b.name = `${side}Hand${f}${j}`
        b.position.set(j === 1 ? x : 0, j === 1 ? -0.09 : -0.03, j === 1 ? z : 0)
        parent.add(b)
        parent = b
      }
    }
  }
  root.updateMatrixWorld(true)

  // face landmarks around the head (model space; she faces +Z)
  const lm = (x: number, y: number, z: number): Landmark => ({ p: [x, y, z], n: [x * 4, 0, 1], uv: [0.8, 0.5] })
  const landmarks: Record<string, Landmark> = {
    foreheadC: lm(0, 1.74, 0.09),
    foreheadL: lm(0.04, 1.74, 0.085),
    foreheadR: lm(-0.04, 1.74, 0.085),
    cheekL: lm(0.045, 1.63, 0.08),
    cheekR: lm(-0.045, 1.63, 0.08),
    noseBridge: lm(0, 1.68, 0.1),
    noseTip: lm(0, 1.64, 0.115),
    chin: lm(0, 1.56, 0.09),
    underEyeL: lm(0.03, 1.665, 0.09),
    underEyeR: lm(-0.03, 1.665, 0.09),
    lips: lm(0, 1.6, 0.1),
    lipCornerL: lm(0.025, 1.6, 0.095),
    lipCornerR: lm(-0.025, 1.6, 0.095),
    earL: lm(0.075, 1.66, 0.0),
    earR: lm(-0.075, 1.66, 0.0),
    templeL: lm(0.065, 1.7, 0.05),
    templeR: lm(-0.065, 1.7, 0.05),
    jawL: lm(0.06, 1.58, 0.05),
    jawR: lm(-0.06, 1.58, 0.05),
    neck: lm(0, 1.48, 0.06),
  }
  const strokes: CareData['strokes'] = {
    forehead: [-0.05, 0, 0.05].map((x) => [x, 1.74, 0.088] as [number, number, number]),
    cheekL: [0, 1, 2, 3].map((k) => [0.045 + 0.01 * Math.cos(k), 1.63 + 0.01 * Math.sin(k), 0.08] as [number, number, number]),
    cheekR: [0, 1, 2, 3].map((k) => [-0.045 + 0.01 * Math.cos(k), 1.63 + 0.01 * Math.sin(k), 0.08] as [number, number, number]),
    nose: [
      [0, 1.68, 0.1],
      [0, 1.64, 0.115],
    ],
    chin: [
      [-0.02, 1.56, 0.09],
      [0.02, 1.56, 0.09],
    ],
    underEyeL: [
      [0.02, 1.665, 0.09],
      [0.045, 1.665, 0.088],
    ],
    underEyeR: [
      [-0.02, 1.665, 0.09],
      [-0.045, 1.665, 0.088],
    ],
    lips: [
      [-0.025, 1.6, 0.095],
      [0.025, 1.6, 0.095],
    ],
  }
  const spots = SPOT_IDS.map((id, i) => ({ ...lm(-0.04 + i * 0.012, 1.62 + (i % 3) * 0.04, 0.085), id, r: 0.004 }))
  const care: CareData = { landmarks, strokes, spots, nails: [], jewellery: {} }

  // landmark source: vertex i is the i-th point, already in world space
  const points: Vector3[] = []
  const index = new Map<string, number>()
  const addPoint = (key: string, p: readonly number[]) => {
    index.set(key, points.length)
    points.push(new Vector3(p[0], p[1], p[2]))
  }
  for (const [k, l] of Object.entries(landmarks)) addPoint(k, l.p)
  for (const [k, list] of Object.entries(strokes)) list.forEach((p, i) => addPoint(`stroke:${k}:${i}`, p))
  for (const s of spots) addPoint(`spot:${s.id}`, s.p)
  const body = {
    matrixWorld: new Matrix4(),
    getVertexPosition: (i: number, out: Vector3) => out.copy(points[i]),
    skeleton: { bones: [head], boneInverses: [new Matrix4().copy(head.matrixWorld).invert()] },
  } as unknown as SkinnedMesh
  const landmarkSrc: LandmarkSource = { body, index }

  const c: Character = {
    root,
    body,
    head,
    headLocalC: new Vector3(0, 0.085, 0.01),
    hands: { Left: buildHandRig(root, 'Left')!, Right: buildHandRig(root, 'Right')! },
    landmarks: landmarkSrc,
    care,
    headRestQ: head.getWorldQuaternion(new Quaternion()),
    hair: () => [],
    nails: null,
  }
  return c
}

export function installCharacter() {
  const c = fakeCharacter()
  setCharacter(c)
  return c
}

/** Drive the engine like the render loop would, until `p` settles (or a frame budget runs out). */
export async function play<T>(p: Promise<T>, opts: { dt?: number; maxFrames?: number; onFrame?: (i: number) => void } = {}): Promise<T> {
  let done = false
  let value!: T
  p.then((v) => {
    done = true
    value = v
  })
  for (let i = 0; i < (opts.maxFrames ?? 20000) && !done; i++) {
    opts.onFrame?.(i)
    stepActions(opts.dt ?? 0.05)
    await new Promise((r) => setTimeout(r, 0))
  }
  if (!done) throw new Error('action never settled')
  return value
}
