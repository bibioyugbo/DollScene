import { create } from 'zustand'
import { sanitizeLook, type StudioLook } from '../../shared/studio/look'
import { isFramed, vatar } from '../vatar/sdk'
import { sfx } from '../ui/sound'
import { accessToken } from './auth'

/**
 * Client for the realtime server (server/realtime): presence and live headcounts, the other players
 * at a scene (their dolls, positions and poses), and public chat with @mentions. Optimistic: your
 * own message shows at once and is confirmed by the server's echo. Blocks and mutes live here too.
 *
 * URL: VITE_REALTIME_URL (wss://…/realtime), else the game's own origin at /realtime (the dev and
 * preview servers run the realtime service in-process). With no server the game plays on: counts show "–".
 */

export interface PeerState {
  x: number
  z: number
  ry: number
  pose: string
  expr: string
  act: string
}

export interface Peer {
  id: string
  name: string
  look: StudioLook | null
  state: PeerState
  /** last time we heard from them (ms) */
  seen: number
}

export interface ChatMsg {
  id: string
  from: string
  name: string
  text: string
  mentions: string[]
  ts: number
  /** Mine and not yet confirmed by the server. */
  pending?: boolean
  /** This message mentions me. */
  forMe?: boolean
  /** Delivered from another channel (a mention). */
  elsewhere?: string
}

type Status = 'off' | 'connecting' | 'live' | 'offline'

interface RealtimeState {
  status: Status
  me: string | null
  channel: string
  counts: Record<string, number>
  peers: Record<string, Peer>
  chat: ChatMsg[]
  /** Latest message per player id (for speech bubbles). */
  bubbles: Record<string, ChatMsg>
  blocked: string[]
  muted: string[]
  notice: string | null
  /** Unread mentions of me. */
  pings: ChatMsg[]
}

export const useRealtime = create<RealtimeState>(() => ({
  status: 'off',
  me: null,
  channel: 'hub',
  counts: {},
  peers: {},
  chat: [],
  bubbles: {},
  blocked: [],
  muted: [],
  notice: null,
  pings: [],
}))

// the realtime service: VITE_REALTIME_URL, else the game's own origin (the dev and preview servers
// run it at /realtime; see vite.studio.config.ts)
const URL_ = (import.meta.env?.VITE_REALTIME_URL as string | undefined) || (typeof location !== 'undefined' ? `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/realtime` : '')

let ws: WebSocket | null = null
let hello: { name: string; look: StudioLook; channel: string } | null = null
let retry = 0
let retryTimer: number | null = null
let seq = 1

/** A compact look for the wire: the full look minus things others never need to see. */
function wireLook(l: StudioLook) {
  const out: Partial<StudioLook> = { ...l, profile: { name: l.profile.name, starter: l.profile.starter, onboarded: true } }
  delete out.transforms
  delete out.scene
  return out
}

function onMsg(raw: string) {
  let m: Record<string, unknown>
  try {
    m = JSON.parse(raw)
  } catch {
    return
  }
  const s = useRealtime.getState()
  const set = useRealtime.setState
  const blocked = new Set(s.blocked)
  switch (m.t) {
    case 'welcome':
      set({ me: m.you as string, status: 'live' })
      retry = 0
      break
    case 'counts':
      set({ counts: m.c as Record<string, number> })
      break
    case 'roster': {
      const peers: Record<string, Peer> = {}
      for (const p of m.peers as { id: string; name: string; look: unknown; state: PeerState }[]) if (!blocked.has(p.id)) peers[p.id] = { id: p.id, name: p.name, look: p.look ? sanitizeLook(p.look) : null, state: p.state, seen: Date.now() }
      set({ peers, channel: m.channel as string, counts: (m.counts as Record<string, number>) ?? s.counts, chat: s.channel === m.channel ? s.chat : [], bubbles: {} })
      break
    }
    case 'join': {
      const p = m.peer as { id: string; name: string; look: unknown; state: PeerState }
      if (blocked.has(p.id)) break
      set({ peers: { ...s.peers, [p.id]: { id: p.id, name: p.name, look: p.look ? sanitizeLook(p.look) : null, state: p.state, seen: Date.now() } } })
      break
    }
    case 'leave': {
      const rest = { ...s.peers }
      delete rest[m.id as string]
      set({ peers: rest })
      break
    }
    case 'states': {
      const peers = { ...s.peers }
      for (const [id, st] of m.list as [string, PeerState][]) if (peers[id]) peers[id] = { ...peers[id], state: st, seen: Date.now() }
      set({ peers })
      break
    }
    case 'look': {
      const p = s.peers[m.id as string]
      if (p) set({ peers: { ...s.peers, [p.id]: { ...p, name: m.name as string, look: sanitizeLook(m.look) } } })
      break
    }
    case 'chat':
    case 'mention': {
      const c = m as unknown as ChatMsg & { cid?: string; channel: string }
      if (blocked.has(c.from) || s.muted.includes(c.from)) break
      const forMe = !!s.me && c.mentions.includes(s.me)
      const msg: ChatMsg = { id: c.id, from: c.from, name: c.name, text: c.text, mentions: c.mentions, ts: c.ts, forMe, elsewhere: m.t === 'mention' ? c.channel : undefined }
      let chat = s.chat
      if (c.cid) chat = chat.filter((x) => x.id !== c.cid)
      if (m.t === 'chat') chat = [...chat, msg].slice(-80)
      set({ chat, bubbles: m.t === 'chat' ? { ...s.bubbles, [c.from]: msg } : s.bubbles, pings: forMe && c.from !== s.me ? [...s.pings, msg].slice(-10) : s.pings })
      if (forMe && c.from !== s.me) sfx('chime')
      break
    }
    case 'notice':
      set({ notice: m.text as string })
      if (m.cid) set({ chat: useRealtime.getState().chat.filter((x) => x.id !== m.cid) })
      break
    case 'error':
      set({ notice: m.text as string })
      break
  }
}

