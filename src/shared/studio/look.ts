/**
 * The Lagos Life studio look: everything a player can change on the 3D character.
 * Pure data, shared by the browser and the server (which re-validates every save).
 * Asset ids match public/models/studio/character.json (built by scripts/character).
 */

export const FACE_MORPHS = [
  'NoseWidth',
  'NoseBridge',
  'NoseTip',
  'NoseLength',
  'Lips',
  'LipWidth',
  'CupidsBow',
  'Jaw',
  'Chin',
  'ChinWidth',
  'Cheekbones',
  'Cheeks',
  'Forehead',
  'EyeSize',
  'EyeSpacing',
  'EyeOpen',
  'Brows',
  'BrowAngle',
  'FaceFull',
  'FaceLength',
] as const
export const BODY_MORPHS = ['Shoulders', 'Bust', 'BustLift', 'Waist', 'Belly', 'Hips', 'Glutes', 'Thighs', 'Arms', 'Softness', 'Muscle'] as const
export type FaceMorph = (typeof FACE_MORPHS)[number]
export type BodyMorph = (typeof BODY_MORPHS)[number]
export type MorphId = FaceMorph | BodyMorph
export const ALL_MORPHS: readonly MorphId[] = [...FACE_MORPHS, ...BODY_MORPHS]

export const EYE_IDS = ['brown', 'brownlight', 'green', 'grey', 'bluegreen'] as const
export const BROW_IDS = ['eyebrow001', 'eyebrow006', 'eyebrow010'] as const
export const LASH_IDS = ['eyelashes01', 'eyelashes02', 'eyelashes03'] as const
export const HAIR_IDS = ['afro01', 'short02', 'bob02', 'long01', 'ponytail01', 'braid01'] as const
export const OUTFIT_IDS = ['female_sportsuit01', 'female_casualsuit01', 'female_casualsuit02', 'female_elegantsuit01'] as const
export const SHOE_IDS = ['shoes01', 'shoes03', 'shoes06'] as const
export const UNDERTONES = ['cool', 'neutral', 'warm', 'olive'] as const

export type EyeId = (typeof EYE_IDS)[number]
export type BrowId = (typeof BROW_IDS)[number]
export type LashId = (typeof LASH_IDS)[number]
/** "none" shows the scalp, with optional painted close-cropped hair. */
export type HairId = (typeof HAIR_IDS)[number] | 'none'
export type OutfitId = (typeof OUTFIT_IDS)[number]
export type ShoeId = (typeof SHOE_IDS)[number]
export type Undertone = (typeof UNDERTONES)[number]

/** A colour layer: hex colour + strength 0..1. */
export interface Layer {
  color: string
  amount: number
}

export interface Makeup {
  foundation: Layer
  concealer: Layer
  contour: Layer
  blush: Layer
  highlight: Layer
  eyeshadow: Layer & { shimmer: number }
  liner: Layer
  lowerLiner: Layer
  lipLiner: Layer
  lipstick: Layer
  /** 0 matte .. 1 high shine, lips only. */
  gloss: number
}

export interface StudioLook {
  v: 1
  /** 0..1 per morph, 0.5 is the neutral base mesh. */
  morphs: Record<MorphId, number>
  /** Whole-body scale, 0.94..1.06. */
  height: number
  skin: { tone: string; undertone: Undertone; glow: number }
  eyes: { iris: EyeId }
  brows: { shape: BrowId; color: string }
  lashes: { style: LashId }
  makeup: Makeup
  hair: { style: HairId; color: string; /** close-cropped hair painted on the scalp, 0..1 */ crop: number }
  nails: Layer
  outfit: { id: OutfitId; dye: string; dyeAmount: number }
  shoes: { id: ShoeId }
  /** Transformation-studio presets applied (for the lookbook caption only). */
  transforms: string[]
}

export function neutralMorphs(): Record<MorphId, number> {
  return Object.fromEntries(ALL_MORPHS.map((m) => [m, 0.5])) as Record<MorphId, number>
}

export const DEFAULT_LOOK: StudioLook = {
  v: 1,
  morphs: neutralMorphs(),
  height: 1,
  skin: { tone: '#6B4430', undertone: 'warm', glow: 0.35 },
  eyes: { iris: 'brown' },
  brows: { shape: 'eyebrow001', color: '#1C1210' },
  lashes: { style: 'eyelashes01' },
  makeup: {
    foundation: { color: '#6B4430', amount: 0 },
    concealer: { color: '#7A5038', amount: 0 },
    contour: { color: '#3E2418', amount: 0 },
    blush: { color: '#A8424A', amount: 0 },
    highlight: { color: '#E8C7A0', amount: 0 },
    eyeshadow: { color: '#5A3A2A', amount: 0, shimmer: 0 },
    liner: { color: '#0C0808', amount: 0 },
    lowerLiner: { color: '#0C0808', amount: 0 },
    lipLiner: { color: '#4A2220', amount: 0 },
    lipstick: { color: '#7A3A34', amount: 0 },
    gloss: 0.2,
  },
  hair: { style: 'afro01', color: '#141010', crop: 0.6 },
  nails: { color: '#7A1F2B', amount: 0 },
  outfit: { id: 'female_sportsuit01', dye: '#FFFFFF', dyeAmount: 0 },
  shoes: { id: 'shoes01' },
  transforms: [],
}

