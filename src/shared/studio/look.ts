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
  'NoseTipWidth',
] as const
/**
 * Masc: presentation, 0.5 (the feminine base) .. 1 masculine; below 0.5 changes nothing.
 * Every body morph changes shape relative to one shared skeleton (the build removes the joint drift
 * MakeHuman's macros carry), so limb lengths and proportions follow `height` only, never weight.
 */
export const BODY_MORPHS = ['Shoulders', 'Bust', 'BustLift', 'Waist', 'Belly', 'Hips', 'Glutes', 'Thighs', 'Arms', 'Calves', 'NeckFull', 'Softness', 'Muscle', 'Masc', 'Pregnant', 'ChestFlat', 'BackStraight', 'MascSoft'] as const
export type FaceMorph = (typeof FACE_MORPHS)[number]
export type BodyMorph = (typeof BODY_MORPHS)[number]
export type MorphId = FaceMorph | BodyMorph
/** Tallest a doll can be (relative to the base female's 1.59 m): men on the male base reach ~1.85 m. */
export const MAX_HEIGHT = 1.16
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
  'afro_fringe',
  'two_braids',
  'fulani_braids',
  'goddess_braids',
  'long_curls',
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
  'jayda_braids',
  'doechii_cornrows',
  'long_straight_fringe',
  'short_locs',
] as const
/** Renamed hair ids: old saves still load. */
const HAIR_RENAMES: Record<string, (typeof HAIR_IDS)[number]> = { afro01: 'afro_big', afro: 'afro_big' }
/** The shipped MakeHuman outfits: "classic sets" (dress slot, one colour). */
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
] as const
/** The shipped MakeHuman shoes: "classic" flats and trainers (shoes slot, one colour). */
export const SHOE_IDS = ['shoes01', 'shoes02', 'shoes03', 'shoes04', 'shoes05', 'shoes06'] as const
/**
 * Wardrobe pieces (scripts/character/outfit/build_pieces.py + shoes.py): each one asset, shared by
 * every doll, recoloured through three colour slots (primary, secondary, accent).
 */
export const PIECE_IDS = [
  'top_crop_tank',
  'top_tank',
  'top_cami',
  'top_corset',
  'top_bandeau',
  'top_baby_tee',
  'top_oversized_tee',
  'top_crop_tee',
  'top_flame_tee',
  'top_buba',
  'top_peplum',
  'top_mesh',
  'top_sports_bra',
  'top_lace_bralette',
  'top_square_crop',
  'top_everyday_tee',
  'top_track_jacket',
  'top_suit_jacket',
  'bottom_baggy_jeans',
  'bottom_skinny_jeans',
  'bottom_ripped_jeans',
  'bottom_cargo',
  'bottom_flare_pants',
  'bottom_leggings',
  'bottom_lace_briefs',
  'bottom_mini_skirt',
  'bottom_pleated_mini',
  'bottom_satin_mini',
  'bottom_midi_skirt',
  'bottom_pencil_skirt',
  'bottom_iro',
  'bottom_micro_skirt',
  'bottom_overalls',
  'bottom_wide_trousers',
  'bottom_track_pants',
  'bottom_suit_trousers',
  'dress_slip',
  'dress_sequin_mini',
  'dress_velvet_mini',
  'dress_lace_bodysuit',
  'dress_maxi',
  'shoes_pumps',
  'shoes_block_heels',
  'shoes_mules',
  'shoes_strappy',
  'shoes_ankle_strap',
  'shoes_heel_boots',
  'shoes_platforms',
  'shoes_kitten',
  'shoes_beaded_sandals',
] as const
export const PIECE_SLOTS = ['top', 'bottom', 'dress', 'shoes'] as const
export type PieceSlot = (typeof PIECE_SLOTS)[number]
export type PieceId = (typeof PIECE_IDS)[number]
/** Which slot a piece (or classic set / classic shoe) fills. */
export function slotOf(id: string): PieceSlot | null {
  if ((OUTFIT_IDS as readonly string[]).includes(id)) return 'dress'
  if ((SHOE_IDS as readonly string[]).includes(id)) return 'shoes'
  if (!(PIECE_IDS as readonly string[]).includes(id)) return null
  return id.split('_')[0] as PieceSlot
}
/** Skirts and dresses: the doll wears heels with them. */
export const SKIRTS: readonly string[] = ['bottom_mini_skirt', 'bottom_pleated_mini', 'bottom_satin_mini', 'bottom_midi_skirt', 'bottom_pencil_skirt', 'bottom_iro', 'bottom_micro_skirt']
/** One worn piece and its three colours (primary, secondary, accent). */
export interface Worn {
  id: string
  colors: [string, string, string]
}
export type Wear = Record<PieceSlot, Worn | null>
/** Heeled shoes (pieces built with a foot arch, plus the classic heels). */
export const HEELS: readonly string[] = ['shoes_pumps', 'shoes_block_heels', 'shoes_mules', 'shoes_strappy', 'shoes_ankle_strap', 'shoes_heel_boots', 'shoes_platforms', 'shoes_kitten', 'shoes_beaded_sandals']
/** A dress or a skirt: she wears heels with it. */
export const needsHeels = (w: Wear) => (!!w.dress && (w.dress.id.startsWith('dress_') || w.dress.id === 'female_elegantsuit01')) || SKIRTS.includes(w.bottom?.id ?? '')
export const UNDERTONES = ['cool', 'neutral', 'warm', 'olive'] as const

