import { lazy, Suspense, useState } from 'react'
import { Link, useParams } from 'react-router'
import { isOnline } from '../app/SessionProvider'
import { AppShell, EmptyState, PageBody, Skeleton } from '../components/AppShell'
import { DollAvatar } from '../components/art/DollAvatar'
import { Icon } from '../components/Icon'
import { PostCard } from '../components/PostCard'
import { SceneFallback } from '../components/SceneFallback'
import { ConfirmDialog, ReportDialog, SocialButtons, useRelationship } from '../components/social'
import { runAction } from '../hooks/useAction'
import { useDoc, useQueryDocs } from '../hooks/useData'
import { useReducedMotion } from '../hooks/useMediaQuery'
import { buttonClass, timeAgo } from '../lib/ui'
import { careerTitle } from '../shared/careers'
import { fameTier } from '../shared/economy'
import { C, P } from '../shared/paths'
import type { DollDoc, PostDoc, PublicDoll } from '../shared/types'
import { useSession } from '../store/useSession'
import { KindBadge } from '../components/KindBadge'
import { AESTHETIC_LABEL } from '../shared/aesthetics'
import { NPC_BY_ID } from '../shared/npcs'
import { APP_NAME } from '../config/env'

const DollStage = lazy(() => import('../three/DollStage'))

