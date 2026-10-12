import brandsJson from './brands.json'
import catalogJson from './catalog.json'
import { DRIP_BRANDS, generateDripItems, LEGACY_VIBES } from './drip'
import type { Brand, BrandRegion, CatalogItem, FurnitureSpec, OutfitSlot } from './types'

/** Original labels (catalog.json) plus the Drip's flipped labels, each tagged with its aisle. */
export const BRANDS: Brand[] = [...(brandsJson as Brand[]).map((x) => ({ ...x, vibe: x.vibe ?? LEGACY_VIBES[x.id] ?? 'basic' })), ...DRIP_BRANDS]
export const BRAND_BY_ID = new Map(BRANDS.map((b) => [b.id, b]))

/**
 * Free basics every doll owns from day one. Not sold in the shop.
 * Ids start with "starter-" so the server never charges for them.
 */
const sm = (template: FurnitureSpec['template'], w: number, d: number, h: number): FurnitureSpec => ({
  template,
  room: 'bedroom',
  mount: 'floor',
  w,
  d,
  h,
})

export const STARTER_ITEMS: CatalogItem[] = [
  ['starter-tee-white', 'Basic Tee — White', 'top', 'tee', '#FFFFFF', '#E9E2DC'],
  ['starter-tee-black', 'Basic Tee — Black', 'top', 'tee', '#2B2B2B', '#FFFFFF'],
  ['starter-tank-pink', 'Rib Tank — Pink', 'top', 'tank', '#FFB3D1', '#FFFFFF'],
  ['starter-crop-lilac', 'Crop Top — Lilac', 'top', 'crop', '#D9C2FF', '#FFFFFF'],
  ['starter-shirt-blue', 'Oxford Shirt — Sky', 'top', 'shirt', '#9CC3F0', '#FFFFFF'],
  ['starter-hoodie-grey', 'Hoodie — Heather', 'outerwear', 'hoodie', '#B8B2BD', '#FFFFFF'],
  ['starter-jeans', 'Straight Jeans', 'bottom', 'jeans', '#4A6FA5', '#2B4B7A'],
  ['starter-trousers-black', 'Trousers — Black', 'bottom', 'trousers', '#2B2B2B', '#2B2B2B'],
  ['starter-trousers-camel', 'Trousers — Camel', 'bottom', 'trousers', '#C49A6C', '#C49A6C'],
  ['starter-mini-skirt-pink', 'Mini Skirt — Lacquer', 'bottom', 'mini-skirt', '#FF3D8B', '#FFFFFF'],
  ['starter-midi-skirt-cream', 'Midi Skirt — Cream', 'bottom', 'midi-skirt', '#F5F0E6', '#FFFFFF'],
  ['starter-shorts-denim', 'Denim Shorts', 'bottom', 'shorts', '#6F8FC0', '#FFFFFF'],
  ['starter-midi-dress-mint', 'Slip Dress — Mint', 'dress', 'midi-dress', '#7CF0CF', '#FFFFFF'],
  ['starter-sneakers-white', 'Sneakers — White', 'shoes', 'sneakers', '#FFFFFF', '#E9E2DC'],
  ['starter-sneakers-black', 'Sneakers — Black', 'shoes', 'sneakers', '#2B2B2B', '#FFFFFF'],
  ['starter-sandals', 'Slides — Nude', 'shoes', 'sandals', '#D9B48F', '#FFFFFF'],
  ['starter-boots', 'Ankle Boots', 'shoes', 'boots', '#5C4033', '#2B2B2B'],
  ['starter-studs', 'Tiny Studs', 'earrings', 'studs', '#D4AF37', '#FFFFFF'],
  ['starter-glasses', 'Everyday Frames', 'eyewear', 'glasses', '#1C1C1C', '#FFFFFF'],
  ['starter-sunglasses', 'Black Shades', 'eyewear', 'sunglasses', '#111111', '#2B2B2B'],
  ['starter-graphic-tee', 'Graphic Tee — Scene', 'top', 'tee', '#0E0B10', '#FF2E88'],
  ['starter-cargo', 'Cargo — Stone', 'bottom', 'cargo', '#9A9184', '#9A9184'],
  // Traditional drip: Yoruba, Igbo and Hausa pieces the default dolls arrive in.
  ['starter-gele-gold', 'Gele — Gold Aso-oke', 'headwear', 'gele', '#D4AF37', '#FFF1C1', 'aso-oke'],
  ['starter-gele-fuchsia', 'Gele — Fuchsia', 'headwear', 'gele', '#FF2E88', '#FFD1E6', 'aso-oke'],
  ['starter-buba-oleku', 'Oleku Buba — Ivory Lace', 'top', 'buba', '#F5E6D3', '#FFFFFF', 'lace'],
  ['starter-iro-ankara', 'Iro Wrapper — Ankara', 'bottom', 'wrapper', '#E8505B', '#FFC24D', 'ankara'],
  ['starter-agbada-white', 'Agbada — White Aso-oke', 'outerwear', 'agbada', '#F5F0E6', '#D4AF37', 'aso-oke'],
  ['starter-fila', 'Fila Cap — Wine', 'headwear', 'beret', '#7A1E3A', '#D4AF37', 'aso-oke'],
  ['starter-isiagu', 'Isiagu — Red & Gold', 'top', 'buba', '#B71C1C', '#F5C518', 'monogram'],
  ['starter-okpu-red', 'Red Cap (Okpu Ododo)', 'headwear', 'beret', '#C62828', '#C62828', 'solid'],
  ['starter-coral-beads', 'Coral Beads', 'necklace', 'coral-beads', '#E4572E', '#F5C518', 'solid'],
  ['starter-igbo-blouse', 'Igbo Lace Blouse — Coral', 'top', 'blouse', '#F28C6B', '#FFFFFF', 'lace'],
  ['starter-george-wrapper', 'George Wrapper — Wine', 'bottom', 'wrapper', '#6D1B3B', '#D4AF37', 'check'],
  ['starter-hausa-crop', 'Hausa Embroidered Crop', 'top', 'crop', '#FFFFFF', '#1C7C54', 'aso-oke'],
  ['starter-zani-wrapper', 'Zani Wrapper — Indigo', 'bottom', 'wrapper', '#2B3A8C', '#E9C46A', 'ankara'],
  ['starter-dankwali', 'Dankwali Headtie — Emerald', 'headwear', 'headwrap', '#1C7C54', '#FFFFFF', 'solid'],
  ['starter-kaftan-hausa', 'Babban Riga Kaftan — Sky', 'dress', 'kaftan', '#8EC5E8', '#FFFFFF', 'lace'],
  // Trad pieces for the extra default dolls (also land in the move-in suitcase).
  ['starter-boubou-ankara', 'Boubou — Ankara Sunset', 'dress', 'boubou', '#FF6B2C', '#1C7C54', 'ankara'],
  ['starter-maxi-adire', 'Adire Maxi Skirt — Indigo', 'bottom', 'maxi-skirt', '#2B4BAA', '#F2E6C9', 'adire'],
  ['starter-kaftan-white', 'Kaftan — Ivory Lace', 'dress', 'kaftan', '#F5F0E6', '#D4AF37', 'lace'],
  // Streetwear, classy, basics, thrift, edgy, gym: everyday starter pieces (pattern after 'plain').
  ['starter-corset-black', 'Corset — Black', 'top', 'corset', '#111111', '#FF2E88'],
  ['starter-sports-bra', 'Sports Bra — Volt', 'top', 'crop', '#C8FF3D', '#111111'],
  ['starter-check-shirt', 'Thrift Flannel — Red Check', 'top', 'shirt', '#A33A3A', '#2B2B2B', 'plain', 'check'],
  ['starter-leather-jacket', 'Leather Jacket — Black', 'outerwear', 'jacket', '#1C1C1C', '#3A3A3A'],
  ['starter-puffer-lilac', 'Puffer — Lilac', 'outerwear', 'puffer', '#C9A7FF', '#FFFFFF'],
  ['starter-blazer-cream', 'Blazer — Cream', 'outerwear', 'blazer', '#F5F0E6', '#2B2B2B'],
  ['starter-gown-emerald', 'Satin Gown — Emerald', 'dress', 'gown', '#00A88F', '#E9C46A'],
  ['starter-mini-dress-black', 'Little Black Dress', 'dress', 'mini-dress', '#111111', '#FFFFFF'],
  ['starter-jumpsuit-rust', 'Jumpsuit — Rust', 'dress', 'jumpsuit', '#C47A4A', '#F5F0E6'],
  ['starter-cargo-black', 'Cargo — Black', 'bottom', 'cargo', '#1C1C1C', '#1C1C1C'],
  ['starter-leggings', 'Leggings — Black', 'bottom', 'trousers', '#111111', '#111111'],
  ['starter-thrift-jeans', 'Thrift Jeans — Faded', 'bottom', 'jeans', '#7C93B5', '#FFFFFF', 'plain', 'denim'],
  ['starter-mini-skirt-leather', 'Leather Mini — Black', 'bottom', 'mini-skirt', '#111111', '#111111'],
  ['starter-chunky-sneakers', 'Chunky Runners — Bone', 'shoes', 'sneakers', '#E9E2DC', '#9A9184'],
  ['starter-chunky-sneakers-black', 'Chunky Runners — Triple Black', 'shoes', 'sneakers', '#1C1C1C', '#3A3A3A'],
  ['starter-heels-nude', 'Heels — Nude', 'shoes', 'heels', '#D9B48F', '#FFFFFF'],
  ['starter-heels-black', 'Heels — Black', 'shoes', 'heels', '#111111', '#111111'],
  ['starter-loafers', 'Loafers — Brown', 'shoes', 'loafers', '#5C4033', '#2B2B2B'],
  ['starter-bucket-hat', 'Bucket Hat — Denim', 'headwear', 'bucket-hat', '#4A6FA5', '#FFFFFF'],
  ['starter-cap-black', 'Cap — Black', 'headwear', 'cap', '#111111', '#FFFFFF'],
  ['starter-hoops-gold', 'Gold Hoops', 'earrings', 'hoops', '#D4AF37', '#FFFFFF'],
  ['starter-chain-silver', 'Silver Chain', 'necklace', 'chain', '#C7CAD1', '#FFFFFF'],
  ['starter-clutch-gold', 'Clutch — Gold', 'bag', 'clutch', '#D4AF37', '#111111'],
  ['starter-tote-canvas', 'Canvas Tote', 'bag', 'tote', '#E9E2DC', '#2B2B2B'],
].map(
  ([id, name, slot, template, c1, c2, mark, plainPattern]): CatalogItem => {
    // A 7th field is a traditional piece's pattern; 'plain' marks an everyday piece with an optional 8th pattern.
    const plain = mark === 'plain'
    const pattern = plain ? plainPattern : mark
    return {
    id,
    name,
    brandId: 'dollcare-basics',
    category: slot === 'shoes' ? 'shoes' : slot === 'bag' ? 'bags' : slot === 'earrings' || slot === 'necklace' ? 'jewellery' : slot === 'eyewear' ? 'eyewear' : 'fashion',
    slot: slot as OutfitSlot,
    template: template as CatalogItem['template'],
    colors: [c1, c2],
    pattern: (pattern as CatalogItem['pattern'] | undefined) ?? (id === 'starter-jeans' || id === 'starter-shorts-denim' ? 'denim' : id === 'starter-graphic-tee' ? 'monogram' : 'solid'),
    rarity: 'common',
    price: 0,
    tags: pattern && !plain ? ['starter', 'traditional'] : ['starter'],
    }
  },
)

