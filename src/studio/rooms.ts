import type { Category } from './state/store'

/**
 * The Hub's doors and the rooms behind them. A door opens a room (or a choice of two: the Glam
 * Studio leads to the Makeup Studio and the Hair Studio); each room has its own categories on the
 * left rail, and each category a grid of medium icons (ui/rooms).
 *
 * Store names are where the in-game pieces are sold (exact spellings); every design is original game art.
 */

export type StoreId = 'tolaptsd' | 'thai' | 'moncherie' | 'novasport' | 'dopebyfabby' | 'dejideji' | 'okrika' | 'booty'
export type RoomId = 'makeup' | 'hair' | 'skincare' | 'doctor' | StoreId
export type DoorId = 'glam' | StoreId | 'skincare' | 'doctor' | 'scenes'

/** How a building looks from the street (stage/Hub.tsx builds each one from these). */
export type Facade = 'brick' | 'glass' | 'boutique' | 'gym' | 'gold' | 'heritage' | 'thrift' | 'velvet' | 'spa' | 'clinic' | 'cinema' | 'salon'

export interface DoorDef {
  id: DoorId
  /** On the sign (exact spelling). */
  name: string
  /** Under the name. */
  sub: string
  rooms: RoomId[]
  /** Facade palette: wall, trim, sign/neon glow. */
  door: string
  frame: string
  glow: string
  facade: Facade
  /** Storeys (1..3) and width (m) of the building. */
  floors: number
  width: number
}

export const DOORS: DoorDef[] = [
  { id: 'tolaptsd', name: 'Tolaptsd', sub: 'Distressed rock street', rooms: ['tolaptsd'], door: '#2B2B2E', frame: '#B22222', glow: '#FF3B3B', facade: 'brick', floors: 2, width: 3.4 },
  { id: 'thai', name: 'Thai Collective', sub: 'Butterfly tanks & prints', rooms: ['thai'], door: '#F4EFE6', frame: '#F2C14E', glow: '#FFD23F', facade: 'boutique', floors: 2, width: 3.2 },
  { id: 'moncherie', name: 'Mon Cherie', sub: 'Corsets, satin & heels', rooms: ['moncherie'], door: '#F2D4DC', frame: '#B0124A', glow: '#FF8FB1', facade: 'velvet', floors: 2, width: 3.2 },
  { id: 'novasport', name: 'Nova Sport', sub: 'Sportswear & trainers', rooms: ['novasport'], door: '#1C2433', frame: '#2DE1C2', glow: '#5CF2FF', facade: 'gym', floors: 2, width: 3.6 },
  { id: 'glam', name: 'Glam Studio', sub: 'Makeup · Hair', rooms: ['makeup', 'hair'], door: '#2A1720', frame: '#E8B48A', glow: '#FF9BC8', facade: 'salon', floors: 2, width: 3.4 },
  { id: 'dopebyfabby', name: 'Dope by Fabby', sub: 'Sequins & sets', rooms: ['dopebyfabby'], door: '#0E1A16', frame: '#D9B35B', glow: '#FFE08A', facade: 'gold', floors: 3, width: 3.4 },
  { id: 'dejideji', name: 'Deji Deji', sub: 'Traditional attire', rooms: ['dejideji'], door: '#6B2E1A', frame: '#D9A441', glow: '#FFB45C', facade: 'heritage', floors: 2, width: 3.6 },
  { id: 'skincare', name: 'Skin Bay', sub: 'Cleanse · Treat · Glow', rooms: ['skincare'], door: '#E6F2EE', frame: '#4FA68E', glow: '#7FF2E0', facade: 'spa', floors: 1, width: 3.2 },
  { id: 'doctor', name: 'Beauty Doctor', sub: 'Tattoos · Piercings · Jewellery', rooms: ['doctor'], door: '#F4F6FA', frame: '#7A5AC8', glow: '#C79BFF', facade: 'clinic', floors: 2, width: 3.4 },
  { id: 'okrika', name: 'Okrika Closet', sub: 'Thrift & vintage finds', rooms: ['okrika'], door: '#6B4A2E', frame: '#C9A06A', glow: '#FFD08A', facade: 'thrift', floors: 2, width: 3.2 },
  { id: 'booty', name: 'BOOTY', sub: 'Lingerie boutique · 18+', rooms: ['booty'], door: '#1A0A12', frame: '#E0457B', glow: '#FF4FA3', facade: 'glass', floors: 2, width: 3.2 },
  { id: 'scenes', name: 'Make a Scene', sub: 'Go out · pose · chat', rooms: [], door: '#2A1A0E', frame: '#FFB86B', glow: '#FFC870', facade: 'cinema', floors: 3, width: 3.8 },
]
export const DOOR_BY_ID = Object.fromEntries(DOORS.map((d) => [d.id, d])) as Record<DoorId, DoorDef>

export const STORES: StoreId[] = ['tolaptsd', 'thai', 'moncherie', 'novasport', 'dopebyfabby', 'dejideji', 'okrika', 'booty']
export const isStore = (r: RoomId): r is StoreId => (STORES as RoomId[]).includes(r)

export interface RoomDef {
  id: RoomId
  name: string
  door: DoorId
  categories: Category[]
}

const shop = (id: StoreId, name: string, extra: Category[] = []): RoomDef => ({ id, name, door: id, categories: ['tops', 'bottoms', 'dresses', 'shoes', ...extra] })

export const ROOMS: Record<RoomId, RoomDef> = {
  makeup: { id: 'makeup', name: 'Makeup Studio', door: 'glam', categories: ['base', 'sculpt', 'eyes', 'browsLashes', 'lips', 'looks', 'nails'] },
  hair: { id: 'hair', name: 'Hair Studio', door: 'glam', categories: ['hairstyles', 'haircolour', 'haircare'] },
  // the morning first: bonnet off, pull the pimple patch, eye patches off; then wash (foamy) and on
  skincare: { id: 'skincare', name: 'Skin Bay', door: 'skincare', categories: ['wake', 'cleanse', 'treat', 'tone', 'moisturise'] },
  doctor: { id: 'doctor', name: 'Beauty Doctor', door: 'doctor', categories: ['tattoos', 'piercings', 'jewellery', 'clinicFace', 'clinicBody'] },
  tolaptsd: shop('tolaptsd', 'Tolaptsd', ['accessories']),
  thai: shop('thai', 'Thai Collective'),
  moncherie: shop('moncherie', 'Mon Cherie', ['accessories']),
  novasport: shop('novasport', 'Nova Sport'),
  dopebyfabby: shop('dopebyfabby', 'Dope by Fabby', ['accessories']),
  dejideji: shop('dejideji', 'Deji Deji', ['accessories']),
  okrika: shop('okrika', 'Okrika Closet', ['accessories']),
  booty: shop('booty', 'BOOTY', ['accessories']),
}

/** The presence channel for a room (the door's, so Makeup and Hair count as the Glam Studio). */
/** Where the player is, for presence: in a scene only once they've entered it (browsing scenes counts as the Make a Scene door). */
export const channelOf = (room: RoomId | null, phase: string, sceneId: string) => (phase === 'event' ? `scene:${sceneId}` : phase === 'scenes' ? 'door:scenes' : room ? `door:${ROOMS[room].door}` : 'hub')
