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
  Quaternion,
  Shape,
  ShapeGeometry,
  SphereGeometry,
  TorusGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
  type Bone,
  type BufferGeometry,
  type Material,
  type Object3D,
  type SkinnedMesh,
} from 'three'
import type { Extras, Jewellery } from '../../shared/studio/look'
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

/** A rounded rectangle (w x h, corner radius cr) in the XY plane, as an outline of points. */
function roundedRect(w: number, h: number, cr: number, per = 6) {
  const pts: Vector2[] = []
  const corners: [number, number, number][] = [
    [w / 2 - cr, h / 2 - cr, 0],
    [-w / 2 + cr, h / 2 - cr, Math.PI / 2],
    [-w / 2 + cr, -h / 2 + cr, Math.PI],
    [w / 2 - cr, -h / 2 + cr, (3 * Math.PI) / 2],
  ]
  for (const [cx, cy, a0] of corners) for (let i = 0; i <= per; i++) pts.push(new Vector2(cx + Math.cos(a0 + (i / per) * (Math.PI / 2)) * cr, cy + Math.sin(a0 + (i / per) * (Math.PI / 2)) * cr))
  return pts
}
const rectRim = (w: number, h: number, cr: number, r: number) => new TubeGeometry(new CatmullRomCurve3(roundedRect(w, h, cr).map((p) => new Vector3(p.x, p.y, 0)), true, 'centripetal'), 72, r, 6, true)
const rectLens = (w: number, h: number, cr: number) => new ShapeGeometry(new Shape(roundedRect(w, h, cr)), 4)

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

