import type { Aesthetic, Brand, BrandRegion, CatalogItem, DripVibe, GarmentTemplate, ItemCategory, OutfitSlot, Pattern, Rarity } from './types'

/**
 * The Drip: every store in the game. International labels are affectionate
 * flips (Meirre Chen, Nova Sport, Flashnova…), never the real names; Nigerian
 * labels are flipped the same way (Deji Deji, Tolapsd, B Bottoms, Thai Collective…).
 *
 * Stock is generated here, deterministically, so prices and ids never change
 * between builds and the server can validate every purchase.
 */

type Line = GarmentTemplate
interface DripBrandDef {
  id: string
  name: string
  region: BrandRegion
  tagline: string
  accent: string
  vibe: DripVibe
  lines: Line[]
  patterns: Pattern[]
  palettes: [string, string, string][]
  /** Glam price band for a mid-weight piece. */
  band: [number, number]
  /** What this label calls a piece, when it isn't the usual name. */
  names?: Partial<Record<GarmentTemplate, string>>
}

const SLOT: Partial<Record<GarmentTemplate, OutfitSlot>> = {
  tee: 'top', crop: 'top', tank: 'top', blouse: 'top', shirt: 'top', corset: 'top', buba: 'top',
  hoodie: 'outerwear', blazer: 'outerwear', jacket: 'outerwear', puffer: 'outerwear', agbada: 'outerwear',
  kaftan: 'dress', 'mini-skirt': 'bottom', 'midi-skirt': 'bottom', 'maxi-skirt': 'bottom', wrapper: 'bottom', trousers: 'bottom', cargo: 'bottom', jeans: 'bottom', shorts: 'bottom',
  'mini-dress': 'dress', 'midi-dress': 'dress', gown: 'dress', boubou: 'dress', jumpsuit: 'dress', bikini: 'swimwear', 'one-piece': 'swimwear',
  sneakers: 'shoes', heels: 'shoes', boots: 'shoes', sandals: 'shoes', loafers: 'shoes', tote: 'bag', clutch: 'bag', backpack: 'bag',
  gele: 'headwear', cap: 'headwear', beret: 'headwear', headwrap: 'headwear', 'bucket-hat': 'headwear', sunglasses: 'eyewear', glasses: 'eyewear',
  hoops: 'earrings', studs: 'earrings', drops: 'earrings', chain: 'necklace', pendant: 'necklace', 'coral-beads': 'necklace', 'waist-beads': 'necklace', bangle: 'bracelet', watch: 'bracelet',
  belt: 'belt', bralette: 'top', robe: 'outerwear',
}

function categoryOf(slot: OutfitSlot): ItemCategory {
  if (slot === 'shoes') return 'shoes'
  if (slot === 'bag') return 'bags'
  if (slot === 'eyewear') return 'eyewear'
  if (slot === 'swimwear') return 'swimwear'
  if (slot === 'earrings' || slot === 'necklace' || slot === 'bracelet') return 'jewellery'
  return 'fashion'
}

const NAME: Partial<Record<GarmentTemplate, string>> = {
  tee: 'Tee', crop: 'Crop Top', tank: 'Tank', blouse: 'Blouse', shirt: 'Shirt', corset: 'Corset', buba: 'Buba', hoodie: 'Hoodie', blazer: 'Blazer', jacket: 'Jacket',
  puffer: 'Puffer', agbada: 'Agbada', kaftan: 'Kaftan', 'mini-skirt': 'Mini Skirt', 'midi-skirt': 'Midi Skirt', 'maxi-skirt': 'Maxi Skirt', wrapper: 'Wrapper', trousers: 'Trousers',
  cargo: 'Cargos', jeans: 'Jeans', shorts: 'Shorts', 'mini-dress': 'Mini Dress', 'midi-dress': 'Midi Dress', gown: 'Gown', boubou: 'Boubou', jumpsuit: 'Jumpsuit', bikini: 'Bikini',
  'one-piece': 'Swimsuit', sneakers: 'Sneakers', heels: 'Heels', boots: 'Boots', sandals: 'Sandals', loafers: 'Loafers', tote: 'Tote', clutch: 'Clutch', backpack: 'Backpack',
  gele: 'Gele', cap: 'Cap', beret: 'Beret', headwrap: 'Headwrap', 'bucket-hat': 'Bucket Hat', sunglasses: 'Shades', glasses: 'Frames', hoops: 'Hoops', studs: 'Studs',
  drops: 'Drop Earrings', chain: 'Chain', pendant: 'Pendant', 'coral-beads': 'Coral Beads', 'waist-beads': 'Waist Beads', bangle: 'Bangle', watch: 'Watch',
  belt: 'Belt', bralette: 'Bralette', robe: 'Satin Robe',
}
/** Gym and sport stores rename a few pieces. */
const GYM_NAME: Partial<Record<GarmentTemplate, string>> = { crop: 'Sports Bra', trousers: 'Leggings', shorts: 'Bike Shorts', jacket: 'Track Jacket', tank: 'Training Tank', sneakers: 'Trainers' }
const PATTERN_NAME: Record<Pattern, string> = {
  solid: '', ankara: 'Ankara', adire: 'Adire', 'aso-oke': 'Aso-oke', kente: 'Kente', denim: 'Denim', leopard: 'Leopard', check: 'Check', stripe: 'Stripe',
  floral: 'Floral', monogram: 'Logo', sequin: 'Sequin', lace: 'Lace',
}
/** How expensive each kind of piece is relative to the brand's band. */
const WEIGHT: Partial<Record<GarmentTemplate, number>> = {
  tee: 0.55, tank: 0.5, crop: 0.55, studs: 0.4, hoops: 0.5, cap: 0.5, 'bucket-hat': 0.55, glasses: 0.7, sunglasses: 0.75, shorts: 0.6, 'mini-skirt': 0.7,
  gown: 2, agbada: 2, belt: 0.6, bralette: 0.7, robe: 1.2, boubou: 1.6, puffer: 1.6, blazer: 1.5, jacket: 1.3, heels: 1.3, boots: 1.3, tote: 1.4, clutch: 1.1, watch: 1.6, chain: 1.1, bikini: 0.6,
}

