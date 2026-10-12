import { useEffect, useState } from 'react'
import type { HairId, OutfitId, ShoeId } from '../../shared/studio/look'

/**
 * public/models/studio/character.json, written by scripts/character/build_character.py.
 * Adding a hairstyle or garment means adding its GLB (and a line here via the build);
 * the editors list whatever the catalog holds.
 */
export interface CharacterCatalog {
  version: 1
  license: string
  heightM: number
  morphs: { id: string; neg: boolean; pos: boolean; group: 'face' | 'body' }[]
  /** UV window of the face masks, Blender convention (u0, v0, u1, v1), v up. */
  faceRect: [number, number, number, number]
  eyes: string[]
  brows: string[]
  lashes: string[]
  hair: { id: Exclude<HairId, 'none'>; name: string }[]
  outfits: { id: OutfitId; name: string; hideMask: boolean }[]
  shoes: { id: ShoeId; name: string; hideMask: boolean }[]
}

export const STUDIO_BASE = '/models/studio'
export const url = {
  body: `${STUDIO_BASE}/body.glb`,
  hair: (id: string) => `${STUDIO_BASE}/hair/${id}.glb`,
  outfit: (id: string) => `${STUDIO_BASE}/outfits/${id}.glb`,
  shoes: (id: string) => `${STUDIO_BASE}/shoes/${id}.glb`,
  mask: (name: string) => `${STUDIO_BASE}/masks/${name}.png`,
  eye: (id: string) => `${STUDIO_BASE}/eyes/${id}.png`,
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
