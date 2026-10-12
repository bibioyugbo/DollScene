import type {
  BodyState,
  BrowStyle,
  CurlPattern,
  DyeMode,
  EdgeStyle,
  Eyeliner,
  FaceState,
  FacialHairStyle,
  Gem,
  HairAccessoryId,
  HairStyleId,
  Jewellery,
  Lashes,
  MakeupState,
  Metal,
  NailPattern,
  NailShape,
  Parting,
  PiercingSite,
  SkinMarkKind,
  SpecialLook,
  TattooRegion,
  Undertone,
} from '../shared/types'

type Opt<T extends string> = { id: T; label: string }

/** Black skin first and in depth: deep, medium and light ranges, each with many steps. */
export const SKIN_GROUPS: { label: string; tones: string[] }[] = [
  { label: 'Deep', tones: ['#1F110B', '#2A170F', '#2E1A12', '#3B2219', '#45240F', '#4F2D1C', '#5A3420', '#5E3A26'] },
  { label: 'Medium', tones: ['#6B3E26', '#7A4A2E', '#7E4B2A', '#8A5235', '#94603D', '#9C6644', '#A86A46', '#B07450'] },
  { label: 'Light', tones: ['#C08A62', '#C98B63', '#D29E78', '#DDAE88', '#E3B48E', '#ECC5A3', '#F1C9A5', '#F6D8BE'] },
]

export const UNDERTONES: Opt<Undertone>[] = [
  { id: 'warm', label: 'Warm' },
  { id: 'cool', label: 'Cool' },
  { id: 'neutral', label: 'Neutral' },
  { id: 'golden', label: 'Golden' },
  { id: 'red', label: 'Red' },
]

export const SKIN_MARKS: Opt<SkinMarkKind>[] = [
  { id: 'freckles', label: 'Freckles' },
  { id: 'beauty-marks', label: 'Beauty marks' },
  { id: 'birthmark', label: 'Birthmark' },
  { id: 'vitiligo', label: 'Vitiligo' },
  { id: 'scars', label: 'Scars' },
  { id: 'stretch-marks', label: 'Stretch marks' },
]

export const FACE_PRESETS: { id: string; label: string; face: Partial<FaceState> }[] = [
  { id: 'oval', label: 'Oval', face: { jaw: 0.4, chin: 0.5, cheekbones: 0.6, forehead: 0.5 } },
  { id: 'round', label: 'Round', face: { jaw: 0.6, chin: 0.35, cheekbones: 0.7, forehead: 0.45 } },
  { id: 'heart', label: 'Heart', face: { jaw: 0.25, chin: 0.4, cheekbones: 0.75, forehead: 0.65 } },
  { id: 'square', label: 'Square', face: { jaw: 0.8, chin: 0.6, cheekbones: 0.5, forehead: 0.5 } },
  { id: 'diamond', label: 'Diamond', face: { jaw: 0.35, chin: 0.6, cheekbones: 0.85, forehead: 0.35 } },
  { id: 'oblong', label: 'Oblong', face: { jaw: 0.5, chin: 0.65, cheekbones: 0.55, forehead: 0.7 } },
]

export const FACE_SLIDERS: { key: keyof FaceState; label: string }[] = [
  { key: 'nose', label: 'Nose width' },
  { key: 'lips', label: 'Lip fullness' },
  { key: 'jaw', label: 'Jaw' },
  { key: 'cheekbones', label: 'Cheekbones' },
  { key: 'chin', label: 'Chin' },
  { key: 'forehead', label: 'Forehead' },
  { key: 'eyeSize', label: 'Eye size' },
  { key: 'eyeSpacing', label: 'Eye spacing' },
  { key: 'eyeShape', label: 'Eye shape (round → almond)' },
  { key: 'brows', label: 'Brow height' },
  { key: 'asymmetry', label: 'Subtle asymmetry' },
]

export const EYE_COLORS = ['#2A1810', '#3B2219', '#5C3A1E', '#6B4A2B', '#8A6A3B', '#5B7F3A', '#3A6B5B', '#4A6FA5', '#7A8A99', '#1B1214']
/** Coloured contacts. */
export const CONTACT_COLORS = ['#A8D8FF', '#7CF0CF', '#B794F6', '#E9C46A', '#C8FF3D', '#FF2E88', '#C7CAD1', '#F4F0EA']

