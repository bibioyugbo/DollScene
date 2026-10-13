/**
 * The DollScene Beauty Studio look: everything a player can change on the 3D character.
 * Pure data, shared by the browser and the server (which re-validates every save).
 * Asset ids match public/models/studio/character.json (built by scripts/character).
 *
 * v2 adds skin care, hair care, the full makeup kit, nails, jewellery, beauty-clinic procedures
 * (kept apart from the locked base shape) and the doll's profile and current scene. v1 saves load
 * unchanged: anything missing takes its default.
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
/**
 * Masc: presentation, 0.5 (the feminine base) .. 1 masculine; below 0.5 changes nothing.
 * Every body morph changes shape relative to one shared skeleton (the build removes the joint drift
 * MakeHuman's macros carry), so limb lengths and proportions follow `height` only, never weight.
 */
export const BODY_MORPHS = ['Shoulders', 'Bust', 'BustLift', 'Waist', 'Belly', 'Hips', 'Glutes', 'Thighs', 'Arms', 'Calves', 'NeckFull', 'Softness', 'Muscle', 'Masc'] as const
export type FaceMorph = (typeof FACE_MORPHS)[number]
export type BodyMorph = (typeof BODY_MORPHS)[number]
export type MorphId = FaceMorph | BodyMorph
export const ALL_MORPHS: readonly MorphId[] = [...FACE_MORPHS, ...BODY_MORPHS]

/** Facial expression shape keys on the body (single-sided, 0 rest .. 1 full). Never saved. */
export const EXPRESSIONS = ['Expr_BlinkL', 'Expr_BlinkR', 'Expr_Sleepy', 'Expr_Smile', 'Expr_Open', 'Expr_Pout', 'Expr_BrowsUp', 'Expr_Worried', 'Expr_Squint', 'Expr_Wince'] as const
export type ExpressionId = (typeof EXPRESSIONS)[number]

export const EYE_IDS = ['brown', 'brownlight', 'green', 'grey', 'bluegreen'] as const
export const BROW_IDS = ['eyebrow001', 'eyebrow006', 'eyebrow010', 'eyebrow003', 'eyebrow008'] as const
export const LASH_IDS = ['eyelashes01', 'eyelashes02', 'eyelashes03'] as const
/**
 * Every hairstyle the game knows. The catalog (character.json) says which ones are built; the
 * editors list only those, and a save naming a missing one falls back safely at load.
 */
export const HAIR_IDS = [
  'afro_short',
  'afro_big',
  'afro_puffs',
  'two_braids',
  'fulani_braids',
  'box_braids',
  'knotless_braids',
  'cornrows',
  'locs',
  'locs_retwist',
  'microlocs',
  'freeform_locs',
  'faux_locs',
  'twists',
  'bantu_knots',
  'bun',
  'curls',
  'wavy_wig',
  'leave_out',
  'braid_out',
  'pixie',
  'short02',
  'bob02',
  'long01',
  'ponytail01',
  'braid01',
] as const
/** Renamed hair ids: old saves still load. */
const HAIR_RENAMES: Record<string, (typeof HAIR_IDS)[number]> = { afro01: 'afro_big', afro: 'afro_big' }
export const OUTFIT_IDS = [
  'female_sportsuit01',
  'female_casualsuit01',
  'female_casualsuit02',
  'female_elegantsuit01',
  'male_casualsuit01',
  'male_casualsuit02',
  'male_casualsuit03',
  'male_casualsuit04',
  'male_casualsuit05',
  'male_casualsuit06',
  'male_elegantsuit01',
  'male_worksuit01',
  // store collections (scripts/character/outfit/build_outfits.py)
  'kai_butterfly_red',
  'kai_butterfly_blue',
  'kai_garden_set',
  'mc_corset_mini',
  'mc_slip_dress',
  'dbf_sequin_mini',
  'dbf_flare_set',
  'deeji_iro_buba',
  'deeji_ankara_set',
  'bola_distressed',
  'bola_rock_set',
] as const
export const SHOE_IDS = ['shoes01', 'shoes02', 'shoes03', 'shoes04', 'shoes05', 'shoes06'] as const
export const UNDERTONES = ['cool', 'neutral', 'warm', 'olive'] as const

