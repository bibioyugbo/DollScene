#!/usr/bin/env node
/**
 * Generates src/shared/catalog.json from brand product lines.
 * Deterministic: the same input always produces the same ids and prices.
 *
 *   node scripts/generate-catalog.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const brands = JSON.parse(readFileSync(resolve(root, 'src/shared/brands.json'), 'utf8'))
const brandIds = new Set(brands.map((b) => b.id))

/* Seeded RNG so the catalog is stable between runs. */
let seed = 20261008
function rand() {
  seed = (seed * 1664525 + 1013904223) % 4294967296
  return seed / 4294967296
}
const pick = (arr) => arr[Math.floor(rand() * arr.length)]
const round5 = (n) => Math.max(5, Math.round(n / 5) * 5)

const PALETTES = {
  lagos: [['#FF6B2C', '#1C7C54'], ['#E0457B', '#FFC24D'], ['#2B4BAA', '#F2E6C9'], ['#7A1E3A', '#FFC24D'], ['#00A88F', '#FFE3EF'], ['#FFC24D', '#5B2A86'], ['#1C1C1C', '#FF3D8B'], ['#F28C28', '#2B4BAA']],
  indigo: [['#1E3A8A', '#E8EEF9'], ['#23305E', '#B8C7E6'], ['#2B4BAA', '#FFFFFF'], ['#152A57', '#7FA3D9']],
  gold: [['#C9A227', '#FFF1C1'], ['#D4AF37', '#7A1E3A'], ['#E3C16F', '#1E0B26'], ['#B8860B', '#FFFFFF'], ['#F5D06F', '#00A88F']],
  street: [['#2B2B2B', '#FF3D8B'], ['#FFFFFF', '#2B2B2B'], ['#3D7BFF', '#FFFFFF'], ['#00B37E', '#111111'], ['#E9E2DC', '#8C5A3C'], ['#7CF0CF', '#1E0B26']],
  luxe: [['#111111', '#D4AF37'], ['#F5F0E6', '#111111'], ['#7A1E3A', '#F5F0E6'], ['#1C2E4A', '#E9E2DC'], ['#E9E2DC', '#8C5A3C']],
  y2k: [['#FF8FD8', '#B8F2FF'], ['#C9A7FF', '#FFFFFF'], ['#B8F2FF', '#FF3D8B'], ['#FFF06B', '#FF8FD8'], ['#FFFFFF', '#C9A7FF']],
  pastel: [['#FFB3D1', '#FFFFFF'], ['#D9C2FF', '#FFFFFF'], ['#B8F2E6', '#FFFFFF'], ['#FFE0A3', '#FFFFFF'], ['#FFD1C1', '#FFFFFF']],
  earth: [['#8C5A3C', '#E9D8C3'], ['#A67C52', '#2B2B2B'], ['#6B7F4F', '#E9E2DC'], ['#C47A4A', '#F5F0E6'], ['#5C4033', '#D9B48F']],
  wood: [['#B07A4A', '#F5F0E6'], ['#6B3E26', '#E9E2DC'], ['#D9B48F', '#2B2B2B'], ['#8C5A3C', '#FFE3EF']],
  goth: [['#141014', '#3B1A2E'], ['#1C1C1C', '#7A1E3A'], ['#2B2B2B', '#C7CAD1'], ['#3B1A2E', '#141014']],
  night: [['#FF2E88', '#141014'], ['#C7CAD1', '#0E0B10'], ['#0E0B10', '#FF2E88'], ['#E9C46A', '#0E0B10'], ['#6E2BFF', '#FFFFFF']],
  acid: [['#C8FF3D', '#0E0B10'], ['#0E0B10', '#C8FF3D'], ['#F4F0EA', '#FF2E88'], ['#3D7BFF', '#FFFFFF'], ['#9A9184', '#0E0B10']],
  kawaii: [['#FFC2E2', '#FFFFFF'], ['#C9F0FF', '#FF8FD8'], ['#FFF0A8', '#FF8FD8'], ['#E2C9FF', '#FFFFFF']],
  chrome: [['#C7CAD1', '#FFFFFF'], ['#E9C46A', '#FFFFFF'], ['#2B2B2B', '#C7CAD1']],
  bold: [['#FF3D8B', '#FFFFFF'], ['#A86BFF', '#FFFFFF'], ['#00A88F', '#FFFFFF'], ['#FFC24D', '#1E0B26'], ['#E8505B', '#FFFFFF'], ['#3AA0D8', '#FFFFFF']],
}

