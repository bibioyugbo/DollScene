import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import { buttonClass, cx } from '../lib/ui'
import type { CareerDef } from '../shared/careers'
import type { MiniGameId } from '../shared/types'

export interface GameProps {
  career: CareerDef
  onDone: (score: number) => void
  reducedMotion: boolean
}

const shuffle = <T,>(xs: T[]) => [...xs].sort(() => Math.random() - 0.5)
const PALETTE = ['#FF3D8B', '#A86BFF', '#00A88F', '#FFC24D', '#3D7BFF', '#E8505B', '#1E0B26', '#F5F0E6', '#8C5A3C', '#7CF0CF']

/** Countdown that ends the game. */
function useTimer(seconds: number, onEnd: () => void) {
  const [left, setLeft] = useState(seconds)
  const end = useRef(onEnd)
  end.current = onEnd
  useEffect(() => {
    const started = Date.now()
    const t = window.setInterval(() => {
      const l = Math.max(0, seconds - (Date.now() - started) / 1000)
      setLeft(l)
      if (l <= 0) {
        window.clearInterval(t)
        end.current()
      }
    }, 100)
    return () => window.clearInterval(t)
  }, [seconds])
  return left
}

function TimerBar({ left, total }: { left: number; total: number }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={Math.round(left)} aria-label="Time left">
      <div className="h-full rounded-full bg-primary transition-[width] duration-100" style={{ width: `${(left / total) * 100}%` }} />
    </div>
  )
}

/** Remember the order, then tap it back. */
function OrderUp({ career, onDone }: GameProps) {
  const tokens = career.tokens ?? ['Espresso', 'Milk', 'Ice', 'Syrup', 'Foam', 'Cocoa']
  const [round, setRound] = useState(0)
  const [correct, setCorrect] = useState(0)
  const [seq, setSeq] = useState<string[]>([])
  const [show, setShow] = useState(true)
  const [input, setInput] = useState<string[]>([])
  const rounds = useRef(0)
  const done = useRef(false)
  const finish = () => {
    if (done.current) return
    done.current = true
    onDone(Math.round((correct / Math.max(1, rounds.current)) * 100))
  }
  const left = useTimer(30, finish)
  const options = useMemo(() => shuffle(tokens).slice(0, 6), [tokens, round]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const len = Math.min(5, 3 + Math.floor(round / 2))
    const pool = options
    const s = Array.from({ length: len }, () => pool[Math.floor(Math.random() * pool.length)])
    setSeq(s)
    setInput([])
    setShow(true)
    const t = window.setTimeout(() => setShow(false), 1400 + len * 350)
    return () => window.clearTimeout(t)
  }, [round, options])

  const tap = (tok: string) => {
    if (show) return
    const next = [...input, tok]
    setInput(next)
    if (seq[next.length - 1] !== tok) {
      rounds.current++
      setRound((r) => r + 1)
    } else if (next.length === seq.length) {
      rounds.current++
      setCorrect((c) => c + 1)
      setRound((r) => r + 1)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <TimerBar left={left} total={30} />
      <p className="text-center text-sm text-muted-foreground">{show ? 'Remember the order…' : `Tap ${input.length + 1} of ${seq.length}`}</p>
      <div className="flex min-h-16 flex-wrap items-center justify-center gap-2">
        {show ? seq.map((t, i) => <span key={i} className="rounded-full bg-secondary px-3 py-2 text-sm font-semibold text-white">{i + 1}. {t}</span>) : input.map((t, i) => <span key={i} className="rounded-full bg-muted px-3 py-2 text-sm">{t}</span>)}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {options.map((t) => (
          <button key={t} type="button" disabled={show} onClick={() => tap(t)} className={buttonClass('secondary', 'lg')}>
            {t}
          </button>
        ))}
      </div>
      <p className="text-center text-sm font-semibold">Orders right: {correct}</p>
    </div>
  )
}

/** Tap customers before they leave. */
function RushHour({ onDone }: GameProps) {
  const [cells, setCells] = useState<(number | null)[]>(Array(9).fill(null))
  const stats = useRef({ spawned: 0, served: 0 })
  const done = useRef(false)
  const finish = () => {
    if (done.current) return
    done.current = true
    onDone(Math.round((stats.current.served / Math.max(1, stats.current.spawned)) * 100))
  }
  const left = useTimer(25, finish)
  useEffect(() => {
    const t = window.setInterval(() => {
      setCells((cur) => {
        const now = Date.now()
        const next = cur.map((c) => (c && now - c > 1500 ? null : c))
        const free = next.map((c, i) => (c ? -1 : i)).filter((i) => i >= 0)
        if (free.length && Math.random() < 0.75) {
          next[free[Math.floor(Math.random() * free.length)]] = now
          stats.current.spawned++
        }
        return next
      })
    }, 550)
    return () => window.clearInterval(t)
  }, [])
  return (
    <div className="flex flex-col gap-4">
      <TimerBar left={left} total={25} />
      <p className="text-center text-sm text-muted-foreground">Help each shopper before they walk out.</p>
      <div className="mx-auto grid w-full max-w-xs grid-cols-3 gap-2">
        {cells.map((c, i) => (
          <button
            key={i}
            type="button"
            aria-label={c ? 'Customer waiting' : 'Empty'}
            onClick={() => {
              if (!c) return
              stats.current.served++
              setCells((cur) => cur.map((x, k) => (k === i ? null : x)))
            }}
            className={cx('aspect-square rounded-2xl border-2 transition-transform', c ? 'scale-100 border-primary bg-primary/20' : 'border-border bg-muted')}
          >
            {c && <span className="mx-auto block size-10 rounded-full bg-[radial-gradient(circle_at_50%_35%,#8A5235_35%,#FF3D8B_36%)]" />}
          </button>
        ))}
      </div>
      <p className="text-center text-sm font-semibold">Served: {stats.current.served}</p>
    </div>
  )
}

