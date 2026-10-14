import {
  BoxGeometry,
  DoubleSide,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Matrix4,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Quaternion,
  SphereGeometry,
  TorusGeometry,
  Vector3,
  type BufferGeometry,
  type Material,
} from 'three'
import { effectorPoint, type HandRig } from './rig'

/**
 * Props the hands hold during routines: low-poly, built once per hand, positioned every frame
 * from the hand bones. Prop space: +Y is the working end (brush tip, bottle spout), origin at
 * the grip. `load` shows product on the prop (liquid on a pad, cream on a fingertip).
 */

export type PropId =
  | 'pad'
  | 'toner'
  | 'cleanser'
  | 'dropper'
  | 'serum'
  | 'tube'
  | 'jar'
  | 'sunscreen'
  | 'balm'
  | 'brush'
  | 'sponge'
  | 'puff'
  | 'kabuki'
  | 'fanBrush'
  | 'pencil'
  | 'mascara'
  | 'lipstick'
  | 'gloss'
  | 'spray'
  | 'comb'
  | 'hairbrush'
  | 'nailbrush'
  | 'file'
  | 'towel'
  | 'gel'
  | 'bottlePolish'
  | 'cushion'
  | 'dollop'
  | 'tweezers'
  | 'phone'
  // carried accessories (look.extras.held), in the left hand
  | 'whip'
  | 'joint'
  | 'clutch'
  | 'fan'
  | 'matcha'

export type Hold = 'pinch' | 'grip' | 'palm' | 'fingers' | 'cup' | 'flatPhone'

export interface PropState {
  id: PropId
  hold: Hold
  /** Product on the prop 0..1. */
  load?: number
  /** Product colour (polish, lipstick, toner...). */
  color?: string
  /** What a cotton pad has lifted off the skin 0..1 (grey-brown residue: makeup, sunscreen, grime). */
  dirt?: number
}

const std = (color: string, rough = 0.5, metal = 0) => new MeshStandardMaterial({ color, roughness: rough, metalness: metal })
const glass = (color: string, opacity = 0.55) => new MeshPhysicalMaterial({ color, roughness: 0.08, transmission: 0, transparent: true, opacity, depthWrite: false })

const MAT = {
  white: std('#f6f4f0', 0.85),
  cotton: std('#fbfaf7', 0.95),
  black: std('#161214', 0.35),
  gold: std('#d4a64a', 0.25, 1),
  silver: std('#d9dade', 0.25, 1),
  pink: std('#f2a7bf', 0.5),
  blush: std('#e88f9a', 0.6),
  peach: std('#f4c3a1', 0.6),
  wood: std('#b88a5a', 0.6),
  bristle: std('#2a1e1a', 0.9),
  cream: std('#f7f3ec', 0.4),
  rubber: std('#2b2b2e', 0.6),
  sponge: std('#f07aa0', 0.85),
  amber: glass('#c27a2a', 0.7),
  frosted: glass('#e8eef2', 0.6),
  mint: std('#9fd8c4', 0.4),
  sun: std('#ffb347', 0.4),
  lilac: std('#c9b4e6', 0.45),
  towel: std('#e9ddd2', 1),
}

function mesh(g: BufferGeometry, m: Material, pos: [number, number, number] = [0, 0, 0], rot?: [number, number, number], scale?: [number, number, number]) {
  const x = new Mesh(g, m)
  x.position.set(...pos)
  if (rot) x.rotation.set(...rot)
  if (scale) x.scale.set(...scale)
  x.frustumCulled = false
  return x
}

const cyl = (r: number, h: number, seg = 14) => new CylinderGeometry(r, r, h, seg)

/** Builds a prop. `tint` meshes recolour from PropState.color; `load` meshes scale with product. */
type Anim = (t: number, upLocal: Vector3) => void