export const SLEEPING_MAT: CatalogItem = {
  id: 'starter-sleeping-mat',
  name: 'Sleeping Mat',
  brandId: 'dollcare-basics',
  category: 'home',
  slot: null,
  template: 'sleeping-mat',
  colors: ['#C9B8A6', '#8C5A3C'],
  pattern: 'stripe',
  rarity: 'common',
  price: 0,
  tags: ['starter'],
  furniture: sm('sleeping-mat', 0.9, 1.9, 0.08),
}

/** Free pieces that make the starter crib modest but attractive. */
export const STARTER_FURNITURE: CatalogItem[] = (
  [
    ['starter-rug', 'Starter Rug — Blush', 'rug-round', 'decor', 'rug', 1.4, 1.4, 0.02, '#F5D4DA', '#FFFFFF'],
    ['starter-lamp', 'Starter Floor Lamp', 'floor-lamp', 'lighting', 'floor', 0.4, 0.4, 1.6, '#F4F0EA', '#C7CAD1'],
    ['starter-plant', 'Starter Snake Plant', 'plant-tall', 'plants', 'floor', 0.5, 0.5, 1.5, '#6B7F4F', '#0E0B10'],
    ['starter-mirror', 'Starter Floor Mirror', 'mirror-floor', 'vanity-closet', 'floor', 0.6, 0.3, 1.7, '#C7CAD1', '#FFFFFF'],
    ['starter-rack', 'Starter Clothes Rail', 'clothes-rack', 'vanity-closet', 'floor', 1.2, 0.5, 1.6, '#C7CAD1', '#FFFFFF'],
    // The furnished starter home every new player moves into.
    ['starter-beanbag', 'Starter Beanbag — Blush', 'beanbag', 'living', 'floor', 0.8, 0.8, 0.6, '#FFB3D1', '#FFFFFF'],
    ['starter-side-table', 'Starter Side Table', 'side-table', 'living', 'floor', 0.45, 0.45, 0.55, '#C49A6C', '#8C5A3C'],
    ['starter-plant-small', 'Starter Pothos', 'plant-small', 'plants', 'floor', 0.35, 0.35, 0.6, '#6B7F4F', '#F4E9E1'],
    ['starter-gmg', 'Ghana Must Go (the one that stays)', 'ghana-must-go', 'decor', 'floor', 0.7, 0.45, 0.45, '#C0392B', '#2B4BAA'],
    ['starter-pet-cat', 'Your Cat', 'pet-cat', 'decor', 'floor', 0.35, 0.5, 0.35, '#F2A65A', '#FFFFFF'],
    ['starter-pet-dog', 'Your Dog', 'pet-dog', 'decor', 'floor', 0.4, 0.6, 0.45, '#C49A6C', '#5C4033'],
  ] as const
).map(([id, name, template, room, mount, w, d, h, c1, c2]) => ({
  id,
  name,
  brandId: 'dollcare-basics',
  category: 'home' as const,
  slot: null,
  template,
  colors: [c1, c2] as [string, string],
  pattern: template === 'ghana-must-go' ? ('check' as const) : ('solid' as const),
  rarity: 'common' as const,
  price: 0,
  tags: ['starter'],
  furniture: { template, room, mount, w, d, h },
}))

