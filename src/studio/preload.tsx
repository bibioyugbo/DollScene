import { useGLTF, useTexture } from '@react-three/drei'
import { Suspense, useEffect, useRef } from 'react'
import { DefaultLoadingManager } from 'three'
import { create } from 'zustand'
import { CHARACTER_PRESETS } from '../shared/studio/presets'
import { url, wearables, type CharacterCatalog } from './character/catalog'
import { eyeTexture, loadedModules } from './character/StudioCharacter'
import { preloadScenes } from './scenes'

/**
 * Everything the game shows after the loading screen is fetched and parsed during it: the body,
 * every hairstyle, outfit and pair of shoes, their skin-hide masks, eye textures, every portrait and
 * product thumbnail, the scene code and the font. Progress is the real count of finished files
 * (three.js's loading manager for 3D assets, plus our own list for the rest), never a timer.
 */

interface PreloadState {
  /** 3D files finished / started (three's loading manager). */
  three: { loaded: number; total: number }
  /** Everything else (images, scene code, fonts). */
  other: { loaded: number; total: number }
  /** All modules parsed into the loader cache (swaps can't suspend after this). */
  modulesReady: boolean
  otherReady: boolean
  failed: string[]
}

export const usePreload = create<PreloadState>(() => ({ three: { loaded: 0, total: 0 }, other: { loaded: 0, total: 0 }, modulesReady: false, otherReady: false, failed: [] }))

DefaultLoadingManager.onStart = (_u, loaded, total) => usePreload.setState({ three: { loaded, total } })
DefaultLoadingManager.onProgress = (_u, loaded, total) => usePreload.setState({ three: { loaded, total } })
DefaultLoadingManager.onError = (u) => usePreload.setState((s) => ({ failed: [...s.failed, u] }))

/** 0..1: weighted towards the 3D assets, which are most of the bytes. */
export function preloadProgress(s: PreloadState) {
  const t = s.three.total ? s.three.loaded / s.three.total : 0
  const o = s.other.total ? s.other.loaded / s.other.total : 0
  const k = 0.82 * (s.modulesReady ? 1 : Math.min(0.97, t)) + 0.18 * (s.otherReady ? 1 : o)
  return Math.max(0, Math.min(1, k))
}

export function moduleUrls(catalog: CharacterCatalog) {
  return [...catalog.hair.map((h) => url.hair(h.id)), ...[...wearables(catalog).values()].map((w) => w.src)]
}

export function maskUrls(catalog: CharacterCatalog) {
  return [...wearables(catalog).values()].filter((w) => w.mask).map((w) => w.mask!)
}

/**
 * Lives inside the Canvas: loads every module and hide mask, each under exactly the cache key the
 * doll will later ask for (one useGLTF / useTexture per file: an array would be cached as one key
 * the doll never hits). When all have arrived they're marked swappable. A file that fails is
 * counted, never fatal: that piece falls back when worn.
 */
function OneModule({ src, onDone }: { src: string; onDone: (src: string) => void }) {
  useGLTF(src, false, true)
  useEffect(() => onDone(src), [src, onDone])
  return null
}

function OneTexture({ src, onDone }: { src: string; onDone: (src: string) => void }) {
  useTexture(src)
  useEffect(() => onDone(src), [src, onDone])
  return null
}

export function PreloadModules({ catalog }: { catalog: CharacterCatalog }) {
  const urls = moduleUrls(catalog)
  const masks = maskUrls(catalog)
  const done = useRef(new Set<string>())
  const total = urls.length + masks.length
  const onDone = useRef((src: string) => {
    done.current.add(src)
    if (done.current.size >= total && !usePreload.getState().modulesReady) {
      for (const u of urls) loadedModules.add(u)
      usePreload.setState({ modulesReady: true })
    }
  }).current
  return (
    <>
      {urls.map((u) => (
        <Suspense key={u} fallback={null}>
          <OneModule src={u} onDone={onDone} />
        </Suspense>
      ))}
      {masks.map((u) => (
        <Suspense key={u} fallback={null}>
          <OneTexture src={u} onDone={onDone} />
        </Suspense>
      ))}
    </>
  )
}

function image(src: string) {
  return new Promise<void>((res) => {
    const img = new Image()
    img.decoding = 'async'
    img.onload = img.onerror = () => res()
    img.src = src
  })
}

let started = false

/** Thumbnails, portraits, eye textures, scene code and fonts, counted as they finish. */
export function preloadOther(catalog: CharacterCatalog) {
  if (started) return
  started = true
  const jobs: (() => Promise<unknown>)[] = [
    ...CHARACTER_PRESETS.map((c) => () => image(url.starterThumb(c.id))),
    ...catalog.hair.filter((h) => h.id !== 'bonnet').map((h) => () => image(url.hairThumb(h.id))),
    ...catalog.outfits.map((o) => () => image(url.outfitThumb(o.id))),
    ...catalog.shoes.map((s) => () => image(url.shoeThumb(s.id))),
    ...(catalog.pieces ?? []).map((p) => () => image(url.pieceThumb(p.id))),
    ...catalog.eyes.map((e) => () => eyeTexture(e).catch(() => null)),
    () => preloadScenes().catch(() => null),
    () => (document.fonts ? Promise.all([document.fonts.load('900 40px "Red Hat Display"'), document.fonts.load('700 16px "Red Hat Display"')]).catch(() => null) : Promise.resolve()),
  ]
  usePreload.setState({ other: { loaded: 0, total: jobs.length } })
  let done = 0
  // a few at a time: the 3D files get most of the bandwidth
  const queue = [...jobs]
  const worker = async () => {
    for (let j = queue.shift(); j; j = queue.shift()) {
      await j()
      done++
      usePreload.setState({ other: { loaded: done, total: jobs.length } })
    }
  }
  void Promise.all([worker(), worker(), worker(), worker()]).then(() => usePreload.setState({ otherReady: true }))
}
