import { ALL_MORPHS, type ClinicId, type MorphId, type StudioLook } from './look'

/**
 * The beauty clinic: fictional avatar procedures. Each one is a set of real morph-target offsets
 * (at full intensity) layered on the locked base shape, or a skin/scalp effect in the shaders.
 * Nothing here is medical advice or a prediction of a real result.
 */
export interface Procedure {
  id: ClinicId
  name: string
  area: 'face' | 'hair' | 'body'
  blurb: string
  /** Morph offsets at intensity 1 (added to the 0..1 base, then clamped). */
  morphs?: Partial<Record<MorphId, number>>
  /** What the shaders do with it, for procedures that aren't a shape change. */
  effect?: 'underEyeFill' | 'hairline' | 'density'
  /** Camera framing that shows the change best. */
  framing: 'face' | 'bust' | 'full'
}

export const PROCEDURES: readonly Procedure[] = [
  { id: 'lipFiller', name: 'Lip filler', area: 'face', blurb: 'Fuller lips with a defined cupid’s bow.', morphs: { Lips: 0.32, CupidsBow: 0.14, LipWidth: 0.04 }, framing: 'face' },
  { id: 'noseRefine', name: 'Nose refine', area: 'face', blurb: 'A narrower bridge and softer nostrils.', morphs: { NoseWidth: -0.3, NoseBridge: -0.24 }, framing: 'face' },
  { id: 'noseLift', name: 'Tip lift', area: 'face', blurb: 'A slightly shorter nose with a lifted tip.', morphs: { NoseTip: 0.3, NoseLength: -0.14 }, framing: 'face' },
  { id: 'cheekFiller', name: 'Cheek filler', area: 'face', blurb: 'Higher, fuller cheekbones.', morphs: { Cheekbones: 0.3, Cheeks: 0.16 }, framing: 'face' },
  { id: 'jawContour', name: 'Jawline contour', area: 'face', blurb: 'A crisper, more defined jaw.', morphs: { Jaw: 0.28, ChinWidth: -0.12, FaceFull: -0.1 }, framing: 'face' },
  { id: 'chinFiller', name: 'Chin filler', area: 'face', blurb: 'More chin projection for a balanced profile.', morphs: { Chin: 0.3 }, framing: 'face' },
  { id: 'underEye', name: 'Under-eye filler', area: 'face', blurb: 'Smooths hollows and shadows under the eyes.', effect: 'underEyeFill', framing: 'face' },
  { id: 'hairline', name: 'Hairline design', area: 'hair', blurb: 'A lower, fuller front hairline.', morphs: { Forehead: -0.18 }, effect: 'hairline', framing: 'face' },
  { id: 'transplant', name: 'Hair density', area: 'hair', blurb: 'Thicker hair across the scalp and edges.', effect: 'density', framing: 'bust' },
  { id: 'bbl', name: 'BBL-style curves', area: 'body', blurb: 'Fuller hips and glutes with a snatched waist.', morphs: { Glutes: 0.4, Hips: 0.26, Waist: -0.12 }, framing: 'full' },
  { id: 'lipo', name: 'Lipo-style contour', area: 'body', blurb: 'A flatter middle and slimmer waist.', morphs: { Belly: -0.36, Waist: -0.24, Arms: -0.1 }, framing: 'full' },
]

export const procedure = (id: ClinicId) => PROCEDURES.find((p) => p.id === id)!

/** The morphs the character shows: the locked base plus every applied procedure (or a preview set). */
export function effectiveMorphs(look: Pick<StudioLook, 'morphs' | 'clinic'>, clinic = look.clinic): Record<MorphId, number> {
  const out = { ...look.morphs }
  for (const p of PROCEDURES) {
    const k = clinic[p.id] ?? 0
    if (!k || !p.morphs) continue
    for (const [m, dv] of Object.entries(p.morphs) as [MorphId, number][]) out[m] = out[m] + dv * k
  }
  for (const m of ALL_MORPHS) out[m] = Math.min(1, Math.max(0, out[m]))
  return out
}

/** Effect strength 0..1 of the shader-side procedures. */
export function clinicEffect(look: Pick<StudioLook, 'clinic'>, effect: NonNullable<Procedure['effect']>, clinic = look.clinic): number {
  let k = 0
  for (const p of PROCEDURES) if (p.effect === effect) k = Math.max(k, clinic[p.id] ?? 0)
  return k
}
