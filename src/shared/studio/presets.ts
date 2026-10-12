import { DEFAULT_LOOK, neutralMorphs, type Makeup, type MorphId, type StudioLook } from './look'

/* ------------------------------------------------------------------ skin */

/** Twenty-four tones, deepest to lightest. Every tone is equal in play: none scores higher. */
export const SKIN_TONES = [
  '#2B1A14', '#33201A', '#3B241A', '#45291D', '#4E2F20', '#583524',
  '#613B28', '#6B4430', '#744A33', '#7E5238', '#88593D', '#926243',
  '#9C6B4A', '#A57452', '#AE7D5A', '#B78764', '#C0916E', '#C89B78',
  '#D0A684', '#D7B190', '#DDBB9C', '#E3C5A9', '#E9D0B7', '#EFDAC5',
] as const

/* ------------------------------------------------------------------ makeup looks */

const nude = (m: Partial<Makeup>): Makeup => ({ ...structuredClone(DEFAULT_LOOK.makeup), ...m })

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

export const MAKEUP_PRESETS: MakeupPreset[] = [
  {
    id: 'bare',
    name: 'Bare skin',
    blurb: 'Nothing on. Your own glow.',
    build: () => nude({}),
  },
  {
    id: 'natural',
    name: 'Natural',
    blurb: 'Skin first: sheer base, brushed brows, tinted balm.',
    build: (tone) =>
      nude({
        foundation: { color: tone, amount: 0.35 },
        concealer: { color: mixHex(tone, '#FFE2C4', 0.12), amount: 0.35 },
        blush: { color: '#9E4A44', amount: 0.25 },
        highlight: { color: '#E6C29A', amount: 0.15 },
        liner: { color: '#1A1210', amount: 0.15 },
        lipstick: { color: mixHex(tone, '#8A3A36', 0.55), amount: 0.45 },
        gloss: 0.45,
      }),
  },
  {
    id: 'soft-glam',
    name: 'Soft glam',
    blurb: 'Warm brown smoke, sculpted cheeks, glossy nude lip.',
    build: (tone) =>
      nude({
        foundation: { color: tone, amount: 0.6 },
        concealer: { color: mixHex(tone, '#FFE2C4', 0.18), amount: 0.55 },
        contour: { color: '#3A2117', amount: 0.45 },
        blush: { color: '#A6503F', amount: 0.4 },
        highlight: { color: '#EBC593', amount: 0.45 },
        eyeshadow: { color: '#6B3E26', amount: 0.55, shimmer: 0.2 },
        liner: { color: '#120C0A', amount: 0.55 },
        lipLiner: { color: '#4A2620', amount: 0.6 },
        lipstick: { color: mixHex(tone, '#9A5A48', 0.6), amount: 0.7 },
        gloss: 0.7,
      }),
  },
  {
    id: 'bridal',
    name: 'Bridal glam',
    blurb: 'Flawless base, gold lid, defined wing, deep rose lip.',
    build: (tone) =>
      nude({
        foundation: { color: tone, amount: 0.75 },
        concealer: { color: mixHex(tone, '#FFE2C4', 0.2), amount: 0.6 },
        contour: { color: '#36201A', amount: 0.5 },
        blush: { color: '#B0505A', amount: 0.35 },
        highlight: { color: '#F0CF95', amount: 0.6 },
        eyeshadow: { color: '#B8862F', amount: 0.75, shimmer: 0.8 },
        liner: { color: '#0A0606', amount: 0.85 },
        lowerLiner: { color: '#2A1A14', amount: 0.3 },
        lipLiner: { color: '#5A1E26', amount: 0.75 },
        lipstick: { color: '#8C2A3A', amount: 0.85 },
        gloss: 0.4,
      }),
  },
  {
    id: 'editorial',
    name: 'Editorial',
    blurb: 'Graphic cobalt lid, bare cheek, ink-stained lip.',
    build: (tone) =>
      nude({
        foundation: { color: tone, amount: 0.5 },
        highlight: { color: '#F4E4CC', amount: 0.55 },
        eyeshadow: { color: '#1F3FB0', amount: 0.9, shimmer: 0.1 },
        liner: { color: '#050505', amount: 1 },
        lowerLiner: { color: '#1F3FB0', amount: 0.6 },
        lipstick: { color: '#3A0E1E', amount: 0.9 },
        gloss: 0.1,
      }),
  },
  {
    id: 'nightlife',
    name: 'Nightlife',
    blurb: 'Plum smoke, wet shine, glitter on the high points.',
    build: (tone) =>
      nude({
        foundation: { color: tone, amount: 0.6 },
        concealer: { color: mixHex(tone, '#FFE2C4', 0.15), amount: 0.45 },
        contour: { color: '#2E1A16', amount: 0.55 },
        blush: { color: '#8E2E5A', amount: 0.3 },
        highlight: { color: '#F6D7B0', amount: 0.75 },
        eyeshadow: { color: '#4A1846', amount: 0.85, shimmer: 0.9 },
        liner: { color: '#050505', amount: 0.8 },
        lowerLiner: { color: '#4A1846', amount: 0.5 },
        lipLiner: { color: '#3A1424', amount: 0.7 },
        lipstick: { color: '#6A1E3E', amount: 0.75 },
        gloss: 0.95,
      }),
  },
]

