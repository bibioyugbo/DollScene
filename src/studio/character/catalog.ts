import { useEffect, useState } from 'react'
import type { ExpressionId, HairId, OutfitId, PieceSlot, ShoeId, SpotId, TattooSpot } from '../../shared/studio/look'

/**
 * public/models/studio/character.json, written by scripts/character/build_character.py.
 * Adding a hairstyle or garment means adding its GLB (and a line here via the build);
 * the editors list whatever the catalog holds.
 */
type V3 = [number, number, number]

export interface Landmark {
  /** Model-space position (glTF, metres) at rest. */
  p: V3
  /** Rest normal. */
  n: V3
  /** Body UV (glTF convention). */
  uv: [number, number]
}

export interface CareData {
  landmarks: Record<string, Landmark>
  /** Wipe/rub paths per region: model-space points across the skin. */
  strokes: Record<string, V3[]>
  spots: (Landmark & { id: SpotId; r: number })[]
  nails: { bone: string; p: V3; n: V3; dir: V3; width: number; length: number }[]
  jewellery: Record<string, { p: V3; r: number; dir?: V3; bone?: string }>
  /** Tattoo anchors: body UV, UV units per metre of skin there, the UV direction of "up". */
  tattoos?: Partial<Record<TattooSpot, { uv: [number, number]; s: number; up: [number, number]; right?: [number, number]; p: V3; n: V3 }>>
}

/** A wardrobe piece (scripts/character/outfit/build_pieces.py, shoes.py). */
export interface PieceEntry {
  id: string
  name: string
  slot: PieceSlot
  store: string
  /** Default colours: primary, secondary, accent. */
  colors: [string, string, string]
  finish: string
  ease: number
  hideMask: boolean
  /** Shoes: the foot arch (radians) and how far they lift her (m). */
  arch?: number
  lift?: number
}

export interface CharacterCatalog {
  version: 1
  license: string
  heightM: number
  morphs: { id: string; neg: boolean; pos: boolean; group: 'face' | 'body' }[]
  /** UV window of the face masks, Blender convention (u0, v0, u1, v1), v up. */
  faceRect: [number, number, number, number]
  masks?: Record<string, string[]>
  eyes: string[]
  brows: string[]
  lashes: string[]
  /** Built hairstyles (plus accessories such as the 'bonnet'). */
  hair: { id: Exclude<HairId, 'none'> | 'bonnet'; name: string }[]
  /** store: which Hub store sells it; ease: how far a skirt stands off the hips at the hands (m). */
  outfits: { id: OutfitId; name: string; hideMask: boolean; store?: string | null; ease?: number }[]
  shoes: { id: ShoeId; name: string; hideMask: boolean }[]
  /** Wardrobe pieces (older builds have none). */
  pieces?: PieceEntry[]
  /** Expression shape keys on the body (older builds have none). */
  expressions?: ExpressionId[]
  /** Skincare/nail/jewellery anchors (older builds have none). */
  care?: CareData
}

export const STUDIO_BASE = '/models/studio'
export const url = {
  body: `${STUDIO_BASE}/body.glb`,
  silhouette: `${STUDIO_BASE}/silhouette.glb`,
  hair: (id: string) => `${STUDIO_BASE}/hair/${id}.glb`,
  outfit: (id: string) => `${STUDIO_BASE}/outfits/${id}.glb`,
  shoes: (id: string) => `${STUDIO_BASE}/shoes/${id}.glb`,
  piece: (id: string) => `${STUDIO_BASE}/pieces/${id}.glb`,
  pieceThumb: (id: string) => `/thumbs/pieces/${id}.webp`,
  mask: (name: string) => `${STUDIO_BASE}/masks/${name}.png`,
  eye: (id: string) => `${STUDIO_BASE}/eyes/${id}.png`,
  hairThumb: (id: string) => `/thumbs/hair/${id}.webp`,
  starterThumb: (id: string) => `/thumbs/starters/${id}.webp`,
  outfitThumb: (id: string) => `/thumbs/outfits/${id}.webp`,
  shoeThumb: (id: string) => `/thumbs/shoes/${id}.webp`,
}

/** Everything she can wear, as one list: pieces, plus the classic sets (dress) and classic shoes. */
export interface Wearable {
  id: string
  name: string
  slot: PieceSlot
  store: string | null
  colors: [string, string, string]
  /** Recolourable through three slots (pieces) or one tint (classics). */
  slots: 1 | 3
  src: string
  mask: string | null
  ease: number
  arch: number
  lift: number
}

const W3: [string, string, string] = ['#FFFFFF', '#FFFFFF', '#FFFFFF']
const wearCache = new WeakMap<CharacterCatalog, Map<string, Wearable>>()
export function wearables(c: CharacterCatalog): Map<string, Wearable> {
  let m = wearCache.get(c)
  if (m) return m
  m = new Map()
  for (const p of c.pieces ?? [])
    m.set(p.id, { id: p.id, name: p.name, slot: p.slot, store: p.store, colors: p.colors, slots: 3, src: url.piece(p.id), mask: p.hideMask ? url.mask(`hide_${p.id}`) : null, ease: p.ease ?? 0, arch: p.arch ?? 0, lift: p.lift ?? 0 })
  for (const o of c.outfits)
    m.set(o.id, { id: o.id, name: o.name, slot: 'dress', store: o.store ?? null, colors: W3, slots: 1, src: url.outfit(o.id), mask: o.hideMask ? url.mask(`hide_${o.id}`) : null, ease: o.ease ?? 0, arch: 0, lift: 0 })
  for (const s of c.shoes)
    m.set(s.id, { id: s.id, name: s.name, slot: 'shoes', store: null, colors: W3, slots: 1, src: url.shoes(s.id), mask: s.hideMask ? url.mask(`hide_${s.id}`) : null, ease: 0, arch: 0, lift: 0 })
  wearCache.set(c, m)
  return m
}

let cache: Promise<CharacterCatalog> | null = null

export function loadCatalog(): Promise<CharacterCatalog> {
  cache ??= fetch(`${STUDIO_BASE}/character.json`).then(async (r) => {
    if (!r.ok) throw new Error(`character.json ${r.status}`)
    const c = (await r.json()) as CharacterCatalog
    // dev only: automated checks read the catalog (window.__dsCatalog)
    if (import.meta.env?.DEV) (window as unknown as { __dsCatalog?: CharacterCatalog }).__dsCatalog = c
    return c
  })
  cache.catch(() => {
    cache = null
  })
  return cache
}

export function useCatalog(): { catalog: CharacterCatalog | null; error: Error | null; retry: () => void } {
  const [state, setState] = useState<{ catalog: CharacterCatalog | null; error: Error | null }>({ catalog: null, error: null })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let live = true
    loadCatalog().then(
      (catalog) => live && setState({ catalog, error: null }),
      (error: Error) => live && setState({ catalog: null, error }),
    )
    return () => {
      live = false
    }
  }, [attempt])
  return { ...state, retry: () => setAttempt((n) => n + 1) }
}
