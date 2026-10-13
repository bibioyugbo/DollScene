import {
  CatmullRomCurve3,
  CircleGeometry,
  CylinderGeometry,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  SphereGeometry,
  TorusGeometry,
  TubeGeometry,
  Vector3,
  Quaternion,
  type Bone,
  type BufferGeometry,
  type Material,
  type Object3D,
} from 'three'
import type { Jewellery } from '../../shared/studio/look'
import type { CareData } from './catalog'
import { landmarkWorld, type LandmarkSource } from './rig'
import { eyeCentres, modelAxis, refreshMatrices, toBoneLocal } from './space'

/**
 * Jewellery and piercings: small low-poly meshes parented to the bone that carries each spot
 * (head for ears, nose, lips and brow; upper spine for necklaces; hand bones for bracelets and
 * rings), placed from the rest-pose anchors the build measured on the body. They follow every
 * head turn and hand pose, and never change the body's shape.
 */

const METAL: Record<Jewellery['metal'], string> = { gold: '#d6a84e', silver: '#d9dade', rose: '#e0a38c' }

const materials = new Map<string, Material>()
function metal(m: Jewellery['metal']) {
  const k = `metal-${m}`
  let mat = materials.get(k)
  if (!mat) materials.set(k, (mat = new MeshStandardMaterial({ color: METAL[m], metalness: 1, roughness: 0.22, envMapIntensity: 1.3 })))
  return mat
}
const pearlMat = new MeshPhysicalMaterial({ color: '#f4efe6', roughness: 0.25, iridescence: 0.6, iridescenceIOR: 1.4, sheen: 0.5, sheenColor: '#ffffff' })
const gemMat = new MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.02, iridescence: 1, emissive: '#c8d4ff', emissiveIntensity: 0.15 })

const geo = {
  stud: new IcosahedronGeometry(0.0019, 1),
  ball: new SphereGeometry(0.0013, 10, 8),
  bead: new SphereGeometry(0.0034, 10, 8),
  drop: new SphereGeometry(0.003, 10, 8).scale(1, 1.6, 1),
  bar: new CylinderGeometry(0.0004, 0.0004, 1, 6),
}
const torus = (R: number, r: number, arc = Math.PI * 2) => new TorusGeometry(R, r, 6, 28, arc)

const v = new Vector3()
const up = new Vector3(0, 1, 0)

interface Frame {
  bone: string
  p: Vector3
  /** Out of the surface (or along the axis for bracelets/rings). */
  z: Vector3
}

/** A group at a world-space frame, parented to its bone (null when the anchor or bone is missing). */
function mount(root: Object3D, f: Frame | null, parts: Group[]): Group | null {
  if (!f) return null
  const bone = root.getObjectByName(f.bone) as Bone | undefined
  if (!bone) return null
  const z = f.z.clone().normalize()
  // +Z out of the surface (or along the axis), +Y as close to the character's up as possible
  const upW = modelAxis(root, up)
  let y = upW.clone().addScaledVector(z, -upW.dot(z))
  if (y.lengthSq() < 1e-4) {
    const fwd = modelAxis(root, new Vector3(0, 0, 1))
    y = fwd.addScaledVector(z, -fwd.dot(z))
  }
  y.normalize()
  const x = new Vector3().crossVectors(y, z)
  const g = new Group()
  toBoneLocal(bone, f.p, x, y, z, g)
  parts.push(g)
  return g
}

function add(g: Group | null, geometry: BufferGeometry, material: Material, pos: [number, number, number] = [0, 0, 0], rot?: [number, number, number], scale?: [number, number, number]) {
  if (!g) return null
  const m = new Mesh(geometry, material)
  m.position.set(...pos)
  if (rot) m.rotation.set(...rot)
  if (scale) m.scale.set(...scale)
  m.frustumCulled = false
  g.add(m)
  return m
}

