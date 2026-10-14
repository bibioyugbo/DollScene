import { useEffect, useMemo, useState } from 'react'

/**
 * The loading screen: text only. Three or four short lines of what's happening behind the scenes
 * ("Setting up balloons...", "Buying the drinks..."), each for ~0.65 s, about 2.5 s in all, then
 * the game opens. Everything not needed for the first screen keeps loading in the background.
 */

const LINES = [
  'Setting up balloons...',
  'Buying the drinks...',
  'Healing BBL...',
  'Arranging chairs...',
  'Steaming the wigs...',
  'Polishing the heels...',
  'Charging the ring lights...',
  'Laying the edges...',
  'Chilling the matcha...',
  'Rolling out the red carpet...',
]

/** How long the lines run before the game may open (ms). */
export const BOOT_MIN_MS = 2500
const STEP_MS = 650

export function Boot({ error, onRetry, leaving, onGone }: { error: string | null; onRetry: () => void; leaving: boolean; onGone: () => void }) {
  // four lines, different each visit
  const lines = useMemo(() => {
    const pool = [...LINES]
    const out: string[] = []
    for (let i = 0; i < 4; i++) out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0])
    return out
  }, [])
  const [i, setI] = useState(0)
  useEffect(() => {
    // the last line stays until the game opens
    const t = window.setInterval(() => setI((n) => Math.min(n + 1, lines.length - 1)), STEP_MS)
    return () => window.clearInterval(t)
  }, [lines.length])
  return (
    <div
      className={`ds-boot-gradient absolute inset-0 z-40 grid place-items-center transition-opacity duration-300 ${leaving ? 'pointer-events-none opacity-0' : 'opacity-100'}`}
      aria-busy={!error && !leaving}
      onTransitionEnd={(e) => e.target === e.currentTarget && leaving && onGone()}
    >
      <div className="flex flex-col items-center gap-3 px-6 text-center">
        {error ? (
          <>
            <p className="max-w-xs text-[15px] font-semibold text-white">{error}</p>
            <button type="button" onClick={onRetry} className="min-h-11 rounded-full bg-white px-6 text-[16px] font-black text-[#2b1622]">
              Try again
            </button>
          </>
        ) : (
          <p key={i} className="ds-boot-line text-[clamp(18px,4.6vw,26px)] font-extrabold tracking-tight text-white drop-shadow-[0_2px_12px_rgb(60_10_60/0.35)]" role="status" aria-live="polite">
            {lines[i]}
          </p>
        )}
      </div>
    </div>
  )
}