const COLOR_NAMES = {
  '#141014': 'Jet', '#3B1A2E': 'Plum Noir', '#FF2E88': 'Electric', '#C7CAD1': 'Chrome', '#0E0B10': 'Ink', '#E9C46A': 'Champagne Gold', '#6E2BFF': 'Ultraviolet',
  '#C8FF3D': 'Acid', '#F4F0EA': 'Bone', '#9A9184': 'Stone', '#FFC2E2': 'Candy', '#C9F0FF': 'Sky', '#FFF0A8': 'Lemonade', '#E2C9FF': 'Lilac Milk',
  '#FF6B2C': 'Sunset', '#E0457B': 'Hibiscus', '#2B4BAA': 'Indigo', '#7A1E3A': 'Wine', '#00A88F': 'Lagoon', '#FFC24D': 'Marigold', '#1C1C1C': 'Onyx', '#F28C28': 'Tangerine',
  '#1E3A8A': 'Deep Indigo', '#23305E': 'Midnight', '#152A57': 'Navy', '#C9A227': 'Gold', '#D4AF37': 'Gilt', '#E3C16F': 'Champagne', '#B8860B': 'Old Gold', '#F5D06F': 'Honey',
  '#2B2B2B': 'Black', '#FFFFFF': 'White', '#3D7BFF': 'Cobalt', '#00B37E': 'Emerald', '#E9E2DC': 'Bone', '#7CF0CF': 'Mint', '#111111': 'Noir', '#F5F0E6': 'Ivory', '#1C2E4A': 'Marine',
  '#FF8FD8': 'Bubblegum', '#C9A7FF': 'Lilac', '#B8F2FF': 'Ice', '#FFF06B': 'Lemon', '#FFB3D1': 'Blush', '#D9C2FF': 'Lavender', '#B8F2E6': 'Seafoam', '#FFE0A3': 'Butter', '#FFD1C1': 'Peach',
  '#8C5A3C': 'Cocoa', '#A67C52': 'Camel', '#6B7F4F': 'Olive', '#C47A4A': 'Terracotta', '#5C4033': 'Espresso', '#B07A4A': 'Teak', '#6B3E26': 'Walnut', '#D9B48F': 'Ash', '#FF3D8B': 'Lacquer',
  '#A86BFF': 'Orchid', '#E8505B': 'Coral', '#3AA0D8': 'Riviera',
}
const colorName = (hex) => COLOR_NAMES[hex] ?? 'Signature'

const SLOT = {
  tee: 'top', crop: 'top', tank: 'top', blouse: 'top', shirt: 'top', corset: 'top', buba: 'top',
  hoodie: 'outerwear', blazer: 'outerwear', jacket: 'outerwear', puffer: 'outerwear', agbada: 'outerwear',
  kaftan: 'dress', 'mini-skirt': 'bottom', 'midi-skirt': 'bottom', 'maxi-skirt': 'bottom', wrapper: 'bottom', trousers: 'bottom', cargo: 'bottom', jeans: 'bottom', shorts: 'bottom',
  'mini-dress': 'dress', 'midi-dress': 'dress', gown: 'dress', boubou: 'dress', jumpsuit: 'dress', bikini: 'swimwear', 'one-piece': 'swimwear',
  sneakers: 'shoes', heels: 'shoes', boots: 'shoes', sandals: 'shoes', loafers: 'shoes', tote: 'bag', clutch: 'bag', backpack: 'bag',
  gele: 'headwear', cap: 'headwear', beret: 'headwear', headwrap: 'headwear', 'bucket-hat': 'headwear', sunglasses: 'eyewear', glasses: 'eyewear',
  hoops: 'earrings', studs: 'earrings', drops: 'earrings', chain: 'necklace', pendant: 'necklace', 'coral-beads': 'necklace', 'waist-beads': 'necklace', bangle: 'bracelet', watch: 'bracelet',
}
const CATEGORY = (template) => {
  const slot = SLOT[template]
  if (slot === 'shoes') return 'shoes'
  if (slot === 'bag') return 'bags'
  if (slot === 'eyewear') return 'eyewear'
  if (slot === 'swimwear') return 'swimwear'
  if (['earrings', 'necklace', 'bracelet'].includes(slot)) return 'jewellery'
  return 'fashion'
}

const FURNITURE = {
  'bed-single': { room: 'bedroom', mount: 'floor', w: 1.1, d: 2.0, h: 0.6, price: 220 },
  'bed-double': { room: 'bedroom', mount: 'floor', w: 1.7, d: 2.1, h: 0.7, price: 420 },
  sofa: { room: 'living', mount: 'floor', w: 2.0, d: 0.9, h: 0.85, price: 300 },
  loveseat: { room: 'living', mount: 'floor', w: 1.4, d: 0.85, h: 0.85, price: 210 },
  armchair: { room: 'living', mount: 'floor', w: 0.85, d: 0.85, h: 0.9, price: 140 },
  beanbag: { room: 'living', mount: 'floor', w: 0.8, d: 0.8, h: 0.6, price: 70 },
  'coffee-table': { room: 'living', mount: 'floor', w: 1.1, d: 0.6, h: 0.4, price: 90 },
  'side-table': { room: 'living', mount: 'floor', w: 0.45, d: 0.45, h: 0.55, price: 50 },
  'dining-table': { room: 'kitchen', mount: 'floor', w: 1.6, d: 0.9, h: 0.75, price: 200 },
  chair: { room: 'kitchen', mount: 'floor', w: 0.5, d: 0.5, h: 0.9, price: 50 },
  stool: { room: 'kitchen', mount: 'floor', w: 0.4, d: 0.4, h: 0.7, price: 35 },
  desk: { room: 'living', mount: 'floor', w: 1.3, d: 0.65, h: 0.75, price: 150 },
  bookshelf: { room: 'living', mount: 'floor', w: 0.9, d: 0.35, h: 1.8, price: 140 },
  'tv-stand': { room: 'living', mount: 'floor', w: 1.6, d: 0.45, h: 1.1, price: 180 },
  wardrobe: { room: 'vanity-closet', mount: 'floor', w: 1.4, d: 0.6, h: 2.0, price: 260 },
  'clothes-rack': { room: 'vanity-closet', mount: 'floor', w: 1.2, d: 0.5, h: 1.6, price: 90 },
  vanity: { room: 'vanity-closet', mount: 'floor', w: 1.1, d: 0.5, h: 1.5, price: 240 },
  dresser: { room: 'bedroom', mount: 'floor', w: 1.2, d: 0.5, h: 0.85, price: 170 },
  'mirror-floor': { room: 'vanity-closet', mount: 'floor', w: 0.6, d: 0.3, h: 1.7, price: 80 },
  'floor-lamp': { room: 'lighting', mount: 'floor', w: 0.4, d: 0.4, h: 1.6, price: 65 },
  'table-lamp': { room: 'lighting', mount: 'floor', w: 0.3, d: 0.3, h: 0.5, price: 40 },
  'neon-sign': { room: 'lighting', mount: 'wall', w: 0.9, d: 0.06, h: 0.45, price: 120 },
  'plant-tall': { room: 'plants', mount: 'floor', w: 0.5, d: 0.5, h: 1.5, price: 60 },
  'plant-small': { room: 'plants', mount: 'floor', w: 0.3, d: 0.3, h: 0.45, price: 30 },
  'rug-round': { room: 'decor', mount: 'rug', w: 1.6, d: 1.6, h: 0.02, price: 70 },
  'rug-rect': { room: 'decor', mount: 'rug', w: 2.2, d: 1.5, h: 0.02, price: 90 },
  'art-frame': { room: 'art', mount: 'wall', w: 0.7, d: 0.05, h: 0.9, price: 75 },
  'wall-shelf': { room: 'decor', mount: 'wall', w: 0.9, d: 0.25, h: 0.3, price: 45 },
  'wall-mirror': { room: 'vanity-closet', mount: 'wall', w: 0.6, d: 0.05, h: 0.9, price: 70 },
  'kitchen-counter': { room: 'kitchen', mount: 'floor', w: 1.8, d: 0.6, h: 0.9, price: 300 },
  fridge: { room: 'kitchen', mount: 'floor', w: 0.75, d: 0.7, h: 1.8, price: 260 },
  stove: { room: 'kitchen', mount: 'floor', w: 0.75, d: 0.6, h: 0.9, price: 220 },
  bathtub: { room: 'bathroom', mount: 'floor', w: 1.7, d: 0.8, h: 0.6, price: 380 },
  sink: { room: 'bathroom', mount: 'floor', w: 0.7, d: 0.5, h: 0.9, price: 120 },
  speaker: { room: 'living', mount: 'floor', w: 0.35, d: 0.35, h: 0.9, price: 110 },
}

