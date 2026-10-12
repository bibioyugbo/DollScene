import type { Query } from '../shared/query'
import type { HandlerInput, HandlerName, HandlerResult } from '../shared/server/handlers'

export type Unsubscribe = () => void

export interface AuthUser {
  uid: string
  email: string | null
  displayName: string | null
  provider: 'google' | 'password'
}

export interface AuthService {
  current(): AuthUser | null
  /** Fires once with the restored session, then on every change. */
  onChange(cb: (user: AuthUser | null) => void): Unsubscribe
  signInWithGoogle(): Promise<AuthUser>
  signInWithEmail(email: string, password: string): Promise<AuthUser>
  signUpWithEmail(email: string, password: string): Promise<AuthUser>
  sendPasswordReset(email: string): Promise<void>
  signOut(): Promise<void>
}

export type WriteOp =
  | { type: 'set'; path: string; data: object }
  | { type: 'update'; path: string; data: object }
  | { type: 'merge'; path: string; data: object }
  | { type: 'delete'; path: string }

/** Client data access. Security Rules decide what each call may touch. */
export interface ClientDB {
  get<T>(path: string): Promise<T | null>
  watch<T>(path: string, cb: (doc: T | null) => void, onError?: (e: Error) => void): Unsubscribe
  query<T>(collection: string, q?: Query): Promise<T[]>
  watchQuery<T>(collection: string, q: Query, cb: (docs: T[]) => void, onError?: (e: Error) => void): Unsubscribe
  /** Atomic batch. */
  write(ops: WriteOp[]): Promise<void>
  newId(): string
}

export interface StorageService {
  upload(path: string, blob: Blob, onProgress?: (fraction: number) => void): Promise<string>
  /** Store a data: URL image. Small images may be kept inline. */
  uploadDataUrl(path: string, dataUrl: string): Promise<string>
  /** Turn a stored URL into something an <img>/<audio> can play. */
  resolve(url: string): Promise<string>
  remove(path: string): Promise<void>
}

export interface PushService {
  supported(): boolean
  enable(uid: string): Promise<boolean>
}

export interface Backend {
  mode: 'firebase' | 'local'
  auth: AuthService
  db: ClientDB
  storage: StorageService
  push: PushService
  call<K extends HandlerName>(name: K, input: HandlerInput<K>): Promise<HandlerResult<K>>
}

export class BackendError extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
    this.name = 'BackendError'
  }
}
