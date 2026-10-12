import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { isOnline } from '../app/SessionProvider'
import { AppShell, EmptyState, PageBody, Skeleton } from '../components/AppShell'
import { DollAvatar } from '../components/art/DollAvatar'
import { DollTile } from '../components/DollCards'
import { Icon } from '../components/Icon'
import { GoOutDialog } from '../components/GoOutDialog'
import { useOpenChat } from '../components/social'
import { runAction, useAction } from '../hooks/useAction'
import { useDoc, useQueryDocs } from '../hooks/useData'
import { buttonClass, chipClass, cx, inputClass, timeAgo } from '../lib/ui'
import { AESTHETICS } from '../shared/aesthetics'
import { C, P } from '../shared/paths'
import { PLACE_BY_ID } from '../shared/places'
import type { Aesthetic, ConversationDoc, FriendRequestDoc, FriendshipDoc, OutingDoc, PublicDoll } from '../shared/types'
import { useSession } from '../store/useSession'

type Tab = 'friends' | 'requests' | 'chats' | 'discover'
const TABS: { id: Tab; label: string }[] = [
  { id: 'friends', label: 'Friends' },
  { id: 'requests', label: 'Requests' },
  { id: 'chats', label: 'Chats' },
  { id: 'discover', label: 'Discover' },
]

/** Friends: your people, your chats, your invites, and new faces. */
export default function Friends() {
  const [params, setParams] = useSearchParams()
  const tab = (TABS.find((t) => t.id === params.get('tab'))?.id ?? 'friends') as Tab
  const pendingRequests = useSession((s) => s.pendingRequests)
  const unread = useSession((s) => s.unreadMessages)
  const badge = (t: Tab) => (t === 'requests' ? pendingRequests : t === 'chats' ? unread : 0)
  return (
    <AppShell title="Friends">
      <PageBody className="flex max-w-3xl flex-col gap-4">
        <div role="tablist" aria-label="Friends" className="no-scrollbar flex gap-1 overflow-x-auto rounded-full border border-border bg-card p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              type="button"
              aria-selected={tab === t.id}
              onClick={() => setParams(t.id === 'friends' ? {} : { tab: t.id })}
              className={cx('relative min-h-10 flex-1 rounded-full px-4 text-sm font-semibold whitespace-nowrap', tab === t.id ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-muted')}
            >
              {t.label}
              {badge(t.id) > 0 && <span className="ml-1.5 rounded-full bg-primary px-1.5 text-[11px] font-black text-ink">{badge(t.id)}</span>}
            </button>
          ))}
        </div>
        {tab === 'friends' && <FriendsTab />}
        {tab === 'requests' && <RequestsTab />}
        {tab === 'chats' && <ChatsTab requests={params.get('box') === 'requests'} onBox={(r) => setParams(r ? { tab: 'chats', box: 'requests' } : { tab: 'chats' })} />}
        {tab === 'discover' && <DiscoverTab />}
      </PageBody>
    </AppShell>
  )
}

/* ------------------------------------------------------------------ friends */

function FriendsTab() {
  const friends = useSession((s) => s.friendUids)
  const [goOut, setGoOut] = useState<PublicDoll | null>(null)
  return (
    <>
      <InvitesInbox />
      {friends.length ? (
        <ul className="flex flex-col gap-2">
          {friends.map((uid) => (
            <FriendRow key={uid} uid={uid} onGoOut={setGoOut} />
          ))}
        </ul>
      ) : (
        <EmptyState
          icon="people"
          title="No friends yet"
          body="Meet people in Discover or out in the DollScene. Residents always say yes."
          action={
            <Link to="/friends?tab=discover" className={buttonClass('primary', 'md')}>
              Find people
            </Link>
          }
        />
      )}
      {goOut && <GoOutDialog friend={goOut} onClose={() => setGoOut(null)} />}
    </>
  )
}