function build(id: PropId): { g: Group; tint: Mesh[]; load: Mesh[]; tip: number; dirt?: Mesh; anim?: Anim } {
  const g = new Group()
  const tint: Mesh[] = []
  const load: Mesh[] = []
  let dirt: Mesh | undefined
  let anim: Anim | undefined
  let tip = 0.02
  const add = (m: Mesh) => (g.add(m), m)
  switch (id) {
    case 'whip': {
      // an Igbo horsehair fly whisk: a beaded leather handle and a long white tail that hangs down
      add(mesh(cyl(0.0085, 0.2, 12), std('#3a2216', 0.55), [0, 0.02, 0]))
      for (let i = 0; i < 6; i++) add(mesh(new TorusGeometry(0.0095, 0.0022, 6, 14), std(i % 2 ? '#c9a04a' : '#d9452b', 0.35, i % 2 ? 0.9 : 0), [0, 0.085 - i * 0.012, 0], [Math.PI / 2, 0, 0]))
      add(mesh(new SphereGeometry(0.012, 12, 10), std('#c9a04a', 0.3, 0.9), [0, -0.085, 0]))
      const tassel = new Group()
      tassel.position.set(0, -0.09, 0)
      const hair = std('#f4f1ea', 0.75)
      for (let i = 0; i < 40; i++) {
        const a = (i / 40) * Math.PI * 2 * 3.7
        const r = 0.002 + ((i * 37) % 11) * 0.0011
        const len = 0.3 + ((i * 53) % 9) * 0.012
        const strand = mesh(new CylinderGeometry(0.0016, 0.0006, len, 4), hair, [Math.cos(a) * r, -len / 2, Math.sin(a) * r], [Math.sin(a) * 0.06, 0, Math.cos(a) * 0.06])
        tassel.add(strand)
      }
      g.add(tassel)
      const q = new Quaternion()
      anim = (t, upLocal) => {
        // the tail hangs toward the floor whatever the hand does, swaying a little
        q.setFromUnitVectors(new Vector3(0, 1, 0), upLocal)
        tassel.quaternion.copy(q)
        tassel.rotateX(Math.sin(t * 1.3) * 0.06)
        tassel.rotateZ(Math.sin(t * 0.9 + 1) * 0.05)
      }
      tip = 0.12
      break
    }
    case 'joint': {
      // a fat hand-rolled joint (a cone, not a cigarette): a rolled card crutch at the mouth end,
      // the paper widening to a thick, slightly twisted lit end with a charred ring, ember and ash
      const paper = std('#f1ebdd', 0.85)
      add(mesh(new CylinderGeometry(0.0068, 0.0042, 0.09, 14), paper, [0, 0.045, 0]))
      // the paper's rolled seam, a slightly darker line along the cone
      add(mesh(new BoxGeometry(0.0012, 0.088, 0.0006), std('#ddd2bb', 0.9), [0, 0.045, 0.0056], [0.028, 0, 0]))
      add(mesh(cyl(0.0042, 0.016, 12), std('#c8b48c', 0.8), [0, -0.006, 0]))
      add(mesh(new CylinderGeometry(0.0069, 0.0069, 0.005, 14), std('#2a2420', 0.9), [0, 0.0915, 0]))
      const ember = add(mesh(new SphereGeometry(0.0066, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), new MeshStandardMaterial({ color: '#ff5a1a', emissive: '#ff4a10', emissiveIntensity: 2.2, roughness: 0.6 }), [0, 0.094, 0]))
      const ash = std('#9a948c', 1)
      add(mesh(new CylinderGeometry(0.006, 0.0066, 0.004, 14), ash, [0, 0.0965, 0]))
      const puffs: Mesh[] = []
      const smoke = new Group()
      smoke.position.set(0, 0.098, 0)
      for (let i = 0; i < 9; i++) {
        const m = mesh(new SphereGeometry(0.006, 8, 6), new MeshStandardMaterial({ color: '#d8d8dc', transparent: true, opacity: 0.0, depthWrite: false, roughness: 1 }))
        puffs.push(m)
        smoke.add(m)
      }
      g.add(smoke)
      anim = (t, upLocal) => {
        ;(ember.material as MeshStandardMaterial).emissiveIntensity = 1.8 + Math.sin(t * 5.3) * 0.5 + Math.sin(t * 13.1) * 0.25
        puffs.forEach((m, i) => {
          const k = (t * 0.32 + i / puffs.length) % 1
          const drift = Math.sin(t * 1.7 + i * 2.1) * 0.012 * k
          m.position.copy(upLocal).multiplyScalar(k * 0.2)
          m.position.x += drift
          m.position.z += Math.cos(t * 1.3 + i) * 0.008 * k
          m.scale.setScalar(0.35 + k * 2.4)
          ;(m.material as MeshStandardMaterial).opacity = 0.2 * Math.sin(Math.PI * Math.min(1, k * 1.15)) * (1 - k * 0.5)
        })
      }
      tip = 0.095
      break
    }
    case 'matcha': {
      // an iced matcha latte in a clear 16 oz cup: milk at the bottom, the matcha poured on top
      // (a soft blended band between), ice, and a green straw. It always stands upright.
      const cup = new Group()
      const H = 0.13
      const rB = 0.031
      const rT = 0.041
      const rAt = (y: number) => rB + ((y + H / 2) / H) * (rT - rB)
      const layer = (y0: number, y1: number, color: string, inset = 0.0018) => {
        const m = mesh(new CylinderGeometry(rAt(y1) - inset, rAt(y0) - inset, y1 - y0, 28), std(color, 0.35), [0, (y0 + y1) / 2, 0])
        cup.add(m)
        return m
      }
      layer(-H / 2 + 0.002, -0.012, '#efeadc')
      layer(-0.012, -0.002, '#b9cf8e')
      layer(-0.002, 0.036, '#6f9e3c')
      const ice = new MeshPhysicalMaterial({ color: '#f4fbf6', roughness: 0.12, transparent: true, opacity: 0.55, depthWrite: false })
      for (const [x, y, z, a] of [
        [0.012, 0.038, 0.008, 0.4],
        [-0.014, 0.036, 0.006, 1.1],
        [0.002, 0.04, -0.015, 0.7],
        [-0.006, 0.026, 0.016, 1.9],
        [0.016, 0.024, -0.01, 2.4],
      ])
        cup.add(mesh(new BoxGeometry(0.017, 0.016, 0.017), ice, [x, y, z], [a, a * 0.7, a * 0.4]))
      // the clear plastic cup, its rolled rim and a faint base
      const plastic = new MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.04, transparent: true, opacity: 0.22, depthWrite: false, side: DoubleSide })
      const shell = mesh(new CylinderGeometry(rT, rB, H, 32, 1, true), plastic)
      shell.renderOrder = 2
      cup.add(shell)
      cup.add(mesh(new TorusGeometry(rT, 0.0016, 6, 32), new MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.1, transparent: true, opacity: 0.5 }), [0, H / 2, 0], [Math.PI / 2, 0, 0]))
      cup.add(mesh(cyl(rB, 0.002, 28), plastic, [0, -H / 2, 0]))
      // a wide green straw, tilted, standing well above the rim
      cup.add(mesh(cyl(0.0042, 0.21, 10), std('#2f8a52', 0.45), [0.008, 0.035, 0.004], [0.08, 0, -0.16]))
      g.add(cup)
      const q = new Quaternion()
      anim = (_t, upLocal) => {
        // a drink never tips: the cup stands upright whatever the hand's angle
        q.setFromUnitVectors(new Vector3(0, 1, 0), upLocal)
        cup.quaternion.copy(q)
      }
      tip = 0.07
      break
    }
    case 'clutch': {
      tint.push(add(mesh(new BoxGeometry(0.17, 0.09, 0.03), std('#e4572e', 0.35), [0, 0, 0.0], [0, 0, Math.PI / 2])))
      add(mesh(new BoxGeometry(0.004, 0.17, 0.032), MAT.gold, [0, 0, 0.002]))
      tip = 0.05
      break
    }
    case 'fan': {
      // a folding hand fan, open
      const fan = new Group()
      for (let i = 0; i < 13; i++) {
        const a = -0.95 + (i / 12) * 1.9
        const blade = mesh(new BoxGeometry(0.026, 0.16, 0.0015), std(i % 2 ? '#e4572e' : '#c9a04a', 0.5), [Math.sin(a) * 0.08, Math.cos(a) * 0.08, i * 0.0004], [0, 0, -a])
        tint.push(blade)
        fan.add(blade)
      }
      g.add(fan)
      tip = 0.16
      break
    }
    case 'phone': {
      // a phone held up for a selfie: screen toward her, a soft glow on it
      add(mesh(new BoxGeometry(0.072, 0.15, 0.008), MAT.black, [0, 0.03, 0]))
      add(mesh(new BoxGeometry(0.066, 0.142, 0.001), new MeshStandardMaterial({ color: '#9fd0ff', emissive: '#6aa8ff', emissiveIntensity: 0.6, roughness: 0.2 }), [0, 0.03, -0.0046]))
      tip = 0.03
      break
    }
    case 'pad': {
      add(mesh(cyl(0.028, 0.004, 20), MAT.cotton, [0, 0, 0], [Math.PI / 2, 0, 0]))
      load.push(add(mesh(cyl(0.022, 0.0042, 20), glass('#bcd8ff', 0.5), [0, 0, 0.0002], [Math.PI / 2, 0, 0])))
      // residue lifted off the face, on the side that touched the skin: an irregular grey-brown smear
      const smear = new MeshStandardMaterial({ color: '#8a7462', roughness: 0.95, transparent: true, opacity: 0, depthWrite: false })
      dirt = add(mesh(cyl(0.019, 0.0044, 9), smear, [0.002, 0, -0.0003], [Math.PI / 2, 0.4, 0], [1, 1, 0.75]))
      tip = 0.01
      break
    }
    case 'toner':
    case 'cleanser':
    case 'sunscreen': {
      const body = id === 'toner' ? glass('#f7c6d6', 0.75) : id === 'sunscreen' ? MAT.sun : MAT.mint
      add(mesh(cyl(0.019, 0.1), body, [0, -0.02, 0]))
      add(mesh(cyl(0.008, 0.016), MAT.white, [0, 0.038, 0]))
      if (id === 'cleanser') add(mesh(new BoxGeometry(0.006, 0.006, 0.026), MAT.white, [0, 0.048, 0.01]))
      tip = 0.05
      break
    }
    case 'dropper':
    case 'serum': {
      add(mesh(cyl(0.0035, 0.06, 8), MAT.frosted, [0, 0.01, 0]))
      add(mesh(new SphereGeometry(0.007, 10, 8), MAT.rubber, [0, -0.025, 0], undefined, [1, 1.5, 1]))
      if (id === 'serum') add(mesh(cyl(0.013, 0.045), MAT.amber, [0, -0.06, 0]))
      load.push(add(mesh(new SphereGeometry(0.0025, 8, 6), glass('#f2dca0', 0.8), [0, 0.042, 0])))
      tip = 0.042
      break
    }
    case 'tube':
    case 'gel': {
      add(mesh(new BoxGeometry(0.032, 0.11, 0.012), id === 'gel' ? MAT.lilac : MAT.peach, [0, -0.02, 0]))
      add(mesh(cyl(0.008, 0.014), MAT.white, [0, 0.042, 0]))
      tip = 0.05
      break
    }
    case 'jar': {
      add(mesh(cyl(0.03, 0.034, 20), MAT.frosted, [0, 0, 0], [Math.PI / 2, 0, 0]))
      load.push(add(mesh(cyl(0.027, 0.002, 20), MAT.cream, [0, 0, 0.017], [Math.PI / 2, 0, 0])))
      tip = 0
      break
    }
    case 'balm':
    case 'lipstick': {
      add(mesh(cyl(0.008, 0.05), id === 'balm' ? MAT.mint : MAT.gold, [0, -0.01, 0]))
      tint.push(add(mesh(new CylinderGeometry(0.0055, 0.0065, 0.016, 12), std('#a8323c', 0.35), [0, 0.022, 0], [0.35, 0, 0])))
      tip = 0.032
      break
    }
    case 'brush':
    case 'kabuki':
    case 'fanBrush':
    case 'pencil':
    case 'mascara':
    case 'gloss':
    case 'nailbrush': {
      const long = id === 'kabuki' ? 0.04 : id === 'nailbrush' ? 0.03 : 0.12
      add(mesh(cyl(id === 'pencil' ? 0.0035 : 0.0045, long, 10), id === 'pencil' ? MAT.wood : MAT.black, [0, -long / 2 + 0.01, 0]))
      add(mesh(cyl(0.005, 0.016, 10), MAT.silver, [0, 0.016, 0]))
      if (id === 'brush') tint.push(add(mesh(new ConeGeometry(0.007, 0.022, 10), MAT.bristle, [0, 0.034, 0], [Math.PI, 0, 0])))
      if (id === 'kabuki') tint.push(add(mesh(new SphereGeometry(0.013, 12, 10), MAT.bristle, [0, 0.03, 0], undefined, [1, 1.1, 1])))
      if (id === 'fanBrush') tint.push(add(mesh(new CylinderGeometry(0.016, 0.003, 0.022, 12, 1, false, -0.9, 1.8), MAT.bristle, [0, 0.034, 0], undefined, [1, 1, 0.15])))
      if (id === 'pencil') tint.push(add(mesh(new ConeGeometry(0.0035, 0.012, 8), std('#2a1a12', 0.6), [0, 0.03, 0])))
      if (id === 'mascara') tint.push(add(mesh(cyl(0.0035, 0.02, 8), MAT.bristle, [0, 0.034, 0])))
      if (id === 'gloss') tint.push(add(mesh(new SphereGeometry(0.004, 8, 6), std('#d07a8a', 0.2), [0, 0.032, 0], undefined, [0.6, 1.4, 1])))
      if (id === 'nailbrush') tint.push(add(mesh(new ConeGeometry(0.0022, 0.01, 8), std('#a8323c', 0.2), [0, 0.03, 0], [Math.PI, 0, 0])))
      tip = id === 'kabuki' ? 0.042 : 0.042
      break
    }
    case 'sponge':
      add(mesh(new SphereGeometry(0.02, 14, 10), MAT.sponge, [0, 0.012, 0], undefined, [1, 1.35, 1]))
      tip = 0.038
      break
    case 'puff':
      add(mesh(cyl(0.032, 0.012, 20), MAT.blush, [0, 0, 0], [Math.PI / 2, 0, 0]))
      add(mesh(new TorusGeometry(0.012, 0.002, 6, 16), MAT.white, [0, 0, -0.008]))
      tip = 0.006
      break
    case 'cushion':
      add(mesh(cyl(0.035, 0.012, 24), MAT.gold, [0, 0, 0], [Math.PI / 2, 0, 0]))
      tint.push(add(mesh(cyl(0.03, 0.002, 24), MAT.peach, [0, 0, 0.007], [Math.PI / 2, 0, 0])))
      tip = 0
      break
    case 'spray':
      add(mesh(cyl(0.016, 0.09), glass('#d8e8f6', 0.7), [0, -0.02, 0]))
      add(mesh(cyl(0.007, 0.014), MAT.white, [0, 0.032, 0]))
      tip = 0.04
      break
    case 'comb': {
      add(mesh(new BoxGeometry(0.16, 0.012, 0.004), MAT.black, [0, 0, 0]))
      for (let i = 0; i < 22; i++) add(mesh(new BoxGeometry(0.0022, 0.022, 0.003), MAT.black, [-0.075 + i * 0.0068, 0.016, 0]))
      tip = 0.03
      break
    }
    case 'hairbrush': {
      add(mesh(cyl(0.008, 0.12), MAT.black, [0, -0.05, 0]))
      add(mesh(new BoxGeometry(0.06, 0.09, 0.012), MAT.black, [0, 0.05, 0]))
      add(mesh(new BoxGeometry(0.05, 0.08, 0.012), MAT.bristle, [0, 0.05, 0.01], undefined, [1, 1, 0.8]))
      tip = 0.05
      break
    }
    case 'file':
      add(mesh(new BoxGeometry(0.018, 0.12, 0.003), MAT.pink, [0, 0.02, 0]))
      tip = 0.06
      break
    case 'towel':
      add(mesh(new BoxGeometry(0.14, 0.09, 0.03), MAT.towel, [0, 0.02, 0]))
      tip = 0.04
      break
    case 'bottlePolish': {
      tint.push(add(mesh(new BoxGeometry(0.026, 0.03, 0.026), glass('#a8323c', 0.9), [0, -0.01, 0])))
      add(mesh(cyl(0.007, 0.034), MAT.black, [0, 0.02, 0]))
      tip = 0.036
      break
    }
    case 'dollop':
      load.push(add(mesh(new SphereGeometry(0.0055, 10, 8), MAT.cream, [0, 0, 0], undefined, [1, 0.6, 1])))
      tip = 0
      break
    case 'tweezers':
      add(mesh(new BoxGeometry(0.004, 0.09, 0.0015), MAT.silver, [0.002, 0.02, 0], [0, 0, -0.03]))
      add(mesh(new BoxGeometry(0.004, 0.09, 0.0015), MAT.silver, [-0.002, 0.02, 0], [0, 0, 0.03]))
      tip = 0.064
      break
  }
  return { g, tint, load, tip, dirt, anim }
}

