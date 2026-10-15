import { DEFAULT_EXTRAS, DEFAULT_LOOK, DEFAULT_MAKEUP, HEELS, MAX_HEIGHT, needsHeels, neutralMorphs, type Extras, type Makeup, type MorphId, type StudioLook, type Tattoo, type Wear, type Worn } from './look'

/* ------------------------------------------------------------------ skin */

/** Twenty-four tones, deepest to lightest. Every tone is equal in play: none scores higher. */
export const SKIN_TONES = [
  '#2B1A14', '#33201A', '#3B241A', '#45291D', '#4E2F20', '#583524',
  '#613B28', '#6B4430', '#744A33', '#7E5238', '#88593D', '#926243',
  '#9C6B4A', '#A57452', '#AE7D5A', '#B78764', '#C0916E', '#C89B78',
  '#D0A684', '#D7B190', '#DDBB9C', '#E3C5A9', '#E9D0B7', '#EFDAC5',
] as const

/* ------------------------------------------------------------------ makeup looks */

type MakeupPatch = { [K in keyof Makeup]?: Makeup[K] }
const nude = (m: MakeupPatch): Makeup => ({ ...structuredClone(DEFAULT_MAKEUP), ...m })

export interface MakeupPreset {
  id: string
  name: string
  blurb: string
  /** Built from the current skin tone so foundation and concealer always match the player. */
  build: (tone: string) => Makeup
}

