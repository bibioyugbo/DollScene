/**
 * End-to-end test of the authoritative game logic (the same handlers Cloud
 * Functions and the offline backend run) against an in-memory database.
 *
 *   npm run test:logic
 */
const assert = require('node:assert/strict')
const path = require('node:path')
const lib = path.resolve(__dirname, '../functions/lib/shared')
const { handlers } = require(`${lib}/server/handlers.js`)
const { applyMerge, applyUpdate, resolveOps } = require(`${lib}/fieldOps.js`)
const { runQuery } = require(`${lib}/query.js`)
const { CATALOG } = require(`${lib}/catalog.js`)
const { STARTER_JOBS } = require(`${lib}/careers.js`)
const { starterAppearance } = require(`${lib}/starters.js`)

const docs = new Map()
const parent = (p) => p.slice(0, p.lastIndexOf('/'))
function apply(ops) {
  for (const op of ops) {
    if (op.type === 'set') docs.set(op.path, resolveOps(op.data))
    else if (op.type === 'merge') docs.set(op.path, applyMerge(docs.get(op.path) ?? null, op.data))
    else if (op.type === 'update') {
      if (!docs.has(op.path)) throw new Error(`update missing ${op.path}`)
      docs.set(op.path, applyUpdate(docs.get(op.path), op.data))
    } else docs.delete(op.path)
  }
}
const db = {
  async transaction(fn) {
    const ops = []
    let wrote = false
    const tx = {
      async get(p) {
        if (wrote) throw new Error('read after write in transaction (Firestore forbids this)')
        return docs.has(p) ? structuredClone(docs.get(p)) : null
      },
      set: (p, d) => ((wrote = true), ops.push({ type: 'set', path: p, data: d })),
      update: (p, d) => ((wrote = true), ops.push({ type: 'update', path: p, data: d })),
      merge: (p, d) => ((wrote = true), ops.push({ type: 'merge', path: p, data: d })),
      delete: (p) => ((wrote = true), ops.push({ type: 'delete', path: p })),
    }
    const r = await fn(tx)
    apply(ops)
    return r
  },
  async get(p) {
    return docs.has(p) ? structuredClone(docs.get(p)) : null
  },
  async query(col, q) {
    return structuredClone(runQuery([...docs.entries()].filter(([k]) => parent(k) === col).map(([, v]) => v), q))
  },
  async set(p, d) {
    apply([{ type: 'set', path: p, data: d }])
  },
  async merge(p, d) {
    apply([{ type: 'merge', path: p, data: d }])
  },
  async delete(p) {
    apply([{ type: 'delete', path: p }])
  },
}

let clock = Date.UTC(2026, 9, 8, 9, 0, 0)
let n = 0
const call = (uid, name, input = {}) => handlers[name]({ db, uid, now: clock, newId: () => `id${++n}` }, input)
const expectError = async (p, code) => {
  try {
    await p
  } catch (e) {
    assert.equal(e.code, code, `expected ${code}, got ${e.code}: ${e.message}`)
    return
  }
  assert.fail(`expected error ${code}`)
}
const step = (msg) => console.log(`  ✓ ${msg}`)

