import type { StorageService } from '../types'

/** IndexedDB blob store for voice notes and large images in offline mode. */
const DB_NAME = 'dollcare-blobs'
const STORE = 'blobs'
const SCHEME = 'idb://'

let dbPromise: Promise<IDBDatabase> | null = null
function open(): Promise<IDBDatabase> {
  return (dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  }))
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open()
  return new Promise((resolve, reject) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE))
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

const objectUrls = new Map<string, string>()

function dataUrlToBlob(dataUrl: string): Blob {
  const [head, body] = dataUrl.split(',')
  const mime = /data:([^;]+)/.exec(head)?.[1] ?? 'application/octet-stream'
  const bin = atob(body)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

export function createLocalStorage(): StorageService {
  return {
    async upload(path, blob, onProgress) {
      onProgress?.(0.1)
      await run('readwrite', (s) => s.put(blob, path))
      onProgress?.(1)
      return SCHEME + path
    },
    async uploadDataUrl(path, dataUrl) {
      // Portraits are small: keep them inline so cards render without a lookup.
      if (dataUrl.length < 60_000) return dataUrl
      await run('readwrite', (s) => s.put(dataUrlToBlob(dataUrl), path))
      return SCHEME + path
    },
    async resolve(url) {
      if (!url.startsWith(SCHEME)) return url
      const cached = objectUrls.get(url)
      if (cached) return cached
      const blob = await run<Blob | undefined>('readonly', (s) => s.get(url.slice(SCHEME.length)) as IDBRequest<Blob | undefined>)
      if (!blob) throw new Error('File not found')
      const obj = URL.createObjectURL(blob)
      objectUrls.set(url, obj)
      return obj
    },
    async remove(path) {
      await run('readwrite', (s) => s.delete(path))
    },
  }
}