export type EyeId = (typeof EYE_IDS)[number]
export type BrowId = (typeof BROW_IDS)[number]
export type LashId = (typeof LASH_IDS)[number]
/** "none" shows the scalp, with optional painted close-cropped hair. */
export type HairId = (typeof HAIR_IDS)[number] | 'none'
export type OutfitId = (typeof OUTFIT_IDS)[number]
export type ShoeId = (typeof SHOE_IDS)[number]
export type Undertone = (typeof UNDERTONES)[number]

/** Braids that can be taken down into a braid-out, and locs that can be retwisted. */
export const BRAIDED: readonly HairId[] = ['fulani_braids', 'box_braids', 'knotless_braids', 'twists', 'cornrows']
export const LOCS: readonly HairId[] = ['locs', 'locs_retwist', 'microlocs', 'freeform_locs', 'faux_locs']

/** Haircare progress: wet hair, the sleep bonnet, and a section-by-section takedown or retwist. */
export interface HairCare {
  /** 0 dry .. 1 soaked. */
  wet: number
  bonnet: boolean
  /** An unfinished section-by-section change from `from` to `to`; `sections` is a bitmask of the 8 scalp sections done. */
  change: { kind: 'takedown' | 'retwist'; from: HairId; to: HairId; sections: number } | null
}

/**
 * Hair colour works like a master material with parameters: one mesh per style, any colour.
 * color = BaseColor (roots), tip = TipColor (ends), blend = ColorBlend (0 solid .. 1 ombre from the
 * roots), roughness 0..1, shine 0..1. preset names the swatch picked, or 'custom'.
 */
export interface HairLook {
  style: HairId
  color: string
  tip: string
  blend: number
  roughness: number
  shine: number
  preset: string
  /** close-cropped hair painted on the scalp, 0..1 */
  crop: number
  care: HairCare
}

/** A colour layer: hex colour + strength 0..1. */
export interface Layer {
  color: string
  amount: number
}

export const FINISHES = ['matte', 'satin', 'dewy'] as const
export type Finish = (typeof FINISHES)[number]
export const LIP_FINISHES = ['satin', 'matte', 'gloss', 'frost'] as const
export type LipFinish = (typeof LIP_FINISHES)[number]
export const BROW_STYLES = ['natural', 'pencil', 'pomade', 'laminated'] as const
export type BrowStyle = (typeof BROW_STYLES)[number]

export interface Makeup {
  /** Smooths texture under everything else. */
  primer: number
  /** Peach/orange corrector under the eyes. */
  corrector: Layer
  foundation: Layer
  foundationFinish: Finish
  concealer: Layer
  /** Setting powder: mattifies; colour is the powder tint. */
  powder: Layer
  contour: Layer
  bronzer: Layer
  blush: Layer
  highlight: Layer
  eyeshadow: Layer & { shimmer: number }
  innerCorner: Layer
  liner: Layer
  lowerLiner: Layer
  mascara: number
  lipLiner: Layer
  lipstick: Layer
  /** Ombre lips: this colour blooms from the centre of the lips. */
  lipCentre: Layer
  lipFinish: LipFinish
  /** 0 matte .. 1 high shine, lips only. */
  gloss: number
  /** Setting spray: melts powder back to skin, a soft dewy finish. */
  setting: number
}

/* ------------------------------------------------------------------ skin care */

/** Blemish spots on the face (positions in character.json "care.spots"). */
export const SPOT_IDS = ['forehead1', 'forehead2', 'cheekL', 'cheekR', 'chin', 'nose', 'jawR', 'cheekL2'] as const
export type SpotId = (typeof SPOT_IDS)[number]
/**
 * pimple: raised spot; popped: small red mark after squeezing (heals to clear); treated: spot
 * treatment on it; flat: a pimple a patch has drawn out (a flat, slightly pink spot); boil: a large,
 * deep, tender bump with a yellow head; drained: a boil after a warm compress has brought it to a
 * head and it has drained (red, flat, healing). Absent = clear.
 */