;(async () => {
  console.log('DollScene game logic')
  // A legacy random demo doll from an older build gets retired.
  await db.set('publicDolls/demo-01', { uid: 'demo-01', isDemo: true })
  const seeded = await call('system', 'seedDemo')
  assert.equal(seeded.seeded, 16)
  const { BOT_COUNT } = require(`${lib}/bots.js`)
  assert.equal(seeded.bots, BOT_COUNT)
  assert.equal((await db.get('publicDolls/bot-0')).kind, 'npc', 'background bots are labelled residents')
  assert.equal(seeded.retired, 1)
  assert.equal(await db.get('publicDolls/demo-01'), null)
  assert.equal((await call('system', 'seedDemo')).seeded, 0)
  const npc = await db.get('publicDolls/npc-temi')
  assert.equal(npc.kind, 'npc')
  assert.ok(npc.npc.lore && npc.username === 'temi.styles')
  assert.equal(await db.get('users/npc-temi'), null, 'NPCs never get user accounts')
  step(`seeds 16 named NPC residents + ${BOT_COUNT} background bots worldwide (all kind: npc) and retires legacy demo dolls`)

  const iso = (yearsAgo, extraDays = 0) => new Date(clock - extraDays * 86400000).toISOString().slice(0, 10).replace(/^\d{4}/, (y) => String(+y - yearsAgo))
  await expectError(call('alice', 'bootstrapUser', { email: 'a@x.com', acceptTerms: true }), 'age-required')
  await expectError(call('alice', 'bootstrapUser', { email: 'a@x.com', dob: iso(17), acceptTerms: true }), 'underage')
  await expectError(call('alice', 'bootstrapUser', { email: 'a@x.com', dob: iso(18, -1), acceptTerms: true }), 'underage')
  await expectError(call('alice', 'bootstrapUser', { email: 'a@x.com', dob: '2001-02-30', acceptTerms: true }), 'age-required')
  await expectError(call('alice', 'bootstrapUser', { email: 'a@x.com', dob: iso(25) }), 'terms-required')
  const boot = await call('alice', 'bootstrapUser', { email: 'a@x.com', dob: iso(25), acceptTerms: true })
  assert.ok(STARTER_JOBS.includes(boot.starterJob))
  assert.equal((await db.get('users/alice')).dob, iso(25))
  const fresh = await db.get('apartments/alice')
  assert.ok(fresh.items.length >= 7, 'crib starts furnished: mat, rug, beanbag, side table, plant, Ghana Must Go (+ maybe a pet)')
  assert.ok(fresh.items.some((i) => i.itemId === 'starter-gmg'), 'every starter home has a Ghana Must Go')
  const freshInv = await db.get('inventory/alice')
  for (const i of fresh.items) assert.equal(freshInv.items[i.itemId], 1, `owns placed ${i.itemId}`)
  assert.deepEqual(await call('alice', 'furnishStarterHome'), { added: 0 }, 'new homes are already furnished')
  assert.equal(fresh.luggage.length, 7, 'the truck brings 7 bags, suitcases and boxes')
  assert.equal(fresh.movedIn, false)
  step(`DOB-based 18+ check on the server (17, one-day-short and invalid dates rejected); starter job ${boot.starterJob}`)

  const look = starterAppearance('ada')
  look.hair.edges = { style: 'swoop', density: 0.8, swirl: 0.7 }
  look.hair.dye = { mode: 'ombre', color2: '#C9A227', gloss: 0.6 }
  look.piercings.push({ id: 'p1', site: 'helix', side: 'left', jewellery: 'hoop', metal: 'gold', gem: 'none', size: 0.4 })
  look.tattoos.push({ id: 't1', region: 'forearm-l', design: 'gye-nyame', size: 0.5, rotation: 0, opacity: 0.9, mirror: false, color: null, layer: 0, temporary: false })
  await expectError(call('alice', 'completeOnboarding', { name: 'Ada', username: 'temi.styles', appearance: look, city: 'Lagos', country: 'Nigeria' }), 'username-taken')
  await expectError(call('alice', 'completeOnboarding', { name: 'Ada', username: 'a', appearance: look, city: 'Lagos', country: 'Nigeria' }), 'invalid-argument')
  await call('alice', 'completeOnboarding', { name: 'Ada', username: 'ada.lagos', bio: 'Hi', aesthetics: ['streetwear', 'nope'], appearance: look, city: 'Lagos', country: 'Nigeria', portrait: null })
  const doll = await db.get('dolls/alice')
  assert.equal(doll.appearance.hair.edges.style, 'swoop')
  assert.equal(doll.appearance.piercings.length, 1)
  assert.equal(doll.appearance.tattoos.length, 1)
  const pub = await db.get('publicDolls/alice')
  assert.equal(pub.city, 'Lagos')
  assert.ok(Math.abs(pub.lat - 6.524) < 0.2 && pub.lat !== 6.524, 'pin is jittered within the city')
  const glam0 = (await db.get('playerProgress/alice')).dollies
  const opened = await call('alice', 'unpackLuggage', { id: 'gmg-1' })
  assert.ok(opened.items.length > 0)
  assert.ok((await db.get('inventory/alice')).items[opened.items[0]] >= 1, 'unpacked clothes land in the wardrobe')
  await expectError(call('alice', 'unpackLuggage', { id: 'gmg-1' }), 'invalid-argument')
  for (const id of ['gmg-2', 'suitcase-1', 'suitcase-2', 'box-1', 'box-2', 'box-3']) await call('alice', 'unpackLuggage', { id })
  const unpacked = await db.get('apartments/alice')
  assert.equal(unpacked.luggage.length, 0)
  assert.equal(unpacked.movedIn, true)
  assert.equal((await db.get('playerProgress/alice')).dollies, glam0 + 7 * 15)
  assert.ok((await db.get('inventory/alice')).items['starter-rack'] >= 1, 'furniture from boxes goes to the tray')
  step('move-in day: 7 pieces of luggage unpack into wardrobe and furniture tray, +15 Glam each, once only')
  const apt = await db.get('apartments/alice')
  assert.equal(pub.username, 'ada.lagos')
  assert.deepEqual(pub.aesthetics, ['streetwear'])
  assert.equal(pub.kind, 'player')
  assert.equal((await db.get('usernames/ada.lagos')).uid, 'alice')
  step('onboarding saves edges, dye, piercing, tattoo, unique @username; city-level jittered pin')

  const bed = CATALOG.find((i) => i.furniture?.template === 'bed-single')
  const plant = CATALOG.find((i) => i.furniture?.template === 'plant-small')
  await call('alice', 'purchase', { itemIds: [bed.id, plant.id] })
  await call('alice', 'saveApartment', {
    items: [...apt.items, { id: 'b1', itemId: bed.id, x: -1.8, z: 0.6, rot: 0 }, { id: 'pl1', itemId: plant.id, x: 2.6, z: -1.6, rot: 0 }],
  })
  assert.equal((await db.get('apartments/alice')).items.length, apt.items.length + 2)
  await call('alice', 'saveLayout', { name: 'Party mode' })
  assert.equal((await db.get('apartments/alice')).layouts.length, 1)
  await call('alice', 'setFavourite', { itemId: bed.id, favourite: true })
  assert.deepEqual((await db.get('outfits/alice')).favourites, [bed.id])
  await expectError(call('alice', 'saveApartment', { items: [{ id: 'x', itemId: bed.id, x: 0, z: 0, rot: 0 }, { id: 'y', itemId: bed.id, x: 0.2, z: 0, rot: 0 }] }), 'not-owned')
  await expectError(call('alice', 'saveApartment', { items: [{ id: 'x', itemId: bed.id, x: 9, z: 0, rot: 0 }] }), 'invalid-argument')
  step('buys and places furniture; ownership and bounds enforced; saved layouts and favourites')

  const nigerian = CATALOG.find((i) => i.brandId === 'ankara-house' && i.slot === 'top')
  await expectError(call('alice', 'saveAppearance', { appearance: { ...doll.appearance, outfit: { ...doll.appearance.outfit, top: nigerian.id } } }), 'not-owned')
  await call('alice', 'purchase', { itemIds: [nigerian.id] })
  const saved = await call('alice', 'saveAppearance', { appearance: { ...doll.appearance, outfit: { ...doll.appearance.outfit, top: nigerian.id } } })
  assert.equal(saved.charged, 0)
  assert.equal((await db.get('dolls/alice')).appearance.outfit.top, nigerian.id)
  const prog0 = await db.get('playerProgress/alice')
  assert.equal(prog0.objectives['o-first-look'], 'done')
  step(`buys and wears a Nigerian-brand outfit (${nigerian.name})`)

  const { RENT_MIN_PRICE, rentPrice } = require(`${lib}/economy.js`)
  const fancy = CATALOG.find((i) => i.slot === 'dress' && i.price >= RENT_MIN_PRICE && !i.id.startsWith('starter-'))
  const g0 = (await db.get('playerProgress/alice')).dollies
  await call('alice', 'rentItem', { itemId: fancy.id, days: 1 })
  assert.equal((await db.get('playerProgress/alice')).dollies, g0 - rentPrice(fancy.price, 1))
  const rentedLook = { ...doll.appearance, outfit: { ...doll.appearance.outfit, top: null, bottom: null, dress: fancy.id } }
  await call('alice', 'saveAppearance', { appearance: rentedLook })
  assert.equal((await db.get('dolls/alice')).appearance.outfit.dress, fancy.id)
  clock += 2 * 86400000
  await expectError(call('alice', 'saveAppearance', { appearance: rentedLook }), 'not-owned')
  await call('alice', 'saveAppearance', { appearance: { ...doll.appearance, outfit: { ...doll.appearance.outfit, top: nigerian.id } } })
  step(`Rent a Fit: ${fancy.name} for 1 day at ${rentPrice(fancy.price, 1)} Glam, wearable until it expires`)

  const before = (await db.get('playerProgress/alice')).dollies
  const { shift } = await call('alice', 'startShift')
  const cheat = await call('alice', 'completeShift', { shiftId: shift.id, score: 100 })
  assert.equal(cheat.dollies, before, 'an instant finish pays nothing')
  clock += 4 * 60 * 1000
  const s2 = await call('alice', 'startShift')
  clock += 20 * 1000
  const paid = await call('alice', 'completeShift', { shiftId: s2.shift.id, score: 90 })
  assert.ok(paid.dollies > before, 'shift paid Dollies')
  await expectError(call('alice', 'startShift'), 'cooldown')
  step(`starter job pays (+${paid.dollies - before} Glam); instant-finish pays nothing; cooldown enforced`)

  await expectError(call('alice', 'changeCareer', { careerId: 'model' }), 'career-locked')
  for (let d = 1; d <= 5; d++) {
    clock += 86400000
    await call('alice', 'recordSession')
  }
  await expectError(call('alice', 'changeCareer', { careerId: 'model' }), 'career-locked')
  clock += 86400000
  await call('alice', 'recordSession')
  assert.equal((await db.get('playerProgress/alice')).distinctPlayDays, 7)
  await call('alice', 'changeCareer', { careerId: 'model' })
  assert.equal((await db.get('playerProgress/alice')).career.id, 'model')
  step('career change blocked until 7 distinct play days, then allowed')

  await call('bob', 'bootstrapUser', { email: 'b@x.com', dob: iso(30), acceptTerms: true })
  await call('bob', 'completeOnboarding', { name: 'Tunde', username: 'tunde', appearance: starterAppearance('tunde'), city: 'Accra', country: 'Ghana', privacy: { dms: 'friends' } })
  await expectError(call('alice', 'openConversation', { with: 'bob' }), 'dms-closed')
  await call('bob', 'saveAppearance', { appearance: (await db.get('dolls/bob')).appearance, privacy: { dms: 'everyone', showLocation: false } })
  const hidden = await db.get('publicDolls/bob')
  assert.equal(hidden.city, '')
  assert.equal(hidden.lat, 0)
  step('privacy: friends-only DMs enforced; hiding location removes the city and globe pin')
  const pre = await call('alice', 'openConversation', { with: 'bob' })
  assert.equal(pre.status, 'request', 'non-friends land in message requests')
  await call('alice', 'sendFriendRequest', { to: 'bob', note: 'Love your fit!' })
  await expectError(call('alice', 'sendFriendRequest', { to: 'bob' }), 'already-sent')
  assert.ok((await db.query('notifications/bob/items')).some((x) => x.type === 'friend-request'))
  await call('bob', 'respondFriendRequest', { from: 'alice', action: 'accept' })
  assert.ok(await db.get('friendships/alice_bob'))
  assert.deepEqual((await db.get('friendLists/alice')).uids, ['bob'])
  assert.ok((await db.query('notifications/alice/items')).some((x) => x.type === 'friend-accepted'))
  assert.ok((await db.query('notifications/bob/items')).some((x) => x.type === 'friend-accepted'))
  assert.equal((await db.get('conversations/alice_bob')).status, 'active', 'request chat becomes active once friends')
  step('friend request with note → accept → both notified → chat unlocked')

  const bobDoll = (await db.get('dolls/bob')).appearance
  await call('bob', 'saveAppearance', { appearance: { ...bobDoll, identity: { ...bobDoll.identity, datingPreference: 'Not dating' } } })
  const { levelOf } = require(`${lib}/levels.js`)
  assert.ok(levelOf((await db.get('playerProgress/alice')).xp).level < 3)
  await expectError(call('alice', 'inviteOuting', { to: 'bob', place: 'landmark-beach', kind: 'friendship' }), 'level-locked')
  await expectError(call('alice', 'attendParty', { place: 'owambe-vi' }), 'level-locked')
  for (const u of ['alice', 'bob']) {
    const pg = await db.get(`playerProgress/${u}`)
    await db.set(`playerProgress/${u}`, { ...pg, xp: 450 })
  }
  assert.equal(levelOf(450).level, 3)
  const g1 = (await db.get('playerProgress/alice')).dollies
  assert.equal((await call('alice', 'attendParty', { place: 'owambe-vi' })).reward, 40)
  assert.equal((await call('alice', 'attendParty', { place: 'owambe-vi' })).reward, 0, 'one reward per party per day')
  await expectError(call('alice', 'attendParty', { place: 'landmark-beach' }), 'invalid-argument')
  assert.equal((await db.get('playerProgress/alice')).dollies, g1 + 40)
  assert.equal((await db.get('playerProgress/alice')).xp, 490, 'earned Glam is XP')
  step('levels: dates and parties locked below level 3; parties pay once a day; Glam earned = XP')
  await expectError(call('alice', 'inviteOuting', { to: 'bob', place: 'landmark-beach', kind: 'romantic' }), 'not-dating')
  await expectError(call('alice', 'inviteOuting', { to: 'bob', place: 'balogun', kind: 'friendship' }), 'invalid-argument')
  const date = await call('alice', 'inviteOuting', { to: 'bob', place: 'landmark-beach', kind: 'friendship' })
  assert.equal(date.status, 'pending')
  const bobGlam = (await db.get('playerProgress/bob')).dollies
  await call('bob', 'respondOuting', { id: date.id, accept: true })
  assert.equal((await db.get(`outings/${date.id}`)).status, 'accepted')
  assert.equal((await db.get('playerProgress/bob')).dollies, bobGlam + 30)
  const resident = (await db.query('publicDolls', { where: [['kind', '==', 'npc']] }))[0]
  assert.equal((await call('alice', 'inviteOuting', { to: resident.uid, place: 'ikoyi-rooftop', kind: 'romantic' })).status, 'accepted', 'residents say yes')
  step('dates: romantic blocked when not dating, friendship date accepted (+30 Glam), residents say yes, non-friends refused')

  await call('bob', 'block', { uid: 'alice' })
  assert.equal(await db.get('friendships/alice_bob'), null)
  await expectError(call('alice', 'sendFriendRequest', { to: 'bob' }), 'blocked')
  await expectError(call('alice', 'inviteOuting', { to: 'bob', place: 'lekki-bridge', kind: 'friendship' }), 'not-friends')
  step('block removes friendship and stops requests')

  const { currentChallenges } = require(`${lib}/challenges.js`)
  const run = currentChallenges(clock)[0]
  await call('alice', 'ensureChallengeNpcEntries', { challengeKey: run.key })
  const npcEntries = await db.query('challengeEntries', { where: [['challengeKey', '==', run.key], ['kind', '==', 'npc']] })
  assert.equal(npcEntries.length, 5)
  const entered = await call('alice', 'enterChallenge', { challengeKey: run.key, caption: 'Serving' })
  assert.equal(entered.reward, 40)
  assert.equal((await call('alice', 'enterChallenge', { challengeKey: run.key })).reward, 0, 'participation pays once')
  await expectError(call('alice', 'voteChallenge', { entryId: entered.id }), 'invalid-argument')
  await call('alice', 'voteChallenge', { entryId: npcEntries[0].id })
  await expectError(call('alice', 'voteChallenge', { entryId: npcEntries[0].id }), 'already-voted')
  await expectError(call('alice', 'claimChallengePrize', { challengeKey: run.key }), 'invalid-argument')
  step('fashion challenges: NPC entries labelled, entry reward once, no self-votes, one vote per look')

  const p = await call('alice', 'createPost', { kind: 'look', caption: 'New fit' })
  await call('demo-01', 'toggleLike', { postId: p.id }).catch(() => undefined)
  const exp = await call('alice', 'exportData')
  assert.ok(exp.doll && exp.posts.length === 1)
  await call('alice', 'deleteAccount')
  assert.equal(await db.get('users/alice'), null)
  assert.equal(await db.get('publicDolls/alice'), null)
  step('data export and account deletion')

  console.log('\nAll game-logic checks passed.')
})().catch((e) => {
  console.error('\n✗', e)
  process.exit(1)
})
