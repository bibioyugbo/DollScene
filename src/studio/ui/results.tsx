import { useEffect } from 'react'
import { create } from 'zustand'

/**
 * Result graphics: a small round badge that pops up beside the doll when a step finishes, showing
 * what that step actually did (a dirty cotton pad after toner, water droplets after a face wash, a
 * glow after sunscreen...). The doll itself carries the real result; this is the "look!" moment.
 */

export type ResultKind = 'dew' | 'pad' | 'glow' | 'smooth' | 'calm' | 'bright' | 'heal'
interface Result {
  id: number
  kind: ResultKind
  dirt?: number
}

const useResults = create<{ current: Result | null }>(() => ({ current: null }))
let seq = 1

export function showResult(r: Omit<Result, 'id'>) {
  useResults.setState({ current: { ...r, id: seq++ } })
}

const TEXT: Record<ResultKind, string> = {
  dew: 'Wet, dewy & fresh',
  pad: 'Look what came off!',
  glow: 'Glowing',
  smooth: 'Flakes gone',
  calm: 'Redness calmed',
  bright: 'Marks fading',
  heal: 'Healing up',
}

function Picture({ r }: { r: Result }) {
  switch (r.kind) {
    case 'pad': {
      const d = Math.min(1, Math.max(0.15, r.dirt ?? 0.4))
      return (
        <svg viewBox="0 0 80 80" className="h-full w-full" aria-hidden>
          <circle cx="40" cy="40" r="32" fill="#FBFAF7" stroke="#E6E0D8" strokeWidth="2" />
          <circle cx="40" cy="40" r="25" fill="none" stroke="#ECE6DE" strokeDasharray="2 3" />
          <path d="M22 44c4-12 18-18 30-12 8 4 8 14 0 18-10 6-26 6-30-6Z" fill="#8A7462" opacity={0.25 + d * 0.6} />
          <path d="M30 40c4-6 12-8 18-4" stroke="#6B5646" strokeWidth="3" fill="none" strokeLinecap="round" opacity={d * 0.7} />
          <circle cx="50" cy="48" r="3" fill="#6B5646" opacity={d * 0.6} />
        </svg>
      )
    }
    case 'dew':
      return (
        <svg viewBox="0 0 80 80" className="h-full w-full" aria-hidden>
          <circle cx="40" cy="40" r="32" fill="#CFEAFF" />
          {[[28, 30, 6], [48, 26, 4.5], [36, 48, 5], [54, 46, 6.5], [24, 50, 3.5]].map(([x, y, r], i) => (
            <g key={i}>
              <path d={`M${x} ${y - r * 1.6}q${r} ${r * 1.4} 0 ${r * 2.6}q-${r} -${r} 0 -${r * 2.6}Z`} fill="#7FC7FF" />
              <circle cx={x - r * 0.3} cy={y - r * 0.1} r={r * 0.3} fill="#fff" />
            </g>
          ))}
        </svg>
      )
    case 'glow':
      return (
        <svg viewBox="0 0 80 80" className="h-full w-full" aria-hidden>
          <circle cx="40" cy="40" r="32" fill="#FFE7B8" />
          <circle cx="40" cy="40" r="20" fill="#FFF6E2" />
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <rect key={i} x="39" y="6" width="2.4" height="10" rx="1.2" fill="#FFB43C" transform={`rotate(${i * 45} 40 40)`} />
          ))}
          <path d="M40 30l2.6 6.8 6.8 2.6-6.8 2.6L40 48.8l-2.6-6.8-6.8-2.6 6.8-2.6Z" fill="#FFB43C" />
        </svg>
      )
    default:
      return (
        <svg viewBox="0 0 80 80" className="h-full w-full" aria-hidden>
          <circle cx="40" cy="40" r="32" fill={r.kind === 'calm' ? '#D8F2DC' : r.kind === 'bright' ? '#FFE7C2' : r.kind === 'heal' ? '#F6DCE2' : '#EFE6DC'} />
          <path d="M40 22l4 10.4 10.4 4-10.4 4L40 50.8l-4-10.4-10.4-4 10.4-4Z" fill={r.kind === 'calm' ? '#4FA65E' : r.kind === 'bright' ? '#F2A33A' : r.kind === 'heal' ? '#D65A7F' : '#9C6B4A'} />
          <path d="M28 56q12 6 24 0" stroke="#000" strokeOpacity="0.2" strokeWidth="2" fill="none" />
        </svg>
      )
  }
}

export function ResultPop() {
  const r = useResults((s) => s.current)
  useEffect(() => {
    if (!r) return
    const t = window.setTimeout(() => useResults.setState((s) => (s.current?.id === r.id ? { current: null } : s)), 2800)
    return () => window.clearTimeout(t)
  }, [r])
  if (!r) return null
  return (
    <div key={r.id} className="ds-result pointer-events-none absolute left-1/2 top-[18%] z-30 flex -translate-x-1/2 flex-col items-center gap-1.5" role="status" aria-live="polite">
      <div className="h-24 w-24 rounded-full shadow-[0_10px_30px_rgb(0_0_0/0.35)] ring-4 ring-white/70">
        <Picture r={r} />
      </div>
      <span className="rounded-full bg-black/55 px-3 py-1 text-[13px] font-extrabold text-white backdrop-blur">{TEXT[r.kind]}</span>
    </div>
  )
}