/**
 * Product lines per brand: [template, name stem, patterns, palette, base price, count, opts?]
 * Nigerian brands carry the most lines on purpose.
 */
const LINES = {
  'bend-down-select': [
    ['tee', 'Bend Down Tee', ['solid', 'stripe', 'monogram'], 'earth', 12, 4],
    ['jeans', 'Bend Down Jeans', ['denim'], 'street', 18, 3],
    ['shirt', 'Bend Down Shirt', ['check', 'floral', 'stripe'], 'earth', 14, 4],
    ['jacket', 'Bend Down Jacket', ['denim', 'solid'], 'earth', 25, 3],
    ['sneakers', 'Bend Down Sneakers', ['solid'], 'street', 22, 3],
    ['tote', 'Bend Down Bag', ['solid', 'leopard'], 'earth', 15, 2],
    ['mini-dress', 'Bend Down Dress', ['floral', 'solid'], 'pastel', 20, 3],
  ],
  'noir-lagos': [
    ['corset', 'Black Lace Corset', ['lace', 'solid'], 'goth', 170, 3],
    ['maxi-skirt', 'Gothic Maxi', ['lace', 'solid'], 'goth', 140, 3],
    ['boots', 'Platform Combat Boot', ['solid'], 'goth', 190, 3],
    ['chain', 'Spike Chain', ['solid'], 'chrome', 70, 2],
    ['mini-dress', 'Velvet Slip', ['solid'], 'goth', 160, 3],
    ['jacket', 'Studded Moto', ['solid'], 'goth', 230, 2],
  ],
  'afterhours-eko': [
    ['mini-dress', 'Sequin Mini', ['sequin'], 'night', 240, 4, { rarity: 'rare' }],
    ['jumpsuit', 'Cut-Out Jumpsuit', ['solid', 'sequin'], 'night', 260, 3],
    ['heels', 'Strappy Heel', ['solid'], 'night', 180, 3],
    ['clutch', 'Disco Clutch', ['sequin'], 'night', 120, 2],
    ['crop', 'Mesh Crop', ['solid'], 'night', 80, 3],
    ['drops', 'Chandelier Earrings', ['solid'], 'chrome', 110, 2],
  ],
  'track-club': [
    ['jacket', 'Tracksuit Top', ['stripe', 'solid'], 'acid', 120, 4],
    ['trousers', 'Tracksuit Bottom', ['stripe', 'solid'], 'acid', 100, 4],
    ['tee', 'Oversized Graphic Tee', ['monogram'], 'acid', 55, 5],
    ['jacket', 'Denim Set Jacket', ['denim'], 'street', 150, 2],
    ['jeans', 'Denim Set Jean', ['denim'], 'street', 130, 2],
    ['cargo', 'Parachute Cargo', ['solid'], 'acid', 120, 3],
    ['sandals', 'Pool Slide', ['solid'], 'acid', 40, 3],
  ],
  'sugar-rush': [
    ['crop', 'Bow Crop', ['solid', 'check'], 'kawaii', 60, 3],
    ['mini-skirt', 'Plaid Puff Skirt', ['check', 'solid'], 'kawaii', 70, 3],
    ['sandals', 'Platform Mary Jane', ['solid'], 'kawaii', 90, 2],
    ['backpack', 'Bunny Backpack', ['solid'], 'kawaii', 75, 2],
    ['hoodie', 'Cloud Hoodie', ['solid'], 'kawaii', 110, 2],
  ],
  'meji-meji': [
    ['blazer', 'Two-Way Blazer', ['solid', 'aso-oke'], 'luxe', 260, 3],
    ['corset', 'Lagos Corset', ['ankara', 'solid'], 'lagos', 160, 3],
    ['trousers', 'Palazzo Trouser', ['solid', 'ankara'], 'lagos', 150, 3],
    ['midi-dress', 'Wrap Midi', ['ankara'], 'lagos', 220, 3],
    ['jumpsuit', 'Island Jumpsuit', ['solid', 'adire'], 'lagos', 240, 2],
  ],
  bolapsd: [
    ['blouse', 'Puff Sleeve Blouse', ['solid', 'lace'], 'pastel', 140, 3],
    ['gown', 'Owambe Gown', ['lace', 'aso-oke', 'sequin'], 'gold', 420, 3, { rarity: 'epic' }],
    ['midi-skirt', 'Pleated Midi', ['solid'], 'pastel', 120, 3],
    ['mini-dress', 'Soft Power Mini', ['solid', 'ankara'], 'bold', 180, 3],
  ],
  'j-bottoms': [
    ['jeans', 'Wide-Leg Jean', ['denim'], 'street', 130, 4],
    ['cargo', 'Utility Cargo', ['solid'], 'earth', 120, 3],
    ['shorts', 'Lagos Short', ['denim', 'solid'], 'street', 80, 3],
    ['trousers', 'Tailored Trouser', ['solid', 'stripe'], 'luxe', 150, 3],
    ['maxi-skirt', 'Column Skirt', ['solid', 'adire'], 'indigo', 140, 2],
  ],
  yati: [
    ['shirt', 'Clean Line Shirt', ['solid', 'stripe'], 'luxe', 130, 3],
    ['kaftan', 'Minimal Kaftan', ['solid'], 'earth', 210, 3],
    ['mini-skirt', 'Sculpt Mini', ['solid'], 'bold', 110, 3],
    ['tank', 'Rib Tank', ['solid'], 'street', 55, 3],
  ],
  'ankara-house': [
    ['buba', 'Ankara Buba', ['ankara'], 'lagos', 110, 4],
    ['wrapper', 'Ankara Wrapper', ['ankara'], 'lagos', 95, 4],
    ['mini-dress', 'Wax Print Mini', ['ankara'], 'lagos', 150, 3],
    ['crop', 'Ankara Crop', ['ankara'], 'lagos', 70, 3],
    ['shirt', 'Ankara Shirt', ['ankara'], 'lagos', 100, 3],
    ['bucket-hat', 'Print Bucket Hat', ['ankara'], 'lagos', 45, 2],
  ],
  'aso-oke-atelier': [
    ['agbada', 'Grand Agbada', ['aso-oke'], 'gold', 480, 3, { rarity: 'legendary' }],
    ['gown', 'Aso-Oke Bridal Gown', ['aso-oke'], 'gold', 520, 2, { rarity: 'legendary', drop: 'limited' }],
    ['wrapper', 'Iro Wrapper', ['aso-oke'], 'gold', 180, 3],
    ['buba', 'Aso-Oke Buba', ['aso-oke'], 'gold', 170, 3],
  ],
  'adire-indigo': [
    ['shirt', 'Adire Shirt', ['adire'], 'indigo', 110, 3],
    ['boubou', 'Adire Boubou', ['adire'], 'indigo', 200, 3],
    ['trousers', 'Adire Trouser', ['adire'], 'indigo', 120, 2],
    ['headwrap', 'Adire Headwrap', ['adire'], 'indigo', 40, 3],
    ['tote', 'Adire Tote', ['adire'], 'indigo', 60, 2],
  ],
  'gele-couture': [
    ['gele', 'Owambe Gele', ['aso-oke', 'solid', 'sequin'], 'gold', 120, 5],
    ['headwrap', 'Everyday Wrap', ['ankara', 'solid'], 'lagos', 45, 3],
    ['gown', 'Party Gown', ['sequin', 'lace'], 'bold', 360, 2, { rarity: 'epic' }],
  ],
  'lekki-street': [
    ['hoodie', 'Lekki Hoodie', ['solid', 'ankara'], 'street', 120, 4],
    ['tee', 'Island Tee', ['solid', 'monogram'], 'street', 50, 4],
    ['cargo', 'Phase 1 Cargo', ['solid'], 'street', 110, 3],
    ['sneakers', 'Admiralty Runner', ['solid'], 'street', 160, 4],
    ['cap', 'Lekki Cap', ['solid'], 'street', 35, 3],
    ['puffer', 'Harmattan Puffer', ['solid'], 'street', 210, 2, { drop: 'seasonal' }],
  ],
  'yaba-youth': [
    ['tee', 'Mainland Tee', ['solid', 'stripe'], 'bold', 45, 4],
    ['jacket', 'Yaba Bomber', ['solid', 'ankara'], 'bold', 170, 3],
    ['shorts', 'Court Short', ['solid'], 'bold', 60, 3],
    ['backpack', 'Hub Backpack', ['solid'], 'street', 90, 2],
    ['sneakers', 'Herbert Macaulay Low', ['solid'], 'bold', 140, 3],
  ],
  'eko-thread': [
    ['agbada', 'Eko Agbada', ['solid', 'aso-oke'], 'luxe', 380, 3, { rarity: 'epic' }],
    ['kaftan', 'Senator Kaftan', ['solid'], 'luxe', 190, 4],
    ['loafers', 'Velvet Loafer', ['solid'], 'luxe', 150, 3],
    ['cap', 'Fila Cap', ['aso-oke', 'solid'], 'gold', 50, 3],
  ],
  'owambe-gold': [
    ['hoops', 'Owambe Hoops', ['solid'], 'gold', 90, 3],
    ['drops', 'Statement Drops', ['solid'], 'gold', 110, 3],
    ['chain', 'Cuban Chain', ['solid'], 'gold', 140, 3],
    ['bangle', 'Stack Bangles', ['solid'], 'gold', 80, 3],
    ['watch', 'Big Man Watch', ['solid'], 'gold', 260, 2, { rarity: 'epic' }],
  ],
  'coral-and-co': [
    ['coral-beads', 'Coral Bead Set', ['solid'], 'bold', 160, 3, { rarity: 'rare' }],
    ['waist-beads', 'Waist Beads', ['solid'], 'bold', 40, 4],
    ['studs', 'Coral Studs', ['solid'], 'bold', 45, 2],
    ['pendant', 'Heirloom Pendant', ['solid'], 'gold', 120, 2],
  ],
  'brooklyn-block': [
    ['hoodie', 'Stoop Hoodie', ['solid', 'monogram'], 'street', 130, 3],
    ['tee', 'Block Tee', ['solid', 'monogram'], 'street', 55, 3],
    ['cargo', 'Utility Pant', ['solid'], 'earth', 120, 2],
    ['sneakers', 'Block Runner', ['solid'], 'street', 170, 3],
    ['cap', 'Fitted Cap', ['solid'], 'street', 40, 2],
  ],
  'hollis-ave': [
    ['jeans', 'Hollis Baggy Jean', ['denim'], 'street', 140, 3],
    ['jacket', 'Trucker Jacket', ['denim'], 'street', 160, 2],
    ['shorts', 'Cut-Off Short', ['denim'], 'street', 70, 2],
    ['mini-skirt', 'Denim Mini', ['denim'], 'street', 80, 2],
  ],
  'mercer-luxe': [
    ['blazer', 'Mercer Blazer', ['solid', 'check'], 'luxe', 340, 2, { rarity: 'epic' }],
    ['gown', 'Gala Gown', ['sequin', 'solid'], 'luxe', 480, 2, { rarity: 'legendary' }],
    ['heels', 'Mercer Pump', ['solid', 'leopard'], 'luxe', 260, 3],
    ['clutch', 'Box Clutch', ['solid', 'monogram'], 'luxe', 220, 2],
    ['sunglasses', 'Shield Shades', ['solid'], 'luxe', 150, 2],
  ],
  'y2k-mall': [
    ['crop', 'Baby Tee Crop', ['solid', 'stripe'], 'y2k', 45, 4],
    ['mini-skirt', 'Pleated Micro', ['solid', 'check'], 'y2k', 60, 3],
    ['sandals', 'Platform Slide', ['solid'], 'y2k', 70, 3],
    ['sunglasses', 'Tiny Shades', ['solid'], 'y2k', 35, 2],
    ['tote', 'Shoulder Baguette', ['solid', 'leopard'], 'y2k', 65, 2],
  ],
  courtside: [
    ['tank', 'Court Tank', ['solid', 'stripe'], 'bold', 40, 3],
    ['shorts', 'Mesh Short', ['solid'], 'bold', 50, 3],
    ['sneakers', 'Court High', ['solid'], 'bold', 150, 3],
    ['jacket', 'Track Jacket', ['stripe', 'solid'], 'bold', 110, 2],
  ],
  'sunset-swim': [
    ['bikini', 'Sunset Bikini', ['solid', 'floral', 'leopard'], 'pastel', 70, 4],
    ['one-piece', 'Malibu One-Piece', ['solid', 'stripe'], 'bold', 85, 3],
    ['sandals', 'Pool Slide', ['solid'], 'pastel', 35, 2],
    ['bucket-hat', 'Sun Hat', ['solid'], 'pastel', 40, 2],
  ],
  'maison-lumiere': [
    ['gown', 'Lumière Couture Gown', ['sequin', 'lace', 'solid'], 'luxe', 560, 3, { rarity: 'legendary' }],
    ['corset', 'Atelier Corset', ['lace', 'solid'], 'luxe', 260, 2, { rarity: 'epic' }],
    ['heels', 'Lumière Slingback', ['solid'], 'luxe', 280, 2],
    ['drops', 'Chandelier Drops', ['solid'], 'gold', 180, 2],
  ],
  'rive-gauche': [
    ['blouse', 'Rive Blouse', ['solid', 'stripe'], 'luxe', 150, 3],
    ['trousers', 'Cigarette Trouser', ['solid', 'check'], 'luxe', 160, 2],
    ['jacket', 'Trench Jacket', ['solid'], 'earth', 260, 2],
    ['beret', 'Wool Beret', ['solid'], 'luxe', 55, 3],
    ['loafers', 'Penny Loafer', ['solid'], 'earth', 170, 2],
  ],
  'atelier-marais': [
    ['clutch', 'Marais Clutch', ['solid', 'monogram'], 'luxe', 240, 3],
    ['tote', 'Marché Tote', ['solid', 'monogram'], 'earth', 210, 3],
    ['backpack', 'Mini Sac', ['solid'], 'luxe', 190, 2],
    ['watch', 'Petite Montre', ['solid'], 'gold', 230, 2],
  ],
  'cote-bleue': [
    ['sunglasses', 'Riviera Cat-Eye', ['solid'], 'bold', 120, 3],
    ['glasses', 'Atelier Frames', ['solid'], 'luxe', 90, 3],
    ['bikini', 'Côte Bikini', ['stripe', 'solid'], 'bold', 90, 2],
    ['one-piece', 'Antibes Swimsuit', ['solid'], 'luxe', 110, 2],
  ],
  'second-life': [
    ['jacket', 'Thrifted Denim Jacket', ['denim'], 'earth', 45, 2],
    ['shirt', 'Grandpa Shirt', ['check', 'stripe', 'floral'], 'earth', 25, 3],
    ['midi-skirt', 'Charity Shop Midi', ['floral', 'check'], 'earth', 30, 2],
    ['boots', 'Worn-In Boots', ['solid'], 'earth', 50, 2],
    ['blazer', 'Oversized Blazer', ['check', 'solid'], 'earth', 40, 2],
  ],
  'vintage-vault': [
    ['midi-dress', 'Archive Tea Dress', ['floral'], 'earth', 70, 2],
    ['jumpsuit', '70s Jumpsuit', ['solid', 'stripe'], 'earth', 85, 2],
    ['glasses', 'Vintage Frames', ['solid'], 'earth', 40, 2],
    ['boots', 'Go-Go Boots', ['solid'], 'pastel', 90, 2, { rarity: 'rare' }],
  ],
  'dollcare-basics': [
    ['tee', 'Essential Tee', ['solid'], 'bold', 20, 4],
    ['trousers', 'Everyday Trouser', ['solid'], 'street', 35, 2],
    ['sneakers', 'Basic Sneaker', ['solid'], 'street', 40, 2],
    ['studs', 'Tiny Studs', ['solid'], 'gold', 20, 2],
  ],
}

