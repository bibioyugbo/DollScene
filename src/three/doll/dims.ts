import type { Appearance, Base, PiercingSite } from '../../shared/types'

const BASE_SHAPE: Record<Base, { shoulders: number; hips: number; bust: number }> = {
  feminine: { shoulders: 1, hips: 1, bust: 1 },
  androgynous: { shoulders: 1.08, hips: 0.92, bust: 0.45 },
  masculine: { shoulders: 1.2, hips: 0.85, bust: 0 },
}

export const HEAD_R = 0.15

/** Every placeholder body measurement, derived from the body sliders. */
export function bodyDims(a: Appearance) {
  const b = a.body
  const shape = BASE_SHAPE[a.base]
  const legLen = 0.58 * (0.92 + b.legs * 0.16)
  const dy = legLen - 0.58
  const hipsX = (0.9 + b.hips * 0.4) * shape.hips
  const waistX = 0.72 + b.waist * 0.45 + b.softness * 0.05
  const chestX = shape.shoulders * (0.92 + b.shoulders * 0.18)
  const bust = (0.035 + b.bust * 0.03) * shape.bust
  const shoulderX = 0.19 * chestX
  const legX = 0.07 * Math.max(0.9, hipsX)
  const limb = 1 + b.muscle * 0.18 + b.softness * 0.06
  return {
    legLen,
    dy,
    legY: 0.42 + dy / 2,
    hipY: 0.8 + dy,
    waistY: 0.96 + dy,
    chestY: 1.13 + dy,
    neckY: 1.29 + dy,
    headY: 1.44 + dy,
    shoulderY: 1.18 + dy,
    hipsX,
    waistX,
    chestX,
    bust,
    shoulderX,
    legX,
    armR: 0.045 * limb,
    legR: 0.064 * limb,
  }
}

export type Dims = ReturnType<typeof bodyDims>

type V3 = [number, number, number]

/** Ear socket offsets from the ear centre (x mirrored per side). */
const EAR: Partial<Record<PiercingSite, V3>> = {
  lobe: [0.004, -0.042, 0.008],
  'lobe-2': [0.004, -0.036, -0.004],
  'lobe-3': [0.004, -0.03, -0.014],
  'upper-lobe': [0.006, -0.024, 0.014],
  helix: [0.006, 0.045, -0.014],
  'forward-helix': [0.002, 0.036, 0.022],
  tragus: [-0.002, -0.002, 0.03],
  'anti-tragus': [0.006, -0.018, 0.018],
  'conch-inner': [0.012, 0.0, 0.004],
  'conch-outer': [0.012, 0.016, -0.016],
  daith: [0.008, 0.012, 0.02],
  rook: [0.01, 0.026, 0.01],
  industrial: [0.006, 0.042, 0.004],
  flat: [0.012, 0.03, -0.006],
  orbital: [0.006, -0.004, -0.026],
}
export const EAR_CENTER: V3 = [HEAD_R + 0.004, -0.01, -0.01]

/** Face sockets in head space (x is the doll's left when positive). */
const FACE: Partial<Record<PiercingSite, V3>> = {
  nostril: [0.017, -0.03, 0.142],
  'high-nostril': [0.015, -0.017, 0.146],
  septum: [0, -0.04, 0.142],
  bridge: [0, 0.006, 0.148],
  eyebrow: [0.08, 0.04, 0.127],
  labret: [0, -0.096, 0.13],
  monroe: [0.026, -0.058, 0.14],
  medusa: [0, -0.057, 0.143],
  'snake-bites': [0.022, -0.088, 0.133],
  smiley: [0, -0.066, 0.146],
  tongue: [0, -0.078, 0.147],
}

export const EAR_SITES = Object.keys(EAR) as PiercingSite[]
export const FACE_SITES = Object.keys(FACE) as PiercingSite[]
export const BODY_SITES: PiercingSite[] = ['navel', 'dermal', 'surface']

export function isEarSite(s: PiercingSite) {
  return s in EAR
}

/** Head-space position for a head piercing on one side (+1 left, -1 right). */
export function headSocket(site: PiercingSite, side: 1 | -1): V3 | null {
  const e = EAR[site]
  if (e) return [side * (EAR_CENTER[0] + e[0]), EAR_CENTER[1] + e[1], EAR_CENTER[2] + e[2]]
  const f = FACE[site]
  if (f) return [side * f[0], f[1], f[2]]
  return null
}

/** Sides a piercing occupies. */
export function sidesFor(site: PiercingSite, side: 'left' | 'right' | 'both' | 'center'): (1 | -1)[] {
  const centered = ['septum', 'bridge', 'labret', 'medusa', 'smiley', 'tongue', 'navel', 'surface'].includes(site)
  if (centered) return [1]
  if (site === 'snake-bites') return [1, -1]
  if (side === 'both') return [1, -1]
  return side === 'right' ? [-1] : [1]
}
