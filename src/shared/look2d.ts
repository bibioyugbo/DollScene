/**
 * The 2D cartoon look: a flat, fun character drawn in SVG (see src/art2d).
 * Kept free of DOM imports so the server can sanitize it.
 */

import type { AvatarSummary, HairStyleId } from './types'

export type Look2DGroup = 'women' | 'men' | 'androgynous'
export type Look2DAge = 'young' | 'adult' | 'elder'
export type Look2DBuild = 'slim' | 'curvy' | 'athletic' | 'broad' | 'plus'

export type Look2DEyes = 'round' | 'almond' | 'glasses' | 'shades' | 'contacts' | 'stoner'
export type Look2DBrows = 'natural' | 'bleached' | 'slit' | 'thin' | 'bold' | 'arched'
export type Look2DMouth = 'smirk' | 'smile' | 'grin' | 'tongue' | 'pout' | 'soft'

export type Look2DHair =
  | 'pixie'
  | 'microlocs'
  | 'trad-locs'
  | 'freeform-locs'
  | 'knotless'
  | 'box-braids'
  | 'bussdown'
  | 'leave-out'
  | 'tyla-braids'
  | 'fulani'
  | 'cornrows'
  | 'afro'
  | 'curly-fro'
  | 'puffs'
  | 'bantu'
  | 'twists'
  | 'fade'
  | 'waves'
  | 'buzz'
  | 'bald'
  | 'bun'
  | 'high-pony'
  | 'bob'
  | 'wolf-cut'
  | 'mohawk'
  | 'hijab'

export type Look2DMakeup =
  | 'none'
  | 'natural-glow'
  | 'soft-glam'
  | 'lagos-baddie'
  | 'goth'
  | 'rainbow'
  | 'alt'
  | 'e-girl'
  | 'y2k'
  | 'editorial'
  | 'owambe'

export type Look2DMark = 'freckles' | 'vitiligo' | 'beauty-mark' | 'tribal-marks' | 'wrinkles'
export type Look2DFaceTattoo = 'none' | 'tears' | 'star' | 'script' | 'vine' | 'dots'
export type Look2DPiercing = 'ears' | 'nose-stud' | 'nose-ring' | 'septum' | 'bridge' | 'brow' | 'lip' | 'snakebites' | 'dermal'
export type Look2DFacialHair = 'none' | 'stubble' | 'moustache' | 'goatee' | 'full'

export type Look2DTop = 'crop' | 'tee' | 'tank' | 'shirt' | 'hoodie' | 'jersey' | 'corset' | 'kaftan' | 'blazer'
export type Look2DBottom = 'cargo' | 'jeans' | 'wide-leg' | 'shorts' | 'mini' | 'maxi' | 'joggers' | 'wrapper'
export type Look2DShoes = 'sneakers' | 'chunky' | 'boots' | 'heels' | 'slides'
export type Look2DExtra = 'none' | 'headphones' | 'chain' | 'bag' | 'bucket-hat' | 'cap' | 'beanie' | 'gele'

export interface Look2D {
  group: Look2DGroup
  age: Look2DAge
  build: Look2DBuild
  skin: string
  eyes: Look2DEyes
  /** Iris colour; with contacts it is the lens colour. */
  eyeColor: string
  brows: Look2DBrows
  mouth: Look2DMouth
  hair: Look2DHair
  hairColor: string
  /** Second hair colour: tips, streaks or ombré. Same as hairColor for solid. */
  hairColor2: string
  makeup: Look2DMakeup
  lip: string
  marks: Look2DMark[]
  tattoo: Look2DFaceTattoo
  piercings: Look2DPiercing[]
  facialHair: Look2DFacialHair
  top: Look2DTop
  topColor: string
  topColor2: string
  bottom: Look2DBottom
  bottomColor: string
  shoes: Look2DShoes
  shoeColor: string
  extra: Look2DExtra
  extraColor: string
  /** Visible disability and access aids. */
  wheelchair: boolean
  hearingAid: boolean
  /** Blind or low vision: white cane. */
  cane: boolean
}

export const LOOK_HAIRS: { id: Look2DHair; label: string }[] = [
  { id: 'pixie', label: 'Pixie cut' },
  { id: 'microlocs', label: 'Microlocs' },
  { id: 'trad-locs', label: 'Traditional locs' },
  { id: 'freeform-locs', label: 'Freeform locs' },
  { id: 'knotless', label: 'Knotless braids' },
  { id: 'box-braids', label: 'Box braids' },
  { id: 'tyla-braids', label: 'Tyla braids' },
  { id: 'fulani', label: 'Fulani braids' },
  { id: 'cornrows', label: 'Cornrows' },
  { id: 'bussdown', label: 'Bussdown' },
  { id: 'leave-out', label: 'Leave out' },
  { id: 'afro', label: 'Afro' },
  { id: 'curly-fro', label: 'Curly fro' },
  { id: 'puffs', label: 'Puffs' },
  { id: 'bantu', label: 'Bantu knots' },
  { id: 'twists', label: 'Twists' },
  { id: 'bob', label: 'Bob' },
  { id: 'high-pony', label: 'High pony' },
  { id: 'bun', label: 'Bun' },
  { id: 'wolf-cut', label: 'Wolf cut' },
  { id: 'fade', label: 'Fade' },
  { id: 'waves', label: '360 waves' },
  { id: 'buzz', label: 'Buzz cut' },
  { id: 'mohawk', label: 'Mohawk' },
  { id: 'bald', label: 'Bald' },
  { id: 'hijab', label: 'Hijab' },
]