async function connect() {
  if (!URL_ || !hello) return useRealtime.setState({ status: 'offline' })
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return
  useRealtime.setState({ status: 'connecting' })
  let session: string | undefined
  if (isFramed()) session = await vatar.session().catch(() => undefined)
  const access = await accessToken().catch(() => null)
  const sock = new WebSocket(URL_)
  ws = sock
  sock.onopen = () => sock.send(JSON.stringify({ t: 'hello', session, access, adult: true, name: hello!.name, look: wireLook(hello!.look), channel: hello!.channel }))
  sock.onmessage = (e) => onMsg(String(e.data))
  sock.onclose = (e) => {
    if (ws !== sock) return
    ws = null
    useRealtime.setState({ status: 'offline', peers: {} })
    if (e.code === 4003 || e.code === 4001 || e.code === 4000) return
    // back off and try again
    retry = Math.min(retry + 1, 6)
    if (retryTimer) window.clearTimeout(retryTimer)
    retryTimer = window.setTimeout(() => void connect(), 1000 * 2 ** retry)
  }
  sock.onerror = () => sock.close()
}

const out = (m: object) => ws?.readyState === WebSocket.OPEN && ws.send(JSON.stringify(m))

export const realtime = {
  /** Start (after the player confirmed they're 18+ and named their doll). */
  start(name: string, look: StudioLook, channel: string) {
    hello = { name, look, channel }
    void connect()
  },
  stop() {
    hello = null
    ws?.close(1000)
    ws = null
    useRealtime.setState({ status: 'off', peers: {}, chat: [], bubbles: {} })
  },
  join(channel: string) {
    if (hello) hello.channel = channel
    if (useRealtime.getState().channel !== channel) useRealtime.setState({ channel, peers: {}, bubbles: {} })
    out({ t: 'join', channel })
  },
  look(name: string, look: StudioLook) {
    if (hello) hello = { ...hello, name, look }
    out({ t: 'look', name, look: wireLook(look) })
  },
  state(s: PeerState) {
    out({ t: 'state', s })
  },
  say(text: string) {
    const t = text.trim().slice(0, 200)
    if (!t) return
    const s = useRealtime.getState()
    const cid = `local-${seq++}`
    const me = s.me ?? 'me'
    const msg: ChatMsg = { id: cid, from: me, name: hello?.name ?? 'Me', text: t, mentions: [], ts: Date.now(), pending: true }
    useRealtime.setState({ chat: [...s.chat, msg].slice(-80), bubbles: { ...s.bubbles, [me]: msg } })
    if (!out({ t: 'chat', text: t, cid })) useRealtime.setState({ notice: 'Chat is offline right now.', chat: useRealtime.getState().chat.filter((x) => x.id !== cid) })
  },
  block(id: string, on = true) {
    const s = useRealtime.getState()
    const blocked = on ? [...new Set([...s.blocked, id])] : s.blocked.filter((x) => x !== id)
    const peers = { ...s.peers }
    delete peers[id]
    useRealtime.setState({ blocked, peers: on ? peers : s.peers, chat: on ? s.chat.filter((c) => c.from !== id) : s.chat })
    out({ t: 'block', id, on })
  },
  mute(id: string, on = true) {
    const s = useRealtime.getState()
    useRealtime.setState({ muted: on ? [...new Set([...s.muted, id])] : s.muted.filter((x) => x !== id), chat: on ? s.chat.filter((c) => c.from !== id) : s.chat })
  },
  report(id: string, reason: string, text = '') {
    out({ t: 'report', id, reason, text })
    realtime.block(id, true)
  },
  clearNotice() {
    useRealtime.setState({ notice: null })
  },
  clearPings() {
    useRealtime.setState({ pings: [] })
  },
}
