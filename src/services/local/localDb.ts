import { applyMerge, applyUpdate, resolveOps } from '../../shared/fieldOps'
import { runQuery, type Query } from '../../shared/query'
import { BackendError, type ClientDB, type Unsubscribe, type WriteOp } from '../types'

/**
 * A tiny Firestore look-alike on top of localStorage.
 * Each document lives under its own key so two tabs never clobber each other,
 * and the browser's `storage` event gives cross-tab realtime for free.
 */
const PREFIX = 'dc:'

type Doc = Record<string, unknown>

function parentOf(path: string): string {
  return path.slice(0, path.lastIndexOf('/'))
}

export function randomId(len = 20): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const bytes = crypto.getRandomValues(new Uint8Array(len))
  let out = ''
  for (const b of bytes) out += chars[b % chars.length]
  return out
}

class LocalStore {
  private docs = new Map<string, Doc>()
  private byCollection = new Map<string, Map<string, Doc>>()
  private docListeners = new Map<string, Set<(d: Doc | null) => void>>()
  private queryListeners = new Map<string, Set<() => void>>()
  private pending = new Set<string>()
  private flushScheduled = false

  constructor() {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key?.startsWith(PREFIX)) continue
      try {
        this.put(key.slice(PREFIX.length), JSON.parse(localStorage.getItem(key)!))
      } catch {
        /* skip corrupt entries */
      }
    }
    window.addEventListener('storage', (e) => {
      if (!e.key?.startsWith(PREFIX)) return
      const path = e.key.slice(PREFIX.length)
      try {
        this.put(path, e.newValue ? JSON.parse(e.newValue) : null)
      } catch {
        return
      }
      this.changed(path)
    })
  }

  private put(path: string, doc: Doc | null) {
    const col = parentOf(path)
    if (doc) {
      this.docs.set(path, doc)
      let m = this.byCollection.get(col)
      if (!m) this.byCollection.set(col, (m = new Map()))
      m.set(path, doc)
    } else {
      this.docs.delete(path)
      this.byCollection.get(col)?.delete(path)
    }
  }

  get(path: string): Doc | null {
    const d = this.docs.get(path)
    return d ? structuredClone(d) : null
  }

  list(collection: string): Doc[] {
    return [...(this.byCollection.get(collection)?.values() ?? [])]
  }

  commit(changes: Map<string, Doc | null>) {
    for (const [path, doc] of changes) {
      try {
        if (doc) localStorage.setItem(PREFIX + path, JSON.stringify(doc))
        else localStorage.removeItem(PREFIX + path)
      } catch {
        throw new BackendError('resource-exhausted', 'This device is out of storage for the offline game. Clear some chats or connect Firebase.')
      }
      this.put(path, doc)
    }
    for (const path of changes.keys()) this.changed(path)
  }

  /** Batch notifications into one microtask so a write burst renders once. */
  private changed(path: string) {
    this.pending.add(path)
    if (this.flushScheduled) return
    this.flushScheduled = true
    queueMicrotask(() => {
      this.flushScheduled = false
      const paths = [...this.pending]
      this.pending.clear()
      const cols = new Set<string>()
      for (const p of paths) {
        const d = this.docs.get(p) ?? null
        for (const cb of this.docListeners.get(p) ?? []) cb(d ? structuredClone(d) : null)
        cols.add(parentOf(p))
      }
      for (const c of cols) for (const cb of this.queryListeners.get(c) ?? []) cb()
    })
  }

  onDoc(path: string, cb: (d: Doc | null) => void): Unsubscribe {
    let set = this.docListeners.get(path)
    if (!set) this.docListeners.set(path, (set = new Set()))
    set.add(cb)
    return () => set.delete(cb)
  }

  onCollection(col: string, cb: () => void): Unsubscribe {
    let set = this.queryListeners.get(col)
    if (!set) this.queryListeners.set(col, (set = new Set()))
    set.add(cb)
    return () => set.delete(cb)
  }
}

let store: LocalStore | null = null
export function localStore(): LocalStore {
  return (store ??= new LocalStore())
}

/** Apply write ops to a working set without committing. */
export function applyOps(read: (path: string) => Doc | null, ops: WriteOp[]): Map<string, Doc | null> {
  const changes = new Map<string, Doc | null>()
  const current = (p: string) => (changes.has(p) ? changes.get(p)! : read(p))
  for (const op of ops) {
    switch (op.type) {
      case 'set':
        changes.set(op.path, resolveOps(op.data as Doc))
        break
      case 'merge':
        changes.set(op.path, applyMerge(current(op.path), op.data as Doc))
        break
      case 'update': {
        const doc = current(op.path)
        if (!doc) throw new BackendError('not-found', `No document to update at ${op.path}`)
        changes.set(op.path, applyUpdate(doc, op.data as Doc))
        break
      }
      case 'delete':
        changes.set(op.path, null)
        break
    }
  }
  return changes
}

export function createLocalDb(): ClientDB {
  const s = localStore()
  return {
    async get<T>(path: string) {
      return s.get(path) as T | null
    },
    watch<T>(path: string, cb: (d: T | null) => void) {
      queueMicrotask(() => cb(s.get(path) as T | null))
      return s.onDoc(path, (d) => cb(d as T | null))
    },
    async query<T>(collection: string, q: Query = {}) {
      return structuredClone(runQuery(s.list(collection), q)) as T[]
    },
    watchQuery<T>(collection: string, q: Query, cb: (docs: T[]) => void) {
      let last = ''
      const run = () => {
        const docs = runQuery(s.list(collection), q)
        const json = JSON.stringify(docs)
        if (json === last) return
        last = json
        cb(JSON.parse(json) as T[])
      }
      queueMicrotask(run)
      return s.onCollection(collection, run)
    },
    async write(ops: WriteOp[]) {
      s.commit(applyOps((p) => s.get(p), ops))
    },
    newId: () => randomId(),
  }
}
