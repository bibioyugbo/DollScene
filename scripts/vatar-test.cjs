/**
 * Tests the Lagos Life studio backend (functions/src/vatar.ts) against a stubbed Vatar
 * API and an in-memory Firestore. Covers the rules that matter for money and identity:
 * sessions are verified, purchases are checked with the API, granted once, never for
 * another player and never when refunded, and webhooks need a valid signature.
 *
 *   npm run test:vatar
 */
const assert = require('node:assert/strict')
const crypto = require('node:crypto')

process.env.VATAR_SECRET = 'vtr_test_secret'
process.env.VATAR_WEBHOOK_SECRET = 'vtr_whsec_test_hook'

/* ------------------------------------------------------------------ fake Firestore */
const store = new Map()
const clone = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)))
function setPath(obj, path, value) {
  const keys = path.split('.')
  let o = obj
  for (const k of keys.slice(0, -1)) o = o[k] ??= {}
  o[keys.at(-1)] = value
}
function strip(data) {
  // FieldValue.serverTimestamp() sentinels become numbers.
  return JSON.parse(JSON.stringify(data, (k, v) => (v && typeof v === 'object' && v.constructor && v.constructor.name.includes('FieldValue') ? Date.now() : v)))
}
function docRef(path) {
  return {
    path,
    async get() {
      const d = store.get(path)
      return { exists: d !== undefined, data: () => clone(d) }
    },
    async set(data) {
      store.set(path, strip(data))
    },
    async update(data) {
      if (!store.has(path)) throw new Error('no doc ' + path)
      const d = clone(store.get(path))
      for (const [k, v] of Object.entries(strip(data))) setPath(d, k, v)
      store.set(path, d)
    },
  }
}
const db = {
  collection: (c) => ({ doc: (id) => docRef(`${c}/${id}`) }),
  async runTransaction(fn) {
    const writes = []
    const tx = {
      get: (ref) => ref.get(),
      set: (ref, data) => writes.push(() => ref.set(data)),
      update: (ref, data) => writes.push(() => ref.update(data)),
    }
    const out = await fn(tx)
    for (const w of writes) await w()
    return out
  },
}

/* ------------------------------------------------------------------ fake Vatar API */
const sessions = { 'vtr1.alice-session-token': { playerId: 't_alice', name: 'Alice', gameId: 'g', exp: Date.now() + 600000, mode: 'test' }, 'vtr1.bob-session-token-x': { playerId: 't_bob', name: 'Bob', gameId: 'g', exp: Date.now() + 600000, mode: 'test' } }
const purchases = {
  pur_alice_1: { id: 'pur_alice_1', productId: 'palette-gold-hour', playerId: 't_alice', amount: 500, currency: 'NGN', status: 'paid', mode: 'test' },
  pur_refunded: { id: 'pur_refunded', productId: 'palette-lagos-nights', playerId: 't_alice', amount: 500, currency: 'NGN', status: 'refunded', mode: 'test' },
  pur_unknown_product: { id: 'pur_unknown_product', productId: 'mystery', playerId: 't_alice', amount: 100, currency: 'NGN', status: 'paid', mode: 'test' },
}
const calls = []
global.fetch = async (url, init = {}) => {
  const path = url.replace('https://lagoslife.app/api/games/v1', '')
  calls.push(`${init.method} ${path}`)
  assert.equal(init.headers.Authorization, 'Bearer vtr_test_secret', 'secret is sent server-side')
  const json = (status, body) => ({ status, json: async () => body })
  if (path === '/session/verify') {
    const s = sessions[JSON.parse(init.body).session]
    return s ? json(200, s) : json(401, { error: 'invalid_token' })
  }
  const m = path.match(/^\/purchases\/([^/]+)(\/deliver)?$/)
  if (m) {
    const p = purchases[decodeURIComponent(m[1])]
    if (!p) return json(404, { error: 'not_found' })
    if (m[2]) {
      if (p.status === 'refunded') return json(409, { error: 'refunded' })
      p.status = 'delivered'
      return json(200, { id: p.id, status: 'delivered', deliveredAt: Date.now() })
    }
    return json(200, p)
  }
  return json(404, { error: 'not_found' })
}

const { _test } = require('../functions/lib/vatar.js')
const req = (headers = {}, rawBody) => ({ headers, rawBody })
const call = (path, body, r = req()) => _test.route(db, path, body, r)
const rejects = async (p, code) => {
  try {
    await p
  } catch (e) {
    assert.equal(e.code, code)
    return
  }
  assert.fail(`expected ${code}`)
}