const VIBE_AESTHETIC: Record<DripVibe, Aesthetic[]> = {
  streetwear: ['streetwear'],
  elegant: ['editorial', 'minimal'],
  luxury: ['luxury', 'editorial'],
  gym: ['streetwear', 'minimal'],
  baddie: ['nightlife', 'soft-glam'],
  basic: ['minimal'],
  trad: ['owambe'],
  thrift: ['alt', 'y2k'],
  home: [],
}

/* Palettes: [main, accent, colour name]. */
const P = {
  noir: [['#111111', '#D4AF37', 'Noir & Gold'], ['#F5F0E6', '#111111', 'Ivory'], ['#1C1C1C', '#F5F0E6', 'Tuxedo'], ['#E9E2DC', '#8C5A3C', 'Bone'], ['#7A1E3A', '#F5F0E6', 'Bordeaux'], ['#FFD1E6', '#111111', 'Ballet Pink']],
  sport: [['#111111', '#FFFFFF', 'Black'], ['#FFFFFF', '#111111', 'White'], ['#FF5A1F', '#111111', 'Volt Orange'], ['#3D7BFF', '#FFFFFF', 'Royal'], ['#C8FF3D', '#111111', 'Volt'], ['#9A9184', '#FFFFFF', 'Stone'], ['#FF3D8B', '#FFFFFF', 'Hyper Pink']],
  eagles: [['#008751', '#FFFFFF', 'Eagles Green'], ['#FFFFFF', '#008751', 'Home White'], ['#111111', '#008751', 'Away Black'], ['#C8FF3D', '#111111', 'Fluoro'], ['#0B5D3B', '#F5C518', 'Gold Trim']],
  baddie: [['#FF2E88', '#111111', 'Hot Pink'], ['#111111', '#FF2E88', 'Black'], ['#E8505B', '#FFFFFF', 'Cherry'], ['#C9A7FF', '#FFFFFF', 'Lilac'], ['#E9C46A', '#111111', 'Champagne'], ['#FFFFFF', '#FF2E88', 'White'], ['#8C5A3C', '#E9D8C3', 'Mocha']],
  pastel: [['#FFB3D1', '#FFFFFF', 'Blush'], ['#D9C2FF', '#FFFFFF', 'Lavender'], ['#B8F2E6', '#FFFFFF', 'Seafoam'], ['#FFE0A3', '#FFFFFF', 'Butter'], ['#FFFFFF', '#FFB3D1', 'Cloud'], ['#9CC3F0', '#FFFFFF', 'Sky']],
  basics: [['#FFFFFF', '#E9E2DC', 'White'], ['#2B2B2B', '#FFFFFF', 'Black'], ['#B8B2BD', '#FFFFFF', 'Heather'], ['#C49A6C', '#FFFFFF', 'Camel'], ['#4A6FA5', '#FFFFFF', 'Denim Blue'], ['#6B7F4F', '#FFFFFF', 'Olive'], ['#F5F0E6', '#2B2B2B', 'Oat']],
  lux: [['#5C4033', '#D4AF37', 'Monogram Brown'], ['#111111', '#D4AF37', 'Black Gold'], ['#E9E2DC', '#5C4033', 'Cream'], ['#1C2E4A', '#E9E2DC', 'Navy'], ['#7A1E3A', '#D4AF37', 'Wine'], ['#00A88F', '#F5F0E6', 'Emerald']],
  loud: [['#D4AF37', '#111111', 'Baroque Gold'], ['#111111', '#D4AF37', 'Black Baroque'], ['#FF2E88', '#D4AF37', 'Fuchsia'], ['#3D7BFF', '#D4AF37', 'Cobalt'], ['#FFFFFF', '#D4AF37', 'White Gold']],
  lagos: [['#FF6B2C', '#1C7C54', 'Sunset'], ['#E0457B', '#FFC24D', 'Hibiscus'], ['#2B4BAA', '#F2E6C9', 'Indigo'], ['#7A1E3A', '#FFC24D', 'Wine'], ['#00A88F', '#FFE3EF', 'Lagoon'], ['#FFC24D', '#5B2A86', 'Marigold'], ['#1C1C1C', '#FF3D8B', 'Onyx']],
  gaia: [['#F28C28', '#2B4BAA', 'Gaia Sunset'], ['#2B4BAA', '#F28C28', 'Gaia Blue'], ['#E0457B', '#7CF0CF', 'Bloom'], ['#111111', '#FF8FD8', 'Midnight Mesh'], ['#F5F0E6', '#C9A227', 'Ivory'], ['#00A88F', '#FFE3EF', 'Jade']],
  skate: [['#FFC24D', '#111111', 'Waffle Gold'], ['#FFFFFF', '#E8505B', 'Cream'], ['#2B4BAA', '#FFC24D', 'Skate Blue'], ['#1C7C54', '#FFFFFF', 'Park Green'], ['#111111', '#FFC24D', 'Grip Black']],
  clean: [['#E9E2DC', '#111111', 'Sand'], ['#111111', '#E9E2DC', 'Black'], ['#6B7F4F', '#E9E2DC', 'Moss'], ['#5C4033', '#E9E2DC', 'Earth'], ['#FFFFFF', '#111111', 'Optic White']],
  shades: [['#111111', '#2B2B2B', 'Black'], ['#8C5A3C', '#E9C46A', 'Tortoise'], ['#D4AF37', '#2B2B2B', 'Gold Aviator'], ['#FF2E88', '#111111', 'Pink'], ['#FFFFFF', '#3D7BFF', 'Ice'], ['#C7CAD1', '#111111', 'Chrome'], ['#7A1E3A', '#111111', 'Cherry']],
  boudoir: [['#B3123F', '#111111', 'Cherry'], ['#111111', '#B3123F', 'Noir'], ['#FFD1E6', '#FFFFFF', 'Blush'], ['#F5F0E6', '#D4AF37', 'Ivory'], ['#5A1F7A', '#FFB3D1', 'Plum'], ['#E8505B', '#FFD1E6', 'Rose'], ['#C49A6C', '#F5F0E6', 'Nude']],
  edgy: [['#111111', '#C62828', 'Black & Blood'], ['#1C1C1C', '#C7CAD1', 'Gunmetal'], ['#3B0A14', '#111111', 'Oxblood'], ['#111111', '#C8FF3D', 'Acid'], ['#2A2235', '#A86BFF', 'Bruise'], ['#E9E2DC', '#111111', 'Bone']],
  thrift: [['#A67C52', '#2B2B2B', 'Faded Camel'], ['#6B7F4F', '#E9E2DC', 'Army'], ['#7A1E3A', '#E9E2DC', 'Wine'], ['#3E5C8A', '#FFFFFF', 'Washed Blue'], ['#C47A4A', '#F5F0E6', 'Rust'], ['#E9E2DC', '#5C4033', 'Vintage White']],
} satisfies Record<string, [string, string, string][]>