/** Home: [template, name, brandId, palette, priceMultiplier] */
const HOME = [
  ['bed-single', 'Single Bed', 'dollcare-basics', 'wood', 1],
  ['bed-single', 'Ankara Daybed', 'lagos-living', 'lagos', 1.2],
  ['bed-double', 'Ikoyi Platform Bed', 'lagos-living', 'wood', 1],
  ['bed-double', 'Canopy Bed', 'maison-lune', 'pastel', 1.3],
  ['sofa', 'Owambe Sofa', 'ile-ayo', 'lagos', 1],
  ['sofa', 'Loft Leather Sofa', 'loft-home', 'earth', 1.2],
  ['sofa', 'Velvet Cloud Sofa', 'maison-lune', 'pastel', 1.3],
  ['loveseat', 'Aso-Oke Loveseat', 'ile-ayo', 'gold', 1],
  ['armchair', 'Rattan Armchair', 'lagos-living', 'wood', 1],
  ['armchair', 'Bouclé Chair', 'maison-lune', 'pastel', 1.1],
  ['beanbag', 'Print Beanbag', 'ile-ayo', 'lagos', 1],
  ['beanbag', 'Y2K Beanbag', 'dollcare-basics', 'y2k', 1],
  ['coffee-table', 'Iroko Coffee Table', 'lagos-living', 'wood', 1],
  ['coffee-table', 'Marble Coffee Table', 'maison-lune', 'luxe', 1.4],
  ['side-table', 'Drum Side Table', 'ile-ayo', 'wood', 1],
  ['dining-table', 'Family Dining Table', 'lagos-living', 'wood', 1],
  ['chair', 'Bistro Chair', 'maison-lune', 'luxe', 1],
  ['chair', 'Basic Chair', 'dollcare-basics', 'street', 0.8],
  ['stool', 'Bar Stool', 'loft-home', 'earth', 1],
  ['desk', 'Creator Desk', 'loft-home', 'wood', 1],
  ['bookshelf', 'Loft Bookshelf', 'loft-home', 'wood', 1],
  ['tv-stand', 'Media Wall', 'lagos-living', 'wood', 1],
  ['wardrobe', 'Walk-In Wardrobe', 'ile-ayo', 'pastel', 1],
  ['wardrobe', 'Basic Closet', 'dollcare-basics', 'wood', 0.8],
  ['clothes-rack', 'Stylist Rail', 'loft-home', 'gold', 1],
  ['vanity', 'Hollywood Vanity', 'maison-lune', 'pastel', 1],
  ['vanity', 'Glam Station', 'ile-ayo', 'gold', 1.2],
  ['dresser', 'Six-Drawer Dresser', 'vintage-vault', 'wood', 0.8],
  ['mirror-floor', 'Arch Floor Mirror', 'maison-lune', 'gold', 1],
  ['floor-lamp', 'Arc Floor Lamp', 'loft-home', 'luxe', 1],
  ['floor-lamp', 'Raffia Lamp', 'lagos-living', 'earth', 1],
  ['table-lamp', 'Mushroom Lamp', 'maison-lune', 'pastel', 1],
  ['table-lamp', 'Basic Lamp', 'dollcare-basics', 'bold', 0.8],
  ['neon-sign', 'Neon "Soft Life"', 'ile-ayo', 'bold', 1],
  ['neon-sign', 'Neon "Main Character"', 'dollcare-basics', 'y2k', 1],
  ['plant-tall', 'Fiddle Leaf Fig', 'lagos-living', 'earth', 1],
  ['plant-tall', 'Snake Plant', 'dollcare-basics', 'earth', 0.8],
  ['plant-small', 'Desk Succulent', 'dollcare-basics', 'earth', 1],
  ['plant-small', 'Hanging Pothos', 'lagos-living', 'earth', 1.2],
  ['rug-round', 'Kente Round Rug', 'ile-ayo', 'gold', 1],
  ['rug-round', 'Shag Rug', 'dollcare-basics', 'pastel', 0.9],
  ['rug-rect', 'Adire Runner Rug', 'lagos-living', 'indigo', 1],
  ['rug-rect', 'Berber Rug', 'vintage-vault', 'earth', 1.1],
  ['art-frame', 'Lagos Skyline Print', 'lagos-living', 'lagos', 1],
  ['art-frame', 'Afrofuturist Portrait', 'ile-ayo', 'bold', 1.6],
  ['art-frame', 'Gallery Abstract', 'maison-lune', 'pastel', 1.2],
  ['art-frame', 'Thrifted Landscape', 'second-life', 'earth', 0.5],
  ['wall-shelf', 'Floating Shelf', 'loft-home', 'wood', 1],
  ['wall-mirror', 'Sunburst Mirror', 'maison-lune', 'gold', 1],
  ['kitchen-counter', 'Island Kitchen', 'lagos-living', 'luxe', 1],
  ['fridge', 'Double Fridge', 'dollcare-basics', 'street', 1],
  ['stove', 'Jollof Station Stove', 'ile-ayo', 'street', 1],
  ['bathtub', 'Clawfoot Tub', 'vintage-vault', 'luxe', 1],
  ['bathtub', 'Spa Tub', 'maison-lune', 'pastel', 1.2],
  ['sink', 'Pedestal Sink', 'dollcare-basics', 'street', 1],
  ['speaker', 'Afrobeats Speaker', 'yaba-youth', 'street', 1],
  ['speaker', 'Vinyl Setup', 'vintage-vault', 'wood', 1.4],
]

