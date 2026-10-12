import { useId } from 'react'
import { Link } from 'react-router'
import { APP_NAME } from '../config/env'

/**
 * The DollScene logo and favicon (public/favicon.svg): a plain doll silhouette (no
 * face, no hair) in a rounded box. The doll is always pink; the box takes
 * --logo-box so it sits right in each landing scene.
 */
export function DollMark({ className = 'size-10' }: { className?: string }) {
  const clip = `tile${useId().replace(/:/g, '')}`
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <defs>
        <clipPath id={clip}>
          <rect width="64" height="64" rx="16" />
        </clipPath>
      </defs>
      <rect width="64" height="64" rx="16" fill="var(--logo-box, #FFE3EF)" className="transition-[fill] duration-500" />
      <g clipPath={`url(#${clip})`} fill="#FF2E88">
        <circle cx="32" cy="25" r="12" />
        <rect x="28" y="34" width="8" height="10" rx="3" />
        <path d="M11 68c1.4-12 10-19 21-19s19.6 7 21 19z" />
      </g>
    </svg>
  )
}

/**
 * Globe mark for the module loader: a pink doll silhouette inside a globe,
 * wrapped by a tilted orbit ring with a sparkle riding on it.
 */
export function GlobeMark({ className = 'size-10', spin = false }: { className?: string; spin?: boolean }) {
  const id = useId().replace(/:/g, '')
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <defs>
        <radialGradient id={`g${id}`} cx="0.36" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#3A2F3F" />
          <stop offset="0.65" stopColor="#140F18" />
          <stop offset="1" stopColor="#0B080D" />
        </radialGradient>
        <linearGradient id={`p${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FF8CC4" />
          <stop offset="1" stopColor="#FF2E88" />
        </linearGradient>
        <clipPath id={`c${id}`}>
          <circle cx="32" cy="32" r="22" />
        </clipPath>
      </defs>
      {/* back half of the orbit */}
      <ellipse cx="32" cy="32" rx="30" ry="9" fill="none" stroke="#C7CAD1" strokeOpacity="0.45" strokeWidth="1.4" transform="rotate(-24 32 32)" />
      {/* globe */}
      <circle cx="32" cy="32" r="22" fill={`url(#g${id})`} />
      <g clipPath={`url(#c${id})`} fill="none" stroke="#C7CAD1" strokeOpacity="0.28" strokeWidth="0.9">
        {spin ? (
          // Meridians sweep across like a turning globe.
          <g>
            {[0, 1, 2, 3].map((i) => (
              <ellipse key={i} cx="32" cy="32" rx="22" ry="22">
                <animate attributeName="rx" values="22;0;22" keyTimes="0;0.5;1" dur="2.4s" begin={`${-i * 0.6}s`} repeatCount="indefinite" />
              </ellipse>
            ))}
          </g>
        ) : (
          <g>
            <ellipse cx="32" cy="32" rx="9" ry="22" />
            <ellipse cx="32" cy="32" rx="17" ry="22" />
            <line x1="32" y1="10" x2="32" y2="54" />
          </g>
        )}
        <line x1="10" y1="24" x2="54" y2="24" />
        <line x1="10" y1="32" x2="54" y2="32" />
        <line x1="10" y1="40" x2="54" y2="40" />
        {/* hint of Africa */}
        <path d="M30 22c4-1 8 1 9 5 1 3-1 4 1 7 1 3-2 6-4 9-1 2-3 2-3-1 0-3-2-4-3-7-1-2-4-3-3-7 0-3 1-5 3-6z" fill="#FF2E88" fillOpacity="0.12" stroke="none" />
      </g>
      {/* doll silhouette */}
      <g fill={`url(#p${id})`}>
        <circle cx="32" cy="16.5" r="3.6" />
        <circle cx="32" cy="22.4" r="4.4" />
        <rect x="30.8" y="26.2" width="2.4" height="2.4" rx="1" />
        <path d="M28.6 28.2h6.8l1.4 4.2-1.6.4 3.8 10.6H25l3.8-10.6-1.6-.4z" />
        <rect x="29.4" y="43.4" width="1.9" height="5.8" rx="0.9" />
        <rect x="32.7" y="43.4" width="1.9" height="5.8" rx="0.9" />
      </g>
      <path d="M28.2 16.3l-3.4-2.3v4.6zM28.2 16.3l3.2-1.6-.2 3.2z" fill="#FFFFFF" fillOpacity="0.9" />
      {/* front half of the orbit + sparkle */}
      <path d="M2.6 38.8a30 9 -24 0 0 58.8-13.6" fill="none" stroke="#C7CAD1" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M53 18.5l1.2 2.9 2.9 1.2-2.9 1.2-1.2 2.9-1.2-2.9-2.9-1.2 2.9-1.2z" fill="#C8FF3D" />
    </svg>
  )
}

export function Logo({ compact = false, className = '' }: { compact?: boolean; className?: string }) {
  return (
    <Link to="/" className={`inline-flex min-h-11 items-center gap-2 rounded-full pr-2 ${className}`} aria-label={`${APP_NAME} home`}>
      <DollMark className="size-10" />
      {!compact && <span className="font-brand text-2xl font-black tracking-tight text-foreground">DollScene</span>}
    </Link>
  )
}