export const LOOK_EYES: { id: Look2DEyes; label: string }[] = [
  { id: 'round', label: 'Doe eyes' },
  { id: 'almond', label: 'Almond eyes' },
  { id: 'glasses', label: 'Glasses' },
  { id: 'shades', label: 'Shades' },
  { id: 'contacts', label: 'Contacts' },
  { id: 'stoner', label: 'Red eyes' },
]

export const LOOK_BROWS: { id: Look2DBrows; label: string }[] = [
  { id: 'natural', label: 'Natural' },
  { id: 'bleached', label: 'Bleached' },
  { id: 'arched', label: 'Arched' },
  { id: 'bold', label: 'Bold' },
  { id: 'thin', label: '90s thin' },
  { id: 'slit', label: 'Slit' },
]

export const LOOK_MAKEUPS: { id: Look2DMakeup; label: string }[] = [
  { id: 'none', label: 'Bare' },
  { id: 'natural-glow', label: 'Natural glow' },
  { id: 'soft-glam', label: 'Soft glam' },
  { id: 'lagos-baddie', label: 'Lagos baddie' },
  { id: 'owambe', label: 'Owambe gold' },
  { id: 'goth', label: 'Goth' },
  { id: 'alt', label: 'Alternative' },
  { id: 'rainbow', label: 'Rainbow' },
  { id: 'e-girl', label: 'E-girl' },
  { id: 'y2k', label: 'Y2K frost' },
  { id: 'editorial', label: 'Editorial' },
]

export const LOOK_PIERCINGS: { id: Look2DPiercing; label: string }[] = [
  { id: 'ears', label: 'Ears' },
  { id: 'nose-stud', label: 'Nose stud' },
  { id: 'nose-ring', label: 'Nose ring' },
  { id: 'septum', label: 'Septum' },
  { id: 'bridge', label: 'Bridge' },
  { id: 'brow', label: 'Brow' },
  { id: 'lip', label: 'Lip' },
  { id: 'snakebites', label: 'Snakebites' },
  { id: 'dermal', label: 'Dermal' },
]

export const LOOK_TATTOOS: { id: Look2DFaceTattoo; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'tears', label: 'Tears' },
  { id: 'star', label: 'Star' },
  { id: 'vine', label: 'Vine' },
  { id: 'script', label: 'Script' },
  { id: 'dots', label: 'Dots' },
]

/** Hair dye swatches for the quick customizer. */
export const LOOK_HAIR_COLORS = ['#1B1214', '#3B2219', '#7A4A2E', '#C9A227', '#F3E2B0', '#E8E4DE', '#B3123F', '#FF5C2B', '#FF3D8B', '#A86BFF', '#2F6BFF', '#2FBF71']

const HAIRS = new Set(LOOK_HAIRS.map((x) => x.id))
const EYES = new Set(LOOK_EYES.map((x) => x.id))
const BROWS = new Set(LOOK_BROWS.map((x) => x.id))
const MAKEUPS = new Set(LOOK_MAKEUPS.map((x) => x.id))
const PIERCINGS = new Set(LOOK_PIERCINGS.map((x) => x.id))
const TATTOOS = new Set(LOOK_TATTOOS.map((x) => x.id))