/** Hair accessories and beauty shades. */
const UNLOCKS = [
  ['crown-and-kinks', 'hair', 'Gold Loc Cuffs', { kind: 'hair-accessory', id: 'cuffs' }, ['#D4AF37', '#FFF1C1'], 40],
  ['crown-and-kinks', 'hair', 'Braid Bead Set', { kind: 'hair-accessory', id: 'beads' }, ['#E8505B', '#FFFFFF'], 35],
  ['crown-and-kinks', 'hair', 'Silk Hair Scarf', { kind: 'hair-accessory', id: 'scarf' }, ['#FF3D8B', '#FFC24D'], 45],
  ['crown-and-kinks', 'hair', 'Pearl Hair Pins', { kind: 'hair-accessory', id: 'pearls' }, ['#F5F0E6', '#FFFFFF'], 50],
  ['crown-and-kinks', 'hair', 'Flower Crown Pins', { kind: 'hair-accessory', id: 'flowers' }, ['#FFB3D1', '#00A88F'], 30],
  ['gele-couture', 'hair', 'Gele Tying Kit', { kind: 'hair-accessory', id: 'gele' }, ['#C9A227', '#7A1E3A'], 90],
  ['adire-indigo', 'hair', 'Headwrap Kit', { kind: 'hair-accessory', id: 'headwrap' }, ['#1E3A8A', '#E8EEF9'], 40],
  ['naija-glow', 'beauty', 'Lip: Zobo', { kind: 'shade', color: '#7B1E3B', label: 'Zobo' }, ['#7B1E3B', '#FFFFFF'], 25],
  ['naija-glow', 'beauty', 'Lip: Palm Wine', { kind: 'shade', color: '#B5651D', label: 'Palm Wine' }, ['#B5651D', '#FFFFFF'], 25],
  ['naija-glow', 'beauty', 'Lip: Chin Chin', { kind: 'shade', color: '#C68E5C', label: 'Chin Chin' }, ['#C68E5C', '#FFFFFF'], 25],
  ['naija-glow', 'beauty', 'Lip: Suya Spice', { kind: 'shade', color: '#8B2E16', label: 'Suya Spice' }, ['#8B2E16', '#FFFFFF'], 25],
  ['naija-glow', 'beauty', 'Polish: Owambe Gold', { kind: 'shade', color: '#D4AF37', label: 'Owambe Gold' }, ['#D4AF37', '#FFFFFF'], 20],
  ['naija-glow', 'beauty', 'Polish: Lagoon', { kind: 'shade', color: '#00A88F', label: 'Lagoon' }, ['#00A88F', '#FFFFFF'], 20],
  ['peach-beauty', 'beauty', 'Lip: Peach Fuzz', { kind: 'shade', color: '#FF9E80', label: 'Peach Fuzz' }, ['#FF9E80', '#FFFFFF'], 25],
  ['peach-beauty', 'beauty', 'Lip: Southern Berry', { kind: 'shade', color: '#6D1A36', label: 'Southern Berry' }, ['#6D1A36', '#FFFFFF'], 25],
  ['peach-beauty', 'beauty', 'Polish: Candy Chrome', { kind: 'shade', color: '#FF8FD8', label: 'Candy Chrome' }, ['#FF8FD8', '#FFFFFF'], 20],
  ['maison-lumiere', 'beauty', 'Lip: Rouge Lumière', { kind: 'shade', color: '#B00020', label: 'Rouge Lumière' }, ['#B00020', '#D4AF37'], 45],
  ['maison-lumiere', 'beauty', 'Polish: Noir Laque', { kind: 'shade', color: '#141014', label: 'Noir Laque' }, ['#141014', '#D4AF37'], 40],
]