export type EyeId = (typeof EYE_IDS)[number]
export type BrowId = (typeof BROW_IDS)[number]
export type LashId = (typeof LASH_IDS)[number]
/** "none" shows the scalp, with optional painted close-cropped hair. */
export type HairId = (typeof HAIR_IDS)[number] | 'none'
export type OutfitId = (typeof OUTFIT_IDS)[number]
export type ShoeId = (typeof SHOE_IDS)[number]
/** Old save outfit ids (the first store collection), dressed in today's pieces. */
const OLD_OUTFITS: Record<string, Partial<Wear>> = {
  kai_butterfly_red: { top: { id: 'top_crop_tank', colors: ['#C8102E', '#FFC72C', '#2A1200'] }, bottom: { id: 'bottom_baggy_jeans', colors: ['#7FA3C9', '#D8A04A', '#B8B8B8'] } },
  kai_butterfly_blue: { top: { id: 'top_crop_tank', colors: ['#1F4FA8', '#F28C28', '#0E1A33'] }, bottom: { id: 'bottom_skinny_jeans', colors: ['#2E3D5C', '#D8A04A', '#B8B8B8'] } },
  kai_garden_set: { top: { id: 'top_cami', colors: ['#F6D7E3', '#6FA36B', '#FFFFFF'] }, bottom: { id: 'bottom_midi_skirt', colors: ['#F6D7E3', '#6FA36B', '#FFFFFF'] } },
  mc_corset_mini: { top: { id: 'top_corset', colors: ['#111111', '#D9B35B', '#B0124A'] }, bottom: { id: 'bottom_satin_mini', colors: ['#111111', '#D9B35B', '#FFFFFF'] } },
  mc_slip_dress: { dress: { id: 'dress_slip', colors: ['#B0124A', '#E8C7A0', '#FFFFFF'] } },
  dbf_sequin_mini: { dress: { id: 'dress_sequin_mini', colors: ['#D9B35B', '#F2D98A', '#FFFFFF'] } },
  dbf_flare_set: { top: { id: 'top_bandeau', colors: ['#E07AA6', '#FFFFFF', '#D9B35B'] }, bottom: { id: 'bottom_flare_pants', colors: ['#E07AA6', '#FFFFFF', '#D9B35B'] } },
  deeji_iro_buba: { top: { id: 'top_buba', colors: ['#F2C14E', '#2A5DB0', '#FFFFFF'] }, bottom: { id: 'bottom_iro', colors: ['#2A5DB0', '#F2C14E', '#FFFFFF'] } },
  deeji_ankara_set: { top: { id: 'top_peplum', colors: ['#E4572E', '#2A9D8F', '#F2C14E'] }, bottom: { id: 'bottom_pencil_skirt', colors: ['#E4572E', '#2A9D8F', '#F2C14E'] } },
  bola_distressed: { top: { id: 'top_oversized_tee', colors: ['#232323', '#EDE8DD', '#E63946'] }, bottom: { id: 'bottom_ripped_jeans', colors: ['#7FA3C9', '#D8A04A', '#B8B8B8'] } },
  bola_rock_set: { top: { id: 'top_crop_tee', colors: ['#6E6E72', '#141414', '#F2C14E'] }, bottom: { id: 'bottom_skinny_jeans', colors: ['#141414', '#D8A04A', '#B8B8B8'] } },
}