const b = (d: DripBrandDef) => d

/** Flipped international labels. */
const INTERNATIONAL: DripBrandDef[] = [
  b({ id: 'meirre-chen', name: 'Meirre Chen', region: 'france', tagline: 'Tweed, pearls and quiet money.', accent: '#111111', vibe: 'luxury', lines: ['blazer', 'mini-dress', 'midi-dress', 'gown', 'corset', 'midi-skirt', 'heels', 'loafers', 'clutch', 'tote', 'pendant', 'drops', 'beret', 'sunglasses', 'belt', 'chain'], patterns: ['solid', 'check', 'monogram'], palettes: P.noir, band: [600, 1800] }),
  b({ id: 'dyorr', name: 'D’Yorr', region: 'france', tagline: 'New look, every season.', accent: '#B8A1D9', vibe: 'luxury', lines: ['midi-dress', 'gown', 'blouse', 'blazer', 'midi-skirt', 'heels', 'clutch', 'tote', 'beret', 'drops'], patterns: ['solid', 'monogram', 'lace'], palettes: P.noir, band: [550, 1700] }),
  b({ id: 'lui-vutan', name: 'Lui Vutan', region: 'france', tagline: 'Monogram everything.', accent: '#5C4033', vibe: 'luxury', lines: ['tote', 'clutch', 'backpack', 'jacket', 'sneakers', 'loafers', 'cap', 'sunglasses', 'chain'], patterns: ['monogram', 'check'], palettes: P.lux, band: [700, 2200] }),
  b({ id: 'gucha', name: 'Gucha', region: 'global', tagline: 'Maximalist, Milanese, a bit much.', accent: '#00A88F', vibe: 'luxury', lines: ['blazer', 'shirt', 'tee', 'loafers', 'sneakers', 'tote', 'clutch', 'bucket-hat', 'sunglasses', 'chain', 'watch'], patterns: ['monogram', 'stripe', 'floral'], palettes: P.lux, band: [500, 1600] }),
  b({ id: 'hermeez', name: 'Hermeez', region: 'france', tagline: 'Waitlist-only bags. Kind of.', accent: '#F28C28', vibe: 'luxury', lines: ['tote', 'clutch', 'bangle', 'watch', 'loafers', 'sandals'], patterns: ['solid'], palettes: P.lux, band: [900, 2500] }),
  b({ id: 'versassy', name: 'Versassy', region: 'global', tagline: 'Baroque gold, zero chill.', accent: '#D4AF37', vibe: 'luxury', lines: ['shirt', 'mini-dress', 'gown', 'jeans', 'heels', 'sunglasses', 'chain', 'clutch'], patterns: ['monogram', 'sequin', 'floral'], palettes: P.loud, band: [450, 1500] }),
  b({ id: 'balensheega', name: 'Balensheega', region: 'france', tagline: 'Ugly-cool, oversized, expensive.', accent: '#2B2B2B', vibe: 'luxury', lines: ['hoodie', 'puffer', 'tee', 'jeans', 'sneakers', 'boots', 'cap', 'sunglasses', 'tote'], patterns: ['solid', 'monogram'], palettes: P.clean, band: [450, 1400] }),
  b({ id: 'prahda', name: 'Prahda', region: 'global', tagline: 'Nylon, triangles, intellectual chic.', accent: '#1C2E4A', vibe: 'elegant', lines: ['blazer', 'shirt', 'midi-skirt', 'trousers', 'loafers', 'boots', 'backpack', 'clutch', 'sunglasses'], patterns: ['solid'], palettes: P.noir, band: [450, 1300] }),
  b({ id: 'rafe-loren', name: 'Rafe Loren', region: 'america', tagline: 'Old money, polo ponies.', accent: '#1C2E4A', vibe: 'elegant', lines: ['shirt', 'blazer', 'trousers', 'midi-skirt', 'loafers', 'cap', 'watch'], patterns: ['solid', 'stripe', 'check'], palettes: P.lux, band: [200, 700] }),
  b({ id: 'burberrie', name: 'Burberrie', region: 'global', tagline: 'Trench, check, drizzle.', accent: '#C49A6C', vibe: 'elegant', lines: ['jacket', 'shirt', 'midi-skirt', 'tote', 'cap', 'boots'], patterns: ['check', 'solid'], palettes: P.clean, band: [400, 1200] }),
  b({ id: 'zahra', name: 'Zahra', region: 'global', tagline: 'Runway looks, high-street prices.', accent: '#111111', vibe: 'elegant', lines: ['blazer', 'shirt', 'blouse', 'trousers', 'midi-skirt', 'midi-dress', 'jumpsuit', 'loafers', 'heels', 'tote', 'studs'], patterns: ['solid', 'stripe', 'floral'], palettes: P.basics, band: [60, 220] }),
  b({ id: 'nova-sport', name: 'Nova Sport', region: 'america', tagline: 'Just do the thing.', accent: '#FF5A1F', vibe: 'gym', lines: ['tee', 'tank', 'crop', 'hoodie', 'jacket', 'shorts', 'trousers', 'sneakers', 'cap', 'backpack', 'belt'], patterns: ['solid', 'stripe'], palettes: P.sport, band: [60, 260] }),
  b({ id: 'adedas', name: 'Adedas', region: 'global', tagline: 'Three stripes, one Adeda.', accent: '#3D7BFF', vibe: 'gym', lines: ['tee', 'crop', 'jacket', 'trousers', 'shorts', 'sneakers', 'cap', 'backpack'], patterns: ['stripe', 'solid'], palettes: P.sport, band: [50, 240] }),
  b({ id: 'air-jorge', name: 'Air Jorge', region: 'america', tagline: 'Flight school sneakers.', accent: '#E8505B', vibe: 'gym', lines: ['sneakers', 'tee', 'shorts', 'hoodie', 'cap'], patterns: ['solid'], palettes: P.sport, band: [120, 420] }),
  b({ id: 'lulumoon', name: 'Lulumoon', region: 'global', tagline: 'Yoga pants for the soft life.', accent: '#E0457B', vibe: 'gym', lines: ['crop', 'tank', 'trousers', 'shorts', 'jacket', 'hoodie', 'sneakers', 'backpack'], patterns: ['solid'], palettes: P.pastel, band: [70, 220] }),
  b({ id: 'gymshrimp', name: 'Gymshrimp', region: 'global', tagline: 'Leg day, every day.', accent: '#00A88F', vibe: 'gym', lines: ['crop', 'tank', 'tee', 'trousers', 'shorts', 'hoodie', 'sneakers', 'cap'], patterns: ['solid', 'stripe'], palettes: P.sport, band: [40, 160] }),
  b({ id: 'the-south-face', name: 'The South Face', region: 'america', tagline: 'Never stop exploring Lekki.', accent: '#E8505B', vibe: 'streetwear', lines: ['puffer', 'jacket', 'hoodie', 'cargo', 'boots', 'backpack', 'bucket-hat'], patterns: ['solid'], palettes: P.clean, band: [120, 450] }),
  b({ id: 'supremo', name: 'Supremo', region: 'america', tagline: 'Red box logo energy.', accent: '#E8505B', vibe: 'streetwear', lines: ['tee', 'hoodie', 'jacket', 'shorts', 'cap', 'bucket-hat', 'backpack', 'sneakers'], patterns: ['monogram', 'check', 'solid'], palettes: P.sport, band: [90, 380] }),
  b({ id: 'of-whyte', name: 'Of-Whyte', region: 'global', tagline: '“QUOTATION MARKS” on everything.', accent: '#111111', vibe: 'streetwear', lines: ['hoodie', 'tee', 'jacket', 'jeans', 'sneakers', 'tote', 'sunglasses'], patterns: ['stripe', 'solid'], palettes: P.clean, band: [250, 800] }),
  b({ id: 'flashnova', name: 'Flashnova', region: 'america', tagline: 'Snatched in 3 business days.', accent: '#FF2E88', vibe: 'baddie', lines: ['corset', 'crop', 'mini-skirt', 'mini-dress', 'jumpsuit', 'jeans', 'heels', 'boots', 'clutch', 'hoops', 'sunglasses', 'bikini'], patterns: ['solid', 'leopard', 'sequin'], palettes: P.baddie, band: [25, 140] }),
  b({ id: 'pretty-lil-thang', name: 'Pretty Lil Thang', region: 'global', tagline: 'Girls’ night out, sorted.', accent: '#FF8FD8', vibe: 'baddie', lines: ['corset', 'crop', 'mini-dress', 'midi-dress', 'mini-skirt', 'heels', 'clutch', 'hoops', 'drops'], patterns: ['solid', 'sequin', 'lace'], palettes: P.baddie, band: [25, 150] }),
  b({ id: 'skinz', name: 'Skinz', region: 'america', tagline: 'Shapewear and soft lounge.', accent: '#C49A6C', vibe: 'baddie', lines: ['crop', 'tank', 'mini-dress', 'midi-dress', 'trousers', 'shorts', 'one-piece', 'bikini'], patterns: ['solid'], palettes: [['#C49A6C', '#E9D8C3', 'Sienna'], ['#8C5A3C', '#E9D8C3', 'Cocoa'], ['#2B2B2B', '#E9D8C3', 'Onyx'], ['#E9D8C3', '#8C5A3C', 'Sand'], ['#5C4033', '#E9D8C3', 'Espresso'], ['#B8B2BD', '#FFFFFF', 'Smoke']], band: [40, 180] }),
  b({ id: 'christian-lubutan', name: 'Christian Lubutan', region: 'france', tagline: 'Red bottoms, loud entrances.', accent: '#C62828', vibe: 'luxury', lines: ['heels', 'boots', 'loafers', 'sneakers', 'clutch'], patterns: ['solid', 'sequin'], palettes: P.noir, band: [600, 1500] }),
  b({ id: 'steve-madness', name: 'Steve Madness', region: 'america', tagline: 'Platforms for every plan.', accent: '#7A1E3A', vibe: 'baddie', lines: ['heels', 'boots', 'sandals', 'sneakers', 'clutch'], patterns: ['solid', 'leopard'], palettes: P.baddie, band: [80, 260] }),
  b({ id: 'ray-bam', name: 'Ray-Bam', region: 'america', tagline: 'Shades since forever.', accent: '#111111', vibe: 'basic', lines: ['sunglasses', 'glasses'], patterns: ['solid'], palettes: P.shades, band: [80, 260] }),
  b({ id: 'oaksley', name: 'Oaksley', region: 'america', tagline: 'Wraparound sport shades.', accent: '#3D7BFF', vibe: 'gym', lines: ['sunglasses', 'cap'], patterns: ['solid'], palettes: P.shades, band: [70, 220] }),
  b({ id: 'sheeen', name: 'Sheeen', region: 'global', tagline: 'Everything, for basically nothing.', accent: '#111111', vibe: 'basic', lines: ['tee', 'crop', 'tank', 'blouse', 'mini-skirt', 'midi-skirt', 'jeans', 'cargo', 'mini-dress', 'midi-dress', 'sandals', 'sneakers', 'tote', 'hoops', 'studs', 'sunglasses', 'bikini', 'belt', 'cap', 'chain'], patterns: ['solid', 'floral', 'check', 'stripe'], palettes: P.pastel, band: [8, 45] }),
  b({ id: 'h-and-n', name: 'H&N', region: 'global', tagline: 'Basics, but make it weekly.', accent: '#E8505B', vibe: 'basic', lines: ['tee', 'tank', 'shirt', 'hoodie', 'jeans', 'trousers', 'shorts', 'sneakers', 'sandals', 'tote'], patterns: ['solid', 'stripe'], palettes: P.basics, band: [15, 70] }),
  b({ id: 'kelvin-klyne', name: 'Kelvin Klyne', region: 'america', tagline: 'Waistband on show.', accent: '#2B2B2B', vibe: 'basic', lines: ['tee', 'tank', 'crop', 'jeans', 'shorts', 'bikini', 'one-piece', 'watch'], patterns: ['solid'], palettes: P.basics, band: [40, 160] }),
  b({ id: 'uniqlow', name: 'Uniqlow', region: 'global', tagline: 'Life wear, low price.', accent: '#E8505B', vibe: 'basic', lines: ['tee', 'shirt', 'hoodie', 'puffer', 'trousers', 'jeans', 'sneakers', 'backpack'], patterns: ['solid'], palettes: P.basics, band: [20, 90] }),
  b({ id: 'no-label', name: 'No Label', region: 'global', tagline: 'Unbranded. Unbothered.', accent: '#9A9184', vibe: 'basic', lines: ['tee', 'tank', 'crop', 'shirt', 'hoodie', 'jeans', 'trousers', 'shorts', 'mini-skirt', 'sneakers', 'sandals', 'tote', 'cap', 'studs'], patterns: ['solid'], palettes: P.basics, band: [5, 30] }),
]

