/**
 * Cloud Functions for DollScene. Every gameplay action is a callable that runs
 * the same shared handlers the offline build uses (src/shared/server/handlers.ts),
 * copied in at build time by `npm run sync-shared`.
 */
import { initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import { getMessaging } from 'firebase-admin/messaging'
import { getStorage } from 'firebase-admin/storage'
import { setGlobalOptions } from 'firebase-functions/v2'
import { onDocumentCreated } from 'firebase-functions/v2/firestore'
import { HttpsError, onCall, type CallableRequest } from 'firebase-functions/v2/https'
import { createAdminDb, newId } from './adminDb'
import { GameError } from './shared/server/db'
import { handlers, type HandlerName } from './shared/server/handlers'
import type { ConversationDoc, MessageDoc, UserDoc } from './shared/types'

initializeApp()
const REGION = process.env.FUNCTIONS_REGION || 'europe-west1'
setGlobalOptions({ region: REGION, maxInstances: 20 })
const db = createAdminDb()

/** Calls a shared handler with the caller's uid, mapping GameErrors to HttpsErrors. */
function callable(name: HandlerName, opts: { allowGuest?: boolean } = {}) {
  return onCall({ enforceAppCheck: false, cors: true }, async (req: CallableRequest<unknown>) => {
    const uid = req.auth?.uid ?? (opts.allowGuest ? 'system' : null)
    if (!uid) throw new HttpsError('unauthenticated', 'Sign in first.')
    try {
      const fn = handlers[name] as (ctx: Parameters<typeof handlers.seedDemo>[0], input: unknown) => Promise<unknown>
      return await fn({ db, uid, now: Date.now(), newId }, req.data ?? {})
    } catch (e) {
      if (e instanceof GameError) {
        const code = (
          {
            'not-found': 'not-found',
            'invalid-argument': 'invalid-argument',
            'permission-denied': 'permission-denied',
            'insufficient-funds': 'failed-precondition',
            'not-owned': 'failed-precondition',
            'in-use': 'failed-precondition',
            'career-locked': 'failed-precondition',
            'daily-limit': 'resource-exhausted',
            'rate-limited': 'resource-exhausted',
            cooldown: 'resource-exhausted',
            blocked: 'permission-denied',
            'already-friends': 'already-exists',
            'already-sent': 'already-exists',
            'age-required': 'failed-precondition',
            underage: 'permission-denied',
            'terms-required': 'failed-precondition',
            'username-taken': 'already-exists',
            'dms-closed': 'permission-denied',
            'already-voted': 'already-exists',
            'not-friends': 'failed-precondition',
            'not-dating': 'failed-precondition',
            'level-locked': 'failed-precondition',
          } as const
        )[e.code as 'not-found'] ?? 'failed-precondition'
        throw new HttpsError(code, e.message, { code: e.code })
      }
      console.error(name, e)
      throw new HttpsError('internal', 'Something went wrong.')
    }
  })
}

export const bootstrapUser = callable('bootstrapUser')
export const completeOnboarding = callable('completeOnboarding')
export const saveAppearance = callable('saveAppearance')
export const recordSession = callable('recordSession')
export const purchase = callable('purchase')
export const sellItem = callable('sellItem')
export const saveApartment = callable('saveApartment')
export const upgradeApartment = callable('upgradeApartment')
export const startShift = callable('startShift')
export const completeShift = callable('completeShift')
export const changeCareer = callable('changeCareer')
export const claimMission = callable('claimMission')
export const track = callable('track')
export const sendFriendRequest = callable('sendFriendRequest')
export const respondFriendRequest = callable('respondFriendRequest')
export const cancelFriendRequest = callable('cancelFriendRequest')
export const removeFriend = callable('removeFriend')
export const toggleFavourite = callable('toggleFavourite')
export const block = callable('block')
export const unblock = callable('unblock')
export const report = callable('report')
export const toggleFollow = callable('toggleFollow')
export const createPost = callable('createPost')
export const deletePost = callable('deletePost')
export const toggleLike = callable('toggleLike')
export const addComment = callable('addComment')
export const openConversation = callable('openConversation')
export const acceptMessageRequest = callable('acceptMessageRequest')
export const notifyVisit = callable('notifyVisit')
export const saveOutfitPresets = callable('saveOutfitPresets')
export const exportData = callable('exportData')
export const seedDemo = callable('seedDemo', { allowGuest: true })
export const setFavourite = callable('setFavourite')
export const saveLayout = callable('saveLayout')
export const deleteLayout = callable('deleteLayout')
export const enterChallenge = callable('enterChallenge')
export const voteChallenge = callable('voteChallenge')
export const claimChallengePrize = callable('claimChallengePrize')
export const ensureChallengeNpcEntries = callable('ensureChallengeNpcEntries')
export const finishMoveIn = callable('finishMoveIn')
export const furnishStarterHome = callable('furnishStarterHome')
export const claimLevelUp = callable('claimLevelUp')
export const unpackLuggage = callable('unpackLuggage')
export const rentItem = callable('rentItem')
export const inviteOuting = callable('inviteOuting')
export const respondOuting = callable('respondOuting')
export const attendParty = callable('attendParty')

/** Deletes game data, uploaded files and the auth account. */
export const deleteAccount = onCall(async (req) => {
  const uid = req.auth?.uid
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in first.')
  await handlers.deleteAccount({ db, uid, now: Date.now(), newId })
  const bucket = getStorage().bucket()
  await Promise.all([bucket.deleteFiles({ prefix: `portraits/${uid}/` }), bucket.deleteFiles({ prefix: `posts/${uid}/` })]).catch(() => undefined)
  await getAuth().deleteUser(uid).catch(() => undefined)
  return { ok: true }
})

/** Push a notification to the recipient of every new chat message. */
export const onMessageCreated = onDocumentCreated('conversations/{cid}/messages/{mid}', async (event) => {
  const msg = event.data?.data() as MessageDoc | undefined
  if (!msg) return
  const fs = getFirestore()
  const conv = (await fs.doc(`conversations/${event.params.cid}`).get()).data() as ConversationDoc | undefined
  if (!conv) return
  const to = conv.members.find((m) => m !== msg.senderId)
  if (!to) return
  const user = (await fs.doc(`users/${to}`).get()).data() as UserDoc | undefined
  const tokens = user?.pushTokens ?? []
  if (!tokens.length) return
  const name = conv.names[msg.senderId] ?? 'Someone'
  const body = msg.type === 'look' ? '👗 Sent you a look' : msg.text.slice(0, 120)
  const res = await getMessaging().sendEachForMulticast({
    tokens,
    notification: { title: conv.status === 'request' ? `${name} wants to message you` : name, body },
    data: { link: `/messages/${event.params.cid}` },
    webpush: { fcmOptions: { link: `/messages/${event.params.cid}` } },
  })
  // Prune dead tokens.
  const dead = res.responses.map((r, i) => (!r.success ? tokens[i] : null)).filter((t): t is string => !!t)
  if (dead.length) await fs.doc(`users/${to}`).update({ pushTokens: tokens.filter((t) => !dead.includes(t)) })
})