function Swatch({ c }: { c: [string, string] }) {
  return (
    <span className="flex h-16 w-full overflow-hidden rounded-xl border border-border">
      <span className="flex-1" style={{ background: c[0] }} />
      <span className="flex-1" style={{ background: c[1] }} />
    </span>
  )
}

/** Pick the option that matches the brief. */
function MatchLook({ onDone }: GameProps) {
  const ROUNDS = 8
  const [round, setRound] = useState(0)
  const [correct, setCorrect] = useState(0)
  const done = useRef(false)
  const finish = (c = correct) => {
    if (done.current) return
    done.current = true
    onDone(Math.round((c / ROUNDS) * 100))
  }
  const left = useTimer(30, () => finish())
  const q = useMemo(() => {
    const target: [string, string] = [PALETTE[Math.floor(Math.random() * PALETTE.length)], PALETTE[Math.floor(Math.random() * PALETTE.length)]]
    const wrong = () => [PALETTE[Math.floor(Math.random() * PALETTE.length)], PALETTE[Math.floor(Math.random() * PALETTE.length)]] as [string, string]
    const opts = shuffle([target, wrong(), wrong(), wrong()])
    return { target, opts }
  }, [round])
  const pick = (o: [string, string]) => {
    const ok = o[0] === q.target[0] && o[1] === q.target[1]
    const c = correct + (ok ? 1 : 0)
    setCorrect(c)
    if (round + 1 >= ROUNDS) finish(c)
    else setRound(round + 1)
  }
  return (
    <div className="flex flex-col gap-4">
      <TimerBar left={left} total={30} />
      <p className="text-center text-sm text-muted-foreground">
        Client brief {round + 1}/{ROUNDS}: match this exactly
      </p>
      <div className="mx-auto w-40">
        <Swatch c={q.target} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        {q.opts.map((o, i) => (
          <button key={i} type="button" onClick={() => pick(o)} className="rounded-2xl border-2 border-border p-2 hover:border-primary" aria-label={`Option ${i + 1}`}>
            <Swatch c={o} />
          </button>
        ))}
      </div>
    </div>
  )
}

