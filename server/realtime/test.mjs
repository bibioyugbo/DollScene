import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { test } from 'node:test'
import WebSocket from 'ws'
import { bucket, cleanText, displayName, mentionsIn, tidy } from './moderation.mjs'

test('profanity is masked, innocent words are not', () => {
  assert.equal(cleanText('you are a b1tch'), 'you are a *****')
  assert.equal(cleanText('f u c k this'), '* * * * this')
  assert.equal(cleanText('fuuuuck'), '*******')
  assert.equal(cleanText('a cocktail at the classic party, this hit'), 'a cocktail at the classic party, this hit')
  assert.equal(cleanText('Love your hair!'), 'Love your hair!')
  assert.equal(cleanText('mumu'), '****')
})

test('mentions, names and tidy text', () => {
  assert.deepEqual(mentionsIn('@Bibi hey @ada_2 and @Bibi'), ['bibi', 'ada_2'])
  assert.equal(displayName('  Bibi  '), 'Bibi')
  assert.equal(displayName('sh1t'), 'Doll')
  assert.equal(tidy('a\u0007b‮c   d', 10), 'abc d')
})

test('rate limit bucket', () => {
  const b = bucket(2, 1)
  const t = Date.now()
  assert.ok(b.take(t))
  assert.ok(b.take(t))
  assert.ok(!b.take(t))
  assert.ok(b.take(t + 1100))
})

function open(port) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/realtime`)
  const inbox = []
  const waiters = []
  ws.on('message', (d) => {
    const m = JSON.parse(d.toString())
    inbox.push(m)
    for (const w of [...waiters]) if (w.pred(m)) (waiters.splice(waiters.indexOf(w), 1), w.res(m))
  })
  return {
    ws,
    ready: new Promise((r) => ws.on('open', r)),
    send: (m) => ws.send(JSON.stringify(m)),
    next: (pred, ms = 3000) =>
      new Promise((res, rej) => {
        const hit = inbox.find(pred)
        if (hit) return (inbox.splice(inbox.indexOf(hit), 1), res(hit))
        waiters.push({ pred, res })
        setTimeout(() => rej(new Error('timeout')), ms)
      }),
  }
}

test('presence, counts, chat, mentions, block, 18+', async (t) => {
  const port = 18000 + Math.floor(Math.random() * 2000)
  const srv = spawn(process.execPath, ['index.mjs'], { env: { ...process.env, PORT: String(port), ALLOW_GUESTS: '1' }, cwd: new URL('.', import.meta.url).pathname })
  t.after(() => srv.kill())
  await new Promise((r) => srv.stdout.on('data', (d) => d.toString().includes('realtime on') && r()))

  // under-18 (not confirmed): refused
  const kid = open(port)
  await kid.ready
  kid.send({ t: 'hello', name: 'Kid', adult: false })
  assert.equal((await kid.next((m) => m.t === 'error')).code, 'adult_only')

  const a = open(port)
  const b = open(port)
  await Promise.all([a.ready, b.ready])
  a.send({ t: 'hello', name: 'Bibi', adult: true, channel: 'scene:prom2016', look: { v: 2 } })
  const wa = await a.next((m) => m.t === 'welcome')
  b.send({ t: 'hello', name: 'Ada', adult: true, channel: 'hub' })
  const wb = await b.next((m) => m.t === 'welcome')
  const counts = await b.next((m) => (m.t === 'counts' || m.t === 'roster') && (m.c ?? m.counts)?.['scene:prom2016'] === 1)
  assert.ok(counts)
  assert.equal((counts.c ?? counts.counts)['door:scenes'], 1)

  // b joins the scene: a sees the join, b gets a's doll in the roster
  b.send({ t: 'join', channel: 'scene:prom2016' })
  const roster = await b.next((m) => m.t === 'roster' && m.channel === 'scene:prom2016')
  assert.equal(roster.peers.length, 1)
  assert.equal(roster.peers[0].name, 'Bibi')
  assert.equal((await a.next((m) => m.t === 'join')).peer.name, 'Ada')

  // state sync is batched
  a.send({ t: 'state', s: { x: 1, z: 2, ry: 0.5, pose: 'wave', expr: 'smile' } })
  const st = await b.next((m) => m.t === 'states')
  assert.equal(st.list[0][0], wa.you)
  assert.equal(st.list[0][1].pose, 'wave')

  // public chat with a mention, profanity masked, optimistic id echoed to the sender
  a.send({ t: 'chat', text: '@Ada love the dress, sh1t that’s cute', cid: 'c1' })
  const got = await b.next((m) => m.t === 'chat')
  assert.deepEqual(got.mentions, [wb.you])
  assert.ok(got.text.includes('****'))
  assert.equal((await a.next((m) => m.t === 'chat')).cid, 'c1')

  // rate limit: a burst gets slowed down
  for (let i = 0; i < 6; i++) a.send({ t: 'chat', text: `hi ${i}`, cid: `x${i}` })
  assert.equal((await a.next((m) => m.t === 'notice' && m.kind === 'slow')).kind, 'slow')

  // block: b no longer receives a's chat
  b.send({ t: 'block', id: wa.you, on: true })
  await new Promise((r) => setTimeout(r, 2000))
  a.send({ t: 'chat', text: 'are you there?', cid: 'c9' })
  await a.next((m) => m.t === 'chat' && m.cid === 'c9')
  await assert.rejects(b.next((m) => m.t === 'chat' && m.text === 'are you there?', 800))

  a.ws.close()
  b.ws.close()
  kid.ws.close()
})