function FriendRow({ uid, onGoOut }: { uid: string; onGoOut: (d: PublicDoll) => void }) {
  const me = useSession((s) => s.user!.uid)
  const pub = useDoc<PublicDoll>(P.publicDoll(uid))
  const f = useDoc<FriendshipDoc>(P.friendship(me, uid))
  const openChat = useOpenChat()
  const d = pub.data
  if (!d) return <Skeleton className="h-20" />
  const fav = f.data?.favouriteOf.includes(me) ?? false
  return (
    <li className="flex flex-wrap items-center gap-3 rounded-[var(--radius-sheet)] border border-border bg-card p-3">
      <Link to={`/u/${uid}`} className="flex min-w-0 flex-1 items-center gap-3">
        <DollAvatar avatar={d.avatar} portrait={d.portrait} online={isOnline(d)} />
        <span className="min-w-0">
          <span className="block truncate font-semibold">
            {d.name} {d.kind === 'npc' && <span className="ml-1 rounded-full bg-muted px-1.5 text-[10px] font-bold text-muted-foreground uppercase">Resident</span>}
          </span>
          <span className="block truncate text-xs text-muted-foreground">{isOnline(d) ? 'Online now' : `Active ${timeAgo(d.lastActive)}`}</span>
        </span>
      </Link>
      <div className="flex items-center gap-1.5">
        <button type="button" aria-label={fav ? `Unfavourite ${d.name}` : `Favourite ${d.name}`} aria-pressed={fav} onClick={() => runAction('toggleFavourite', { uid })} className="grid size-10 place-items-center rounded-full hover:bg-muted">
          <Icon name="star" filled={fav} className={cx('size-5', fav && 'text-[#E9C46A]')} />
        </button>
        <button type="button" className={buttonClass('secondary', 'sm')} onClick={() => openChat(uid)}>
          <Icon name="chat" className="size-4" /> Chat
        </button>
        <Link to={`/crib/visit/${uid}`} className={buttonClass('secondary', 'sm')}>
          <Icon name="door" className="size-4" /> Visit
        </Link>
        <button type="button" className={buttonClass('primary', 'sm')} onClick={() => onGoOut(d)}>
          <Icon name="sparkle" className="size-4" /> Go out
        </button>
      </div>
    </li>
  )
}