/** A hanging loop around the neck base (front drops lowest), for chains, pendants and pearls. */
function neckCurve(r: number, drop: number, lift: number) {
  const pts: Vector3[] = []
  for (let i = 0; i < 32; i++) {
    const a = (i / 32) * Math.PI * 2
    const front = (1 + Math.cos(a)) / 2
    pts.push(new Vector3(Math.sin(a) * r * 1.02, lift - drop * front * front, Math.cos(a) * r * (1.08 + 0.25 * front)))
  }
  return new CatmullRomCurve3(pts, true)
}

export interface JewellerySet {
  dispose: () => void
}

export function buildJewellery(root: Object3D, care: CareData, lm: LandmarkSource, j: Jewellery): JewellerySet {
  // fresh matrices for the whole doll: the landmark read uses the body's own world matrix
  refreshMatrices(root)
  const parts: Group[] = []
  const owned: BufferGeometry[] = []
  const own = <T extends BufferGeometry>(g: T) => (owned.push(g), g)
  const M = metal(j.metal)
  const rootQ = root.getWorldQuaternion(new Quaternion())
  // a landmark on the live skin, with its rest normal turned with the character
  const at = (key: string, bone: string): Frame | null => {
    const l = care.landmarks[key]
    const p = landmarkWorld(lm, key, new Vector3())
    if (!l || !p) return null
    return { bone, p, z: new Vector3(...l.n).applyQuaternion(rootQ).normalize() }
  }
  const bonePos = (name: string) => (root.getObjectByName(name) as Bone | undefined)?.getWorldPosition(new Vector3()) ?? null

  // ears: lobes and helix
  for (const s of ['L', 'R'] as const) {
    const sgn = s === 'L' ? 1 : -1
    if (j.ears !== 'none') {
      const g = mount(root, at(`earLobe${s}`, 'Head'), parts)
      if (j.ears === 'studs') add(g, geo.stud, gemMat, [0, 0.001, 0.0012])
      if (j.ears === 'huggies') add(g, own(torus(0.0042, 0.0009)), M, [0, -0.002, 0], [0, Math.PI / 2, 0])
      if (j.ears === 'hoops') add(g, own(torus(0.011, 0.0008)), M, [0, -0.0105, -0.001], [0, Math.PI / 2, 0])
      if (j.ears === 'drops') {
        add(g, geo.ball, M, [0, 0, 0.001])
        add(g, geo.bar, M, [0, -0.007, 0], undefined, [1, 0.012, 1])
        add(g, geo.drop, gemMat, [0, -0.016, 0])
      }
    }
    if (j.helix) add(mount(root, at(`earHelix${s}`, 'Head'), parts), own(torus(0.0038, 0.0006)), M, [0, 0, -0.001], [0, (Math.PI / 2) * sgn, 0])
  }
  // nose, septum, lip, brow
  if (j.nose === 'stud') add(mount(root, at('nostrilL', 'Head'), parts), geo.ball, gemMat, [0, 0, 0.0006], undefined, [1.1, 1.1, 1.1])
  if (j.nose === 'ring') add(mount(root, at('nostrilL', 'Head'), parts), own(torus(0.0036, 0.0005)), M, [0.001, -0.0025, 0], [0, Math.PI / 2, 0])
  if (j.septum) add(mount(root, at('septum', 'Head'), parts), own(torus(0.0042, 0.0006, Math.PI * 1.6)), M, [0, -0.0035, 0.0015], [Math.PI / 2, 0, Math.PI * 0.7])
  if (j.lip === 'stud') add(mount(root, at('labret', 'Head'), parts), geo.ball, M, [0, 0, 0.0006])
  if (j.lip === 'ring') add(mount(root, at('labret', 'Head'), parts), own(torus(0.0045, 0.0006)), M, [0, 0.0028, 0.0012], [0, Math.PI / 2, 0])
  if (j.brow) {
    const g = mount(root, at('browEndR', 'Head'), parts)
    add(g, geo.ball, M, [0, 0.004, 0.001])
    add(g, geo.ball, M, [0, -0.004, 0.001])
  }
  if (j.navel) {
    const g = mount(root, at('navel', 'Spine'), parts)
    add(g, geo.ball, M, [0, 0.003, 0.0012])
    add(g, geo.drop, gemMat, [0, -0.006, 0.0018])
  }

  // necklaces ride the upper spine
  const nb = care.jewellery.neckBase
  const neck = at('neck', 'Spine2')
  if (nb && neck && j.necklace !== 'none') {
    // the ring's centre sits a neck-radius behind the front-of-neck vertex
    const fwd = modelAxis(root, new Vector3(0, 0, 1))
    const g = mount(root, { bone: 'Spine2', p: neck.p.clone().addScaledVector(fwd, -nb.r), z: fwd }, parts)
    if (j.necklace === 'choker') add(g, own(new TubeGeometry(neckCurve(nb.r * 0.98, 0, 0.035), 48, 0.0028, 6, true)), new MeshStandardMaterial({ color: '#141014', roughness: 0.5 }))
    if (j.necklace === 'chain' || j.necklace === 'pendant') {
      const curve = neckCurve(nb.r, j.necklace === 'pendant' ? 0.085 : 0.05, 0.006)
      add(g, own(new TubeGeometry(curve, 96, 0.0007, 5, true)), M)
      if (j.necklace === 'pendant') {
        curve.getPoint(0, v)
        add(g, geo.drop, gemMat, [v.x, v.y - 0.007, v.z + 0.002], undefined, [1.6, 1.6, 1.2])
        add(g, own(torus(0.0032, 0.0007)), M, [v.x, v.y - 0.001, v.z + 0.0015])
      }
    }
    if (j.necklace === 'pearls' && g) {
      const curve = neckCurve(nb.r, 0.045, 0.006)
      const n = 46
      const inst = new InstancedMesh(geo.bead, pearlMat, n)
      const m = new Matrix4()
      for (let i = 0; i < n; i++) inst.setMatrixAt(i, m.makeTranslation(curve.getPoint(i / n, v)))
      inst.frustumCulled = false
      g.add(inst)
    }
  }

  // bracelets and rings follow the hands (frames from the live hand and finger bones)
  for (const side of ['Left', 'Right'] as const) {
    const sx = side[0] as 'L' | 'R'
    const hand = bonePos(`${side}Hand`)
    const fore = bonePos(`${side}ForeArm`)
    if (hand && fore && j.wrist !== 'none') {
      const axis = hand.clone().sub(fore).normalize()
      const g = mount(root, { bone: `${side}Hand`, p: hand.clone().addScaledVector(axis, -0.015), z: axis }, parts)
      const R = (care.jewellery[`wrist${sx}`]?.r ?? 0.026) * 1.32
      if (j.wrist === 'bangle') add(g, own(torus(R, 0.0022)), M)
      if (j.wrist === 'chain') add(g, own(torus(R * 0.96, 0.0008)), M)
      if (j.wrist === 'stack') for (let i = 0; i < 3; i++) add(g, own(torus(R * (1 - i * 0.02), i === 1 ? 0.0012 : 0.0018)), M, [0, 0, -0.006 * i])
    }
    const r1 = bonePos(`${side}HandRing1`)
    const r2 = bonePos(`${side}HandRing2`)
    if (r1 && r2 && j.rings) {
      const axis = r2.clone().sub(r1).normalize()
      const g = mount(root, { bone: `${side}HandRing1`, p: r1.clone().lerp(r2, 0.45), z: axis }, parts)
      const rr = (care.jewellery[`ring${sx}`]?.r ?? 0.008) * 1.12
      add(g, own(torus(rr, 0.0011)), M)
      add(g, geo.stud, gemMat, [0, rr + 0.0015, 0], undefined, [0.8, 0.8, 0.8])
    }
  }

  // glasses: rims in front of each eye, a bridge over the nose, arms back to the ears
  if (j.glasses !== 'none') {
    const g = glasses(root, lm, j, own)
    if (g) parts.push(g)
  }

  return {
    dispose: () => {
      for (const g of parts) g.parent?.remove(g)
      for (const g of owned) g.dispose()
    },
  }
}