/** Fashion identities per brand, plus a few template- and pattern-based extras. */
const BRAND_AESTHETICS = {
  'meji-meji': ['streetwear', 'editorial'], bolapsd: ['soft-glam', 'luxury'], 'j-bottoms': ['streetwear'], yati: ['minimal'],
  'ankara-house': ['owambe', 'streetwear'], 'aso-oke-atelier': ['owambe', 'luxury'], 'adire-indigo': ['minimal', 'editorial'],
  'gele-couture': ['owambe', 'nightlife'], 'lekki-street': ['streetwear'], 'yaba-youth': ['streetwear', 'y2k'], 'eko-thread': ['luxury', 'owambe'],
  'owambe-gold': ['luxury', 'owambe'], 'coral-and-co': ['owambe'], 'noir-lagos': ['goth', 'alt'], 'afterhours-eko': ['nightlife', 'soft-glam'],
  'track-club': ['streetwear', 'y2k'], 'sugar-rush': ['kawaii', 'y2k'], 'brooklyn-block': ['streetwear'], 'hollis-ave': ['streetwear', 'y2k'],
  'mercer-luxe': ['luxury', 'nightlife'], 'y2k-mall': ['y2k', 'kawaii'], courtside: ['streetwear'], 'sunset-swim': ['soft-glam'],
  'maison-lumiere': ['editorial', 'luxury'], 'rive-gauche': ['minimal', 'editorial'], 'atelier-marais': ['luxury', 'minimal'],
  'cote-bleue': ['minimal'], 'second-life': ['alt'], 'bend-down-select': ['streetwear', 'alt'], 'vintage-vault': ['alt', 'editorial'], 'dollcare-basics': ['minimal'],
}
function aestheticsFor(brandId, template, pattern) {
  const set = new Set(BRAND_AESTHETICS[brandId] ?? ['minimal'])
  if (pattern === 'sequin') set.add('nightlife')
  if (pattern === 'lace' && brandId === 'noir-lagos') set.add('goth')
  if (['gown', 'heels', 'clutch'].includes(template)) set.add('nightlife')
  if (['gele', 'agbada', 'wrapper', 'buba'].includes(template)) set.add('owambe')
  return [...set].slice(0, 3)
}

