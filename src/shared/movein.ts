import { STARTER_FURNITURE, STARTER_ITEMS } from './catalog'

export type LuggageKind = 'ghana-must-go' | 'suitcase' | 'box'

export interface LuggageDef {
  id: string
  kind: LuggageKind
  label: string
  /** Inventory items you get when you unpack it. */
  items: string[]
  /** Where it lands in the studio (x, z) and its colour. */
  spot: [number, number]
  color: string
}

const clothes = (ids: string[]) => ids.filter((id) => STARTER_ITEMS.some((i) => i.id === id))

/**
 * Move-in day: the truck drops your load in the crib. Unpacking each piece
 * puts its contents in your wardrobe or furniture tray.
 */
export const LUGGAGE: LuggageDef[] = [
  { id: 'gmg-1', kind: 'ghana-must-go', label: 'Ghana Must Go: tops', items: clothes(['starter-tee-white', 'starter-tee-black', 'starter-tank-pink', 'starter-crop-lilac', 'starter-shirt-blue', 'starter-graphic-tee']), spot: [2.2, 1.9], color: '#C0392B' },
  { id: 'gmg-2', kind: 'ghana-must-go', label: 'Ghana Must Go: bottoms', items: clothes(['starter-jeans', 'starter-trousers-black', 'starter-trousers-camel', 'starter-mini-skirt-pink', 'starter-midi-skirt-cream', 'starter-shorts-denim', 'starter-cargo']), spot: [1.4, 2.3], color: '#2B4BAA' },
  { id: 'suitcase-1', kind: 'suitcase', label: 'Suitcase: shoes & shades', items: clothes(['starter-sneakers-white', 'starter-sneakers-black', 'starter-chunky-sneakers', 'starter-sandals', 'starter-boots', 'starter-glasses', 'starter-sunglasses']), spot: [0.4, 2.4], color: '#FF2E88' },
  {
    id: 'suitcase-2',
    kind: 'suitcase',
    label: 'Suitcase: owambe & traditional drip',
    items: clothes([
      'starter-hoodie-grey',
      'starter-midi-dress-mint',
      'starter-studs',
      ...STARTER_ITEMS.filter((i) => i.tags.includes('traditional')).map((i) => i.id),
    ]),
    spot: [-0.5, 2.4],
    color: '#C7CAD1',
  },
  { id: 'box-1', kind: 'box', label: 'Box: floor lamp', items: ['starter-lamp'], spot: [-1.5, 2.2], color: '#C49A6C' },
  { id: 'box-2', kind: 'box', label: 'Box: plant & mirror', items: ['starter-plant', 'starter-mirror'], spot: [-2.3, 1.6], color: '#C49A6C' },
  { id: 'box-3', kind: 'box', label: 'Box: clothes rail', items: ['starter-rack'], spot: [-2.3, 0.7], color: '#B5895C' },
]

export const LUGGAGE_BY_ID = new Map(LUGGAGE.map((l) => [l.id, l]))
export const UNPACK_REWARD = 15

/** Everything that arrives on the truck (used to keep bootstrap and luggage in sync). */
export const MOVE_IN_ITEMS = new Set(LUGGAGE.flatMap((l) => l.items))
export const STARTER_FURNITURE_IDS = new Set(STARTER_FURNITURE.map((f) => f.id))
