import { defaultAppearance } from './appearance'
import { findCity } from './cities'
import { DEFAULT_LOOK, type Look2D, type Look2DGroup, type Look2DHair } from './look2d'
import type { Appearance, HairStyleId } from './types'

/** One of the 30 default 2D characters: 10 women, 10 men, 10 androgynous. */
export interface CastDoll {
  id: string
  name: string
  group: Look2DGroup
  city: string
  country: string
  /** "Lagos baddie" becomes "Lagos baddie core". */
  core: string
  blurb: string
  look: Look2D
}

const doll = (id: string, name: string, city: string, country: string, core: string, blurb: string, look: Partial<Look2D> & Pick<Look2D, 'group'>): CastDoll => ({
  id,
  name,
  group: look.group,
  city,
  country,
  core,
  blurb,
  look: { ...DEFAULT_LOOK, marks: [], piercings: [], ...look, hairColor2: look.hairColor2 ?? look.hairColor ?? DEFAULT_LOOK.hairColor },
})

export const CAST: CastDoll[] = [
  /* ---------------------------------------------------------------- women */
  doll('tolu', 'Tolu', 'Lagos', 'Nigeria', 'Lagos baddie', 'Island girl. Owns three ring lights.', {
    group: 'women', build: 'slim', skin: '#6B3E26', eyes: 'almond', eyeColor: '#2A1810', brows: 'arched', mouth: 'smirk',
    hair: 'knotless', hairColor: '#1B1214', hairColor2: '#C9A227', makeup: 'lagos-baddie', lip: '#5E2A2A',
    piercings: ['ears', 'nose-stud'], top: 'crop', topColor: '#7B3FE4', topColor2: '#FF5C2B', bottom: 'cargo', bottomColor: '#1F1D24', shoes: 'chunky', shoeColor: '#2A2730', extra: 'chain', extraColor: '#E9C46A',
  }),
  doll('amara', 'Amara', 'Enugu', 'Nigeria', 'Soft glam', 'Coal City’s loudest laugh. Red pixie, no apologies.', {
    group: 'women', build: 'curvy', skin: '#4A2A1C', eyes: 'contacts', eyeColor: '#9BC53D', brows: 'bold', mouth: 'smile',
    hair: 'pixie', hairColor: '#B3123F', hairColor2: '#FF5C2B', makeup: 'soft-glam', lip: '#A0153E',
    piercings: ['ears', 'bridge'], top: 'corset', topColor: '#1B1214', topColor2: '#B3123F', bottom: 'wide-leg', bottomColor: '#F4F0EA', shoes: 'heels', shoeColor: '#B3123F',
  }),
  doll('zuri', 'Zuri', 'Atlanta', 'United States', 'Bedroom DJ', 'ATL native. Headphones never come off.', {
    group: 'women', build: 'slim', skin: '#7A4026', eyes: 'round', eyeColor: '#5A2E14', brows: 'natural', mouth: 'tongue',
    hair: 'afro', hairColor: '#4A2018', makeup: 'natural-glow', lip: '#B5555F',
    piercings: ['ears', 'dermal', 'nose-stud'], top: 'tee', topColor: '#C46BC9', topColor2: '#FFFFFF', bottom: 'shorts', bottomColor: '#7C9CD8', shoes: 'boots', shoeColor: '#433C8C', extra: 'headphones', extraColor: '#FF7A2B',
  }),
  doll('bisi', 'Mama Bisi', 'Ibadan', 'Nigeria', 'Owambe queen', 'Seventy-one and still first on the dance floor.', {
    group: 'women', age: 'elder', build: 'plus', skin: '#5A3420', eyes: 'glasses', eyeColor: '#2A1810', brows: 'thin', mouth: 'grin',
    hair: 'bun', hairColor: '#D9D4CC', makeup: 'owambe', lip: '#9E1B32', marks: ['wrinkles', 'tribal-marks'],
    piercings: ['ears'], top: 'kaftan', topColor: '#0E7C66', topColor2: '#E9C46A', bottom: 'wrapper', bottomColor: '#0E7C66', shoes: 'slides', shoeColor: '#E9C46A', extra: 'gele', extraColor: '#E9C46A',
  }),
  doll('keisha', 'Keisha', 'Kingston', 'Jamaica', 'Rainbow rebel', 'Wheelchair racer by day, dancehall queen by night.', {
    group: 'women', build: 'athletic', skin: '#3B2219', eyes: 'round', eyeColor: '#3B2219', brows: 'arched', mouth: 'grin',
    hair: 'microlocs', hairColor: '#1B1214', hairColor2: '#F3C13A', makeup: 'rainbow', lip: '#D2577A',
    piercings: ['ears', 'septum'], top: 'tank', topColor: '#2FBF71', topColor2: '#F3C13A', bottom: 'mini', bottomColor: '#1B1214', shoes: 'sneakers', shoeColor: '#F3C13A', wheelchair: true,
  }),
  doll('ana', 'Ana Clara', 'Salvador', 'Brazil', 'Y2K', 'Carnaval every weekend. Freckles are free highlighter.', {
    group: 'women', build: 'curvy', skin: '#8A5235', eyes: 'round', eyeColor: '#6B4A2B', brows: 'natural', mouth: 'smile',
    hair: 'curly-fro', hairColor: '#3B2219', hairColor2: '#D79A4E', makeup: 'y2k', lip: '#E37C8A', marks: ['freckles'],
    piercings: ['ears'], top: 'crop', topColor: '#7CD0F0', topColor2: '#FFFFFF', bottom: 'jeans', bottomColor: '#5875B8', shoes: 'chunky', shoeColor: '#FFFFFF', extra: 'bag', extraColor: '#FF7AB6',
  }),
  doll('sofia', 'Sofía', 'Mexico City', 'Mexico', 'Alternative', 'Tattoo apprentice with a pink wolf cut.', {
    group: 'women', build: 'slim', skin: '#C98B63', eyes: 'almond', eyeColor: '#3B2219', brows: 'slit', mouth: 'smirk',
    hair: 'wolf-cut', hairColor: '#FF7AB6', hairColor2: '#1B1214', makeup: 'alt', lip: '#5B2A86', tattoo: 'vine',
    piercings: ['ears', 'snakebites'], top: 'hoodie', topColor: '#1F1D24', topColor2: '#FF7AB6', bottom: 'mini', bottomColor: '#3B3640', shoes: 'boots', shoeColor: '#1B1214',
  }),
  doll('priya', 'Priya', 'Mumbai', 'India', 'Editorial', 'Fashion editor. Thinks in magazine spreads.', {
    group: 'women', build: 'slim', skin: '#B07850', eyes: 'almond', eyeColor: '#2A1810', brows: 'bold', mouth: 'soft',
    hair: 'bussdown', hairColor: '#120C0E', makeup: 'editorial', lip: '#9B2C3A',
    piercings: ['ears', 'nose-ring'], top: 'blazer', topColor: '#FF5C2B', topColor2: '#F4F0EA', bottom: 'wide-leg', bottomColor: '#FF5C2B', shoes: 'heels', shoeColor: '#1B1214',
  }),
  doll('noor', 'Noor', 'Dubai', 'United Arab Emirates', 'Modest luxe', 'Hijab styled a new way every day.', {
    group: 'women', build: 'slim', skin: '#D9A982', eyes: 'shades', eyeColor: '#3B2219', brows: 'arched', mouth: 'smile',
    hair: 'hijab', hairColor: '#E8D9C4', makeup: 'soft-glam', lip: '#B5555F',
    top: 'blazer', topColor: '#E8D9C4', topColor2: '#F4F0EA', bottom: 'maxi', bottomColor: '#8A6E52', shoes: 'heels', shoeColor: '#E9C46A', extra: 'bag', extraColor: '#1B1214',
  }),
  doll('efua', 'Efua', 'Accra', 'Ghana', 'Afro-chill', 'Deaf poet. Signs faster than you talk.', {
    group: 'women', build: 'slim', skin: '#3B2219', eyes: 'contacts', eyeColor: '#B9C3CF', brows: 'natural', mouth: 'smirk',
    hair: 'tyla-braids', hairColor: '#1B1214', hairColor2: '#7A4A2E', makeup: 'natural-glow', lip: '#6E2D2D', hearingAid: true,
    piercings: ['ears'], top: 'jersey', topColor: '#F3C13A', topColor2: '#0E7C66', bottom: 'shorts', bottomColor: '#F4F0EA', shoes: 'sneakers', shoeColor: '#FFFFFF',
  }),

  /* ------------------------------------------------------------------ men */
  doll('femi', 'Femi', 'Lagos', 'Nigeria', 'Alté', 'Mainland producer. Studio sessions till 6am.', {
    group: 'men', build: 'slim', skin: '#4A2A1C', eyes: 'stoner', eyeColor: '#2A1810', brows: 'natural', mouth: 'smirk',
    hair: 'freeform-locs', hairColor: '#1B1214', hairColor2: '#5A3420', makeup: 'none', lip: '#5A2A26', tattoo: 'tears', facialHair: 'goatee',
    piercings: ['ears'], top: 'hoodie', topColor: '#2F6B3A', topColor2: '#F4F0EA', bottom: 'cargo', bottomColor: '#3B3640', shoes: 'chunky', shoeColor: '#F4F0EA', extra: 'chain', extraColor: '#C7CAD1',
  }),
  doll('chidi', 'Chidi', 'Port Harcourt', 'Nigeria', 'Garden City drip', 'Super Eagles jersey on every match day.', {
    group: 'men', build: 'athletic', skin: '#5A3420', eyes: 'shades', eyeColor: '#2A1810', brows: 'bold', mouth: 'grin',
    hair: 'fade', hairColor: '#1B1214', makeup: 'none', lip: '#5A2A26', facialHair: 'full',
    top: 'jersey', topColor: '#0E8A4A', topColor2: '#FFFFFF', bottom: 'joggers', bottomColor: '#1F1D24', shoes: 'sneakers', shoeColor: '#FFFFFF',
  }),
  doll('malik', 'Malik', 'Houston', 'United States', 'Southern smooth', 'Third Ward barber with a camera habit.', {
    group: 'men', build: 'broad', skin: '#6B3E26', eyes: 'glasses', eyeColor: '#2A1810', brows: 'natural', mouth: 'smile',
    hair: 'cornrows', hairColor: '#1B1214', makeup: 'none', lip: '#6A3530', facialHair: 'stubble',
    piercings: ['ears'], top: 'tee', topColor: '#F4F0EA', topColor2: '#B3123F', bottom: 'jeans', bottomColor: '#2B3B66', shoes: 'sneakers', shoeColor: '#B3123F', extra: 'chain', extraColor: '#E9C46A',
  }),
  doll('tunde', 'Baba Tunde', 'Abeokuta', 'Nigeria', 'Agbada classic', 'Retired teacher. Blind since birth, sharpest dresser on the street.', {
    group: 'men', age: 'elder', build: 'broad', skin: '#3B2219', eyes: 'shades', eyeColor: '#2A1810', brows: 'natural', mouth: 'smile',
    hair: 'bald', hairColor: '#D9D4CC', makeup: 'none', lip: '#5A2A26', facialHair: 'full', marks: ['wrinkles'], cane: true,
    top: 'kaftan', topColor: '#3A5BA0', topColor2: '#E9C46A', bottom: 'wide-leg', bottomColor: '#3A5BA0', shoes: 'slides', shoeColor: '#7A4A2E', extra: 'cap', extraColor: '#3A5BA0',
  }),
  doll('kwame', 'Kwame', 'Kumasi', 'Ghana', 'Kente modern', 'Architect, wheelchair user, kente on Fridays.', {
    group: 'men', build: 'slim', skin: '#45240F', eyes: 'round', eyeColor: '#2A1810', brows: 'natural', mouth: 'smirk',
    hair: 'trad-locs', hairColor: '#1B1214', hairColor2: '#3B2219', makeup: 'none', lip: '#5A2A26', facialHair: 'moustache', wheelchair: true,
    top: 'blazer', topColor: '#E9A23B', topColor2: '#1B1214', bottom: 'jeans', bottomColor: '#1F1D24', shoes: 'sneakers', shoeColor: '#FFFFFF',
  }),
  doll('jayden', 'Jayden', 'New York', 'United States', 'Bronx street', 'Sneakerhead. Waves on swim.', {
    group: 'men', build: 'athletic', skin: '#8A5235', eyes: 'almond', eyeColor: '#3B2219', brows: 'slit', mouth: 'smirk',
    hair: 'waves', hairColor: '#1B1214', makeup: 'none', lip: '#6A3530',
    piercings: ['ears', 'brow'], top: 'hoodie', topColor: '#C7CAD1', topColor2: '#1B1214', bottom: 'shorts', bottomColor: '#1F1D24', shoes: 'chunky', shoeColor: '#B3123F', extra: 'cap', extraColor: '#1B1214',
  }),
  doll('mateo', 'Mateo', 'Cartagena', 'Colombia', 'Champeta', 'Afro-Colombian dancer, always in linen.', {
    group: 'men', build: 'slim', skin: '#6B3E26', eyes: 'round', eyeColor: '#3B2219', brows: 'natural', mouth: 'grin',
    hair: 'twists', hairColor: '#1B1214', hairColor2: '#7A4A2E', makeup: 'none', lip: '#6A3530', facialHair: 'moustache',
    piercings: ['ears'], top: 'shirt', topColor: '#F7E7C6', topColor2: '#2FBF71', bottom: 'wide-leg', bottomColor: '#F7E7C6', shoes: 'slides', shoeColor: '#7A4A2E',
  }),
  doll('liam', 'Liam', 'Dublin', 'Ireland', 'Indie sleaze', 'Plays bass badly, loudly.', {
    group: 'men', build: 'slim', skin: '#F1C9A5', eyes: 'glasses', eyeColor: '#4A6FA5', brows: 'natural', mouth: 'smile',
    hair: 'buzz', hairColor: '#B5521B', makeup: 'none', lip: '#C47A70', marks: ['freckles'], facialHair: 'stubble',
    top: 'tee', topColor: '#1F1D24', topColor2: '#FFFFFF', bottom: 'joggers', bottomColor: '#556B2F', shoes: 'sneakers', shoeColor: '#FFFFFF', extra: 'beanie', extraColor: '#2FBF71',
  }),
  doll('kenji', 'Kenji', 'Tokyo', 'Japan', 'Goth', 'Harajuku regular. Eyeliner sharper than his wit.', {
    group: 'men', build: 'slim', skin: '#EBC9A6', eyes: 'almond', eyeColor: '#1B1214', brows: 'thin', mouth: 'pout',
    hair: 'mohawk', hairColor: '#2F6BFF', hairColor2: '#1B1214', makeup: 'goth', lip: '#1B1214',
    piercings: ['ears', 'septum', 'lip'], top: 'tank', topColor: '#1B1214', topColor2: '#C7CAD1', bottom: 'cargo', bottomColor: '#1B1214', shoes: 'boots', shoeColor: '#1B1214', extra: 'chain', extraColor: '#C7CAD1',
  }),
  doll('ade', 'Ade', 'Abuja', 'Nigeria', 'Clean minimal', 'Software dev with albinism and a skincare routine.', {
    group: 'men', build: 'athletic', skin: '#F3D9C6', eyes: 'glasses', eyeColor: '#8FA9C2', brows: 'bleached', mouth: 'smirk',
    hair: 'afro', hairColor: '#F3E2B0', makeup: 'none', lip: '#D38C86', facialHair: 'stubble',
    top: 'shirt', topColor: '#FFFFFF', topColor2: '#1B1214', bottom: 'wide-leg', bottomColor: '#8A8F98', shoes: 'sneakers', shoeColor: '#1B1214',
  }),

  /* ---------------------------------------------------------- androgynous */
  doll('kemi', 'Kemi', 'Lagos', 'Nigeria', 'Art kid', 'Yaba painter. Bleached brows, platinum pixie.', {
    group: 'androgynous', build: 'slim', skin: '#4F2D1C', eyes: 'almond', eyeColor: '#2A1810', brows: 'bleached', mouth: 'smirk',
    hair: 'pixie', hairColor: '#F3E2B0', hairColor2: '#E8E4DE', makeup: 'alt', lip: '#6E2D2D',
    piercings: ['ears', 'bridge'], top: 'blazer', topColor: '#1B1214', topColor2: '#C8FF3D', bottom: 'wide-leg', bottomColor: '#1B1214', shoes: 'boots', shoeColor: '#1B1214',
  }),
  doll('sade', 'Sade', 'Benin City', 'Nigeria', 'Rainbow', 'Bronze caster. Vitiligo, violet microlocs.', {
    group: 'androgynous', build: 'slim', skin: '#5A3420', eyes: 'round', eyeColor: '#3B2219', brows: 'natural', mouth: 'smile',
    hair: 'microlocs', hairColor: '#5B2A86', hairColor2: '#A86BFF', makeup: 'rainbow', lip: '#8E3B46', marks: ['vitiligo'],
    piercings: ['ears', 'septum'], top: 'corset', topColor: '#A86BFF', topColor2: '#1B1214', bottom: 'cargo', bottomColor: '#2A2730', shoes: 'chunky', shoeColor: '#A86BFF',
  }),
  doll('river', 'River', 'Chicago', 'United States', 'E-kid', 'South Side gamer. Bantu knots on stream days.', {
    group: 'androgynous', build: 'slim', skin: '#7A4A2E', eyes: 'glasses', eyeColor: '#3B2219', brows: 'slit', mouth: 'tongue',
    hair: 'bantu', hairColor: '#1B1214', hairColor2: '#FF3D8B', makeup: 'e-girl', lip: '#D2577A',
    piercings: ['ears', 'lip'], top: 'hoodie', topColor: '#FF7AB6', topColor2: '#1B1214', bottom: 'mini', bottomColor: '#1B1214', shoes: 'boots', shoeColor: '#1B1214', extra: 'headphones', extraColor: '#1B1214',
  }),
  doll('nuru', 'Nuru', 'Dar es Salaam', 'Tanzania', 'Editorial', 'Deaf model. Owns every runway they walk.', {
    group: 'androgynous', build: 'slim', skin: '#2E1A12', eyes: 'almond', eyeColor: '#3B2219', brows: 'bleached', mouth: 'pout',
    hair: 'buzz', hairColor: '#F3E2B0', makeup: 'editorial', lip: '#3E1F1F', hearingAid: true,
    piercings: ['ears', 'dermal'], top: 'tank', topColor: '#F4F0EA', topColor2: '#1B1214', bottom: 'wrapper', bottomColor: '#E2612B', shoes: 'slides', shoeColor: '#1B1214',
  }),
  doll('ola', 'Ola', 'Kano', 'Nigeria', 'Ancient city', 'Dye-pit apprentice. Indigo everything.', {
    group: 'androgynous', build: 'athletic', skin: '#6B3E26', eyes: 'round', eyeColor: '#2A1810', brows: 'natural', mouth: 'smirk',
    hair: 'twists', hairColor: '#1B1214', makeup: 'natural-glow', lip: '#6E2D2D',
    piercings: ['ears', 'lip'], top: 'kaftan', topColor: '#26408B', topColor2: '#F4F0EA', bottom: 'joggers', bottomColor: '#26408B', shoes: 'sneakers', shoeColor: '#F4F0EA', extra: 'bucket-hat', extraColor: '#F4F0EA',
  }),
  doll('remy', 'Remy', 'Montreal', 'Canada', 'Goth', 'Skates the Old Port at midnight.', {
    group: 'androgynous', build: 'slim', skin: '#E3B48E', eyes: 'round', eyeColor: '#3A6B5B', brows: 'thin', mouth: 'smirk',
    hair: 'bob', hairColor: '#1B1214', hairColor2: '#2FBF9F', makeup: 'goth', lip: '#3E1F2F',
    piercings: ['ears', 'snakebites'], top: 'shirt', topColor: '#1B1214', topColor2: '#C7CAD1', bottom: 'shorts', bottomColor: '#3B3640', shoes: 'boots', shoeColor: '#1B1214',
  }),
  doll('imani', 'Imani', 'Nairobi', 'Kenya', 'Y2K', 'Wheelchair, blue tips, bubblegum pop.', {
    group: 'androgynous', build: 'slim', skin: '#3B2219', eyes: 'round', eyeColor: '#3B2219', brows: 'arched', mouth: 'grin',
    hair: 'afro', hairColor: '#1B1214', hairColor2: '#2F6BFF', makeup: 'y2k', lip: '#D2577A', wheelchair: true,
    piercings: ['ears', 'nose-stud'], top: 'crop', topColor: '#FF7AB6', topColor2: '#FFFFFF', bottom: 'jeans', bottomColor: '#7C9CD8', shoes: 'chunky', shoeColor: '#FFFFFF', extra: 'headphones', extraColor: '#FF7AB6',
  }),
  doll('yemi', 'Grand Yemi', 'Calabar', 'Nigeria', 'Silver fox', 'Low vision, high taste. Silver locs since 1989.', {
    group: 'androgynous', age: 'elder', build: 'slim', skin: '#5A3420', eyes: 'shades', eyeColor: '#2A1810', brows: 'natural', mouth: 'smile',
    hair: 'trad-locs', hairColor: '#D9D4CC', hairColor2: '#9A958E', makeup: 'none', lip: '#7A3E36', marks: ['wrinkles'], cane: true,
    piercings: ['ears'], top: 'shirt', topColor: '#7A1E3A', topColor2: '#E9C46A', bottom: 'wide-leg', bottomColor: '#2A2730', shoes: 'slides', shoeColor: '#7A4A2E',
  }),
  doll('dre', 'Dre', 'Washington DC', 'United States', 'Go-go', 'DMV to the core. Fulani braids, star by the eye.', {
    group: 'androgynous', build: 'athletic', skin: '#5A3420', eyes: 'stoner', eyeColor: '#2A1810', brows: 'slit', mouth: 'smirk',
    hair: 'fulani', hairColor: '#1B1214', hairColor2: '#C9A227', makeup: 'none', lip: '#6E2D2D', tattoo: 'star',
    piercings: ['ears'], top: 'jersey', topColor: '#B3123F', topColor2: '#F4F0EA', bottom: 'cargo', bottomColor: '#556B2F', shoes: 'sneakers', shoeColor: '#F4F0EA',
  }),
  doll('sami', 'Sami', 'London', 'United Kingdom', 'Road couture', 'Peckham-raised, box braids and a bucket hat.', {
    group: 'androgynous', build: 'slim', skin: '#8A5235', eyes: 'almond', eyeColor: '#3B2219', brows: 'natural', mouth: 'smirk',
    hair: 'box-braids', hairColor: '#1B1214', hairColor2: '#B3123F', makeup: 'natural-glow', lip: '#8E3B46', marks: ['freckles'], tattoo: 'dots',
    piercings: ['ears', 'brow'], top: 'hoodie', topColor: '#1F1D24', topColor2: '#C8FF3D', bottom: 'jeans', bottomColor: '#2B3B66', shoes: 'chunky', shoeColor: '#C8FF3D', extra: 'bucket-hat', extraColor: '#C8FF3D',
  }),
]