/** Everything sold in the Drip: the original catalog plus thousands of generated Drip pieces. */
/** Crib decor: posters, chandeliers, flowers, wine racks, pets, fish and lots of plants. Some unlock with level. */
export const DECOR_ITEMS: CatalogItem[] = (
  [
    ['decor-poster-metal', 'Hard Metal Poster — Skull & Flames', 'poster', 'art', 'wall', 0.6, 0.02, 0.85, '#111111', '#C62828', 120, 2, ['metal']],
    ['decor-poster-metal-2', 'Thrash Tour Poster', 'poster', 'art', 'wall', 0.6, 0.02, 0.85, '#1C1C1C', '#C7CAD1', 120, 2, ['metal']],
    ['decor-poster-boyband', 'Boyband Poster — Heartthrobs', 'poster', 'art', 'wall', 0.6, 0.02, 0.85, '#FFB3D1', '#9CC3F0', 120, 2, ['boyband']],
    ['decor-poster-boyband-2', 'Boyband World Tour Poster', 'poster', 'art', 'wall', 0.6, 0.02, 0.85, '#C9A7FF', '#FFE0A3', 120, 2, ['boyband']],
    ['decor-chandelier', 'Crystal Chandelier', 'chandelier', 'lighting', 'rug', 0.9, 0.9, 0.7, '#D4AF37', '#E8F4FF', 900, 5, []],
    ['decor-chandelier-pink', 'Rose Gold Chandelier', 'chandelier', 'lighting', 'rug', 0.9, 0.9, 0.7, '#E8B4A0', '#FFE3EF', 950, 5, []],
    ['decor-bouquet', 'Bouquet of Red Roses', 'bouquet', 'decor', 'floor', 0.3, 0.3, 0.6, '#E8505B', '#FFFFFF', 60, 0, []],
    ['decor-bouquet-peony', 'Peony Bouquet', 'bouquet', 'decor', 'floor', 0.3, 0.3, 0.6, '#FFB3D1', '#F5F0E6', 70, 0, []],
    ['decor-bouquet-sunflower', 'Sunflower Bouquet', 'bouquet', 'decor', 'floor', 0.3, 0.3, 0.6, '#FFC24D', '#2B4BAA', 55, 0, []],
    ['decor-wine-rack', 'Wine Rack', 'wine-rack', 'kitchen', 'floor', 0.8, 0.35, 1.2, '#5C4033', '#7A1E3A', 280, 2, []],
    ['decor-aquarium', 'Aquarium & Fish', 'aquarium', 'decor', 'floor', 1.0, 0.45, 1.0, '#5FA8D3', '#FF8C42', 650, 6, []],
    ['decor-cat', 'Ginger Cat', 'pet-cat', 'decor', 'floor', 0.35, 0.5, 0.35, '#F2A65A', '#FFFFFF', 250, 0, []],
    ['decor-cat-black', 'Black Cat', 'pet-cat', 'decor', 'floor', 0.35, 0.5, 0.35, '#1C1C1C', '#FF8CC0', 250, 0, []],
    ['decor-dog', 'Golden Pup', 'pet-dog', 'decor', 'floor', 0.4, 0.6, 0.45, '#E0B061', '#8C5A3C', 300, 0, []],
    ['decor-dog-white', 'Fluffy White Dog', 'pet-dog', 'decor', 'floor', 0.4, 0.6, 0.45, '#F4F0EA', '#C49A6C', 300, 0, []],
    ['decor-monstera', 'Monstera', 'plant-tall', 'plants', 'floor', 0.6, 0.6, 1.4, '#3E7D4A', '#F4E9E1', 140, 0, []],
    ['decor-fiddle', 'Fiddle Leaf Fig', 'plant-tall', 'plants', 'floor', 0.5, 0.5, 1.7, '#4F8A3C', '#1C1C1C', 160, 0, []],
    ['decor-palm', 'Areca Palm', 'palm', 'plants', 'floor', 0.7, 0.7, 1.8, '#5FA04E', '#C49A6C', 180, 0, []],
    ['decor-cactus', 'Cactus Trio', 'cactus', 'plants', 'floor', 0.5, 0.3, 0.6, '#4F8A3C', '#E8505B', 70, 0, []],
    ['decor-hanging', 'Hanging Pothos', 'plant-hanging', 'plants', 'rug', 0.5, 0.5, 0.8, '#3CB371', '#F4E9E1', 90, 0, []],
    ['decor-hanging-2', 'Trailing String of Pearls', 'plant-hanging', 'plants', 'rug', 0.5, 0.5, 0.8, '#7CC576', '#C49A6C', 95, 0, []],
    ['decor-snake', 'Snake Plant', 'plant-small', 'plants', 'floor', 0.35, 0.35, 0.7, '#2E6B3F', '#1C1C1C', 60, 0, []],
    ['decor-beanbag-black', 'Beanbag — Black Leather', 'beanbag', 'living', 'floor', 0.8, 0.8, 0.6, '#1C1C1C', '#3A3A3A', 180, 0, []],
    ['decor-beanbag-cheetah', 'Beanbag — Cheetah', 'beanbag', 'living', 'floor', 0.8, 0.8, 0.6, '#D9A35B', '#3B2219', 200, 0, ['leopard']],
    ['decor-beanbag-pink', 'Beanbag — Fluffy Pink', 'beanbag', 'living', 'floor', 0.8, 0.8, 0.6, '#FFB3D1', '#FFFFFF', 180, 0, []],
  ] as const
).map(([id, name, template, room, mount, w, d, h, c1, c2, price, level, tags]) => ({
  id,
  name,
  brandId: 'lagos-living',
  category: 'home' as const,
  slot: null,
  template,
  colors: [c1, c2] as [string, string],
  pattern: (tags as readonly string[]).includes('leopard') ? ('leopard' as const) : ('solid' as const),
  rarity: price >= 600 ? ('epic' as const) : price >= 200 ? ('rare' as const) : ('common' as const),
  price,
  tags: ['decor', ...tags],
  furniture: { template, room, mount, w, d, h },
  ...(level ? { unlockLevel: level } : {}),
}))