/** Lingerie & lounge. */
const BOOTY: DripBrandDef = b({ id: 'booty', name: 'Booty', region: 'global', tagline: 'Lace, satin and soft lounge for after dark.', accent: '#B3123F', vibe: 'baddie', lines: ['bralette', 'corset', 'one-piece', 'mini-dress', 'shorts', 'robe', 'heels', 'clutch', 'belt'], patterns: ['lace', 'solid', 'sequin'], palettes: P.boudoir, band: [30, 220], names: { 'one-piece': 'Lace Bodysuit', 'mini-dress': 'Satin Slip', shorts: 'Lace Shorts', belt: 'Garter Belt', corset: 'Bustier' } })

/** Nigerian labels, flipped. */
const NIGERIAN: DripBrandDef[] = [
  b({ id: 'go-bonkers', name: 'GoBonkers', region: 'nigeria', tagline: 'Oversized leather hoodies, loud drops, Super Eagles energy.', accent: '#008751', vibe: 'streetwear', lines: ['tee', 'hoodie', 'jacket', 'shorts', 'cargo', 'jeans', 'cap', 'sneakers', 'backpack', 'belt', 'chain'], patterns: ['solid', 'stripe', 'monogram'], palettes: P.eagles, band: [70, 320] }),
  b({ id: 'that-collective', name: 'Thai Collective', region: 'nigeria', tagline: 'Sheer Gaia prints, statement dresses, every size.', accent: '#F28C28', vibe: 'elegant', lines: ['mini-dress', 'midi-dress', 'gown', 'corset', 'blouse', 'maxi-skirt', 'midi-skirt', 'heels', 'clutch', 'drops', 'belt'], patterns: ['floral', 'lace', 'solid'], palettes: P.gaia, band: [180, 650] }),
  b({ id: 'dope-by-fabby', name: 'Dope by Febby', region: 'nigeria', tagline: 'Owambe baddie, sequins on everything.', accent: '#FF2E88', vibe: 'baddie', lines: ['corset', 'mini-dress', 'gown', 'jumpsuit', 'mini-skirt', 'heels', 'clutch', 'hoops', 'gele', 'belt', 'chain'], patterns: ['sequin', 'lace', 'solid'], palettes: P.baddie, band: [60, 350] }),
  b({ id: 'pancakes-n-custard', name: 'PancakesnCustard', region: 'nigeria', tagline: 'Lagos skate since day one.', accent: '#FFC24D', vibe: 'streetwear', lines: ['tee', 'hoodie', 'trousers', 'shorts', 'cargo', 'bucket-hat', 'cap', 'sneakers', 'backpack'], patterns: ['ankara', 'check', 'solid'], palettes: P.skate, band: [50, 240] }),
  b({ id: 'serious-nature', name: 'Serious Nature', region: 'nigeria', tagline: 'Clean, alté, built to last.', accent: '#6B7F4F', vibe: 'streetwear', lines: ['tee', 'hoodie', 'jacket', 'cargo', 'trousers', 'shorts', 'sneakers', 'cap'], patterns: ['solid'], palettes: P.clean, band: [90, 380] }),
  b({ id: 'cashluxe', name: 'Cashluxe', region: 'nigeria', tagline: 'Matching sets, loud logos, big money.', accent: '#D4AF37', vibe: 'luxury', lines: ['tee', 'shirt', 'jacket', 'shorts', 'trousers', 'sneakers', 'cap', 'chain', 'sunglasses'], patterns: ['monogram', 'sequin', 'solid'], palettes: P.loud, band: [250, 900] }),
  b({ id: 'hype-fashion', name: 'Hype Fashion by Rahman Jagz', region: 'nigeria', tagline: 'Lekki luxe with street attitude.', accent: '#111111', vibe: 'luxury', lines: ['shirt', 'jacket', 'blazer', 'trousers', 'jeans', 'loafers', 'sneakers', 'sunglasses', 'chain', 'watch'], patterns: ['solid', 'monogram'], palettes: P.noir, band: [300, 1000] }),
]

