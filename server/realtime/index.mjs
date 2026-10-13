/**
 * DollScene Beauty Studio: realtime server (Node 20+, `ws`).
 *
 *   Presence   every player is in one channel: "hub", "door:<id>" (a room behind a Hub door) or
 *              "scene:<id>" (out at a scene). Live headcounts for every channel go to everyone
 *              (door:scenes = everyone out at any scene).
 *   Sync       in a scene, players see each other's dolls (their look, once, then on change) and
 *              position / facing / pose / expression / activity, batched at 10 Hz.
 *   Chat       public to the whole channel, shown as speech bubbles. "@name" highlights the named
 *              players and pings them wherever they are, so they can reply straight back.
 *   Safety     18+ only (the client must confirm), profanity masked, token-bucket rate limits on
 *              chat / state / looks, duplicate-flood checks, block (both directions, server-side),
 *              report (logged; three reporters in 10 minutes mutes the sender for 15 minutes),
 *              per-IP connection caps, small message sizes.
 *   Identity   inside Lagos Life: the Vatar session token, verified with POST /session/verify (the
 *              player id never comes from the client). Outside it (preview / local dev) only with
 *              ALLOW_GUESTS=1: a random server-side guest id.
 *
 * Env: PORT (8080), VATAR_SECRET (server secret, required for real players), ALLOW_GUESTS=1,
 *      ALLOWED_ORIGINS (comma list; empty = any), REPORT_LOG (file path, default stdout only).
 */
import { randomUUID } from 'node:crypto'
import { appendFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { WebSocketServer } from 'ws'
import { bucket, cleanText, displayName, mentionsIn, tidy } from './moderation.mjs'

const PORT = Number(process.env.PORT || 8080)
const VATAR_SECRET = process.env.VATAR_SECRET || ''
const ALLOW_GUESTS = process.env.ALLOW_GUESTS === '1'
const ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean)
const REPORT_LOG = process.env.REPORT_LOG || ''
const VATAR_API = 'https://lagoslife.app/api/games/v1'

const MAX_MSG = 16 * 1024
const MAX_LOOK = 12 * 1024
const MAX_PER_IP = 8
const CHANNEL = /^(hub|door:[a-z]{2,16}|scene:[a-z0-9]{2,16})$/

/** id -> client */
const clients = new Map()
/** channel -> Set(id) */
const channels = new Map()
const perIp = new Map()
/** reported id -> Map(reporterId -> time) */
const reports = new Map()

const now = () => Date.now()
const send = (c, msg) => c.ws.readyState === 1 && c.ws.send(JSON.stringify(msg))

function members(ch) {
  let s = channels.get(ch)
  if (!s) channels.set(ch, (s = new Set()))
  return s
}

function peerOf(c) {
  return { id: c.id, name: c.name, look: c.look, state: c.state }
}

function counts() {
  const out = {}
  let scenes = 0
  for (const [ch, set] of channels) {
    if (!set.size) continue
    out[ch] = set.size
    if (ch.startsWith('scene:')) scenes += set.size
  }
  out['door:scenes'] = scenes
  out.total = clients.size
  return out
}

let countsDirty = true
setInterval(() => {
  if (!countsDirty) return
  countsDirty = false
  const msg = JSON.stringify({ t: 'counts', c: counts() })
  for (const c of clients.values()) if (c.ready && c.ws.readyState === 1) c.ws.send(msg)
}, 1000)

/* ------------------------------------------------------------------ state batching (10 Hz) */

setInterval(() => {
  for (const [ch, set] of channels) {
    if (!ch.startsWith('scene:') || set.size < 2) continue
    const dirty = []
    for (const id of set) {
      const c = clients.get(id)
      if (c?.stateDirty) {
        dirty.push([id, c.state])
        c.stateDirty = false
      }
    }
    if (!dirty.length) continue
    for (const id of set) {
      const c = clients.get(id)
      if (!c) continue
      const list = dirty.filter(([pid]) => pid !== id && !c.blocked.has(pid) && !clients.get(pid)?.blocked.has(id))
      if (list.length) send(c, { t: 'states', list })
    }
  }
}, 100)

/* ------------------------------------------------------------------ channels */

function leave(c) {
  if (!c.channel) return
  const set = members(c.channel)
  set.delete(c.id)
  for (const id of set) {
    const o = clients.get(id)
    if (o) send(o, { t: 'leave', id: c.id })
  }
  c.channel = null
  countsDirty = true
}

