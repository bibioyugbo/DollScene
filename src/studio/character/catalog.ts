import { useEffect, useState } from 'react'
import type { ExpressionId, HairId, OutfitId, ShoeId, SpotId } from '../../shared/studio/look'

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
  mask: (name: string) => `${STUDIO_BASE}/masks/${name}.png`,
  eye: (id: string) => `${STUDIO_BASE}/eyes/${id}.png`,
  hairThumb: (id: string) => `/thumbs/hair/${id}.webp`,
  starterThumb: (id: string) => `/thumbs/starters/${id}.webp`,
  outfitThumb: (id: string) => `/thumbs/outfits/${id}.webp`,
  shoeThumb: (id: string) => `/thumbs/shoes/${id}.webp`,
}

let cache: Promise<CharacterCatalog> | null = null

export function loadCatalog(): Promise<CharacterCatalog> {
  cache ??= fetch(`${STUDIO_BASE}/character.json`).then((r) => {
    if (!r.ok) throw new Error(`character.json ${r.status}`)
    return r.json() as Promise<CharacterCatalog>
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
