import { defaultAppearance } from './appearance'
import type { Appearance, BodyState, FaceState, FacialHair, HairLook, MakeupState, Outfit, SkinState } from './types'

export type StarterGroup = 'women' | 'men' | 'androgynous'

export interface StarterDoll {
  id: string
  name: string
  group: StarterGroup
  blurb: string
  appearance: Appearance
}

interface StarterInput {
  id: string
  name: string
  group: StarterGroup
  blurb: string
  skin: Partial<SkinState>
  face?: Partial<FaceState>
  body?: Partial<BodyState>
  hair: Partial<HairLook>
  makeup?: Partial<MakeupState>
  facialHair?: Partial<FacialHair>
  outfit: Outfit
}

function build(s: StarterInput): StarterDoll {
  const a = defaultAppearance()
  a.starterId = s.id
  a.base = s.group === 'women' ? 'feminine' : s.group === 'men' ? 'masculine' : 'androgynous'
  a.skin = { ...a.skin, ...s.skin }
  a.face = { ...a.face, ...s.face }
  a.body = { ...a.body, ...s.body }
  a.hair = { ...a.hair, ...s.hair, dye: { ...a.hair.dye, ...s.hair.dye }, edges: { ...a.hair.edges, ...s.hair.edges } }
  a.makeup = { ...a.makeup, ...s.makeup }
  a.outfit = s.outfit
  a.facialHair = { ...a.facialHair, ...s.facialHair }
  if (s.group === 'men') {
    a.makeup = { ...a.makeup, blush: null, lipstick: null, gloss: 0.1, eyeliner: 'none', lashes: 'none', highlight: 0.2, foundation: 0 }
    a.nails = { ...a.nails, color: '#C7A08A', length: 0, shape: 'square' }
  }
  return { id: s.id, name: s.name, group: s.group, blurb: s.blurb, appearance: a }
}

/**
 * The 12 hand-built base characters. Real GLBs replace the placeholders by id:
 * public/models/starters/<id>.glb (see docs/ASSET_SPEC.md).
 */
