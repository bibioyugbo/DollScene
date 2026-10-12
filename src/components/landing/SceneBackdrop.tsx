import { useMemo, type CSSProperties } from 'react'
import type { SceneId } from './scenes'

/** Deterministic scatter so stars and snow don't jump between renders. */
function scatter(n: number, seed: number) {
  let s = seed
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647)
  return Array.from({ length: n }, () => ({ x: r() * 100, y: r() * 100, a: r(), b: r(), c: r() }))
}

/** The world behind the globe: bubblegum wallpaper, deep space, an earthy valley or a snowfield. */
export function SceneBackdrop({ scene, reducedMotion }: { scene: SceneId; reducedMotion: boolean }) {
  if (scene === 'spacy') return <Space still={reducedMotion} />
  if (scene === 'earthy') return <Valley />
  if (scene === 'icy') return <Snow still={reducedMotion} />
  return <div aria-hidden className="bg-floral absolute inset-0" />
}

function Space({ still }: { still: boolean }) {
  const stars = useMemo(() => scatter(170, 7), [])
  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden bg-[radial-gradient(ellipse_at_70%_15%,#4A2B8C_0%,transparent_55%),radial-gradient(ellipse_at_15%_90%,#5A1F7A_0%,transparent_50%),linear-gradient(#140B33,#1E1048)]">
      {stars.map((p, i) => {
        const size = p.a < 0.85 ? 1.5 : p.a < 0.97 ? 2.5 : 3.5
        return (
          <span
            key={i}
            className="absolute rounded-full bg-white"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: size,
              height: size,
              opacity: 0.35 + p.b * 0.65,
              boxShadow: size > 2 ? '0 0 6px 1px rgb(200 190 255 / 0.8)' : undefined,
              animation: still ? undefined : `twinkle ${2 + p.c * 4}s ease-in-out ${-p.b * 5}s infinite`,
            }}
          />
        )
      })}
    </div>
  )
}

/** One repeating tile of snowflakes, as an image, so a whole layer of snow is a single cheap texture. */
function snowTile(seed: number, size: number, n: number, min: number, max: number): string {
  const flake = (x: number, y: number, r: number, rot: number) =>
    `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${rot.toFixed(0)}) scale(${(r / 10).toFixed(2)})"><path d="M0 -10V10M-3.5 -7.5L0 -4.5 3.5 -7.5M-3.5 7.5L0 4.5 3.5 7.5"/><path transform="rotate(60)" d="M0 -10V10M-3.5 -7.5L0 -4.5 3.5 -7.5M-3.5 7.5L0 4.5 3.5 7.5"/><path transform="rotate(120)" d="M0 -10V10M-3.5 -7.5L0 -4.5 3.5 -7.5M-3.5 7.5L0 4.5 3.5 7.5"/></g>`
  const body = scatter(n, seed)
    .map((p) => flake(12 + (p.x / 100) * (size - 24), 12 + (p.y / 100) * (size - 24), min + p.a * (max - min), p.b * 60))
    .join('')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><g fill="none" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" opacity=".9">${body}</g></svg>`
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
}