export const DRIP_BRAND_DEFS: DripBrandDef[] = [...NIGERIAN, BOOTY, ...INTERNATIONAL]

/** Fresh stock for labels that already live in brands.json (no new store, just more rails). */
const RESTOCK: DripBrandDef[] = [
  b({ id: 'bolapsd', name: 'Tolapsd', region: 'nigeria', tagline: '', accent: '#A86BFF', vibe: 'streetwear', lines: ['shirt', 'tee', 'hoodie', 'jacket', 'trousers', 'shorts', 'cap', 'beret', 'bucket-hat', 'sneakers', 'belt', 'chain'], patterns: ['solid', 'stripe', 'check'], palettes: P.skate, band: [60, 280], names: { shirt: 'Polo', jacket: 'Track Jacket', trousers: 'Track Pants', beret: 'Skull Cap', cap: 'Beanie' } }),
  b({ id: 'j-bottoms', name: 'B Bottoms', region: 'nigeria', tagline: '', accent: '#FFC24D', vibe: 'baddie', lines: ['jumpsuit', 'bikini', 'one-piece', 'crop', 'tank', 'mini-skirt', 'shorts', 'trousers', 'jeans', 'tee'], patterns: ['solid', 'stripe'], palettes: P.eagles, band: [40, 220] }),
  b({ id: 'meji-meji', name: 'Deji Deji', region: 'nigeria', tagline: '', accent: '#C62828', vibe: 'streetwear', lines: ['jacket', 'corset', 'tee', 'hoodie', 'cargo', 'jeans', 'mini-skirt', 'trousers', 'boots', 'chain', 'sunglasses', 'backpack', 'belt', 'cap'], patterns: ['solid', 'leopard', 'adire'], palettes: P.edgy, band: [70, 340], names: { jacket: 'Leather Jacket', boots: 'Combat Boots', trousers: 'Strap Trousers' } }),
  b({ id: 'bend-down-select', name: 'Bend Down Select', region: 'nigeria', tagline: '', accent: '#8DA35B', vibe: 'thrift', lines: ['jacket', 'shirt', 'tee', 'hoodie', 'jeans', 'cargo', 'midi-skirt', 'mini-dress', 'boots', 'sneakers', 'bucket-hat', 'tote', 'backpack', 'belt', 'chain'], patterns: ['solid', 'check', 'denim', 'stripe'], palettes: P.thrift, band: [8, 70], names: { jacket: 'Vintage Jacket', shirt: 'Pre-loved Shirt', tee: 'Band Tee' } }),
]

