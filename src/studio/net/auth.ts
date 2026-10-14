import { create } from 'zustand'
import { sanitizeLook, type StudioLook } from '../../shared/studio/look'

/**
 * DollScene accounts (server/realtime/auth.mjs): sign up with a username (the doll's name, unique),
 * a password and a date of birth (18+); sign in with username + password. The access token lives
 * in memory only; the refresh token (30 days, rotated on every use) is kept on this device so the
 * player stays signed in until they sign out.
 */

export interface Account {
  id: string
  username: string
}

interface AuthState {
  user: Account | null
  /** 'checking' while a remembered session is restored at boot. */
  status: 'checking' | 'signed-in' | 'signed-out'
}

export const useAuth = create<AuthState>(() => ({ user: null, status: 'checking' }))

const STORE = 'dollscene-auth'
/** HTTP base: the realtime service's origin (VITE_REALTIME_URL), else the game's own /rt. */
export function serviceBase() {
  const rt = import.meta.env?.VITE_REALTIME_URL as string | undefined
  if (rt) return rt.replace(/^ws/, 'http').replace(/\/realtime$/, '')
  return typeof location !== 'undefined' ? `${location.origin}/rt` : '/rt'
}

let access: string | null = null
let accessExp = 0
let refreshing: Promise<boolean> | null = null

interface Session {
  user: Account
  access: string
  refresh: string
  refreshExp: number
}

function remember(s: Session | null) {
  try {
    if (s) localStorage.setItem(STORE, JSON.stringify({ refresh: s.refresh, exp: s.refreshExp, username: s.user.username }))
    else localStorage.removeItem(STORE)
  } catch {
    /* storage blocked: signed in for this visit only */
  }
}

function remembered(): { refresh: string; exp: number } | null {
  try {
    const x = JSON.parse(localStorage.getItem(STORE) || 'null')
    return x && typeof x.refresh === 'string' && typeof x.exp === 'number' && x.exp > Date.now() ? x : null
  } catch {
    return null
  }
}

export class AuthFailure extends Error {
  readonly code: string
  constructor(code: string, text: string) {
    super(text)
    this.code = code
  }
}

async function post<T>(path: string, body: unknown, method = 'POST', token?: string): Promise<T> {
  let r: Response
  try {
    r = await fetch(`${serviceBase()}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: method === 'GET' ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new AuthFailure('offline', 'Couldn’t reach DollScene. Check your connection and try again.')
  }
  const data = (await r.json().catch(() => ({}))) as T & { error?: string; text?: string }
  if (!r.ok) throw new AuthFailure(data.error ?? 'error', data.text ?? 'Something went wrong. Try again.')
  return data
}

function signedIn(s: Session) {
  access = s.access
  accessExp = Date.now() + 14 * 60_000
  remember(s)
  useAuth.setState({ user: s.user, status: 'signed-in' })
}

export async function register(username: string, password: string, dob: string) {
  signedIn(await post<Session>('/auth/register', { username, password, dob }))
}

export async function signIn(username: string, password: string) {
  signedIn(await post<Session>('/auth/login', { username, password }))
}

export async function signOut() {
  const r = remembered()
  access = null
  remember(null)
  useAuth.setState({ user: null, status: 'signed-out' })
  if (r) await post('/auth/logout', { refresh: r.refresh }).catch(() => {})
}

/** Trade the remembered refresh token for a new session (also used when the access token expires). */
export function restore(): Promise<boolean> {
  refreshing ??= (async () => {
    const r = remembered()
    if (!r) {
      useAuth.setState({ status: 'signed-out', user: null })
      return false
    }
    try {
      signedIn(await post<Session>('/auth/refresh', { refresh: r.refresh }))
      return true
    } catch (e) {
      // a dropped connection keeps the remembered session for next time; a refused one ends it
      if (!(e instanceof AuthFailure && e.code === 'offline')) remember(null)
      useAuth.setState({ status: 'signed-out', user: null })
      return false
    }
  })().finally(() => (refreshing = null))
  return refreshing
}

/** The current access token (refreshing it when needed), for the realtime hello. */
export async function accessToken(): Promise<string | null> {
  if (access && Date.now() < accessExp) return access
  if (useAuth.getState().status !== 'signed-in') return null
  return (await restore()) ? access : null
}

async function withAccess<T>(fn: (token: string) => Promise<T>): Promise<T | null> {
  const t = await accessToken()
  if (!t) return null
  try {
    return await fn(t)
  } catch (e) {
    if (e instanceof AuthFailure && e.code === 'expired' && (await restore()) && access) return fn(access)
    throw e
  }
}

export async function loadAccountLook(): Promise<StudioLook | null> {
  const r = await withAccess((t) => post<{ look: unknown }>('/auth/look', null, 'GET', t))
  return r?.look ? sanitizeLook(r.look) : null
}

export async function saveAccountLook(look: StudioLook) {
  await withAccess((t) => post('/auth/look', { look }, 'PUT', t))
}

/** Is this doll name still free? (null: couldn't check) */
export async function nameFree(name: string): Promise<boolean | null> {
  try {
    return (await post<{ free: boolean }>('/auth/name', { name })).free
  } catch {
    return null
  }
}