function join(c, ch) {
  if (c.channel === ch) return
  leave(c)
  c.channel = ch
  const set = members(ch)
  set.add(c.id)
  countsDirty = true
  // only scenes carry dolls and chat between players; rooms behind doors just count heads
  const peers = []
  if (ch.startsWith('scene:')) {
    for (const id of set) {
      if (id === c.id) continue
      const o = clients.get(id)
      if (!o || c.blocked.has(id) || o.blocked.has(c.id)) continue
      peers.push(peerOf(o))
      send(o, { t: 'join', peer: peerOf(c) })
    }
  }
  send(c, { t: 'roster', channel: ch, peers, counts: counts() })
}

/* ------------------------------------------------------------------ identity */

async function verify(session) {
  if (typeof session !== 'string' || session.length < 16 || session.length > 4096) return null
  const r = await fetch(`${VATAR_API}/session/verify`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${VATAR_SECRET}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ session }),
  }).catch(() => null)
  if (!r || r.status !== 200) return null
  const d = await r.json().catch(() => null)
  return d && typeof d.playerId === 'string' ? { id: d.playerId, mode: d.mode } : null
}

/* ------------------------------------------------------------------ messages */

function report(c, msg) {
  const target = clients.get(msg.id)
  const entry = { at: new Date().toISOString(), reporter: c.id, reported: msg.id, reportedName: target?.name ?? null, reason: tidy(msg.reason, 120), message: tidy(msg.text, 240), channel: c.channel }
  console.log('[report]', JSON.stringify(entry))
  if (REPORT_LOG) appendFile(REPORT_LOG, JSON.stringify(entry) + '\n').catch(() => {})
  let m = reports.get(msg.id)
  if (!m) reports.set(msg.id, (m = new Map()))
  m.set(c.id, now())
  for (const [k, t] of m) if (now() - t > 10 * 60_000) m.delete(k)
  if (m.size >= 3 && target) {
    target.mutedUntil = now() + 15 * 60_000
    send(target, { t: 'notice', kind: 'muted', until: target.mutedUntil, text: 'Your chat is paused for 15 minutes after reports from other players.' })
    reports.delete(msg.id)
  }
  send(c, { t: 'notice', kind: 'reported', text: 'Thanks. We’ve logged it, and they’re blocked for you.' })
  c.blocked.add(msg.id)
}

function chat(c, msg) {
  if (!c.channel?.startsWith('scene:')) return send(c, { t: 'notice', kind: 'nochat', text: 'Chat is open at the scenes.' })
  if (c.mutedUntil > now()) return send(c, { t: 'notice', kind: 'muted', until: c.mutedUntil, text: 'Your chat is paused for a little while.' })
  const raw = tidy(msg.text, 200)
  if (!raw) return
  if (!c.chatBucket.take()) return send(c, { t: 'notice', kind: 'slow', cid: msg.cid, text: 'Slow down a little: one message at a time.' })
  if (raw === c.lastText && now() - c.lastAt < 15_000) return send(c, { t: 'notice', kind: 'dupe', cid: msg.cid, text: 'You just said that.' })
  c.lastText = raw
  c.lastAt = now()
  const text = cleanText(raw)
  const names = mentionsIn(text)
  const mentions = []
  if (names.length) for (const o of clients.values()) if (o.id !== c.id && names.includes(o.name.toLowerCase())) mentions.push(o.id)
  const out = { t: 'chat', id: randomUUID().slice(0, 12), from: c.id, name: c.name, text, mentions, ts: now(), channel: c.channel }
  for (const id of members(c.channel)) {
    const o = clients.get(id)
    if (!o || o.blocked.has(c.id) || c.blocked.has(id)) continue
    send(o, id === c.id ? { ...out, cid: msg.cid } : out)
  }
  // a mention reaches them wherever they are (another scene, a room, the Hub)
  for (const id of mentions) {
    const o = clients.get(id)
    if (!o || o.channel === c.channel || o.blocked.has(c.id) || c.blocked.has(id)) continue
    send(o, { t: 'mention', ...out })
  }
}