export const LINER_SHADES = ['#3E1F1F', '#5E2A2A', '#7B1E3B', '#8B3A1A', '#B5651D', '#141014']

export const FACIAL_HAIR: Opt<FacialHairStyle>[] = [
  { id: 'none', label: 'Clean-shaven' },
  { id: 'stubble', label: 'Stubble' },
  { id: 'moustache', label: 'Moustache' },
  { id: 'goatee', label: 'Goatee' },
  { id: 'short-beard', label: 'Short beard' },
  { id: 'full-beard', label: 'Full beard' },
  { id: 'sideburns', label: 'Sideburns' },
  { id: 'chin-strap', label: 'Chin strap' },
]

/** Mix-and-match starting points. Every value stays editable after applying. */
export const MAKEUP_PRESETS: { id: string; label: string; makeup: Partial<MakeupState> }[] = [
  { id: 'makeup-free', label: 'Makeup-free', makeup: { foundation: 0, blush: null, contour: 0, highlight: 0, eyeshadow: null, eyeliner: 'none', lashes: 'none', lipstick: null, lipLiner: null, gloss: 0.1, look: 'none' } },
  { id: 'natural', label: 'Natural', makeup: { foundation: 0.25, blush: '#C96A6A', blushAmount: 0.2, contour: 0.1, highlight: 0.25, eyeshadow: null, eyeliner: 'none', lashes: 'natural', lipstick: null, lipLiner: null, gloss: 0.35, look: 'none' } },
  { id: 'clean-girl', label: 'Clean girl', makeup: { foundation: 0.2, blush: '#C96A6A', blushAmount: 0.3, contour: 0.15, highlight: 0.7, eyeshadow: null, eyeliner: 'none', lashes: 'natural', brows: 'laminated', lipstick: null, lipLiner: '#8B3A1A', gloss: 0.95, look: 'none' } },
  { id: 'soft-glam', label: 'Soft glam', makeup: { foundation: 0.6, blush: '#E87A90', blushAmount: 0.4, contour: 0.35, highlight: 0.6, eyeshadow: '#C68E5C', eyeliner: 'thin', lashes: 'volume', lipstick: '#C9707A', lipLiner: '#8E3B46', gloss: 0.6, look: 'none' } },
  { id: 'full-beat', label: 'Full beat', makeup: { foundation: 0.85, blush: '#D2577A', blushAmount: 0.45, contour: 0.7, highlight: 0.85, eyeshadow: '#7B1E3B', eyeliner: 'wing', lashes: 'drama', brows: 'bold', lipstick: '#7B1E3B', lipLiner: '#3E1F1F', gloss: 0.4, look: 'none' } },
  { id: 'smoky', label: 'Smoky eye', makeup: { eyeshadow: '#2B2B2B', eyeliner: 'thin', lashes: 'drama', lipstick: '#8E3B46', gloss: 0.3, look: 'none' } },
  { id: 'graphic', label: 'Graphic liner', makeup: { eyeshadow: null, eyeliner: 'graphic', lashes: 'natural', lipstick: null, gloss: 0.5, look: 'none' } },
  { id: 'goth', label: 'Goth', makeup: { foundation: 0.5, blush: null, contour: 0.5, highlight: 0.2, eyeshadow: '#3B1A2E', eyeliner: 'graphic', lashes: 'drama', brows: 'thin', lipstick: '#141014', lipLiner: '#141014', gloss: 0.2, look: 'none' } },
  { id: 'alt', label: 'Alt & grunge', makeup: { foundation: 0.3, blush: null, eyeshadow: '#5E2A2A', eyeliner: 'graphic', lashes: 'volume', brows: 'slit', lipstick: '#5E2A2A', gloss: 0.1, look: 'none' } },
  { id: 'kawaii', label: 'Kawaii', makeup: { foundation: 0.3, blush: '#FF9E80', blushAmount: 0.75, highlight: 0.5, eyeshadow: '#FFB3D1', eyeliner: 'thin', lashes: 'volume', lipstick: '#E8A0A0', gloss: 0.85, look: 'freckle-art' } },
  { id: 'e-girl', label: 'E-girl', makeup: { blush: '#FF9E80', blushAmount: 0.8, eyeshadow: '#FF2E88', eyeliner: 'wing', lashes: 'volume', brows: 'thin', lipstick: '#A0153E', gloss: 0.5, look: 'face-gems' } },
  { id: 'y2k', label: 'Y2K', makeup: { eyeshadow: '#C9F0FF', eyeliner: 'thin', lashes: 'volume', brows: 'skinny', lipstick: '#C68E5C', lipLiner: '#5E2A2A', gloss: 1, look: 'glitter' } },
  { id: 'editorial', label: 'Editorial', makeup: { foundation: 0.5, blush: null, contour: 0.4, highlight: 0.95, eyeshadow: '#FF2E88', eyeliner: 'graphic', lashes: 'none', brows: 'laminated', lipstick: null, gloss: 0.2, look: 'chrome' } },
  { id: 'glitter', label: 'Glitter & gems', makeup: { eyeshadow: '#E9C46A', eyeliner: 'wing', lashes: 'volume', lipstick: '#C9707A', gloss: 0.9, look: 'glitter' } },
]

