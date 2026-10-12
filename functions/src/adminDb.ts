import { FieldValue, getFirestore, type Firestore, type Query as FsQuery } from 'firebase-admin/firestore'
import { randomBytes } from 'node:crypto'
import { isFieldOp } from './shared/fieldOps'
import type { Query } from './shared/query'
import type { ServerDB, ServerTx } from './shared/server/db'

/** Map backend-neutral FieldOps to admin FieldValue sentinels, recursively. */
function toAdmin(data: unknown): unknown {
  if (isFieldOp(data)) {
    switch (data.__op) {
      case 'inc':
        return FieldValue.increment(data.n)
      case 'union':
        return FieldValue.arrayUnion(...data.values)
      case 'remove':
        return FieldValue.arrayRemove(...data.values)
      case 'delete':
        return FieldValue.delete()
    }
  }
  if (Array.isArray(data)) return data.map(toAdmin)
  if (data && typeof data === 'object') {
    return Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined).map(([k, v]) => [k, toAdmin(v)]))
  }
  return data
}

function buildQuery(fs: Firestore, collection: string, q: Query = {}): FsQuery {
  let ref: FsQuery = fs.collection(collection)
  for (const [f, op, v] of q.where ?? []) ref = ref.where(f, op, v)
  if (q.orderBy) ref = ref.orderBy(q.orderBy[0], q.orderBy[1])
  if (q.startAfter !== undefined) ref = ref.startAfter(q.startAfter)
  if (q.limit !== undefined) ref = ref.limit(q.limit)
  return ref
}

/** The ServerDB the shared game handlers run against in Cloud Functions. */
export function createAdminDb(): ServerDB {
  const fs = getFirestore()
  return {
    transaction<R>(fn: (tx: ServerTx) => Promise<R>): Promise<R> {
      return fs.runTransaction(async (t) => {
        const tx: ServerTx = {
          async get<T>(path: string) {
            const snap = await t.get(fs.doc(path))
            return snap.exists ? (snap.data() as T) : null
          },
          set: (path, data) => void t.set(fs.doc(path), toAdmin(data) as FirebaseFirestore.DocumentData),
          update: (path, data) => void t.update(fs.doc(path), toAdmin(data) as FirebaseFirestore.UpdateData<FirebaseFirestore.DocumentData>),
          merge: (path, data) => void t.set(fs.doc(path), toAdmin(data) as FirebaseFirestore.DocumentData, { merge: true }),
          delete: (path) => void t.delete(fs.doc(path)),
        }
        return fn(tx)
      })
    },
    async get<T>(path: string) {
      const snap = await fs.doc(path).get()
      return snap.exists ? (snap.data() as T) : null
    },
    async query<T>(collection: string, q?: Query) {
      const snap = await buildQuery(fs, collection, q).get()
      return snap.docs.map((d) => d.data() as T)
    },
    async set(path, data) {
      await fs.doc(path).set(toAdmin(data) as FirebaseFirestore.DocumentData)
    },
    async merge(path, data) {
      await fs.doc(path).set(toAdmin(data) as FirebaseFirestore.DocumentData, { merge: true })
    },
    async delete(path) {
      await fs.doc(path).delete()
    },
  }
}

export function newId(): string {
  return randomBytes(15).toString('base64url').replace(/[-_]/g, 'x').slice(0, 20)
}
