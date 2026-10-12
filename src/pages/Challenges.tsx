import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { AppShell, EmptyState, PageBody, Skeleton } from '../components/AppShell'
import { DollFigure } from '../components/art/DollFigure'
import { KindBadge } from '../components/KindBadge'
import { runAction, useAction } from '../hooks/useAction'
import { useQueryDocs } from '../hooks/useData'
import { buttonClass, cx, inputClass } from '../lib/ui'
import { AESTHETIC_LABEL } from '../shared/aesthetics'
import { CHALLENGE_REWARDS, challengeTitle, currentChallenges, type ChallengeRun } from '../shared/challenges'
import { CURRENCY } from '../shared/economy'
import { outfitSummary } from '../shared/appearance'
import { C } from '../shared/paths'
import type { ChallengeEntryDoc } from '../shared/types'
import { useSession } from '../store/useSession'
import { toast } from '../store/useToasts'

function useCountdown(to: number) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(t)
  }, [])
  const ms = Math.max(0, to - now)
  const h = Math.floor(ms / 3600000)
  return h >= 24 ? `${Math.floor(h / 24)}d ${h % 24}h left` : `${h}h ${Math.floor((ms % 3600000) / 60000)}m left`
}

function ChallengeBoard({ run, myVotes }: { run: ChallengeRun; myVotes: Set<string> }) {
  const me = useSession((s) => s.user!.uid)
  const doll = useSession((s) => s.doll)!
  const pub = useSession((s) => s.publicDoll)
  const left = useCountdown(run.endsAt)
  const { data, loading } = useQueryDocs<ChallengeEntryDoc>(C.challengeEntries, { where: [['challengeKey', '==', run.key]], orderBy: ['votes', 'desc'], limit: 40 })
  const enter = useAction('enterChallenge')
  const vote = useAction('voteChallenge')
  const [caption, setCaption] = useState('')
  const mine = data.find((e) => e.uid === me)

  useEffect(() => {
    void runAction('ensureChallengeNpcEntries', { challengeKey: run.key }, { silent: true })
  }, [run.key])

  return (
    <section className="flex flex-col gap-4 rounded-[var(--radius-sheet)] border border-border bg-card p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold tracking-[0.18em] text-primary uppercase">
            {run.period === 'daily' ? 'Daily challenge' : 'Weekly challenge'} · {AESTHETIC_LABEL[run.aesthetic]}
          </p>
          <h2 className="font-display text-2xl font-extrabold tracking-tight">{run.title}</h2>
          <p className="text-muted-foreground">{run.prompt}</p>
        </div>
        <span className="rounded-full bg-muted px-3 py-1 text-sm font-semibold tabular-nums">{left}</span>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl bg-muted/60 p-3 sm:flex-row sm:items-center">
        <div className="grid h-28 w-20 shrink-0 place-items-center rounded-xl bg-[linear-gradient(160deg,#F5D4DA,#DCD9E2)]">
          {pub && <DollFigure avatar={pub.avatar} outfit={doll.appearance.outfit} className="h-24 w-auto" />}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <p className="text-sm">
            {mine ? (
              <>
                You’re in with <span className="font-semibold">{outfitSummary(mine.outfit)}</span> · {mine.votes} vote{mine.votes === 1 ? '' : 's'}
              </>
            ) : (
              <>
                Enter your current look ({outfitSummary(doll.appearance.outfit)}). +{CHALLENGE_REWARDS.enter} {CURRENCY.name} for taking part.
              </>
            )}
          </p>
          <div className="flex gap-2">
            <input value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={140} placeholder="Caption (optional)" className={cx(inputClass, 'min-h-10')} aria-label="Caption" />
            <button
              type="button"
              className={buttonClass('primary', 'md')}
              disabled={enter.pending}
              onClick={async () => {
                const r = await enter.run({ challengeKey: run.key, caption })
                if (r) toast.success(r.reward ? `Entered! +${r.reward} ${CURRENCY.name}` : 'Look updated')
              }}
            >
              {mine ? 'Update look' : 'Enter'}
            </button>
          </div>
          <Link to="/wardrobe" className="text-xs font-semibold text-secondary">
            Change outfit in your wardrobe first →
          </Link>
        </div>
      </div>

      {loading ? (
        <Skeleton className="h-56" />
      ) : data.length ? (
        <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {data.map((e, i) => {
            const voted = myVotes.has(e.id)
            const own = e.uid === me
            return (
              <li key={e.id} className="flex flex-col overflow-hidden rounded-2xl border border-border bg-background">
                <div className="relative grid h-44 place-items-center bg-[linear-gradient(160deg,#F5D4DA,#DCD9E2)]">
                  <DollFigure avatar={e.avatar} outfit={e.outfit} className="h-40 w-auto" />
                  {i < 3 && <span className="absolute top-2 left-2 grid size-7 place-items-center rounded-full bg-ink text-xs font-black text-bone">{i + 1}</span>}
                </div>
                <div className="flex flex-1 flex-col gap-1 p-2.5">
                  <div className="flex items-center justify-between gap-1">
                    <Link to={`/u/${e.uid}`} className="truncate text-sm font-semibold">
                      {e.name}
                    </Link>
                    <KindBadge kind={e.kind} className="shrink-0 !px-1.5 !text-[9px]" />
                  </div>
                  {e.caption && <p className="line-clamp-2 text-xs text-muted-foreground">{e.caption}</p>}
                  <button
                    type="button"
                    disabled={own || voted || vote.pending}
                    onClick={async () => {
                      const r = await vote.run({ entryId: e.id })
                      if (r) toast.success(`Voted · +${CHALLENGE_REWARDS.vote} ${CURRENCY.name}`)
                    }}
                    className={buttonClass(voted ? 'secondary' : 'primary', 'sm', 'mt-auto')}
                    aria-label={`Vote for ${e.name}`}
                  >
                    {own ? 'Your look' : voted ? 'Voted' : 'Vote'} · {e.votes}
                  </button>
                </div>
              </li>
            )
          })}
        </ol>
      ) : (
        <EmptyState icon="trophy" title="No entries yet" body="Be the first to enter." />
      )}
    </section>
  )
}

