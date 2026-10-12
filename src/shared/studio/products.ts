/**
 * Products sold through the Vatar pay sheet. The ids must match the products created in
 * the Vatar developer dashboard; names and prices there are the source of truth (the
 * game never shows or sends a price). Items are granted only by our server, after it has
 * checked the purchase with the Vatar API.
 */

export interface StudioProduct {
  id: string
  name: string
  blurb: string
  kind: 'one-off'
  /** What the server grants: an entitlement key stored on the player. */
  grants: string
}

export const PRODUCTS: StudioProduct[] = [
  { id: 'palette-gold-hour', name: 'Gold Hour palette', blurb: 'Twelve molten gold, bronze and champagne shades for lids, cheeks and lips.', kind: 'one-off', grants: 'palette-gold-hour' },
  { id: 'palette-lagos-nights', name: 'Lagos Nights palette', blurb: 'Twelve neon and jewel tones for after dark.', kind: 'one-off', grants: 'palette-lagos-nights' },
]

export const PRODUCT_BY_ID = new Map(PRODUCTS.map((p) => [p.id, p]))

/** Premium swatches, unlocked by the matching entitlement. */
export const PREMIUM_SWATCHES: Record<string, string[]> = {
  'palette-gold-hour': ['#B8862F', '#D4A445', '#E9C46A', '#F2D8A0', '#A0632A', '#7A4A1E', '#C9925A', '#E6B98A', '#F6E2C0', '#8C5A2B', '#D9A066', '#F0C27B'],
  'palette-lagos-nights': ['#FF2E88', '#C8FF3D', '#00C2FF', '#7B2CFF', '#FF6A00', '#14D3A0', '#E0115F', '#3A0CA3', '#FFD60A', '#00F5D4', '#9D4EDD', '#F72585'],
}