export const DRIP_BRANDS: Brand[] = DRIP_BRAND_DEFS.map((d) => ({
  id: d.id,
  name: d.name,
  placeholderName: d.name,
  region: d.region,
  tagline: d.tagline,
  licensedPending: false,
  accent: d.accent,
  vibe: d.vibe,
}))

/** Aisles for the brands that came before the Drip (catalog.json). */
export const LEGACY_VIBES: Record<string, DripVibe> = {
  'meji-meji': 'streetwear', bolapsd: 'streetwear', 'j-bottoms': 'baddie', yati: 'elegant', 'ankara-house': 'trad', 'aso-oke-atelier': 'trad', 'adire-indigo': 'trad',
  'gele-couture': 'trad', 'lekki-street': 'streetwear', 'yaba-youth': 'streetwear', 'eko-thread': 'trad', 'owambe-gold': 'luxury', 'coral-and-co': 'trad', 'naija-glow': 'home',
  'crown-and-kinks': 'home', 'lagos-living': 'home', 'ile-ayo': 'home', 'brooklyn-block': 'streetwear', 'hollis-ave': 'streetwear', 'mercer-luxe': 'luxury', 'y2k-mall': 'baddie',
  courtside: 'gym', 'sunset-swim': 'baddie', 'peach-beauty': 'home', 'loft-home': 'home', 'maison-lumiere': 'elegant', 'rive-gauche': 'elegant', 'atelier-marais': 'luxury',
  'cote-bleue': 'elegant', 'maison-lune': 'home', 'second-life': 'thrift', 'vintage-vault': 'thrift', 'dollcare-basics': 'basic', 'noir-lagos': 'baddie', 'afterhours-eko': 'baddie',
  'track-club': 'gym', 'sugar-rush': 'baddie', 'bend-down-select': 'thrift',
}

