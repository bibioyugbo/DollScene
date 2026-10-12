/**
 * Authoritative game logic. Runs inside Cloud Functions in production and
 * inside the local backend in offline/demo mode. Clients never write money,
 * inventory, careers or friendships directly.
 */
import { collides, defaultApartment, findSpot, inBounds, placedCounts, starterHomeItems } from '../apartment'
import {
  appearanceBill,
  avatarSummary,
  billTotal,
  outfitItemsToOwn,
  outfitSummary,
  sanitizeAppearance,
  sanitizeHair,
} from '../appearance'
import { CATALOG, getItem, isStarterItem } from '../catalog'
import { CAREERS, careerTitle, levelFor, shiftPay, STARTER_JOBS } from '../careers'
import { findCity, jitteredPlace, type City } from '../cities'
import { ageFromDob, MIN_AGE } from '../age'
import { AESTHETIC_LABEL, isAesthetic } from '../aesthetics'
import { CHALLENGE_REWARDS, challengeEnded, currentChallenges, VOTES_PER_DAY } from '../challenges'
import { generateNpcWorld, NPC_DEFS } from '../npcs'
import { generateBots } from '../bots'
import { BALCONY_LEVEL, levelOf, pendingLevelRewards, SOCIAL_UNLOCK_LEVEL } from '../levels'
import { LUGGAGE_BY_ID, UNPACK_REWARD } from '../movein'
import { OUTING_REWARD, PARTY_REWARD, PLACE_BY_ID } from '../places'
import {
  APARTMENT_TIERS,
  CAREER_UNLOCK_DAYS,
  dayKey,
  FAME_POINTS,
  FRIEND_REQUEST_DAILY_LIMIT,
  NOTE_MAX_CHARS,
  RENT_MIN_PRICE,
  rentPrice,
  type RentDays,
  SELL_BACK_RATE,
  SHIFT_COOLDOWN_MS,
  SHIFT_DAILY_LIMIT,
  SHIFT_MAX_MS,
  SHIFT_MIN_MS,
  STARTING_DOLLIES,
  STARTING_GEMS,
  TIER_BY_ID,
  weekKey,
} from '../economy'
import { arrayRemove, arrayUnion, inc } from '../fieldOps'
import { applyEvent, MISSION_BY_ID, missionState, rollPeriods, type GameEvent } from '../missions'
import { C, P, pairId } from '../paths'
import type {
  ApartmentDoc,
  BlockDoc,
  CareerId,
  ChallengeEntryDoc,
  CommentDoc,
  ConversationDoc,
  DollDoc,
  FacePreset,
  FriendRequestDoc,
  FriendshipDoc,
  InventoryDoc,
  NotificationDoc,
  OutingDoc,
  OutfitPreset,
  OutfitsDoc,
  PlacedItem,
  PostDoc,
  PostKind,
  PrivacySettings,
  ProgressDoc,
  PublicDoll,
  ReportDoc,
  ReportTarget,
  SavedLayout,
  TransactionDoc,
  UserDoc,
} from '../types'
import { GameError, type HandlerContext, type ServerTx } from './db'

/* ------------------------------------------------------------------ helpers */

const RESERVED = new Set(['admin', 'dollscene', 'support', 'moderator', 'mod', 'staff', 'system', ...NPC_DEFS.map((n) => n.username)])

export function normalizeUsername(v: unknown): string {
  const u = typeof v === 'string' ? v.trim().toLowerCase().replace(/^@/, '') : ''
  if (!/^[a-z0-9](?:[a-z0-9._]{1,18})[a-z0-9]$/.test(u)) throw new GameError('invalid-argument', 'Usernames are 3 to 20 letters, numbers, dots or underscores.')
  if (RESERVED.has(u)) throw new GameError('username-taken', `@${u} is taken. Try another.`)
  return u
}

function sanitizePrivacy(p: Partial<PrivacySettings> | undefined): PrivacySettings {
  return {
    showLocation: p?.showLocation !== false,
    showOnline: p?.showOnline !== false,
    dms: p?.dms === 'friends' ? 'friends' : 'everyone',
  }
}

/** Public location: a jittered city pin, or nothing at all when hidden. */
function placeFor(city: City, show: boolean) {
  return show ? jitteredPlace(city) : { city: '', country: '', region: city.region, lat: 0, lng: 0 }
}

async function need<T>(tx: ServerTx, path: string, what = 'Document'): Promise<T> {
  const doc = await tx.get<T>(path)
  if (!doc) throw new GameError('not-found', `${what} not found.`)
  return doc
}

function notify(
  tx: ServerTx,
  ctx: HandlerContext,
  to: string,
  n: Pick<NotificationDoc, 'type' | 'text'> & Partial<Pick<NotificationDoc, 'fromUid' | 'fromName' | 'link'>>,
) {
  const id = ctx.newId()
  const doc: NotificationDoc = {
    id,
    uid: to,
    type: n.type,
    text: n.text,
    fromUid: n.fromUid ?? null,
    fromName: n.fromName ?? null,
    link: n.link ?? null,
    read: false,
    createdAt: ctx.now,
  }
  tx.set(P.notification(to, id), doc)
}

function ledger(tx: ServerTx, ctx: HandlerContext, amount: number, reason: string, currency: 'dollies' | 'gems' = 'dollies') {
  if (!amount) return
  const doc: TransactionDoc = { uid: ctx.uid, amount, currency, reason, createdAt: ctx.now }
  tx.set(P.transaction(ctx.newId()), doc)
}

function spend(p: ProgressDoc, amount: number) {
  if (amount > p.dollies) throw new GameError('insufficient-funds', `You need ${amount - p.dollies} more Glam.`)
  p.dollies -= amount
}

function earn(p: ProgressDoc, amount: number, now: number) {
  p.dollies += amount
  if (amount > 0) {
    p.xp = (p.xp ?? 0) + amount
    applyEvent(p, 'earn', amount, now)
  }
}

function requireLevel(p: ProgressDoc, what: string) {
  const { level } = levelOf(p.xp ?? 0)
  if (level < SOCIAL_UNLOCK_LEVEL) throw new GameError('level-locked', `${what} unlock at level ${SOCIAL_UNLOCK_LEVEL}. You’re level ${level}: keep playing to level up.`)
}

function str(v: unknown, max: number): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : ''
}

function requireUid(v: unknown): string {
  if (typeof v !== 'string' || !/^[A-Za-z0-9-]{3,64}$/.test(v)) throw new GameError('invalid-argument', 'Unknown player.')
  return v
}

function newProgress(uid: string, now: number, rand: () => number): ProgressDoc {
  const starterJob = STARTER_JOBS[Math.floor(rand() * STARTER_JOBS.length)]
  return {
    uid,
    dollies: STARTING_DOLLIES,
    gems: STARTING_GEMS,
    levelRewarded: 1,
    career: { id: starterJob, level: 1, xp: 0, reputation: 0, startedAt: now },
    careerHistory: [],
    starterJob,
    distinctPlayDays: 1,
    lastPlayDay: dayKey(now),
    shifts: { day: dayKey(now), count: 0, lastAt: 0, active: null },
    daily: { key: dayKey(now), counts: { 'play-day': 1 }, claimed: [] },
    weekly: { key: weekKey(now), counts: { 'play-day': 1 }, claimed: [] },
    objectives: {},
    counters: { 'play-day': 1 },
    friendRequests: { day: dayKey(now), count: 0 },
    fame: 0,
    apartmentTier: 'studio',
    updatedAt: now,
  }
}

/** Reads needed to make two players friends. Do these before any write. */
async function readFriendshipContext(tx: ServerTx, a: string, b: string) {
  const [pa, pb, conv] = await Promise.all([
    tx.get<ProgressDoc>(P.progress(a)),
    tx.get<ProgressDoc>(P.progress(b)),
    tx.get<ConversationDoc>(P.conversation(pairId(a, b))),
  ])
  return { pa, pb, conv }
}

function writeFriendship(
  tx: ServerTx,
  ctx: HandlerContext,
  a: string,
  b: string,
  reads: Awaited<ReturnType<typeof readFriendshipContext>>,
) {
  const doc: FriendshipDoc = { id: pairId(a, b), members: [a, b], createdAt: ctx.now, favouriteOf: [] }
  tx.set(P.friendship(a, b), doc)
  tx.merge(P.friendList(a), { uid: a, uids: arrayUnion(b) })
  tx.merge(P.friendList(b), { uid: b, uids: arrayUnion(a) })
  tx.update(P.publicDoll(a), { friendCount: inc(1), fame: inc(FAME_POINTS.friend) })
  tx.update(P.publicDoll(b), { friendCount: inc(1), fame: inc(FAME_POINTS.friend) })
  for (const [uid, p] of [
    [a, reads.pa],
    [b, reads.pb],
  ] as const) {
    if (!p) continue
    applyEvent(p, 'friend', 1, ctx.now)
    p.fame += FAME_POINTS.friend
    p.updatedAt = ctx.now
    tx.set(P.progress(uid), p)
  }
  // A pending message request between friends becomes a normal chat.
  if (reads.conv && reads.conv.status === 'request') tx.update(P.conversation(reads.conv.id), { status: 'active' })
}

async function isBlockedEitherWay(tx: ServerTx, a: string, b: string): Promise<boolean> {
  const [x, y] = await Promise.all([tx.get<BlockDoc>(P.block(a, b)), tx.get<BlockDoc>(P.block(b, a))])
  return !!x || !!y
}

/* ----------------------------------------------------------------- handlers */

