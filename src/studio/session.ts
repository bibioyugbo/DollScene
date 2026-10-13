import { CHARACTER_PRESETS } from '../shared/studio/presets'
import { MAX_SAVED_LOOKS, type SavedLook } from '../shared/studio/look'
import { api, ApiError, readCache, writeCache } from './backend/api'
import { useStudio } from './state/store'
import { ERROR_TEXT, errorCode, isFramed, vatar, type VatarPurchase } from './vatar/sdk'

/**
 * Boot and sync. Identity comes only from Vatar.init(): the per-game player id keys our
 * server records (and the device cache). Outside Lagos Life the studio still opens, in a
 * clearly labelled preview that saves to this device only.
 */

const PREVIEW_ID = 'preview'
let started = false
let saveTimer: number | undefined

const cacheId = () => useStudio.getState().player?.id ?? PREVIEW_ID
const online = () => {
  const c = useStudio.getState().connection
  return c === 'live' || c === 'test'
}

function persistLocal(dirty: boolean) {
  const s = useStudio.getState()
  writeCache(cacheId(), { current: s.look, looks: s.saved, dirty })
}

let warned = false

async function pushCurrent() {
  const s = useStudio.getState()
  if (!online()) return persistLocal(s.connection === 'offline')
  try {
    await api.saveCurrent(s.look)
    persistLocal(false)
    warned = false
  } catch (e) {
    persistLocal(true)
    if (e instanceof ApiError && e.code === 'offline') useStudio.setState({ connection: 'offline' })
    // say it once, not on every autosave
    if (!warned) s.notify('Couldn’t save your look to your profile. It’s kept on this device and we’ll retry.', 'error')
    warned = true
  }
}

/** Save the working look now (e.g. right after creating the doll), not on the debounce. */
export async function flushSave() {
  window.clearTimeout(saveTimer)
  await pushCurrent()
}

/** Keep the last valid look on this device (crash screen, page hide). Never throws. */
export function rescueLook() {
  try {
    const s = useStudio.getState()
    // an uncommitted preview is not the player's look: keep the one it started from
    writeCache(cacheId(), { current: s.editBase ?? s.look, looks: s.saved, dirty: s.connection === 'offline' })
  } catch {
    /* best effort */
  }
}

async function claim(p: VatarPurchase) {
  try {
    const { entitlements } = await api.claim(p.purchaseId)
    useStudio.setState({ entitlements })
    useStudio.getState().notify('Unlocked. Enjoy your new shades.')
  } catch (e) {
    // Not granted: the purchase stays undelivered and is offered again by purchases().
    useStudio.getState().notify(e instanceof ApiError && e.code === 'refunded' ? 'That purchase was refunded.' : 'We couldn’t confirm that purchase yet. We’ll try again.')
  }
}

export async function startSession() {
  if (started) return
  started = true
  const st = useStudio.setState

  // Pause/resume: the phone went to the background or the pay sheet opened.
  vatar.onPause(() => st({ paused: true }))
  vatar.onResume(() => st({ paused: false }))
  document.addEventListener('visibilitychange', () => st({ paused: document.hidden }))
  window.addEventListener('online', () => {
    if (useStudio.getState().connection === 'offline') void reconnect()
  })

  // Debounced autosave of the working look, after each committed change.
  useStudio.subscribe((s, prev) => {
    if (s.look === prev.look || s.editBase) return
    window.clearTimeout(saveTimer)
    saveTimer = window.setTimeout(pushCurrent, 1500)
  })

  if (!vatar.available() || !isFramed()) return enterPreview()

  try {
    const init = await vatar.init()
    st({ player: { id: init.player.id, name: init.player.name, avatar: init.player.avatar }, connection: init.mode })
  } catch (e) {
    return enterPreview(errorCode(e) === 'not_framed' ? undefined : ERROR_TEXT[errorCode(e)])
  }
  await reconnect()
  vatar.onPurchase((p) => void claim(p))
  try {
    for (const p of await vatar.purchases()) await claim(p)
  } catch {
    /* restored on next start */
  }
}