/** Icy: pale sky, snow drifts and three layers of snowflakes falling at different speeds. */
function Snow({ still }: { still: boolean }) {
  const layers = useMemo(
    () => [
      { size: 430, bg: snowTile(11, 430, 16, 2.5, 4.5), dur: 18, opacity: 0.6 },
      { size: 610, bg: snowTile(23, 610, 12, 4.5, 7.5), dur: 13, opacity: 0.8 },
      { size: 790, bg: snowTile(37, 790, 7, 8, 12), dur: 9, opacity: 0.95 },
    ],
    [],
  )
  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden bg-[radial-gradient(ellipse_at_50%_0%,#FFFFFF_0%,transparent_60%),linear-gradient(#DDF1FF,#BFE2F8)]">
      {layers.map((l, i) => (
        <div
          key={i}
          className="absolute inset-x-0 will-change-transform"
          style={{ top: -l.size, height: `calc(100% + ${l.size}px)`, backgroundImage: l.bg, backgroundSize: `${l.size}px ${l.size}px`, opacity: l.opacity, '--tile': `${l.size}px`, animation: still ? undefined : `snow-drift ${l.dur}s linear infinite` } as CSSProperties}
        />
      ))}
      {/* snow drifts */}
      <svg viewBox="0 0 1200 200" preserveAspectRatio="none" className="absolute inset-x-0 bottom-0 h-[22%] w-full">
        <path d="M0 120C150 70 300 90 450 110S750 60 900 90 1100 120 1200 80V200H0Z" fill="#EAF7FF" />
        <path d="M0 160C200 120 380 140 600 150S1000 120 1200 140V200H0Z" fill="#FFFFFF" />
      </svg>
    </div>
  )
}

/** Earthy: a soft valley with hills, trees, bushes, a stream and small animals far away. */
function Valley() {
  const tree = (x: number, y: number, s: number, c: string) => (
    <g key={`${x}-${y}`} transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x="-3" y="0" width="6" height="22" rx="2" fill="#7A5634" />
      <circle cx="0" cy="-8" r="16" fill={c} />
      <circle cx="-10" cy="0" r="11" fill={c} />
      <circle cx="10" cy="-1" r="12" fill={c} />
      <circle cx="-4" cy="-14" r="7" fill="#FFFFFF" opacity=".12" />
    </g>
  )
  const deer = (x: number, y: number, s: number, flip = false) => (
    <g transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s})`} fill="#5C4630" opacity=".75">
      <ellipse cx="0" cy="0" rx="9" ry="4.5" />
      <rect x="6" y="-11" width="3" height="10" rx="1.5" transform="rotate(18 7 -6)" />
      <ellipse cx="11" cy="-12" rx="3.6" ry="2.4" />
      <path d="M10 -14l-2-5M12 -14l2-5" stroke="#5C4630" strokeWidth="1" />
      <rect x="-7" y="2" width="1.6" height="9" />
      <rect x="-3" y="2" width="1.6" height="9" />
      <rect x="3" y="2" width="1.6" height="9" />
      <rect x="6.5" y="2" width="1.6" height="9" />
    </g>
  )
  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden bg-[linear-gradient(#CFE8F2_0%,#F3EEDC_55%,#E8DDBF_100%)]">
      <svg viewBox="0 0 1200 800" preserveAspectRatio="xMidYMax slice" className="absolute inset-0 h-full w-full">
        {/* sun haze and birds */}
        <circle cx="980" cy="150" r="70" fill="#FFF4C9" opacity=".8" />
        {[
          [220, 130],
          [250, 118],
          [270, 140],
          [860, 210],
          [885, 200],
        ].map(([x, y]) => (
          <path key={`${x}${y}`} d={`M${x} ${y}q6-6 12 0q6-6 12 0`} fill="none" stroke="#5C4A3A" strokeWidth="2" opacity=".55" />
        ))}
        {/* far hills */}
        <path d="M0 470C140 400 260 420 380 450S640 380 800 420 1060 390 1200 430V800H0Z" fill="#B9CFA0" />
        <path d="M0 540C180 480 340 500 520 520S860 470 1200 510V800H0Z" fill="#9DBF7E" />
        {/* distant trees and grazing deer */}
        {[90, 160, 300, 700, 760, 1080, 1130].map((x, i) => tree(x, 470 + (i % 3) * 14, 0.7, i % 2 ? '#7FA65A' : '#6E9A4A'))}
        {deer(430, 525, 1.1)}
        {deer(470, 530, 0.9, true)}
        {deer(980, 505, 1)}
        {/* near meadow and stream */}
        <path d="M0 620C220 570 420 600 620 610S980 570 1200 600V800H0Z" fill="#7FAE57" />
        <path d="M560 800C590 730 520 690 600 650S760 610 820 560C830 555 845 560 838 568 790 620 680 640 640 680S660 760 640 800Z" fill="#7CC3E0" />
        <path d="M600 760C610 730 580 705 620 680M700 640C740 625 770 600 800 575" fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" opacity=".6" />
        {/* bushes, flowers and big trees in front */}
        {[
          [80, 690],
          [300, 700],
          [920, 690],
          [1110, 700],
        ].map(([x, y]) => (
          <g key={x}>
            <circle cx={x} cy={y} r="26" fill="#5E8C3E" />
            <circle cx={x + 24} cy={y + 6} r="20" fill="#6E9A4A" />
            <circle cx={x - 22} cy={y + 8} r="18" fill="#6E9A4A" />
          </g>
        ))}
        {[40, 1160].map((x) => tree(x, 600, 2.3, '#5E8C3E'))}
        {[150, 210, 380, 860, 1000, 1060].map((x, i) => (
          <circle key={x} cx={x} cy={740 + (i % 2) * 18} r="4" fill={i % 2 ? '#FFD95A' : '#FFFFFF'} />
        ))}
      </svg>
    </div>
  )
}