/* ------------------------------------------------------------------ characters */

export interface CharacterPreset {
  id: string
  name: string
  look: StudioLook
}

function character(id: string, name: string, patch: { tone: string; undertone?: StudioLook['skin']['undertone']; morphs?: Partial<Record<MorphId, number>>; hair?: Partial<StudioLook['hair']>; makeup?: string; outfit?: StudioLook['outfit']['id']; eyes?: StudioLook['eyes']['iris']; height?: number }): CharacterPreset {
  const tone = patch.tone
  const look: StudioLook = {
    ...structuredClone(DEFAULT_LOOK),
    morphs: { ...neutralMorphs(), ...patch.morphs },
    height: patch.height ?? 1,
    skin: { tone, undertone: patch.undertone ?? 'warm', glow: 0.35 },
    eyes: { iris: patch.eyes ?? 'brown' },
    hair: { ...DEFAULT_LOOK.hair, ...patch.hair },
    outfit: { ...DEFAULT_LOOK.outfit, id: patch.outfit ?? DEFAULT_LOOK.outfit.id },
  }
  const mk = MAKEUP_PRESETS.find((p) => p.id === (patch.makeup ?? 'natural'))!
  look.makeup = mk.build(tone)
  return { id, name, look }
}

/** Starting faces. Names are characters in the game, not real people. */
export const CHARACTER_PRESETS: CharacterPreset[] = [
  character('adaeze', 'Adaeze', { tone: '#4E2F20', morphs: { NoseWidth: 0.62, Lips: 0.66, Cheekbones: 0.62, FaceLength: 0.45 }, hair: { style: 'short02', color: '#141010' }, makeup: 'soft-glam' }),
  character('temi', 'Temi', { tone: '#7E5238', morphs: { NoseWidth: 0.55, Lips: 0.58, Jaw: 0.42, EyeSize: 0.58, Hips: 0.6 }, hair: { style: 'bob02', color: '#1E1410' }, makeup: 'natural', outfit: 'female_casualsuit01' }),
  character('zainab', 'Zainab', { tone: '#9C6B4A', undertone: 'olive', morphs: { NoseBridge: 0.42, NoseTip: 0.56, Lips: 0.52, FaceLength: 0.6, Cheekbones: 0.66 }, hair: { style: 'long01', color: '#1A120E' }, makeup: 'bridal', outfit: 'female_elegantsuit01', height: 1.03 }),
  character('ifeoma', 'Ifeoma', { tone: '#33201A', undertone: 'cool', morphs: { NoseWidth: 0.68, Lips: 0.72, FaceFull: 0.62, Bust: 0.62, Hips: 0.68, Glutes: 0.64, Softness: 0.62 }, hair: { style: 'ponytail01', color: '#120E0E' }, makeup: 'nightlife', outfit: 'female_casualsuit02' }),
  character('kemi', 'Kemi', { tone: '#C0916E', undertone: 'neutral', morphs: { EyeSize: 0.55, Lips: 0.55, Chin: 0.56, Muscle: 0.62, Shoulders: 0.56 }, hair: { style: 'none', crop: 0.85, color: '#2A1A12' }, makeup: 'editorial', eyes: 'brownlight', height: 1.04 }),
  character('amaka', 'Amaka', { tone: '#613B28', morphs: { NoseWidth: 0.6, Cheeks: 0.6, FaceFull: 0.58, Waist: 0.58, Belly: 0.6, Softness: 0.68, Arms: 0.62 }, hair: { style: 'braid01', color: '#3A1E14' }, makeup: 'soft-glam', outfit: 'female_casualsuit01', height: 0.97 }),
]

/* ------------------------------------------------------------------ transformation studio */

/**
 * Reversible, fictional appearance presets. They nudge morph sliders from wherever the
 * player is; they are not medical advice and not predictions of clinical results.
 */