export const CAST_BY_ID = new Map(CAST.map((d) => [d.id, d]))

const HAIR_3D: Record<Look2DHair, HairStyleId> = {
  pixie: 'pixie',
  microlocs: 'sisterlocs',
  'trad-locs': 'locs',
  'freeform-locs': 'freeform-locs',
  knotless: 'knotless-braids',
  'box-braids': 'box-braids',
  bussdown: 'long-straight',
  'leave-out': 'sew-in',
  'tyla-braids': 'knotless-braids',
  fulani: 'fulani-braids',
  cornrows: 'cornrows',
  afro: 'afro',
  'curly-fro': 'long-curly',
  puffs: 'puffs',
  bantu: 'bantu-knots',
  twists: 'twists',
  fade: 'fade',
  waves: 'taper',
  buzz: 'buzz',
  bald: 'bald',
  bun: 'bun',
  'high-pony': 'ponytail',
  bob: 'bob',
  'wolf-cut': 'short-cut',
  mohawk: 'mohawk',
  hijab: 'bun',
}

/** A full appearance for the 3D side of the game, built from a 2D look. Outfit stays on free starter pieces. */
export function appearanceFromLook(look: Look2D, starterId: string): Appearance {
  const a = defaultAppearance()
  a.starterId = starterId
  a.base = look.group === 'women' ? 'feminine' : look.group === 'men' ? 'masculine' : 'androgynous'
  a.skin.tone = look.skin
  a.face.eyeColor = look.eyeColor
  a.hair.style = HAIR_3D[look.hair]
  a.hair.color = look.hairColor
  a.hair.dye = { mode: look.hairColor2 === look.hairColor ? 'solid' : 'gradient-ends', color2: look.hairColor2, gloss: 0.3 }
  a.makeup.lipstick = look.makeup === 'none' ? null : look.lip
  a.makeup.brows = look.brows === 'slit' ? 'slit' : look.brows === 'thin' ? 'thin' : look.brows === 'bold' ? 'bold' : 'natural'
  a.facialHair.style = look.facialHair === 'full' ? 'full-beard' : look.facialHair
  if (look.marks.includes('freckles')) a.skin.marks.freckles = 0.6
  if (look.marks.includes('vitiligo')) a.skin.marks.vitiligo = 0.5
  a.look = structuredClone(look)
  return a
}

/** The cast as globe residents: each sits in their home city. */
export function castPlace(d: CastDoll): { lat: number; lng: number } {
  const c = findCity(d.city, d.country)
  // Spread dolls who share a city so their bubbles do not stack.
  const twins = CAST.filter((x) => x.city === d.city)
  const i = twins.indexOf(d)
  const a = (i / Math.max(1, twins.length)) * Math.PI * 2
  const r = twins.length > 1 ? 1.4 : 0
  return { lat: (c?.lat ?? 6.5) + Math.sin(a) * r, lng: (c?.lng ?? 3.4) + Math.cos(a) * r }
}