async function onMessage(c, data) {
  if (data.length > MAX_MSG) return
  let msg
  try {
    msg = JSON.parse(data)
  } catch {
    return
  }
  if (!msg || typeof msg.t !== 'string') return
  if (!c.ready) {
    if (msg.t !== 'hello') return
    if (msg.adult !== true) {
      send(c, { t: 'error', code: 'adult_only', text: 'DollScene is for players 18 and over.' })
      return c.ws.close(4003, 'adult_only')
    }
    let id = null
    if (VATAR_SECRET && msg.session) id = (await verify(msg.session))?.id ?? null
    if (!id && ALLOW_GUESTS) id = `g_${randomUUID().slice(0, 10)}`
    if (!id) {
      send(c, { t: 'error', code: 'unauthorised', text: 'Couldn’t confirm your session.' })
      return c.ws.close(4001, 'unauthorised')
    }
    // one live connection per player: a new tab replaces the old one
    const old = clients.get(id)
    if (old && old !== c) {
      leave(old)
      old.ws.close(4000, 'replaced')
      clients.delete(id)
    }
    c.id = id
    c.name = displayName(msg.name)
    c.look = typeof msg.look === 'object' && JSON.stringify(msg.look).length <= MAX_LOOK ? msg.look : null
    c.ready = true
    clients.set(id, c)
    send(c, { t: 'welcome', you: id, name: c.name })
    join(c, CHANNEL.test(msg.channel) ? msg.channel : 'hub')
    return
  }
  switch (msg.t) {
    case 'join':
      if (CHANNEL.test(msg.channel)) join(c, msg.channel)
      break
    case 'state': {
      if (!c.stateBucket.take()) break
      const s = msg.s ?? {}
      const num = (v, lo, hi) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : 0)
      c.state = { x: num(s.x, -40, 40), z: num(s.z, -40, 40), ry: num(s.ry, -7, 7), pose: tidy(s.pose, 20), expr: tidy(s.expr, 20), act: tidy(s.act, 20) }
      c.stateDirty = true
      break
    }
    case 'look': {
      if (!c.lookBucket.take()) break
      if (typeof msg.look !== 'object' || JSON.stringify(msg.look).length > MAX_LOOK) break
      c.look = msg.look
      if (typeof msg.name === 'string') c.name = displayName(msg.name)
      if (c.channel?.startsWith('scene:'))
        for (const id of members(c.channel)) {
          const o = clients.get(id)
          if (o && id !== c.id && !o.blocked.has(c.id) && !c.blocked.has(id)) send(o, { t: 'look', id: c.id, name: c.name, look: c.look })
        }
      break
    }
    case 'chat':
      chat(c, msg)
      break
    case 'block':
      if (typeof msg.id === 'string') {
        if (msg.on) c.blocked.add(msg.id)
        else c.blocked.delete(msg.id)
        if (msg.on) {
          send(c, { t: 'leave', id: msg.id })
          const o = clients.get(msg.id)
          if (o) send(o, { t: 'leave', id: c.id })
        }
      }
      break
    case 'report':
      if (typeof msg.id === 'string' && c.reportBucket.take()) report(c, msg)
      break
    case 'ping':
      send(c, { t: 'pong', ts: msg.ts })
      break
  }
}

/* ------------------------------------------------------------------ server */

const http = createServer((req, res) => {
  if (req.url === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    return res.end('ok')
  }
  if (req.url === '/counts') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' })
    return res.end(JSON.stringify(counts()))
  }
  res.writeHead(404)
  res.end()
})

const wss = new WebSocketServer({ server: http, path: '/realtime', maxPayload: MAX_MSG })

wss.on('connection', (ws, req) => {
  const origin = req.headers.origin || ''
  if (ORIGINS.length && !ORIGINS.includes(origin)) return ws.close(4004, 'origin')
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString().split(',')[0].trim()
  const n = (perIp.get(ip) || 0) + 1
  if (n > MAX_PER_IP) return ws.close(4029, 'too_many')
  perIp.set(ip, n)
  const c = {
    ws,
    id: null,
    name: 'Doll',
    look: null,
    state: { x: 0, z: 0, ry: 0, pose: 'relaxed', expr: 'smile', act: '' },
    stateDirty: false,
    channel: null,
    ready: false,
    blocked: new Set(),
    mutedUntil: 0,
    lastText: '',
    lastAt: 0,
    chatBucket: bucket(4, 0.6),
    stateBucket: bucket(20, 12),
    lookBucket: bucket(3, 0.3),
    reportBucket: bucket(3, 0.05),
    alive: true,
  }
  ws.on('pong', () => (c.alive = true))
  ws.on('message', (data) => void onMessage(c, data.toString()).catch((e) => console.error(e)))
  ws.on('close', () => {
    perIp.set(ip, Math.max(0, (perIp.get(ip) || 1) - 1))
    if (c.id && clients.get(c.id) === c) {
      leave(c)
      clients.delete(c.id)
      countsDirty = true
    }
  })
  // say hello within 10 s or go
  setTimeout(() => !c.ready && ws.close(4008, 'hello_timeout'), 10_000)
})

// drop dead connections
setInterval(() => {
  for (const ws of wss.clients) {
    const c = [...clients.values()].find((x) => x.ws === ws)
    if (c && !c.alive) {
      ws.terminate()
      continue
    }
    if (c) c.alive = false
    ws.ping()
  }
}, 25_000)

http.listen(PORT, () => console.log(`dollscene realtime on :${PORT} (guests ${ALLOW_GUESTS ? 'on' : 'off'}, vatar ${VATAR_SECRET ? 'on' : 'off'})`))