/* ------------------------------------------------------------------ accessories and tattoos */

/** Something held in the left hand (the right is free for waves, peace signs and selfies). */
export const HELD = ['none', 'whip', 'joint', 'clutch', 'fan', 'matcha', 'phone'] as const
export const HEADPIECES = ['none', 'coralBand', 'satinBand', 'headscarf'] as const
export interface Extras {
  held: (typeof HELD)[number]
  head: (typeof HEADPIECES)[number]
  /** Stacked coral bead necklaces (traditional). */
  coralBeads: boolean
  /** Coral beads on the wrists. */
  coralWrists: boolean
  /** Coral anklets. */
  anklets: boolean
  /** Waist beads over the hips. */
  waistBeads: boolean
  /** Rainbow pride pins on the top. */
  pins: boolean
  /** A chain hanging from the glasses. */
  glassesChain: boolean
  /** Layered chunky chains. */
  chains: boolean
  /** Colour of the headpiece / clutch / fan. */
  color: string
}
export const TATTOO_DESIGNS = ['rose', 'butterfly', 'heart', 'star', 'moon', 'snake', 'script', 'vine', 'dagger', 'sun', 'swallow', 'band'] as const
/** Tattoos only go where they're seen: the arms (upper arm, forearm, wrist), the neck, the ankles and the face. */
export const TATTOO_SPOTS = ['forearmL', 'forearmR', 'upperArmL', 'upperArmR', 'wristL', 'wristR', 'ankleL', 'ankleR', 'nape', 'neckSideL', 'neckSideR', 'faceL', 'faceR'] as const
export type TattooDesign = (typeof TATTOO_DESIGNS)[number]
export type TattooSpot = (typeof TATTOO_SPOTS)[number]
export interface Tattoo {
  design: TattooDesign
  at: TattooSpot
  /** Ink colour. */
  ink: string
  /** Size, about 0.6 (dainty) .. 1.6 (statement). */
  size: number
}
export const MAX_TATTOOS = 8
export const DEFAULT_EXTRAS: Extras = { held: 'none', head: 'none', coralBeads: false, coralWrists: false, anklets: false, waistBeads: false, pins: false, glassesChain: false, chains: false, color: '#E4572E' }
export type Undertone = (typeof UNDERTONES)[number]

/** Braids that can be taken down into a braid-out, and locs that can be retwisted. */
export const BRAIDED: readonly HairId[] = ['fulani_braids', 'box_braids', 'knotless_braids', 'twists', 'cornrows', 'jayda_braids', 'doechii_cornrows']
export const LOCS: readonly HairId[] = ['locs', 'locs_retwist', 'microlocs', 'freeform_locs', 'faux_locs', 'short_locs']

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
export const CARE_STEPS = ['patches', 'eyePatches', 'pop', 'cleanse', 'spot', 'toner', 'serum', 'eyeCream', 'moisturiser', 'sunscreen', 'lipBalm', 'exfoliate', 'soothe', 'brighten', 'compress', 'wash'] as const
export type CareStep = (typeof CARE_STEPS)[number]

export interface SkinCare {
  /** The just-woke-up state: sleepy eyes, bare skin, bonnet on. */
  morning: boolean
  /** Hydrocolloid pimple patches still on. */
  patches: SpotId[]
  /** Hydrogel under-eye patches still on (worn overnight; peeled off in the morning). */
  eyePatches: boolean
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
/** Lip piercings: a labret stud (centred under the lower lip), a Monroe (above the upper lip, off
 * centre), snake bites (two rings at the lower lip, near each corner). */
export const LIP_RINGS = ['none', 'labret', 'monroe', 'snakebites'] as const
export const NECKLACES = ['none', 'chain', 'pendant', 'choker', 'pearls'] as const
export const BRACELETS = ['none', 'bangle', 'chain', 'stack'] as const
/** Frames: round or rectangular ('square'), plus sunnies. (Old cat-eye saves become rectangular.) */
export const GLASSES = ['none', 'round', 'square', 'sunnies'] as const

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
  /** Industrial bar across the top of the ear. */
  industrial: boolean
}