export const BODY_PRESETS: { id: string; label: string; body: Partial<BodyState> }[] = [
  { id: 'hourglass', label: 'Hourglass', body: { shoulders: 0.45, waist: 0.3, hips: 0.7, bust: 0.6, softness: 0.5 } },
  { id: 'curvy', label: 'Curvy', body: { shoulders: 0.5, waist: 0.45, hips: 0.85, bust: 0.75, softness: 0.7 } },
  { id: 'slim', label: 'Slim', body: { shoulders: 0.4, waist: 0.25, hips: 0.4, bust: 0.35, softness: 0.3 } },
  { id: 'athletic', label: 'Athletic', body: { shoulders: 0.65, waist: 0.4, hips: 0.5, bust: 0.4, muscle: 0.7 } },
  { id: 'plus', label: 'Plus', body: { shoulders: 0.6, waist: 0.75, hips: 0.95, bust: 0.85, softness: 0.9 } },
  { id: 'tall', label: 'Tall & lean', body: { height: 1.12, legs: 0.8, waist: 0.35, hips: 0.45 } },
  { id: 'petite', label: 'Petite', body: { height: 0.9, legs: 0.4, shoulders: 0.4 } },
]

export const BODY_SLIDERS: { key: keyof BodyState; label: string; min?: number; max?: number }[] = [
  { key: 'height', label: 'Height', min: 0.85, max: 1.15 },
  { key: 'shoulders', label: 'Shoulders' },
  { key: 'bust', label: 'Bust / chest' },
  { key: 'waist', label: 'Waist' },
  { key: 'hips', label: 'Hips & curves' },
  { key: 'legs', label: 'Leg length' },
  { key: 'muscle', label: 'Muscle definition' },
  { key: 'softness', label: 'Softness' },
]

export const HAIR_GROUPS: { label: string; styles: Opt<HairStyleId>[] }[] = [
  {
    label: 'Short & alternative',
    styles: [
      { id: 'pixie', label: 'Pixie' },
      { id: 'fringe-bob', label: 'Fringe bob' },
      { id: 'mohawk', label: 'Mohawk' },
      { id: 'shaved-sides', label: 'Shaved sides' },
    ],
  },
  {
    label: 'Long & updos',
    styles: [
      { id: 'long-straight', label: 'Long straight' },
      { id: 'long-curly', label: 'Long curly' },
      { id: 'ponytail', label: 'Ponytail' },
    ],
  },
  {
    label: 'Natural',
    styles: [
      { id: 'afro', label: 'Afro' },
      { id: 'twa', label: 'TWA' },
      { id: 'puffs', label: 'Puffs' },
      { id: 'high-puff', label: 'High puff' },
      { id: 'natural-updo', label: 'Natural updo' },
      { id: 'bantu-knots', label: 'Bantu knots' },
      { id: 'twists', label: 'Twists' },
    ],
  },
  {
    label: 'Locs',
    styles: [
      { id: 'locs', label: 'Locs' },
      { id: 'sisterlocs', label: 'Sisterlocs' },
      { id: 'freeform-locs', label: 'Freeform' },
      { id: 'faux-locs', label: 'Faux locs' },
    ],
  },
  {
    label: 'Braids',
    styles: [
      { id: 'knotless-braids', label: 'Knotless' },
      { id: 'box-braids', label: 'Box braids' },
      { id: 'fulani-braids', label: 'Fulani' },
      { id: 'cornrows', label: 'Cornrows' },
    ],
  },
  {
    label: 'Wigs & pressed',
    styles: [
      { id: 'lace-front', label: 'Lace front' },
      { id: 'sew-in', label: 'Sew-in' },
      { id: 'silk-press', label: 'Silk press' },
      { id: 'bob', label: 'Bob' },
      { id: 'bun', label: 'Bun' },
    ],
  },
  {
    label: 'Cuts',
    styles: [
      { id: 'fade', label: 'Fade' },
      { id: 'taper', label: 'Taper' },
      { id: 'short-cut', label: 'Short cut' },
      { id: 'buzz', label: 'Buzz' },
      { id: 'bald', label: 'Bald' },
    ],
  },
]