export const SPOT_STATES = ['pimple', 'popped', 'treated', 'flat', 'boil', 'drained'] as const
export type SpotState = (typeof SPOT_STATES)[number]
export const CARE_STEPS = ['patches', 'pop', 'cleanse', 'spot', 'toner', 'serum', 'eyeCream', 'moisturiser', 'sunscreen', 'lipBalm', 'exfoliate', 'soothe', 'brighten', 'compress', 'wash'] as const
export type CareStep = (typeof CARE_STEPS)[number]

export interface SkinCare {
  /** The just-woke-up state: sleepy eyes, bare skin, bonnet on. */
  morning: boolean
  /** Hydrocolloid pimple patches still on. */
  patches: SpotId[]
  spots: Partial<Record<SpotId, SpotState>>
  /** Under-eye darkness 0..1. */
  underEye: number
  /** Uneven texture and redness 0..1. */
  texture: number
  /** Rash: red, bumpy irritation over the cheeks and chin, 0..1 (soothing gel calms it). */
  rash: number
  /** Hyperpigmentation: darker marks and patches, 0..1 (brightening serum fades them). */
  pigment: number
  /** Dry, flaky patches, 0..1 (exfoliating, then moisturising, smooths them). */
  dry: number
  /** Just-washed: a wet, dewy face with water droplets, 0..1 (toner and patting dry take it down). */
  dew: number
  /** Results of the routine, 0..1. */
  hydration: number
  glow: number
  spf: boolean
  lips: number
  /** Routine steps finished since the morning started. */
  done: CareStep[]
}

/* ------------------------------------------------------------------ nails */

export const NAIL_SHAPES = ['natural', 'square', 'round', 'almond', 'coffin', 'stiletto'] as const
export type NailShape = (typeof NAIL_SHAPES)[number]
export const NAIL_FINISHES = ['cream', 'jelly', 'chrome', 'glitter', 'cateye'] as const
export type NailFinish = (typeof NAIL_FINISHES)[number]
export const NAIL_ARTS = ['none', 'french', 'dots', 'hearts', 'flowers', 'stripes', 'marble', 'leopard'] as const
export type NailArt = (typeof NAIL_ARTS)[number]

export interface NailLook {
  /** Polish colour and coverage (0 bare). */
  color: string
  amount: number
  shape: NailShape
  /** 0 natural length .. 1 long press-on. */
  length: number
  finish: NailFinish
  art: NailArt
  artColor: string
  gems: boolean
  /** Matching pedicure (polish on the toenails). */
  toes: boolean
}

/* ------------------------------------------------------------------ jewellery */

export const METALS = ['gold', 'silver', 'rose'] as const
export type Metal = (typeof METALS)[number]
export const EARRINGS = ['none', 'studs', 'hoops', 'huggies', 'drops'] as const
export const NOSE_RINGS = ['none', 'stud', 'ring'] as const
export const LIP_RINGS = ['none', 'stud', 'ring'] as const
export const NECKLACES = ['none', 'chain', 'pendant', 'choker', 'pearls'] as const
export const BRACELETS = ['none', 'bangle', 'chain', 'stack'] as const
export const GLASSES = ['none', 'round', 'square', 'cateye', 'sunnies'] as const

export interface Jewellery {
  metal: Metal
  ears: (typeof EARRINGS)[number]
  helix: boolean
  nose: (typeof NOSE_RINGS)[number]
  septum: boolean
  lip: (typeof LIP_RINGS)[number]
  brow: boolean
  navel: boolean
  necklace: (typeof NECKLACES)[number]
  wrist: (typeof BRACELETS)[number]
  rings: boolean
  glasses: (typeof GLASSES)[number]
  /** Frame colour. */
  frame: string
}

