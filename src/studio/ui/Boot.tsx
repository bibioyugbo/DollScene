import { useEffect, useMemo, useState } from 'react'

/**
 * The loading screen. Three silhouette vignettes cross-fade in turn (about 2.5 s each): a woman
 * brushing her hair, a man in jeans standing easy, and someone posing while a crowd of cameras
 * flashes. Solid shapes only (no faces), drawn as SVG and animated with CSS. Behind them: a slowly
 * shifting gradient, drifting bokeh, twinkling sparkles and stars, and a soft vignette.
 * The progress bar is the real share of assets downloaded and parsed (see preload.tsx), never a timer.
 */

const INK = '#1a0f1c'

function Brushing() {
  return (
    <svg viewBox="0 0 400 420" className="h-full w-full" aria-hidden>
      <g fill={INK}>
        {/* long hair down her back, swaying with each stroke */}
        <path className="ds-sil-hair" d="M208 66c34 2 50 30 46 70-3 32 6 70 14 104 6 24-4 38-22 36-14-2-22-16-24-40-3-34-10-66-24-92-10-20-8-62 10-78Z" />
        <ellipse cx="196" cy="96" rx="31" ry="37" />
        <path d="M186 126h22l2 26h-26Z" />
        {/* dress: fitted bodice, flared skirt */}
        <path d="M160 160c24-14 56-14 76 0l-6 86c20 40 34 92 38 136H132c4-44 16-96 34-136Z" />
        <path d="M174 382h18l-2 26h-16Z M208 382h18l-2 26h-16Z" />
        <path d="M166 172c-10 30-16 60-14 92l12 2c0-30 6-58 14-88Z" />
        {/* the brushing arm, rim-lit so it reads against her hair: pivots at the shoulder, and the
            brush sweeps from the crown down the length */}
        <g className="ds-sil-brush" style={{ transformOrigin: '228px 168px' }} stroke="#ffe6f2" strokeOpacity="0.55" strokeWidth="3" strokeLinejoin="round">
          <path d="M220 160c10-4 18-2 22 6l52-50-14-12Z" />
          <path d="M280 104l14 12-32-44-12 8Z" />
          <rect x="236" y="36" width="44" height="18" rx="8" transform="rotate(32 258 45)" />
          <path d="M262 58l9 5-10 20-9-5Z" />
          {[0, 1, 2, 3, 4].map((k) => (
            <path key={k} d={`M${240 + k * 8} ${40 + k * 4}l-6 -9`} strokeWidth="2" />
          ))}
        </g>
      </g>
    </svg>
  )
}

function Jeans() {
  return (
    <svg viewBox="0 0 400 420" className="h-full w-full" aria-hidden>
      <g fill={INK} className="ds-sil-shift" style={{ transformOrigin: '200px 410px' }}>
        <ellipse cx="200" cy="80" rx="27" ry="31" />
        <path d="M190 108h20l2 22h-24Z" />
        {/* tee with short sleeves */}
        <path d="M146 136c34-14 74-14 108 0l14 34-14 6-4 72H150l-4-72-14-6Z" />
        {/* arms relaxed, hands slipped into the front pockets */}
        <path d="M136 172c-10 30-8 56 12 82l12-4c-14-24-14-48-6-74Z M264 172c10 30 8 56-12 82l-12-4c14-24 14-48 6-74Z" />
        {/* jeans */}
        <path d="M150 246h100l-4 154h-36l-10-104-10 104h-36Z" />
        <path d="M150 262h100" stroke="#000" strokeOpacity="0.35" strokeWidth="2" />
        <ellipse cx="174" cy="404" rx="22" ry="8" />
        <ellipse cx="228" cy="404" rx="22" ry="8" />
      </g>
    </svg>
  )
}

const FLASHES = [
  { x: 64, y: 278, d: 0 },
  { x: 128, y: 300, d: 0.45 },
  { x: 288, y: 296, d: 0.2 },
  { x: 342, y: 270, d: 0.75 },
  { x: 206, y: 318, d: 1.05 },
  { x: 30, y: 316, d: 1.3 },
  { x: 372, y: 318, d: 1.6 },
]