export const handlers = {
  /**
   * First sign-in: verify the date of birth (18+), then create the account,
   * wallet, starter job, closet basics and an empty apartment.
   */
  async bootstrapUser(ctx: HandlerContext, input: { email?: string | null; dob?: string; acceptTerms?: boolean }) {
    const age = ageFromDob(input.dob, ctx.now)
    return ctx.db.transaction(async (tx) => {
      const existing = await tx.get<UserDoc>(P.user(ctx.uid))
      if (existing) return { created: false, onboarded: existing.onboarded }
      if (age === null) throw new GameError('age-required', 'Enter your date of birth.')
      if (age < MIN_AGE) throw new GameError('underage', `${MIN_AGE}+ only. You can’t create an account yet.`)
      if (input.acceptTerms !== true) throw new GameError('terms-required', 'Please accept the Terms and Community Rules.')
      const user: UserDoc = {
        uid: ctx.uid,
        email: typeof input.email === 'string' ? input.email.slice(0, 200) : null,
        createdAt: ctx.now,
        ageConfirmed: true,
        dob: input.dob!,
        ageVerifiedAt: ctx.now,
        username: null,
        onboarded: false,
        starterChanges: 0,
      }
      const progress = newProgress(ctx.uid, ctx.now, Math.random)
      const inventory: InventoryDoc = {
        uid: ctx.uid,
        // The furnished starter home is already in; the move-in truck brings the rest.
        items: Object.fromEntries(starterHomeItems(ctx.uid).map((i) => [i.itemId, 1])),
      }
      const outfits: OutfitsDoc = { uid: ctx.uid, presets: [], favourites: [] }
      tx.set(P.user(ctx.uid), user)
      tx.set(P.progress(ctx.uid), progress)
      tx.set(P.inventory(ctx.uid), inventory)
      tx.set(P.outfits(ctx.uid), outfits)
      tx.set(P.apartment(ctx.uid), defaultApartment(ctx.uid, ctx.now))
      tx.set(P.friendList(ctx.uid), { uid: ctx.uid, uids: [] })
      ledger(tx, ctx, STARTING_DOLLIES, 'Welcome gift')
      return { created: true, onboarded: false, starterJob: progress.starterJob }
    })
  },

  /** Finish onboarding: name, username, city and the first look. Free. */
  async completeOnboarding(
    ctx: HandlerContext,
    input: {
      name: string
      username: string
      appearance: unknown
      city: string
      country: string
      portrait?: string | null
      bio?: string
      aesthetics?: string[]
      styleTag?: string
      privacy?: Partial<PrivacySettings>
    },
  ) {
    const name = str(input.name, 24)
    if (name.length < 2) throw new GameError('invalid-argument', 'Pick a name with at least 2 characters.')
    const username = normalizeUsername(input.username)
    const city = findCity(input.city, input.country)
    if (!city) throw new GameError('invalid-argument', 'Pick a city from the list.')
    const appearance = sanitizeAppearance(input.appearance)
    const privacy = sanitizePrivacy(input.privacy)
    // Onboarding looks may only use free starter pieces.
    for (const id of Object.values(appearance.outfit)) if (id && !isStarterItem(id)) throw new GameError('invalid-argument', 'Starter looks use starter pieces only.')
    return ctx.db.transaction(async (tx) => {
      const [user, progress, existingPublic, taken] = await Promise.all([
        need<UserDoc>(tx, P.user(ctx.uid), 'Account'),
        need<ProgressDoc>(tx, P.progress(ctx.uid), 'Progress'),
        tx.get<PublicDoll>(P.publicDoll(ctx.uid)),
        tx.get<{ uid: string }>(P.username(username)),
      ])
      if (taken && taken.uid !== ctx.uid) throw new GameError('username-taken', `@${username} is taken. Try another.`)
      const doll: DollDoc = { uid: ctx.uid, name, appearance, hairLooks: [], complexionPresets: [], facePresets: [], updatedAt: ctx.now }
      const pub: PublicDoll = {
        uid: ctx.uid,
        kind: 'player',
        name,
        username,
        bio: str(input.bio, 160),
        aesthetics: (input.aesthetics ?? []).filter(isAesthetic).slice(0, 4),
        badges: [],
        privacy,
        portrait: typeof input.portrait === 'string' ? input.portrait : null,
        avatar: avatarSummary(appearance),
        ...placeFor(city, privacy.showLocation),
        career: progress.career.id,
        careerLevel: progress.career.level,
        styleTag: input.styleTag ? str(input.styleTag, 24) : (existingPublic?.styleTag ?? 'New in town'),
        outfitSummary: outfitSummary(appearance.outfit),
        pronouns: appearance.identity.pronouns,
        fame: existingPublic?.fame ?? 0,
        followers: existingPublic?.followers ?? 0,
        following: existingPublic?.following ?? 0,
        friendCount: existingPublic?.friendCount ?? 0,
        online: true,
        lastActive: ctx.now,
        lastPostAt: existingPublic?.lastPostAt ?? 0,
        createdAt: existingPublic?.createdAt ?? ctx.now,
      }
      if (user.username && user.username !== username) tx.delete(P.username(user.username))
      tx.set(P.username(username), { uid: ctx.uid })
      tx.set(P.doll(ctx.uid), doll)
      tx.set(P.publicDoll(ctx.uid), pub)
      tx.update(P.user(ctx.uid), { onboarded: true, username, homeCity: { city: city.name, country: city.country } })
      return { ok: true, career: progress.career.id }
    })
  },

  /** Save edits from the customizer, wardrobe or profile settings. Charges for studio and Beauty Studio work. */
  async saveAppearance(
    ctx: HandlerContext,
    input: {
      appearance: unknown
      name?: string
      username?: string
      bio?: string
      aesthetics?: string[]
      privacy?: Partial<PrivacySettings>
      portrait?: string | null
      hairLooks?: unknown[]
      complexionPresets?: DollDoc['complexionPresets']
      facePresets?: unknown[]
      styleTag?: string
      city?: string
      country?: string
    },
  ) {
    const next = sanitizeAppearance(input.appearance)
    const wantedUsername = input.username !== undefined ? normalizeUsername(input.username) : null
    return ctx.db.transaction(async (tx) => {
      const [user, doll, progress, inventory, pub] = await Promise.all([
        need<UserDoc>(tx, P.user(ctx.uid), 'Account'),
        need<DollDoc>(tx, P.doll(ctx.uid), 'Doll'),
        need<ProgressDoc>(tx, P.progress(ctx.uid), 'Progress'),
        need<InventoryDoc>(tx, P.inventory(ctx.uid), 'Inventory'),
        need<PublicDoll>(tx, P.publicDoll(ctx.uid), 'Profile'),
      ])
      const taken = wantedUsername && wantedUsername !== user.username ? await tx.get<{ uid: string }>(P.username(wantedUsername)) : null
      if (taken && taken.uid !== ctx.uid) throw new GameError('username-taken', `@${wantedUsername} is taken. Try another.`)
      for (const id of outfitItemsToOwn(next.outfit)) {
        const rented = (inventory.rentals?.[id] ?? 0) > ctx.now
        if (!inventory.items[id] && !rented) throw new GameError('not-owned', `You don't own ${getItem(id)?.name ?? id} yet.`)
      }
      const premiumAccessories = new Set(
        CATALOG.filter((i) => i.unlock?.kind === 'hair-accessory').map((i) => (i.unlock as { id: string }).id),
      )
      const ownedAccessories = new Set(
        Object.keys(inventory.items)
          .map((id) => getItem(id)?.unlock)
          .filter((u) => u?.kind === 'hair-accessory')
          .map((u) => (u as { id: string }).id),
      )
      for (const acc of next.hair.accessories) {
        if (premiumAccessories.has(acc) && !ownedAccessories.has(acc) && !doll.appearance.hair.accessories.includes(acc)) {
          throw new GameError('not-owned', `Get the ${acc} kit at the shop first.`)
        }
      }
      const lines = appearanceBill(doll.appearance, next, user.starterChanges)
      const total = billTotal(lines)
      spend(progress, total)
      const newWorn = outfitItemsToOwn(next.outfit).filter((id) => !Object.values(doll.appearance.outfit).includes(id))
      if (newWorn.length) applyEvent(progress, 'wear', newWorn.length, ctx.now)
      applyEvent(progress, 'customize', 1, ctx.now)
      progress.updatedAt = ctx.now

      const name = input.name !== undefined ? str(input.name, 24) : doll.name
      if (name.length < 2) throw new GameError('invalid-argument', 'Pick a name with at least 2 characters.')
      const hairLooks = Array.isArray(input.hairLooks)
        ? input.hairLooks.slice(0, 12).map((h, i) => {
            const raw = h as { id?: string; name?: string }
            return { ...sanitizeHair(h as never), id: str(raw.id, 40) || `look-${i}`, name: str(raw.name, 24) || `Look ${i + 1}` }
          })
        : doll.hairLooks
      const complexionPresets = Array.isArray(input.complexionPresets) ? input.complexionPresets.slice(0, 8) : doll.complexionPresets
      const facePresets: FacePreset[] = Array.isArray(input.facePresets)
        ? input.facePresets.slice(0, 8).map((f, i) => {
            const raw = f as Partial<FacePreset>
            const clean = sanitizeAppearance({ face: raw.face, skin: raw.skin, makeup: raw.makeup })
            return { id: str(raw.id, 40) || `face-${i}`, name: str(raw.name, 24) || `Face ${i + 1}`, face: clean.face, skin: clean.skin, makeup: clean.makeup }
          })
        : (doll.facePresets ?? [])

      tx.set(P.doll(ctx.uid), { ...doll, name, appearance: next, hairLooks, complexionPresets, facePresets, updatedAt: ctx.now })
      const pubPatch: Record<string, unknown> = {
        name,
        avatar: avatarSummary(next),
        outfitSummary: outfitSummary(next.outfit),
        pronouns: next.identity.pronouns,
        lastActive: ctx.now,
      }
      if (input.portrait !== undefined) pubPatch.portrait = input.portrait
      if (input.styleTag) pubPatch.styleTag = str(input.styleTag, 24)
      if (input.bio !== undefined) pubPatch.bio = str(input.bio, 160)
      if (input.aesthetics) pubPatch.aesthetics = input.aesthetics.filter(isAesthetic).slice(0, 4)
      const privacy = input.privacy ? sanitizePrivacy({ ...pub.privacy, ...input.privacy }) : pub.privacy
      if (input.privacy) pubPatch.privacy = privacy
      const home = input.city ? findCity(input.city, input.country) : user.homeCity ? findCity(user.homeCity.city, user.homeCity.country) : undefined
      if (input.city && !home) throw new GameError('invalid-argument', 'Pick a city from the list.')
      if ((input.city || input.privacy) && home) Object.assign(pubPatch, placeFor(home, privacy.showLocation))
      const userPatch: Record<string, unknown> = {}
      if (input.city && home) userPatch.homeCity = { city: home.name, country: home.country }
      if (wantedUsername && wantedUsername !== user.username) {
        if (user.username) tx.delete(P.username(user.username))
        tx.set(P.username(wantedUsername), { uid: ctx.uid })
        userPatch.username = wantedUsername
        pubPatch.username = wantedUsername
      }
      if (next.starterId !== doll.appearance.starterId) userPatch.starterChanges = inc(1)
      tx.update(P.publicDoll(ctx.uid), pubPatch)
      tx.set(P.progress(ctx.uid), progress)
      if (Object.keys(userPatch).length) tx.update(P.user(ctx.uid), userPatch)
      if (total) ledger(tx, ctx, -total, lines.map((l) => l.label).join(', '))
      return { charged: total, lines, dollies: progress.dollies }
    })
  },

  /** Called once per app session. Counts distinct play days (not calendar days). */
  async recordSession(ctx: HandlerContext) {
    return ctx.db.transaction(async (tx) => {
      const p = await tx.get<ProgressDoc>(P.progress(ctx.uid))
      if (!p) return { distinctPlayDays: 0 }
      const today = dayKey(ctx.now)
      rollPeriods(p, ctx.now)
      if (p.lastPlayDay !== today) {
        p.distinctPlayDays += 1
        p.lastPlayDay = today
        applyEvent(p, 'play-day', 1, ctx.now)
        p.updatedAt = ctx.now
        tx.set(P.progress(ctx.uid), p)
      }
      return { distinctPlayDays: p.distinctPlayDays }
    })
  },

  async purchase(ctx: HandlerContext, input: { itemIds: string[] }) {
    const ids = Array.isArray(input.itemIds) ? input.itemIds.slice(0, 50) : []
    if (!ids.length) throw new GameError('invalid-argument', 'Your bag is empty.')
    const items = ids.map((id) => {
      const item = getItem(id)
      if (!item || isStarterItem(id)) throw new GameError('invalid-argument', 'That item is not for sale.')
      return item
    })
    const total = items.reduce((s, i) => s + i.price, 0)
    return ctx.db.transaction(async (tx) => {
      const [p, inv] = await Promise.all([
        need<ProgressDoc>(tx, P.progress(ctx.uid), 'Progress'),
        need<InventoryDoc>(tx, P.inventory(ctx.uid), 'Inventory'),
      ])
      const level = levelOf(p.xp ?? 0).level
      const locked = items.find((i) => (i.unlockLevel ?? 0) > level)
      if (locked) throw new GameError('level-locked', `${locked.name} unlocks at level ${locked.unlockLevel}.`)
      spend(p, total)
      for (const i of items) inv.items[i.id] = (inv.items[i.id] ?? 0) + 1
      applyEvent(p, 'purchase', items.length, ctx.now)
      p.updatedAt = ctx.now
      tx.set(P.progress(ctx.uid), p)
      tx.set(P.inventory(ctx.uid), inv)
      ledger(tx, ctx, -total, `Shop: ${items.length} item${items.length > 1 ? 's' : ''}`)
      return { spent: total, dollies: p.dollies }
    })
  },

  async sellItem(ctx: HandlerContext, input: { itemId: string }) {
    const item = getItem(input.itemId)
    if (!item || isStarterItem(item.id)) throw new GameError('invalid-argument', 'Starter pieces cannot be sold.')
    return ctx.db.transaction(async (tx) => {
      const [p, inv, doll, apt] = await Promise.all([
        need<ProgressDoc>(tx, P.progress(ctx.uid), 'Progress'),
        need<InventoryDoc>(tx, P.inventory(ctx.uid), 'Inventory'),
        tx.get<DollDoc>(P.doll(ctx.uid)),
        tx.get<ApartmentDoc>(P.apartment(ctx.uid)),
      ])
      const owned = inv.items[item.id] ?? 0
      const worn = doll && Object.values(doll.appearance.outfit).includes(item.id) ? 1 : 0
      const placed = apt ? (placedCounts(apt.items)[item.id] ?? 0) : 0
      if (owned - worn - placed < 1) throw new GameError('in-use', 'Take it off or store it first.')
      const refund = Math.floor(item.price * SELL_BACK_RATE)
      if (owned <= 1) delete inv.items[item.id]
      else inv.items[item.id] = owned - 1
      p.dollies += refund
      p.updatedAt = ctx.now
      tx.set(P.inventory(ctx.uid), inv)
      tx.set(P.progress(ctx.uid), p)
      ledger(tx, ctx, refund, `Sold ${item.name}`)
      return { refund, dollies: p.dollies }
    })
  },

  async saveApartment(
    ctx: HandlerContext,
    input: Partial<Pick<ApartmentDoc, 'items' | 'wallColor' | 'wallpaper' | 'floor' | 'lighting' | 'windowView' | 'windowStyle' | 'windowSpot' | 'balcony'>>,
  ) {
    return ctx.db.transaction(async (tx) => {
      const [apt, inv, p] = await Promise.all([
        tx.get<ApartmentDoc>(P.apartment(ctx.uid)),
        need<InventoryDoc>(tx, P.inventory(ctx.uid), 'Inventory'),
        need<ProgressDoc>(tx, P.progress(ctx.uid), 'Progress'),
      ])
      const current = apt ?? defaultApartment(ctx.uid, ctx.now)
      const items: PlacedItem[] = Array.isArray(input.items) ? input.items.slice(0, 200) : current.items
      const counts = placedCounts(items)
      for (const [id, n] of Object.entries(counts)) {
        if ((inv.items[id] ?? 0) < n) throw new GameError('not-owned', `You only own ${inv.items[id] ?? 0} of ${getItem(id)?.name ?? id}.`)
      }
      const clean: PlacedItem[] = []
      for (const raw of items) {
        const it: PlacedItem = {
          id: str(raw.id, 40) || ctx.newId(),
          itemId: raw.itemId,
          x: +raw.x || 0,
          z: +raw.z || 0,
          rot: +raw.rot || 0,
          ...(raw.wall ? { wall: raw.wall === 'left' ? 'left' : 'back' } : {}),
          ...(raw.y !== undefined ? { y: Math.max(0.2, Math.min(2.6, +raw.y || 1.4)) } : {}),
        }
        if (!getItem(it.itemId)?.furniture) throw new GameError('invalid-argument', 'That is not furniture.')
        if (!inBounds(it, current.tier)) throw new GameError('invalid-argument', 'Something is outside your walls.')
        if (collides(clean, it)) throw new GameError('invalid-argument', 'Two pieces overlap.')
        clean.push(it)
      }
      const hex = (s: unknown, f: string) => (typeof s === 'string' && /^#[0-9a-fA-F]{6}$/.test(s) ? s : f)
      const next: ApartmentDoc = {
        ...current,
        items: clean,
        wallColor: hex(input.wallColor, current.wallColor),
        wallpaper: input.wallpaper ?? current.wallpaper,
        floor: input.floor ?? current.floor,
        lighting: input.lighting ?? current.lighting,
        windowView: input.windowView ?? current.windowView,
        windowStyle: (['classic', 'arched', 'tall', 'round'] as const).find((x) => x === input.windowStyle) ?? current.windowStyle ?? 'classic',
        windowSpot: (['left', 'center', 'right'] as const).find((x) => x === input.windowSpot) ?? current.windowSpot ?? 'right',
        balcony: input.balcony === undefined ? !!current.balcony : !!input.balcony,
        updatedAt: ctx.now,
      }
      if (next.balcony && !current.balcony && levelOf(p.xp ?? 0).level < BALCONY_LEVEL) throw new GameError('level-locked', `Balconies unlock at level ${BALCONY_LEVEL}.`)
      tx.set(P.apartment(ctx.uid), next)
      // "Fill your space" counts pieces beyond the starter mat.
      const placedNow = clean.filter((i) => !isStarterItem(i.itemId)).length
      applyEvent(p, 'place', placedNow, ctx.now, true)
      p.updatedAt = ctx.now
      tx.set(P.progress(ctx.uid), p)
      return { ok: true, placed: placedNow }
    })
  },

  async upgradeApartment(ctx: HandlerContext, input: { tier: ApartmentDoc['tier'] }) {
    const target = TIER_BY_ID.get(input.tier)
    if (!target) throw new GameError('invalid-argument', 'Unknown home.')
    return ctx.db.transaction(async (tx) => {
      const [apt, p] = await Promise.all([
        need<ApartmentDoc>(tx, P.apartment(ctx.uid), 'Apartment'),
        need<ProgressDoc>(tx, P.progress(ctx.uid), 'Progress'),
      ])
      const idx = APARTMENT_TIERS.findIndex((t) => t.id === apt.tier)
      const nextIdx = APARTMENT_TIERS.findIndex((t) => t.id === target.id)
      if (nextIdx <= idx) throw new GameError('invalid-argument', 'You already live somewhere bigger.')
      spend(p, target.price)
      p.apartmentTier = target.id
      p.updatedAt = ctx.now
      tx.update(P.apartment(ctx.uid), { tier: target.id, updatedAt: ctx.now })
      tx.set(P.progress(ctx.uid), p)
      ledger(tx, ctx, -target.price, `Moved to a ${target.name}`)
      return { tier: target.id, dollies: p.dollies }
    })
  },

  async startShift(ctx: HandlerContext) {
    return ctx.db.transaction(async (tx) => {
      const p = await need<ProgressDoc>(tx, P.progress(ctx.uid), 'Progress')
      const today = dayKey(ctx.now)
      if (p.shifts.day !== today) p.shifts = { day: today, count: 0, lastAt: p.shifts.lastAt, active: null }
      if (p.shifts.active && ctx.now - p.shifts.active.startedAt < SHIFT_MAX_MS) return { shift: p.shifts.active }
      if (p.shifts.count >= SHIFT_DAILY_LIMIT) throw new GameError('daily-limit', 'That’s all the shifts for today. Come back tomorrow.')
      const wait = p.shifts.lastAt + SHIFT_COOLDOWN_MS - ctx.now
      if (wait > 0) throw new GameError('cooldown', `Take a break. Next shift in ${Math.ceil(wait / 1000)}s.`)
      p.shifts.active = { id: ctx.newId(), startedAt: ctx.now, game: CAREERS[p.career.id].game }
      p.updatedAt = ctx.now
      tx.set(P.progress(ctx.uid), p)
      return { shift: p.shifts.active }
    })
  },

  async completeShift(ctx: HandlerContext, input: { shiftId: string; score: number }) {
    return ctx.db.transaction(async (tx) => {
      const p = await need<ProgressDoc>(tx, P.progress(ctx.uid), 'Progress')
      const active = p.shifts.active
      if (!active || active.id !== input.shiftId) throw new GameError('invalid-argument', 'That shift already ended.')
      const elapsed = ctx.now - active.startedAt
      // Finishing impossibly fast (or abandoning for ages) ends the shift unpaid.
      const invalid = elapsed < SHIFT_MIN_MS || elapsed > SHIFT_MAX_MS
      const score = invalid ? 0 : Math.max(0, Math.min(100, Math.round(+input.score || 0)))
      const pay = invalid ? { dollies: 0, xp: 0, reputation: 0 } : shiftPay(p.career.id, p.career.level, score)
      const before = p.career.level
      p.career.xp += pay.xp
      p.career.reputation += pay.reputation
      p.career.level = Math.max(before, levelFor(p.career.xp, p.career.reputation))
      const promoted = p.career.level > before
      earn(p, pay.dollies, ctx.now)
      applyEvent(p, 'shift', 1, ctx.now)
      p.shifts.count += 1
      p.shifts.lastAt = ctx.now
      p.shifts.active = null
      if (promoted) p.fame += FAME_POINTS.promotion
      p.updatedAt = ctx.now
      tx.set(P.progress(ctx.uid), p)
      tx.update(P.publicDoll(ctx.uid), {
        careerLevel: p.career.level,
        lastActive: ctx.now,
        ...(promoted ? { fame: inc(FAME_POINTS.promotion) } : {}),
      })
      ledger(tx, ctx, pay.dollies, `Shift: ${CAREERS[p.career.id].name}`)
      const title = careerTitle(p.career.id, p.career.level)
      if (promoted) notify(tx, ctx, ctx.uid, { type: 'promotion', text: `Promoted! You're now ${title}.`, link: '/work' })
      return { score, ...pay, level: p.career.level, promoted, title, dollies: p.dollies }
    })
  },

  async changeCareer(ctx: HandlerContext, input: { careerId: CareerId }) {
    const career = CAREERS[input.careerId]
    if (!career || career.starter) throw new GameError('invalid-argument', 'Pick a career from the Career Fair.')
    return ctx.db.transaction(async (tx) => {
      const p = await need<ProgressDoc>(tx, P.progress(ctx.uid), 'Progress')
      if (p.distinctPlayDays < CAREER_UNLOCK_DAYS)
        throw new GameError('career-locked', `The Career Fair opens after ${CAREER_UNLOCK_DAYS} play days. You have ${p.distinctPlayDays}.`)
      if (p.career.id === career.id) throw new GameError('invalid-argument', 'You already work here.')
      const past = p.careerHistory.find((h) => h.id === career.id)
      p.careerHistory = [...p.careerHistory.filter((h) => h.id !== p.career.id), { id: p.career.id, level: p.career.level, endedAt: ctx.now }]
      // Returning to an old career keeps your level.
      const level = past?.level ?? 1
      p.career = { id: career.id, level, xp: [0, 120, 360, 800, 1600, 3200][level - 1] ?? 0, reputation: 0, startedAt: ctx.now }
      p.shifts.active = null
      p.updatedAt = ctx.now
      tx.set(P.progress(ctx.uid), p)
      tx.update(P.publicDoll(ctx.uid), { career: career.id, careerLevel: level })
      return { career: career.id, level }
    })
  },

  /** Collect every level-up reward since the last one: Glam (no XP, so it can't chain) and free pieces. */
  async claimLevelUp(ctx: HandlerContext) {
    return ctx.db.transaction(async (tx) => {
      const [p, inv] = await Promise.all([need<ProgressDoc>(tx, P.progress(ctx.uid), 'Progress'), need<InventoryDoc>(tx, P.inventory(ctx.uid), 'Inventory')])
      const rewards = pendingLevelRewards(p)
      if (!rewards.length) return { rewards: [], dollies: p.dollies }
      let glam = 0
      for (const r of rewards) {
        glam += r.glam
        for (const id of r.items) if (getItem(id)) inv.items[id] = Math.max(1, inv.items[id] ?? 0)
      }
      p.dollies += glam
      p.levelRewarded = rewards[rewards.length - 1].level
      p.updatedAt = ctx.now
      tx.set(P.progress(ctx.uid), p)
      tx.set(P.inventory(ctx.uid), inv)
      ledger(tx, ctx, glam, `Level ${p.levelRewarded} reward`)
      return { rewards: rewards.map((r) => ({ ...r, items: r.items.filter((id) => !!getItem(id)) })), dollies: p.dollies }
    })
  },

  async claimMission(ctx: HandlerContext, input: { missionId: string }) {
    const m = MISSION_BY_ID.get(input.missionId)
    if (!m) throw new GameError('invalid-argument', 'Unknown mission.')
    return ctx.db.transaction(async (tx) => {
      const p = await need<ProgressDoc>(tx, P.progress(ctx.uid), 'Progress')
      rollPeriods(p, ctx.now)
      const st = missionState(p, m, ctx.now)
      if (st.status !== 'ready') throw new GameError('invalid-argument', st.status === 'claimed' ? 'Already claimed.' : 'Not finished yet.')
      if (m.id.startsWith('o-')) p.objectives[m.id] = 'claimed'
      else if (m.id.startsWith('d-')) p.daily.claimed.push(m.id)
      else p.weekly.claimed.push(m.id)
      // Missions count towards your level too.
      earn(p, m.reward, ctx.now)
      p.updatedAt = ctx.now
      tx.set(P.progress(ctx.uid), p)
      ledger(tx, ctx, m.reward, `Mission: ${m.title}`)
      return { reward: m.reward, dollies: p.dollies }
    })
  },

  /** Client-reported social events. Capped per day so they can't be farmed. */
  async track(ctx: HandlerContext, input: { event: GameEvent }) {
    const allowed: GameEvent[] = ['message', 'visit']
    if (!allowed.includes(input.event)) throw new GameError('invalid-argument', 'Unknown event.')
    return ctx.db.transaction(async (tx) => {
      const p = await tx.get<ProgressDoc>(P.progress(ctx.uid))
      if (!p) return { ok: false }
      rollPeriods(p, ctx.now)
      if ((p.daily.counts[input.event] ?? 0) >= 50) return { ok: false }
      applyEvent(p, input.event, 1, ctx.now)
      p.updatedAt = ctx.now
      tx.set(P.progress(ctx.uid), p)
      return { ok: true }
    })
  },

  /* ------------------------------------------------------------- friends */

  async sendFriendRequest(ctx: HandlerContext, input: { to: string; note?: string }) {
    const to = requireUid(input.to)
    if (to === ctx.uid) throw new GameError('invalid-argument', 'That’s you!')
    const note = str(input.note, NOTE_MAX_CHARS)
    return ctx.db.transaction(async (tx) => {
      const blocked = await isBlockedEitherWay(tx, ctx.uid, to)
      const [friendship, existing, reverse, p, me, them] = await Promise.all([
        tx.get<FriendshipDoc>(P.friendship(ctx.uid, to)),
        tx.get<FriendRequestDoc>(P.friendRequest(ctx.uid, to)),
        tx.get<FriendRequestDoc>(P.friendRequest(to, ctx.uid)),
        need<ProgressDoc>(tx, P.progress(ctx.uid), 'Progress'),
        need<PublicDoll>(tx, P.publicDoll(ctx.uid), 'Your doll'),
        need<PublicDoll>(tx, P.publicDoll(to), 'That doll'),
      ])
      const fctx = await readFriendshipContext(tx, ctx.uid, to)
      if (blocked) throw new GameError('blocked', 'You can’t send a request to this doll.')
      if (friendship) throw new GameError('already-friends', 'You’re already friends.')
      if (existing?.status === 'pending') throw new GameError('already-sent', 'Request already sent.')
      // They already asked you: accept instead of creating a second request.
      if (reverse?.status === 'pending' || them.kind === 'npc') {
        if (reverse) tx.update(P.friendRequest(to, ctx.uid), { status: 'accepted' })
        writeFriendship(tx, ctx, ctx.uid, to, fctx)
        notify(tx, ctx, ctx.uid, { type: 'friend-accepted', text: `You and ${them.name} are now friends.`, fromUid: to, fromName: them.name, link: `/u/${to}` })
        if (them.kind !== 'npc') notify(tx, ctx, to, { type: 'friend-accepted', text: `You and ${me.name} are now friends.`, fromUid: ctx.uid, fromName: me.name, link: `/u/${ctx.uid}` })
        return { status: 'accepted' as const }
      }
      const today = dayKey(ctx.now)
      const used = p.friendRequests.day === today ? p.friendRequests.count : 0
      if (used >= FRIEND_REQUEST_DAILY_LIMIT) throw new GameError('rate-limited', 'You’ve sent a lot of requests today. Try again tomorrow.')
      const req: FriendRequestDoc = {
        id: `${ctx.uid}_${to}`,
        from: ctx.uid,
        to,
        fromName: me.name,
        toName: them.name,
        note,
        status: 'pending',
        createdAt: ctx.now,
      }
      tx.set(P.friendRequest(ctx.uid, to), req)
      // Re-read state was loaded above; persist the counter on the progress copy we already hold.
      const prog = fctx.pa ?? p
      prog.friendRequests = { day: today, count: used + 1 }
      prog.updatedAt = ctx.now
      tx.set(P.progress(ctx.uid), prog)
      notify(tx, ctx, to, {
        type: 'friend-request',
        text: note ? `${me.name} wants to be friends: “${note}”` : `${me.name} wants to be friends.`,
        fromUid: ctx.uid,
        fromName: me.name,
        link: '/friends?tab=requests',
      })
      return { status: 'pending' as const }
    })
  },

  async respondFriendRequest(ctx: HandlerContext, input: { from: string; action: 'accept' | 'decline' | 'block' }) {
    const from = requireUid(input.from)
    return ctx.db.transaction(async (tx) => {
      const req = await need<FriendRequestDoc>(tx, P.friendRequest(from, ctx.uid), 'Request')
      const [me, them] = await Promise.all([
        need<PublicDoll>(tx, P.publicDoll(ctx.uid), 'Your doll'),
        tx.get<PublicDoll>(P.publicDoll(from)),
      ])
      const fctx = await readFriendshipContext(tx, ctx.uid, from)
      if (req.status !== 'pending') throw new GameError('invalid-argument', 'This request was already answered.')
      if (input.action === 'accept') {
        tx.update(P.friendRequest(from, ctx.uid), { status: 'accepted' })
        writeFriendship(tx, ctx, from, ctx.uid, fctx)
        notify(tx, ctx, from, { type: 'friend-accepted', text: `${me.name} accepted your friend request.`, fromUid: ctx.uid, fromName: me.name, link: `/u/${ctx.uid}` })
        notify(tx, ctx, ctx.uid, { type: 'friend-accepted', text: `You and ${them?.name ?? req.fromName} are now friends.`, fromUid: from, fromName: them?.name ?? req.fromName, link: `/u/${from}` })
        return { status: 'accepted' as const }
      }
      if (input.action === 'decline') {
        tx.update(P.friendRequest(from, ctx.uid), { status: 'declined' })
        return { status: 'declined' as const }
      }
      tx.delete(P.friendRequest(from, ctx.uid))
      const block: BlockDoc = { blocker: ctx.uid, blocked: from, createdAt: ctx.now }
      tx.set(P.block(ctx.uid, from), block)
      return { status: 'blocked' as const }
    })
  },

  async cancelFriendRequest(ctx: HandlerContext, input: { to: string }) {
    const to = requireUid(input.to)
    await ctx.db.delete(P.friendRequest(ctx.uid, to))
    return { ok: true }
  },

  async removeFriend(ctx: HandlerContext, input: { uid: string }) {
    const other = requireUid(input.uid)
    return ctx.db.transaction(async (tx) => {
      const f = await tx.get<FriendshipDoc>(P.friendship(ctx.uid, other))
      if (!f) return { ok: true }
      tx.delete(P.friendship(ctx.uid, other))
      tx.merge(P.friendList(ctx.uid), { uids: arrayRemove(other) })
      tx.merge(P.friendList(other), { uids: arrayRemove(ctx.uid) })
      tx.update(P.publicDoll(ctx.uid), { friendCount: inc(-1) })
      tx.update(P.publicDoll(other), { friendCount: inc(-1) })
      return { ok: true }
    })
  },

  async toggleFavourite(ctx: HandlerContext, input: { uid: string }) {
    const other = requireUid(input.uid)
    return ctx.db.transaction(async (tx) => {
      const f = await need<FriendshipDoc>(tx, P.friendship(ctx.uid, other), 'Friendship')
      const fav = f.favouriteOf.includes(ctx.uid)
      tx.update(P.friendship(ctx.uid, other), { favouriteOf: fav ? arrayRemove(ctx.uid) : arrayUnion(ctx.uid) })
      return { favourite: !fav }
    })
  },

  async block(ctx: HandlerContext, input: { uid: string }) {
    const other = requireUid(input.uid)
    if (other === ctx.uid) throw new GameError('invalid-argument', 'You can’t block yourself.')
    return ctx.db.transaction(async (tx) => {
      const [f, r1, r2] = await Promise.all([
        tx.get<FriendshipDoc>(P.friendship(ctx.uid, other)),
        tx.get<FriendRequestDoc>(P.friendRequest(ctx.uid, other)),
        tx.get<FriendRequestDoc>(P.friendRequest(other, ctx.uid)),
      ])
      const block: BlockDoc = { blocker: ctx.uid, blocked: other, createdAt: ctx.now }
      tx.set(P.block(ctx.uid, other), block)
      if (f) {
        tx.delete(P.friendship(ctx.uid, other))
        tx.merge(P.friendList(ctx.uid), { uids: arrayRemove(other) })
        tx.merge(P.friendList(other), { uids: arrayRemove(ctx.uid) })
        tx.update(P.publicDoll(ctx.uid), { friendCount: inc(-1) })
        tx.update(P.publicDoll(other), { friendCount: inc(-1) })
      }
      if (r1) tx.delete(P.friendRequest(ctx.uid, other))
      if (r2) tx.delete(P.friendRequest(other, ctx.uid))
      return { ok: true }
    })
  },

  async unblock(ctx: HandlerContext, input: { uid: string }) {
    await ctx.db.delete(P.block(ctx.uid, requireUid(input.uid)))
    return { ok: true }
  },

  async report(ctx: HandlerContext, input: { targetType: ReportTarget; targetId: string; targetUid: string; reason: string; details?: string }) {
    const id = ctx.newId()
    const doc: ReportDoc = {
      id,
      reporter: ctx.uid,
      targetType: input.targetType,
      targetId: str(input.targetId, 200),
      targetUid: requireUid(input.targetUid),
      reason: str(input.reason, 60) || 'other',
      details: str(input.details, 1000),
      createdAt: ctx.now,
      status: 'open',
    }
    await ctx.db.set(P.report(id), doc)
    return { ok: true }
  },

  /* ---------------------------------------------------------------- follow */

  async toggleFollow(ctx: HandlerContext, input: { uid: string }) {
    const other = requireUid(input.uid)
    if (other === ctx.uid) throw new GameError('invalid-argument', 'You can’t follow yourself.')
    return ctx.db.transaction(async (tx) => {
      const [f, me] = await Promise.all([
        tx.get<{ follower: string }>(P.follow(ctx.uid, other)),
        need<PublicDoll>(tx, P.publicDoll(ctx.uid), 'Your doll'),
      ])
      const blocked = await isBlockedEitherWay(tx, ctx.uid, other)
      if (f) {
        tx.delete(P.follow(ctx.uid, other))
        tx.update(P.publicDoll(ctx.uid), { following: inc(-1) })
        tx.update(P.publicDoll(other), { followers: inc(-1), fame: inc(-FAME_POINTS.follower) })
        return { following: false }
      }
      if (blocked) throw new GameError('blocked', 'You can’t follow this doll.')
      tx.set(P.follow(ctx.uid, other), { follower: ctx.uid, followee: other, createdAt: ctx.now })
      tx.update(P.publicDoll(ctx.uid), { following: inc(1) })
      tx.update(P.publicDoll(other), { followers: inc(1), fame: inc(FAME_POINTS.follower) })
      notify(tx, ctx, other, { type: 'follow', text: `${me.name} started following you.`, fromUid: ctx.uid, fromName: me.name, link: `/u/${ctx.uid}` })
      return { following: true }
    })
  },

  /* ----------------------------------------------------------------- posts */

  async createPost(ctx: HandlerContext, input: { kind: PostKind; image?: string | null; caption?: string }) {
    const kind: PostKind = input.kind === 'apartment' || input.kind === 'selfie' ? input.kind : 'look'
    const caption = str(input.caption, 280)
    const image = typeof input.image === 'string' ? input.image : null
    if (image && image.length > 900_000) throw new GameError('invalid-argument', 'Image is too large.')
    return ctx.db.transaction(async (tx) => {
      const [me, doll, p] = await Promise.all([
        need<PublicDoll>(tx, P.publicDoll(ctx.uid), 'Your doll'),
        tx.get<DollDoc>(P.doll(ctx.uid)),
        need<ProgressDoc>(tx, P.progress(ctx.uid), 'Progress'),
      ])
      const id = ctx.newId()
      const post: PostDoc = {
        id,
        authorId: ctx.uid,
        authorName: me.name,
        authorPortrait: me.portrait,
        authorAvatar: me.avatar,
        kind,
        image: image ?? (kind !== 'apartment' ? me.portrait : null),
        caption,
        outfit: kind === 'look' && doll ? doll.appearance.outfit : null,
        likes: 0,
        comments: 0,
        createdAt: ctx.now,
      }
      tx.set(P.post(id), post)
      applyEvent(p, 'post', 1, ctx.now)
      p.fame += FAME_POINTS.post
      p.updatedAt = ctx.now
      tx.set(P.progress(ctx.uid), p)
      tx.update(P.publicDoll(ctx.uid), { lastPostAt: ctx.now, fame: inc(FAME_POINTS.post) })
      return { id }
    })
  },

  async deletePost(ctx: HandlerContext, input: { postId: string }) {
    return ctx.db.transaction(async (tx) => {
      const post = await need<PostDoc>(tx, P.post(str(input.postId, 64)), 'Post')
      if (post.authorId !== ctx.uid) throw new GameError('permission-denied', 'Not your post.')
      tx.delete(P.post(post.id))
      return { ok: true }
    })
  },

  async toggleLike(ctx: HandlerContext, input: { postId: string }) {
    const postId = str(input.postId, 64)
    return ctx.db.transaction(async (tx) => {
      const [post, like, me, p] = await Promise.all([
        need<PostDoc>(tx, P.post(postId), 'Post'),
        tx.get<{ uid: string }>(P.like(postId, ctx.uid)),
        need<PublicDoll>(tx, P.publicDoll(ctx.uid), 'Your doll'),
        need<ProgressDoc>(tx, P.progress(ctx.uid), 'Progress'),
      ])
      if (like) {
        tx.delete(P.like(postId, ctx.uid))
        tx.update(P.post(postId), { likes: inc(-1) })
        if (post.authorId !== ctx.uid) tx.update(P.publicDoll(post.authorId), { fame: inc(-FAME_POINTS.like) })
        return { liked: false }
      }
      tx.set(P.like(postId, ctx.uid), { uid: ctx.uid, createdAt: ctx.now })
      tx.update(P.post(postId), { likes: inc(1) })
      if (post.authorId !== ctx.uid) {
        tx.update(P.publicDoll(post.authorId), { fame: inc(FAME_POINTS.like) })
        notify(tx, ctx, post.authorId, { type: 'like', text: `${me.name} liked your post.`, fromUid: ctx.uid, fromName: me.name, link: `/feed#${postId}` })
      }
      applyEvent(p, 'like', 1, ctx.now)
      p.updatedAt = ctx.now
      tx.set(P.progress(ctx.uid), p)
      return { liked: true }
    })
  },

  async addComment(ctx: HandlerContext, input: { postId: string; text: string }) {
    const postId = str(input.postId, 64)
    const text = str(input.text, 500)
    if (!text) throw new GameError('invalid-argument', 'Say something first.')
    return ctx.db.transaction(async (tx) => {
      const [post, me] = await Promise.all([need<PostDoc>(tx, P.post(postId), 'Post'), need<PublicDoll>(tx, P.publicDoll(ctx.uid), 'Your doll')])
      if (await isBlockedEitherWay(tx, ctx.uid, post.authorId)) throw new GameError('blocked', 'You can’t comment here.')
      const id = ctx.newId()
      const c: CommentDoc = { id, postId, authorId: ctx.uid, authorName: me.name, text, createdAt: ctx.now }
      tx.set(P.comment(postId, id), c)
      tx.update(P.post(postId), { comments: inc(1) })
      if (post.authorId !== ctx.uid) {
        tx.update(P.publicDoll(post.authorId), { fame: inc(FAME_POINTS.comment) })
        notify(tx, ctx, post.authorId, { type: 'comment', text: `${me.name} commented: “${text.slice(0, 60)}”`, fromUid: ctx.uid, fromName: me.name, link: `/feed#${postId}` })
      }
      return { id }
    })
  },

  /* -------------------------------------------------------------- messages */

  /** Get or create the 1:1 conversation. Non-friends land in a message-request inbox. */
  async openConversation(ctx: HandlerContext, input: { with: string }) {
    const other = requireUid(input.with)
    if (other === ctx.uid) throw new GameError('invalid-argument', 'That’s you!')
    const id = pairId(ctx.uid, other)
    return ctx.db.transaction(async (tx) => {
      const [conv, friendship, me, them] = await Promise.all([
        tx.get<ConversationDoc>(P.conversation(id)),
        tx.get<FriendshipDoc>(P.friendship(ctx.uid, other)),
        need<PublicDoll>(tx, P.publicDoll(ctx.uid), 'Your doll'),
        need<PublicDoll>(tx, P.publicDoll(other), 'That doll'),
      ])
      const blocked = await isBlockedEitherWay(tx, ctx.uid, other)
      if (blocked) throw new GameError('blocked', 'You can’t message this doll.')
      if (conv) return { id, status: conv.status }
      if (!friendship && them.privacy?.dms === 'friends') throw new GameError('dms-closed', `${them.name} only takes messages from friends.`)
      const status = friendship || them.kind === 'npc' ? 'active' : 'request'
      const doc: ConversationDoc = {
        id,
        members: [ctx.uid, other],
        names: { [ctx.uid]: me.name, [other]: them.name },
        status,
        requestedBy: status === 'request' ? ctx.uid : null,
        lastMessage: null,
        unread: { [ctx.uid]: 0, [other]: 0 },
        typing: {},
        updatedAt: ctx.now,
        createdAt: ctx.now,
      }
      tx.set(P.conversation(id), doc)
      if (status === 'request') {
        notify(tx, ctx, other, { type: 'message-request', text: `${me.name} wants to message you.`, fromUid: ctx.uid, fromName: me.name, link: `/friends?tab=chats&box=requests` })
      }
      return { id, status }
    })
  },

  async acceptMessageRequest(ctx: HandlerContext, input: { conversationId: string }) {
    return ctx.db.transaction(async (tx) => {
      const conv = await need<ConversationDoc>(tx, P.conversation(str(input.conversationId, 140)), 'Conversation')
      if (!conv.members.includes(ctx.uid) || conv.requestedBy === ctx.uid) throw new GameError('permission-denied', 'Only the recipient can accept.')
      tx.update(P.conversation(conv.id), { status: 'active' })
      return { ok: true }
    })
  },

  async notifyVisit(ctx: HandlerContext, input: { host: string }) {
    const host = requireUid(input.host)
    if (host === ctx.uid) return { ok: true }
    return ctx.db.transaction(async (tx) => {
      const [me, p] = await Promise.all([need<PublicDoll>(tx, P.publicDoll(ctx.uid), 'Your doll'), need<ProgressDoc>(tx, P.progress(ctx.uid), 'Progress')])
      const key = `visit:${host}`
      if (ctx.now - (p.counters[key] ?? 0) < 10 * 60 * 1000) return { ok: true }
      p.counters[key] = ctx.now
      applyEvent(p, 'visit', 1, ctx.now)
      tx.set(P.progress(ctx.uid), p)
      notify(tx, ctx, host, { type: 'visit', text: `${me.name} is visiting your crib.`, fromUid: ctx.uid, fromName: me.name, link: `/u/${ctx.uid}` })
      return { ok: true }
    })
  },

  async saveOutfitPresets(ctx: HandlerContext, input: { presets: OutfitPreset[] }) {
    const presets = (Array.isArray(input.presets) ? input.presets : []).slice(0, 30).map((p, i) => ({
      id: str(p.id, 40) || `preset-${i}`,
      name: str(p.name, 30) || `Outfit ${i + 1}`,
      outfit: sanitizeAppearance({ outfit: p.outfit }).outfit,
    }))
    await ctx.db.set(P.outfits(ctx.uid), { uid: ctx.uid, presets })
    return { ok: true }
  },

  /* ----------------------------------------------------- privacy & account */

  async exportData(ctx: HandlerContext) {
    const uid = ctx.uid
    const [user, doll, pub, progress, inventory, outfits, apartment, friendList] = await Promise.all([
      ctx.db.get(P.user(uid)),
      ctx.db.get(P.doll(uid)),
      ctx.db.get(P.publicDoll(uid)),
      ctx.db.get(P.progress(uid)),
      ctx.db.get(P.inventory(uid)),
      ctx.db.get(P.outfits(uid)),
      ctx.db.get(P.apartment(uid)),
      ctx.db.get(P.friendList(uid)),
    ])
    const [posts, sentRequests, receivedRequests, conversations, notifications, transactions, following] = await Promise.all([
      ctx.db.query<PostDoc>(C.posts, { where: [['authorId', '==', uid]] }),
      ctx.db.query<FriendRequestDoc>(C.friendRequests, { where: [['from', '==', uid]] }),
      ctx.db.query<FriendRequestDoc>(C.friendRequests, { where: [['to', '==', uid]] }),
      ctx.db.query<ConversationDoc>(C.conversations, { where: [['members', 'array-contains', uid]] }),
      ctx.db.query<NotificationDoc>(P.notifications(uid)),
      ctx.db.query<TransactionDoc>(C.transactions, { where: [['uid', '==', uid]] }),
      ctx.db.query(C.follows, { where: [['follower', '==', uid]] }),
    ])
    const messages: Record<string, unknown[]> = {}
    for (const c of conversations) {
      messages[c.id] = await ctx.db.query(P.messages(c.id), { where: [['senderId', '==', uid]] })
    }
    return {
      exportedAt: new Date(ctx.now).toISOString(),
      user,
      doll,
      publicProfile: pub,
      progress,
      inventory,
      outfits,
      apartment,
      friends: friendList,
      following,
      posts,
      friendRequests: { sent: sentRequests, received: receivedRequests },
      conversations,
      messagesYouSent: messages,
      notifications,
      transactions,
    }
  },

  /** Deletes everything we store about the player. Cloud Functions also deletes the auth account and files. */
  async deleteAccount(ctx: HandlerContext) {
    const uid = ctx.uid
    const db = ctx.db
    const friendList = await db.get<{ uids: string[] }>(P.friendList(uid))
    for (const other of friendList?.uids ?? []) {
      await db.delete(P.friendship(uid, other))
      await db.merge(P.friendList(other), { uids: arrayRemove(uid) })
      const theirs = await db.get<PublicDoll>(P.publicDoll(other))
      if (theirs) await db.merge(P.publicDoll(other), { friendCount: inc(-1) })
    }
    const lists = await Promise.all([
      db.query<FriendRequestDoc>(C.friendRequests, { where: [['from', '==', uid]] }),
      db.query<FriendRequestDoc>(C.friendRequests, { where: [['to', '==', uid]] }),
    ])
    for (const r of lists.flat()) await db.delete(`friendRequests/${r.id}`)
    for (const f of await db.query<{ follower: string; followee: string }>(C.follows, { where: [['follower', '==', uid]] }))
      await db.delete(P.follow(f.follower, f.followee))
    for (const f of await db.query<{ follower: string; followee: string }>(C.follows, { where: [['followee', '==', uid]] }))
      await db.delete(P.follow(f.follower, f.followee))
    for (const b of await db.query<BlockDoc>(C.blocks, { where: [['blocker', '==', uid]] })) await db.delete(P.block(b.blocker, b.blocked))
    for (const post of await db.query<PostDoc>(C.posts, { where: [['authorId', '==', uid]] })) await db.delete(P.post(post.id))
    for (const e of await db.query<ChallengeEntryDoc>(C.challengeEntries, { where: [['uid', '==', uid]] })) await db.delete(`challengeEntries/${e.id}`)
    const account = await db.get<UserDoc>(P.user(uid))
    if (account?.username) await db.delete(P.username(account.username))
    for (const n of await db.query<NotificationDoc>(P.notifications(uid))) await db.delete(P.notification(uid, n.id))
    for (const c of await db.query<ConversationDoc>(C.conversations, { where: [['members', 'array-contains', uid]] })) {
      for (const m of await db.query<{ id: string }>(P.messages(c.id))) await db.delete(P.message(c.id, m.id))
      await db.delete(P.conversation(c.id))
    }
    for (const path of [
      P.publicDoll(uid),
      P.doll(uid),
      P.progress(uid),
      P.inventory(uid),
      P.outfits(uid),
      P.apartment(uid),
      P.friendList(uid),
      P.user(uid),
    ])
      await db.delete(path)
    return { ok: true }
  },

  /**
   * Seed the curated NPC cast (kind: 'npc'). Idempotent. Also retires the
   * random demo dolls an earlier version created, so residents stay recognisable.
   */
  async seedDemo(ctx: HandlerContext) {
    const legacy = await ctx.db.query<PublicDoll>(C.publicDolls, { where: [['isDemo', '==', true]], limit: 200 })
    for (const d of legacy) {
      await ctx.db.delete(P.publicDoll(d.uid))
      await ctx.db.delete(P.doll(d.uid))
      await ctx.db.delete(P.apartment(d.uid))
      await ctx.db.delete(P.post(`${d.uid}-post`))
    }
    // Background residents (added later than the main cast, so seeded on their own).
    let bots = 0
    if (!(await ctx.db.get<PublicDoll>(P.publicDoll('bot-0')))) {
      for (const b of generateBots(ctx.now)) await ctx.db.set(P.publicDoll(b.uid), b)
      bots = generateBots(0).length
    }
    const existing = await ctx.db.get<PublicDoll>(P.publicDoll(NPC_DEFS[0].id))
    if (existing) return { seeded: 0, bots, retired: legacy.length }
    const world = generateNpcWorld(ctx.now)
    for (const d of world.publicDolls) await ctx.db.set(P.publicDoll(d.uid), d)
    for (const d of world.dolls) await ctx.db.set(P.doll(d.uid), d)
    for (const a of world.apartments) await ctx.db.set(P.apartment(a.uid), a)
    for (const p of world.posts) await ctx.db.set(P.post(p.id), p)
    return { seeded: world.publicDolls.length, bots, retired: legacy.length }
  },

  /* -------------------------------------------------------------- move-in */

  /** Players who moved in before the furnished starter home get it once: beanbag, side table, plants, maybe a pet. */
  async furnishStarterHome(ctx: HandlerContext) {
    return ctx.db.transaction(async (tx) => {
      const [apt, inv] = await Promise.all([need<ApartmentDoc>(tx, P.apartment(ctx.uid), 'Apartment'), need<InventoryDoc>(tx, P.inventory(ctx.uid), 'Inventory')])
      if (apt.starterHome) return { added: 0 }
      const items = [...apt.items]
      let added = 0
      for (const piece of starterHomeItems(ctx.uid)) {
        if ((inv.items[piece.itemId] ?? 0) > 0 || items.some((i) => i.id === piece.id)) continue
        inv.items[piece.itemId] = 1
        const placed = { ...piece, id: `${piece.id}-${ctx.now.toString(36)}` }
        // Place it where it fits; otherwise it waits in the furniture tray.
        if (inBounds(placed, apt.tier) && !collides(items, placed)) items.push(placed)
        added++
      }
      tx.set(P.inventory(ctx.uid), inv)
      tx.update(P.apartment(ctx.uid), { items, starterHome: true, updatedAt: ctx.now })
      return { added }
    })
  },

  /** The delivery truck has been and gone. */
  async finishMoveIn(ctx: HandlerContext) {
    await ctx.db.merge(P.apartment(ctx.uid), { movedIn: true })
    return { ok: true }
  },

  /** Open a Ghana Must Go, suitcase or box: its contents go into your wardrobe or furniture tray. */
  async unpackLuggage(ctx: HandlerContext, input: { id: string }) {
    const def = LUGGAGE_BY_ID.get(input.id)
    if (!def) throw new GameError('invalid-argument', 'Nothing to unpack.')
    return ctx.db.transaction(async (tx) => {
      const [apt, inv, p] = await Promise.all([
        need<ApartmentDoc>(tx, P.apartment(ctx.uid), 'Apartment'),
        need<InventoryDoc>(tx, P.inventory(ctx.uid), 'Inventory'),
        need<ProgressDoc>(tx, P.progress(ctx.uid), 'Progress'),
      ])
      if (!(apt.luggage ?? []).includes(def.id)) throw new GameError('invalid-argument', 'Already unpacked.')
      for (const id of def.items) inv.items[id] = Math.max(1, inv.items[id] ?? 0)
      // Furniture comes out of the box and into the room: it arranges itself along the walls.
      const items = [...apt.items]
      const placed: string[] = []
      for (const id of def.items) {
        if (!getItem(id)?.furniture || items.some((i) => i.itemId === id)) continue
        const spot = findSpot(items, id, apt.tier, `unpack-${id}-${ctx.now.toString(36)}`)
        if (spot) {
          items.push(spot)
          placed.push(id)
        }
      }
      earn(p, UNPACK_REWARD, ctx.now)
      applyEvent(p, 'unpack', 1, ctx.now)
      p.updatedAt = ctx.now
      tx.update(P.apartment(ctx.uid), { luggage: (apt.luggage ?? []).filter((l) => l !== def.id), movedIn: true, items, updatedAt: ctx.now })
      tx.set(P.inventory(ctx.uid), inv)
      tx.set(P.progress(ctx.uid), p)
      ledger(tx, ctx, UNPACK_REWARD, `Unpacked ${def.label}`)
      return { items: def.items, placed, label: def.label, reward: UNPACK_REWARD }
    })
  },

  /* ----------------------------------------------------------- rent a fit */

  async rentItem(ctx: HandlerContext, input: { itemId: string; days: RentDays }) {
    const item = getItem(input.itemId)
    const days = ([1, 3, 7] as const).includes(input.days) ? input.days : 1
    if (!item?.slot || item.price < RENT_MIN_PRICE) throw new GameError('invalid-argument', 'That piece isn’t available to rent.')
    const cost = rentPrice(item.price, days)
    return ctx.db.transaction(async (tx) => {
      const [p, inv] = await Promise.all([need<ProgressDoc>(tx, P.progress(ctx.uid), 'Progress'), need<InventoryDoc>(tx, P.inventory(ctx.uid), 'Inventory')])
      spend(p, cost)
      const from = Math.max(ctx.now, inv.rentals?.[item.id] ?? 0)
      const until = from + days * 86400000
      tx.update(P.inventory(ctx.uid), { [`rentals.${item.id}`]: until })
      p.updatedAt = ctx.now
      tx.set(P.progress(ctx.uid), p)
      ledger(tx, ctx, -cost, `Rented ${item.name} (${days}d)`)
      return { until, cost, dollies: p.dollies }
    })
  },

  /* -------------------------------------------------------------- outings */

  /** Invite a friend on a friendship or romantic date at a DollScene location. */
  async inviteOuting(ctx: HandlerContext, input: { to: string; place: string; kind: 'friendship' | 'romantic' }) {
    const to = requireUid(input.to)
    const place = PLACE_BY_ID.get(input.place)
    if (!place || !place.dates) throw new GameError('invalid-argument', 'Pick a date spot.')
    const kind = input.kind === 'romantic' ? 'romantic' : 'friendship'
    return ctx.db.transaction(async (tx) => {
      const [mine, friendship, me, them, theirDoll] = await Promise.all([
        need<ProgressDoc>(tx, P.progress(ctx.uid), 'Progress'),
        tx.get<FriendshipDoc>(P.friendship(ctx.uid, to)),
        need<PublicDoll>(tx, P.publicDoll(ctx.uid), 'Your doll'),
        need<PublicDoll>(tx, P.publicDoll(to), 'That doll'),
        tx.get<DollDoc>(P.doll(to)),
      ])
      requireLevel(mine, 'Dates')
      if (!friendship && them.kind !== 'npc') throw new GameError('not-friends', `Add ${them.name} as a friend first.`)
      const pref = theirDoll?.appearance.identity.datingPreference ?? ''
      if (kind === 'romantic' && (pref === 'Not dating' || pref === 'Friends only')) throw new GameError('not-dating', `${them.name} isn’t open to romantic dates. Try a friendship date.`)
      const id = ctx.newId()
      const outing: OutingDoc = { id, from: ctx.uid, to, fromName: me.name, toName: them.name, place: place.id, kind, status: them.kind === 'npc' ? 'accepted' : 'pending', createdAt: ctx.now }
      tx.set(P.outing(id), outing)
      if (them.kind === 'npc') {
        notify(tx, ctx, ctx.uid, { type: 'system', text: `${them.name} said yes to a ${kind} date at ${place.name}!`, fromUid: to, fromName: them.name, link: `/dollscene?place=${place.id}&with=${to}` })
      } else {
        notify(tx, ctx, to, { type: 'system', text: `${me.name} invited you on a ${kind} date at ${place.name}.`, fromUid: ctx.uid, fromName: me.name, link: `/dollscene?outing=${id}` })
      }
      return { id, status: outing.status }
    })
  },

  async respondOuting(ctx: HandlerContext, input: { id: string; accept: boolean }) {
    return ctx.db.transaction(async (tx) => {
      const o = await need<OutingDoc>(tx, P.outing(str(input.id, 64)), 'Invite')
      const [p, me] = await Promise.all([need<ProgressDoc>(tx, P.progress(ctx.uid), 'Progress'), need<PublicDoll>(tx, P.publicDoll(ctx.uid), 'Your doll')])
      if (o.to !== ctx.uid) throw new GameError('permission-denied', 'Not your invite.')
      if (o.status !== 'pending') return { status: o.status }
      if (input.accept) requireLevel(p, 'Dates')
      const status = input.accept ? 'accepted' : 'declined'
      tx.update(P.outing(o.id), { status })
      const place = PLACE_BY_ID.get(o.place)
      if (input.accept) {
        earn(p, OUTING_REWARD, ctx.now)
        applyEvent(p, 'outing', 1, ctx.now)
        p.updatedAt = ctx.now
        tx.set(P.progress(ctx.uid), p)
        ledger(tx, ctx, OUTING_REWARD, `Date at ${place?.name}`)
        notify(tx, ctx, o.from, { type: 'system', text: `${me.name} said yes to your ${o.kind} date at ${place?.name}!`, fromUid: ctx.uid, fromName: me.name, link: `/dollscene?place=${o.place}&with=${ctx.uid}` })
      }
      return { status }
    })
  },

  /** Go to a party in DollScene (level 3+). Pays once per party per day. */
  async attendParty(ctx: HandlerContext, input: { place: string }) {
    const place = PLACE_BY_ID.get(str(input.place, 64))
    if (!place || place.kind !== 'party') throw new GameError('invalid-argument', 'That’s not a party.')
    return ctx.db.transaction(async (tx) => {
      const p = await need<ProgressDoc>(tx, P.progress(ctx.uid), 'Progress')
      requireLevel(p, 'Parties')
      const day = dayKey(ctx.now)
      const today = p.parties?.day === day ? p.parties.ids : []
      if (today.includes(place.id)) return { reward: 0, level: levelOf(p.xp ?? 0).level }
      earn(p, PARTY_REWARD, ctx.now)
      applyEvent(p, 'party', 1, ctx.now)
      p.parties = { day, ids: [...today, place.id] }
      p.updatedAt = ctx.now
      tx.set(P.progress(ctx.uid), p)
      ledger(tx, ctx, PARTY_REWARD, `Partied at ${place.name}`)
      return { reward: PARTY_REWARD, level: levelOf(p.xp ?? 0).level }
    })
  },

  /* ----------------------------------------------------------- favourites */

  async setFavourite(ctx: HandlerContext, input: { itemId: string; favourite: boolean }) {
    if (!getItem(input.itemId)) throw new GameError('invalid-argument', 'Unknown item.')
    await ctx.db.merge(P.outfits(ctx.uid), { uid: ctx.uid, favourites: input.favourite ? arrayUnion(input.itemId) : arrayRemove(input.itemId) })
    return { ok: true }
  },

  /* -------------------------------------------------------- room layouts */

  async saveLayout(ctx: HandlerContext, input: { name: string }) {
    const name = str(input.name, 24)
    if (!name) throw new GameError('invalid-argument', 'Name the layout first.')
    return ctx.db.transaction(async (tx) => {
      const apt = await need<ApartmentDoc>(tx, P.apartment(ctx.uid), 'Apartment')
      const layouts = (apt.layouts ?? []).filter((l) => l.name !== name)
      if (layouts.length >= 6) throw new GameError('invalid-argument', 'You can keep up to 6 layouts. Delete one first.')
      const layout: SavedLayout = {
        id: ctx.newId(),
        name,
        items: apt.items,
        wallColor: apt.wallColor,
        wallpaper: apt.wallpaper,
        floor: apt.floor,
        lighting: apt.lighting,
        savedAt: ctx.now,
      }
      tx.update(P.apartment(ctx.uid), { layouts: [...layouts, layout] })
      return { id: layout.id }
    })
  },

  async deleteLayout(ctx: HandlerContext, input: { id: string }) {
    return ctx.db.transaction(async (tx) => {
      const apt = await need<ApartmentDoc>(tx, P.apartment(ctx.uid), 'Apartment')
      tx.update(P.apartment(ctx.uid), { layouts: (apt.layouts ?? []).filter((l) => l.id !== input.id) })
      return { ok: true }
    })
  },

  /* ----------------------------------------------------- fashion challenges */

  /** Enter (or update) your current look in a running challenge. Participation pays once per challenge. */
  async enterChallenge(ctx: HandlerContext, input: { challengeKey: string; caption?: string }) {
    const run = currentChallenges(ctx.now).find((c) => c.key === input.challengeKey)
    if (!run) throw new GameError('invalid-argument', 'That challenge has ended.')
    return ctx.db.transaction(async (tx) => {
      const [doll, pub, p, existing] = await Promise.all([
        need<DollDoc>(tx, P.doll(ctx.uid), 'Doll'),
        need<PublicDoll>(tx, P.publicDoll(ctx.uid), 'Profile'),
        need<ProgressDoc>(tx, P.progress(ctx.uid), 'Progress'),
        tx.get<ChallengeEntryDoc>(P.challengeEntry(run.key, ctx.uid)),
      ])
      const path = P.challengeEntry(run.key, ctx.uid)
      const entry: ChallengeEntryDoc = {
        id: path.split('/')[1],
        challengeKey: run.key,
        uid: ctx.uid,
        kind: 'player',
        name: pub.name,
        username: pub.username,
        avatar: pub.avatar,
        portrait: pub.portrait,
        outfit: doll.appearance.outfit,
        caption: str(input.caption, 140),
        votes: existing?.votes ?? 0,
        createdAt: existing?.createdAt ?? ctx.now,
      }
      tx.set(path, entry)
      let reward = 0
      if (!existing) {
        reward = CHALLENGE_REWARDS.enter
        earn(p, reward, ctx.now)
        applyEvent(p, 'challenge', 1, ctx.now)
        p.updatedAt = ctx.now
        tx.set(P.progress(ctx.uid), p)
        ledger(tx, ctx, reward, `Entered: ${run.title}`)
      }
      return { id: entry.id, reward }
    })
  },

  /** One vote per look. You can't vote for yourself. Voters earn a little, capped per day. */
  async voteChallenge(ctx: HandlerContext, input: { entryId: string }) {
    const entryId = str(input.entryId, 200)
    return ctx.db.transaction(async (tx) => {
      const [entry, vote, p] = await Promise.all([
        need<ChallengeEntryDoc>(tx, `challengeEntries/${entryId}`, 'Entry'),
        tx.get<{ uid: string }>(P.challengeVote(entryId, ctx.uid)),
        need<ProgressDoc>(tx, P.progress(ctx.uid), 'Progress'),
      ])
      if (challengeEnded(entry.challengeKey, ctx.now)) throw new GameError('invalid-argument', 'Voting has closed.')
      if (entry.uid === ctx.uid) throw new GameError('invalid-argument', 'You can’t vote for your own look.')
      if (vote) throw new GameError('already-voted', 'You already voted for this look.')
      rollPeriods(p, ctx.now)
      const used = p.daily.counts.vote ?? 0
      if (used >= VOTES_PER_DAY) throw new GameError('rate-limited', 'That’s all your votes for today.')
      tx.set(P.challengeVote(entryId, ctx.uid), { uid: ctx.uid, entryId, createdAt: ctx.now })
      tx.update(`challengeEntries/${entryId}`, { votes: inc(1) })
      earn(p, CHALLENGE_REWARDS.vote, ctx.now)
      applyEvent(p, 'vote', 1, ctx.now)
      p.updatedAt = ctx.now
      tx.set(P.progress(ctx.uid), p)
      ledger(tx, ctx, CHALLENGE_REWARDS.vote, 'Voted in a challenge')
      return { ok: true }
    })
  },

  /** After a challenge closes, the top three looks can claim prizes. */
  async claimChallengePrize(ctx: HandlerContext, input: { challengeKey: string }) {
    if (!challengeEnded(input.challengeKey, ctx.now)) throw new GameError('invalid-argument', 'This challenge is still running.')
    const top = await ctx.db.query<ChallengeEntryDoc>(C.challengeEntries, { where: [['challengeKey', '==', input.challengeKey]], orderBy: ['votes', 'desc'], limit: 3 })
    const rank = top.findIndex((e) => e.uid === ctx.uid)
    if (rank < 0) throw new GameError('invalid-argument', 'Only the top three looks win prizes.')
    return ctx.db.transaction(async (tx) => {
      const p = await need<ProgressDoc>(tx, P.progress(ctx.uid), 'Progress')
      const key = `prize:${input.challengeKey}`
      if (p.counters[key]) throw new GameError('invalid-argument', 'Prize already claimed.')
      const prize = CHALLENGE_REWARDS.prize[rank]
      p.counters[key] = ctx.now
      earn(p, prize, ctx.now)
      p.fame += 30 - rank * 10
      p.updatedAt = ctx.now
      tx.set(P.progress(ctx.uid), p)
      tx.update(P.publicDoll(ctx.uid), { fame: inc(30 - rank * 10), badges: arrayUnion(rank === 0 ? 'Challenge winner' : 'Challenge finalist') })
      ledger(tx, ctx, prize, `Challenge prize (#${rank + 1})`)
      return { prize, rank: rank + 1 }
    })
  },

  /** Residents join each challenge so the board is never empty. Their entries are labelled NPC. */
  async ensureChallengeNpcEntries(ctx: HandlerContext, input: { challengeKey: string }) {
    const run = currentChallenges(ctx.now).find((c) => c.key === input.challengeKey)
    if (!run) return { created: 0 }
    const existing = await ctx.db.query<ChallengeEntryDoc>(C.challengeEntries, { where: [['challengeKey', '==', run.key], ['kind', '==', 'npc']], limit: 1 })
    if (existing.length) return { created: 0 }
    // The main cast only: background bots have no wardrobe to enter.
    const npcs = (await Promise.all(NPC_DEFS.map((d) => ctx.db.get<PublicDoll>(P.publicDoll(d.id))))).filter((n): n is PublicDoll => !!n)
    const fitting = npcs.filter((n) => n.aesthetics.includes(run.aesthetic))
    const pool = [...fitting, ...npcs.filter((n) => !fitting.includes(n))].slice(0, 5)
    let created = 0
    for (const [i, n] of pool.entries()) {
      const doll = await ctx.db.get<DollDoc>(P.doll(n.uid))
      if (!doll) continue
      const path = P.challengeEntry(run.key, n.uid)
      const entry: ChallengeEntryDoc = {
        id: path.split('/')[1],
        challengeKey: run.key,
        uid: n.uid,
        kind: 'npc',
        name: n.name,
        username: n.username,
        avatar: n.avatar,
        portrait: n.portrait,
        outfit: doll.appearance.outfit,
        caption: `${AESTHETIC_LABEL[run.aesthetic]} mood`,
        votes: 6 - i,
        createdAt: ctx.now - i * 60000,
      }
      await ctx.db.set(path, entry)
      created++
    }
    return { created }
  },
}

export type Handlers = typeof handlers
export type HandlerName = keyof Handlers
export type HandlerInput<K extends HandlerName> = Parameters<Handlers[K]>[1] extends undefined ? void : Parameters<Handlers[K]>[1]
export type HandlerResult<K extends HandlerName> = Awaited<ReturnType<Handlers[K]>>

/** Guard used by both runtimes. */
export function isHandlerName(name: string): name is HandlerName {
  return Object.prototype.hasOwnProperty.call(handlers, name)
}