/** Skin features that are part of who she is: birthmarks, moles, freckles, vitiligo. */
export const MARKS = ['none', 'mole', 'birthmark', 'freckles', 'vitiligo'] as const
export type MarkKind = (typeof MARKS)[number]
/** Where a mole or birthmark sits (face landmarks from the build). */
export const MARK_SPOTS = ['cheekL', 'cheekR', 'lipCornerL', 'lipCornerR', 'foreheadL', 'templeR', 'jawL', 'chin'] as const
export type MarkSpot = (typeof MARK_SPOTS)[number]

/* ------------------------------------------------------------------ clinic */

/** Beauty-clinic procedures (fictional avatar changes). Intensity 0..1 each; see clinic.ts. */
export const CLINIC_IDS = ['lipFiller', 'noseRefine', 'noseLift', 'cheekFiller', 'jawContour', 'chinFiller', 'underEye', 'bbl', 'lipo', 'breastAug', 'ribRemoval', 'glowDrip'] as const
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
  /** What she wears: one piece per slot (a dress replaces top and bottom), each in three colours. */
  wear: Wear
  extras: Extras
  tattoos: Tattoo[]
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

export const CLEAR_SKIN: SkinCare = { morning: false, patches: [], eyePatches: false, spots: {}, underEye: 0.15, texture: 0.1, rash: 0, pigment: 0, dry: 0, dew: 0, hydration: 0.5, glow: 0.3, spf: false, lips: 0.4, done: [] }

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
  jewellery: { metal: 'gold', ears: 'none', helix: false, nose: 'none', septum: false, lip: 'none', brow: false, navel: false, necklace: 'none', wrist: 'none', rings: false, glasses: 'none', frame: '#1A1416', industrial: false },
  wear: {
    top: { id: 'top_tank', colors: ['#F4EFE6', '#2A2A2A', '#2A2A2A'] },
    bottom: { id: 'bottom_skinny_jeans', colors: ['#2E3D5C', '#D8A04A', '#B8B8B8'] },
    dress: null,
    shoes: { id: 'shoes05', colors: ['#FFFFFF', '#FFFFFF', '#FFFFFF'] },
  },
  extras: DEFAULT_EXTRAS,
  tattoos: [],
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
    eyePatches: bool(c.eyePatches, false),
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

const WHITE3: [string, string, string] = ['#FFFFFF', '#FFFFFF', '#FFFFFF']

function worn(o: unknown, slot: PieceSlot): Worn | null {
  const x = obj(o)
  if (typeof x.id !== 'string' || slotOf(x.id) !== slot) return null
  const c = Array.isArray(x.colors) ? x.colors : []
  return { id: x.id, colors: [hex(c[0], '#FFFFFF'), hex(c[1], hex(c[0], '#FFFFFF')), hex(c[2], hex(c[0], '#FFFFFF'))] }
}

/** Today's wear, or the one outfit + shoes of an older save dressed in it. */
function sanitizeWear(x: Record<string, unknown>): Wear {
  const d = DEFAULT_LOOK.wear
  if (x.wear && typeof x.wear === 'object') {
    const w = obj(x.wear)
    const out: Wear = { top: worn(w.top, 'top'), bottom: worn(w.bottom, 'bottom'), dress: worn(w.dress, 'dress'), shoes: worn(w.shoes, 'shoes') }
    // a dress replaces the top and bottom
    if (out.dress) out.top = out.bottom = null
    return out
  }
  if (!x.outfit && !x.shoes) return d
  const o = obj(x.outfit)
  const out: Wear = { top: null, bottom: null, dress: null, shoes: d.shoes }
  const old = typeof o.id === 'string' ? OLD_OUTFITS[o.id] : undefined
  if (old) Object.assign(out, old)
  else if (typeof o.id === 'string' && (OUTFIT_IDS as readonly string[]).includes(o.id)) {
    const dye = hex(o.dye, '#FFFFFF')
    out.dress = { id: o.id, colors: clamp01(o.dyeAmount, 0) > 0.05 ? [dye, dye, dye] : WHITE3 }
  } else Object.assign(out, { top: d.top, bottom: d.bottom })
  const sh = obj(x.shoes).id
  if (typeof sh === 'string' && (SHOE_IDS as readonly string[]).includes(sh)) out.shoes = { id: sh, colors: WHITE3 }
  return out
}