export interface TransformPreset {
  id: string
  name: string
  area: 'face' | 'body' | 'non-surgical'
  blurb: string
  morphs?: Partial<Record<MorphId, number>>
  /** Makeup layers this preset sets (non-surgical alternatives). */
  makeup?: (tone: string) => Partial<Makeup>
  skinGlow?: number
}

export const TRANSFORM_PRESETS: TransformPreset[] = [
  { id: 'lip-soft', name: 'Lip filler look: soft', area: 'face', blurb: 'A touch more volume through both lips.', morphs: { Lips: 0.12, CupidsBow: 0.06 } },
  { id: 'lip-full', name: 'Lip filler look: full', area: 'face', blurb: 'Noticeably fuller lips with a defined bow.', morphs: { Lips: 0.26, CupidsBow: 0.12, LipWidth: 0.04 } },
  { id: 'smooth', name: 'Botox-inspired smoothing', area: 'face', blurb: 'Slightly lifted brows and a smoother, dewier finish.', morphs: { Brows: 0.06, BrowAngle: 0.08 }, skinGlow: 0.15 },
  { id: 'nose-refine', name: 'Nose reshape: refine', area: 'face', blurb: 'Narrower bridge and nostrils, lifted tip.', morphs: { NoseWidth: -0.18, NoseBridge: -0.14, NoseTip: 0.1 } },
  { id: 'nose-length', name: 'Nose reshape: shorten', area: 'face', blurb: 'A shorter nose with a slight lift.', morphs: { NoseLength: -0.16, NoseTip: 0.08 } },
  { id: 'chin', name: 'Chin sculpt', area: 'face', blurb: 'More chin projection.', morphs: { Chin: 0.2 } },
  { id: 'jaw', name: 'Jawline sculpt', area: 'face', blurb: 'A more defined jaw angle.', morphs: { Jaw: 0.2, ChinWidth: -0.06 } },
  { id: 'cheeks', name: 'Cheek filler look', area: 'face', blurb: 'Higher, fuller cheekbones.', morphs: { Cheekbones: 0.2, Cheeks: 0.1 } },
  { id: 'bbl', name: 'BBL-inspired silhouette', area: 'body', blurb: 'Fuller hips and glutes with a narrower waist.', morphs: { Glutes: 0.28, Hips: 0.18, Waist: -0.1 } },
  { id: 'lipo', name: 'Liposuction-inspired contour', area: 'body', blurb: 'A flatter middle and slimmer arms and thighs.', morphs: { Belly: -0.25, Waist: -0.14, Arms: -0.14, Thighs: -0.1 } },
  { id: 'bust', name: 'Breast augmentation-inspired', area: 'body', blurb: 'A fuller, slightly lifted bust.', morphs: { Bust: 0.22, BustLift: 0.12 } },
  { id: 'lift', name: 'Lift-inspired', area: 'body', blurb: 'The same volume, sitting higher.', morphs: { BustLift: 0.2 } },
  { id: 'contour-makeup', name: 'Contour and highlight', area: 'non-surgical', blurb: 'Sculpt with shadow and light instead of reshaping.', makeup: () => ({ contour: { color: '#36201A', amount: 0.65 }, highlight: { color: '#F0CF95', amount: 0.6 } }) },
  { id: 'overline', name: 'Lip overline', area: 'non-surgical', blurb: 'Liner just outside the lip line for a fuller look.', makeup: (tone) => ({ lipLiner: { color: mixHex(tone, '#4A2620', 0.7), amount: 0.85 }, lipstick: { color: mixHex(tone, '#9A5A48', 0.55), amount: 0.7 }, gloss: 0.85 }) },
  { id: 'shapewear', name: 'Shapewear', area: 'non-surgical', blurb: 'Smooths the waist and tummy under clothes.', morphs: { Waist: -0.1, Belly: -0.14 } },
]

/** Apply a transform preset on top of a look (clamped, undoable through history). */
export function applyTransform(look: StudioLook, preset: TransformPreset): StudioLook {
  const next = structuredClone(look)
  for (const [k, dv] of Object.entries(preset.morphs ?? {}) as [MorphId, number][]) {
    next.morphs[k] = Math.min(1, Math.max(0, next.morphs[k] + dv))
  }
  if (preset.makeup) Object.assign(next.makeup, preset.makeup(look.skin.tone))
  if (preset.skinGlow) next.skin.glow = Math.min(1, next.skin.glow + preset.skinGlow)
  if (!next.transforms.includes(preset.id)) next.transforms = [...next.transforms, preset.id].slice(-16)
  return next
}