function InvitesInbox() {
  const me = useSession((s) => s.user!.uid)
  const navigate = useNavigate()
  const { data } = useQueryDocs<OutingDoc>(C.outings, { where: [['to', '==', me]], orderBy: ['createdAt', 'desc'], limit: 20 })
  const respond = useAction('respondOuting')
  const pending = data.filter((o) => o.status === 'pending')
  if (!pending.length) return null
  return (
    <section className="rounded-[var(--radius-sheet)] border-2 border-primary bg-primary/10 p-3">
      <h2 className="mb-2 font-display text-lg font-extrabold">Date invites</h2>
      <ul className="flex flex-col gap-2">
        {pending.map((o) => (
          <li key={o.id} className="flex flex-wrap items-center gap-2">
            <span className="min-w-0 flex-1 text-sm">
              {o.kind === 'romantic' ? '💘' : '👯'} <b>{o.fromName}</b> invited you on a {o.kind} date at <b>{PLACE_BY_ID.get(o.place)?.name}</b>
            </span>
            <button
              type="button"
              className={buttonClass('primary', 'sm')}
              disabled={respond.pending}
              onClick={async () => {
                if (await respond.run({ id: o.id, accept: true })) navigate(`/dollscene?place=${o.place}&with=${o.from}`)
              }}
            >
              Say yes
            </button>
            <button type="button" className={buttonClass('secondary', 'sm')} disabled={respond.pending} onClick={() => respond.run({ id: o.id, accept: false })}>
              Not now
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

/* ----------------------------------------------------------------- requests */

function RequestsTab() {
  const me = useSession((s) => s.user!.uid)
  const incoming = useQueryDocs<FriendRequestDoc>(C.friendRequests, { where: [['to', '==', me], ['status', '==', 'pending']] })
  const outgoing = useQueryDocs<FriendRequestDoc>(C.friendRequests, { where: [['from', '==', me], ['status', '==', 'pending']] })
  const respond = useAction('respondFriendRequest')
  if (incoming.loading && outgoing.loading) return <Skeleton className="h-40" />
  return (
    <div className="flex flex-col gap-5">
      <section>
        <h2 className="mb-2 font-display text-lg font-extrabold">Want to be friends</h2>
        {incoming.data.length ? (
          <ul className="flex flex-col gap-2">
            {incoming.data.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 rounded-[var(--radius-sheet)] border border-border bg-card p-3">
                <RequestWho uid={r.from} name={r.fromName} note={r.note} at={r.createdAt} />
                <div className="flex gap-1.5">
                  <button type="button" className={buttonClass('primary', 'sm')} disabled={respond.pending} onClick={() => respond.run({ from: r.from, action: 'accept' })}>
                    Accept
                  </button>
                  <button type="button" className={buttonClass('secondary', 'sm')} disabled={respond.pending} onClick={() => respond.run({ from: r.from, action: 'decline' })}>
                    Decline
                  </button>
                  <button
                    type="button"
                    aria-label={`Block ${r.fromName}`}
                    className="grid size-9 place-items-center rounded-full hover:bg-muted"
                    onClick={() => window.confirm(`Block ${r.fromName}?`) && respond.run({ from: r.from, action: 'block' })}
                  >
                    <Icon name="block" className="size-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No requests right now.</p>
        )}
      </section>
      <section>
        <h2 className="mb-2 font-display text-lg font-extrabold">Sent</h2>
        {outgoing.data.length ? (
          <ul className="flex flex-col gap-2">
            {outgoing.data.map((r) => (
              <li key={r.id} className="flex items-center gap-3 rounded-[var(--radius-sheet)] border border-border bg-card p-3">
                <RequestWho uid={r.to} name={r.toName} at={r.createdAt} />
                <button type="button" className={buttonClass('secondary', 'sm')} onClick={() => runAction('cancelFriendRequest', { to: r.to })}>
                  Cancel
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Nothing pending.</p>
        )}
      </section>
    </div>
  )
}

function RequestWho({ uid, name, note, at }: { uid: string; name: string; note?: string; at: number }) {
  const pub = useDoc<PublicDoll>(P.publicDoll(uid))
  return (
    <Link to={`/u/${uid}`} className="flex min-w-0 flex-1 items-center gap-3">
      <DollAvatar avatar={pub.data?.avatar} portrait={pub.data?.portrait} />
      <span className="min-w-0">
        <span className="block truncate font-semibold">{name}</span>
        <span className="block truncate text-xs text-muted-foreground">{note ? `“${note}”` : timeAgo(at)}</span>
      </span>
    </Link>
  )
}

/* -------------------------------------------------------------------- chats */

function ChatsTab({ requests, onBox }: { requests: boolean; onBox: (requests: boolean) => void }) {
  const me = useSession((s) => s.user!.uid)
  const blocked = useSession((s) => s.blockedUids)
  const { data, loading } = useQueryDocs<ConversationDoc>(C.conversations, { where: [['members', 'array-contains', me]], orderBy: ['updatedAt', 'desc'], limit: 100 })
  const visible = data.filter((c) => !c.members.some((m) => m !== me && blocked.includes(m)))
  const inbox = visible.filter((c) => c.status === 'active' || c.requestedBy === me)
  const reqs = visible.filter((c) => c.status === 'request' && c.requestedBy !== me)
  const list = requests ? reqs : inbox
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <button type="button" aria-pressed={!requests} onClick={() => onBox(false)} className={chipClass(!requests)}>
          Inbox
        </button>
        <button type="button" aria-pressed={requests} onClick={() => onBox(true)} className={chipClass(requests)}>
          Message requests {reqs.length > 0 && `(${reqs.length})`}
        </button>
      </div>
      {loading && !data.length ? (
        <Skeleton className="h-48" />
      ) : list.length ? (
        <ul className="divide-y divide-border overflow-hidden rounded-[var(--radius-sheet)] border border-border bg-card">
          {list.map((c) => (
            <ConversationRow key={c.id} c={c} me={me} />
          ))}
        </ul>
      ) : (
        <EmptyState icon="chat" title={requests ? 'No message requests' : 'No chats yet'} body={requests ? 'People who aren’t your friends land here first.' : 'Flip open the phone from any friend’s row.'} />
      )}
    </div>
  )
}

function ConversationRow({ c, me }: { c: ConversationDoc; me: string }) {
  const other = c.members.find((m) => m !== me) ?? ''
  const pub = useDoc<PublicDoll>(other ? P.publicDoll(other) : null)
  const unread = c.unread?.[me] ?? 0
  return (
    <li>
      <Link to={`/friends/chat/${c.id}`} className="flex items-center gap-3 px-3 py-3 hover:bg-muted">
        <DollAvatar avatar={pub.data?.avatar} portrait={pub.data?.portrait} online={isOnline(pub.data)} />
        <span className="min-w-0 flex-1">
          <span className={cx('block truncate', unread ? 'font-bold' : 'font-semibold')}>{pub.data?.name ?? c.names[other]}</span>
          <span className={cx('block truncate text-sm', unread ? 'text-foreground' : 'text-muted-foreground')}>
            {c.lastMessage ? `${c.lastMessage.senderId === me ? 'You: ' : ''}${c.lastMessage.text}` : 'Say hi 👋'}
          </span>
        </span>
        <span className="flex flex-col items-end gap-1">
          <span className="text-xs text-muted-foreground">{timeAgo(c.updatedAt)}</span>
          {unread > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[11px] font-black text-ink">{unread}</span>}
        </span>
      </Link>
    </li>
  )
}

/* ----------------------------------------------------------------- discover */

function DiscoverTab() {
  const me = useSession((s) => s.user!.uid)
  const friends = useSession((s) => s.friendUids)
  const blocked = useSession((s) => s.blockedUids)
  const [q, setQ] = useState('')
  const [aes, setAes] = useState<Aesthetic | null>(null)
  const [who, setWho] = useState<'all' | 'online' | 'player' | 'npc'>('all')
  const { data, loading } = useQueryDocs<PublicDoll>(C.publicDolls, { orderBy: ['lastActive', 'desc'], limit: 120 })
  const needle = q.trim().toLowerCase()
  const list = data.filter(
    (d) =>
      d.uid !== me &&
      !blocked.includes(d.uid) &&
      !friends.includes(d.uid) &&
      (!needle || d.name.toLowerCase().includes(needle) || d.username?.toLowerCase().includes(needle) || d.city?.toLowerCase().includes(needle)) &&
      (!aes || d.aesthetics?.includes(aes)) &&
      (who === 'all' || (who === 'online' ? isOnline(d) : d.kind === who)),
  )
  return (
    <div className="flex flex-col gap-3">
      <label className="relative">
        <span className="sr-only">Search</span>
        <Icon name="search" className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, @username or city" className={cx(inputClass, 'pl-9')} />
      </label>
      <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
        {(['all', 'online', 'player', 'npc'] as const).map((w) => (
          <button key={w} type="button" aria-pressed={who === w} onClick={() => setWho(w)} className={chipClass(who === w)}>
            {w === 'all' ? 'Everyone' : w === 'online' ? 'Online' : w === 'player' ? 'Players' : 'Residents'}
          </button>
        ))}
        <span className="mx-1 w-px shrink-0 bg-border" />
        {AESTHETICS.map((a) => (
          <button key={a.id} type="button" aria-pressed={aes === a.id} onClick={() => setAes(aes === a.id ? null : a.id)} className={chipClass(aes === a.id)}>
            {a.label}
          </button>
        ))}
      </div>
      {loading && !data.length ? (
        <Skeleton className="h-64" />
      ) : list.length ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {list.map((d) => (
            <DollTile key={d.uid} doll={d} href={`/u/${d.uid}`} />
          ))}
        </div>
      ) : (
        <EmptyState icon="search" title="No one matches" body="Try a different filter." />
      )}
    </div>
  )
}