/** Spectacles fitted to this face from its live landmarks, parented to the head. */
function glasses(root: Object3D, lm: LandmarkSource, j: Jewellery, own: <T extends BufferGeometry>(g: T) => T): Group | null {
  const head = root.getObjectByName('Head') as Bone | undefined
  const p = (k: string) => landmarkWorld(lm, k, new Vector3())
  const eyes = eyeCentres(root)
  const eL = p('earL') ?? p('templeL')
  const eR = p('earR') ?? p('templeR')
  if (!head || !eyes || !eL || !eR) return null
  const upW = modelAxis(root, up)
  const fwd = modelAxis(root, new Vector3(0, 0, 1))
  const ipd = eyes.L.distanceTo(eyes.R)
  const R = ipd * 0.4
  // each lens centred on its eye, just in front of the lashes
  const lens = (c: Vector3) => c.clone().addScaledVector(fwd, eyes.radius + 0.013).addScaledVector(upW, 0.001)
  const cL = lens(eyes.L)
  const cR = lens(eyes.R)
  const sun = j.glasses === 'sunnies'
  const frameMat = new MeshStandardMaterial({ color: j.frame, roughness: 0.35, metalness: 0.2 })
  const lensMat = new MeshPhysicalMaterial({ color: sun ? '#1a1418' : '#dfe8f2', transparent: true, opacity: sun ? 0.82 : 0.12, roughness: 0.05, depthWrite: false })
  const g = new Group()
  // world-space parts, then the whole group re-expressed in head space
  const q = new Matrix4().makeBasis(new Vector3().crossVectors(upW, fwd).normalize(), upW, fwd)
  for (const [c, s] of [
    [cL, 1],
    [cR, -1],
  ] as [Vector3, number][]) {
    const scale: [number, number, number] = j.glasses === 'square' ? [1.18, 0.86, 1] : j.glasses === 'cateye' ? [1.22, 0.82, 1] : sun ? [1.15, 1, 1] : [1, 1, 1]
    const rim = new Mesh(own(j.glasses === 'square' ? torus(R * 1.05, 0.0013) : torus(R * (sun ? 1.12 : 1), 0.0012)), frameMat)
    rim.position.copy(c)
    rim.quaternion.setFromRotationMatrix(q)
    if (j.glasses === 'square') rim.rotateZ(Math.PI / 4)
    if (j.glasses === 'cateye') rim.rotateZ(0.22 * s)
    rim.scale.set(...scale)
    const glass = new Mesh(own(new CircleGeometry(R * (sun ? 1.1 : 1), 24)), lensMat)
    glass.position.copy(c)
    glass.quaternion.copy(rim.quaternion)
    glass.scale.copy(rim.scale)
    g.add(rim, glass)
    // arm from the outer edge of the rim back to the top of the ear
    const outer = c.clone().addScaledVector(new Vector3().crossVectors(upW, fwd).normalize(), R * scale[0] * s)
    const ear = (s > 0 ? eL : eR).clone().addScaledVector(upW, 0.012)
    const len = outer.distanceTo(ear)
    const arm = new Mesh(own(new CylinderGeometry(0.0011, 0.0011, len, 5)), frameMat)
    arm.position.copy(outer).lerp(ear, 0.5)
    arm.quaternion.setFromUnitVectors(up, ear.clone().sub(outer).normalize())
    g.add(arm)
  }
  const span = cL.distanceTo(cR) - 2 * R
  const br = new Mesh(own(new CylinderGeometry(0.0011, 0.0011, Math.max(0.004, span), 5)), frameMat)
  br.position.copy(cL).lerp(cR, 0.5).addScaledVector(upW, R * 0.25)
  br.quaternion.setFromUnitVectors(up, cR.clone().sub(cL).normalize())
  g.add(br)
  for (const m of g.children) m.frustumCulled = false
  toBoneLocal(head, new Vector3(), new Vector3(1, 0, 0), new Vector3(0, 1, 0), new Vector3(0, 0, 1), g)
  return g
}