const pick = <T extends string>(v: unknown, allowed: readonly T[] | Set<T>, fallback: T): T => {
  const ok = Array.isArray(allowed) ? allowed.includes(v as T) : (allowed as Set<T>).has(v as T)
  return ok ? (v as T) : fallback
}
const hex = (s: unknown, fallback: string) => (typeof s === 'string' && /^#[0-9a-fA-F]{6}$/.test(s) ? s : fallback)

export const DEFAULT_LOOK: Look2D = {
  group: 'women',
  age: 'young',
  build: 'slim',
  skin: '#7A4A2E',
  eyes: 'round',
  eyeColor: '#3B2219',
  brows: 'natural',
  mouth: 'smirk',
  hair: 'curly-fro',
  hairColor: '#1B1214',
  hairColor2: '#1B1214',
  makeup: 'natural-glow',
  lip: '#8E3B46',
  marks: [],
  tattoo: 'none',
  piercings: ['ears'],
  facialHair: 'none',
  top: 'crop',
  topColor: '#A86BFF',
  topColor2: '#FF5C2B',
  bottom: 'cargo',
  bottomColor: '#24212A',
  shoes: 'chunky',
  shoeColor: '#2A2730',
  extra: 'none',
  extraColor: '#FF5C2B',
  wheelchair: false,
  hearingAid: false,
  cane: false,
}

/** Merge untrusted input over the default look; drop anything unknown. */
export function sanitizeLook(input: unknown): Look2D {
  const d = DEFAULT_LOOK
  if (!input || typeof input !== 'object') return { ...d, marks: [], piercings: [...d.piercings] }
  const a = input as Partial<Record<keyof Look2D, unknown>>
  return {
    group: pick(a.group, ['women', 'men', 'androgynous'] as const, d.group),
    age: pick(a.age, ['young', 'adult', 'elder'] as const, d.age),
    build: pick(a.build, ['slim', 'curvy', 'athletic', 'broad', 'plus'] as const, d.build),
    skin: hex(a.skin, d.skin),
    eyes: pick(a.eyes, EYES, d.eyes),
    eyeColor: hex(a.eyeColor, d.eyeColor),
    brows: pick(a.brows, BROWS, d.brows),
    mouth: pick(a.mouth, ['smirk', 'smile', 'grin', 'tongue', 'pout', 'soft'] as const, d.mouth),
    hair: pick(a.hair, HAIRS, d.hair),
    hairColor: hex(a.hairColor, d.hairColor),
    hairColor2: hex(a.hairColor2, hex(a.hairColor, d.hairColor2)),
    makeup: pick(a.makeup, MAKEUPS, d.makeup),
    lip: hex(a.lip, d.lip),
    marks: (Array.isArray(a.marks) ? a.marks : []).filter((m): m is Look2DMark => ['freckles', 'vitiligo', 'beauty-mark', 'tribal-marks', 'wrinkles'].includes(m)).slice(0, 5),
    tattoo: pick(a.tattoo, TATTOOS, d.tattoo),
    piercings: [...new Set((Array.isArray(a.piercings) ? a.piercings : []).filter((p): p is Look2DPiercing => PIERCINGS.has(p)))],
    facialHair: pick(a.facialHair, ['none', 'stubble', 'moustache', 'goatee', 'full'] as const, d.facialHair),
    top: pick(a.top, ['crop', 'tee', 'tank', 'shirt', 'hoodie', 'jersey', 'corset', 'kaftan', 'blazer'] as const, d.top),
    topColor: hex(a.topColor, d.topColor),
    topColor2: hex(a.topColor2, d.topColor2),
    bottom: pick(a.bottom, ['cargo', 'jeans', 'wide-leg', 'shorts', 'mini', 'maxi', 'joggers', 'wrapper'] as const, d.bottom),
    bottomColor: hex(a.bottomColor, d.bottomColor),
    shoes: pick(a.shoes, ['sneakers', 'chunky', 'boots', 'heels', 'slides'] as const, d.shoes),
    shoeColor: hex(a.shoeColor, d.shoeColor),
    extra: pick(a.extra, ['none', 'headphones', 'chain', 'bag', 'bucket-hat', 'cap', 'beanie', 'gele'] as const, d.extra),
    extraColor: hex(a.extraColor, d.extraColor),
    wheelchair: a.wheelchair === true,
    hearingAid: a.hearingAid === true,
    cane: a.cane === true,
  }
}

const HAIR_FROM_STYLE: Record<HairStyleId, Look2DHair> = {
  afro: 'afro', twa: 'curly-fro', locs: 'trad-locs', sisterlocs: 'microlocs', 'freeform-locs': 'freeform-locs', 'knotless-braids': 'knotless', 'box-braids': 'box-braids',
  'fulani-braids': 'fulani', cornrows: 'cornrows', 'bantu-knots': 'bantu', twists: 'twists', 'faux-locs': 'trad-locs', 'lace-front': 'bussdown', 'sew-in': 'bussdown',
  'silk-press': 'bussdown', puffs: 'puffs', 'high-puff': 'high-pony', 'natural-updo': 'bun', bob: 'bob', bun: 'bun', fade: 'fade', taper: 'fade', 'short-cut': 'waves',
  buzz: 'buzz', bald: 'bald', pixie: 'pixie', ponytail: 'high-pony', 'long-straight': 'bussdown', 'long-curly': 'leave-out', 'fringe-bob': 'bob', mohawk: 'mohawk', 'shaved-sides': 'wolf-cut',
}

/** A 2D look for dolls that only have a 3D appearance, so every bubble and card uses the same drawn style. */
export function lookFromSummary(a: AvatarSummary): Look2D {
  const masc = a.base === 'masculine'
  return {
    ...DEFAULT_LOOK,
    group: masc ? 'men' : a.base === 'androgynous' ? 'androgynous' : 'women',
    build: masc ? 'athletic' : 'slim',
    skin: a.skin,
    eyeColor: a.eyeColor,
    mouth: masc ? 'smile' : 'smirk',
    hair: HAIR_FROM_STYLE[a.hairStyle] ?? 'afro',
    hairColor: a.hairColor,
    hairColor2: a.hairColor2,
    makeup: masc ? 'none' : 'natural-glow',
    lip: masc ? DEFAULT_LOOK.lip : a.lipColor,
    piercings: masc ? [] : ['ears'],
    top: masc ? 'tee' : 'crop',
    topColor: a.topColor,
    extra: a.accessory === 'gele' ? 'gele' : 'none',
    extraColor: a.topColor,
  }
}