export const HAIR_COLORS = ['#1B1214', '#2A1A14', '#3B2219', '#5C3A1E', '#6B3E26', '#8C5A3C', '#B07A4A', '#C9A227', '#E9C58A', '#F6E7C8', '#FFFFFF', '#C0392B', '#7A1E3A', '#FF6FAE', '#A86BFF', '#3D7BFF', '#00A88F', '#7CF0CF']

export const CURLS: CurlPattern[] = ['1', '2a', '2c', '3a', '3c', '4a', '4b', '4c']
export const PARTINGS: Opt<Parting>[] = [
  { id: 'none', label: 'None' },
  { id: 'middle', label: 'Middle' },
  { id: 'side-left', label: 'Side L' },
  { id: 'side-right', label: 'Side R' },
  { id: 'zigzag', label: 'Zigzag' },
]
export const DYE_MODES: Opt<DyeMode>[] = [
  { id: 'solid', label: 'Solid' },
  { id: 'ombre', label: 'Ombré' },
  { id: 'balayage', label: 'Balayage' },
  { id: 'highlights', label: 'Highlights' },
  { id: 'peekaboo', label: 'Peekaboo' },
  { id: 'split', label: 'Split dye' },
  { id: 'root-shadow', label: 'Root shadow' },
  { id: 'gradient-ends', label: 'Gradient ends' },
  { id: 'bleached-tips', label: 'Bleached tips' },
]
export const EDGE_STYLES: Opt<EdgeStyle>[] = [
  { id: 'none', label: 'None' },
  { id: 'sleek', label: 'Sleek' },
  { id: 'swoop', label: 'Swoop' },
  { id: 'waves', label: 'Waves' },
  { id: 'scallop', label: 'Scallop' },
  { id: 'dramatic', label: 'Dramatic' },
]
export const HAIR_ACCESSORIES: { id: HairAccessoryId; label: string; premium: boolean }[] = [
  { id: 'clips', label: 'Clips', premium: false },
  { id: 'bows', label: 'Bows', premium: false },
  { id: 'beads', label: 'Beads', premium: true },
  { id: 'cuffs', label: 'Cuffs', premium: true },
  { id: 'scarf', label: 'Scarf', premium: true },
  { id: 'headwrap', label: 'Headwrap', premium: true },
  { id: 'gele', label: 'Gele', premium: true },
  { id: 'flowers', label: 'Flowers', premium: true },
  { id: 'pearls', label: 'Pearls', premium: true },
]

