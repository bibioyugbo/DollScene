/**
 * Thin, typed adapter over the official Vatar Games SDK v1, loaded by studio.html from
 * https://lagoslife.app/sdk/vatar-games-v1.js (never a copy).
 * Only documented calls are used: init, session, purchase, purchases, onPurchase,
 * submitScore, leaderboard, onPause, onResume. https://lagoslife.app/developers/docs
 */

export interface VatarPlayer {
  /** Per-game pseudonym: p_… live, t_… test. */
  id: string
  name: string
  /** Small PNG data URL, or null. */
  avatar: string | null
}

export interface VatarInit {
  player: VatarPlayer
  session: string
  mode: 'live' | 'test'
}

export interface VatarPurchase {
  purchaseId: string
  productId: string
}

export interface VatarLeaderboard {
  top: { rank: number; name: string; score: number }[]
  me: { rank: number | null; label: string; score: number } | null
}

interface VatarGlobal {
  version: string
  init(): Promise<VatarInit>
  session(): Promise<{ session: string; exp: number }>
  purchase(productId: string): Promise<VatarPurchase>
  purchases(): Promise<VatarPurchase[]>
  onPurchase(fn: (p: VatarPurchase) => void): () => void
  submitScore(n: number): Promise<{ best: number; accepted: boolean }>
  leaderboard(): Promise<VatarLeaderboard>
  onPause(fn: () => void): () => void
  onResume(fn: () => void): () => void
}

declare global {
  interface Window {
    Vatar?: VatarGlobal
  }
}

/** Error codes from the docs ("Error codes · In your game"). */
export type VatarErrorCode =
  | 'not_framed'
  | 'timeout'
  | 'rate_limited'
  | 'busy'
  | 'cancelled'
  | 'payment_failed'
  | 'not_for_sale'
  | 'owned'
  | 'off'
  | 'signed_out'
  | 'too_soon'
  | 'bad_request'
  | 'error'
  | 'unavailable'

export function errorCode(e: unknown): VatarErrorCode {
  const c = (e as { code?: string } | null)?.code
  return (typeof c === 'string' ? c : 'error') as VatarErrorCode
}

/** Words a player sees for each refusal. */
export const ERROR_TEXT: Record<VatarErrorCode, string> = {
  not_framed: 'Open DollScene from the games app to use this.',
  timeout: 'The games app didn’t answer in time. Try again.',
  rate_limited: 'Slow down a little and try again.',
  busy: 'A payment sheet is already open.',
  cancelled: 'Purchase cancelled.',
  payment_failed: 'The payment didn’t go through.',
  not_for_sale: 'This item isn’t on sale right now.',
  owned: 'You already own this.',
  off: 'Games are switched off right now.',
  signed_out: 'Sign in to the games app first.',
  too_soon: 'Your score was saved. The leaderboard takes one score every 20 seconds.',
  bad_request: 'Something went wrong. Try again.',
  error: 'Something went wrong. Try again.',
  unavailable: 'The games app couldn’t be reached.',
}

function sdk(): VatarGlobal {
  const v = window.Vatar
  if (!v) throw Object.assign(new Error('Vatar: unavailable'), { code: 'unavailable' })
  return v
}

export const isFramed = () => {
  try {
    return window.parent !== window
  } catch {
    return true
  }
}

let cachedSession: { session: string; exp: number } | null = null

export const vatar = {
  available: () => !!window.Vatar,
  async init(): Promise<VatarInit> {
    const r = await sdk().init()
    // init's session is fresh for 15 minutes.
    cachedSession = { session: r.session, exp: Date.now() + 14 * 60_000 }
    return r
  },
  /** A session token with at least a minute left, for our server to verify. */
  async session(): Promise<string> {
    if (cachedSession && cachedSession.exp - Date.now() > 60_000) return cachedSession.session
    const r = await sdk().session()
    cachedSession = { session: r.session, exp: Math.min(r.exp, Date.now() + 15 * 60_000) }
    return r.session
  },
  purchase: (productId: string) => sdk().purchase(productId),
  purchases: () => sdk().purchases(),
  onPurchase: (fn: (p: VatarPurchase) => void) => (window.Vatar ? window.Vatar.onPurchase(fn) : () => {}),
  submitScore: (n: number) => sdk().submitScore(Math.floor(n)),
  leaderboard: () => sdk().leaderboard(),
  onPause: (fn: () => void) => (window.Vatar ? window.Vatar.onPause(fn) : () => {}),
  onResume: (fn: () => void) => (window.Vatar ? window.Vatar.onResume(fn) : () => {}),
}