/** Mix two hex colours (t = 0 → a). */
export function mixHex(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16)
  const pb = parseInt(b.slice(1), 16)
  const ch = (s: number) => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t)
  return '#' + ((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0').toUpperCase()
}

const L = (color: string, amount: number) => ({ color, amount })
const lift = (tone: string, t = 0.16) => mixHex(tone, '#FFE2C4', t)

/**
 * Every look is made of the same layers the player edits, so applying one in the studio plays
 * product by product, and anything can be changed afterwards.
 */
export const MAKEUP_PRESETS: MakeupPreset[] = [
  { id: 'bare', name: 'Bare skin', blurb: 'Nothing on. Your own glow.', build: () => nude({}) },
  {
    id: 'no-makeup',
    name: 'No-makeup makeup',
    blurb: 'Skin tint, brushed brows, a whisper of mascara.',
    build: (tone) => nude({ primer: 0.4, foundation: L(tone, 0.22), foundationFinish: 'dewy', concealer: L(lift(tone, 0.1), 0.25), blush: L('#9E4A44', 0.14), mascara: 0.35, lipstick: L(mixHex(tone, '#8A4A3E', 0.4), 0.3), gloss: 0.5 }),
  },
  {
    id: 'natural',
    name: 'Natural',
    blurb: 'Skin first: sheer base, brushed brows, tinted balm.',
    build: (tone) => nude({ foundation: L(tone, 0.35), concealer: L(lift(tone, 0.12), 0.35), blush: L('#9E4A44', 0.25), highlight: L('#E6C29A', 0.15), liner: L('#1A1210', 0.15), mascara: 0.45, lipstick: L(mixHex(tone, '#8A3A36', 0.55), 0.45), gloss: 0.45 }),
  },
  {
    id: 'clean-girl',
    name: 'Clean girl',
    blurb: 'Glass skin, laminated brows, cream blush, glossy lip.',
    build: (tone) => nude({ primer: 0.6, foundation: L(tone, 0.3), foundationFinish: 'dewy', concealer: L(lift(tone, 0.14), 0.4), blush: L('#B0505A', 0.22), bronzer: L('#8A4A2A', 0.2), highlight: L('#F2D8C0', 0.4), mascara: 0.5, lipLiner: L(mixHex(tone, '#5A2A24', 0.5), 0.35), lipstick: L(mixHex(tone, '#B07060', 0.4), 0.35), lipFinish: 'gloss', gloss: 0.9, setting: 0.5 }),
  },
  {
    id: 'soft-beat',
    name: 'Soft beat',
    blurb: 'Seamless base, soft sculpt, neutral eye, lashes and a flattering nude.',
    build: (tone) =>
      nude({
        primer: 0.5,
        corrector: L('#D98A5A', 0.25),
        foundation: L(tone, 0.6),
        foundationFinish: 'satin',
        concealer: L(lift(tone, 0.18), 0.55),
        powder: L(lift(tone, 0.08), 0.35),
        contour: L('#3A2117', 0.35),
        bronzer: L('#8A4A2A', 0.3),
        blush: L('#A6503F', 0.32),
        highlight: L('#EBC593', 0.3),
        eyeshadow: { color: '#7A5038', amount: 0.45, shimmer: 0.1 },
        liner: L('#120C0A', 0.35),
        mascara: 0.75,
        lipLiner: L('#4A2620', 0.55),
        lipstick: L(mixHex(tone, '#9A5A48', 0.55), 0.65),
        gloss: 0.45,
        setting: 0.4,
      }),
  },
  {
    id: 'soft-glam',
    name: 'Soft glam',
    blurb: 'Warm brown smoke, sculpted cheeks, glossy nude lip.',
    build: (tone) => nude({ primer: 0.4, foundation: L(tone, 0.6), concealer: L(lift(tone, 0.18), 0.55), powder: L(lift(tone, 0.06), 0.3), contour: L('#3A2117', 0.45), blush: L('#A6503F', 0.4), highlight: L('#EBC593', 0.45), eyeshadow: { color: '#6B3E26', amount: 0.55, shimmer: 0.2 }, liner: L('#120C0A', 0.55), mascara: 0.8, lipLiner: L('#4A2620', 0.6), lipstick: L(mixHex(tone, '#9A5A48', 0.6), 0.7), gloss: 0.7 }),
  },
  {
    id: 'full-glam',
    name: 'Full glam',
    blurb: 'Full coverage, carved contour, cut crease, winged liner, overlined lip.',
    build: (tone) => nude({ primer: 0.8, corrector: L('#D9804A', 0.35), foundation: L(tone, 0.9), foundationFinish: 'matte', concealer: L(lift(tone, 0.24), 0.75), powder: L(lift(tone, 0.12), 0.6), contour: L('#2E1A12', 0.65), bronzer: L('#7A3E22', 0.4), blush: L('#A8424A', 0.35), highlight: L('#F0CF95', 0.7), eyeshadow: { color: '#4A2D20', amount: 0.8, shimmer: 0.35 }, innerCorner: L('#F6E2C0', 0.7), liner: L('#050505', 0.95), lowerLiner: L('#2A1A14', 0.35), mascara: 1, lipLiner: L('#3A1A16', 0.85), lipstick: L(mixHex(tone, '#8A4A3A', 0.65), 0.85), gloss: 0.35, setting: 0.6 }),
  },
  {
    id: 'frosted-lip',
    name: 'Frosted lip',
    blurb: 'Pearly frosted lips, soft shimmery lids, a cool sheen on top.',
    build: (tone) => nude({ foundation: L(tone, 0.45), concealer: L(lift(tone, 0.14), 0.4), blush: L('#C0605A', 0.2), highlight: L('#F4E4EC', 0.5), eyeshadow: { color: '#C8B8D8', amount: 0.45, shimmer: 0.85 }, innerCorner: L('#FFFFFF', 0.55), liner: L('#2A1A14', 0.2), mascara: 0.6, lipLiner: L(mixHex(tone, '#8A5A56', 0.5), 0.4), lipstick: L('#E2B8C0', 0.75), lipFinish: 'frost', gloss: 0.75 }),
  },
  {
    id: 'grunge',
    name: 'Grunge',
    blurb: 'Smudged black liner, lived-in smoke, a muted berry lip.',
    build: (tone) => nude({ foundation: L(tone, 0.4), foundationFinish: 'matte', concealer: L(lift(tone, 0.1), 0.3), contour: L('#2E1A16', 0.3), eyeshadow: { color: '#1A1414', amount: 0.75, shimmer: 0.05 }, liner: L('#050505', 0.9), lowerLiner: L('#0A0808', 0.85), mascara: 0.85, lipLiner: L('#2A0E14', 0.5), lipstick: L('#4A1A24', 0.7), lipFinish: 'matte', gloss: 0.1 }),
  },
  {
    id: 'floral',
    name: 'Floral',
    blurb: 'Rosy cheeks, petal-pink lids, soft shimmer like dew on flowers.',
    build: (tone) => nude({ primer: 0.4, foundation: L(tone, 0.4), foundationFinish: 'dewy', concealer: L(lift(tone, 0.14), 0.4), blush: L('#D07A8A', 0.55), highlight: L('#F6D7E0', 0.45), eyeshadow: { color: '#D47A9A', amount: 0.55, shimmer: 0.6 }, innerCorner: L('#FFE6F0', 0.6), liner: L('#3A1A20', 0.25), mascara: 0.6, lipstick: L('#C24E7A', 0.55), lipCentre: L('#E07AA6', 0.5), gloss: 0.65 }),
  },
  {
    id: 'douyin',
    name: 'Douyin',
    blurb: 'Aegyo-sal shine, pink under-eye blush, gradient lip.',
    build: (tone) => nude({ primer: 0.6, foundation: L(tone, 0.55), foundationFinish: 'dewy', concealer: L(lift(tone, 0.2), 0.5), blush: L('#E08A9A', 0.55), highlight: L('#FFF0F0', 0.55), eyeshadow: { color: '#E8A0A8', amount: 0.5, shimmer: 0.7 }, innerCorner: L('#FFFFFF', 0.7), liner: L('#3A2020', 0.45), lowerLiner: L('#B05A6A', 0.4), mascara: 0.9, lipstick: L(mixHex(tone, '#E0A0A0', 0.6), 0.35), lipCentre: L('#C0283A', 0.75), gloss: 0.8 }),
  },
  {
    id: 'y2k',
    name: 'Y2K',
    blurb: 'Frosty blue lids, thin brows energy, glossy brown-lined lip.',
    build: (tone) => nude({ foundation: L(tone, 0.5), concealer: L(lift(tone, 0.12), 0.35), bronzer: L('#8A4A2A', 0.35), highlight: L('#F4E4FF', 0.55), eyeshadow: { color: '#7FA8E8', amount: 0.65, shimmer: 0.9 }, innerCorner: L('#FFFFFF', 0.6), liner: L('#3A2A20', 0.3), mascara: 0.6, lipLiner: L('#4A2A20', 0.9), lipstick: L('#C89A8A', 0.55), lipFinish: 'gloss', gloss: 0.95 }),
  },
  {
    id: 'gothic',
    name: 'Gothic',
    blurb: 'Porcelain-matte base, deep smoky eye, black-cherry lip.',
    build: (tone) => nude({ primer: 0.5, foundation: L(tone, 0.7), foundationFinish: 'matte', powder: L(lift(tone, 0.06), 0.6), contour: L('#2A1416', 0.55), eyeshadow: { color: '#1A0A14', amount: 0.9, shimmer: 0.1 }, liner: L('#050505', 1), lowerLiner: L('#050505', 0.8), mascara: 1, lipLiner: L('#1A0408', 0.9), lipstick: L('#2A0410', 0.95), lipFinish: 'matte', gloss: 0.1 }),
  },
  {
    id: 'editorial',
    name: 'Editorial',
    blurb: 'Graphic cobalt lid, bare cheek, ink-stained lip.',
    build: (tone) => nude({ foundation: L(tone, 0.5), highlight: L('#F4E4CC', 0.55), eyeshadow: { color: '#1F3FB0', amount: 0.9, shimmer: 0.1 }, liner: L('#050505', 1), lowerLiner: L('#1F3FB0', 0.6), mascara: 0.7, lipstick: L('#3A0E1E', 0.9), gloss: 0.1 }),
  },
  {
    id: 'nightlife',
    name: 'Party glam',
    blurb: 'Plum smoke, wet shine, glitter on the high points.',
    build: (tone) => nude({ foundation: L(tone, 0.6), concealer: L(lift(tone, 0.15), 0.45), contour: L('#2E1A16', 0.55), blush: L('#8E2E5A', 0.3), highlight: L('#F6D7B0', 0.75), eyeshadow: { color: '#4A1846', amount: 0.85, shimmer: 0.9 }, innerCorner: L('#F6D7B0', 0.6), liner: L('#050505', 0.8), lowerLiner: L('#4A1846', 0.5), mascara: 0.9, lipLiner: L('#3A1424', 0.7), lipstick: L('#6A1E3E', 0.75), gloss: 0.95, setting: 0.7 }),
  },
  {
    id: 'bridal',
    name: 'Bridal glam',
    blurb: 'Flawless base, gold lid, defined wing, deep rose lip.',
    build: (tone) => nude({ primer: 0.7, foundation: L(tone, 0.75), concealer: L(lift(tone, 0.2), 0.6), powder: L(lift(tone, 0.08), 0.45), contour: L('#36201A', 0.5), blush: L('#B0505A', 0.35), highlight: L('#F0CF95', 0.6), eyeshadow: { color: '#B8862F', amount: 0.75, shimmer: 0.8 }, innerCorner: L('#F6E2B0', 0.65), liner: L('#0A0606', 0.85), lowerLiner: L('#2A1A14', 0.3), mascara: 1, lipLiner: L('#5A1E26', 0.75), lipstick: L('#8C2A3A', 0.85), gloss: 0.4, setting: 0.8 }),
  },
]

/* ------------------------------------------------------------------ characters */

export interface CharacterPreset {
  id: string
  name: string
  /** A short, witty one-liner (under ~15 words). */
  blurb: string
  look: StudioLook
}

interface CharacterPatch {
  tone: string
  undertone?: StudioLook['skin']['undertone']
  morphs?: Partial<Record<MorphId, number>>
  hair?: Partial<StudioLook['hair']>
  makeup?: string
  /** Lip colour over the look (dark lips, berry, nude). */
  lips?: string
  wear: Partial<Wear>
  extras?: Partial<Extras>
  tattoos?: Tattoo[]
  eyes?: StudioLook['eyes']['iris']
  brows?: Partial<StudioLook['brows']>
  height?: number
  mark?: StudioLook['skin']['mark']
  markAt?: StudioLook['skin']['markAt']
  jewellery?: Partial<StudioLook['jewellery']>
  nails?: Partial<StudioLook['nails']>
}

/** A piece in three colours. */
export const w = (id: string, p: string, s2 = p, a = s2): Worn => ({ id, colors: [p, s2, a] })

/**
 * Everyone who isn't fat gets long, slender, slightly toned limbs: lean thighs, arms and calves, a
 * little muscle tone, a slim neck, and a touch more height (longer legs). Curves (bust, hips,
 * glutes) are left as they are: they're who she is. Fat bodies keep their softness everywhere.
 */
export function leanLimbs(m: Partial<Record<MorphId, number>>): Partial<Record<MorphId, number>> {
  // men are the male base as built (only their weight and height change)
  if ((m.Softness ?? 0.5) >= 0.75 || (m.Masc ?? 0.5) >= 1) return m
  const masc = false
  const out = { ...m }
  out.Thighs = Math.min(out.Thighs ?? 0.5, masc ? 0.42 : 0.44)
  out.Arms = Math.min(out.Arms ?? 0.5, masc ? 0.46 : 0.4)
  out.Calves = Math.min(out.Calves ?? 0.5, 0.44)
  out.NeckFull = Math.min(out.NeckFull ?? 0.5, 0.46)
  out.Belly = Math.min(out.Belly ?? 0.5, 0.48)
  out.Muscle = Math.max(out.Muscle ?? 0.5, masc ? 0.6 : 0.56)
  return out
}

function character(id: string, name: string, blurb: string, patch: CharacterPatch): CharacterPreset {
  const tone = patch.tone
  const wear: Wear = { top: null, bottom: null, dress: null, shoes: null, ...patch.wear }
  if (wear.dress) wear.top = wear.bottom = null
  const look: StudioLook = {
    ...structuredClone(DEFAULT_LOOK),
    morphs: { ...neutralMorphs(), ...leanLimbs(patch.morphs ?? {}) },
    // long and slender (a little taller) unless fat
    // men: their own height on the male base; women long and slender (a little taller) unless fat
    height: (patch.morphs?.Masc ?? 0.5) >= 1 ? Math.min(MAX_HEIGHT, patch.height ?? 1.1) : Math.min(1.06, (patch.height ?? 1) * ((patch.morphs?.Softness ?? 0.5) >= 0.75 ? 1 : 1.02)),
    skin: { tone, undertone: patch.undertone ?? 'warm', glow: 0.35, mark: patch.mark ?? 'none', markAt: patch.markAt ?? 'cheekL' },
    eyes: { iris: patch.eyes ?? 'brown' },
    brows: { ...DEFAULT_LOOK.brows, ...patch.brows },
    hair: { ...structuredClone(DEFAULT_LOOK.hair), ...(patch.hair?.color && !patch.hair.tip ? { tip: patch.hair.color, preset: 'custom' } : {}), ...patch.hair },
    wear,
    extras: { ...DEFAULT_EXTRAS, ...patch.extras },
    tattoos: patch.tattoos ?? [],
    jewellery: { ...DEFAULT_LOOK.jewellery, ...patch.jewellery },
    nails: { ...DEFAULT_LOOK.nails, ...patch.nails },
    profile: { name, starter: id, onboarded: false },
  }
  // Every starting doll is bare-faced: natural skin, no makeup. Makeup only exists once the
  // player applies it in the Glam Studio.
  look.makeup = structuredClone(DEFAULT_MAKEUP)
  if (patch.makeup) look.makeup = MAKEUP_PRESETS.find((p) => p.id === patch.makeup)!.build(tone)
  if (patch.lips) look.makeup.lipstick = { color: patch.lips, amount: Math.max(look.makeup.lipstick.amount, 0.8) }
  return { id, name, blurb, look }
}

/* ------------------------------------------------------------------ body types */

/**
 * Body types as morph recipes. Plus-size bodies carry their weight the way real bodies do: softer
 * everywhere (Softness), a fuller belly, hips, thighs, upper and lower arms, calves, neck and face,
 * all at once, never just one part. Limb LENGTH never changes with weight (the build keeps every
 * body on the same skeleton); only height scales it.
 */
export const BODY_TYPES = {
  slim: { Softness: 0.2, Waist: 0.36, Hips: 0.4, Thighs: 0.36, Arms: 0.35, Bust: 0.38, Calves: 0.4, Belly: 0.38 },
  athletic: { Softness: 0.28, Muscle: 0.68, Shoulders: 0.58, Waist: 0.42, Thighs: 0.56, Glutes: 0.6, Arms: 0.48, Calves: 0.58 },
  average: { Softness: 0.5, Belly: 0.52, Hips: 0.54, Thighs: 0.52 },
  curvy: { Softness: 0.62, Bust: 0.72, Waist: 0.46, Hips: 0.84, Glutes: 0.84, Thighs: 0.78, Arms: 0.6, Calves: 0.6, Belly: 0.52 },
  plus: { Softness: 0.86, Belly: 0.8, Waist: 0.74, Hips: 0.86, Glutes: 0.8, Thighs: 0.86, Arms: 0.84, Calves: 0.76, Bust: 0.8, NeckFull: 0.6, FaceFull: 0.66, Cheeks: 0.66 },
  superPlus: { Softness: 0.98, Belly: 0.94, Waist: 0.86, Hips: 0.92, Glutes: 0.86, Thighs: 0.94, Arms: 0.95, Calves: 0.86, Bust: 0.86, NeckFull: 0.8, FaceFull: 0.8, Cheeks: 0.76 },
} satisfies Record<string, Partial<Record<MorphId, number>>>
export type BodyType = keyof typeof BODY_TYPES

/** Weight-carrying morphs a slimmer frame takes down (bust and shape sliders stay as asked). */
const WEIGHT: MorphId[] = ['Softness', 'Belly', 'Waist', 'Hips', 'Glutes', 'Thighs', 'Arms', 'Calves', 'NeckFull', 'FaceFull', 'Cheeks']
/** Women's bodies read slimmer overall: every weight morph a notch down (plus-size stays plus-size). */
function slimmer(m: Partial<Record<MorphId, number>>, k = 0.08) {
  const out = { ...m }
  for (const id of WEIGHT) if (out[id] !== undefined) out[id] = Math.max(0.18, out[id]! - k)
  return out
}
const body = (t: BodyType, extra: Partial<Record<MorphId, number>> = {}) => slimmer({ ...BODY_TYPES[t], ...extra }, t === 'plus' || t === 'superPlus' ? 0.04 : 0.08)
/**
 * Men: every man IS the male base body (base_male.blend: broad shoulders, a straight back, a flat,
 * toned stomach, a male chest, full legs, proportionate hands), built as Masc_Pos in the character
 * build. Only two things change between men: height (look.height) and weight (MascSoft, measured on
 * the male base itself: lean 0 .. base 0.5 .. heavy 1). Every female body slider stays neutral, so
 * nothing from the female base (bust, hips, her fat or muscle) is layered onto a man. Face sliders
 * are per man, passed in `face`.
 */
export const MALE_WEIGHT: Record<BodyType, number> = { slim: 0.2, athletic: 0.38, average: 0.5, curvy: 0.6, plus: 0.8, superPlus: 0.95 }
export const MALE_HEIGHT: Record<BodyType, number> = { slim: 1.1, athletic: 1.11, average: 1.1, curvy: 1.09, plus: 1.1, superPlus: 1.09 }
const male = (t: BodyType, face: Partial<Record<MorphId, number>> = {}) => {
  const out: Partial<Record<MorphId, number>> = { ...face, Masc: 1, MascSoft: MALE_WEIGHT[t] }
  return out
}

/**
 * The sixteen starting dolls: a cast players can see themselves in. Three quarters of them are
 * average, curvy or properly plus-size, across Black, white, East Asian, South Asian, Latina and
 * mixed heritage; the rest are slim or athletic. Feminine, androgynous and masculine presentation,
 * glasses, a birthmark, a mole, freckles and vitiligo, and every hair family. All bare-faced.
 * Names are characters in the game, not real people.
 */
export const CHARACTER_PRESETS: CharacterPreset[] = [
  character('amaka', 'Amaka', 'Praying for a traditional man. Loves cooking (the egusi is already on).', {
    tone: '#613B28',
    morphs: body('plus', { NoseWidth: 0.64, Lips: 0.68 }),
    hair: { style: 'bun', color: '#141010' },
    wear: { dress: w('dress_velvet_mini', '#0B0B0E', '#C9A04A', '#E4572E'), shoes: w('shoes_beaded_sandals', '#C9A04A', '#5A3A22', '#E4572E') },
    extras: { held: 'whip', head: 'coralBand', coralBeads: true, coralWrists: true, anklets: true, color: '#D9452B' },
    jewellery: { ears: 'drops' },
    height: 0.98,
  }),
  character('ifeoma', 'Ifeoma', 'Dance-floor regular, devoted cat mum, smokes way too much weed.', {
    tone: '#33201A',
    undertone: 'cool',
    morphs: body('curvy', { Softness: 0.66, Bust: 0.74, Hips: 0.86, Glutes: 0.88, Thighs: 0.8, NoseWidth: 0.7, Lips: 0.74, FaceFull: 0.58 }),
    hair: { style: 'afro_fringe', color: '#0A0A0C' },
    // a green bandeau from Dope by Fabby with long, baggy wide-leg trousers
    wear: { top: w('top_bandeau', '#0B6E4F', '#0E8A63', '#D9B35B'), bottom: w('bottom_wide_trousers', '#E8DCC6', '#D9C9AE', '#C9A04A'), shoes: w('shoes_strappy', '#D9B35B', '#3A2A1A', '#D9B35B') },
    extras: { held: 'joint' },
    jewellery: { ears: 'drops', wrist: 'bangle' },
  }),
  character('grace', 'Grace', 'Sometimes you just have to accept it.', {
    tone: '#F3DDCB',
    undertone: 'cool',
    // soft, feminine face: a narrow, rounded jaw and a small chin
    morphs: body('average', { Pregnant: 1, Bust: 0.66, Lips: 0.62, NoseWidth: 0.46, Jaw: 0.34, Chin: 0.38, ChinWidth: 0.36, Cheeks: 0.58, Cheekbones: 0.58, EyeSize: 0.56, FaceLength: 0.46 }),
    hair: { style: 'long01', color: '#D8B477', tip: '#EBD3A0', blend: 0.5, preset: 'custom' },
    eyes: 'grey',
    brows: { color: '#8A6A44' },
    // a long, fully covered lilac maxi dress with proper straps
    wear: { dress: w('dress_maxi', '#B9A2D8', '#E8DDF4', '#FFFFFF'), shoes: w('shoes_block_heels', '#E8DDF4', '#2A1A14', '#D9B35B') },
    tattoos: [
      { design: 'rose', at: 'forearmL', ink: '#1A1A22', size: 1.1 },
      { design: 'swallow', at: 'neckSideR', ink: '#1A1A22', size: 0.8 },
      { design: 'script', at: 'wristR', ink: '#1A1A22', size: 0.8 },
      { design: 'butterfly', at: 'ankleL', ink: '#1A1A22', size: 0.8 },
    ],
    jewellery: { ears: 'studs' },
  }),
  character('mei', 'Mei', 'Baddie by day, baddie by night.', {
    tone: '#B57E57',
    undertone: 'warm',
    morphs: body('curvy', { Waist: 0.36, Bust: 0.66, EyeSize: 0.42, EyeOpen: 0.38, NoseBridge: 0.36, NoseWidth: 0.42, Lips: 0.56, FaceLength: 0.46 }),
    // long sleek wig; its closure/part takes her skin tone (hairMaterial PARTED)
    hair: { style: 'long01', color: '#0A0A0C' },
    // the all-black baddie two-piece: a tight square-neck crop and a very short skirt
    wear: { top: w('top_square_crop', '#0B0B0E', '#1A1A1E', '#D9B35B'), bottom: w('bottom_micro_skirt', '#0B0B0E', '#1A1A1E', '#D9B35B'), shoes: w('shoes_pumps', '#0B0B0E', '#2A1A14', '#0B0B0E') },
    extras: { held: 'phone' },
    jewellery: { ears: 'hoops' },
    nails: { color: '#E0457B', amount: 1, shape: 'coffin', length: 0.9 },
    height: 0.98,
  }),
  character('sofia', 'Sofia', 'Loctician, very chill, loves weekends and her dogs.', {
    tone: '#C0916E',
    undertone: 'warm',
    morphs: body('curvy', { Lips: 0.66, CupidsBow: 0.62, NoseBridge: 0.46, Cheekbones: 0.64, Glutes: 0.9, Hips: 0.92 }),
    hair: { style: 'wavy_wig', color: '#3A2418' },
    mark: 'mole',
    markAt: 'lipCornerL',
    wear: { top: w('top_crop_tank', '#1F4FA8', '#F28C28', '#0E1A33'), bottom: w('bottom_skinny_jeans', '#2E3D5C', '#D8A04A', '#B8B8B8'), shoes: w('shoes_mules', '#F28C28', '#2A1A14', '#F28C28') },
    jewellery: { ears: 'hoops', necklace: 'pendant' },
  }),
  character('chloe', 'Chloe', 'Down to earth, loves her farmhouse, wondering if one of her chickens is infertile.', {
    tone: '#E9D0B7',
    undertone: 'neutral',
    morphs: body('average', { Bust: 0.44, Softness: 0.56, NoseTip: 0.62, NoseWidth: 0.46, Lips: 0.48, Cheeks: 0.6, FaceFull: 0.54 }),
    hair: { style: 'ponytail01', color: '#B5552A', preset: 'ginger' },
    mark: 'freckles',
    eyes: 'green',
    brows: { color: '#7A4A2A' },
    // denim overalls over a dirty white tee (an off-white that's seen a day in the yard)
    wear: { top: w('top_everyday_tee', '#E6DFCC', '#CFC4A8', '#B9AC8C'), bottom: w('bottom_overalls', '#5B7FA8', '#D8A04A', '#C9A04A'), shoes: w('shoes01', '#FFFFFF') },
  }),
  character('priya', 'Priya', 'Corset tight, schedule tighter. Her cat-eye could end an argument.', {
    tone: '#9C6B4A',
    undertone: 'warm',
    morphs: body('average', { Hips: 0.64, Bust: 0.64, EyeSize: 0.62, NoseBridge: 0.58, NoseLength: 0.56, Lips: 0.56, FaceLength: 0.56 }),
    hair: { style: 'bun', color: '#141010' },
    wear: { top: w('top_corset', '#E9A6B6', '#D9B35B', '#7A1F2B'), bottom: w('bottom_satin_mini', '#111111', '#D9B35B', '#FFFFFF'), shoes: w('shoes_pumps', '#111111', '#2A1A14', '#111111') },
    jewellery: { nose: 'stud', ears: 'drops', glasses: 'square', frame: '#7A1F2B' },
  }),
  character('zara', 'Zara', 'Plays bass badly, loudly and proudly.', {
    tone: '#B78764',
    undertone: 'olive',
    morphs: body('average', { EyeSize: 0.6, NoseTip: 0.58, Lips: 0.64, Cheekbones: 0.6 }),
    hair: { style: 'afro_puffs', color: '#5E1A26', preset: 'burgundy' },
    mark: 'birthmark',
    markAt: 'templeR',
    eyes: 'brownlight',
    wear: { top: w('top_crop_tee', '#6E6E72', '#141414', '#F2C14E'), bottom: w('bottom_ripped_jeans', '#141414', '#D8A04A', '#B8B8B8'), shoes: w('shoes_heel_boots', '#141414', '#141414', '#8A8A8A') },
    jewellery: { ears: 'huggies', industrial: true },
    extras: { chains: true },
  }),
  character('nala', 'Nala', 'Adire collector, slam poet, will correct your pronunciation. Lovingly.', {
    tone: '#744A33',
    morphs: body('curvy', { Softness: 0.56, EyeSize: 0.58, Lips: 0.6, Cheeks: 0.58 }),
    // a fuller, longer curly/wavy black wig
    hair: { style: 'long_curls', color: '#0A0A0C' },
    mark: 'vitiligo',
    wear: { top: w('top_buba', '#F2C14E', '#2A5DB0', '#FFFFFF'), bottom: w('bottom_iro', '#2A5DB0', '#F2C14E', '#FFFFFF'), shoes: w('shoes_block_heels', '#D9B35B', '#2A1A14', '#D9B35B') },
    jewellery: { ears: 'drops', wrist: 'bangle' },
    extras: { waistBeads: true, color: '#E4572E' },
  }),
  character('tobi', 'Tobi', 'Dad jokes on tap, cries at every single wedding.', {
    tone: '#45291D',
    morphs: male('average', { Jaw: 0.66, Chin: 0.58, NoseWidth: 0.66, Lips: 0.6, Brows: 0.44 }),
    hair: { style: 'locs', color: '#0E0B0B' },
    wear: { top: w('top_oversized_tee', '#1E5A4A', '#EDE8DD', '#F2C14E'), bottom: w('bottom_cargo', '#3A3A2E', '#2A2A22', '#B8B8B8'), shoes: w('shoes05', '#FFFFFF') },
    jewellery: { glasses: 'round', frame: '#0C0808', rings: true },
    tattoos: [{ design: 'band', at: 'upperArmR', ink: '#1A1A22', size: 1.2 }],
    brows: { shape: 'eyebrow003', color: '#0C0808' },
    height: 1.11,
  }),
  character('bibi', 'Bibi', 'Happy-go-lucky trend chaser. Runs on vibes and matcha.', {
    tone: '#583524',
    morphs: body('curvy', { NoseWidth: 0.6, Lips: 0.66, Cheekbones: 0.62, EyeSize: 0.56 }),
    // dark green bantu knots
    hair: { style: 'bantu_knots', color: '#123D24', tip: '#123D24', blend: 0, preset: 'custom' },
    // a small yellow butterfly on a red crop tank, baggy jeans
    wear: { top: w('top_crop_tank', '#C8102E', '#FFC72C', '#2A1200'), bottom: w('bottom_baggy_jeans', '#7FA3C9', '#D8A04A', '#B8B8B8'), shoes: w('shoes05', '#FFFFFF') },
    extras: { held: 'matcha' },
    jewellery: { ears: 'hoops', navel: true },
  }),
  character('femi', 'Femi', 'Built like a wardrobe, soft as a pillow. Fixes everything except his love life.', {
    tone: '#2B1A14',
    undertone: 'cool',
    morphs: male('plus', { Jaw: 0.7, Chin: 0.62, NoseWidth: 0.7, Lips: 0.66 }),
    hair: { style: 'cornrows', color: '#0A0A0C' },
    // a sporty three-stripe tracksuit
    wear: { top: w('top_track_jacket', '#141E3C', '#FFFFFF', '#E8E8E8'), bottom: w('bottom_track_pants', '#141E3C', '#FFFFFF', '#E8E8E8'), shoes: w('shoes05', '#FFFFFF') },
    brows: { shape: 'eyebrow008' },
    height: 1.12,
  }),
  character('chidi', 'Chidi', 'Suit on, sunnies on, invoice ready. Allergic to being underdressed.', {
    tone: '#7E5238',
    morphs: male('average', { Jaw: 0.64, Chin: 0.6, NoseWidth: 0.58, Lips: 0.6 }),
    hair: { style: 'afro_short', color: '#0A0A0C' },
    // a tailored two-piece suit over a crisp shirt
    wear: { top: w('top_suit_jacket', '#1E2740', '#F4F4F2', '#5A6E9A'), bottom: w('bottom_suit_trousers', '#1E2740', '#F4F4F2', '#5A6E9A'), shoes: w('shoes03', '#FFFFFF') },
    jewellery: { glasses: 'sunnies', frame: '#0C0808', rings: true },
    height: 1.11,
  }),
  character('lola', 'Lola', 'Five a.m. runs, protein in everything, a playlist that genuinely slaps.', {
    tone: '#4E2F20',
    morphs: body('slim', { Muscle: 0.6, NoseWidth: 0.58, Lips: 0.62, EyeSize: 0.56 }),
    // Doechii-inspired sculpted swirl cornrows
    hair: { style: 'doechii_cornrows', color: '#141010' },
    wear: { top: w('top_sports_bra', '#111111', '#E63946', '#FFFFFF'), bottom: w('bottom_leggings', '#111111', '#E63946', '#FFFFFF'), shoes: w('shoes05', '#FFFFFF') },
    jewellery: { navel: true, ears: 'studs' },
    height: 1.03,
  }),
  character('jiwoo', 'Ji-woo', 'Fluent in sarcasm. Owns nine black tees, all different, apparently.', {
    tone: '#DDBB9C',
    undertone: 'neutral',
    morphs: male('slim', { EyeOpen: 0.4, EyeSize: 0.46, NoseWidth: 0.42, Lips: 0.5, Jaw: 0.56 }),
    hair: { style: 'pixie', color: '#141010', tip: '#1E7A7A', blend: 0.6, preset: 'custom' },
    wear: { top: w('top_oversized_tee', '#232323', '#EDE8DD', '#E63946'), bottom: w('bottom_ripped_jeans', '#7FA3C9', '#D8A04A', '#B8B8B8'), shoes: w('shoes04', '#FFFFFF') },
    jewellery: { ears: 'huggies', helix: true, industrial: true },
    height: 1.07,
  }),
  character('kemi', 'Kemi', 'Walks like a runway, trains like a fighter, texts back like a ghost.', {
    tone: '#C0916E',
    undertone: 'olive',
    morphs: body('athletic', { EyeSize: 0.55, Lips: 0.62, Chin: 0.58, Jaw: 0.6 }),
    hair: { style: 'none', crop: 0.85, color: '#2A1A12' },
    eyes: 'brownlight',
    wear: { top: w('top_tank', '#F2A0B8', '#FFFFFF', '#FFFFFF'), bottom: w('bottom_cargo', '#E9E1D2', '#C9B79A', '#B8B8B8'), shoes: w('shoes06', '#FFFFFF') },
    height: 1.05,
    jewellery: { ears: 'studs', nose: 'ring' },
  }),
  // ---- the new five
  character('bambi', 'Bambi', 'Flip-phone energy, glitter on everything, still waiting on her power top.', {
    tone: '#C89B78',
    undertone: 'warm',
    morphs: body('slim', { Bust: 0.5, EyeSize: 0.6, Lips: 0.62, NoseTip: 0.6 }),
    hair: { style: 'two_braids', color: '#E6DCC8', tip: '#F2A7BF', blend: 0.6, preset: 'custom' },
    wear: { top: w('top_baby_tee', '#F7C6D9', '#E0457B', '#FFFFFF'), bottom: w('bottom_pleated_mini', '#B9A2D8', '#FFFFFF', '#FFFFFF'), shoes: w('shoes_platforms', '#F2A7BF', '#FFFFFF', '#F2A7BF') },
    jewellery: { ears: 'hoops', navel: true, metal: 'silver' },
    nails: { color: '#F2A7BF', amount: 1, shape: 'square', length: 0.5, art: 'french', gems: true },
  }),
  character('jayden', 'Jayden', 'Frosted tips, flame tee, burns you a mixtape whether you asked or not.', {
    tone: '#88593D',
    morphs: male('plus', { Jaw: 0.6, Chin: 0.56, Lips: 0.56 }),
    hair: { style: 'short02', color: '#2A1A12', tip: '#F1E0B8', blend: 0.75, preset: 'custom' },
    wear: { top: w('top_flame_tee', '#111111', '#FF6A00', '#FFD23F'), bottom: w('bottom_cargo', '#7FA3C9', '#2A2A22', '#B8B8B8'), shoes: w('shoes05', '#FFFFFF') },
    jewellery: { ears: 'studs', metal: 'silver' },
    extras: { chains: true },
    height: 1.1,
  }),
  character('elias', 'Elias', 'Writes poetry about rain. Smiled once, in 2019, by accident.', {
    tone: '#EFDAC5',
    undertone: 'cool',
    morphs: male('slim', { Jaw: 0.62, Cheekbones: 0.64, Lips: 0.52, EyeOpen: 0.4 }),
    hair: { style: 'long01', color: '#0A0A0C' },
    eyes: 'grey',
    wear: { top: w('top_mesh', '#0B0B0E', '#0B0B0E', '#5E1A26'), bottom: w('bottom_ripped_jeans', '#1A1A1E', '#3A3A3E', '#8A8A8A'), shoes: w('shoes04', '#FFFFFF') },
    jewellery: { necklace: 'choker', lip: 'snakebites', industrial: true, metal: 'silver', rings: true },
    nails: { color: '#0B0B0E', amount: 1 },
    tattoos: [
      { design: 'dagger', at: 'forearmL', ink: '#141418', size: 1.1 },
      { design: 'snake', at: 'forearmR', ink: '#141418', size: 1.1 },
      { design: 'moon', at: 'nape', ink: '#141418', size: 0.8 },
    ],
    height: 1.1,
  }),
  character('remi', 'Remi', 'Lends you her hoodie, steals your girl, fixes your bike after.', {
    tone: '#6B4430',
    morphs: body('athletic', { Masc: 0.66, Bust: 0.34, Jaw: 0.6, Shoulders: 0.62, Lips: 0.58 }),
    // short black locs
    hair: { style: 'short_locs', color: '#0A0A0C' },
    wear: { top: w('top_oversized_tee', '#EDE8DD', '#232323', '#E63946'), bottom: w('bottom_cargo', '#4A5A3A', '#2A2A22', '#B8B8B8'), shoes: w('shoes02', '#FFFFFF') },
    jewellery: { septum: true, ears: 'huggies', metal: 'silver' },
    extras: { chains: true },
    tattoos: [{ design: 'sun', at: 'upperArmL', ink: '#1A1A22', size: 1.1 }],
    height: 1.03,
  }),
  character('candi', 'Candi', 'Pink is a personality. Bossy in the streets, power bottom in the sheets.', {
    tone: '#A57452',
    undertone: 'warm',
    morphs: body('curvy', { Lips: 0.66, EyeSize: 0.58, Cheekbones: 0.6 }),
    hair: { style: 'bob02', color: '#F2A7BF', tip: '#E0457B', blend: 0.4, preset: 'custom' },
    wear: { top: w('top_corset', '#F2A7BF', '#E0457B', '#FFFFFF'), bottom: w('bottom_pleated_mini', '#E0457B', '#F2A7BF', '#FFFFFF'), shoes: w('shoes_platforms', '#E0457B', '#F2A7BF', '#E0457B') },
    extras: { pins: true, glassesChain: true },
    jewellery: { glasses: 'square', frame: '#E0457B', ears: 'hoops', metal: 'rose' },
    nails: { color: '#E0457B', amount: 1, shape: 'almond', length: 0.55, gems: true },
  }),
]

// The heels rule: everyone in a dress or a skirt wears heels (checked in tests too).
for (const p of CHARACTER_PRESETS) if (needsHeels(p.look.wear) && !HEELS.includes(p.look.wear.shoes?.id ?? '')) throw new Error(`${p.name} wears a dress or skirt without heels`)

/* ------------------------------------------------------------------ random doll */

/** Colourways the random doll draws from: [primary, secondary, accent]. */
const COLOURWAYS: [string, string, string][] = [
  ['#C8102E', '#FFC72C', '#2A1200'],
  ['#2E8B57', '#FFC72C', '#10301E'],
  ['#1F4FA8', '#F28C28', '#0E1A33'],
  ['#E07AA6', '#6A3FB0', '#FFFFFF'],
  ['#C8102E', '#2E8B57', '#F4EFE6'],
  ['#111111', '#D9B35B', '#FFFFFF'],
  ['#F4EFE6', '#2A2A2A', '#C9A04A'],
  ['#6FA36B', '#F6D7E3', '#FFFFFF'],
]

function randomWear(r: () => number, pieces: { id: string; slot: string; colors: string[] }[], masc: boolean): Wear {
  const pick = <T,>(a: readonly T[]) => a[Math.floor(r() * a.length) % a.length]
  const of = (slot: string, ok: (id: string) => boolean = () => true) => pieces.filter((p) => p.slot === slot && ok(p.id))
  const femme = (id: string) => !masc || !/(skirt|mini|dress|bralette|corset|bandeau|cami|lace|sports_bra|iro|crop_tank|baby_tee)/.test(id)
  const colour = (p: { id: string; colors: string[] }): Worn => {
    const c = r() < 0.45 ? pick(COLOURWAYS) : (p.colors as [string, string, string])
    return { id: p.id, colors: [c[0], c[1], c[2]] }
  }
  const wear: Wear = { top: null, bottom: null, dress: null, shoes: null }
  const dresses = of('dress', (id) => id.startsWith('dress_') && femme(id))
  if (dresses.length && r() < 0.25) wear.dress = colour(pick(dresses))
  else {
    const tops = of('top', femme)
    const bottoms = of('bottom', femme)
    if (tops.length) wear.top = colour(pick(tops))
    if (bottoms.length) wear.bottom = colour(pick(bottoms))
  }
  const heels = of('shoes', (id) => HEELS.includes(id))
  const flats = of('shoes', (id) => !HEELS.includes(id))
  const shoes = needsHeels(wear) ? heels : masc ? flats : [...flats, ...heels]
  if (shoes.length) wear.shoes = colour(pick(shoes))
  return wear
}

/** A tiny deterministic generator so a seed always rebuilds the same doll. */
function rng(seed: number) {
  let a = seed >>> 0 || 1
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const NAMES = ['Adaeze', 'Tolu', 'Simi', 'Ngozi', 'Yemi', 'Kiki', 'Eniola', 'Bisi', 'Funmi', 'Ama', 'Esi', 'Wanjiru', 'Zainab', 'Hauwa', 'Rosa', 'Lucia', 'Inés', 'Aiko', 'Yuna', 'Lin', 'Anika', 'Meera', 'Leila', 'Noor', 'Ivy', 'Maya', 'Elle', 'Nina', 'Tara', 'Jade', 'Kai', 'Remi', 'Dami', 'Seun', 'Uche', 'Kwame', 'Leo', 'Theo', 'Malik', 'Ravi', 'Jun', 'Sol']
const NATURAL_HAIR = ['#0A0A0C', '#141010', '#2A1A12', '#3A2418', '#5A3A22', '#6B3A22', '#8A5A30', '#B5552A', '#C9A06A', '#E6DCC8']
const FUN_HAIR = ['#5E1A26', '#E07AA6', '#1E7A7A', '#6A3FB0', '#2D5BD0', '#C24E2A']
const EYES_BY_DEPTH = { deep: ['brown', 'brown', 'brownlight'], mid: ['brown', 'brownlight', 'green', 'grey'], light: ['brownlight', 'green', 'grey', 'bluegreen', 'brown'] } as const

/** Witty one-liners for a random doll, by build (all work for anyone). */
const QUIPS: Record<Exclude<BodyType, 'superPlus'>, string[]> = {
  slim: ['Lives on iced coffee and unread voice notes.', 'Says “one drink” and means the whole night.', 'Has a group chat for every mood.'],
  athletic: ['Leg day every day, emotionally and physically.', 'Will race you to the bus stop. And win.', 'Protein shake in one hand, gossip in the other.'],
  average: ['Knows a guy for everything. Literally everything.', 'Main character energy, side quest budget.', 'Always the one holding everyone’s bags.'],
  curvy: ['Fashionably late, unfashionably honest.', 'Hips that hold opinions and a phone that never dies.', 'Brings snacks to every function, uninvited.'],
  plus: ['Big body, bigger laugh, the life of every party.', 'Thick, thriving and three drinks into the group chat.', 'Gives the best hugs in the scene. Ask anyone.'],
}

/**
 * A complete, ready-to-play new doll from a large pool: any skin tone and undertone, a face made
 * from every facial slider, any body type with plus-size weighted in (about four in ten), adult
 * heights, any presentation, any hairstyle and colour the catalog has built, an outfit and shoes,
 * sometimes glasses or a skin mark. Bare-faced, like every starting doll.
 */
export function randomDoll(seed: number, available: { hair: string[]; pieces: { id: string; slot: string; colors: string[] }[] }): CharacterPreset {
  const r = rng(seed)
  const pick = <T,>(a: readonly T[]) => a[Math.floor(r() * a.length) % a.length]
  const near = (c = 0.5, spread = 0.22) => Math.min(1, Math.max(0, c + (r() - 0.5) * 2 * spread))
  const toneIdx = Math.floor(r() * SKIN_TONES.length)
  const tone = SKIN_TONES[toneIdx]
  const depth = toneIdx < 9 ? 'deep' : toneIdx < 17 ? 'mid' : 'light'
  // about four in ten are plus-size (fat), men and women alike
  const types: BodyType[] = ['slim', 'athletic', 'average', 'average', 'curvy', 'curvy', 'plus', 'plus', 'superPlus', 'plus']
  const type = pick(types)
  const masc = r() < 0.3 ? 1 : r() < 0.12 ? 0.75 : 0.5
  const fat = type === 'plus' || type === 'superPlus'
  // men are built on the male base (straight back, lean thighs, flat chest); women slimmer overall
  const morphs: Partial<Record<MorphId, number>> = masc >= 1 ? male(type) : fat ? { ...BODY_TYPES[type] } : slimmer({ ...BODY_TYPES[type] })
  for (const m of ['NoseWidth', 'NoseBridge', 'NoseTip', 'NoseLength', 'Lips', 'LipWidth', 'CupidsBow', 'Jaw', 'Chin', 'ChinWidth', 'Cheekbones', 'Cheeks', 'EyeSize', 'EyeSpacing', 'EyeOpen', 'Brows', 'BrowAngle', 'FaceLength'] as MorphId[]) morphs[m] = near(0.5, 0.2)
  if (morphs.FaceFull === undefined) morphs.FaceFull = near(0.5, 0.15)
  morphs.Masc = masc
  if (masc > 0.5) {
    morphs.Jaw = near(0.64, 0.08)
    if (masc < 1) {
      morphs.Shoulders = near(0.62, 0.08)
      morphs.Bust = Math.min(morphs.Bust ?? 0.5, 0.3)
    }
  }
  const hairs = available.hair.filter((h) => h !== 'bonnet')
  const style = r() < 0.05 ? 'none' : pick(hairs)
  const fun = r() < 0.18
  const color = fun ? pick(FUN_HAIR) : depth === 'deep' ? pick(NATURAL_HAIR.slice(0, 5)) : pick(NATURAL_HAIR)
  const tip = r() < 0.2 ? pick([...FUN_HAIR, '#C9A06A', '#E6DCC8']) : color
  const marks: StudioLook['skin']['mark'][] = ['none', 'none', 'none', 'none', 'none', 'freckles', 'mole', 'birthmark', 'vitiligo']
  const name = pick(NAMES)
  const preset = character(`random-${seed.toString(36)}`, name, pick(QUIPS[type === 'superPlus' ? 'plus' : type]), {
    tone,
    undertone: pick(['cool', 'neutral', 'warm', 'olive'] as const),
    morphs,
    hair: { style: style as StudioLook['hair']['style'], color, tip, blend: tip !== color ? 0.5 : 0, preset: 'custom', crop: 0.7 },
    wear: randomWear(r, available.pieces, masc > 0.5),
    eyes: pick(EYES_BY_DEPTH[depth]),
    brows: { color: depth === 'light' && r() < 0.4 ? '#6B4A2A' : '#140D0B' },
    height: masc >= 1 ? MALE_HEIGHT[type] - 0.04 + r() * 0.08 : masc > 0.5 ? 1.02 + r() * 0.04 : 0.95 + r() * 0.08,
    mark: pick(marks),
    markAt: pick(['cheekL', 'cheekR', 'lipCornerL', 'templeR', 'jawL'] as const),
    jewellery: r() < 0.16 ? { glasses: pick(['round', 'square'] as const), frame: pick(['#1A1416', '#7A1F2B', '#C9A06A', '#2A3A6A']) } : { ears: pick(['none', 'studs', 'hoops', 'huggies'] as const) },
  })
  preset.look.profile.starter = 'random'
  return preset
}

/** The doll the game opens on: Bibi (she sits in the middle of the lineup, 11th). */
export const DEFAULT_PRESET = CHARACTER_PRESETS.find((p) => p.id === 'bibi')!
