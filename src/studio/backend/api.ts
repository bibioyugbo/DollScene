import type { ScoreResult } from '../../shared/studio/challenges'
import { sanitizeLook, sanitizeSavedLook, type SavedLook, type StudioLook } from '../../shared/studio/look'
import { vatar } from '../vatar/sdk'

/**
 * Our own backend (functions/src/vatar.ts, served at /api/vatar/* on the game's domain).
 * Every call carries a fresh Vatar session token; the server verifies it and works out
 * the player from it, so nothing here can claim to be someone else.
 */

export interface RemoteState {
  player: { id: string; name: string; mode: 'live' | 'test' }
  current: StudioLook | null
  looks: SavedLook[]
  entitlements: string[]
  xp: number
  today: { day: string; best: number | null }
}

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  constructor(status: number, code: string) {
    super(code)
    this.status = status
    this.code = code
  }
}

const BASE = (import.meta.env?.VITE_STUDIO_API as string | undefined) ?? '/api/vatar'

async function call<T>(path: string, body: Record<string, unknown> = {}): Promise<T> {
  const session = await vatar.session()
  let r: Response
  try {
    r = await fetch(`${BASE}/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, session }),
    })
  } catch {
    throw new ApiError(0, 'offline')
  }
  const data = (await r.json().catch(() => ({}))) as T & { error?: string }
  if (!r.ok) throw new ApiError(r.status, data.error ?? 'error')
  return data
}

export const api = {
  async me(): Promise<RemoteState> {
    const s = await call<RemoteState>('me')
    return {
      ...s,
      current: s.current ? sanitizeLook(s.current) : null,
      looks: (s.looks ?? []).map(sanitizeSavedLook).filter((l): l is SavedLook => !!l),
    }
  },
  saveCurrent: (look: StudioLook) => call<{ ok: true }>('look', { look }),
  saveLook: (saved: Omit<SavedLook, 'savedAt'>) => call<{ looks: SavedLook[] }>('looks/save', { saved }),
  deleteLook: (id: string) => call<{ looks: SavedLook[] }>('looks/delete', { id }),
  submitChallenge: (look: StudioLook) => call<ScoreResult & { xp: number; gain: number; best: number; day: string; brief: string }>('challenge', { look }),
  claim: (purchaseId: string) => call<{ entitlements: string[] }>('claim', { purchaseId }),
}

/* ------------------------------------------------------------------ device cache */

/**
 * A per-device copy keyed by the Vatar player id, so the studio opens instantly and keeps
 * working through a dropped connection. It is a cache, never the identity: the server copy
 * wins whenever it's reachable. Storage can be blocked inside the frame, so every access
 * is guarded.
 */
const key = (playerId: string) => `dollscene-studio:${playerId}`

export interface DeviceCache {
  current: StudioLook | null
  looks: SavedLook[]
  /** True when `current` changed while offline and still needs pushing. */
  dirty: boolean
}

export function readCache(playerId: string): DeviceCache | null {
  try {
    const raw = localStorage.getItem(key(playerId))
    if (!raw) return null
    const x = JSON.parse(raw) as Partial<DeviceCache>
    return {
      current: x.current ? sanitizeLook(x.current) : null,
      looks: Array.isArray(x.looks) ? x.looks.map(sanitizeSavedLook).filter((l): l is SavedLook => !!l) : [],
      dirty: !!x.dirty,
    }
  } catch {
    return null
  }
}

export function writeCache(playerId: string, c: DeviceCache) {
  try {
    localStorage.setItem(key(playerId), JSON.stringify(c))
  } catch {
    /* storage blocked: the server copy is the record */
  }
}
