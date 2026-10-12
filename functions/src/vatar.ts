/**
 * DollScene Studio backend for the Lagos Life (Vatar Games) edition.
 * Docs: https://lagoslife.app/developers/docs
 *
 * The game never sends a player id we trust: every call carries a fresh Vatar session
 * token, which we check with POST /session/verify. Looks are stored under the per-game
 * player id that check returns. Purchases are granted only after GET /purchases/{id}
 * says this player paid, once per purchase id, then marked delivered.
 *
 * Secrets (never in the game's code):
 *   firebase functions:secrets:set VATAR_SECRET           # vtr_test_… in the sandbox, vtr_live_… after approval
 *   firebase functions:secrets:set VATAR_WEBHOOK_SECRET   # vtr_whsec_test_… / vtr_whsec_live_…
 */
import { createHmac, timingSafeEqual } from 'node:crypto'
import { FieldValue, getFirestore, type Firestore } from 'firebase-admin/firestore'
import { defineSecret } from 'firebase-functions/params'
import { onRequest, type Request } from 'firebase-functions/v2/https'
import type { Response } from 'express'
import { briefForDay, scoreLook, studioDay } from './shared/studio/challenges'
import { MAX_SAVED_LOOKS, sanitizeLook, sanitizeSavedLook, type SavedLook, type StudioLook } from './shared/studio/look'
import { PRODUCT_BY_ID } from './shared/studio/products'

const VATAR_SECRET = defineSecret('VATAR_SECRET')
const VATAR_WEBHOOK_SECRET = defineSecret('VATAR_WEBHOOK_SECRET')
const API = 'https://lagoslife.app/api/games/v1'
const MAX_BODY = 64 * 1024

interface PlayerDoc {
  name: string
  mode: 'live' | 'test'
  current: StudioLook | null
  looks: SavedLook[]
  entitlements: string[]
  xp: number
  /** Best score per UTC day. */
  days: Record<string, { brief: string; best: number }>
}

class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code)
  }
}