export const LIP_SHADES = ['#3E1F1F', '#5E2A2A', '#6D1A36', '#7B1E3B', '#8E3B46', '#A0153E', '#B00020', '#C9707A', '#D2577A', '#B5651D', '#C68E5C', '#E8A0A0']
export const BLUSH_SHADES = ['#D2577A', '#E87A90', '#C96A6A', '#E8505B', '#FF9E80', '#B5651D']
export const SHADOW_SHADES = ['#A86BFF', '#FF3D8B', '#C9A227', '#00A88F', '#3D7BFF', '#5E2A2A', '#FFC24D', '#1E0B26', '#E9C58A']
export const NAIL_SHADES = ['#FF3D8B', '#FFB3D1', '#A86BFF', '#7CF0CF', '#FFC24D', '#FFFFFF', '#E9E2DC', '#2B2B2B', '#7A1E3A', '#C7A08A', '#B00020', '#3D7BFF']
export const EYELINERS: Opt<Eyeliner>[] = [
  { id: 'none', label: 'None' },
  { id: 'thin', label: 'Thin' },
  { id: 'wing', label: 'Wing' },
  { id: 'graphic', label: 'Graphic' },
]
export const LASHES: Opt<Lashes>[] = [
  { id: 'none', label: 'None' },
  { id: 'natural', label: 'Natural' },
  { id: 'volume', label: 'Volume' },
  { id: 'drama', label: 'Drama' },
]
export const BROWS: Opt<BrowStyle>[] = [
  { id: 'natural', label: 'Natural' },
  { id: 'skinny', label: 'Skinny' },
  { id: 'thin', label: 'Thin' },
  { id: 'thick', label: 'Thick' },
  { id: '2016', label: '2016 Insta' },
  { id: 'shaped', label: 'Shaped arch' },
  { id: 'laminated', label: 'Laminated' },
  { id: 'bold', label: 'Bold' },
  { id: 'slit', label: 'Slit' },
]
export const SPECIAL_LOOKS: Opt<SpecialLook>[] = [
  { id: 'none', label: 'None' },
  { id: 'glitter', label: 'Glitter' },
  { id: 'face-gems', label: 'Face gems' },
  { id: 'freckle-art', label: 'Freckle art' },
  { id: 'tribal-dots', label: 'Dot art' },
  { id: 'chrome', label: 'Chrome lids' },
]
export const NAIL_SHAPES: Opt<NailShape>[] = [
  { id: 'round', label: 'Round' },
  { id: 'square', label: 'Square' },
  { id: 'almond', label: 'Almond' },
  { id: 'coffin', label: 'Coffin' },
  { id: 'stiletto', label: 'Stiletto' },
]
export const NAIL_PATTERNS: Opt<NailPattern>[] = [
  { id: 'solid', label: 'Solid' },
  { id: 'french', label: 'French' },
  { id: 'chrome', label: 'Chrome' },
  { id: 'ombre', label: 'Ombré' },
  { id: 'marble', label: 'Marble' },
  { id: 'ankara', label: 'Ankara' },
  { id: 'glitter', label: 'Glitter' },
]

export const PIERCING_GROUPS: { label: string; sites: Opt<PiercingSite>[] }[] = [
  {
    label: 'Ear',
    sites: [
      { id: 'lobe', label: 'Lobe' },
      { id: 'lobe-2', label: '2nd lobe' },
      { id: 'lobe-3', label: '3rd lobe' },
      { id: 'upper-lobe', label: 'Upper lobe' },
      { id: 'helix', label: 'Helix' },
      { id: 'forward-helix', label: 'Forward helix' },
      { id: 'tragus', label: 'Tragus' },
      { id: 'anti-tragus', label: 'Anti-tragus' },
      { id: 'conch-inner', label: 'Inner conch' },
      { id: 'conch-outer', label: 'Outer conch' },
      { id: 'daith', label: 'Daith' },
      { id: 'rook', label: 'Rook' },
      { id: 'industrial', label: 'Industrial' },
      { id: 'flat', label: 'Flat' },
      { id: 'orbital', label: 'Orbital' },
    ],
  },
  {
    label: 'Face',
    sites: [
      { id: 'nostril', label: 'Nostril' },
      { id: 'high-nostril', label: 'High nostril' },
      { id: 'septum', label: 'Septum' },
      { id: 'bridge', label: 'Bridge' },
      { id: 'eyebrow', label: 'Eyebrow' },
      { id: 'labret', label: 'Labret' },
      { id: 'monroe', label: 'Monroe' },
      { id: 'medusa', label: 'Medusa' },
      { id: 'snake-bites', label: 'Snake bites' },
      { id: 'smiley', label: 'Smiley' },
      { id: 'tongue', label: 'Tongue' },
    ],
  },
  {
    label: 'Body',
    sites: [
      { id: 'navel', label: 'Navel' },
      { id: 'dermal', label: 'Dermal anchor' },
      { id: 'surface', label: 'Surface (nape)' },
    ],
  },
]
export const JEWELLERY: Opt<Jewellery>[] = [
  { id: 'stud', label: 'Stud' },
  { id: 'hoop', label: 'Hoop' },
  { id: 'barbell', label: 'Barbell' },
  { id: 'ring', label: 'Ring' },
  { id: 'chain', label: 'Chain' },
  { id: 'cuff', label: 'Cuff' },
]
export const METALS: Opt<Metal>[] = [
  { id: 'gold', label: 'Gold' },
  { id: 'silver', label: 'Silver' },
  { id: 'rose-gold', label: 'Rose gold' },
  { id: 'black', label: 'Black' },
  { id: 'titanium', label: 'Titanium' },
]
export const GEMS: Opt<Gem>[] = [
  { id: 'none', label: 'None' },
  { id: 'diamond', label: 'Diamond' },
  { id: 'ruby', label: 'Ruby' },
  { id: 'emerald', label: 'Emerald' },
  { id: 'sapphire', label: 'Sapphire' },
  { id: 'opal', label: 'Opal' },
  { id: 'pearl', label: 'Pearl' },
]

