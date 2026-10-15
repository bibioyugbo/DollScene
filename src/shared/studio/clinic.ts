import { ALL_MORPHS, type ClinicId, type MorphId, type StudioLook } from './look'

/**
 * The beauty clinic: fictional avatar procedures. Each one is a set of real morph-target offsets
 * (at full intensity) layered on the locked base shape, or a skin/scalp effect in the shaders.
 * Nothing here is medical advice or a prediction of a real result.
 */
export interface Procedure {
  id: ClinicId
  name: string
  area: 'face' | 'body'
  blurb: string
  /** Morph offsets at intensity 1 (added to the 0..1 base). */
  morphs?: Partial<Record<MorphId, number>>
  /** What the shaders do with it, for procedures that aren't a shape change. */
  effect?: 'underEyeFill'
  /** Camera framing that shows the change best. */
  framing: 'face' | 'bust' | 'full'
}

/**
 * Every procedure is applied at full intensity (1) and is meant to be seen at a glance. A procedure
 * may push a shape past the everyday slider range (up to PROCEDURE_MAX: a morph weight of 2, i.e.
 * the BBL and breast augmentation roughly double the volume); garments carry the same morphs, so
 * they refit with the body.
 */
export const PROCEDURES: readonly Procedure[] = [
  { id: 'lipFiller', name: 'Lip filler', area: 'face', blurb: 'Visibly bigger, fuller lips with a defined cupid’s bow.', morphs: { Lips: 0.55, CupidsBow: 0.2, LipWidth: 0.08 }, framing: 'face' },
  { id: 'noseRefine', name: 'Nose refine', area: 'face', blurb: 'A sculpted nose: slimmer bridge, narrower nostrils and tip.', morphs: { NoseWidth: -0.45, NoseBridge: -0.42, NoseTipWidth: -0.4 }, framing: 'face' },
  { id: 'noseLift', name: 'Tip lift', area: 'face', blurb: 'A sharper, lifted nose tip.', morphs: { NoseTip: 0.45, NoseTipWidth: -0.5, NoseLength: -0.16 }, framing: 'face' },
  { id: 'cheekFiller', name: 'Cheek filler', area: 'face', blurb: 'Higher, fuller cheekbones.', morphs: { Cheekbones: 0.3, Cheeks: 0.16 }, framing: 'face' },
  { id: 'jawContour', name: 'Jawline contour', area: 'face', blurb: 'A crisper, more defined jaw.', morphs: { Jaw: 0.28, ChinWidth: -0.12, FaceFull: -0.1 }, framing: 'face' },
  { id: 'chinFiller', name: 'Chin filler', area: 'face', blurb: 'More chin projection for a balanced profile.', morphs: { Chin: 0.3 }, framing: 'face' },
  { id: 'underEye', name: 'Under-eye filler', area: 'face', blurb: 'Smooths hollows and shadows under the eyes.', effect: 'underEyeFill', framing: 'face' },
  { id: 'lipo', name: 'Lipo', area: 'body', blurb: 'A flat middle, slimmer waist, arms and thighs.', morphs: { Belly: -0.45, Waist: -0.3, Arms: -0.16, Thighs: -0.12, Softness: -0.12 }, framing: 'full' },
  { id: 'bbl', name: 'BBL', area: 'body', blurb: 'About twice the booty, with fuller hips.', morphs: { Glutes: 0.95, Hips: 0.3 }, framing: 'full' },
  { id: 'breastAug', name: 'Breast augmentation', area: 'body', blurb: 'About twice the bust.', morphs: { Bust: 0.85, BustLift: 0.2 }, framing: 'bust' },
  { id: 'ribRemoval', name: 'Rib removal', area: 'body', blurb: 'A much smaller, snatched waist.', morphs: { Waist: -0.6 }, framing: 'full' },
]

/** How far a procedure can push a morph (0.5 neutral .. 1 the slider's end .. 1.5 = weight 2). */
export const PROCEDURE_MAX = 1.5

export const procedure = (id: ClinicId) => PROCEDURES.find((p) => p.id === id)!

/** The morphs the character shows: the locked base plus every applied procedure (or a preview set). */
export function effectiveMorphs(look: Pick<StudioLook, 'morphs' | 'clinic'>, clinic = look.clinic): Record<MorphId, number> {
  const out = { ...look.morphs }
  for (const p of PROCEDURES) {
    const k = clinic[p.id] ?? 0
    if (!k || !p.morphs) continue
    for (const [m, dv] of Object.entries(p.morphs) as [MorphId, number][]) out[m] = out[m] + dv * k
  }
  for (const m of ALL_MORPHS) out[m] = Math.min(m in boosted(clinic) ? PROCEDURE_MAX : 1, Math.max(0, out[m]))
  return out
}

/** The morphs an applied procedure pushes up (those may go past the slider's end). */
function boosted(clinic: Partial<Record<ClinicId, number>>): Partial<Record<MorphId, true>> {
  const out: Partial<Record<MorphId, true>> = {}
  for (const p of PROCEDURES) if ((clinic[p.id] ?? 0) > 0) for (const [m, dv] of Object.entries(p.morphs ?? {}) as [MorphId, number][]) if (dv > 0) out[m] = true
  return out
}

/** Effect strength 0..1 of the shader-side procedures. */
export function clinicEffect(look: Pick<StudioLook, 'clinic'>, effect: NonNullable<Procedure['effect']>, clinic = look.clinic): number {
  let k = 0
  for (const p of PROCEDURES) if (p.effect === effect) k = Math.max(k, clinic[p.id] ?? 0)
  return k
}
