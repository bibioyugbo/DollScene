import { DEFAULT_LOOK, DEFAULT_MAKEUP, neutralMorphs, type Makeup, type MorphId, type StudioLook } from './look'

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
  outfit?: StudioLook['outfit']['id']
  dye?: string
  shoes?: StudioLook['shoes']['id']
  eyes?: StudioLook['eyes']['iris']
  brows?: Partial<StudioLook['brows']>
  height?: number
  mark?: StudioLook['skin']['mark']
  markAt?: StudioLook['skin']['markAt']
  jewellery?: Partial<StudioLook['jewellery']>
  nails?: Partial<StudioLook['nails']>
}

function character(id: string, name: string, blurb: string, patch: CharacterPatch): CharacterPreset {
  const tone = patch.tone
  const look: StudioLook = {
    ...structuredClone(DEFAULT_LOOK),
    morphs: { ...neutralMorphs(), ...patch.morphs },
    height: patch.height ?? 1,
    skin: { tone, undertone: patch.undertone ?? 'warm', glow: 0.35, mark: patch.mark ?? 'none', markAt: patch.markAt ?? 'cheekL' },
    eyes: { iris: patch.eyes ?? 'brown' },
    brows: { ...DEFAULT_LOOK.brows, ...patch.brows },
    hair: { ...structuredClone(DEFAULT_LOOK.hair), ...(patch.hair?.color && !patch.hair.tip ? { tip: patch.hair.color, preset: 'custom' } : {}), ...patch.hair },
    outfit: { id: patch.outfit ?? DEFAULT_LOOK.outfit.id, dye: patch.dye ?? '#FFFFFF', dyeAmount: patch.dye ? 0.75 : 0 },
    shoes: { id: patch.shoes ?? DEFAULT_LOOK.shoes.id },
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

const body = (t: BodyType, extra: Partial<Record<MorphId, number>> = {}) => ({ ...BODY_TYPES[t], ...extra })

/**
 * The sixteen starting dolls: a cast players can see themselves in. Three quarters of them are
 * average, curvy or properly plus-size, across Black, white, East Asian, South Asian, Latina and
 * mixed heritage; the rest are slim or athletic. Feminine, androgynous and masculine presentation,
 * glasses, a birthmark, a mole, freckles and vitiligo, and every hair family. All bare-faced.
 * Names are characters in the game, not real people.
 */
export const CHARACTER_PRESETS: CharacterPreset[] = [
  character('bibi', 'Bibi', 'Microlocs, curves for days and a red butterfly tank.', { tone: '#583524', morphs: body('curvy', { NoseWidth: 0.6, Lips: 0.66, Cheekbones: 0.62, EyeSize: 0.56 }), hair: { style: 'microlocs', color: '#120D0B' }, outfit: 'kai_butterfly_red', shoes: 'shoes01', jewellery: { ears: 'hoops' } }),
  character('amaka', 'Amaka', 'Two braided ponytails, plus-size and pure warmth.', { tone: '#613B28', morphs: body('superPlus', { NoseWidth: 0.64, Lips: 0.68 }), hair: { style: 'two_braids', color: '#141010' }, outfit: 'deeji_ankara_set', shoes: 'shoes03', height: 0.97 }),
  character('ifeoma', 'Ifeoma', 'A big puffy afro, thick and proud of it.', { tone: '#33201A', undertone: 'cool', morphs: body('curvy', { Softness: 0.72, Bust: 0.82, Hips: 0.9, Glutes: 0.92, Thighs: 0.86, NoseWidth: 0.7, Lips: 0.74, FaceFull: 0.62 }), hair: { style: 'afro_big', color: '#0A0A0C' }, outfit: 'dbf_sequin_mini', shoes: 'shoes06', jewellery: { ears: 'drops' } }),
  character('grace', 'Grace', 'Platinum bob, plus-size, lilac satin.', { tone: '#E3C5A9', undertone: 'cool', morphs: body('plus', { Lips: 0.56, NoseWidth: 0.52 }), hair: { style: 'bob02', color: '#E6DCC8', preset: 'platinum_blonde' }, eyes: 'grey', outfit: 'mc_slip_dress', shoes: 'shoes06', jewellery: { ears: 'studs' } }),
  character('mei', 'Mei', 'Round glasses, long straight hair, soft and full-figured.', { tone: '#EFDAC5', undertone: 'neutral', morphs: body('plus', { EyeSize: 0.42, EyeOpen: 0.38, NoseBridge: 0.36, NoseWidth: 0.42, Lips: 0.48, FaceLength: 0.46 }), hair: { style: 'long01', color: '#0A0A0C' }, outfit: 'dbf_flare_set', shoes: 'shoes03', jewellery: { glasses: 'round', frame: '#2A1A14' }, height: 0.96 }),
  character('sofia', 'Sofia', 'Waves, a beauty mark by her lip, curvy plus.', { tone: '#C0916E', undertone: 'warm', morphs: body('plus', { Lips: 0.66, CupidsBow: 0.62, NoseBridge: 0.46, Cheekbones: 0.64, Glutes: 0.9, Hips: 0.92 }), hair: { style: 'wavy_wig', color: '#3A2418' }, mark: 'mole', markAt: 'lipCornerL', outfit: 'kai_butterfly_blue', shoes: 'shoes06', jewellery: { ears: 'hoops', necklace: 'pendant' } }),
  character('chloe', 'Chloe', 'Ginger ponytail, freckles, soft curves.', { tone: '#E9D0B7', undertone: 'neutral', morphs: body('curvy', { Belly: 0.66, Softness: 0.7, NoseTip: 0.62, NoseWidth: 0.46, Lips: 0.48, Cheeks: 0.66, FaceFull: 0.6 }), hair: { style: 'ponytail01', color: '#B5552A', preset: 'ginger' }, mark: 'freckles', eyes: 'green', brows: { color: '#7A4A2A' }, outfit: 'kai_garden_set', shoes: 'shoes03' }),
  character('priya', 'Priya', 'Sleek high bun, cat-eye frames, a blush corset.', { tone: '#9C6B4A', undertone: 'warm', morphs: body('average', { Hips: 0.64, Bust: 0.64, EyeSize: 0.62, NoseBridge: 0.58, NoseLength: 0.56, Lips: 0.56, FaceLength: 0.56 }), hair: { style: 'bun', color: '#141010' }, outfit: 'mc_corset_mini', shoes: 'shoes06', jewellery: { nose: 'stud', ears: 'drops', glasses: 'cateye', frame: '#7A1F2B' } }),
  character('zara', 'Zara', 'Two afro puffs, a birthmark she loves, a little rock.', { tone: '#B78764', undertone: 'olive', morphs: body('average', { EyeSize: 0.6, NoseTip: 0.58, Lips: 0.64, Cheekbones: 0.6 }), hair: { style: 'afro_puffs', color: '#5E1A26', preset: 'burgundy' }, mark: 'birthmark', markAt: 'templeR', eyes: 'brownlight', outfit: 'bola_rock_set', shoes: 'shoes04' }),
  character('nala', 'Nala', 'Natural curls and vitiligo, adire and gold.', { tone: '#744A33', morphs: body('curvy', { Softness: 0.56, EyeSize: 0.58, Lips: 0.6, Cheeks: 0.58 }), hair: { style: 'curls', color: '#2A1A12' }, mark: 'vitiligo', outfit: 'deeji_iro_buba', shoes: 'shoes03', jewellery: { ears: 'drops', wrist: 'bangle' } }),
  character('tobi', 'Tobi', 'Locs, square frames, an easy smile and a dad bod.', { tone: '#45291D', morphs: body('average', { Masc: 1, Softness: 0.64, Belly: 0.64, Jaw: 0.66, Chin: 0.58, NoseWidth: 0.66, Lips: 0.6, Brows: 0.44, Shoulders: 0.62 }), hair: { style: 'locs', color: '#0E0B0B' }, outfit: 'male_casualsuit01', dye: '#1E5A4A', shoes: 'shoes05', jewellery: { glasses: 'square', frame: '#0C0808', rings: true }, brows: { shape: 'eyebrow003', color: '#0C0808' }, height: 1.05 }),
  character('femi', 'Femi', 'Cornrows, big and broad, workwear.', { tone: '#2B1A14', undertone: 'cool', morphs: body('plus', { Masc: 1, Jaw: 0.7, Chin: 0.62, NoseWidth: 0.7, Lips: 0.66, Shoulders: 0.72, Muscle: 0.6 }), hair: { style: 'cornrows', color: '#0A0A0C' }, outfit: 'male_worksuit01', shoes: 'shoes04', brows: { shape: 'eyebrow008' }, height: 1.06 }),
  character('chidi', 'Chidi', 'Short afro, tailored suit, sunnies on.', { tone: '#7E5238', morphs: body('average', { Masc: 1, Jaw: 0.64, Chin: 0.6, NoseWidth: 0.58, Lips: 0.6, Shoulders: 0.64 }), hair: { style: 'afro_short', color: '#0A0A0C' }, outfit: 'male_elegantsuit01', dye: '#2A3A6A', shoes: 'shoes02', jewellery: { glasses: 'sunnies', frame: '#0C0808', rings: true }, height: 1.05 }),
  character('lola', 'Lola', 'Knotless braids, slim and sporty.', { tone: '#4E2F20', morphs: body('slim', { Muscle: 0.6, NoseWidth: 0.58, Lips: 0.62, EyeSize: 0.56 }), hair: { style: 'knotless_braids', color: '#141010', tip: '#B9854A', blend: 0.4, preset: 'custom' }, outfit: 'female_sportsuit01', shoes: 'shoes05', height: 1.03 }),
  character('jiwoo', 'Ji-woo', 'Teal-tipped pixie, androgynous, distressed.', { tone: '#DDBB9C', undertone: 'neutral', morphs: body('slim', { Masc: 0.78, EyeOpen: 0.4, EyeSize: 0.46, NoseWidth: 0.42, Lips: 0.5, Jaw: 0.56 }), hair: { style: 'pixie', color: '#141010', tip: '#1E7A7A', blend: 0.6, preset: 'custom' }, outfit: 'bola_distressed', shoes: 'shoes04', jewellery: { ears: 'huggies', helix: true } }),
  character('kemi', 'Kemi', 'Close crop, an athlete’s build, model walk.', { tone: '#C0916E', undertone: 'olive', morphs: body('athletic', { EyeSize: 0.55, Lips: 0.62, Chin: 0.58, Jaw: 0.6 }), hair: { style: 'none', crop: 0.85, color: '#2A1A12' }, eyes: 'brownlight', outfit: 'male_casualsuit05', dye: '#F2A0B8', shoes: 'shoes01', height: 1.05, jewellery: { ears: 'studs', nose: 'ring' } }),
]

/* ------------------------------------------------------------------ random doll */

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

/**
 * A complete, ready-to-play new doll from a large pool: any skin tone and undertone, a face made
 * from every facial slider, any body type with plus-size weighted in (about four in ten), adult
 * heights, any presentation, any hairstyle and colour the catalog has built, an outfit and shoes,
 * sometimes glasses or a skin mark. Bare-faced, like every starting doll.
 */
export function randomDoll(seed: number, available: { hair: string[]; outfits: string[]; shoes: string[] }): CharacterPreset {
  const r = rng(seed)
  const pick = <T,>(a: readonly T[]) => a[Math.floor(r() * a.length) % a.length]
  const near = (c = 0.5, spread = 0.22) => Math.min(1, Math.max(0, c + (r() - 0.5) * 2 * spread))
  const toneIdx = Math.floor(r() * SKIN_TONES.length)
  const tone = SKIN_TONES[toneIdx]
  const depth = toneIdx < 9 ? 'deep' : toneIdx < 17 ? 'mid' : 'light'
  const types: BodyType[] = ['slim', 'athletic', 'average', 'average', 'curvy', 'curvy', 'plus', 'plus', 'superPlus', 'plus']
  const type = pick(types)
  const masc = r() < 0.25 ? 1 : r() < 0.12 ? 0.75 : 0.5
  const morphs: Partial<Record<MorphId, number>> = { ...BODY_TYPES[type] }
  for (const m of ['NoseWidth', 'NoseBridge', 'NoseTip', 'NoseLength', 'Lips', 'LipWidth', 'CupidsBow', 'Jaw', 'Chin', 'ChinWidth', 'Cheekbones', 'Cheeks', 'EyeSize', 'EyeSpacing', 'EyeOpen', 'Brows', 'BrowAngle', 'FaceLength'] as MorphId[]) morphs[m] = near(0.5, 0.2)
  if (morphs.FaceFull === undefined) morphs.FaceFull = near(0.5, 0.15)
  morphs.Masc = masc
  if (masc > 0.5) {
    morphs.Jaw = near(0.64, 0.08)
    morphs.Shoulders = near(0.62, 0.08)
    morphs.Bust = Math.min(morphs.Bust ?? 0.5, 0.45)
  }
  const hairs = available.hair.filter((h) => h !== 'bonnet')
  const style = r() < 0.05 ? 'none' : pick(hairs)
  const fun = r() < 0.18
  const color = fun ? pick(FUN_HAIR) : depth === 'deep' ? pick(NATURAL_HAIR.slice(0, 5)) : pick(NATURAL_HAIR)
  const tip = r() < 0.2 ? pick([...FUN_HAIR, '#C9A06A', '#E6DCC8']) : color
  const marks: StudioLook['skin']['mark'][] = ['none', 'none', 'none', 'none', 'none', 'freckles', 'mole', 'birthmark', 'vitiligo']
  const name = pick(NAMES)
  const preset = character(`random-${seed.toString(36)}`, name, `${{ slim: 'Slim', athletic: 'Athletic', average: 'Average build', curvy: 'Curvy', plus: 'Plus-size', superPlus: 'Plus-size' }[type]}, ${style === 'none' ? 'close crop' : 'new hair'}, a fresh face.`, {
    tone,
    undertone: pick(['cool', 'neutral', 'warm', 'olive'] as const),
    morphs,
    hair: { style: style as StudioLook['hair']['style'], color, tip, blend: tip !== color ? 0.5 : 0, preset: 'custom', crop: 0.7 },
    outfit: pick(available.outfits) as StudioLook['outfit']['id'],
    shoes: pick(available.shoes) as StudioLook['shoes']['id'],
    eyes: pick(EYES_BY_DEPTH[depth]),
    brows: { color: depth === 'light' && r() < 0.4 ? '#6B4A2A' : '#140D0B' },
    height: masc > 0.5 ? 1.02 + r() * 0.04 : 0.95 + r() * 0.08,
    mark: pick(marks),
    markAt: pick(['cheekL', 'cheekR', 'lipCornerL', 'templeR', 'jawL'] as const),
    jewellery: r() < 0.16 ? { glasses: pick(['round', 'square', 'cateye'] as const), frame: pick(['#1A1416', '#7A1F2B', '#C9A06A', '#2A3A6A']) } : { ears: pick(['none', 'studs', 'hoops', 'huggies'] as const) },
  })
  preset.look.profile.starter = 'random'
  return preset
}