const RARITY_MULT = { common: 1, rare: 1.35, epic: 1.8, legendary: 2.6, limited: 3 }
const items = []
const ids = new Set()
const slugify = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

function addItem(item) {
  let id = item.id
  let n = 2
  while (ids.has(id)) id = `${item.id}-${n++}`
  ids.add(id)
  items.push({ ...item, id })
}

for (const [brandId, lines] of Object.entries(LINES)) {
  if (!brandIds.has(brandId)) throw new Error(`Unknown brand ${brandId}`)
  for (const [template, stem, patterns, palette, basePrice, count, opts = {}] of lines) {
    const colors = [...PALETTES[palette]]
    for (let i = 0; i < count; i++) {
      const pair = colors[i % colors.length]
      const pattern = patterns[i % patterns.length]
      let rarity = opts.rarity ?? (rand() < 0.12 ? 'rare' : 'common')
      let drop = opts.drop
      if (!drop && rand() < 0.05) {
        drop = 'limited'
        rarity = 'limited'
      }
      const price = round5(basePrice * RARITY_MULT[rarity] * (0.9 + rand() * 0.2))
      const patternLabel = pattern === 'solid' ? '' : ` ${pattern.replace('-', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}`
      const name = `${stem} — ${colorName(pair[0])}${patternLabel}`
      addItem({
        id: `${brandId}-${slugify(stem)}-${slugify(colorName(pair[0]))}${pattern === 'solid' ? '' : `-${pattern}`}`,
        name,
        brandId,
        category: CATEGORY(template),
        slot: SLOT[template],
        template,
        colors: pair,
        pattern,
        rarity,
        price,
        tags: [template, pattern, colorName(pair[0]).toLowerCase(), ...(drop ? [drop] : [])],
        aesthetics: aestheticsFor(brandId, template, pattern),
        ...(drop ? { drop } : {}),
      })
    }
  }
}

