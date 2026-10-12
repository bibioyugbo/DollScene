import { USE_FIREBASE } from '../config/env'
import type { Backend } from './types'

let instance: Backend | null = null
let loading: Promise<Backend> | null = null

/**
 * Loads the configured backend once. Firebase is code-split so the offline
 * build never downloads it, and vice versa.
 */
export function loadBackend(): Promise<Backend> {
  if (instance) return Promise.resolve(instance)
  loading ??= (USE_FIREBASE
    ? import('./firebase').then((m) => m.createFirebaseBackend())
    : import('./local').then((m) => m.createLocalBackend())
  ).then((b) => (instance = b))
  return loading
}

/** The loaded backend. Only call after <BackendProvider> has resolved. */
export function backend(): Backend {
  if (!instance) throw new Error('Backend not loaded yet')
  return instance
}

export function friendlyError(e: unknown): string {
  if (e && typeof e === 'object' && 'message' in e && typeof (e as Error).message === 'string') {
    const msg = (e as Error).message
    const code = (e as { code?: string }).code ?? ''
    if (code.includes('popup-closed')) return 'Sign-in window was closed.'
    if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found')) return 'Email or password is wrong.'
    if (code.includes('email-already-in-use')) return 'That email already has an account. Sign in instead.'
    if (code.includes('network')) return 'You look offline. Check your connection and try again.'
    return msg.replace(/^Firebase: /, '').replace(/\s*\(auth\/[^)]+\)\.?/, '')
  }
  return 'Something went wrong. Please try again.'
}