/** Skin features that are part of who she is: birthmarks, moles, freckles, vitiligo. */
export const MARKS = ['none', 'mole', 'birthmark', 'freckles', 'vitiligo'] as const
export type MarkKind = (typeof MARKS)[number]
/** Where a mole or birthmark sits (face landmarks from the build). */
export const MARK_SPOTS = ['cheekL', 'cheekR', 'lipCornerL', 'lipCornerR', 'foreheadL', 'templeR', 'jawL', 'chin'] as const
export type MarkSpot = (typeof MARK_SPOTS)[number]

/* ------------------------------------------------------------------ clinic */

/** Beauty-clinic procedures (fictional avatar changes). Intensity 0..1 each; see clinic.ts. */
export const CLINIC_IDS = ['lipFiller', 'noseRefine', 'noseLift', 'cheekFiller', 'jawContour', 'chinFiller', 'underEye', 'hairline', 'transplant', 'bbl', 'lipo'] as const
export type ClinicId = (typeof CLINIC_IDS)[number]

/* ------------------------------------------------------------------ the look */

export interface Profile {
  /** The doll's name (a character name, not the player's). */
  name: string
  /** Starter avatar picked at creation. */
  starter: string
  onboarded: boolean
}

export interface SceneChoice {
  id: string
  time: string
  weather: string
  /** Photo spot inside the scene ('' = the scene's first). */
  spot: string
}

export interface StudioLook {
  v: 2
  /**
   * The base face and body, 0..1 per morph (0.5 neutral). Chosen at creation, then locked:
   * only the beauty clinic changes the shown shape, through `clinic`.
   */
  morphs: Record<MorphId, number>
  clinic: Partial<Record<ClinicId, number>>
  /** Whole-body scale, 0.94..1.06. */
  height: number
  skin: { tone: string; undertone: Undertone; glow: number; mark: MarkKind; markAt: MarkSpot }
  care: SkinCare
  eyes: { iris: EyeId }
  brows: { shape: BrowId; color: string; style: BrowStyle }
  lashes: { style: LashId }
  makeup: Makeup
  hair: HairLook
  nails: NailLook
  jewellery: Jewellery
  outfit: { id: OutfitId; dye: string; dyeAmount: number }
  shoes: { id: ShoeId }
  /** Transformation-studio presets applied (for the lookbook caption only). */
  transforms: string[]
  profile: Profile
  scene: SceneChoice
}

export function neutralMorphs(): Record<MorphId, number> {
  return Object.fromEntries(ALL_MORPHS.map((m) => [m, 0.5])) as Record<MorphId, number>
}

const bare = (color: string): Layer => ({ color, amount: 0 })

export const DEFAULT_MAKEUP: Makeup = {
  primer: 0,
  corrector: bare('#E59A6A'),
  foundation: bare('#6B4430'),
  foundationFinish: 'satin',
  concealer: bare('#7A5038'),
  powder: bare('#8A6A55'),
  contour: bare('#3E2418'),
  bronzer: bare('#8A4A2A'),
  blush: bare('#A8424A'),
  highlight: bare('#E8C7A0'),
  eyeshadow: { color: '#5A3A2A', amount: 0, shimmer: 0 },
  innerCorner: bare('#F4E4CC'),
  liner: bare('#0C0808'),
  lowerLiner: bare('#0C0808'),
  mascara: 0,
  lipLiner: bare('#4A2220'),
  lipstick: bare('#7A3A34'),
  lipCentre: bare('#C24E7A'),
  lipFinish: 'satin',
  gloss: 0.2,
  setting: 0,
}

export const CLEAR_SKIN: SkinCare = { morning: false, patches: [], spots: {}, underEye: 0.15, texture: 0.1, rash: 0, pigment: 0, dry: 0, dew: 0, hydration: 0.5, glow: 0.3, spf: false, lips: 0.4, done: [] }