async function reconnect() {
  const st = useStudio.setState
  const s = useStudio.getState()
  const cache = s.player ? readCache(s.player.id) : null
  try {
    const remote = await api.me()
    const mode = remote.player.mode
    // A change made offline wins over the older server copy, then gets pushed.
    const current = cache?.dirty && cache.current ? cache.current : remote.current
    st({ connection: mode, saved: remote.looks, entitlements: remote.entitlements, xp: remote.xp, todayBest: remote.today.best })
    if (current) useStudio.setState({ look: current, before: current, past: [], future: [] })
    else useStudio.getState().replace(CHARACTER_PRESETS[0].look)
    if (cache?.dirty) void pushCurrent()
  } catch {
    st({ connection: 'offline', saved: cache?.looks ?? [] })
    if (cache?.current) st({ look: cache.current, before: cache.current })
    else useStudio.setState({ look: CHARACTER_PRESETS[0].look, before: CHARACTER_PRESETS[0].look })
    useStudio.getState().notify('Offline. Your changes are kept on this device until you reconnect.')
  }
}

function enterPreview(message?: string) {
  const cache = readCache(PREVIEW_ID)
  const look = cache?.current ?? CHARACTER_PRESETS[0].look
  useStudio.setState({ connection: 'preview', player: null, saved: cache?.looks ?? [], look, before: look })
  if (message) useStudio.getState().notify(message)
}

/* ------------------------------------------------------------------ actions */

const newId = () => `look-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`

export async function saveLook(name: string) {
  const s = useStudio.getState()
  if (s.saved.length >= MAX_SAVED_LOOKS) return s.notify(`Your lookbook holds ${MAX_SAVED_LOOKS} looks. Delete one first.`)
  const item: SavedLook = { id: newId(), name: name.trim() || `Look ${s.saved.length + 1}`, look: structuredClone(s.look), savedAt: Date.now() }
  useStudio.setState({ saved: [item, ...s.saved] })
  persistLocal(false)
  if (!online()) return s.notify(s.connection === 'preview' ? 'Look saved! ✨ (on this device, preview)' : 'Look saved! ✨ It syncs when you’re back online.', 'success')
  try {
    const { looks } = await api.saveLook(item)
    useStudio.setState({ saved: looks })
    persistLocal(false)
    s.notify('Look saved! ✨', 'success')
  } catch {
    s.notify('Couldn’t save your look to your profile. It’s kept on this device, try again later.', 'error')
  }
}

export async function deleteLook(id: string) {
  const s = useStudio.getState()
  useStudio.setState({ saved: s.saved.filter((l) => l.id !== id) })
  persistLocal(false)
  if (!online()) return
  try {
    const { looks } = await api.deleteLook(id)
    useStudio.setState({ saved: looks })
  } catch {
    /* kept deleted locally */
  }
}

export async function submitChallenge() {
  const s = useStudio.getState()
  if (!online()) {
    s.notify(s.connection === 'preview' ? ERROR_TEXT.not_framed : 'You’re offline. Submit when you reconnect.')
    return null
  }
  try {
    const r = await api.submitChallenge(s.look)
    useStudio.setState({ xp: r.xp, todayBest: r.best })
    // The leaderboard ranks influencer XP, which only our server hands out.
    vatar.submitScore(r.xp).catch((e) => {
      if (errorCode(e) !== 'too_soon') console.warn('submitScore', errorCode(e))
    })
    return r
  } catch {
    s.notify('Couldn’t reach the judges. Try again.')
    return null
  }
}

export async function buy(productId: string) {
  const s = useStudio.getState()
  if (!online()) return s.notify(s.connection === 'preview' ? ERROR_TEXT.not_framed : 'You’re offline.')
  try {
    const p = await vatar.purchase(productId)
    await claim(p)
  } catch (e) {
    const code = errorCode(e)
    if (code !== 'cancelled') s.notify(ERROR_TEXT[code])
  }
}
