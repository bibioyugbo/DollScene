import { runQuery, type Query } from '../../shared/query'
import type { ServerDB, ServerTx } from '../../shared/server/db'
import { applyOps, localStore } from './localDb'
import type { WriteOp } from '../types'

/**
 * Runs the authoritative game handlers in the browser for offline/demo mode.
 * Same code as Cloud Functions; only the storage adapter differs.
 */
export function createLocalServerDb(): ServerDB {
  const s = localStore()
  const commit = (ops: WriteOp[]) => s.commit(applyOps((p) => s.get(p), ops))

  return {
    async transaction<R>(fn: (tx: ServerTx) => Promise<R>): Promise<R> {
      const ops: WriteOp[] = []
      // Reads see this transaction's own earlier writes, like Firestore's would after commit.
      const read = (path: string) => {
        if (!ops.length) return s.get(path)
        const pending = applyOps((p) => s.get(p), ops)
        return pending.has(path) ? structuredClone(pending.get(path)!) : s.get(path)
      }
      const tx: ServerTx = {
        async get<T>(path: string) {
          return read(path) as T | null
        },
        set: (path, data) => void ops.push({ type: 'set', path, data }),
        update: (path, data) => void ops.push({ type: 'update', path, data }),
        merge: (path, data) => void ops.push({ type: 'merge', path, data }),
        delete: (path) => void ops.push({ type: 'delete', path }),
      }
      const result = await fn(tx)
      if (ops.length) commit(ops)
      return structuredClone(result)
    },
    async get<T>(path: string) {
      return s.get(path) as T | null
    },
    async query<T>(collection: string, q: Query = {}) {
      return structuredClone(runQuery(s.list(collection), q)) as T[]
    },
    async set(path, data) {
      commit([{ type: 'set', path, data }])
    },
    async merge(path, data) {
      commit([{ type: 'merge', path, data }])
    },
    async delete(path) {
      commit([{ type: 'delete', path }])
    },
  }
}