;(async () => {
  const alice = 'vtr1.alice-session-token'
  const bob = 'vtr1.bob-session-token-x'

  // Sessions
  await rejects(call('me', { session: 'vtr1.forged-token-123' }), 'invalid_token')
  await rejects(call('me', {}), 'bad_request')
  const me = await call('me', { session: alice })
  assert.equal(me.player.id, 't_alice')
  assert.deepEqual(me.entitlements, [])

  // Looks are sanitised and stored under the verified player only
  await call('look', { session: alice, look: { skin: { tone: '#123456' }, morphs: { Lips: 9, Evil: 1 }, hair: { style: '<script>' } } })
  const saved = store.get('vatarPlayers/t_alice').current
  assert.equal(saved.skin.tone, '#123456')
  assert.equal(saved.morphs.Lips, 1, 'clamped')
  assert.equal(saved.morphs.Evil, undefined, 'unknown morph dropped')
  assert.equal(saved.hair.style, 'afro_big', 'unknown style replaced by the default')
  const lb = await call('looks/save', { session: alice, saved: { id: 'look-abc123', name: 'Owambe', look: {} } })
  assert.equal(lb.looks.length, 1)
  assert.equal((await call('me', { session: bob })).looks.length, 0, 'Bob cannot see Alice’s looks')

  // Purchases: someone else's purchase is refused
  await rejects(call('claim', { session: bob, purchaseId: 'pur_alice_1' }), 'not_your_purchase')
  assert.equal(store.get('vatarPurchases/pur_alice_1'), undefined)
  // Refunded is never granted; unknown products are refused; unknown ids are 404
  await rejects(call('claim', { session: alice, purchaseId: 'pur_refunded' }), 'refunded')
  await rejects(call('claim', { session: alice, purchaseId: 'pur_unknown_product' }), 'unknown_product')
  await rejects(call('claim', { session: alice, purchaseId: 'pur_nope' }), 'not_found')
  await rejects(call('claim', { session: alice, purchaseId: '../../x' }), 'bad_request')
  // Real purchase: granted once, delivered, idempotent on repeat
  const g1 = await call('claim', { session: alice, purchaseId: 'pur_alice_1' })
  assert.deepEqual(g1.entitlements, ['palette-gold-hour'])
  assert.ok(calls.includes('POST /purchases/pur_alice_1/deliver'))
  const g2 = await call('claim', { session: alice, purchaseId: 'pur_alice_1' })
  assert.deepEqual(g2.entitlements, ['palette-gold-hour'], 'no double grant')
  assert.equal(purchases.pur_alice_1.status, 'delivered')

  // Webhook: bad signature refused, good one checks the purchase through the API
  purchases.pur_alice_2 = { id: 'pur_alice_2', productId: 'palette-lagos-nights', playerId: 't_alice', amount: 500, currency: 'NGN', status: 'paid', mode: 'test' }
  const evt = { id: 'evt_1', type: 'purchase.paid', mode: 'test', data: { purchaseId: 'pur_alice_2', productId: 'palette-lagos-nights', playerId: 't_alice' } }
  const raw = Buffer.from(JSON.stringify(evt))
  await rejects(call('webhook', evt, req({ 'x-vatar-signature': 'sha256=' + '0'.repeat(64) }, raw)), 'bad_signature')
  const sig = 'sha256=' + crypto.createHmac('sha256', 'vtr_whsec_test_hook').update(raw).digest('hex')
  await call('webhook', evt, req({ 'x-vatar-signature': sig }, raw))
  assert.deepEqual(store.get('vatarPlayers/t_alice').entitlements, ['palette-gold-hour', 'palette-lagos-nights'])
  // A forged webhook body for a purchase that doesn't exist grants nothing
  const fake = { id: 'evt_2', type: 'purchase.paid', data: { purchaseId: 'pur_fake' } }
  const fraw = Buffer.from(JSON.stringify(fake))
  const fsig = 'sha256=' + crypto.createHmac('sha256', 'vtr_whsec_test_hook').update(fraw).digest('hex')
  await rejects(call('webhook', fake, req({ 'x-vatar-signature': fsig }, fraw)), 'not_found')

  // Challenge XP: scored on the server, only improvements count
  const c1 = await call('challenge', { session: bob, look: {} })
  const c2 = await call('challenge', { session: bob, look: {} })
  assert.equal(c2.gain, 0, 'same look twice earns nothing more')
  assert.equal(c2.xp, c1.xp)

  console.log('vatar backend: all checks passed')
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