export function buildJewellery(root: Object3D, care: CareData, lm: LandmarkSource, j: Jewellery, dressed = false): JewellerySet {
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
    // industrial: one straight bar through the top of the ear, a ball at each end (right ear)
    if (j.industrial && s === 'R') {
      const a = landmarkWorld(lm, 'jw:industrialAR', new Vector3())
      const b = landmarkWorld(lm, 'jw:industrialBR', new Vector3())
      if (a && b) {
        const out = modelAxis(root, new Vector3(-1, 0, 0))
        a.addScaledVector(out, 0.002)
        b.addScaledVector(out, 0.002)
        const g = mount(root, { bone: 'Head', p: a.clone().lerp(b, 0.5), z: out }, parts)
        if (g) {
          // a long 14g barbell (~1.6 mm): it spans the whole upper ear, a ball out of each hole
          const len = Math.max(0.03, a.distanceTo(b) + 0.01)
          const bar = add(g, own(new CylinderGeometry(0.0008, 0.0008, len, 8)), M)
          // along a -> b, in the mount's local frame
          const dirL = b.clone().sub(a).normalize().applyQuaternion(g.getWorldQuaternion(new Quaternion()).invert())
          bar?.quaternion.setFromUnitVectors(up, dirL)
          add(g, geo.ball, M, dirL.clone().multiplyScalar(len / 2).toArray() as [number, number, number], undefined, [1.35, 1.35, 1.35])
          add(g, geo.ball, M, dirL.clone().multiplyScalar(-len / 2).toArray() as [number, number, number], undefined, [1.35, 1.35, 1.35])
        }
      }
    }
  }
  // nose, septum, lip, brow
  if (j.nose === 'stud') add(mount(root, at('nostrilL', 'Head'), parts), geo.ball, gemMat, [0, 0, 0.0006], undefined, [1.1, 1.1, 1.1])
  if (j.nose === 'ring') add(mount(root, at('nostrilL', 'Head'), parts), own(torus(0.0036, 0.0005)), M, [0.001, -0.0025, 0], [0, Math.PI / 2, 0])
  const fwdW = modelAxis(root, new Vector3(0, 0, 1))
  const upW = modelAxis(root, up)
  if (j.septum) {
    // a horseshoe (circular barbell) through the nostril divider: in the face's frontal plane, its
    // top arc through the septum, hanging just below the nose, opening at the bottom with a ball
    // on each end (16g, 10 mm across)
    const s = at('septum', 'Head')
    if (s) {
      const R = 0.005
      const gap = Math.PI * 0.5
      const centre = s.p.clone().addScaledVector(fwdW, -0.0018).addScaledVector(upW, -(R - 0.0016))
      const g = mount(root, { bone: 'Head', p: centre, z: fwdW }, parts)
      add(g, own(torus(R, 0.0006, Math.PI * 2 - gap)), M, [0, 0, 0], [0, 0, -Math.PI / 2 + gap / 2])
      for (const sx of [-1, 1]) add(g, geo.ball, M, [sx * Math.sin(gap / 2) * R, -Math.cos(gap / 2) * R, 0], undefined, [1.15, 1.15, 1.15])
    }
  }
  // lips: three real placements
  const lipFrame = (p: Vector3 | null, n: Frame | null) => (p && n ? mount(root, { bone: 'Head', p, z: n.z }, parts) : null)
  const labret = at('labret', 'Head')
  const cL = at('lipCornerL', 'Head')
  const cR = at('lipCornerR', 'Head')
  const mid = at('lips', 'Head')
  if (j.lip === 'labret') add(mount(root, labret, parts), geo.stud, M, [0, 0, 0.0008], undefined, [0.9, 0.9, 0.9])
  if (j.lip === 'monroe' && cL && mid) {
    // above the upper lip on her left, in line with the lip's outer third (Marilyn's beauty spot)
    const p = mid.p.clone().lerp(cL.p, 0.62).addScaledVector(upW, 0.0095)
    add(lipFrame(p, mid), geo.stud, M, [0, 0, 0.0008], undefined, [0.9, 0.9, 0.9])
  }
  if (j.lip === 'snakebites' && cL && cR && labret) {
    // two rings through the lower lip, one toward each corner, hugging the lip's edge
    for (const c of [cL, cR]) {
      const p = labret.p.clone().lerp(c.p, 0.58).addScaledVector(upW, 0.0022)
      add(lipFrame(p, labret), own(torus(0.0042, 0.0006)), M, [0, 0.0012, 0.0006], [0, Math.PI / 2, 0])
    }
  }
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
    const body = lm.body as SkinnedMesh | undefined
    const over = dressed ? 0.016 : 0.004
    if (j.necklace === 'chain' || j.necklace === 'pendant') {
      const curve = drape(neckCurve(nb.r, j.necklace === 'pendant' ? 0.085 : 0.05, 0.006), g, body, over)
      add(g, own(new TubeGeometry(curve, 96, 0.0007, 5, true)), M)
      if (j.necklace === 'pendant') {
        curve.getPoint(0, v)
        add(g, geo.drop, gemMat, [v.x, v.y - 0.007, v.z + 0.002], undefined, [1.6, 1.6, 1.2])
        add(g, own(torus(0.0032, 0.0007)), M, [v.x, v.y - 0.001, v.z + 0.0015])
      }
    }
    if (j.necklace === 'pearls' && g) {
      const curve = drape(neckCurve(nb.r, 0.045, 0.006), g, body, over + 0.002)
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
  // Real frames: lens ~0.75 of the eye spacing wide, a bridge of ~0.3 of it, so the frame's centres
  // sit OUTSIDE the pupils (frame PD > her PD), wide enough for the face: the lenses never crowd the
  // nose. Only two shapes: true circles (round) and rounded rectangles; sunnies are the exception.
  const R = ipd * 0.37
  const side = new Vector3().crossVectors(upW, fwd).normalize()
  const lens = (c: Vector3, s: number) => c.clone().addScaledVector(fwd, eyes.radius + 0.014).addScaledVector(upW, 0.001).addScaledVector(side, ipd * 0.1 * s)
  const cL = lens(eyes.L, 1)
  const cR = lens(eyes.R, -1)
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
    const rect = j.glasses === 'square'
    const scale: [number, number, number] = rect ? [1.12, 1, 1] : sun ? [1.1, 1, 1] : [1, 1, 1]
    const rw = R * 2.24
    const rh = R * 1.62
    const rim = new Mesh(own(rect ? rectRim(rw, rh, R * 0.3, 0.0013) : torus(R * (sun ? 1.12 : 1), 0.0012)), frameMat)
    rim.position.copy(c)
    rim.quaternion.setFromRotationMatrix(q)
    if (!rect) rim.scale.set(...scale)
    const glass = new Mesh(own(rect ? rectLens(rw, rh, R * 0.3) : new CircleGeometry(R * (sun ? 1.1 : 1), 24)), lensMat)
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
  const span = cL.distanceTo(cR) - 2 * R * (j.glasses === 'round' ? 1 : 1.1)
  const br = new Mesh(own(new CylinderGeometry(0.0011, 0.0011, Math.max(0.004, span), 5)), frameMat)
  br.position.copy(cL).lerp(cR, 0.5).addScaledVector(upW, R * 0.25)
  br.quaternion.setFromUnitVectors(up, cR.clone().sub(cL).normalize())
  g.add(br)
  for (const m of g.children) m.frustumCulled = false
  toBoneLocal(head, new Vector3(), new Vector3(1, 0, 0), new Vector3(0, 1, 0), new Vector3(0, 0, 1), g)
  return g
}