export interface PropSlot {
  group: Group
  current: { id: PropId; parts: ReturnType<typeof build> } | null
}

export function propSlot(): PropSlot {
  const group = new Group()
  group.matrixAutoUpdate = false
  return { group, current: null }
}

const handQ = new Quaternion()
const tmp = new Vector3()
const m4 = new Matrix4()
const x = new Vector3()
const yv = new Vector3()
const zv = new Vector3()
const c = new Color()

/** Hand-local frame of a hold: [origin, +Y axis, +Z axis]. */
function holdFrame(h: HandRig, hold: Hold): [Vector3, Vector3, Vector3] {
  const f = h.fingerDir
  const p = h.palm
  if (hold === 'grip') return [p.clone().multiplyScalar(0.035).addScaledVector(f, 0.045), new Vector3().crossVectors(f, p).normalize().multiplyScalar(h.side === 'Left' ? -1 : 1), p.clone()]
  if (hold === 'palm') return [p.clone().multiplyScalar(0.022).addScaledVector(f, 0.05), f.clone(), p.clone()]
  // a cup in a wide wrap: its centre a cup's radius off the palm, its axis through the curled fist
  if (hold === 'cup') return [p.clone().multiplyScalar(0.05).addScaledVector(f, 0.04), new Vector3().crossVectors(f, p).normalize().multiplyScalar(h.side === 'Left' ? -1 : 1), p.clone()]
  // a phone lying on the open palm, its length along the fingers, screen up (away from the palm)
  if (hold === 'flatPhone') return [p.clone().multiplyScalar(0.02).addScaledVector(f, 0.035), f.clone(), p.clone().negate()]
  // between the first two fingers, pointing forward out of the hand (a cigarette, a joint)
  if (hold === 'fingers') return [p.clone().multiplyScalar(0.012).addScaledVector(f, 0.072), new Vector3().crossVectors(f, p).normalize().multiplyScalar(h.side === 'Left' ? 1 : -1).addScaledVector(f, 0.35).normalize(), p.clone()]
  return [new Vector3(), f.clone(), p.clone().negate()]
}