function Paparazzi() {
  return (
    <svg viewBox="0 0 400 420" className="h-full w-full" aria-hidden>
      <defs>
        <radialGradient id="ds-flash-g">
          <stop offset="0" stopColor="#fff" stopOpacity="1" />
          <stop offset="0.35" stopColor="#fff6dc" stopOpacity="0.85" />
          <stop offset="1" stopColor="#fff6dc" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* the star of the moment, posed: hand on hip, chin up */}
      <g fill={INK} transform="translate(130 20) scale(0.7)">
        <ellipse cx="200" cy="92" rx="30" ry="36" />
        <path d="M168 62c20-26 56-24 70 2 10 22 4 50-6 64l-8-30c-8-24-34-30-56-36Z" />
        <path d="M188 124h22l2 24h-26Z" />
        <path d="M160 156c26-14 54-14 80 0l-4 86c18 46 26 100 28 140H138c2-40 10-94 28-140Z" />
        <path d="M240 162c22 18 26 46 6 70l-10-8c12-18 10-34-6-50Z" />
        <path d="M160 166c-12 34-14 66-8 98l12-2c-4-30-2-60 8-90Z" />
        <path d="M176 382h18v28h-18Z M208 382h18v28h-18Z" />
      </g>
      {/* the crowd: heads and shoulders, cameras and phones held up */}
      <g fill={INK}>
        {[30, 90, 150, 250, 310, 372].map((x, i) => (
          <g key={x} className="ds-sil-bob" style={{ animationDelay: `${i * 0.23}s` }}>
            <ellipse cx={x} cy={352 - (i % 2) * 8} rx="22" ry="25" />
            <path d={`M${x - 46} 420c4-36 22-50 46-50s42 14 46 50Z`} />
            <path d={`M${x + (i < 3 ? 10 : -10)} 372l${i < 3 ? 22 : -22} -64l10 4l${i < 3 ? -14 : 14} 64Z`} />
            <rect x={x + (i < 3 ? 22 : -46)} y={290 - (i % 2) * 10} width="26" height="18" rx="3" />
          </g>
        ))}
      </g>
      {FLASHES.map((f) => (
        <g key={f.x} className="ds-flash" style={{ animationDelay: `${f.d}s`, transformOrigin: `${f.x}px ${f.y}px` }}>
          <circle cx={f.x} cy={f.y} r="34" fill="url(#ds-flash-g)" />
          <path d={`M${f.x - 26} ${f.y}h52M${f.x} ${f.y - 26}v52M${f.x - 16} ${f.y - 16}l32 32M${f.x + 16} ${f.y - 16}l-32 32`} stroke="#fff" strokeWidth="2" strokeLinecap="round" />
        </g>
      ))}
    </svg>
  )
}

const SCENES = [Brushing, Jeans, Paparazzi]

