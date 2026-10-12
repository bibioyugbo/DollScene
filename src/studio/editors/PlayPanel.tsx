import { useEffect, useState } from 'react'
import { briefForDay, levelFor, scoreLook, studioDay, type ScoreResult } from '../../shared/studio/challenges'
import { PRODUCTS, PREMIUM_SWATCHES } from '../../shared/studio/products'
import { buy, submitChallenge } from '../session'
import { useStudio } from '../state/store'
import { vatar, type VatarLeaderboard } from '../vatar/sdk'
import { Chips, Section, TextButton } from '../ui/controls'

type View = 'brief' | 'board' | 'shop'

export function PlayPanel() {
  const [view, setView] = useState<View>('brief')
  return (
    <div className="flex flex-col gap-4">
      <Chips
        label="Play"
        value={view}
        onPick={setView}
        options={[
          { id: 'brief', name: 'Daily brief' },
          { id: 'board', name: 'Leaderboard' },
          { id: 'shop', name: 'Shop' },
        ]}
      />
      {view === 'brief' && <Brief />}
      {view === 'board' && <Board />}
      {view === 'shop' && <Shop />}
    </div>
  )
}

function Brief() {
  const look = useStudio((s) => s.look)
  const xp = useStudio((s) => s.xp)
  const best = useStudio((s) => s.todayBest)
  const [brief] = useState(() => briefForDay(studioDay(Date.now())))
  const live = scoreLook(brief, look)
  const [result, setResult] = useState<(ScoreResult & { gain: number }) | null>(null)
  const [busy, setBusy] = useState(false)
  const lvl = levelFor(xp)

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-[11px] uppercase tracking-[0.18em] text-accent">Today’s brief</p>
        <h3 className="font-display text-[24px] leading-tight italic">{brief.title}</h3>
        <p className="mt-1 text-[13px] leading-relaxed text-muted">{brief.story}</p>
      </div>
      <ul className="flex flex-col gap-1.5">
        {live.parts.map((p) => (
          <li key={p.id} className="flex items-center gap-3 text-[13px]">
            <span className="relative h-1 w-16 shrink-0 overflow-hidden rounded-full bg-line" aria-hidden>
              <span className="absolute inset-y-0 left-0 bg-accent transition-[width]" style={{ width: `${Math.round(p.got * 100)}%` }} />
            </span>
            <span className={p.got > 0.85 ? 'text-text' : 'text-muted'}>{p.label}</span>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-3">
        <TextButton
          tone="accent"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            const r = await submitChallenge()
            setBusy(false)
            if (r) setResult(r)
          }}
        >
          Send to the judges
        </TextButton>
        <p className="text-[12px] text-muted">
          Preview score <span className="text-text">{live.score}</span>
          {best !== null && <> · today’s best {best}</>}
        </p>
      </div>
      {result && (
        <p className="ds-enter rounded-xl border border-line px-3 py-2 text-[13px]">
          The judges gave you <b className="text-accent">{result.score}</b>. {result.gain > 0 ? `+${result.gain} XP.` : 'Beat your best for more XP.'}
        </p>
      )}
      <div className="border-t border-line pt-3">
        <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Your career</p>
        <p className="font-display text-[18px] italic">{lvl.name}</p>
        <div className="mt-1 h-1 overflow-hidden rounded-full bg-line">
          <div className="h-full bg-accent" style={{ width: `${Math.round(lvl.progress * 100)}%` }} />
        </div>
        <p className="mt-1 text-[11px] text-muted">{lvl.next ? `${xp} / ${lvl.next} XP` : `${xp} XP`}</p>
      </div>
    </div>
  )
}

function Board() {
  const connection = useStudio((s) => s.connection)
  const [board, setBoard] = useState<VatarLeaderboard | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (connection !== 'live' && connection !== 'test') return
    let live = true
    vatar.leaderboard().then(
      (b) => live && setBoard(b),
      () => live && setError('The leaderboard isn’t available right now.'),
    )
    return () => {
      live = false
    }
  }, [connection])
  if (connection === 'preview') return <p className="text-[13px] text-muted">Open DollScene from the Lagos Life Games app to see the leaderboard.</p>
  if (error) return <p className="text-[13px] text-muted">{error}</p>
  if (!board) return <div className="ds-loading-bar h-0.5 w-full" aria-label="Loading" />
  return (
    <div className="flex flex-col gap-2">
      {board.me && (
        <p className="text-[13px]">
          You: <b className="text-accent">{board.me.label}</b> · {board.me.score} XP
        </p>
      )}
      <ol className="flex flex-col divide-y divide-line">
        {board.top.slice(0, 20).map((r) => (
          <li key={r.rank} className="flex items-center gap-3 py-1.5 text-[13px]">
            <span className="w-7 text-right font-display italic text-muted">{r.rank}</span>
            <span className="flex-1 truncate">{r.name}</span>
            <span className="tabular-nums text-muted">{r.score}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}

function Shop() {
  const entitlements = useStudio((s) => s.entitlements)
  const connection = useStudio((s) => s.connection)
  return (
    <div className="flex flex-col gap-3">
      {PRODUCTS.map((p) => {
        const owned = entitlements.includes(p.grants)
        return (
          <Section key={p.id} title={p.name}>
            <div className="flex gap-1">
              {PREMIUM_SWATCHES[p.grants].map((c) => (
                <span key={c} className="h-5 flex-1 first:rounded-l-full last:rounded-r-full" style={{ background: c }} />
              ))}
            </div>
            <div className="flex items-center gap-3">
              <p className="flex-1 text-[12px] text-muted">{p.blurb}</p>
              <TextButton tone={owned ? 'plain' : 'accent'} disabled={owned || connection === 'preview'} onClick={() => buy(p.id)}>
                {owned ? 'Owned' : 'Get'}
              </TextButton>
            </div>
          </Section>
        )
      })}
      <p className="text-[11px] text-muted">Prices are shown and paid on Lagos Life’s own pay sheet.</p>
    </div>
  )
}
