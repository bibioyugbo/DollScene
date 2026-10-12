import { useEffect, useState } from 'react'
import type { WebGLRenderer } from 'three'
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js'
import type { GLTFLoader } from 'three-stdlib'

/**
 * Which real 3D assets exist. Generated from public/models by the Vite plugin
 * (dev and build), so dropping a GLB into the folder is all it takes.
 */
export interface ModelManifest {
  starters: Record<string, string>
  hair: Record<string, string>
  garments: Record<string, string>
  items: Record<string, string>
  furniture: Record<string, string>
  jewellery: Record<string, string>
}

const EMPTY: ModelManifest = { starters: {}, hair: {}, garments: {}, items: {}, furniture: {}, jewellery: {} }

let manifest: ModelManifest | null = null
let loading: Promise<ModelManifest> | null = null
const listeners = new Set<(m: ModelManifest) => void>()

export function loadManifest(): Promise<ModelManifest> {
  if (manifest) return Promise.resolve(manifest)
  loading ??= fetch('/models/manifest.json', { cache: 'no-cache' })
    .then((r) => (r.ok ? r.json() : EMPTY))
    .catch(() => EMPTY)
    .then((m: Partial<ModelManifest>) => {
      manifest = { ...EMPTY, ...m }
      listeners.forEach((cb) => cb(manifest!))
      return manifest
    })
  return loading
}

export function useModelManifest(): ModelManifest | null {
  const [m, setM] = useState(manifest)
  useEffect(() => {
    if (manifest) return
    listeners.add(setM)
    void loadManifest()
    return () => {
      listeners.delete(setM)
    }
  }, [])
  return m
}

/** Asset url for a catalog item: a per-item model wins over a per-template one. */
export function garmentUrl(m: ModelManifest, itemId: string, template: string): string | undefined {
  return m.items[itemId] ?? m.garments[template]
}

/** Self-hosted decoders (copied into public/) so models load without a CDN. */
export const DRACO_PATH = '/draco/'

let ktx2: KTX2Loader | null = null

/** Adds KTX2 (Basis) texture support to drei's GLTF loader. */
export function extendLoader(gl: WebGLRenderer) {
  return (loader: GLTFLoader) => {
    if (!ktx2) ktx2 = new KTX2Loader().setTranscoderPath('/basis/').detectSupport(gl)
    ;(loader as unknown as { setKTX2Loader: (l: KTX2Loader) => void }).setKTX2Loader(ktx2)
  }
}