function sanitizeExtras(e: Record<string, unknown>): Extras {
  const d = DEFAULT_EXTRAS
  return {
    held: oneOf(e.held, HELD, 'none'),
    head: oneOf(e.head, HEADPIECES, 'none'),
    coralBeads: bool(e.coralBeads, false),
    coralWrists: bool(e.coralWrists, false),
    anklets: bool(e.anklets, false),
    waistBeads: bool(e.waistBeads, false),
    pins: bool(e.pins, false),
    glassesChain: bool(e.glassesChain, false),
    chains: bool(e.chains, false),
    color: hex(e.color, d.color),
  }
}

function sanitizeTattoos(t: unknown): Tattoo[] {
  if (!Array.isArray(t)) return []
  const out: Tattoo[] = []
  for (const it of t.slice(0, MAX_TATTOOS)) {
    const x = obj(it)
    if (!(TATTOO_DESIGNS as readonly string[]).includes(x.design as string) || !(TATTOO_SPOTS as readonly string[]).includes(x.at as string)) continue
    if (out.some((o) => o.at === x.at)) continue
    const size = typeof x.size === 'number' && Number.isFinite(x.size) ? Math.min(1.6, Math.max(0.6, x.size)) : 1
    out.push({ design: x.design as TattooDesign, at: x.at as TattooSpot, ink: hex(x.ink, '#1A1A22'), size })
  }
  return out
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
  const nails = obj(x.nails)
  const jw = obj(x.jewellery)
  const brows = obj(x.brows)
  const profile = obj(x.profile)
  const scene = obj(x.scene)
  const transforms = Array.isArray(x.transforms) ? x.transforms.filter((t): t is string => typeof t === 'string' && /^[a-z0-9-]{1,32}$/.test(t)).slice(0, 16) : []
  const h = typeof x.height === 'number' && Number.isFinite(x.height) ? Math.min(MAX_HEIGHT, Math.max(0.94, x.height)) : 1
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
      preset: typeof hair.preset === 'string' && /^[a-z0-9_]{1,24}$/.test(hair.preset) ? hair.preset : 'custom',
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
      // (older saves: 'stud' was the labret, 'ring' a lip ring: now snake bites)
      lip: jw.lip === 'stud' ? 'labret' : jw.lip === 'ring' ? 'snakebites' : oneOf(jw.lip, LIP_RINGS, 'none'),
      brow: bool(jw.brow, false),
      navel: bool(jw.navel, false),
      necklace: oneOf(jw.necklace, NECKLACES, 'none'),
      wrist: oneOf(jw.wrist, BRACELETS, 'none'),
      rings: bool(jw.rings, false),
      glasses: jw.glasses === 'cateye' ? 'square' : oneOf(jw.glasses, GLASSES, 'none'),
      frame: hex(jw.frame, d.jewellery.frame),
      industrial: bool(jw.industrial, false),
    },
    wear: sanitizeWear(x),
    extras: sanitizeExtras(obj(x.extras)),
    tattoos: sanitizeTattoos(x.tattoos),
    transforms,
    // A v1 save already belongs to a player who has a character: don't send them through creation again.
    profile: { name: cleanText(profile.name, 24), starter: ident(profile.starter, ''), onboarded: bool(profile.onboarded, legacyV1 && Object.keys(x).length > 0) },
    scene: { id: ident(scene.id, d.scene.id), time: ident(scene.time, d.scene.time), weather: ident(scene.weather, d.scene.weather), spot: ident(scene.spot, '') },
  }
}

/* ------------------------------------------------------------------ names */

/**
 * The key two doll names collide on: case, accents, spacing and punctuation don't make a name
 * different ("Bibi", "bibi", "B.i.b.i" and "Bíbí" are one name).
 */
export function nameKey(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '')
    .slice(0, 24)
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