for (const [template, name, brandId, palette, mult] of HOME) {
  const spec = FURNITURE[template]
  const pair = pick(PALETTES[palette])
  const pattern = palette === 'lagos' ? 'ankara' : palette === 'indigo' ? 'adire' : palette === 'gold' && template.startsWith('rug') ? 'kente' : 'solid'
  addItem({
    id: `${brandId}-${slugify(name)}`,
    name,
    brandId,
    category: 'home',
    slot: null,
    template,
    colors: pair,
    pattern,
    rarity: mult >= 1.4 ? 'rare' : 'common',
    price: round5(spec.price * mult),
    tags: [template, spec.room],
    furniture: { template, room: spec.room, mount: spec.mount, w: spec.w, d: spec.d, h: spec.h },
  })
}

for (const [brandId, category, name, unlock, colors, price] of UNLOCKS) {
  addItem({
    id: `${brandId}-${slugify(name)}`,
    name,
    brandId,
    category,
    slot: null,
    template: 'unlock',
    colors,
    pattern: 'solid',
    rarity: price >= 45 ? 'rare' : 'common',
    price,
    tags: [unlock.kind],
    unlock,
  })
}

const out = resolve(root, 'src/shared/catalog.json')
writeFileSync(out, JSON.stringify(items, null, 0).replace(/\},\{/g, '},\n{') + '\n')
const byRegion = {}
for (const it of items) {
  const region = brands.find((b) => b.id === it.brandId).region
  byRegion[region] = (byRegion[region] ?? 0) + 1
}
console.log(`Wrote ${items.length} items to ${out}`, byRegion)
