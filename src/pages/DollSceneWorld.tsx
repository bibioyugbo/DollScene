import { lazy, Suspense, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { isOnline } from '../app/SessionProvider'
import { AppShell } from '../components/AppShell'
import { DollAvatar } from '../components/art/DollAvatar'
import { GoOutDialog } from '../components/GoOutDialog'
import { Icon } from '../components/Icon'
import { SceneFallback } from '../components/SceneFallback'
import { SocialButtons } from '../components/social'
import { useAction } from '../hooks/useAction'
import { useDoc, useQueryDocs } from '../hooks/useData'
import { useReducedMotion } from '../hooks/useMediaQuery'
import { useLevel } from '../hooks/useLevel'
import { buttonClass, cx } from '../lib/ui'
import { C, P } from '../shared/paths'
import { PLACE_BY_ID, SCENE_SPOTS, type Place } from '../shared/places'
import type { OutingDoc, PublicDoll } from '../shared/types'
import { useSession } from '../store/useSession'
import { ErrorBoundary } from '../three/ErrorBoundary'

const LagosMap = lazy(() => import('../three/LagosMap'))

const KIND_LABEL: Record<Place['kind'], string> = { date: 'Date spot', hangout: 'Hangout', runway: 'Runway', market: 'Market', party: 'Party' }

function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

/** Where a doll is hanging out right now: residents follow their hangouts, players drift between spots by the hour. */
function placeOf(d: PublicDoll, hour: number): string {
  const hang = d.npc?.hangouts.map((h) => h.toLowerCase()) ?? []
  const match = SCENE_SPOTS.find((p) => hang.some((h) => h.includes(p.name.toLowerCase().split(' ')[0])))
  if (match && hour % 2 === 0) return match.id
  return SCENE_SPOTS[(hash(d.uid) + hour) % SCENE_SPOTS.length].id
}

/** DollScene: the Lagos world, just date spots and runways. */
export default function DollSceneWorld() {
  const [params, setParams] = useSearchParams()
  const me = useSession((s) => s.user!.uid)
  const appearance = useSession((s) => s.doll?.appearance ?? null)
  const friends = useSession((s) => s.friendUids)
  const blocked = useSession((s) => s.blockedUids)
  const reducedMotion = useReducedMotion()
  const selectedId = params.get('place')
  const place = selectedId ? PLACE_BY_ID.get(selectedId) ?? null : null
  const withUid = params.get('with')
  const outingId = params.get('outing')
  const withPub = useDoc<PublicDoll>(withUid ? P.publicDoll(withUid) : null)
  const { data } = useQueryDocs<PublicDoll>(C.publicDolls, { orderBy: ['lastActive', 'desc'], limit: 150 })
  const [goOut, setGoOut] = useState<PublicDoll | null>(null)
  const [pickFriend, setPickFriend] = useState(false)
  const lvl = useLevel()

  const hour = new Date().getHours()
  const here = place ? data.filter((d) => d.uid !== me && !blocked.includes(d.uid) && placeOf(d, hour) === place.id) : []
  const myFriends = data.filter((d) => friends.includes(d.uid))
  const select = (id: string | null) => setParams(id ? { place: id } : {})

  return (
    <AppShell title="DollScene" full>
      <div className="absolute inset-0">
        <ErrorBoundary fallback={<SceneFallback label="The map couldn’t load on this device." />}>
          <Suspense fallback={<SceneFallback label="Spinning up Lagos" />}>
            <LagosMap places={SCENE_SPOTS} selectedId={selectedId} onSelect={select} appearance={appearance} reducedMotion={reducedMotion} />
          </Suspense>
        </ErrorBoundary>
      </div>

      {outingId && <OutingBanner id={outingId} onGo={(o) => setParams({ place: o.place, with: o.from })} />}
      {withPub.data && place && (
        <div className="absolute inset-x-0 top-3 flex justify-center px-3">
          <p className="flex items-center gap-2 rounded-full bg-primary py-1.5 pr-4 pl-1.5 text-sm font-bold text-ink shadow-[var(--shadow-glow)]">
            <DollAvatar avatar={withPub.data.avatar} portrait={withPub.data.portrait} size="sm" />
            Out with {withPub.data.name} at {place.name} ✨
          </p>
        </div>
      )}

      {!place && (
        <div className="pointer-events-none absolute inset-x-0 bottom-4 flex flex-col items-center gap-2 px-3">
          <p className="rounded-full bg-card/90 px-4 py-2 text-sm font-semibold shadow-[var(--shadow-soft)] backdrop-blur">Date spots and runways · tap one to go there</p>
          <div className="pointer-events-auto flex gap-2">
            <Link to="/dollscene/runway" className={buttonClass('primary', 'md')}>
              <Icon name="trophy" className="size-4" /> Runway
            </Link>
            <button type="button" className={buttonClass('secondary', 'md')} onClick={() => setPickFriend(true)}>
              <Icon name={lvl.social ? 'heart' : 'lock'} className="size-4" /> Plan a date
            </button>
          </div>
        </div>
      )}

      {place && (
        <aside className="absolute inset-x-0 bottom-0 flex max-h-[55%] flex-col rounded-t-[var(--radius-sheet)] border-t border-border bg-card/97 backdrop-blur md:inset-x-auto md:top-20 md:right-3 md:bottom-3 md:max-h-none md:w-[360px] md:rounded-[var(--radius-sheet)] md:border" aria-label={place.name}>
          <div className="flex items-start gap-3 p-4 pb-2">
            <span className="mt-1.5 size-3 shrink-0 rounded-full" style={{ background: place.color }} />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
                {place.area} · {KIND_LABEL[place.kind]}
              </p>
              <h2 className="font-display text-xl font-black">{place.name}</h2>
              <p className="text-sm text-muted-foreground">{place.blurb}</p>
            </div>
            <button type="button" aria-label="Close" onClick={() => select(null)} className="grid size-9 shrink-0 place-items-center rounded-full hover:bg-muted">
              <Icon name="close" className="size-4" />
            </button>
          </div>
          <div className="flex flex-wrap gap-2 px-4 pb-3">
            {place.kind === 'runway' && (
              <Link to="/dollscene/runway" className={buttonClass('primary', 'md', 'flex-1')}>
                <Icon name="trophy" className="size-4" /> Walk the runway
              </Link>
            )}
            {place.dates && (
              <button type="button" className={buttonClass('primary', 'md', 'flex-1')} onClick={() => setPickFriend(true)}>
                <Icon name={lvl.social ? 'heart' : 'lock'} className="size-4" /> Bring someone here
              </button>
            )}
          </div>
          <h3 className="px-4 text-sm font-bold">Here right now ({here.length})</h3>
          <ul className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
            {here.map((d) => (
              <li key={d.uid} className="flex items-center gap-2 rounded-2xl px-2 py-2 hover:bg-muted/60">
                <Link to={`/u/${d.uid}`} className="flex min-w-0 flex-1 items-center gap-2">
                  <DollAvatar avatar={d.avatar} portrait={d.portrait} size="sm" online={isOnline(d)} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{d.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{d.kind === 'npc' ? 'Resident' : d.styleTag || d.city}</span>
                  </span>
                </Link>
                {friends.includes(d.uid) ? (
                  place.dates && (
                    <button type="button" className={buttonClass('secondary', 'sm')} onClick={() => setGoOut(d)}>
                      Invite
                    </button>
                  )
                ) : (
                  <div className="flex shrink-0 whitespace-nowrap">
                    <SocialButtons uid={d.uid} name={d.name} compact hideMessage />
                  </div>
                )}
              </li>
            ))}
            {!here.length && <li className="px-2 py-3 text-sm text-muted-foreground">Quiet right now. Bring a friend!</li>}
          </ul>
        </aside>
      )}

      {pickFriend && (
        <FriendPicker
          friends={myFriends}
          onClose={() => setPickFriend(false)}
          onPick={(d) => {
            setPickFriend(false)
            setGoOut(d)
          }}
        />
      )}
      {goOut && <GoOutDialog friend={goOut} place={place?.id} onClose={() => setGoOut(null)} />}
    </AppShell>
  )
}

function FriendPicker({ friends, onClose, onPick }: { friends: PublicDoll[]; onClose: () => void; onPick: (d: PublicDoll) => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-black/40 sm:place-items-center" onClick={onClose}>
      <div role="dialog" aria-modal aria-label="Who are you taking?" className="w-full max-w-sm rounded-t-[var(--radius-sheet)] bg-card p-4 sm:rounded-[var(--radius-sheet)]" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-3 font-display text-lg font-extrabold">Who are you taking?</h2>
        {friends.length ? (
          <ul className="flex max-h-80 flex-col gap-1 overflow-y-auto">
            {friends.map((d) => (
              <li key={d.uid}>
                <button type="button" onClick={() => onPick(d)} className="flex w-full items-center gap-3 rounded-2xl p-2 text-left hover:bg-muted">
                  <DollAvatar avatar={d.avatar} portrait={d.portrait} size="sm" online={isOnline(d)} />
                  <span className="font-semibold">{d.name}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            Add some friends first. Tap a spot to see who’s there, or{' '}
            <Link to="/friends?tab=discover" className="font-semibold underline">
              discover people
            </Link>
            .
          </p>
        )}
        <button type="button" className={buttonClass('secondary', 'md', 'mt-3 w-full')} onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  )
}

function OutingBanner({ id, onGo }: { id: string; onGo: (o: OutingDoc) => void }) {
  const me = useSession((s) => s.user!.uid)
  const o = useDoc<OutingDoc>(P.outing(id))
  const respond = useAction('respondOuting')
  if (!o.data || o.data.to !== me) return null
  const p = PLACE_BY_ID.get(o.data.place)
  return (
    <div className="absolute inset-x-0 top-3 z-10 flex justify-center px-3">
      <div className={cx('flex flex-wrap items-center gap-2 rounded-3xl border-2 border-primary bg-card p-2 pl-4 shadow-[var(--shadow-lift)]')}>
        <span className="text-sm">
          {o.data.kind === 'romantic' ? '💘' : '👯'} <b>{o.data.fromName}</b> {o.data.status === 'pending' ? 'wants to take you to' : 'is meeting you at'} <b>{p?.name}</b>
        </span>
        {o.data.status === 'pending' ? (
          <>
            <button
              type="button"
              className={buttonClass('primary', 'sm')}
              disabled={respond.pending}
              onClick={async () => {
                if (await respond.run({ id, accept: true })) onGo(o.data!)
              }}
            >
              Say yes
            </button>
            <button type="button" className={buttonClass('secondary', 'sm')} disabled={respond.pending} onClick={() => respond.run({ id, accept: false })}>
              Not now
            </button>
          </>
        ) : (
          o.data.status === 'accepted' && (
            <button type="button" className={buttonClass('primary', 'sm')} onClick={() => onGo(o.data!)}>
              Go
            </button>
          )
        )}
      </div>
    </div>
  )
}