export const DEFAULT_LOOK: StudioLook = {
  v: 2,
  morphs: neutralMorphs(),
  clinic: {},
  height: 1,
  skin: { tone: '#6B4430', undertone: 'warm', glow: 0.35, mark: 'none', markAt: 'cheekL' },
  care: CLEAR_SKIN,
  eyes: { iris: 'brown' },
  brows: { shape: 'eyebrow001', color: '#1C1210', style: 'natural' },
  lashes: { style: 'eyelashes01' },
  makeup: DEFAULT_MAKEUP,
  hair: { style: 'afro_big', color: '#0A0A0C', tip: '#0A0A0C', blend: 0, roughness: 0.6, shine: 0.35, preset: 'jet_black', crop: 0.6, care: { wet: 0, bonnet: false, change: null } },
  nails: { color: '#7A1F2B', amount: 0, shape: 'natural', length: 0, finish: 'cream', art: 'none', artColor: '#FFFFFF', gems: false, toes: false },
  jewellery: { metal: 'gold', ears: 'none', helix: false, nose: 'none', septum: false, lip: 'none', brow: false, navel: false, necklace: 'none', wrist: 'none', rings: false, glasses: 'none', frame: '#1A1416' },
  outfit: { id: 'female_sportsuit01', dye: '#FFFFFF', dyeAmount: 0 },
  shoes: { id: 'shoes01' },
  transforms: [],
  profile: { name: '', starter: '', onboarded: false },
  scene: { id: 'rooftop', time: 'night', weather: 'clear', spot: '' },
}

/* ------------------------------------------------------------------ validation */

const HEX = /^#[0-9a-fA-F]{6}$/
const clamp01 = (n: unknown, d: number) => (typeof n === 'number' && Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : d)
const hex = (s: unknown, d: string) => (typeof s === 'string' && HEX.test(s) ? s.toUpperCase() : d)
const oneOf = <T extends string>(s: unknown, list: readonly T[], d: T): T => (typeof s === 'string' && (list as readonly string[]).includes(s) ? (s as T) : d)
const bool = (b: unknown, d: boolean) => (typeof b === 'boolean' ? b : d)
const obj = (o: unknown): Record<string, unknown> => (o && typeof o === 'object' && !Array.isArray(o) ? (o as Record<string, unknown>) : {})
const ident = (s: unknown, d: string) => (typeof s === 'string' && /^[a-z0-9_-]{1,24}$/i.test(s) ? s : d)
const cleanText = (s: unknown, max: number) => (typeof s === 'string' ? [...s].filter((c) => c.charCodeAt(0) >= 32).join('').trim().slice(0, max) : '')

function layer(o: unknown, d: Layer): Layer {
  const x = obj(o)
  return { color: hex(x.color, d.color), amount: clamp01(x.amount, d.amount) }
}

const HAIR_OR_NONE = [...HAIR_IDS, 'none'] as const
const hairId = (s: unknown, d: HairId): HairId => oneOf(typeof s === 'string' ? (HAIR_RENAMES[s] ?? s) : s, HAIR_OR_NONE, d)

function sanitizeMakeup(mk: Record<string, unknown>): Makeup {
  const d = DEFAULT_MAKEUP
  const es = obj(mk.eyeshadow)
  return {
    primer: clamp01(mk.primer, 0),
    corrector: layer(mk.corrector, d.corrector),
    foundation: layer(mk.foundation, d.foundation),
    foundationFinish: oneOf(mk.foundationFinish, FINISHES, d.foundationFinish),
    concealer: layer(mk.concealer, d.concealer),
    powder: layer(mk.powder, d.powder),
    contour: layer(mk.contour, d.contour),
    bronzer: layer(mk.bronzer, d.bronzer),
    blush: layer(mk.blush, d.blush),
    highlight: layer(mk.highlight, d.highlight),
    eyeshadow: { ...layer(es, d.eyeshadow), shimmer: clamp01(es.shimmer, 0) },
    innerCorner: layer(mk.innerCorner, d.innerCorner),
    liner: layer(mk.liner, d.liner),
    lowerLiner: layer(mk.lowerLiner, d.lowerLiner),
    mascara: clamp01(mk.mascara, 0),
    lipLiner: layer(mk.lipLiner, d.lipLiner),
    lipstick: layer(mk.lipstick, d.lipstick),
    lipCentre: layer(mk.lipCentre, d.lipCentre),
    lipFinish: oneOf(mk.lipFinish, LIP_FINISHES, d.lipFinish),
    gloss: clamp01(mk.gloss, d.gloss),
    setting: clamp01(mk.setting, 0),
  }
}

