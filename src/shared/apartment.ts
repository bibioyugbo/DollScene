import { getItem, SLEEPING_MAT } from './catalog'
import { LUGGAGE } from './movein'
import { TIER_BY_ID } from './economy'
import type { ApartmentDoc, ApartmentTierId, PlacedItem } from './types'

export const WALL_HEIGHT = 2.8
export const GRID = 0.25

/** Some players move in with a pet: a cat, a dog, or none, decided by their id. */
export function starterPet(uid: string): string | null {
  let h = 0
  for (let i = 0; i < uid.length; i++) h = (h * 31 + uid.charCodeAt(i)) | 0
  const k = Math.abs(h) % 4
  return k === 0 ? 'starter-pet-cat' : k === 1 ? 'starter-pet-dog' : null
}

/** The furnished starter home: a bed mat, a little lounge corner, plants and maybe a pet. */
export function starterHomeItems(uid: string): PlacedItem[] {
  const pet = starterPet(uid)
  return [
    { id: 'mat', itemId: SLEEPING_MAT.id, x: 1.6, z: -1.2, rot: 0 },
    { id: 'home-rug', itemId: 'starter-rug', x: -1.0, z: -0.6, rot: 0 },
    { id: 'home-beanbag', itemId: 'starter-beanbag', x: -1.2, z: -0.9, rot: 0.4 },
    { id: 'home-side', itemId: 'starter-side-table', x: -2.4, z: -1.9, rot: 0 },
    { id: 'home-plant', itemId: 'starter-plant-small', x: 2.7, z: -2.6, rot: 0 },
    { id: 'home-gmg', itemId: 'starter-gmg', x: 2.5, z: -0.2, rot: -0.3 },
    ...(pet ? [{ id: 'home-pet', itemId: pet, x: 0.3, z: -0.4, rot: 0.6 }] : []),
  ]
}

export function defaultApartment(uid: string, now: number): ApartmentDoc {
  return {
    uid,
    tier: 'studio',
    wallColor: '#F4F0EA',
    wallpaper: 'none',
    floor: 'oak',
    lighting: 'golden',
    windowView: 'lagos',
    // Move-in day: a few pieces are already in, the truck brings the rest in Ghana Must Gos.
    items: starterHomeItems(uid),
    luggage: LUGGAGE.map((l) => l.id),
    movedIn: false,
    starterHome: true,
    updatedAt: now,
  }
}

export function tierSize(tier: ApartmentTierId): { w: number; d: number } {
  const t = TIER_BY_ID.get(tier) ?? TIER_BY_ID.get('studio')!
  return { w: t.w, d: t.d }
}

/** Axis-aligned footprint after rotation (rotation snapped to the nearest quarter for collisions). */
export function footprint(p: PlacedItem): { minX: number; maxX: number; minZ: number; maxZ: number } | null {
  const spec = getItem(p.itemId)?.furniture
  if (!spec) return null
  const quarter = Math.round(p.rot / (Math.PI / 2)) % 2 !== 0
  const w = quarter ? spec.d : spec.w
  const d = quarter ? spec.w : spec.d
  return { minX: p.x - w / 2, maxX: p.x + w / 2, minZ: p.z - d / 2, maxZ: p.z + d / 2 }
}

/** Floor pieces may not overlap other floor pieces. Rugs and wall pieces never collide. */
export function collides(items: PlacedItem[], candidate: PlacedItem): boolean {
  const spec = getItem(candidate.itemId)?.furniture
  if (!spec || spec.mount !== 'floor') return false
  const a = footprint(candidate)
  if (!a) return false
  const eps = 0.02
  return items.some((o) => {
    if (o.id === candidate.id) return false
    const os = getItem(o.itemId)?.furniture
    if (!os || os.mount !== 'floor') return false
    const b = footprint(o)!
    return a.minX < b.maxX - eps && a.maxX > b.minX + eps && a.minZ < b.maxZ - eps && a.maxZ > b.minZ + eps
  })
}

export function inBounds(p: PlacedItem, tier: ApartmentTierId): boolean {
  const { w, d } = tierSize(tier)
  const spec = getItem(p.itemId)?.furniture
  if (!spec) return false
  if (spec.mount === 'wall') {
    if (p.wall === 'back') return Math.abs(p.x) + spec.w / 2 <= w / 2 + 0.01
    if (p.wall === 'left') return Math.abs(p.z) + spec.w / 2 <= d / 2 + 0.01
    return false
  }
  const f = footprint(p)!
  return f.minX >= -w / 2 - 0.01 && f.maxX <= w / 2 + 0.01 && f.minZ >= -d / 2 - 0.01 && f.maxZ <= d / 2 + 0.01
}

/** Count how many of each item is placed. */
export function placedCounts(items: PlacedItem[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const p of items) counts[p.itemId] = (counts[p.itemId] ?? 0) + 1
  return counts
}

/**
 * A free floor spot for a new piece, scanning from the back wall forward so
 * unpacked furniture lines the walls first. Null when the room is full.
 */
export function findSpot(items: PlacedItem[], itemId: string, tier: ApartmentTierId, id: string): PlacedItem | null {
  const spec = getItem(itemId)?.furniture
  if (!spec || spec.mount === 'wall') return null
  const { w, d } = tierSize(tier)
  for (let z = -d / 2 + spec.d / 2 + 0.1; z <= d / 2 - spec.d / 2; z += GRID) {
    for (let x = -w / 2 + spec.w / 2 + 0.1; x <= w / 2 - spec.w / 2; x += GRID) {
      const p: PlacedItem = { id, itemId, x: Math.round(x / GRID) * GRID, z: Math.round(z / GRID) * GRID, rot: 0 }
      if (inBounds(p, tier) && !collides(items, p)) return p
    }
  }
  return null
}