export const STARTERS: StarterDoll[] = [
  build({
    id: 'ada',
    name: 'Ada',
    group: 'women',
    blurb: 'Lagos girl in gele and oleku, owambe-ready.',
    skin: { tone: '#6B3E26', undertone: 'red' },
    face: { preset: 'oval', lips: 0.7, cheekbones: 0.65, eyeSize: 0.6 },
    body: { preset: 'hourglass', height: 1.02, waist: 0.3, hips: 0.7, bust: 0.6 },
    hair: { style: 'knotless-braids', length: 0.85, color: '#1B1214', dye: { mode: 'gradient-ends', color2: '#C9A227', gloss: 0.4 }, edges: { style: 'swoop', density: 0.7, swirl: 0.7 }, accessories: ['cuffs'] },
    makeup: { lipstick: '#7B1E3B', eyeliner: 'wing', lashes: 'volume' },
    outfit: { headwear: 'starter-gele-gold', top: 'starter-buba-oleku', bottom: 'starter-iro-ankara', shoes: 'starter-sandals', earrings: 'starter-studs' },
  }),
  build({
    id: 'chioma',
    name: 'Chioma',
    group: 'women',
    blurb: 'Enugu lawyer: coral beads, George wrapper, zero nonsense.',
    skin: { tone: '#7A4A2E', undertone: 'golden' },
    face: { preset: 'round', lips: 0.65, cheekbones: 0.6, eyeSize: 0.62 },
    body: { preset: 'curvy', height: 1.0, waist: 0.4, hips: 0.8, bust: 0.65 },
    hair: { style: 'silk-press', length: 0.6, color: '#1B1214', edges: { style: 'sleek', density: 0.5, swirl: 0.4 } },
    makeup: { lipstick: '#9E2B25', eyeliner: 'wing', lashes: 'volume' },
    outfit: { headwear: 'starter-gele-fuchsia', top: 'starter-igbo-blouse', bottom: 'starter-george-wrapper', necklace: 'starter-coral-beads', shoes: 'starter-sandals', earrings: 'starter-studs' },
  }),
  build({
    id: 'zainab',
    name: 'Zainab',
    group: 'women',
    blurb: 'Kano-born Abuja architect in a Hausa crop and zani.',
    skin: { tone: '#8A5235', undertone: 'golden' },
    face: { preset: 'heart', nose: 0.45, eyeShape: 0.75, eyeColor: '#2A1810' },
    body: { preset: 'slim', height: 1.08, waist: 0.25, hips: 0.45, bust: 0.4, legs: 0.7 },
    hair: { style: 'silk-press', length: 0.8, color: '#1B1214', parting: 'middle', edges: { style: 'sleek', density: 0.4, swirl: 0.3 } },
    makeup: { lipstick: '#B5651D', eyeshadow: '#C9A227' },
    outfit: { headwear: 'starter-dankwali', top: 'starter-hausa-crop', bottom: 'starter-zani-wrapper', shoes: 'starter-sandals', earrings: 'starter-studs' },
  }),
  build({
    id: 'imani',
    name: 'Imani',
    group: 'women',
    blurb: 'Nairobi DJ with a vinyl habit.',
    skin: { tone: '#3B2219', undertone: 'cool' },
    face: { preset: 'round', lips: 0.75, nose: 0.6, eyeSize: 0.6 },
    body: { preset: 'curvy', height: 0.96, waist: 0.45, hips: 0.85, bust: 0.75, softness: 0.7 },
    hair: { style: 'afro', volume: 0.85, color: '#1B1214', curl: '4c', edges: { style: 'none', density: 0, swirl: 0 } },
    makeup: { lipstick: '#A0153E', gloss: 0.8, eyeshadow: '#A86BFF' },
    outfit: { top: 'starter-tank-pink', bottom: 'starter-mini-skirt-pink', shoes: 'starter-boots' },
  }),
  build({
    id: 'chloe',
    name: 'Chloé',
    group: 'women',
    blurb: 'Parisian stylist, Martinican roots.',
    skin: { tone: '#C98B63', undertone: 'neutral', marks: { freckles: 0.6 } },
    face: { preset: 'diamond', nose: 0.4, jaw: 0.3, eyeColor: '#5B7F3A' },
    body: { preset: 'athletic', height: 1.04, waist: 0.35, hips: 0.5, bust: 0.45, muscle: 0.5 },
    hair: { style: 'puffs', color: '#3B2219', curl: '3c', dye: { mode: 'highlights', color2: '#E9C58A', gloss: 0.3 }, accessories: ['bows'] },
    makeup: { lipstick: '#D2577A', blush: '#E87A90' },
    outfit: { top: 'starter-shirt-blue', bottom: 'starter-trousers-camel', shoes: 'starter-sneakers-white' },
  }),
  build({
    id: 'tunde',
    name: 'Tunde',
    group: 'men',
    blurb: 'Ibadan-born producer, agbada on Fridays.',
    skin: { tone: '#5A3420', undertone: 'warm' },
    face: { preset: 'square', jaw: 0.7, chin: 0.6, brows: 0.6 },
    body: { preset: 'athletic', height: 1.1, shoulders: 0.75, waist: 0.55, hips: 0.35, bust: 0, muscle: 0.7 },
    hair: { style: 'fade', color: '#1B1214', edges: { style: 'sleek', density: 0.3, swirl: 0.1 } },
    facialHair: { style: 'short-beard', density: 0.8 },
    outfit: { headwear: 'starter-fila', top: 'starter-tee-white', outerwear: 'starter-agbada-white', bottom: 'starter-trousers-camel', shoes: 'starter-sandals' },
  }),
  build({
    id: 'obinna',
    name: 'Obinna',
    group: 'men',
    blurb: 'Onitsha trader’s son, isiagu and red cap for every occasion.',
    skin: { tone: '#4A2A1A', undertone: 'warm' },
    face: { preset: 'oblong', jaw: 0.65, nose: 0.55, brows: 0.55 },
    body: { preset: 'average', height: 1.06, shoulders: 0.7, waist: 0.55, hips: 0.4, bust: 0, muscle: 0.55 },
    hair: { style: 'short-cut', color: '#1B1214', curl: '4c', edges: { style: 'none', density: 0, swirl: 0 } },
    facialHair: { style: 'goatee', density: 0.7 },
    outfit: { headwear: 'starter-okpu-red', top: 'starter-isiagu', necklace: 'starter-coral-beads', bottom: 'starter-trousers-black', shoes: 'starter-sandals' },
  }),
  build({
    id: 'kofi',
    name: 'Kofi',
    group: 'men',
    blurb: 'Accra photographer chasing golden hour.',
    skin: { tone: '#45240F', undertone: 'cool' },
    face: { preset: 'oblong', nose: 0.6, lips: 0.65 },
    body: { preset: 'slim', height: 1.06, shoulders: 0.6, waist: 0.5, hips: 0.35, bust: 0, legs: 0.65 },
    hair: { style: 'locs', length: 0.6, color: '#1B1214', dye: { mode: 'bleached-tips', color2: '#E9C58A', gloss: 0.2 }, accessories: ['cuffs'] },
    facialHair: { style: 'stubble', density: 0.6 },
    outfit: { top: 'starter-shirt-blue', bottom: 'starter-jeans', shoes: 'starter-chunky-sneakers' },
  }),
  build({
    id: 'mathieu',
    name: 'Mathieu',
    group: 'men',
    blurb: 'Lyon chef who learned jollof from his mother-in-law.',
    skin: { tone: '#E3B48E', undertone: 'neutral', marks: { 'beauty-marks': 0.5 } },
    face: { preset: 'oval', nose: 0.55, jaw: 0.6, eyeColor: '#4A6FA5' },
    body: { preset: 'average', height: 1.0, shoulders: 0.65, waist: 0.6, hips: 0.4, bust: 0, softness: 0.6 },
    hair: { style: 'short-cut', color: '#3B2219', curl: '2a', edges: { style: 'none', density: 0, swirl: 0 } },
    facialHair: { style: 'moustache', color: '#3B2219', density: 0.7 },
    outfit: { top: 'starter-tee-white', bottom: 'starter-trousers-camel', shoes: 'starter-chunky-sneakers' },
  }),
  build({
    id: 'jaylen',
    name: 'Jaylen',
    group: 'men',
    blurb: 'Atlanta point guard turned fashion kid.',
    skin: { tone: '#7A4A2E', undertone: 'red' },
    face: { preset: 'round', lips: 0.6, cheekbones: 0.55 },
    body: { preset: 'tall', height: 1.14, shoulders: 0.7, waist: 0.5, hips: 0.35, bust: 0, legs: 0.75, muscle: 0.6 },
    hair: { style: 'cornrows', color: '#1B1214', edges: { style: 'waves', density: 0.4, swirl: 0.4 } },
    outfit: { top: 'starter-hoodie-grey', bottom: 'starter-shorts-denim', shoes: 'starter-chunky-sneakers' },
  }),
  build({
    id: 'kemi',
    name: 'Kemi',
    group: 'androgynous',
    blurb: 'Lagos painter, gender-free wardrobe.',
    skin: { tone: '#4F2D1C', undertone: 'golden', marks: { vitiligo: 0.5 } },
    face: { preset: 'heart', cheekbones: 0.75, eyeShape: 0.7 },
    body: { preset: 'slim', height: 1.03, shoulders: 0.55, waist: 0.4, hips: 0.45, bust: 0.2 },
    hair: { style: 'twa', color: '#1B1214', dye: { mode: 'solid', color2: '#FF3D8B', gloss: 0.3 }, edges: { style: 'none', density: 0, swirl: 0 } },
    makeup: { lipstick: '#5E2A2A', eyeliner: 'graphic', blush: null },
    outfit: { top: 'starter-tee-black', bottom: 'starter-trousers-black', shoes: 'starter-boots', earrings: 'starter-studs' },
  }),
  build({
    id: 'sage',
    name: 'Sage',
    group: 'androgynous',
    blurb: 'London poet with a plant for every mood.',
    skin: { tone: '#A86A46', undertone: 'neutral', marks: { freckles: 0.4 } },
    face: { preset: 'oval', nose: 0.5, lips: 0.5, eyeColor: '#6B4A2B' },
    body: { preset: 'average', height: 0.98, shoulders: 0.5, waist: 0.45, hips: 0.5, bust: 0.25 },
    hair: { style: 'twists', length: 0.45, color: '#2A1A14', dye: { mode: 'ombre', color2: '#A86BFF', gloss: 0.3 } },
    makeup: { lipstick: null, gloss: 0.5, blush: '#C96A6A' },
    outfit: { top: 'starter-hoodie-grey', bottom: 'starter-midi-skirt-cream', shoes: 'starter-sneakers-black' },
  }),
  build({
    id: 'remy',
    name: 'Remy',
    group: 'androgynous',
    blurb: 'Montreal skater who never misses a drop.',
    skin: { tone: '#F1C9A5', undertone: 'cool', marks: { 'beauty-marks': 0.4 } },
    face: { preset: 'diamond', jaw: 0.45, eyeColor: '#3A6B5B' },
    body: { preset: 'slim', height: 1.0, shoulders: 0.5, waist: 0.4, hips: 0.4, bust: 0.15, legs: 0.6 },
    hair: { style: 'bob', length: 0.4, color: '#1B1214', dye: { mode: 'split', color2: '#7CF0CF', gloss: 0.4 }, parting: 'side-left' },
    makeup: { lipstick: '#C9707A', eyeliner: 'wing' },
    outfit: { top: 'starter-tee-white', bottom: 'starter-shorts-denim', shoes: 'starter-sneakers-black' },
  }),
  build({
    id: 'nuru',
    name: 'Nuru',
    group: 'androgynous',
    blurb: 'Dar es Salaam dancer and part-time model.',
    skin: { tone: '#2E1A12', undertone: 'cool' },
    face: { preset: 'oblong', cheekbones: 0.8, lips: 0.7, eyeSize: 0.6 },
    body: { preset: 'tall', height: 1.12, shoulders: 0.55, waist: 0.35, hips: 0.5, bust: 0.2, legs: 0.85, muscle: 0.45 },
    hair: { style: 'bantu-knots', color: '#1B1214', edges: { style: 'scallop', density: 0.6, swirl: 0.6 } },
    makeup: { lipstick: '#3E1F1F', gloss: 0.7, highlight: 0.8 },
    outfit: { top: 'starter-tank-pink', bottom: 'starter-trousers-black', shoes: 'starter-sandals' },
  }),
  // ---- More default dolls: streetwear, classy, basics, thrift, edgy, gym and trad.
  build({
    id: 'tiwa', name: 'Tiwa', group: 'women', blurb: 'Lekki baddie: corset, leather mini, gold hoops.',
    skin: { tone: '#8A5235', undertone: 'golden' }, face: { preset: 'heart', lips: 0.8, cheekbones: 0.7 },
    body: { preset: 'hourglass', height: 1.02, waist: 0.25, hips: 0.8, bust: 0.7 },
    hair: { style: 'long-straight', length: 0.95, color: '#1B1214', parting: 'middle', edges: { style: 'dramatic', density: 0.8, swirl: 0.8 } },
    makeup: { lipstick: '#5E1A2C', eyeliner: 'wing', lashes: 'volume', gloss: 0.7 },
    outfit: { top: 'starter-corset-black', bottom: 'starter-mini-skirt-leather', shoes: 'starter-heels-black', earrings: 'starter-hoops-gold', bag: 'starter-clutch-gold' },
  }),
  build({
    id: 'amara', name: 'Amara', group: 'women', blurb: 'Ikoyi gallerist in emerald satin.',
    skin: { tone: '#5A3420', undertone: 'red' }, face: { preset: 'oval', lips: 0.7, eyeSize: 0.6 },
    body: { preset: 'slim', height: 1.08, waist: 0.3, hips: 0.55, bust: 0.5, legs: 0.75 },
    hair: { style: 'silk-press', length: 0.7, color: '#1B1214', parting: 'side-left', edges: { style: 'sleek', density: 0.5, swirl: 0.3 }, accessories: ['pearls'] },
    makeup: { lipstick: '#9E2B25', eyeliner: 'wing' },
    outfit: { dress: 'starter-gown-emerald', shoes: 'starter-heels-nude', bag: 'starter-clutch-gold', earrings: 'starter-studs' },
  }),
  build({
    id: 'funke', name: 'Funke', group: 'women', blurb: 'Owambe queen in an ankara boubou and gold gele.',
    skin: { tone: '#6B3E26', undertone: 'warm' }, face: { preset: 'round', lips: 0.7, cheekbones: 0.6 },
    body: { preset: 'curvy', height: 0.98, waist: 0.5, hips: 0.85, bust: 0.75, softness: 0.7 },
    hair: { style: 'bun', color: '#1B1214', edges: { style: 'swoop', density: 0.6, swirl: 0.6 } },
    makeup: { lipstick: '#7B1E3B', eyeshadow: '#C9A227', lashes: 'volume' },
    outfit: { headwear: 'starter-gele-gold', dress: 'starter-boubou-ankara', shoes: 'starter-sandals', earrings: 'starter-hoops-gold' },
  }),
  build({
    id: 'halima', name: 'Halima', group: 'women', blurb: 'Kaduna poet in ivory lace kaftan.',
    skin: { tone: '#A86A46', undertone: 'golden' }, face: { preset: 'heart', nose: 0.4, eyeShape: 0.8, eyeColor: '#2A1810' },
    body: { preset: 'slim', height: 1.04, waist: 0.3, hips: 0.5, bust: 0.45 },
    hair: { style: 'natural-updo', color: '#1B1214' },
    makeup: { lipstick: '#8E3B46', eyeliner: 'wing', eyeshadow: '#C9A227' },
    outfit: { headwear: 'starter-dankwali', dress: 'starter-kaftan-white', shoes: 'starter-sandals', earrings: 'starter-studs' },
  }),
  build({
    id: 'ngozi', name: 'Ngozi', group: 'women', blurb: 'Owerri nurse, coral beads and adire maxi.',
    skin: { tone: '#4F2D1C', undertone: 'warm' }, face: { preset: 'oval', lips: 0.7 },
    body: { preset: 'curvy', height: 1.0, waist: 0.4, hips: 0.75, bust: 0.6 },
    hair: { style: 'puffs', color: '#1B1214', curl: '4c' },
    makeup: { lipstick: '#A0153E' },
    outfit: { top: 'starter-igbo-blouse', bottom: 'starter-maxi-adire', necklace: 'starter-coral-beads', shoes: 'starter-sandals' },
  }),
  build({
    id: 'zara', name: 'Zara', group: 'women', blurb: 'Yaba streetwear kid, bucket hat always.',
    skin: { tone: '#7A4A2E', undertone: 'neutral' }, face: { preset: 'diamond', cheekbones: 0.7 },
    body: { preset: 'athletic', height: 1.03, waist: 0.35, hips: 0.55, bust: 0.45, muscle: 0.4 },
    hair: { style: 'box-braids', length: 0.9, color: '#1B1214', dye: { mode: 'peekaboo', color2: '#FF3D8B', gloss: 0.3 }, accessories: ['beads'] },
    makeup: { lipstick: '#8E3B46', gloss: 0.6 },
    outfit: { headwear: 'starter-bucket-hat', top: 'starter-graphic-tee', bottom: 'starter-cargo-black', shoes: 'starter-sneakers-white', necklace: 'starter-chain-silver' },
  }),
  build({
    id: 'bisola', name: 'Bisola', group: 'women', blurb: 'Pilates instructor, 6am Lekki runs.',
    skin: { tone: '#5A3420', undertone: 'golden' }, face: { preset: 'round', cheekbones: 0.6 },
    body: { preset: 'athletic', height: 1.05, waist: 0.3, hips: 0.6, bust: 0.45, muscle: 0.7 },
    hair: { style: 'high-puff', color: '#1B1214', curl: '4b' },
    makeup: { lipstick: null, gloss: 0.6, highlight: 0.6 },
    outfit: { headwear: 'starter-cap-black', top: 'starter-sports-bra', bottom: 'starter-leggings', shoes: 'starter-sneakers-black' },
  }),
  build({
    id: 'ama', name: 'Ama', group: 'women', blurb: 'Kumasi thrift queen, flannel and faded denim.',
    skin: { tone: '#45240F', undertone: 'cool' }, face: { preset: 'oblong', lips: 0.7, nose: 0.55 },
    body: { preset: 'average', height: 1.0, waist: 0.4, hips: 0.6, bust: 0.5 },
    hair: { style: 'sisterlocs', length: 0.7, color: '#2A1A14', dye: { mode: 'ombre', color2: '#C9A227', gloss: 0.2 }, accessories: ['cuffs'] },
    makeup: { lipstick: '#6E2B2B' },
    outfit: { top: 'starter-check-shirt', bottom: 'starter-thrift-jeans', shoes: 'starter-boots', bag: 'starter-tote-canvas' },
  }),
  build({
    id: 'yewande', name: 'Yewande', group: 'women', blurb: 'Alté guitarist: leather, chains, shaved sides.',
    skin: { tone: '#3B2219', undertone: 'cool' }, face: { preset: 'diamond', jaw: 0.4, cheekbones: 0.8 },
    body: { preset: 'slim', height: 1.04, waist: 0.3, hips: 0.5, bust: 0.4 },
    hair: { style: 'shaved-sides', color: '#1B1214', dye: { mode: 'solid', color2: '#B3123F', gloss: 0.3 } },
    makeup: { lipstick: '#2B0F14', eyeliner: 'graphic', eyeshadow: '#2A2235' },
    outfit: { outerwear: 'starter-leather-jacket', top: 'starter-tee-black', bottom: 'starter-cargo-black', shoes: 'starter-boots', necklace: 'starter-chain-silver' },
  }),
  build({
    id: 'simi', name: 'Simi', group: 'women', blurb: 'Soft-life brunch girl in a rust jumpsuit.',
    skin: { tone: '#C98B63', undertone: 'golden' }, face: { preset: 'heart', lips: 0.6, eyeSize: 0.7 },
    body: { preset: 'curvy', height: 0.98, waist: 0.4, hips: 0.7, bust: 0.6 },
    hair: { style: 'fringe-bob', color: '#3B2219', dye: { mode: 'balayage', color2: '#C9A227', gloss: 0.4 } },
    makeup: { lipstick: '#C9707A', blush: '#E87A90', gloss: 0.6 },
    outfit: { dress: 'starter-jumpsuit-rust', shoes: 'starter-sandals', earrings: 'starter-hoops-gold' },
  }),
  build({
    id: 'lerato', name: 'Lerato', group: 'women', blurb: 'Joburg lawyer: cream blazer, quiet money.',
    skin: { tone: '#6B3E26', undertone: 'neutral' }, face: { preset: 'oval', jaw: 0.4 },
    body: { preset: 'slim', height: 1.07, waist: 0.3, hips: 0.5, bust: 0.45, legs: 0.7 },
    hair: { style: 'bob', length: 0.45, color: '#1B1214', parting: 'side-right' },
    makeup: { lipstick: '#8E3B46', eyeliner: 'wing' },
    outfit: { outerwear: 'starter-blazer-cream', top: 'starter-tee-white', bottom: 'starter-midi-skirt-cream', shoes: 'starter-loafers', bag: 'starter-tote-canvas' },
  }),
  build({
    id: 'adaeze', name: 'Adaeze', group: 'women', blurb: 'Uni girl, white tee and jeans, effortless.',
    skin: { tone: '#7A4A2E', undertone: 'red' }, face: { preset: 'round', lips: 0.65, eyeSize: 0.65 },
    body: { preset: 'average', height: 1.0, waist: 0.4, hips: 0.6, bust: 0.5 },
    hair: { style: 'long-curly', length: 0.8, color: '#2B1B17', curl: '3c' },
    makeup: { lipstick: null, gloss: 0.5 },
    outfit: { top: 'starter-tee-white', bottom: 'starter-jeans', shoes: 'starter-sneakers-white', earrings: 'starter-studs' },
  }),
  build({
    id: 'kiki', name: 'Kiki', group: 'women', blurb: 'Y2K party girl with pink pony and lilac puffer.',
    skin: { tone: '#A86A46', undertone: 'warm' }, face: { preset: 'heart', lips: 0.75, eyeSize: 0.75 },
    body: { preset: 'hourglass', height: 0.98, waist: 0.3, hips: 0.7, bust: 0.6 },
    hair: { style: 'ponytail', length: 0.9, color: '#FF5FA2', dye: { mode: 'solid', color2: '#FF5FA2', gloss: 0.6 }, accessories: ['clips'] },
    makeup: { lipstick: '#FF3D8B', gloss: 0.9, blush: '#FF7AB6', eyeshadow: '#C9A7FF' },
    outfit: { outerwear: 'starter-puffer-lilac', top: 'starter-tank-pink', bottom: 'starter-mini-skirt-pink', shoes: 'starter-boots', eyewear: 'starter-sunglasses' },
  }),
  build({
    id: 'seyi', name: 'Seyi', group: 'men', blurb: 'Surulere streetwear, chain and cap.',
    skin: { tone: '#5A3420', undertone: 'warm' }, face: { preset: 'square', jaw: 0.65 },
    body: { preset: 'athletic', height: 1.08, shoulders: 0.7, waist: 0.55, hips: 0.35, bust: 0, muscle: 0.6 },
    hair: { style: 'taper', color: '#1B1214', edges: { style: 'waves', density: 0.5, swirl: 0.5 } },
    facialHair: { style: 'stubble', density: 0.6 },
    outfit: { headwear: 'starter-cap-black', outerwear: 'starter-hoodie-grey', top: 'starter-tee-black', bottom: 'starter-cargo-black', shoes: 'starter-chunky-sneakers-black', necklace: 'starter-chain-silver' },
  }),
  build({
    id: 'emeka', name: 'Emeka', group: 'men', blurb: 'VI banker who dresses for the job he wants.',
    skin: { tone: '#4A2A1A', undertone: 'red' }, face: { preset: 'oblong', jaw: 0.6 },
    body: { preset: 'average', height: 1.1, shoulders: 0.7, waist: 0.55, hips: 0.4, bust: 0 },
    hair: { style: 'short-cut', color: '#1B1214', curl: '4c' },
    facialHair: { style: 'short-beard', density: 0.8 },
    outfit: { outerwear: 'starter-blazer-cream', top: 'starter-tee-black', bottom: 'starter-trousers-black', shoes: 'starter-loafers' },
  }),
  build({
    id: 'musa', name: 'Musa', group: 'men', blurb: 'Kano textile heir in babban riga.',
    skin: { tone: '#7A4A2E', undertone: 'golden' }, face: { preset: 'oblong', nose: 0.5, jaw: 0.6 },
    body: { preset: 'slim', height: 1.1, shoulders: 0.6, waist: 0.5, hips: 0.35, bust: 0 },
    hair: { style: 'fade', color: '#1B1214' },
    facialHair: { style: 'full-beard', density: 0.7 },
    outfit: { headwear: 'starter-fila', dress: 'starter-kaftan-hausa', shoes: 'starter-sandals' },
  }),
  build({
    id: 'dami', name: 'Dami', group: 'men', blurb: 'Edgy rapper: leather jacket, bleached locs.',
    skin: { tone: '#3B2219', undertone: 'cool' }, face: { preset: 'diamond', jaw: 0.55, cheekbones: 0.7 },
    body: { preset: 'slim', height: 1.06, shoulders: 0.62, waist: 0.5, hips: 0.35, bust: 0 },
    hair: { style: 'freeform-locs', length: 0.6, color: '#1B1214', dye: { mode: 'bleached-tips', color2: '#F3E2B0', gloss: 0.2 } },
    facialHair: { style: 'moustache', density: 0.5 },
    outfit: { outerwear: 'starter-leather-jacket', top: 'starter-tee-white', bottom: 'starter-thrift-jeans', shoes: 'starter-chunky-sneakers-black', necklace: 'starter-chain-silver' },
  }),
  build({
    id: 'kunle', name: 'Kunle', group: 'men', blurb: 'Gym bro with a heart of gold.',
    skin: { tone: '#45240F', undertone: 'warm' }, face: { preset: 'square', jaw: 0.75 },
    body: { preset: 'athletic', height: 1.12, shoulders: 0.85, waist: 0.55, hips: 0.4, bust: 0, muscle: 0.9 },
    hair: { style: 'buzz', color: '#1B1214' },
    facialHair: { style: 'chin-strap', density: 0.7 },
    outfit: { top: 'starter-tee-black', bottom: 'starter-shorts-denim', shoes: 'starter-chunky-sneakers', headwear: 'starter-cap-black' },
  }),
  build({
    id: 'toyin', name: 'Toyin', group: 'androgynous', blurb: 'Bend-down-select hunter, flannel forever.',
    skin: { tone: '#6B3E26', undertone: 'neutral' }, face: { preset: 'oval', cheekbones: 0.6 },
    body: { preset: 'slim', height: 1.02, shoulders: 0.55, waist: 0.4, hips: 0.45, bust: 0.2 },
    hair: { style: 'twists', length: 0.5, color: '#1B1214' },
    makeup: { lipstick: null, gloss: 0.4 },
    outfit: { headwear: 'starter-bucket-hat', top: 'starter-check-shirt', bottom: 'starter-cargo', shoes: 'starter-sneakers-white', bag: 'starter-tote-canvas' },
  }),
  build({
    id: 'ife', name: 'Ife', group: 'androgynous', blurb: 'Night-shift model, corset over everything.',
    skin: { tone: '#2E1A12', undertone: 'cool' }, face: { preset: 'diamond', cheekbones: 0.85, lips: 0.7 },
    body: { preset: 'tall', height: 1.12, shoulders: 0.55, waist: 0.35, hips: 0.45, bust: 0.2, legs: 0.85 },
    hair: { style: 'mohawk', color: '#1B1214', dye: { mode: 'solid', color2: '#A86BFF', gloss: 0.4 } },
    makeup: { lipstick: '#2B0F14', eyeliner: 'graphic', highlight: 0.7 },
    outfit: { outerwear: 'starter-leather-jacket', top: 'starter-corset-black', bottom: 'starter-trousers-black', shoes: 'starter-heels-black' },
  }),
  build({
    id: 'rayo', name: 'Rayo', group: 'androgynous', blurb: 'Minimalist barista: basics done right.',
    skin: { tone: '#C98B63', undertone: 'neutral' }, face: { preset: 'oval', nose: 0.45 },
    body: { preset: 'average', height: 1.0, shoulders: 0.5, waist: 0.45, hips: 0.45, bust: 0.2 },
    hair: { style: 'pixie', color: '#2B1B17' },
    makeup: { lipstick: null, gloss: 0.3 },
    outfit: { top: 'starter-tee-white', bottom: 'starter-trousers-camel', shoes: 'starter-sneakers-black', earrings: 'starter-studs' },
  }),
]

export const STARTER_BY_ID = new Map(STARTERS.map((s) => [s.id, s]))

export function starterAppearance(id: string): Appearance {
  const s = STARTER_BY_ID.get(id) ?? STARTERS[0]
  return structuredClone(s.appearance)
}