/* ------------------------------------------------------------------ validation */

const HEX = /^#[0-9a-fA-F]{6}$/
const clamp01 = (n: unknown, d: number) => (typeof n === 'number' && Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : d)
const hex = (s: unknown, d: string) => (typeof s === 'string' && HEX.test(s) ? s.toUpperCase() : d)
const oneOf = <T extends string>(s: unknown, list: readonly T[], d: T): T => (typeof s === 'string' && (list as readonly string[]).includes(s) ? (s as T) : d)
const obj = (o: unknown): Record<string, unknown> => (o && typeof o === 'object' && !Array.isArray(o) ? (o as Record<string, unknown>) : {})

function layer(o: unknown, d: Layer): Layer {
  const x = obj(o)
  return { color: hex(x.color, d.color), amount: clamp01(x.amount, d.amount) }
}

/** Accepts anything (a save from the network, old local data) and returns a valid look. */
export function sanitizeLook(input: unknown): StudioLook {
  const d = DEFAULT_LOOK
  const x = obj(input)
  const morphsIn = obj(x.morphs)
  const morphs = neutralMorphs()
  for (const m of ALL_MORPHS) morphs[m] = clamp01(morphsIn[m], 0.5)
  const skin = obj(x.skin)
  const mk = obj(x.makeup)
  const es = obj(mk.eyeshadow)
  const hair = obj(x.hair)
  const outfit = obj(x.outfit)
  const transforms = Array.isArray(x.transforms) ? x.transforms.filter((t): t is string => typeof t === 'string' && /^[a-z0-9-]{1,32}$/.test(t)).slice(0, 16) : []
  const h = typeof x.height === 'number' && Number.isFinite(x.height) ? Math.min(1.06, Math.max(0.94, x.height)) : 1
  return {
    v: 1,
    morphs,
    height: h,
    skin: { tone: hex(skin.tone, d.skin.tone), undertone: oneOf(skin.undertone, UNDERTONES, d.skin.undertone), glow: clamp01(skin.glow, d.skin.glow) },
    eyes: { iris: oneOf(obj(x.eyes).iris, EYE_IDS, d.eyes.iris) },
    brows: { shape: oneOf(obj(x.brows).shape, BROW_IDS, d.brows.shape), color: hex(obj(x.brows).color, d.brows.color) },
    lashes: { style: oneOf(obj(x.lashes).style, LASH_IDS, d.lashes.style) },
    makeup: {
      foundation: layer(mk.foundation, d.makeup.foundation),
      concealer: layer(mk.concealer, d.makeup.concealer),
      contour: layer(mk.contour, d.makeup.contour),
      blush: layer(mk.blush, d.makeup.blush),
      highlight: layer(mk.highlight, d.makeup.highlight),
      eyeshadow: { ...layer(es, d.makeup.eyeshadow), shimmer: clamp01(es.shimmer, 0) },
      liner: layer(mk.liner, d.makeup.liner),
      lowerLiner: layer(mk.lowerLiner, d.makeup.lowerLiner),
      lipLiner: layer(mk.lipLiner, d.makeup.lipLiner),
      lipstick: layer(mk.lipstick, d.makeup.lipstick),
      gloss: clamp01(mk.gloss, d.makeup.gloss),
    },
    hair: { style: oneOf(hair.style, [...HAIR_IDS, 'none'] as const, d.hair.style), color: hex(hair.color, d.hair.color), crop: clamp01(hair.crop, d.hair.crop) },
    nails: layer(x.nails, d.nails),
    outfit: { id: oneOf(outfit.id, OUTFIT_IDS, d.outfit.id), dye: hex(outfit.dye, d.outfit.dye), dyeAmount: clamp01(outfit.dyeAmount, 0) },
    shoes: { id: oneOf(obj(x.shoes).id, SHOE_IDS, d.shoes.id) },
    transforms,
  }
}

/* ------------------------------------------------------------------ saved looks */

export interface SavedLook {
  id: string
  name: string
  look: StudioLook
  savedAt: number
}

export const MAX_SAVED_LOOKS = 24

export function sanitizeSavedLook(input: unknown): SavedLook | null {
  const x = obj(input)
  if (typeof x.id !== 'string' || !/^[a-z0-9-]{4,40}$/i.test(x.id)) return null
  const name = typeof x.name === 'string' ? [...x.name].filter((c) => c.charCodeAt(0) >= 32).join('').trim().slice(0, 40) : ''
  return { id: x.id, name: name || 'Untitled look', look: sanitizeLook(x.look), savedAt: typeof x.savedAt === 'number' ? x.savedAt : 0 }
}
