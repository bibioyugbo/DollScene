/** 18. A failed save keeps the look on the device and tells the player once. */
import assert from 'node:assert/strict'
import { test } from 'node:test'

const store = new Map<string, string>()
Object.assign(globalThis, {
  window: { Vatar: { session: async () => ({ session: 'test-session', exp: Date.now() + 3_600_000 }) }, parent: null, setTimeout, clearTimeout },
  localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) },
  fetch: async () => {
    throw new TypeError('network down')
  },
})

test('18. a save request that fails keeps the look locally, goes offline and warns once', async () => {
  const { useStudio } = await import('../../src/studio/state/store')
  const { flushSave, rescueLook } = await import('../../src/studio/session')
  useStudio.setState({ connection: 'live', player: { id: 'p_test', name: 'Tester', avatar: null }, toasts: [] })
  useStudio.getState().apply((l) => void (l.makeup.lipstick.amount = 0.77))
  await flushSave()
  const s = useStudio.getState()
  assert.equal(s.connection, 'offline')
  const errors = s.toasts.filter((t) => t.tone === 'error')
  assert.equal(errors.length, 1)
  assert.match(errors[0].text, /Couldn’t save your look/)
  assert.ok(!s.toasts.some((t) => t.tone === 'success'), 'no success toast when the save failed')
  const cached = JSON.parse(store.get('dollscene-studio:p_test')!)
  assert.equal(cached.current.makeup.lipstick.amount, 0.77)
  assert.equal(cached.dirty, true, 'marked to push when back online')
  // a crash/page-hide rescue keeps the confirmed look, not an uncommitted preview
  useStudio.getState().preview((l) => void (l.makeup.lipstick.amount = 0.1))
  rescueLook()
  assert.equal(JSON.parse(store.get('dollscene-studio:p_test')!).current.makeup.lipstick.amount, 0.77)
})
