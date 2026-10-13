import { useSyncExternalStore } from 'react'

/**
 * Make a Scene photos: the full image is offered as a download right away; a small JPEG copy goes
 * into a per-device gallery (localStorage, guarded: storage can be blocked inside the game frame).
 */

export interface Photo {
  id: string
  scene: string
  takenAt: number
  /** Small JPEG data URL for the gallery. */
  thumb: string
}

const KEY = 'dollscene-photos'
const MAX = 12
let photos: Photo[] = read()
const listeners = new Set<() => void>()

function read(): Photo[] {
  try {
    const raw = localStorage.getItem(KEY)
    const x = raw ? (JSON.parse(raw) as Photo[]) : []
    return Array.isArray(x) ? x.filter((p) => typeof p?.thumb === 'string' && p.thumb.startsWith('data:image/')).slice(0, MAX) : []
  } catch {
    return []
  }
}

function write() {
  try {
    localStorage.setItem(KEY, JSON.stringify(photos))
    return true
  } catch {
    return false
  }
}

async function thumbOf(blob: Blob, w = 480): Promise<string> {
  const bmp = await createImageBitmap(blob)
  const scale = Math.min(1, w / bmp.width)
  const c = document.createElement('canvas')
  c.width = Math.round(bmp.width * scale)
  c.height = Math.round(bmp.height * scale)
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height)
  bmp.close()
  return c.toDataURL('image/jpeg', 0.82)
}

/** Adds a photo; resolves false if the device gallery couldn't store it (the download still works). */
export async function addPhoto(blob: Blob, scene: string): Promise<{ photo: Photo; stored: boolean }> {
  const photo: Photo = { id: `p${Date.now().toString(36)}`, scene, takenAt: Date.now(), thumb: await thumbOf(blob) }
  photos = [photo, ...photos].slice(0, MAX)
  const stored = write()
  listeners.forEach((l) => l())
  return { photo, stored }
}

export function deletePhoto(id: string) {
  photos = photos.filter((p) => p.id !== id)
  write()
  listeners.forEach((l) => l())
}

export function usePhotos() {
  return useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => photos,
  )
}

export function download(blob: Blob, name: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 4000)
}
