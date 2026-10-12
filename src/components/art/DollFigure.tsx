import { useId } from 'react'
import { getItem } from '../../shared/catalog'
import type { AvatarSummary, CatalogItem, Outfit } from '../../shared/types'
import { hairKind } from './DollAvatar'
import { PatternDef } from './patterns'

/** Flat full-length doll wearing an outfit. Used for look posts and "send my look" cards. */
export function DollFigure({ avatar, outfit, className = 'h-full w-auto' }: { avatar: AvatarSummary; outfit: Outfit; className?: string }) {
  const uid = useId().replace(/:/g, '')
  const masc = avatar.base === 'masculine'
  const skin = avatar.skin
  const items: Partial<Record<keyof Outfit, CatalogItem>> = {}
  for (const [slot, id] of Object.entries(outfit)) {
    const it = getItem(id)
    if (it) items[slot as keyof Outfit] = it
  }
  const fill = (slot: keyof Outfit, fallback: string) => {
    const it = items[slot]
    if (!it) return fallback
    return it.pattern === 'solid' ? it.colors[0] : `url(#${slot}${uid})`
  }
  const sh = masc ? 22 : 18
  const hip = masc ? 15 : 19
  const kind = hairKind(avatar.hairStyle)
  const hairFill = `url(#hair${uid})`
  const dress = items.dress
  const long = dress && ['gown', 'boubou', 'kaftan', 'jumpsuit'].includes(dress.template)
  const bottom = items.bottom
  const trousers = bottom && ['trousers', 'cargo', 'jeans'].includes(bottom.template)
  const skirtLen = bottom ? ({ 'mini-skirt': 30, shorts: 26, 'midi-skirt': 56, 'maxi-skirt': 76, wrapper: 70 } as Record<string, number>)[bottom.template] ?? 40 : 0

  return (
    <svg viewBox="0 0 100 210" className={className} aria-hidden>
      <defs>
        {Object.entries(items).map(([slot, it]) => (
          <PatternDef key={slot} id={`${slot}${uid}`} pattern={it.pattern} c1={it.colors[0]} c2={it.colors[1]} />
        ))}
        <linearGradient id={`hair${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0.3" stopColor={avatar.hairColor} />
          <stop offset="1" stopColor={avatar.hairColor2} />
        </linearGradient>
      </defs>
      {/* back hair */}
      {(kind === 'long' || kind === 'locs') && <path d="M34 22c0-12 7-18 16-18s16 6 16 18v44H34z" fill={hairFill} />}
      {kind === 'round' && <circle cx="50" cy="20" r="19" fill={hairFill} />}
      {kind === 'bun' && <circle cx="50" cy="4" r="7" fill={hairFill} />}
      {kind === 'puffs' && (
        <g fill={hairFill}>
          <circle cx="36" cy="10" r="8" />
          <circle cx="64" cy="10" r="8" />
        </g>
      )}
      {/* legs and arms */}
      <rect x="40" y="120" width="8" height="74" rx="4" fill={skin} />
      <rect x="52" y="120" width="8" height="74" rx="4" fill={skin} />
      <rect x={50 - sh - 6} y="50" width="7" height="58" rx="3.5" fill={skin} transform={`rotate(6 ${50 - sh} 50)`} />
      <rect x={50 + sh - 1} y="50" width="7" height="58" rx="3.5" fill={skin} transform={`rotate(-6 ${50 + sh} 50)`} />
      {/* torso */}
      <path d={`M${50 - sh} 50 L${50 + sh} 50 L${50 + hip - 6} 92 L${50 + hip} 120 L${50 - hip} 120 L${50 - hip + 6} 92 Z`} fill={skin} />
      <rect x="45" y="38" width="10" height="14" rx="4" fill={skin} />
      {/* clothes */}
      {dress ? (
        <path
          d={`M${50 - sh} 50 L${50 + sh} 50 L${50 + hip - 4} 92 L${50 + hip + (long ? 14 : 8)} ${long ? 196 : 146} L${50 - hip - (long ? 14 : 8)} ${long ? 196 : 146} L${50 - hip + 4} 92 Z`}
          fill={fill('dress', '#FFB3D1')}
        />
      ) : (
        <>
          {trousers ? (
            <path d={`M${50 - hip} 104 L${50 + hip} 104 L${50 + hip - 2} 190 L52 190 L50 128 L48 190 L${50 - hip + 2} 190 Z`} fill={fill('bottom', '#2B2B2B')} />
          ) : bottom ? (
            <path d={`M${50 - hip + 2} 104 L${50 + hip - 2} 104 L${50 + hip + 6} ${104 + skirtLen} L${50 - hip - 6} ${104 + skirtLen} Z`} fill={fill('bottom', '#2B2B2B')} />
          ) : null}
          <path
            d={`M${50 - sh} 50 L${50 + sh} 50 L${50 + hip - 4} ${items.top?.template === 'crop' ? 90 : 108} L${50 - hip + 4} ${items.top?.template === 'crop' ? 90 : 108} Z`}
            fill={fill('top', items.swimwear ? fill('swimwear', '#FF3D8B') : '#FFFFFF')}
          />
        </>
      )}
      {items.outerwear && (
        <g fill={fill('outerwear', '#2B2B2B')}>
          <path d={`M${50 - sh - 2} 48 L44 48 L42 ${items.outerwear.template === 'agbada' ? 150 : 116} L${50 - hip - 10} ${items.outerwear.template === 'agbada' ? 150 : 116} Z`} />
          <path d={`M${50 + sh + 2} 48 L56 48 L58 ${items.outerwear.template === 'agbada' ? 150 : 116} L${50 + hip + 10} ${items.outerwear.template === 'agbada' ? 150 : 116} Z`} />
        </g>
      )}
      {/* shoes */}
      <path d="M38 190h12v8H34c0-4 2-8 4-8zM50 190h12c2 0 4 4 4 8H50z" fill={fill('shoes', '#FFFFFF')} />
      {/* head */}
      <ellipse cx="50" cy="24" rx="12" ry="14" fill={avatar.skin} />
      {kind !== 'none' && kind !== 'knots' && <path d="M37 22c1-9 6-13 13-13s12 4 13 13c-4-4-8-6-13-6s-9 2-13 6z" fill={hairFill} />}
      {kind === 'knots' &&
        [38, 50, 62].map((x) => (
          <circle key={x} cx={x} cy={x === 50 ? 8 : 12} r="4.5" fill={hairFill} />
        ))}
      {items.headwear?.template === 'gele' && <path d="M30 18c4-16 36-16 40 0-6-4-12-3-20-8-8 5-14 4-20 8z" fill={fill('headwear', '#C9A227')} />}
      <circle cx="45.5" cy="25" r="1.8" fill="#1E0B26" />
      <circle cx="54.5" cy="25" r="1.8" fill="#1E0B26" />
      <path d="M46.5 31.5q3.5 2.2 7 0" stroke={masc ? '#5A2A26' : avatar.lipColor} strokeWidth="1.8" fill="none" strokeLinecap="round" />
    </svg>
  )
}