function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

function rarityOf(price: number, band: [number, number]): Rarity {
  const t = (price - band[0]) / Math.max(1, band[1] - band[0])
  if (price >= 1500) return 'legendary'
  if (t > 0.85) return 'epic'
  if (t > 0.5) return 'rare'
  return 'common'
}

let cache: CatalogItem[] | null = null

/** Every Drip piece: brand × line × colourway × pattern. Thousands of options, stable ids. */
export function generateDripItems(): CatalogItem[] {
  if (cache) return cache
  const out: CatalogItem[] = []
  for (const d of [...DRIP_BRAND_DEFS, ...RESTOCK]) {
    for (const tpl of d.lines) {
      const slot = SLOT[tpl]
      if (!slot) continue
      // Small accessories don't need every pattern.
      const patterns = ['earrings', 'necklace', 'bracelet', 'eyewear', 'belt'].includes(slot) ? (['solid'] as Pattern[]) : d.patterns
      d.palettes.forEach(([c1, c2, colour], pi) => {
        for (const pattern of patterns) {
          const id = `${d.id}-${tpl}-${pi}-${pattern}`
          const h = hash(id)
          const w = WEIGHT[tpl] ?? 1
          const base = d.band[0] + ((h % 1000) / 1000) * (d.band[1] - d.band[0])
          const price = Math.max(5, Math.round((base * w * (pattern === 'solid' ? 1 : 1.12)) / 5) * 5)
          const label = d.names?.[tpl] ?? (d.vibe === 'gym' ? GYM_NAME[tpl] : undefined) ?? NAME[tpl] ?? tpl
          const pn = PATTERN_NAME[pattern]
          out.push({
            id,
            name: `${pn ? `${pn} ` : ''}${label} — ${colour}`,
            brandId: d.id,
            category: categoryOf(slot),
            slot,
            template: tpl,
            colors: [c1, c2],
            pattern,
            rarity: rarityOf(price, [d.band[0] * w, d.band[1] * w]),
            price,
            tags: [d.vibe, tpl, colour.toLowerCase()],
            aesthetics: VIBE_AESTHETIC[d.vibe],
            ...(h % 23 === 0 ? { drop: 'limited' as const } : {}),
          })
        }
      })
    }
  }
  cache = out
  return out
}