export const CATALOG: CatalogItem[] = [...(catalogJson as CatalogItem[]), ...generateDripItems(), ...DECOR_ITEMS]

/** Every item the game knows, including free starter pieces. */
export const ALL_ITEMS: CatalogItem[] = [...CATALOG, ...STARTER_ITEMS, SLEEPING_MAT, ...STARTER_FURNITURE]
export const STARTER_HOME = [SLEEPING_MAT.id, ...STARTER_FURNITURE.map((i) => i.id)]
export const ITEM_BY_ID = new Map(ALL_ITEMS.map((i) => [i.id, i]))

export function getItem(id: string | undefined | null): CatalogItem | undefined {
  return id ? ITEM_BY_ID.get(id) : undefined
}

export const isStarterItem = (id: string) => id.startsWith('starter-')

export const REGION_ORDER: BrandRegion[] = ['nigeria', 'america', 'france', 'thrift', 'global']
export const REGION_LABEL: Record<BrandRegion, string> = {
  nigeria: 'Nigeria',
  america: 'America',
  france: 'France',
  thrift: 'Thrift & Vintage',
  global: 'International',
}

/** Which slots a slot hides when worn (a dress replaces top and bottom). */
export const SLOT_CONFLICTS: Partial<Record<OutfitSlot, OutfitSlot[]>> = {
  dress: ['top', 'bottom', 'swimwear'],
  top: ['dress', 'swimwear'],
  bottom: ['dress', 'swimwear'],
  swimwear: ['dress', 'top', 'bottom'],
}
