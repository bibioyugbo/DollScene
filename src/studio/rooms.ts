import type { Category } from './state/store'

/**
 * The Hub's doors and the rooms behind them. A door opens a room (or a choice of two: the Glam
 * Studio leads to the Makeup Studio and the Hair Studio); each room has its own categories on the
 * left rail, and each category a grid of medium icons (ui/rooms).
 *
 * Store names are where the in-game pieces are sold; every design is original game art.
 */

export type RoomId = 'makeup' | 'hair' | 'skincare' | 'doctor' | 'kai' | 'moncherrie' | 'dopebyfabby' | 'deeji' | 'bolaptsd'
export type StoreId = 'kai' | 'moncherrie' | 'dopebyfabby' | 'deeji' | 'bolaptsd'
export type DoorId = 'glam' | StoreId | 'skincare' | 'doctor' | 'scenes'

export interface DoorDef {
  id: DoorId
  /** On the sign over the door. */
  name: string
  /** Under the name. */
  sub: string
  rooms: RoomId[]
  /** Door, frame and glow colours. */
  door: string
  frame: string
  glow: string
  /** Sign glyph drawn on the door (see stage/Hub.tsx). */
  glyph: 'mirror' | 'hanger' | 'butterfly' | 'heart' | 'sparkle' | 'gele' | 'bolt' | 'drop' | 'drip' | 'camera'
}

export const DOORS: DoorDef[] = [
  { id: 'glam', name: 'Glam Studio', sub: 'Makeup · Hair', rooms: ['makeup', 'hair'], door: '#2A1720', frame: '#E8B48A', glow: '#FF9BC8', glyph: 'mirror' },
  { id: 'kai', name: 'Kai Collective', sub: 'Butterfly tanks & prints', rooms: ['kai'], door: '#1B2340', frame: '#F2C14E', glow: '#FFD23F', glyph: 'butterfly' },
  { id: 'moncherrie', name: 'Mon Cherrie', sub: 'Corsets & satin', rooms: ['moncherrie'], door: '#3A1A26', frame: '#F2B8C6', glow: '#FF8FB1', glyph: 'heart' },
  { id: 'dopebyfabby', name: 'Dope by Fabby', sub: 'Sequins & sets', rooms: ['dopebyfabby'], door: '#0E2A22', frame: '#D9B35B', glow: '#5CFFB8', glyph: 'sparkle' },
  { id: 'deeji', name: 'Deeji', sub: 'Nigerian traditional', rooms: ['deeji'], door: '#1E2A5C', frame: '#D9A441', glow: '#7EA8FF', glyph: 'gele' },
  { id: 'bolaptsd', name: 'Bolaptsd', sub: 'Distressed rock street', rooms: ['bolaptsd'], door: '#171717', frame: '#B22222', glow: '#FF3B3B', glyph: 'bolt' },
  { id: 'skincare', name: 'Skincare Bay', sub: 'Cleanse · Treat · Glow', rooms: ['skincare'], door: '#123238', frame: '#9FD8C4', glow: '#7FF2E0', glyph: 'drop' },
  { id: 'doctor', name: 'Beauty Doctor', sub: 'Treatments & procedures', rooms: ['doctor'], door: '#2B1E3A', frame: '#C9A7D8', glow: '#C79BFF', glyph: 'drip' },
  { id: 'scenes', name: 'Make a Scene', sub: 'Go out · pose · chat', rooms: [], door: '#3A2412', frame: '#FFB86B', glow: '#FFC870', glyph: 'camera' },
]
export const DOOR_BY_ID = Object.fromEntries(DOORS.map((d) => [d.id, d])) as Record<DoorId, DoorDef>

export const STORES: StoreId[] = ['kai', 'moncherrie', 'dopebyfabby', 'deeji', 'bolaptsd']
export const isStore = (r: RoomId): r is StoreId => (STORES as RoomId[]).includes(r)

export interface RoomDef {
  id: RoomId
  name: string
  door: DoorId
  categories: Category[]
}

export const ROOMS: Record<RoomId, RoomDef> = {
  makeup: { id: 'makeup', name: 'Makeup Studio', door: 'glam', categories: ['base', 'sculpt', 'eyes', 'browsLashes', 'lips', 'looks', 'nails', 'jewellery'] },
  hair: { id: 'hair', name: 'Hair Studio', door: 'glam', categories: ['hairstyles', 'haircolour', 'haircare'] },
  skincare: { id: 'skincare', name: 'Skincare Bay', door: 'skincare', categories: ['cleanse', 'treat', 'tone', 'moisturise', 'wake'] },
  doctor: { id: 'doctor', name: 'Beauty Doctor', door: 'doctor', categories: ['clinicFace', 'clinicBody'] },
  kai: { id: 'kai', name: 'Kai Collective', door: 'kai', categories: ['outfits', 'shoes'] },
  moncherrie: { id: 'moncherrie', name: 'Mon Cherrie', door: 'moncherrie', categories: ['outfits', 'shoes'] },
  dopebyfabby: { id: 'dopebyfabby', name: 'Dope by Fabby', door: 'dopebyfabby', categories: ['outfits', 'shoes'] },
  deeji: { id: 'deeji', name: 'Deeji', door: 'deeji', categories: ['outfits', 'shoes'] },
  bolaptsd: { id: 'bolaptsd', name: 'Bolaptsd', door: 'bolaptsd', categories: ['outfits', 'shoes'] },
}

/** The presence channel for a room (the door's, so Makeup and Hair count as the Glam Studio). */
export const channelOf = (room: RoomId | null, phase: string, sceneId: string) => (phase === 'event' || phase === 'scenes' ? `scene:${sceneId}` : room ? `door:${ROOMS[room].door}` : 'hub')
