import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { AppShell, PageBody } from '../components/AppShell'
import { Icon } from '../components/Icon'
import { MINI_GAMES } from '../components/minigames'
import { MissionList } from '../components/Missions'
import { Modal } from '../components/Modal'
import { ConfirmDialog } from '../components/social'
import { useAction } from '../hooks/useAction'
import { useReducedMotion } from '../hooks/useMediaQuery'
import { buttonClass, cx, formatGlam } from '../lib/ui'
import { CAREER_PATHS, CAREERS, careerTitle, LEVEL_REP, LEVEL_XP, MAX_LEVEL, shiftPay, type CareerDef } from '../shared/careers'
import { CAREER_UNLOCK_DAYS, dayKey, SHIFT_COOLDOWN_MS, SHIFT_DAILY_LIMIT } from '../shared/economy'
import { DAILY_MISSIONS, WEEKLY_MISSIONS } from '../shared/missions'
import type { MiniGameId } from '../shared/types'
import { useSession } from '../store/useSession'
import { toast } from '../store/useToasts'

type Result = { score: number; dollies: number; xp: number; reputation: number; promoted: boolean; title: string }

export default function Work() {
  const p = useSession((s) => s.progress)!
  const [params] = useSearchParams()
  const reducedMotion = useReducedMotion()
  const start = useAction('startShift')
  const complete = useAction('completeShift')
  const change = useAction('changeCareer')
  const [shift, setShift] = useState<{ id: string; game: MiniGameId } | null>(null)
  const [phase, setPhase] = useState<'intro' | 'play' | 'result'>('intro')
  const [result, setResult] = useState<Result | null>(null)
  const [now, setNow] = useState(Date.now())
  const [confirm, setConfirm] = useState<CareerDef | null>(null)
  const [fairOpen, setFairOpen] = useState(params.get('fair') === '1')

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [])

  const c = p.career
  const def = CAREERS[c.id]
  const today = dayKey(now)
  const used = p.shifts.day === today ? p.shifts.count : 0
  const cooldown = Math.max(0, p.shifts.lastAt + SHIFT_COOLDOWN_MS - now)
  const unlocked = p.distinctPlayDays >= CAREER_UNLOCK_DAYS
  const max = c.level >= MAX_LEVEL
  const xpPct = max ? 100 : Math.round(((c.xp - LEVEL_XP[c.level - 1]) / (LEVEL_XP[c.level] - LEVEL_XP[c.level - 1])) * 100)
  const pay = shiftPay(c.id, c.level, 100)

  const begin = async () => {
    const r = await start.run(undefined)
    if (!r) return
    setShift({ id: r.shift.id, game: r.shift.game })
    setPhase('intro')
  }
  const finish = async (score: number) => {
    if (!shift) return
    const r = await complete.run({ shiftId: shift.id, score })
    if (r) {
      setResult(r)
      setPhase('result')
      if (r.promoted) toast.success(`Promoted to ${r.title}!`)
    } else setShift(null)
  }

  const game = shift ? MINI_GAMES[shift.game] : null

  return (
    <AppShell title="Work">
      <PageBody className="flex flex-col gap-5">
        <section className="rounded-[var(--radius-sheet)] border border-border bg-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">{c.id === p.starterJob ? 'Starter job' : 'Career'}</p>
              <h2 className="font-display text-2xl font-bold">{careerTitle(c.id, c.level)}</h2>
              <p className="text-sm text-muted-foreground">{def.blurb}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Up to</p>
              <p className="font-display text-xl font-bold">{formatGlam(pay.dollies)} G / shift</p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div>
              <p className="text-xs font-semibold text-muted-foreground">Level {c.level}{max ? ' (max)' : ''}</p>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                <span className="block h-full rounded-full bg-secondary" style={{ width: `${xpPct}%` }} />
              </div>
              {!max && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {c.xp}/{LEVEL_XP[c.level]} XP · {c.reputation}/{LEVEL_REP[c.level]} rep to promote
                </p>
              )}
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground">Today</p>
              <p className="font-semibold">
                {used}/{SHIFT_DAILY_LIMIT} shifts
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground">Mini-game</p>
              <p className="font-semibold">{MINI_GAMES[def.game].title}</p>
            </div>
          </div>
          <button type="button" className={buttonClass('primary', 'lg', 'mt-5 w-full sm:w-auto')} disabled={start.pending || used >= SHIFT_DAILY_LIMIT || cooldown > 0} onClick={begin}>
            {used >= SHIFT_DAILY_LIMIT ? 'Done for today' : cooldown > 0 ? `Break · ${Math.ceil(cooldown / 1000)}s` : 'Start shift'}
          </button>
        </section>

        <section className={cx('rounded-[var(--radius-sheet)] border p-5', unlocked ? 'border-primary bg-primary/10' : 'border-border bg-card')}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-bold">Career Fair</h2>
              <p className="text-sm text-muted-foreground">
                {unlocked ? 'Twenty paths from model to doctor. Switch any time.' : `Opens after ${CAREER_UNLOCK_DAYS} play days (days you actually played). You’re on day ${p.distinctPlayDays}.`}
              </p>
            </div>
            <button type="button" className={buttonClass(unlocked ? 'primary' : 'secondary', 'md')} onClick={() => setFairOpen(true)}>
              {unlocked ? 'Browse careers' : (
                <>
                  <Icon name="lock" className="size-4" /> Preview
                </>
              )}
            </button>
          </div>
          {!unlocked && (
            <div className="mt-3 flex gap-1" aria-label={`${p.distinctPlayDays} of ${CAREER_UNLOCK_DAYS} play days`}>
              {Array.from({ length: CAREER_UNLOCK_DAYS }, (_, i) => (
                <span key={i} className={cx('h-2 flex-1 rounded-full', i < p.distinctPlayDays ? 'bg-primary' : 'bg-muted')} />
              ))}
            </div>
          )}
        </section>

        <div className="grid gap-4 md:grid-cols-2">
          <MissionList title="Daily missions" missions={DAILY_MISSIONS} progress={p} />
          <MissionList title="Weekly missions" missions={WEEKLY_MISSIONS} progress={p} />
        </div>
      </PageBody>

      <Modal open={!!shift} onClose={() => phase !== 'play' && setShift(null)} title={game?.title ?? 'Shift'} dismissable={phase !== 'play'}>
        {shift && game && phase === 'intro' && (
          <div className="flex flex-col gap-4">
            <p>{game.how}</p>
            <p className="text-sm text-muted-foreground">Better score, better pay. Great shifts also earn reputation for promotions.</p>
            <button type="button" className={buttonClass('primary', 'lg', 'w-full')} onClick={() => setPhase('play')}>
              Clock in
            </button>
          </div>
        )}
        {shift && game && phase === 'play' && <game.Component career={def} onDone={finish} reducedMotion={reducedMotion} />}
        {phase === 'result' && result && (
          <div className="flex flex-col items-center gap-3 text-center">
            <p className="font-display text-5xl font-extrabold">{result.score}%</p>
            <p className="text-lg">
              +{formatGlam(result.dollies)} Glam · +{result.xp} XP{result.reputation ? ` · +${result.reputation} rep` : ''}
            </p>
            {result.promoted && <p className="rounded-full bg-gold/30 px-4 py-2 font-semibold">Promoted: {result.title}</p>}
            <button
              type="button"
              className={buttonClass('primary', 'lg', 'w-full')}
              onClick={() => {
                setShift(null)
                setResult(null)
              }}
            >
              Clock out
            </button>
          </div>
        )}
      </Modal>

      <Modal open={fairOpen} onClose={() => setFairOpen(false)} title="Career Fair" wide>
        {!unlocked && <p className="mb-3 rounded-2xl bg-muted px-4 py-3 text-sm">Window shopping only for now. Switching unlocks on play day {CAREER_UNLOCK_DAYS}.</p>}
        <ul className="grid gap-2 sm:grid-cols-2">
          {CAREER_PATHS.map((k) => {
            const past = p.careerHistory.find((h) => h.id === k.id)
            return (
              <li key={k.id} className={cx('flex flex-col gap-1 rounded-2xl border p-3', k.id === c.id ? 'border-primary' : 'border-border')}>
                <span className="font-semibold">{k.name}</span>
                <span className="text-sm text-muted-foreground">{k.blurb}</span>
                <span className="text-xs text-muted-foreground">
                  {MINI_GAMES[k.game].title} · from {shiftPay(k.id, 1, 100).dollies} G/shift{past ? ` · you reached level ${past.level}` : ''}
                </span>
                <button type="button" className={buttonClass('secondary', 'sm', 'mt-1 self-start')} disabled={!unlocked || k.id === c.id || change.pending} onClick={() => setConfirm(k)}>
                  {k.id === c.id ? 'Current' : unlocked ? 'Switch' : <><Icon name="lock" className="size-3.5" /> Locked</>}
                </button>
              </li>
            )
          })}
        </ul>
      </Modal>

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title={`Become a ${confirm?.name ?? ''}?`}
        body="You start at level 1 in a new career (or where you left off if you've done it before)."
        confirmLabel="Switch career"
        onConfirm={async () => {
          if (!confirm) return
          const r = await change.run({ careerId: confirm.id })
          if (r) {
            toast.success(`Welcome to your first day as a ${confirm.name}`)
            setFairOpen(false)
          }
        }}
      />
    </AppShell>
  )
}