/** Tap on the beat. */
function Rhythm({ onDone, reducedMotion }: GameProps) {
  const BEATS = 12
  const [pos, setPos] = useState(0)
  const [hits, setHits] = useState(0)
  const [beat, setBeat] = useState(0)
  const [flash, setFlash] = useState<'hit' | 'miss' | null>(null)
  const posRef = useRef(0)
  const tapped = useRef(false)
  const done = useRef(false)
  const scoreRef = useRef(0)
  const doneCb = useRef(onDone)
  doneCb.current = onDone
  useEffect(() => {
    const started = performance.now()
    let raf = 0
    const period = 1400
    let lastBeat = -1
    const loop = (t: number) => {
      const el = t - started
      const b = Math.floor(el / period)
      const phase = (el % period) / period
      const p = phase < 0.5 ? phase * 2 : 2 - phase * 2
      posRef.current = p
      setPos(p)
      if (b !== lastBeat) {
        lastBeat = b
        tapped.current = false
        setBeat(b)
        if (b >= BEATS && !done.current) {
          done.current = true
          doneCb.current(Math.round((scoreRef.current / BEATS) * 100))
          return
        }
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])
  const tap = () => {
    if (tapped.current) return
    tapped.current = true
    const d = Math.abs(posRef.current - 0.5)
    const pts = d < 0.06 ? 1 : d < 0.14 ? 0.6 : 0
    scoreRef.current += pts
    setHits((h) => h + (pts > 0 ? 1 : 0))
    setFlash(pts > 0 ? 'hit' : 'miss')
    window.setTimeout(() => setFlash(null), 250)
  }
  return (
    <div className="flex flex-col gap-4">
      <p className="text-center text-sm text-muted-foreground">
        Tap when the dot is in the pink zone. Beat {Math.min(beat + 1, BEATS)}/{BEATS}
      </p>
      <div className="relative h-14 rounded-full bg-muted">
        <span className="absolute inset-y-1 left-[44%] w-[12%] rounded-full bg-primary/30" />
        <span className={cx('absolute top-1/2 size-10 -translate-x-1/2 -translate-y-1/2 rounded-full', flash === 'hit' ? 'bg-accent' : flash === 'miss' ? 'bg-[#B3123F]' : 'bg-secondary')} style={{ left: `${pos * 100}%`, transition: reducedMotion ? 'none' : undefined }} />
      </div>
      <button type="button" onPointerDown={tap} className={buttonClass('primary', 'lg', 'w-full')}>
        Tap!
      </button>
      <p className="text-center text-sm font-semibold">On beat: {hits}</p>
    </div>
  )
}

/** Shoot when the subject is centred in the frame. */
function Snap({ onDone }: GameProps) {
  const SHOTS = 8
  const [xy, setXY] = useState({ x: 0.5, y: 0.5 })
  const [shots, setShots] = useState(0)
  const score = useRef(0)
  const xyRef = useRef(xy)
  const done = useRef(false)
  useEffect(() => {
    let raf = 0
    const start = performance.now()
    const loop = (t: number) => {
      const s = (t - start) / 1000
      const p = { x: 0.5 + Math.sin(s * 1.3) * 0.38 * Math.cos(s * 0.4), y: 0.5 + Math.cos(s * 1.7) * 0.32 }
      xyRef.current = p
      setXY(p)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])
  const shoot = () => {
    if (done.current) return
    const d = Math.hypot(xyRef.current.x - 0.5, xyRef.current.y - 0.5)
    score.current += Math.max(0, 1 - d / 0.25)
    const n = shots + 1
    setShots(n)
    if (n >= SHOTS) {
      done.current = true
      onDone(Math.round((score.current / SHOTS) * 100))
    }
  }
  return (
    <div className="flex flex-col gap-4">
      <p className="text-center text-sm text-muted-foreground">
        Snap when she’s in the frame. Shot {Math.min(shots + 1, SHOTS)}/{SHOTS}
      </p>
      <button type="button" onPointerDown={shoot} aria-label="Take the shot" className="relative mx-auto aspect-[4/3] w-full max-w-sm overflow-hidden rounded-2xl bg-[linear-gradient(160deg,#F5D4DA,#DCD9E2)]">
        <span className="absolute inset-[30%] rounded-xl border-2 border-dashed border-foreground/40" />
        <span className="absolute size-14 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle_at_50%_35%,#6B3E26_34%,#FF3D8B_35%)] shadow-lg" style={{ left: `${xy.x * 100}%`, top: `${xy.y * 100}%` }} />
      </button>
    </div>
  )
}

/** Sort each card into the right bucket. */
function Sort({ career, onDone }: GameProps) {
  const vocab = career.sort ?? { left: 'Yes', right: 'No', leftItems: ['Good'], rightItems: ['Bad'] }
  const deck = useMemo(() => shuffle([...vocab.leftItems.map((t) => ({ t, side: 'left' as const })), ...vocab.rightItems.map((t) => ({ t, side: 'right' as const }))]), [vocab])
  const [i, setI] = useState(0)
  const [correct, setCorrect] = useState(0)
  const done = useRef(false)
  const finish = (c = correct, n = i) => {
    if (done.current) return
    done.current = true
    onDone(Math.round((c / Math.max(deck.length, n)) * 100))
  }
  const left = useTimer(25, () => finish())
  const answer = (side: 'left' | 'right') => {
    const c = correct + (deck[i].side === side ? 1 : 0)
    setCorrect(c)
    if (i + 1 >= deck.length) finish(c, i + 1)
    else setI(i + 1)
  }
  const card = deck[Math.min(i, deck.length - 1)]
  return (
    <div className="flex flex-col gap-4">
      <TimerBar left={left} total={25} />
      <p className="text-center text-sm text-muted-foreground">
        {i + 1}/{deck.length}
      </p>
      <div className="mx-auto grid min-h-28 w-full max-w-sm place-items-center rounded-2xl border border-border bg-background p-4 text-center font-display text-xl font-bold">{card.t}</div>
      <div className="grid grid-cols-2 gap-3">
        <button type="button" onClick={() => answer('left')} className={buttonClass('primary', 'lg')}>
          {vocab.left}
        </button>
        <button type="button" onClick={() => answer('right')} className={buttonClass('secondary', 'lg')}>
          {vocab.right}
        </button>
      </div>
    </div>
  )
}

export const MINI_GAMES: Record<MiniGameId, { title: string; how: string; Component: (p: GameProps) => ReactElement }> = {
  'order-up': { title: 'Order Up', how: 'Memorise each order, then tap it back in the same order.', Component: OrderUp },
  'rush-hour': { title: 'Rush Hour', how: 'Tap shoppers as they appear before they walk out.', Component: RushHour },
  'match-look': { title: 'Match the Look', how: 'Pick the swatch that matches the client brief.', Component: MatchLook },
  rhythm: { title: 'On Beat', how: 'Tap when the dot crosses the pink zone.', Component: Rhythm },
  snap: { title: 'The Shot', how: 'Tap the frame when the subject is centred.', Component: Snap },
  sort: { title: 'Quick Sort', how: 'Sort every card into the right pile before time runs out.', Component: Sort },
}