function PastPrize({ challengeKey }: { challengeKey: string }) {
  const me = useSession((s) => s.user!.uid)
  const claimed = useSession((s) => !!s.progress?.counters[`prize:${challengeKey}`])
  const { data } = useQueryDocs<ChallengeEntryDoc>(C.challengeEntries, { where: [['challengeKey', '==', challengeKey]], orderBy: ['votes', 'desc'], limit: 3 })
  const claim = useAction('claimChallengePrize')
  const rank = data.findIndex((e) => e.uid === me)
  if (!data.length) return null
  return (
    <li className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-3">
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{challengeTitle(challengeKey)}</span>
        <span className="block text-sm text-muted-foreground">Winner: {data[0].name} ({data[0].votes} votes)</span>
      </span>
      {rank >= 0 &&
        (claimed ? (
          <span className="text-sm font-semibold text-muted-foreground">Prize claimed</span>
        ) : (
          <button
            type="button"
            className={buttonClass('primary', 'sm')}
            disabled={claim.pending}
            onClick={async () => {
              const r = await claim.run({ challengeKey })
              if (r) toast.success(`#${r.rank}! +${r.prize} ${CURRENCY.name}`)
            }}
          >
            Claim #{rank + 1} prize · {CHALLENGE_REWARDS.prize[rank]}
          </button>
        ))}
    </li>
  )
}

export default function Challenges() {
  const me = useSession((s) => s.user!.uid)
  const runs = useMemo(() => currentChallenges(Date.now()), [])
  const votes = useQueryDocs<{ entryId: string }>(C.challengeVotes, { where: [['uid', '==', me]], limit: 500 })
  const myVotes = useMemo(() => new Set(votes.data.map((v) => v.entryId)), [votes.data])
  // The most recent finished runs, for prize claims.
  const past = useMemo(() => {
    const y = Date.now() - 86400000
    const lw = Date.now() - 7 * 86400000
    const prevDaily = currentChallenges(y)[0]
    const prevWeekly = currentChallenges(lw)[1]
    return [prevDaily, prevWeekly].filter((r) => !runs.some((c) => c.key === r.key)).map((r) => r.key)
  }, [runs])

  return (
    <AppShell title="Challenges">
      <PageBody className="flex flex-col gap-5">
        <p className="max-w-2xl text-muted-foreground">
          Style the theme, enter your look, vote for your favourites. Everyone who enters earns {CURRENCY.name}; the top three take the prizes. Residents (NPCs) enter too and are always labelled.
        </p>
        {runs.map((r) => (
          <ChallengeBoard key={r.key} run={r} myVotes={myVotes} />
        ))}
        <section>
          <h2 className="mb-2 font-display text-lg font-extrabold">Results</h2>
          <ul className="flex flex-col gap-2">
            {past.map((k) => (
              <PastPrize key={k} challengeKey={k} />
            ))}
          </ul>
        </section>
      </PageBody>
    </AppShell>
  )
}