/* ------------------------------------------------------------------ worn accessories */

const CORAL = new MeshPhysicalMaterial({ color: '#d9452b', roughness: 0.32, clearcoat: 0.6, clearcoatRoughness: 0.3 })
const coralBead = new SphereGeometry(0.0042, 10, 8)
const smallBead = new SphereGeometry(0.0028, 8, 6)
const link = new TorusGeometry(0.0036, 0.0011, 5, 10)

/** Beads (instanced) along a curve, each `spacing` apart. */
function beadsAlong(g: Group | null, curve: CatmullRomCurve3, geometry: BufferGeometry, material: Material, spacing: number, twist = false) {
  if (!g) return
  const n = Math.max(3, Math.round(curve.getLength() / spacing))
  const inst = new InstancedMesh(geometry, material, n)
  const m = new Matrix4()
  const q = new Quaternion()
  const t = new Vector3()
  for (let i = 0; i < n; i++) {
    curve.getPointAt(i / n, v)
    if (twist) {
      curve.getTangentAt(i / n, t)
      q.setFromUnitVectors(new Vector3(0, 0, 1), t)
      if (i % 2) q.multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), Math.PI / 2))
      m.compose(v, q, new Vector3(1, 1, 1))
    } else m.makeTranslation(v)
    inst.setMatrixAt(i, m)
  }
  inst.frustumCulled = false
  g.add(inst)
}

/**
 * Chains, pendants, pearls and coral drape OVER whatever she's wearing: every point of the loop
 * that would sit inside the chest (or the top over it) is lifted out to the live body's surface
 * plus a clearance (more when a top or dress is on: clothes sit ~1 cm off the skin). The curve is
 * in the necklace mount's frame (`g`); the body is read posed and morphed.
 */
function drape(curve: CatmullRomCurve3, g: Group | null, body: SkinnedMesh | undefined, clearance: number, n = 96): CatmullRomCurve3 {
  if (!g || !body) return curve
  g.updateWorldMatrix(true, false)
  const toLocal = new Matrix4().copy(g.matrixWorld).invert()
  const pts = curve.getSpacedPoints(n).slice(0, n)
  // the front of the chest under the loop, in the mount's frame
  const lo = Math.min(...pts.map((p) => p.y)) - 0.03
  const hi = Math.max(...pts.map((p) => p.y)) + 0.03
  const pos = body.geometry.attributes.position
  const p = new Vector3()
  const surf: number[] = []
  for (let i = 0; i < pos.count; i++) {
    body.getVertexPosition(i, p)
    p.applyMatrix4(body.matrixWorld).applyMatrix4(toLocal)
    if (p.y < lo || p.y > hi || p.z < -0.02 || Math.abs(p.x) > 0.22) continue
    surf.push(p.x, p.y, p.z)
  }
  for (const q of pts) {
    if (q.z < 0) continue
    let top = -Infinity
    for (let k = 0; k < surf.length; k += 3) if (Math.abs(surf[k] - q.x) < 0.012 && Math.abs(surf[k + 1] - q.y) < 0.012) top = Math.max(top, surf[k + 2])
    if (top > -Infinity && q.z < top + clearance) q.z = top + clearance
  }
  return new CatmullRomCurve3(pts, true, 'centripetal')
}

