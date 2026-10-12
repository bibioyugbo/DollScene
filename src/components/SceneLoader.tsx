import type { CSSProperties } from 'react'
import { useReducedMotion } from '../hooks/useMediaQuery'
import { avatarSummary } from '../shared/appearance'
import { STARTERS } from '../shared/starters'
import { DollFigure } from './art/DollFigure'

const WALK = 4.2
const LANES = [-1, 0.35, -0.35, 1, 0]
const CAST = STARTERS.map((s, i) => ({ id: s.id, avatar: avatarSummary(s.appearance), outfit: s.appearance.outfit, lane: LANES[i % LANES.length], delay: -(i * WALK) / STARTERS.length }))

/**
 * Whole-screen, lightweight loader (pure SVG/CSS, no WebGL): every default doll
 * walks down a pink runway towards the screen while the next module loads.
 */
export function SceneLoader({ label = 'Spinning up the next scene', overlay = false }: { label?: string; overlay?: boolean }) {
  const reduced = useReducedMotion()
  return (
    <div
      role="status"
      aria-live="polite"
      className={`${overlay ? 'fixed inset-0 z-[90]' : 'h-full min-h-dvh w-full'} relative overflow-hidden bg-[#07050B] text-bone motion-safe:animate-[loader-in_.25s_ease-out]`}
    >
      {/* the runway */}
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-[62%] bg-[#FF2E88]/25 [clip-path:polygon(42%_0,58%_0,100%_100%,0_100%)]" />
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-[62%] bg-[repeating-linear-gradient(to_bottom,transparent_0_18px,rgb(255_46_136/0.18)_18px_20px)] [clip-path:polygon(49.6%_0,50.4%_0,51%_100%,49%_100%)]" />
      <div aria-hidden className="absolute inset-x-0 top-[34%] h-24 -translate-y-1/2 bg-primary/30 blur-3xl" />

      {reduced ? (
        <div aria-hidden className="absolute inset-x-0 bottom-[22%] flex items-end justify-center gap-1">
          {CAST.slice(0, 5).map((d) => (
            <DollFigure key={d.id} avatar={d.avatar} outfit={d.outfit} className="h-[22vh] w-auto" />
          ))}
        </div>
      ) : (
        <div aria-hidden className="absolute inset-0">
          {CAST.map((d) => (
            <div
              key={d.id}
              className="absolute top-[38%] left-1/2 h-[26vh] origin-bottom"
              style={{ animation: `doll-walk ${WALK}s linear ${d.delay}s infinite both`, '--lane': d.lane } as CSSProperties}
            >
              <div className="h-full animate-[doll-step_.42s_ease-in-out_infinite_alternate]">
                <DollFigure avatar={d.avatar} outfit={d.outfit} className="h-full w-auto" />
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="absolute inset-x-0 bottom-[max(2rem,env(safe-area-inset-bottom))] text-center font-display text-sm font-bold tracking-[0.2em] text-bone/80 uppercase">{label}…</p>
    </div>
  )
}