function Backdrop() {
  const dots = useMemo(
    () => ({
      stars: Array.from({ length: 70 }, (_, i) => ({ x: (i * 37.3) % 100, y: (i * 61.7) % 100, s: 1 + ((i * 13) % 3), d: (i % 9) * 0.37 })),
      bokeh: Array.from({ length: 14 }, (_, i) => ({ x: (i * 23.7 + 7) % 100, y: (i * 41.3 + 11) % 100, s: 40 + ((i * 29) % 90), d: i * 1.3, c: ['#ffc4dd', '#ffe3b0', '#c9b8ff', '#9fe8ff'][i % 4] })),
      sparkles: Array.from({ length: 18 }, (_, i) => ({ x: (i * 53.1 + 3) % 100, y: (i * 29.9 + 17) % 100, s: 8 + ((i * 7) % 10), d: (i % 6) * 0.5 })),
    }),
    [],
  )
  return (
    <>
      <div className="ds-boot-gradient absolute inset-0" />
      {dots.bokeh.map((b, i) => (
        <span key={`b${i}`} className="ds-bokeh absolute rounded-full" style={{ left: `${b.x}%`, top: `${b.y}%`, width: b.s, height: b.s, background: b.c, animationDelay: `-${b.d}s` }} />
      ))}
      {dots.stars.map((st, i) => (
        <span key={`s${i}`} className="ds-twinkle absolute rounded-full bg-white" style={{ left: `${st.x}%`, top: `${st.y}%`, width: st.s, height: st.s, animationDelay: `${st.d}s` }} />
      ))}
      {dots.sparkles.map((sp, i) => (
        <svg key={`p${i}`} viewBox="0 0 20 20" className="ds-sparkle absolute" style={{ left: `${sp.x}%`, top: `${sp.y}%`, width: sp.s, height: sp.s, animationDelay: `${sp.d}s` }} aria-hidden>
          <path d="M10 0l2 8 8 2-8 2-2 8-2-8-8-2 8-2Z" fill="#fff" />
        </svg>
      ))}
      <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(120% 90% at 50% 45%, transparent 55%, rgb(20 8 24 / 0.55) 100%)' }} />
    </>
  )
}

export function Boot({ progress, error, onRetry, leaving, onGone }: { progress: number; error: string | null; onRetry: () => void; leaving: boolean; onGone: () => void }) {
  const [i, setI] = useState(0)
  useEffect(() => {
    const t = window.setInterval(() => setI((n) => (n + 1) % SCENES.length), 2500)
    return () => window.clearInterval(t)
  }, [])
  const pct = Math.round(Math.max(0, Math.min(1, progress)) * 100)
  return (
    <div
      className={`absolute inset-0 z-40 overflow-hidden transition-opacity duration-500 ${leaving ? 'pointer-events-none opacity-0' : 'opacity-100'}`}
      aria-busy={!error && !leaving}
      onTransitionEnd={(e) => e.target === e.currentTarget && leaving && onGone()}
    >
      <Backdrop />
      <div className="absolute inset-x-0 top-[8%] flex flex-col items-center gap-1 px-6 text-center">
        <h1 className="text-[clamp(46px,11vw,92px)] font-black leading-none tracking-tight text-white drop-shadow-[0_4px_24px_rgb(60_10_60/0.45)]">
          Doll<span className="text-[#ffd1e6]">Scene</span>
        </h1>
        <p className="text-[clamp(14px,3.6vw,18px)] font-bold uppercase tracking-[0.32em] text-white/90">Beauty Studio</p>
      </div>
      <div className="absolute inset-x-0 bottom-[22%] top-[24%] mx-auto max-w-[460px]">
        {SCENES.map((S, k) => (
          <div key={k} className="absolute inset-0 transition-opacity duration-700 ease-in-out" style={{ opacity: k === i ? 1 : 0 }}>
            <S />
          </div>
        ))}
      </div>
      <div className="absolute inset-x-0 bottom-[8%] flex flex-col items-center gap-3 px-8 text-center">
        {error ? (
          <>
            <p className="max-w-xs text-[14px] font-semibold text-white">{error}</p>
            <button type="button" onClick={onRetry} className="min-h-11 rounded-full bg-white px-6 text-[16px] font-black text-[#2b1622]">
              Try again
            </button>
          </>
        ) : (
          <>
            <p className="text-[16px] font-extrabold text-white" aria-live="polite">
              Loading your scenes<span className="ds-ellipsis" aria-hidden />
            </p>
            <div className="h-2 w-64 overflow-hidden rounded-full bg-white/25 shadow-inner" role="progressbar" aria-label="Loading" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
              <div className="h-full rounded-full bg-gradient-to-r from-[#ffd1e6] via-white to-[#ffe3b0] transition-[width] duration-300" style={{ width: `${Math.max(3, pct)}%` }} />
            </div>
            <p className="text-[12px] font-bold tabular-nums text-white/80">{pct}%</p>
          </>
        )}
      </div>
    </div>
  )
}
