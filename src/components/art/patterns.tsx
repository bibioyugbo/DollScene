import type { Pattern } from '../../shared/types'

/** SVG <pattern> fills for textiles. Use `fill="url(#id)"`. */
export function PatternDef({ id, pattern, c1, c2 }: { id: string; pattern: Pattern; c1: string; c2: string }) {
  const size = 10
  const common = { id, patternUnits: 'userSpaceOnUse' as const, width: size, height: size }
  switch (pattern) {
    case 'ankara':
      return (
        <pattern {...common}>
          <rect width={size} height={size} fill={c1} />
          <circle cx="5" cy="5" r="3.2" fill={c2} />
          <circle cx="5" cy="5" r="1.6" fill={c1} />
          <circle cx="0" cy="0" r="1.4" fill={c2} />
          <circle cx="10" cy="10" r="1.4" fill={c2} />
          <circle cx="10" cy="0" r="1.4" fill={c2} />
          <circle cx="0" cy="10" r="1.4" fill={c2} />
        </pattern>
      )
    case 'adire':
      return (
        <pattern {...common}>
          <rect width={size} height={size} fill={c1} />
          <path d="M0 2.5h10M0 7.5h10" stroke={c2} strokeWidth="0.8" strokeDasharray="1.2 1" />
          <circle cx="2.5" cy="5" r="0.9" fill={c2} />
          <circle cx="7.5" cy="5" r="0.9" fill={c2} />
        </pattern>
      )
    case 'aso-oke':
      return (
        <pattern {...common}>
          <rect width={size} height={size} fill={c1} />
          <rect x="0" width="1.4" height={size} fill={c2} />
          <rect x="4" width="0.6" height={size} fill={c2} opacity="0.7" />
          <rect x="6.5" width="0.6" height={size} fill={c2} opacity="0.7" />
        </pattern>
      )
    case 'kente':
      return (
        <pattern {...common}>
          <rect width={size} height={size} fill={c1} />
          <rect width="5" height="5" fill={c2} />
          <rect x="5" y="5" width="5" height="5" fill={c2} />
          <path d="M0 2.5h5M5 7.5h5" stroke="#1E0B26" strokeWidth="0.6" />
        </pattern>
      )
    case 'denim':
      return (
        <pattern {...common} width={4} height={4}>
          <rect width="4" height="4" fill={c1} />
          <path d="M0 4 4 0" stroke={c2} strokeWidth="0.5" opacity="0.6" />
        </pattern>
      )
    case 'leopard':
      return (
        <pattern {...common}>
          <rect width={size} height={size} fill={c1} />
          <ellipse cx="3" cy="3" rx="1.6" ry="1.1" fill="none" stroke="#2B1A10" strokeWidth="0.8" />
          <ellipse cx="8" cy="7.5" rx="1.4" ry="1" fill="none" stroke="#2B1A10" strokeWidth="0.8" />
          <circle cx="7.5" cy="2" r="0.6" fill="#2B1A10" />
        </pattern>
      )
    case 'check':
      return (
        <pattern {...common}>
          <rect width={size} height={size} fill={c1} />
          <rect width="5" height={size} fill={c2} opacity="0.35" />
          <rect width={size} height="5" fill={c2} opacity="0.35" />
        </pattern>
      )
    case 'stripe':
      return (
        <pattern {...common} width={6} height={6}>
          <rect width="6" height="6" fill={c1} />
          <rect width="2.5" height="6" fill={c2} />
        </pattern>
      )
    case 'floral':
      return (
        <pattern {...common}>
          <rect width={size} height={size} fill={c1} />
          {[0, 72, 144, 216, 288].map((a) => (
            <circle key={a} cx={5 + Math.cos((a * Math.PI) / 180) * 1.6} cy={5 + Math.sin((a * Math.PI) / 180) * 1.6} r="1.1" fill={c2} />
          ))}
          <circle cx="5" cy="5" r="0.8" fill="#FFC24D" />
        </pattern>
      )
    case 'monogram':
      return (
        <pattern {...common}>
          <rect width={size} height={size} fill={c1} />
          <text x="5" y="7" fontSize="6" textAnchor="middle" fill={c2} fontFamily="serif" fontWeight="bold">
            D
          </text>
        </pattern>
      )
    case 'sequin':
      return (
        <pattern {...common} width={4} height={4}>
          <rect width="4" height="4" fill={c1} />
          <circle cx="1" cy="1" r="0.8" fill="#fff" opacity="0.55" />
          <circle cx="3" cy="3" r="0.8" fill={c2} opacity="0.6" />
        </pattern>
      )
    case 'lace':
      return (
        <pattern {...common}>
          <rect width={size} height={size} fill={c1} />
          <circle cx="5" cy="5" r="2.5" fill="none" stroke={c2} strokeWidth="0.6" />
          <circle cx="0" cy="0" r="2.5" fill="none" stroke={c2} strokeWidth="0.6" />
          <circle cx="10" cy="10" r="2.5" fill="none" stroke={c2} strokeWidth="0.6" />
        </pattern>
      )
    default:
      return (
        <pattern {...common}>
          <rect width={size} height={size} fill={c1} />
        </pattern>
      )
  }
}

let counter = 0
export const uniqueId = (prefix: string) => `${prefix}-${++counter}`
