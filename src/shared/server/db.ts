import type { Query } from '../query'

/**
 * The storage interface game handlers run against. Implemented by the local
 * backend (localStorage) and by Cloud Functions (firebase-admin).
 *
 * Transactions follow Firestore rules: do every read before the first write.
 */
export interface ServerTx {
  get<T>(path: string): Promise<T | null>
  set(path: string, data: object): void
  /** Partial update; keys may be dotted paths and values may be FieldOps. Fails if the doc is missing. */
  update(path: string, patch: object): void
  /** Create or deep-merge. Values may be FieldOps. */
  merge(path: string, data: object): void
  delete(path: string): void
}

export interface ServerDB {
  transaction<R>(fn: (tx: ServerTx) => Promise<R>): Promise<R>
  get<T>(path: string): Promise<T | null>
  query<T>(collection: string, q?: Query): Promise<T[]>
  set(path: string, data: object): Promise<void>
  merge(path: string, data: object): Promise<void>
  delete(path: string): Promise<void>
}

export interface HandlerContext {
  db: ServerDB
  uid: string
  now: number
  newId: () => string
}

export class GameError extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
    this.name = 'GameError'
  }
}