function sanitizeCare(c: Record<string, unknown>): SkinCare {
  const d = CLEAR_SKIN
  const spotsIn = obj(c.spots)
  const spots: Partial<Record<SpotId, SpotState>> = {}
  for (const id of SPOT_IDS) {
    const st = spotsIn[id]
    if (typeof st === 'string' && (SPOT_STATES as readonly string[]).includes(st)) spots[id] = st as SpotState
  }
  const ids = (a: unknown) => (Array.isArray(a) ? [...new Set(a.filter((s): s is SpotId => typeof s === 'string' && (SPOT_IDS as readonly string[]).includes(s)))] : [])
  const steps = Array.isArray(c.done) ? [...new Set(c.done.filter((s): s is CareStep => typeof s === 'string' && (CARE_STEPS as readonly string[]).includes(s)))] : []
  return {
    morning: bool(c.morning, d.morning),
    patches: ids(c.patches),
    spots,
    underEye: clamp01(c.underEye, d.underEye),
    texture: clamp01(c.texture, d.texture),
    rash: clamp01(c.rash, 0),
    pigment: clamp01(c.pigment, 0),
    dry: clamp01(c.dry, 0),
    dew: clamp01(c.dew, 0),
    hydration: clamp01(c.hydration, d.hydration),
    glow: clamp01(c.glow, d.glow),
    spf: bool(c.spf, d.spf),
    lips: clamp01(c.lips, d.lips),
    done: steps,
  }
}

function sanitizeHairCare(c: Record<string, unknown>): HairCare {
  const ch = obj(c.change)
  const kind = oneOf(ch.kind, ['takedown', 'retwist'] as const, 'takedown')
  const change =
    c.change && typeof ch.sections === 'number' && Number.isInteger(ch.sections) && ch.sections >= 0 && ch.sections < 256
      ? { kind, from: hairId(ch.from, 'none'), to: hairId(ch.to, 'none'), sections: ch.sections }
      : null
  return { wet: clamp01(c.wet, 0), bonnet: bool(c.bonnet, false), change: change && change.from !== 'none' && change.to !== 'none' ? change : null }
}