export default function Profile() {
  const { uid = '' } = useParams()
  const me = useSession((s) => s.user!.uid)
  const pub = useDoc<PublicDoll>(P.publicDoll(uid))
  const doll = useDoc<DollDoc>(P.doll(uid))
  const posts = useQueryDocs<PostDoc>(C.posts, { where: [['authorId', '==', uid]], orderBy: ['createdAt', 'desc'], limit: 30 })
  const follow = useDoc<{ follower: string }>(uid !== me ? P.follow(me, uid) : null)
  const rel = useRelationship(uid)
  const reducedMotion = useReducedMotion()
  const [report, setReport] = useState(false)
  const [block, setBlock] = useState(false)
  const [unfriend, setUnfriend] = useState(false)
  const self = uid === me
  const d = pub.data
  const online = !!d && isOnline(d) && d.privacy?.showOnline !== false

  if (pub.loading) return <AppShell title="Profile"><PageBody><Skeleton className="h-72" /></PageBody></AppShell>
  if (!d) return <AppShell title="Profile"><PageBody><EmptyState icon="user" title="This doll moved away" body="The profile doesn’t exist or was deleted." /></PageBody></AppShell>

  return (
    <AppShell title={d.name}>
      <PageBody className="flex flex-col gap-5">
        <section className="grid gap-5 overflow-hidden rounded-[var(--radius-sheet)] border border-border bg-card md:grid-cols-[320px_minmax(0,1fr)]">
          <div className="relative h-80 bg-[linear-gradient(160deg,#F5D4DA,#DCD9E2)] dark:bg-[linear-gradient(160deg,#241C27,#0E0B10)] md:h-[440px]">
            {doll.data ? (
              <Suspense fallback={<SceneFallback label="Loading doll" />}>
                <DollStage appearance={doll.data.appearance} turntable reducedMotion={reducedMotion} label={`${d.name}'s doll`} />
              </Suspense>
            ) : (
              <div className="grid h-full place-items-center">
                <DollAvatar avatar={d.avatar} portrait={d.portrait} size="xl" />
              </div>
            )}
          </div>
          <div className="flex flex-col gap-4 p-5 md:pl-0">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <KindBadge kind={d.kind} />
                {online && <span className="rounded-full bg-[#22C55E]/15 px-2 py-0.5 text-xs font-semibold text-[#15803D] dark:text-[#4ADE80]">Online</span>}
              </div>
              <h2 className="mt-1 font-display text-3xl font-extrabold tracking-tight">{d.name}</h2>
              <p className="text-muted-foreground">
                {d.username && `@${d.username} · `}
                {d.pronouns && `${d.pronouns} · `}
                {d.city && d.privacy?.showLocation !== false ? `${d.city}, ${d.country}` : 'Location hidden'}
                {!online && d.privacy?.showOnline !== false && ` · active ${timeAgo(d.lastActive)}`}
              </p>
              {d.bio && <p className="mt-2 text-[15px]">{d.bio}</p>}
              {(d.aesthetics?.length ?? 0) > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {d.aesthetics.map((x) => (
                    <span key={x} className="rounded-full border border-border px-2.5 py-0.5 text-xs font-semibold">
                      {AESTHETIC_LABEL[x]}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-secondary/15 px-3 py-1 text-sm font-semibold text-secondary">
                <Icon name="work" className="mr-1 inline size-4" />
                {careerTitle(d.career, d.careerLevel)}
              </span>
              <span className="rounded-full bg-gold/25 px-3 py-1 text-sm font-semibold">
                <Icon name="star" className="mr-1 inline size-4" />
                {fameTier(d.fame)}
              </span>
              <span className="rounded-full bg-primary/15 px-3 py-1 text-sm font-semibold text-primary">{d.styleTag}</span>
              {(d.badges ?? [])
                .filter((b) => b !== 'Resident')
                .map((b) => (
                  <span key={b} className="rounded-full bg-accent px-3 py-1 text-sm font-semibold text-accent-foreground">
                    <Icon name="trophy" className="mr-1 inline size-4" />
                    {b}
                  </span>
                ))}
            </div>
            {d.npc && (
              <div className="grid gap-3 rounded-2xl bg-muted/70 p-4 text-sm sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <p className="text-xs font-bold tracking-wide text-muted-foreground uppercase">Lore</p>
                  <p>{d.npc.lore}</p>
                </div>
                <div>
                  <p className="text-xs font-bold tracking-wide text-muted-foreground uppercase">Personality</p>
                  <p>{d.npc.personality}</p>
                </div>
                <div>
                  <p className="text-xs font-bold tracking-wide text-muted-foreground uppercase">Job</p>
                  <p>{d.npc.job}</p>
                </div>
                <div>
                  <p className="text-xs font-bold tracking-wide text-muted-foreground uppercase">Routine</p>
                  <p>{d.npc.routine.join(' · ')}</p>
                </div>
                <div>
                  <p className="text-xs font-bold tracking-wide text-muted-foreground uppercase">Hangouts</p>
                  <p>{d.npc.hangouts.join(' · ')}</p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-xs font-bold tracking-wide text-muted-foreground uppercase">Circle</p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {d.npc.circle.map((c) => (
                      <Link key={c} to={`/u/${c}`} className="rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold">
                        {NPC_BY_ID.get(c)?.name ?? c}
                      </Link>
                    ))}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground sm:col-span-2">Residents are fictional characters run by {APP_NAME}. They’re here to make the world feel alive, never to pose as real people.</p>
              </div>
            )}
            <dl className="grid grid-cols-4 gap-2 text-center">
              {[
                ['Posts', posts.data.length],
                ['Followers', d.followers],
                ['Following', d.following],
                ['Friends', d.friendCount],
              ].map(([k, v]) => (
                <div key={k} className="rounded-2xl bg-muted py-2">
                  <dt className="text-xs text-muted-foreground">{k}</dt>
                  <dd className="font-display text-lg font-bold">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="text-sm">
              <span className="font-semibold">Wearing:</span> <span className="text-muted-foreground">{d.outfitSummary}</span>
            </p>
            {self ? (
              <div className="flex flex-wrap gap-2">
                <Link to="/makeover" className={buttonClass('primary', 'md')}>
                  <Icon name="edit" className="size-4" /> Edit look
                </Link>
                <Link to="/crib" className={buttonClass('secondary', 'md')}>
                  <Icon name="crib" className="size-4" /> My crib
                </Link>
                <Link to="/settings" className={buttonClass('secondary', 'md')}>
                  <Icon name="settings" className="size-4" /> Settings
                </Link>
              </div>
            ) : (
              <>
                <div className="flex gap-2">
                  <SocialButtons uid={uid} name={d.name} />
                </div>
                <div className="flex flex-wrap gap-2">
                  {rel !== 'blocked' && (
                    <button type="button" className={buttonClass('secondary', 'md')} onClick={() => runAction('toggleFollow', { uid })}>
                      {follow.data ? 'Following' : 'Follow'}
                    </button>
                  )}
                  <Link to={`/crib/visit/${uid}`} className={buttonClass('secondary', 'md')}>
                    <Icon name="door" className="size-4" /> Apartment tour
                  </Link>
                  {rel === 'friends' && (
                    <button type="button" className={buttonClass('ghost', 'md')} onClick={() => setUnfriend(true)}>
                      Unfriend
                    </button>
                  )}
                  <button type="button" className={buttonClass('ghost', 'md')} onClick={() => setReport(true)}>
                    <Icon name="flag" className="size-4" /> Report
                  </button>
                  {rel !== 'blocked' && (
                    <button type="button" className={buttonClass('ghost', 'md', 'text-[#B3123F]')} onClick={() => setBlock(true)}>
                      <Icon name="block" className="size-4" /> Block
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </section>

        <section>
          <h2 className="mb-3 font-display text-lg font-bold">Lookbook</h2>
          {posts.data.length ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {posts.data.map((p) => (
                <PostCard key={p.id} post={p} />
              ))}
            </div>
          ) : (
            <EmptyState icon="image" title="No posts yet" body={self ? 'Post a look from your wardrobe or a tour of your crib.' : undefined} />
          )}
        </section>
      </PageBody>

      <ReportDialog open={report} onClose={() => setReport(false)} targetType="profile" targetId={uid} targetUid={uid} name={d.name} />
      <ConfirmDialog open={block} onClose={() => setBlock(false)} title={`Block ${d.name}?`} body="They won’t be able to message you, send requests or comment. You can unblock in Settings." confirmLabel="Block" danger onConfirm={() => void runAction('block', { uid })} />
      <ConfirmDialog open={unfriend} onClose={() => setUnfriend(false)} title={`Unfriend ${d.name}?`} body="You can send a new request later." confirmLabel="Unfriend" danger onConfirm={() => void runAction('removeFriend', { uid })} />
    </AppShell>
  )
}
