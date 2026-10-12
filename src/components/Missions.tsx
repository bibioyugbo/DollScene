import { Fragment, useMemo, useState } from 'react'
import { useAction } from '../hooks/useAction'
import { buttonClass, cx } from '../lib/ui'
import { ALL_MISSIONS, missionState, type MissionDef } from '../shared/missions'
import type { ProgressDoc } from '../shared/types'
import { toast } from '../store/useToasts'
import { Icon } from './Icon'

export function MissionList({ title, missions, progress }: { title: string; missions: MissionDef[]; progress: ProgressDoc }) {
  const { run, pending } = useAction('claimMission')
  const now = Date.now()
  return (
    <section className="rounded-[var(--radius-sheet)] border border-border bg-card p-4 md:p-5">
      <h2 className="mb-3 font-display text-base font-bold">{title}</h2>
      <ul className="flex flex-col gap-3">
        {missions.map((m) => {
          const st = missionState(progress, m, now)
          const pct = Math.round((st.count / m.target) * 100)
          return (
            <li key={m.id} className="flex items-center gap-3">
              <span className={cx('grid size-9 shrink-0 place-items-center rounded-full', st.status === 'claimed' ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground')}>
                <Icon name={st.status === 'claimed' ? 'check' : 'star'} className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className={cx('block text-sm font-semibold', st.status === 'claimed' && 'text-muted-foreground line-through')}>{m.title}</span>
                <span className="mt-1 flex items-center gap-2">
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <span className="block h-full rounded-full bg-primary transition-[width]" style={{ width: `${pct}%` }} />
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {Math.min(st.count, m.target).toLocaleString()}/{m.target.toLocaleString()}
                  </span>
                </span>
              </span>
              {st.status === 'ready' ? (
                <button
                  type="button"
                  disabled={pending}
                  className={buttonClass('primary', 'sm')}
                  onClick={async () => {
                    const r = await run({ missionId: m.id })
                    if (r) toast.success(`+${r.reward} Glam`)
                  }}
                >
                  Claim {m.reward}
                </button>
              ) : (
                <span className="text-xs font-semibold text-muted-foreground tabular-nums">{st.status === 'claimed' ? 'Done' : `+${m.reward}`}</span>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

const PICK_KEY = 'dc:picked-mission'
const readPick = () => {
  try {
    return localStorage.getItem(PICK_KEY)
  } catch {
    return null
  }
}
const writePick = (id: string | null) => {
  try {
    if (id) localStorage.setItem(PICK_KEY, id)
    else localStorage.removeItem(PICK_KEY)
  } catch {
    /* private mode: the pick lasts until reload */
  }
}

const EMOJI: Partial<Record<MissionDef['event'], string>> = { shift: '💼', purchase: '🛍️', message: '💬', like: '❤️', vote: '🗳️', 'play-day': '📅', post: '📸', challenge: '👠', friend: '🤝', earn: '💰', unpack: '📦', place: '🛋️', outing: '🌹', wear: '👗' }

function Card({ m, progress, onPick, big }: { m: MissionDef; progress: ProgressDoc; onPick?: () => void; big?: boolean }) {
  const st = missionState(progress, m, Date.now())
  const pct = Math.round((st.count / m.target) * 100)
  const body = (
    <>
      <span className={cx('grid place-items-center rounded-2xl bg-white/80', big ? 'size-16 text-4xl' : 'size-12 text-3xl')}>{EMOJI[m.event] ?? '⭐'}</span>
      <span className={cx('font-display leading-tight font-black', big ? 'text-xl' : 'text-base')}>{m.title}</span>
      <span className="flex items-center gap-1.5 text-sm font-bold">
        <span className="rounded-full bg-[#FFD95A] px-2 py-0.5 text-ink">+{m.reward} Glam</span>
        <span className="rounded-full bg-ink px-2 py-0.5 text-white">+{m.reward} XP</span>
      </span>
      {big && (
        <span className="mt-1 flex w-full items-center gap-2">
          <span className="h-2 flex-1 overflow-hidden rounded-full bg-ink/10">
            <span className="block h-full rounded-full bg-primary transition-[width]" style={{ width: `${pct}%` }} />
          </span>
          <span className="text-xs font-bold tabular-nums">
            {Math.min(st.count, m.target).toLocaleString()}/{m.target.toLocaleString()}
          </span>
        </span>
      )}
    </>
  )
  const cls = 'flex flex-1 flex-col items-center gap-2 rounded-[24px] border-2 border-ink bg-[linear-gradient(160deg,#FFF6FA,#FFE3EF)] p-4 text-center text-ink shadow-[0_6px_0_#0E0B10]'
  return onPick ? (
    <button type="button" onClick={onPick} className={cx(cls, 'transition-transform hover:-translate-y-1 active:translate-y-1 active:shadow-[0_2px_0_#0E0B10]')}>
      {body}
    </button>
  ) : (
    <div className={cls}>{body}</div>
  )
}

/**
 * Missions as a "this or that": two task cards, you pick one. Finish it to earn
 * Glam and XP (towards your next level), then pick again.
 */
export function MissionPicker({ progress }: { progress: ProgressDoc }) {
  const { run, pending } = useAction('claimMission')
  const now = Date.now()
  const [picked, setPicked] = useState<string | null>(readPick)
  const [round, setRound] = useState(0)
  const open = ALL_MISSIONS.filter((m) => missionState(progress, m, now).status !== 'claimed')
  const ready = open.filter((m) => missionState(progress, m, now).status === 'ready')
  const current = open.find((m) => m.id === picked) ?? null
  const choices = useMemo(() => {
    const pool = open.filter((m) => m.id !== picked)
    const start = (round * 2) % Math.max(1, pool.length)
    return [pool[start], pool[(start + 1) % pool.length]].filter((m, i, a) => m && a.indexOf(m) === i)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reshuffle only when asked
  }, [round, picked, open.length])
  const pick = (id: string | null) => {
    setPicked(id)
    writePick(id)
  }

  return (
    <div className="flex flex-col gap-4">
      {ready.length > 0 && (
        <div className="flex flex-col gap-2 rounded-2xl bg-[#C8FF3D]/30 p-3">
          {ready.map((m) => (
            <div key={m.id} className="flex items-center gap-2 text-sm font-bold">
              <span className="flex-1">✅ {m.title}</span>
              <button
                type="button"
                disabled={pending}
                className={buttonClass('primary', 'sm')}
                onClick={async () => {
                  const r = await run({ missionId: m.id })
                  if (!r) return
                  toast.success(`+${r.reward} Glam · +${r.reward} XP`)
                  if (m.id === picked) pick(null)
                }}
              >
                Claim
              </button>
            </div>
          ))}
        </div>
      )}
      {current ? (
        <>
          <p className="text-center text-xs font-black tracking-widest text-muted-foreground uppercase">Your task</p>
          <Card m={current} progress={progress} big />
          <button type="button" className={buttonClass('ghost', 'sm', 'self-center')} onClick={() => pick(null)}>
            Swap it for another
          </button>
        </>
      ) : choices.length ? (
        <>
          <p className="text-center font-spicy text-2xl">This or that?</p>
          <div className="flex items-stretch gap-3">
            {choices.map((m, i) => (
              <Fragment key={m.id}>
                {i === 1 && <span className="self-center font-spicy text-lg text-muted-foreground">or</span>}
                <Card m={m} progress={progress} onPick={() => pick(m.id)} />
              </Fragment>
            ))}
          </div>
          <button type="button" className={buttonClass('ghost', 'sm', 'self-center')} onClick={() => setRound((r) => r + 1)}>
            🔀 Show me two others
          </button>
        </>
      ) : (
        <p className="text-center text-sm text-muted-foreground">All done for now. New tasks tomorrow ✨</p>
      )}
    </div>
  )
}
