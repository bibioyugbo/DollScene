import { useId } from 'react'

/**
 * Isolated "3D" icons for the game's four places: soft gradients, a lit top face,
 * a darker side and a floor shadow, so they read like little toys rather than glyphs.
 */

export type PlaceIcon = 'crib' | 'drip' | 'chat' | 'dollscene'

export function Icon3D({ name, className = 'size-12' }: { name: PlaceIcon; className?: string }) {
  const id = useId().replace(/:/g, '')
  const shadow = <ellipse cx="32" cy="58" rx="18" ry="3.5" fill="#0E0B10" opacity=".18" />
  if (name === 'crib')
    return (
      <svg viewBox="0 0 64 64" className={className} aria-hidden>
        <defs>
          <linearGradient id={`r${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#E9906F" />
            <stop offset="1" stopColor="#B5523B" />
          </linearGradient>
          <linearGradient id={`w${id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#FFF7EE" />
            <stop offset="1" stopColor="#F1DCCB" />
          </linearGradient>
        </defs>
        {shadow}
        {/* side wall (darker) and front wall */}
        <path d="M44 30l10-6v24l-10 6z" fill="#E2C3AE" />
        <path d="M12 30h32v24H12z" fill={`url(#w${id})`} />
        {/* roof: front slope and side */}
        <path d="M8 31L28 12h10l16 12-10 6z" fill="#8E3B28" />
        <path d="M8 31L28 12l20 18z" fill={`url(#r${id})`} />
        <path d="M28 12l20 18" stroke="#FFFFFF" strokeOpacity=".5" strokeWidth="1.5" />
        {/* door + lit window */}
        <rect x="16" y="40" width="9" height="14" rx="2" fill="#8C5A3C" />
        <circle cx="23" cy="47.5" r=".9" fill="#F5D06F" />
        <rect x="30" y="38" width="10" height="8" rx="1.5" fill="#FFE59A" />
        <path d="M35 38v8M30 42h10" stroke="#E2C3AE" strokeWidth="1" />
        <path d="M14 31.5h28" stroke="#FFFFFF" strokeOpacity=".7" strokeWidth="1" />
      </svg>
    )
  if (name === 'drip')
    return (
      <svg viewBox="0 0 64 64" className={className} aria-hidden>
        <defs>
          <linearGradient id={`b${id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#4A4550" />
            <stop offset="1" stopColor="#141218" />
          </linearGradient>
        </defs>
        {shadow}
        {/* side panel then front */}
        <path d="M46 22l7 4-2 28-7 2z" fill="#0A090C" />
        <path d="M13 22h33l-2 34H15z" fill={`url(#b${id})`} />
        <path d="M13 22h33l7 4H20z" fill="#6A6470" />
        {/* handles */}
        <path d="M22 24c0-12 15-12 15 0" fill="none" stroke="#D4AF37" strokeWidth="3" strokeLinecap="round" />
        <path d="M27 26c0-10 14-10 14 0" fill="none" stroke="#9C7A1C" strokeWidth="2.5" strokeLinecap="round" opacity=".7" />
        {/* tag + shine */}
        <rect x="21" y="34" width="14" height="9" rx="2" fill="#FFFFFF" opacity=".9" />
        <path d="M24 38.5h8" stroke="#141218" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M17 26l-1 24" stroke="#FFFFFF" strokeOpacity=".45" strokeWidth="2" strokeLinecap="round" />
      </svg>
    )
  if (name === 'chat')
    return (
      <svg viewBox="0 0 64 64" className={className} aria-hidden>
        <defs>
          <linearGradient id={`c${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#D9E4F2" />
            <stop offset="1" stopColor="#8EA3BF" />
          </linearGradient>
          <linearGradient id={`d${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#FFFFFF" />
            <stop offset="1" stopColor="#E6E9EF" />
          </linearGradient>
        </defs>
        {shadow}
        {/* back bubble */}
        <path d="M26 10h24a8 8 0 018 8v12a8 8 0 01-8 8h-2l2 7-9-7H26a8 8 0 01-8-8V18a8 8 0 018-8z" fill={`url(#c${id})`} />
        <path d="M28 13h20" stroke="#FFFFFF" strokeOpacity=".5" strokeWidth="2" strokeLinecap="round" />
        {/* front bubble with depth */}
        <path d="M14 25h24a8 8 0 018 8v11a8 8 0 01-8 8H24l-9 6 1-6h-2a8 8 0 01-8-8V33a8 8 0 018-8z" fill="#B9C2CF" transform="translate(1.5 2)" />
        <path d="M14 25h24a8 8 0 018 8v11a8 8 0 01-8 8H24l-9 6 1-6h-2a8 8 0 01-8-8V33a8 8 0 018-8z" fill={`url(#d${id})`} />
        {[18, 26, 34].map((x) => (
          <circle key={x} cx={x} cy="38.5" r="2.6" fill="#5B6577" />
        ))}
      </svg>
    )
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <defs>
        <radialGradient id={`g${id}`} cx=".35" cy=".3" r=".8">
          <stop offset="0" stopColor="#D8F1FF" />
          <stop offset=".55" stopColor="#5FA8D3" />
          <stop offset="1" stopColor="#1F5F8B" />
        </radialGradient>
        <clipPath id={`k${id}`}>
          <circle cx="32" cy="31" r="20" />
        </clipPath>
      </defs>
      {shadow}
      <ellipse cx="32" cy="31" rx="29" ry="8" fill="none" stroke="#C7CAD1" strokeWidth="2" transform="rotate(-18 32 31)" opacity=".7" />
      <circle cx="32" cy="31" r="20" fill={`url(#g${id})`} />
      <g clipPath={`url(#k${id})`} fill="#8CCB7E" opacity=".95">
        <path d="M26 16c5-2 10 1 11 5s-2 5 0 9-3 8-5 11c-2 2-4 1-4-2s-3-5-4-8-3-4-2-8 2-6 4-7z" />
        <path d="M42 20c3 0 6 3 6 6s-3 2-5 1-4-6-1-7z" />
      </g>
      <ellipse cx="25" cy="22" rx="6" ry="3" fill="#FFFFFF" opacity=".5" transform="rotate(-30 25 22)" />
      {/* front of the ring */}
      <path d="M4.6 36a29 8 -18 0 0 54.6-17" fill="none" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" />
      {/* map pin */}
      <path d="M44 6c4 0 7 3 7 7 0 5-7 12-7 12s-7-7-7-12c0-4 3-7 7-7z" fill="#C8FF3D" stroke="#1E0B26" strokeWidth="1.5" />
      <circle cx="44" cy="13" r="2.4" fill="#1E0B26" />
    </svg>
  )
}