async function vatar<T>(path: string, body?: unknown): Promise<{ status: number; data: T & { error?: string } }> {
  const r = await fetch(API + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { Authorization: `Bearer ${VATAR_SECRET.value()}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const data = (await r.json().catch(() => ({}))) as T & { error?: string }
  return { status: r.status, data }
}

/* ------------------------------------------------------------------ sessions */

interface VerifiedPlayer {
  playerId: string
  name: string
  mode: 'live' | 'test'
  exp: number
}
const sessionCache = new Map<string, VerifiedPlayer>()

async function verifySession(session: unknown): Promise<VerifiedPlayer> {
  if (typeof session !== 'string' || session.length < 16 || session.length > 4096) throw new HttpError(400, 'bad_request')
  const cached = sessionCache.get(session)
  if (cached && cached.exp > Date.now() + 5_000) return cached
  const r = await vatar<VerifiedPlayer>('/session/verify', { session })
  if (r.status !== 200) throw new HttpError(r.status === 429 ? 429 : 401, r.data.error ?? 'invalid_session')
  const p = { playerId: r.data.playerId, name: r.data.name, mode: r.data.mode, exp: r.data.exp }
  if (sessionCache.size > 5000) sessionCache.clear()
  sessionCache.set(session, p)
  return p
}

/* ------------------------------------------------------------------ players */

const players = (db: Firestore) => db.collection('vatarPlayers')

async function loadPlayer(db: Firestore, p: VerifiedPlayer): Promise<PlayerDoc> {
  const ref = players(db).doc(p.playerId)
  const snap = await ref.get()
  if (snap.exists) {
    const d = snap.data() as PlayerDoc
    if (d.name !== p.name) await ref.update({ name: p.name, updatedAt: FieldValue.serverTimestamp() })
    return { ...d, name: p.name }
  }
  const fresh: PlayerDoc = { name: p.name, mode: p.mode, current: null, looks: [], entitlements: [], xp: 0, days: {} }
  await ref.set({ ...fresh, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() })
  return fresh
}

function publicState(p: VerifiedPlayer, d: PlayerDoc) {
  const day = studioDay(Date.now())
  return {
    player: { id: p.playerId, name: p.name, mode: p.mode },
    current: d.current ? sanitizeLook(d.current) : null,
    looks: (d.looks ?? []).map(sanitizeSavedLook).filter(Boolean),
    entitlements: d.entitlements ?? [],
    xp: d.xp ?? 0,
    today: { day, best: d.days?.[day]?.best ?? null },
  }
}

/* ------------------------------------------------------------------ purchases */

interface Purchase {
  id: string
  productId: string
  playerId: string
  status: 'paid' | 'delivered' | 'refunded'
  mode: 'live' | 'test'
}

/**
 * Checks the purchase with Vatar, grants it once (keyed by purchase id) and marks it
 * delivered. `expectPlayer` is the verified session's player when the game asks.
 */
async function grantPurchase(db: Firestore, purchaseId: unknown, expectPlayer?: string): Promise<string[]> {
  if (typeof purchaseId !== 'string' || !/^[A-Za-z0-9_-]{4,64}$/.test(purchaseId)) throw new HttpError(400, 'bad_request')
  const r = await vatar<Purchase>(`/purchases/${encodeURIComponent(purchaseId)}`)
  if (r.status !== 200) throw new HttpError(r.status === 404 ? 404 : 502, r.data.error ?? 'purchase_check_failed')
  const pur = r.data
  if (expectPlayer && pur.playerId !== expectPlayer) throw new HttpError(403, 'not_your_purchase')
  if (pur.status === 'refunded') throw new HttpError(409, 'refunded')
  const product = PRODUCT_BY_ID.get(pur.productId)
  if (!product) throw new HttpError(409, 'unknown_product')

  const playerRef = players(db).doc(pur.playerId)
  const grantRef = db.collection('vatarPurchases').doc(pur.id)
  const entitlements = await db.runTransaction(async (tx) => {
    const [grant, player] = await Promise.all([tx.get(grantRef), tx.get(playerRef)])
    const current: string[] = (player.data()?.entitlements as string[] | undefined) ?? []
    if (grant.exists) return current
    const next = current.includes(product.grants) ? current : [...current, product.grants]
    tx.set(grantRef, { playerId: pur.playerId, productId: pur.productId, mode: pur.mode, grantedAt: FieldValue.serverTimestamp() })
    if (player.exists) tx.update(playerRef, { entitlements: next, updatedAt: FieldValue.serverTimestamp() })
    else tx.set(playerRef, { name: '', mode: pur.mode, current: null, looks: [], entitlements: next, xp: 0, days: {}, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() })
    return next
  })
  // Safe to repeat. If it fails we still granted; purchases() will list it again and the
  // next claim re-runs this idempotently.
  await vatar(`/purchases/${encodeURIComponent(pur.id)}/deliver`, {})
  return entitlements
}

function webhookSigned(raw: Buffer, header: unknown): boolean {
  const want = Buffer.from('sha256=' + createHmac('sha256', VATAR_WEBHOOK_SECRET.value()).update(raw).digest('hex'))
  const got = Buffer.from(String(header ?? ''))
  return want.length === got.length && timingSafeEqual(want, got)
}

/* ------------------------------------------------------------------ routes */

type Body = Record<string, unknown>

async function route(db: Firestore, path: string, body: Body, req: Request) {
  switch (path) {
    case 'me': {
      const p = await verifySession(body.session)
      return publicState(p, await loadPlayer(db, p))
    }
    case 'look': {
      // The working look, so a player comes back to exactly where they left off.
      const p = await verifySession(body.session)
      await loadPlayer(db, p)
      await players(db).doc(p.playerId).update({ current: sanitizeLook(body.look), updatedAt: FieldValue.serverTimestamp() })
      return { ok: true }
    }
    case 'looks/save': {
      const p = await verifySession(body.session)
      const saved = sanitizeSavedLook({ ...(body.saved as object), savedAt: Date.now() })
      if (!saved) throw new HttpError(400, 'bad_request')
      const d = await loadPlayer(db, p)
      const rest = (d.looks ?? []).filter((l) => l.id !== saved.id)
      if (rest.length >= MAX_SAVED_LOOKS) throw new HttpError(409, 'lookbook_full')
      const looks = [saved, ...rest]
      await players(db).doc(p.playerId).update({ looks, updatedAt: FieldValue.serverTimestamp() })
      return { looks }
    }
    case 'looks/delete': {
      const p = await verifySession(body.session)
      const d = await loadPlayer(db, p)
      const looks = (d.looks ?? []).filter((l) => l.id !== body.id)
      await players(db).doc(p.playerId).update({ looks, updatedAt: FieldValue.serverTimestamp() })
      return { looks }
    }
    case 'challenge': {
      // Scored here, from the shared rubric, so the XP that feeds the leaderboard is ours.
      const p = await verifySession(body.session)
      const look = sanitizeLook(body.look)
      const day = studioDay(Date.now())
      const brief = briefForDay(day)
      const result = scoreLook(brief, look)
      const ref = players(db).doc(p.playerId)
      await loadPlayer(db, p)
      const out = await db.runTransaction(async (tx) => {
        const d = (await tx.get(ref)).data() as PlayerDoc
        const prev = d.days?.[day]?.best ?? 0
        const gain = Math.max(0, result.score - prev)
        const xp = (d.xp ?? 0) + gain
        if (gain > 0) tx.update(ref, { xp, [`days.${day}`]: { brief: brief.id, best: result.score }, updatedAt: FieldValue.serverTimestamp() })
        return { xp, gain, best: Math.max(prev, result.score) }
      })
      return { ...result, ...out, day, brief: brief.id }
    }
    case 'claim': {
      const p = await verifySession(body.session)
      return { entitlements: await grantPurchase(db, body.purchaseId, p.playerId) }
    }
    case 'webhook': {
      const raw = (req as Request & { rawBody?: Buffer }).rawBody ?? Buffer.from('')
      if (!webhookSigned(raw, req.headers['x-vatar-signature'])) throw new HttpError(401, 'bad_signature')
      const evt = body as { id?: string; type?: string; data?: { purchaseId?: string } }
      const seen = db.collection('vatarWebhookEvents').doc(String(evt.id ?? 'none'))
      if ((await seen.get()).exists) return { ok: true }
      // A webhook is a nudge, not proof: grantPurchase checks the purchase with the API.
      if (evt.type === 'purchase.paid' && evt.data?.purchaseId) await grantPurchase(db, evt.data.purchaseId)
      await seen.set({ type: evt.type ?? '', at: FieldValue.serverTimestamp() })
      return { ok: true }
    }
    default:
      throw new HttpError(404, 'not_found')
  }
}

export const vatarApi = onRequest({ secrets: [VATAR_SECRET, VATAR_WEBHOOK_SECRET], cors: false, maxInstances: 20, timeoutSeconds: 20 }, async (req: Request, res: Response) => {
  res.set('Cache-Control', 'no-store')
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' })
    return
  }
  const raw = (req as Request & { rawBody?: Buffer }).rawBody
  if (raw && raw.length > MAX_BODY) {
    res.status(413).json({ error: 'too_large' })
    return
  }
  const path = req.path.replace(/^\/+/, '').replace(/^api\/vatar\/?/, '')
  try {
    const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Body
    res.json(await route(getFirestore(), path, body, req))
  } catch (e) {
    if (e instanceof HttpError) {
      res.status(e.status).json({ error: e.code })
      return
    }
    console.error('vatarApi', path, e)
    res.status(500).json({ error: 'error' })
  }
})

/** For scripts/vatar-test.cjs only (not exported from index.ts, so never deployed). */
export const _test = { route, sessionCache }