/** Accepts anything (a save from the network, old local data) and returns a valid look. */
export function sanitizeLook(input: unknown): StudioLook {
  const d = DEFAULT_LOOK
  const x = obj(input)
  const morphsIn = obj(x.morphs)
  const morphs = neutralMorphs()
  for (const m of ALL_MORPHS) morphs[m] = clamp01(morphsIn[m], 0.5)
  const clinicIn = obj(x.clinic)
  const clinic: Partial<Record<ClinicId, number>> = {}
  for (const id of CLINIC_IDS) {
    const v = clamp01(clinicIn[id], 0)
    if (v > 0) clinic[id] = v
  }
  const skin = obj(x.skin)
  const hair = obj(x.hair)
  const outfit = obj(x.outfit)
  const nails = obj(x.nails)
  const jw = obj(x.jewellery)
  const brows = obj(x.brows)
  const profile = obj(x.profile)
  const scene = obj(x.scene)
  const transforms = Array.isArray(x.transforms) ? x.transforms.filter((t): t is string => typeof t === 'string' && /^[a-z0-9-]{1,32}$/.test(t)).slice(0, 16) : []
  const h = typeof x.height === 'number' && Number.isFinite(x.height) ? Math.min(1.06, Math.max(0.94, x.height)) : 1
  const legacyV1 = x.v !== 2
  return {
    v: 2,
    morphs,
    clinic,
    height: h,
    skin: { tone: hex(skin.tone, d.skin.tone), undertone: oneOf(skin.undertone, UNDERTONES, d.skin.undertone), glow: clamp01(skin.glow, d.skin.glow), mark: oneOf(skin.mark, MARKS, 'none'), markAt: oneOf(skin.markAt, MARK_SPOTS, 'cheekL') },
    care: sanitizeCare(obj(x.care)),
    eyes: { iris: oneOf(obj(x.eyes).iris, EYE_IDS, d.eyes.iris) },
    brows: { shape: oneOf(brows.shape, BROW_IDS, d.brows.shape), color: hex(brows.color, d.brows.color), style: oneOf(brows.style, BROW_STYLES, d.brows.style) },
    lashes: { style: oneOf(obj(x.lashes).style, LASH_IDS, d.lashes.style) },
    makeup: sanitizeMakeup(obj(x.makeup)),
    hair: {
      style: hairId(hair.style, d.hair.style),
      color: hex(hair.color, d.hair.color),
      // Older saves have no tip colour: a solid colour, so the tip matches the base.
      tip: hex(hair.tip, hex(hair.color, d.hair.color)),
      blend: clamp01(hair.blend, 0),
      roughness: clamp01(hair.roughness, d.hair.roughness),
      shine: clamp01(hair.shine, d.hair.shine),
      preset: typeof hair.preset === 'string' && /^[a-z_]{1,24}$/.test(hair.preset) ? hair.preset : 'custom',
      crop: clamp01(hair.crop, d.hair.crop),
      care: sanitizeHairCare(obj(hair.care)),
    },
    nails: {
      color: hex(nails.color, d.nails.color),
      amount: clamp01(nails.amount, d.nails.amount),
      shape: oneOf(nails.shape, NAIL_SHAPES, d.nails.shape),
      length: clamp01(nails.length, d.nails.length),
      finish: oneOf(nails.finish, NAIL_FINISHES, d.nails.finish),
      art: oneOf(nails.art, NAIL_ARTS, d.nails.art),
      artColor: hex(nails.artColor, d.nails.artColor),
      gems: bool(nails.gems, false),
      toes: bool(nails.toes, false),
    },
    jewellery: {
      metal: oneOf(jw.metal, METALS, d.jewellery.metal),
      ears: oneOf(jw.ears, EARRINGS, 'none'),
      helix: bool(jw.helix, false),
      nose: oneOf(jw.nose, NOSE_RINGS, 'none'),
      septum: bool(jw.septum, false),
      lip: oneOf(jw.lip, LIP_RINGS, 'none'),
      brow: bool(jw.brow, false),
      navel: bool(jw.navel, false),
      necklace: oneOf(jw.necklace, NECKLACES, 'none'),
      wrist: oneOf(jw.wrist, BRACELETS, 'none'),
      rings: bool(jw.rings, false),
      glasses: oneOf(jw.glasses, GLASSES, 'none'),
      frame: hex(jw.frame, d.jewellery.frame),
    },
    outfit: { id: oneOf(outfit.id, OUTFIT_IDS, d.outfit.id), dye: hex(outfit.dye, d.outfit.dye), dyeAmount: clamp01(outfit.dyeAmount, 0) },
    shoes: { id: oneOf(obj(x.shoes).id, SHOE_IDS, d.shoes.id) },
    transforms,
    // A v1 save already belongs to a player who has a character: don't send them through creation again.
    profile: { name: cleanText(profile.name, 24), starter: ident(profile.starter, ''), onboarded: bool(profile.onboarded, legacyV1 && Object.keys(x).length > 0) },
    scene: { id: ident(scene.id, d.scene.id), time: ident(scene.time, d.scene.time), weather: ident(scene.weather, d.scene.weather), spot: ident(scene.spot, '') },
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
  const name = cleanText(x.name, 40)
  return { id: x.id, name: name || 'Untitled look', look: sanitizeLook(x.look), savedAt: typeof x.savedAt === 'number' ? x.savedAt : 0 }
}