/** Offset (hand-local) from the hand's pinch point to the prop's working tip, for the IK. */
export function propTipLocal(h: HandRig, prop: PropState | null): Vector3 | undefined {
  if (!prop || prop.hold !== 'pinch') return undefined
  const tip = TIPS.get(prop.id) ?? build(prop.id).tip
  TIPS.set(prop.id, tip)
  return h.fingerDir.clone().multiplyScalar(tip)
}
const TIPS = new Map<PropId, number>()

/** Show `prop` in this hand (or nothing) and place it for this frame. `parentInv` = inverse world matrix of the slot's parent. */
const upW = new Vector3()
const invQ = new Quaternion()

export function updateProp(slot: PropSlot, h: HandRig, prop: PropState | null, parentInv: Matrix4, t = 0) {
  if (!prop) {
    slot.group.visible = false
    return
  }
  if (!slot.current || slot.current.id !== prop.id) {
    if (slot.current) slot.group.remove(slot.current.parts.g)
    const parts = build(prop.id)
    slot.group.add(parts.g)
    slot.current = { id: prop.id, parts }
  }
  const parts = slot.current.parts
  if (prop.color) for (const t of parts.tint) ((t.material as MeshStandardMaterial).color as Color).copy(c.set(prop.color))
  for (const l of parts.load) {
    const k = prop.load ?? 0
    l.visible = k > 0.02
    l.scale.setScalar(0.4 + 0.6 * k)
  }
  if (parts.dirt) {
    const k = prop.dirt ?? 0
    parts.dirt.visible = k > 0.02
    ;(parts.dirt.material as MeshStandardMaterial).opacity = Math.min(0.85, k)
  }
  slot.group.visible = true
  // world frame
  h.hand.updateWorldMatrix(true, false)
  h.hand.getWorldQuaternion(handQ)
  const [o, ay, az] = holdFrame(h, prop.hold)
  const origin = prop.hold === 'pinch' ? effectorPoint(h, 'pinch', tmp) : tmp.copy(o).applyMatrix4(h.hand.matrixWorld)
  if (prop.id === 'dollop') effectorPoint(h, 'index', origin)
  yv.copy(ay).applyQuaternion(handQ).normalize()
  zv.copy(az).applyQuaternion(handQ)
  zv.sub(x.copy(yv).multiplyScalar(zv.dot(yv))).normalize()
  x.crossVectors(yv, zv).normalize()
  m4.makeBasis(x, yv, zv).setPosition(origin)
  slot.group.matrix.multiplyMatrices(parentInv, m4)
  slot.group.matrixWorldNeedsUpdate = true
  if (parts.anim) {
    // world up in the prop's own frame (smoke rises, a whisk's tail hangs)
    invQ.setFromRotationMatrix(m4).invert()
    parts.anim(t, upW.set(0, 1, 0).applyQuaternion(invQ))
  }
}
