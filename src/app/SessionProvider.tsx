import { useEffect, useState, type ReactNode } from 'react'
import { runAction } from '../hooks/useAction'
import { backend, loadBackend } from '../services/backend'
import { C, P } from '../shared/paths'
import type {
  ApartmentDoc,
  BlockDoc,
  ConversationDoc,
  DollDoc,
  FriendListDoc,
  FriendRequestDoc,
  InventoryDoc,
  NotificationDoc,
  OutfitsDoc,
  ProgressDoc,
  PublicDoll,
  UserDoc,
} from '../shared/types'
import { useSession } from '../store/useSession'
import { toast } from '../store/useToasts'

const HEARTBEAT_MS = 60_000

function Splash() {
  return (
    <div className="grid h-dvh place-items-center bg-background" role="status" aria-label="Loading">
      <span aria-hidden className="size-14 rounded-full bg-primary/25 motion-safe:animate-pulse" />
    </div>
  )
}

/** Loads the backend, follows auth, and mirrors the player's own documents into useSession. */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let alive = true
    loadBackend().then(() => {
      if (!alive) return
      setReady(true)
      // Idempotent: fills an empty world with 60 demo dolls.
      void runAction('seedDemo', undefined, { silent: true })
    })
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    if (!ready) return
    const b = backend()
    const set = useSession.getState().set
    let subs: (() => void)[] = []
    const clear = () => {
      subs.forEach((u) => u())
      subs = []
    }

    const unsubAuth = b.auth.onChange((user) => {
      clear()
      if (!user) {
        useSession.getState().reset()
        return
      }
      if (useSession.getState().user?.uid !== user.uid) {
        const bootstrapping = useSession.getState().bootstrapping
        useSession.getState().reset()
        set({ bootstrapping })
      }
      set({ status: 'signed-in', user })
      const uid = user.uid
      const db = b.db
      subs.push(
        db.watch<UserDoc>(P.user(uid), (profile) => set({ profile, profileLoaded: true })),
        db.watch<DollDoc>(P.doll(uid), (doll) => set({ doll })),
        db.watch<PublicDoll>(P.publicDoll(uid), (publicDoll) => set({ publicDoll })),
        db.watch<ProgressDoc>(P.progress(uid), (progress) => set({ progress })),
        db.watch<InventoryDoc>(P.inventory(uid), (inventory) => set({ inventory })),
        db.watch<ApartmentDoc>(P.apartment(uid), (apartment) => set({ apartment })),
        db.watch<OutfitsDoc>(P.outfits(uid), (outfits) => set({ outfits })),
        db.watch<FriendListDoc>(P.friendList(uid), (fl) => set({ friendUids: fl?.uids ?? [] })),
        db.watchQuery<BlockDoc>(C.blocks, { where: [['blocker', '==', uid]] }, (bs) => set({ blockedUids: bs.map((x) => x.blocked) })),
        db.watchQuery<NotificationDoc>(P.notifications(uid), { where: [['read', '==', false]], limit: 99 }, (ns) => set({ unreadNotifications: ns.length })),
        db.watchQuery<FriendRequestDoc>(
          C.friendRequests,
          { where: [['to', '==', uid], ['status', '==', 'pending']], limit: 99 },
          (rs) => set({ pendingRequests: rs.length }),
        ),
        db.watchQuery<ConversationDoc>(C.conversations, { where: [['members', 'array-contains', uid]], limit: 200 }, (cs) =>
          set({ unreadMessages: cs.reduce((n, c) => n + (c.unread?.[uid] ?? 0), 0) }),
        ),
      )
    })

    const onPush = (e: Event) => {
      const n = (e as CustomEvent<{ title?: string; body?: string }>).detail
      if (n?.title) toast.info(`${n.title}${n.body ? `: ${n.body}` : ''}`)
    }
    window.addEventListener('dollscene:push', onPush)
    return () => {
      clear()
      unsubAuth()
      window.removeEventListener('dollscene:push', onPush)
    }
  }, [ready])

  return ready ? (
    <>
      <SessionEffects />
      {children}
    </>
  ) : (
    <Splash />
  )
}

/** Play-day tracking and online presence for onboarded players. */
function SessionEffects() {
  const uid = useSession((s) => s.user?.uid)
  const onboarded = useSession((s) => !!s.profile?.onboarded)
  const hasPublic = useSession((s) => !!s.publicDoll)
  const showOnline = useSession((s) => s.publicDoll?.privacy?.showOnline !== false)

  useEffect(() => {
    if (!uid || !onboarded) return
    void runAction('recordSession', undefined, { silent: true })
  }, [uid, onboarded])

  useEffect(() => {
    if (!uid || !onboarded || !hasPublic) return
    const db = backend().db
    // Players who hide their online status never broadcast "online".
    const beat = (online: boolean) =>
      db.write([{ type: 'update', path: P.publicDoll(uid), data: { online: online && showOnline, lastActive: Date.now() } }]).catch(() => undefined)
    beat(true)
    const t = window.setInterval(() => document.visibilityState === 'visible' && beat(true), HEARTBEAT_MS)
    const onVis = () => beat(document.visibilityState === 'visible')
    const onHide = () => beat(false)
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('pagehide', onHide)
    return () => {
      window.clearInterval(t)
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('pagehide', onHide)
      beat(false)
    }
  }, [uid, onboarded, hasPublic, showOnline])

  return null
}

/** A doll counts as online if its heartbeat is recent. */
export function isOnline(d: Pick<PublicDoll, 'online' | 'lastActive'> | null | undefined): boolean {
  return !!d && d.online && Date.now() - d.lastActive < 3 * HEARTBEAT_MS
}
