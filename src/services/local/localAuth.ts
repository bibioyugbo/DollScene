import { BackendError, type AuthService, type AuthUser } from '../types'
import { randomId } from './localDb'

/**
 * Offline auth for development and demos. Accounts live in localStorage with
 * salted SHA-256 password hashes. The session is per tab (sessionStorage), so
 * two tabs can be two different players chatting in real time.
 */
const ACCOUNTS_KEY = 'dc-auth:accounts'
const SESSION_KEY = 'dc-auth:session'
const LAST_KEY = 'dc-auth:last'

interface Account {
  uid: string
  email: string
  salt: string
  hash: string
  provider: 'google' | 'password'
  displayName: string | null
}

function accounts(): Record<string, Account> {
  try {
    return JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '{}')
  } catch {
    return {}
  }
}

function saveAccounts(a: Record<string, Account>) {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(a))
}

async function hash(password: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${password}`)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

const toUser = (a: Account): AuthUser => ({ uid: a.uid, email: a.email, displayName: a.displayName, provider: a.provider })

export function createLocalAuth(): AuthService {
  const listeners = new Set<(u: AuthUser | null) => void>()

  const restore = (): AuthUser | null => {
    const uid = sessionStorage.getItem(SESSION_KEY) ?? localStorage.getItem(LAST_KEY)
    const acc = uid ? Object.values(accounts()).find((a) => a.uid === uid) : undefined
    return acc ? toUser(acc) : null
  }
  let current = restore()

  const setCurrent = (u: AuthUser | null) => {
    current = u
    if (u) {
      sessionStorage.setItem(SESSION_KEY, u.uid)
      localStorage.setItem(LAST_KEY, u.uid)
    } else {
      sessionStorage.removeItem(SESSION_KEY)
      localStorage.removeItem(LAST_KEY)
    }
    for (const cb of listeners) cb(u)
  }

  const validate = (email: string, password: string) => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new BackendError('auth/invalid-email', 'That email doesn’t look right.')
    if (password.length < 6) throw new BackendError('auth/weak-password', 'Use at least 6 characters.')
  }

  return {
    current: () => current,
    onChange(cb) {
      listeners.add(cb)
      queueMicrotask(() => cb(current))
      return () => listeners.delete(cb)
    },
    async signInWithGoogle() {
      // Offline stand-in for Google: one demo Google account per browser.
      const email = 'google.player@dollscene.local'
      const all = accounts()
      let acc = all[email]
      if (!acc) {
        acc = { uid: randomId(24), email, salt: '', hash: '', provider: 'google', displayName: 'Google player' }
        all[email] = acc
        saveAccounts(all)
      }
      const u = toUser(acc)
      setCurrent(u)
      return u
    },
    async signInWithEmail(email, password) {
      email = email.trim().toLowerCase()
      validate(email, password)
      const acc = accounts()[email]
      if (!acc || acc.provider !== 'password' || (await hash(password, acc.salt)) !== acc.hash) {
        throw new BackendError('auth/invalid-credential', 'Email or password is wrong.')
      }
      const u = toUser(acc)
      setCurrent(u)
      return u
    },
    async signUpWithEmail(email, password) {
      email = email.trim().toLowerCase()
      validate(email, password)
      const all = accounts()
      if (all[email]) throw new BackendError('auth/email-already-in-use', 'That email already has an account. Sign in instead.')
      const salt = randomId(16)
      const acc: Account = { uid: randomId(24), email, salt, hash: await hash(password, salt), provider: 'password', displayName: null }
      all[email] = acc
      saveAccounts(all)
      const u = toUser(acc)
      setCurrent(u)
      return u
    },
    async sendPasswordReset() {
      throw new BackendError('auth/unavailable', 'Password reset needs Firebase. In offline mode, create a new account.')
    },
    async signOut() {
      setCurrent(null)
    },
  }
}

/** Remove the offline account record (used by account deletion). */
export function deleteLocalAccount(uid: string) {
  const all = accounts()
  for (const [k, a] of Object.entries(all)) if (a.uid === uid) delete all[k]
  saveAccounts(all)
}