export const TATTOO_REGIONS: { group: string; regions: Opt<TattooRegion>[] }[] = [
  { group: 'Head & neck', regions: [{ id: 'face', label: 'Face' }, { id: 'neck', label: 'Neck' }] },
  {
    group: 'Torso',
    regions: [
      { id: 'chest', label: 'Chest' },
      { id: 'back', label: 'Back' },
      { id: 'ribs', label: 'Ribs' },
      { id: 'stomach', label: 'Stomach' },
      { id: 'hip-l', label: 'Left hip' },
      { id: 'hip-r', label: 'Right hip' },
    ],
  },
  {
    group: 'Arms & hands',
    regions: [
      { id: 'shoulder-l', label: 'L shoulder' },
      { id: 'shoulder-r', label: 'R shoulder' },
      { id: 'arm-l', label: 'L upper arm' },
      { id: 'arm-r', label: 'R upper arm' },
      { id: 'forearm-l', label: 'L forearm' },
      { id: 'forearm-r', label: 'R forearm' },
      { id: 'hand-l', label: 'L hand' },
      { id: 'hand-r', label: 'R hand' },
      { id: 'fingers', label: 'Fingers' },
    ],
  },
  {
    group: 'Legs & feet',
    regions: [
      { id: 'thigh-l', label: 'L thigh' },
      { id: 'thigh-r', label: 'R thigh' },
      { id: 'calf-l', label: 'L calf' },
      { id: 'calf-r', label: 'R calf' },
      { id: 'ankle-l', label: 'L ankle' },
      { id: 'ankle-r', label: 'R ankle' },
      { id: 'foot-l', label: 'L foot' },
      { id: 'foot-r', label: 'R foot' },
    ],
  },
]

export const PRONOUNS = ['', 'she/her', 'he/him', 'they/them', 'she/they', 'he/they', 'any']
export const GENDER_EXPRESSIONS = ['', 'Feminine', 'Masculine', 'Androgynous', 'Fluid', 'Prefer not to say']
export const ORIENTATIONS = ['', 'Straight', 'Gay', 'Lesbian', 'Bisexual', 'Pansexual', 'Queer', 'Asexual', 'Prefer not to say']
export const DATING_PREFS = ['', 'Not dating', 'Women', 'Men', 'Everyone', 'Non-binary folks', 'Friends only']
export const STYLE_TAGS_LEGACY = ['It Girl', 'Soft Life', 'Baddie', 'Fashionista', 'Socialite', 'Creative', 'Boss', 'Influencer', 'Street', 'Old Money', 'Alté', 'Owambe Royalty', 'New in town']

export const STYLE_TAGS = ['New in town', 'Fashionista', 'Baddie', 'Soft Life', 'It Girl', 'Alté', 'Street', 'Goth', 'Kawaii', 'Old Money', 'Socialite', 'Creative', 'Boss', 'Owambe Royalty']