/** Centre and half-widths (model space x/z) of the body's cross-section at world point `c`. */
function section(body: SkinnedMesh, root: Object3D, c: Vector3, halfH = 0.012, near = 0.25) {
  const toModel = new Matrix4().copy(root.matrixWorld).invert()
  const cm = c.clone().applyMatrix4(toModel)
  const pos = body.geometry.attributes.position
  const p = new Vector3()
  let x0 = Infinity
  let x1 = -Infinity
  let z0 = Infinity
  let z1 = -Infinity
  for (let i = 0; i < pos.count; i++) {
    body.getVertexPosition(i, p)
    p.applyMatrix4(body.matrixWorld).applyMatrix4(toModel)
    if (Math.abs(p.y - cm.y) > halfH || Math.hypot(p.x - cm.x, p.z - cm.z) > near) continue
    x0 = Math.min(x0, p.x)
    x1 = Math.max(x1, p.x)
    z0 = Math.min(z0, p.z)
    z1 = Math.max(z1, p.z)
  }
  if (!Number.isFinite(x0)) return null
  return { c: new Vector3((x0 + x1) / 2, cm.y, (z0 + z1) / 2).applyMatrix4(root.matrixWorld), rx: (x1 - x0) / 2, rz: (z1 - z0) / 2 }
}

/** An ellipse loop (model axes) around a world centre, as a curve in a group's local space. */
function loop(g: Group, c: Vector3, rx: number, rz: number, root: Object3D, sag = 0, n = 40) {
  const rootQ = root.getWorldQuaternion(new Quaternion())
  const inv = new Matrix4().copy(g.matrixWorld).invert()
  const pts: Vector3[] = []
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    const front = (1 + Math.cos(a)) / 2
    const off = new Vector3(Math.sin(a) * rx, -sag * front * front, Math.cos(a) * rz).applyQuaternion(rootQ)
    pts.push(c.clone().add(off).applyMatrix4(inv))
  }
  return new CatmullRomCurve3(pts, true)
}

/** A group on `bone` at the bone's own world frame (so world-space curves can be expressed in it). */
function onBone(root: Object3D, bone: string, parts: Group[]) {
  const b = root.getObjectByName(bone) as Bone | undefined
  if (!b) return null
  const g = new Group()
  b.add(g)
  // undo the bone's world scale so local metres stay metres
  b.updateWorldMatrix(true, false)
  const s = new Vector3()
  b.matrixWorld.decompose(new Vector3(), new Quaternion(), s)
  g.scale.set(1 / s.x, 1 / s.y, 1 / s.z)
  g.updateWorldMatrix(true, false)
  parts.push(g)
  return g
}

/**
 * Accessories worn on the body (look.extras): a coral or satin headband, stacked coral necklaces,
 * coral bracelets and anklets, waist beads, rainbow pins on the top, a glasses chain and layered
 * chains. Sized from her live, morphed body, parented to the bones they ride.
 */
export function buildExtras(root: Object3D, care: CareData, lm: LandmarkSource, e: Extras, j: Jewellery, dressed = false): JewellerySet {
  refreshMatrices(root)
  const parts: Group[] = []
  const owned: BufferGeometry[] = []
  const own = <T extends BufferGeometry>(g: T) => (owned.push(g), g)
  const ownedMats: Material[] = []
  const body = lm.body as SkinnedMesh
  const bonePos = (name: string) => (root.getObjectByName(name) as Bone | undefined)?.getWorldPosition(new Vector3()) ?? null
  const upW = modelAxis(root, up)
  const fwd = modelAxis(root, new Vector3(0, 0, 1))
  const M = metal(j.metal)

  // headband: over the hair, round the head just above the hairline
  if (e.head !== 'none') {
    const head = bonePos('Head')
    const fh = landmarkWorld(lm, 'foreheadC', new Vector3())
    const tL = landmarkWorld(lm, 'templeL', new Vector3())
    const tR = landmarkWorld(lm, 'templeR', new Vector3())
    const g = onBone(root, 'Head', parts)
    if (head && fh && tL && tR && g) {
      const c = tL.clone().lerp(tR, 0.5)
      const rx = tL.distanceTo(tR) / 2 + 0.022
      const front = fh.clone().sub(c).dot(fwd)
      const lift = fh.clone().sub(c).dot(upW) + 0.018
      const centre = c.clone().addScaledVector(upW, lift).addScaledVector(fwd, -0.012)
      const curve = loop(g, centre, rx, front + 0.026, root, -0.02)
      const col = new MeshStandardMaterial({ color: e.color, roughness: e.head === 'satinBand' ? 0.3 : 0.6 })
      ownedMats.push(col)
      if (e.head === 'coralBand') {
        beadsAlong(g, curve, coralBead, CORAL, 0.0085)
        // a crest of coral at the front, like a traditional bride's
        const top = fh.clone().addScaledVector(upW, 0.03).addScaledVector(fwd, 0.012)
        const crest = new CatmullRomCurve3([top.clone().addScaledVector(side(root), 0.03), top.clone().addScaledVector(upW, 0.03), top.clone().addScaledVector(side(root), -0.03)].map((p) => p.applyMatrix4(new Matrix4().copy(g.matrixWorld).invert())))
        beadsAlong(g, crest, coralBead, CORAL, 0.0085)
      } else add(g, own(new TubeGeometry(curve, 64, e.head === 'headscarf' ? 0.016 : 0.0065, 8, true)), col, [0, 0, 0], undefined, e.head === 'headscarf' ? [1, 1.6, 1] : [1, 1, 1])
    }
  }

  // necklaces: stacked coral strands, layered chains
  const nb = care.jewellery.neckBase
  const neck = landmarkWorld(lm, 'neck', new Vector3())
  if (nb && neck && (e.coralBeads || e.chains)) {
    const g = mount(root, { bone: 'Spine2', p: neck.clone().addScaledVector(fwd, -nb.r), z: fwd }, parts)
    // layered over her top: always on the outside of clothing
    const over = dressed ? 0.017 : 0.005
    if (g && e.coralBeads) for (const [drop, k] of [[0.02, 1.06], [0.05, 1.1], [0.085, 1.14]] as const) beadsAlong(g, drape(neckCurve(nb.r * k, drop, 0.0), g, body, over + 0.002), coralBead, CORAL, 0.0084)
    if (g && e.chains) for (const [drop, k] of [[0.035, 1.08], [0.075, 1.12]] as const) beadsAlong(g, drape(neckCurve(nb.r * k, drop, 0.004), g, body, over), link, M, 0.0062, true)
  }

  // coral on the wrists
  if (e.coralWrists) {
    for (const s of ['Left', 'Right'] as const) {
      const hand = bonePos(`${s}Hand`)
      const fore = bonePos(`${s}ForeArm`)
      if (!hand || !fore) continue
      const axis = hand.clone().sub(fore).normalize()
      const R = (care.jewellery[`wrist${s[0]}`]?.r ?? 0.026) * 1.3
      for (let k = 0; k < 3; k++) {
        const g = mount(root, { bone: `${s}Hand`, p: hand.clone().addScaledVector(axis, -0.012 - k * 0.0085), z: axis }, parts)
        if (!g) continue
        const pts = Array.from({ length: 24 }, (_, i) => new Vector3(Math.cos((i / 24) * Math.PI * 2) * R, Math.sin((i / 24) * Math.PI * 2) * R, 0))
        beadsAlong(g, new CatmullRomCurve3(pts, true), coralBead, CORAL, 0.0084)
      }
    }
  }

  // anklets: just above the ankle bone
  if (e.anklets && body) {
    for (const s of ['Left', 'Right'] as const) {
      const foot = bonePos(`${s}Foot`)
      const g = onBone(root, `${s}Leg`, parts)
      if (!foot || !g) continue
      const sec = section(body, root, foot.clone().addScaledVector(upW, 0.035), 0.008, 0.07)
      if (sec) beadsAlong(g, loop(g, sec.c, sec.rx + 0.006, sec.rz + 0.006, root, 0.004), smallBead, CORAL, 0.0058)
    }
  }

  // waist beads: low on the hips, over whatever she wears there
  if (e.waistBeads && body) {
    const navel = landmarkWorld(lm, 'navel', new Vector3())
    const hips = bonePos('Hips')
    const g = onBone(root, 'Hips', parts)
    if (navel && hips && g) {
      const at = navel.clone().addScaledVector(upW, -0.035)
      const sec = section(body, root, at, 0.01, 0.3)
      if (sec) {
        const curve = loop(g, sec.c, sec.rx + 0.016, sec.rz + 0.016, root, 0.012)
        const col = new MeshStandardMaterial({ color: e.color, roughness: 0.35 })
        ownedMats.push(col)
        beadsAlong(g, curve, smallBead, col, 0.0058)
        beadsAlong(g, loop(g, sec.c.clone().addScaledVector(upW, -0.012), sec.rx + 0.017, sec.rz + 0.017, root, 0.014), smallBead, CORAL, 0.0058)
      }
    }
  }

  // rainbow pins on the left of the chest, over the top
  if (e.pins) {
    const chest = landmarkWorld(lm, 'tat:chestL', new Vector3())
    const n = care.tattoos?.chestL?.n
    if (chest && n) {
      const z = new Vector3(...n).applyQuaternion(root.getWorldQuaternion(new Quaternion())).normalize()
      const g = mount(root, { bone: 'Spine2', p: chest.addScaledVector(z, 0.016), z }, parts)
      const rainbow = ['#e40303', '#ff8c00', '#ffed00', '#008026', '#004dff', '#750787']
      for (const [x, y, r] of [[0, 0, 0.011], [0.02, -0.018, 0.0085], [-0.016, -0.024, 0.0075]] as const) {
        rainbow.forEach((c, i) => {
          const m = new MeshStandardMaterial({ color: c, roughness: 0.35 })
          ownedMats.push(m)
          // horizontal stripes of a round pin: thin slices of a disc
          const h = (2 * r) / rainbow.length
          const yy = r - h * (i + 0.5)
          const w = 2 * Math.sqrt(Math.max(0, r * r - yy * yy))
          add(g, own(new CylinderGeometry(0.5, 0.5, 1, 16)), m, [x, y + yy, 0.0015], [Math.PI / 2, 0, 0], [w, 0.002, h])
        })
        add(g, own(new TorusGeometry(r, 0.0009, 6, 24)), M, [x, y, 0.0016])
      }
    }
  }

  // glasses chain: from the ends of the arms, hanging behind the neck
  if (e.glassesChain && j.glasses !== 'none') {
    const eL = landmarkWorld(lm, 'earL', new Vector3())
    const eR = landmarkWorld(lm, 'earR', new Vector3())
    const g = onBone(root, 'Head', parts)
    if (eL && eR && g && nb && neck) {
      const back = neck.clone().addScaledVector(fwd, -nb.r * 2.05).addScaledVector(upW, -0.035)
      const inv = new Matrix4().copy(g.matrixWorld).invert()
      const a = eL.clone().addScaledVector(upW, 0.004).addScaledVector(fwd, 0.006)
      const b = eR.clone().addScaledVector(upW, 0.004).addScaledVector(fwd, 0.006)
      const mid = (p: Vector3, k: number) => p.clone().lerp(back, k).addScaledVector(upW, -0.02 * Math.sin(Math.PI * k))
      const curve = new CatmullRomCurve3([a, mid(a, 0.5), back, mid(b, 0.5), b].map((p) => p.applyMatrix4(inv)))
      beadsAlong(g, curve, own(new TorusGeometry(0.0016, 0.0005, 4, 8)), M, 0.0028, true)
    }
  }

  return {
    dispose: () => {
      for (const g of parts) g.parent?.remove(g)
      for (const g of owned) g.dispose()
      for (const m of ownedMats) m.dispose()
    },
  }
}

function side(root: Object3D) {
  return modelAxis(root, new Vector3(1, 0, 0))
}
