import { useId, type ReactNode } from 'react'

/**
 * Illustrated product and action icons for the medium tiles: the picture itself says what the tile
 * does (a pimple being popped, a cotton pad and toner, a sunscreen tube, a blush compact...).
 * 64 x 64 viewBox, flat shapes with a soft highlight, tinted by the product's colour.
 */

export type ArtKind =
  // skincare
  | 'wake'
  | 'bonnetOff'
  | 'wash'
  | 'foamCleanser'
  | 'balmCleanser'
  | 'micellar'
  | 'pop'
  | 'patch'
  | 'patchOff'
  | 'spotGel'
  | 'compress'
  | 'soothe'
  | 'brighten'
  | 'scrub'
  | 'toner'
  | 'serum'
  | 'eyeCream'
  | 'moisturiser'
  | 'sunscreen'
  | 'lipBalm'
  // makeup
  | 'primer'
  | 'corrector'
  | 'foundation'
  | 'concealer'
  | 'powder'
  | 'setting'
  | 'contour'
  | 'bronzer'
  | 'blush'
  | 'highlight'
  | 'eyeshadow'
  | 'innerCorner'
  | 'liner'
  | 'lowerLiner'
  | 'mascara'
  | 'browPencil'
  | 'browShape'
  | 'lashes'
  | 'lipLiner'
  | 'lipstick'
  | 'gloss'
  | 'lipCentre'
  | 'look'
  | 'remove'
  | 'polish'
  // jewellery
  | 'earrings'
  | 'noseRing'
  | 'necklace'
  | 'bracelet'
  | 'rings'
  | 'glasses'
  | 'piercing'
  // accessories
  | 'beads'
  | 'band'
  | 'whisk'
  | 'fan'
  | 'clutch'
  | 'joint'
  | 'pins'
  // hair care
  | 'hairBrush'
  | 'hairWash'
  | 'hairDry'
  | 'takedown'
  | 'retwist'
  | 'bonnet'
  | 'dye'
  | 'ombre'
  // clinic
  | 'syringe'
  | 'nose'
  | 'chisel'
  | 'hairline'
  | 'body'
  | 'drip'
  | 'none'

interface Props {
  kind: ArtKind
  /** Product / shade colour. */
  color?: string
  /** Secondary colour (cap, second shade). */
  color2?: string
  /** Skin tone for face/finger drawings. */
  skin?: string
  className?: string
}

const shine = (id: string) => (
  <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stopColor="#fff" stopOpacity="0.55" />
    <stop offset="0.45" stopColor="#fff" stopOpacity="0" />
  </linearGradient>
)

export function Art({ kind, color = '#E8B48A', color2 = '#2B2B33', skin = '#8A5A3C', className = 'h-full w-full' }: Props) {
  const id = `dsa${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const S = `url(#${id})`
  const cap = color2
  const body = (): ReactNode => {
    switch (kind) {
      /* ---------------- skincare ---------------- */
      case 'wake':
        return (
          <>
            <circle cx="32" cy="38" r="14" fill="#FFC870" />
            {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
              <rect key={a} x="31" y="12" width="2.4" height="7" rx="1.2" fill="#FFC870" transform={`rotate(${a} 32 38)`} />
            ))}
            <path d="M14 52h36" stroke="#F4ECE4" strokeWidth="3" strokeLinecap="round" />
            <path d="M24 38q8 6 16 0" stroke="#7A4A20" strokeWidth="2.4" fill="none" strokeLinecap="round" />
          </>
        )
      case 'bonnetOff':
      case 'bonnet':
        return (
          <>
            <path d="M12 38c0-13 9-22 20-22s20 9 20 22c0 3-2 5-5 5H17c-3 0-5-2-5-5Z" fill={kind === 'bonnet' ? color : '#C9A7D8'} />
            <path d="M14 40c6 3 30 3 36 0" stroke="#fff" strokeOpacity="0.5" strokeWidth="2" fill="none" />
            <path d="M18 26q14-10 28 0" stroke="#fff" strokeOpacity="0.35" strokeWidth="2" fill="none" />
            {kind === 'bonnetOff' && <path d="M44 14l8-6M48 18l9-3" stroke="#F4ECE4" strokeWidth="2.5" strokeLinecap="round" />}
          </>
        )
      case 'wash':
        return (
          <>
            <ellipse cx="32" cy="34" rx="15" ry="18" fill={skin} />
            {[[20, 22, 3], [42, 26, 2.6], [26, 44, 2.4], [40, 44, 3.2], [33, 16, 2.2], [17, 36, 2]].map(([x, y, r], i) => (
              <g key={i}>
                <path d={`M${x} ${y - r * 1.8}q${r} ${r * 1.6} 0 ${r * 2.8}q-${r} -${r * 1.2} 0 -${r * 2.8}Z`} fill="#BFE6FF" />
                <circle cx={x - r * 0.3} cy={y} r={r * 0.3} fill="#fff" />
              </g>
            ))}
            <path d="M8 56c8-6 40-6 48 0" stroke="#7FD3FF" strokeWidth="3" fill="none" strokeLinecap="round" />
          </>
        )
      case 'foamCleanser':
        return (
          <>
            <rect x="21" y="22" width="22" height="34" rx="6" fill={color} />
            <rect x="27" y="14" width="10" height="9" rx="2" fill={cap} />
            <path d="M37 16h10" stroke={cap} strokeWidth="3" strokeLinecap="round" />
            {[[47, 12, 4], [53, 9, 3], [52, 17, 2.6], [57, 13, 2]].map(([x, y, r], i) => (
              <circle key={i} cx={x} cy={y} r={r} fill="#fff" stroke="#DDE" strokeWidth="0.6" />
            ))}
            <rect x="24" y="30" width="16" height="10" rx="2" fill="#fff" opacity="0.65" />
            <rect x="21" y="22" width="22" height="34" rx="6" fill={S} />
          </>
        )
      case 'balmCleanser':
      case 'moisturiser':
      case 'scrub':
        return (
          <>
            <rect x="12" y="30" width="40" height="22" rx="6" fill={color} />
            <rect x="10" y="24" width="44" height="9" rx="4" fill={cap} />
            <ellipse cx="32" cy="24" rx="20" ry="4" fill={kind === 'scrub' ? '#E9D9C0' : '#FBF6F0'} />
            {kind === 'scrub' && [18, 24, 30, 36, 42, 46, 21, 28, 39].map((x, i) => <circle key={i} cx={x} cy={23 + (i % 3) - 1} r="1.1" fill="#9C6B4A" />)}
            {kind === 'moisturiser' && <path d="M26 22q6-8 12 0" fill="#FBF6F0" />}
            <rect x="12" y="30" width="40" height="22" rx="6" fill={S} />
          </>
        )
      case 'micellar':
      case 'toner':
        return (
          <>
            <rect x="12" y="16" width="20" height="40" rx="5" fill={color} opacity="0.92" />
            <rect x="15" y="10" width="14" height="8" rx="2" fill={cap} />
            <rect x="15" y="30" width="14" height="12" rx="2" fill="#fff" opacity="0.6" />
            <circle cx="45" cy="42" r="12" fill="#F7F5F2" stroke="#E2DCD4" strokeWidth="1.2" />
            <circle cx="45" cy="42" r="8" fill="none" stroke="#E2DCD4" strokeWidth="0.8" strokeDasharray="2 2" />
            <rect x="12" y="16" width="20" height="40" rx="5" fill={S} />
          </>
        )
      case 'pop':
        return (
          <>
            <ellipse cx="32" cy="46" rx="26" ry="14" fill={skin} />
            <circle cx="32" cy="40" r="7" fill="#E46A6A" opacity="0.75" />
            <circle cx="32" cy="38" r="3.2" fill="#FFF3C8" />
            <path d="M8 26c6-2 12 2 15 10" stroke={skin} strokeWidth="9" strokeLinecap="round" fill="none" />
            <path d="M56 26c-6-2-12 2-15 10" stroke={skin} strokeWidth="9" strokeLinecap="round" fill="none" />
            <path d="M8 26c6-2 12 2 15 10M56 26c-6-2-12 2-15 10" stroke="#000" strokeOpacity="0.18" strokeWidth="1.2" fill="none" />
            <path d="M28 26l-2-6M32 25v-7M36 26l2-6" stroke="#FFF3C8" strokeWidth="2" strokeLinecap="round" />
          </>
        )
      case 'patch':
      case 'patchOff':
        return (
          <>
            <ellipse cx="32" cy="42" rx="26" ry="16" fill={skin} />
            <circle cx={kind === 'patch' ? 32 : 26} cy="40" r="10" fill="#EAD9C2" opacity="0.92" stroke="#fff" strokeWidth="1.2" />
            {kind === 'patchOff' && (
              <>
                <path d="M30 34q10-10 22-6l-4 10q-9-2-16 2Z" fill="#EAD9C2" stroke="#fff" strokeWidth="1.2" />
                <circle cx="26" cy="41" r="3" fill="#F4C0B8" />
              </>
            )}
            {kind === 'patch' && <circle cx="32" cy="40" r="3" fill="#E9B6A6" />}
            <path d="M14 18h36" stroke="#F4ECE4" strokeWidth="0" />
          </>
        )
      case 'spotGel':
        return (
          <>
            <ellipse cx="32" cy="46" rx="26" ry="14" fill={skin} />
            <circle cx="40" cy="44" r="4" fill="#E46A6A" opacity="0.7" />
            <circle cx="40" cy="43" r="2.4" fill={color} stroke="#fff" strokeWidth="0.8" />
            <rect x="8" y="12" width="12" height="26" rx="3" fill={color} transform="rotate(-35 14 25)" />
            <rect x="11" y="6" width="6" height="8" rx="1.5" fill={cap} transform="rotate(-35 14 25)" />
          </>
        )
      case 'compress':
        return (
          <>
            <rect x="10" y="26" width="44" height="22" rx="8" fill={color} />
            <path d="M14 34h36M14 40h36" stroke="#fff" strokeOpacity="0.5" strokeWidth="2" />
            {[22, 32, 42].map((x) => (
              <path key={x} d={`M${x} 22c-4-4 4-6 0-10`} stroke="#F4ECE4" strokeWidth="2.4" fill="none" strokeLinecap="round" opacity="0.85" />
            ))}
          </>
        )
      case 'soothe':
        return (
          <>
            <path d="M18 56c-2-18 4-32 14-44 2 14 2 30-14 44Z" fill="#5FAE6A" />
            <path d="M32 56c2-16 10-28 22-34-2 14-8 28-22 34Z" fill="#7CC77F" />
            <path d="M22 50c2-10 6-20 10-30M34 52c6-8 10-16 16-24" stroke="#CFF2D0" strokeWidth="1.4" fill="none" />
            {[[40, 18], [46, 30], [26, 26]].map(([x, y], i) => (
              <path key={i} d={`M${x} ${y - 4}q3 3 0 6q-3-3 0-6Z`} fill="#DFF7E2" />
            ))}
          </>
        )
      case 'brighten':
      case 'serum':
        return (
          <>
            <rect x="18" y="26" width="24" height="30" rx="6" fill={color} opacity="0.9" />
            <rect x="24" y="16" width="12" height="11" rx="2" fill={cap} />
            <rect x="27" y="6" width="6" height="11" rx="3" fill="#EDE6DE" />
            <path d="M30 56q0 4 0 0" stroke={color} />
            <circle cx="49" cy="46" r="3" fill={color} />
            <path d="M49 38v4" stroke={color} strokeWidth="2" strokeLinecap="round" />
            {kind === 'brighten' && <path d="M50 14l1.6 4.2 4.2 1.6-4.2 1.6L50 25.6l-1.6-4.2-4.2-1.6 4.2-1.6Z" fill="#FFE18A" />}
            <rect x="18" y="26" width="24" height="30" rx="6" fill={S} />
          </>
        )
      case 'eyeCream':
        return (
          <>
            <path d="M8 32s10-12 24-12 24 12 24 12-10 12-24 12S8 32 8 32Z" fill="#fff" stroke={skin} strokeWidth="3" />
            <circle cx="32" cy="32" r="7" fill="#5A3A2A" />
            <circle cx="30" cy="30" r="2" fill="#fff" />
            <path d="M14 46q18 8 36 0" stroke={color} strokeWidth="4" fill="none" strokeLinecap="round" strokeDasharray="1 6" />
          </>
        )
      case 'sunscreen':
        return (
          <>
            <path d="M16 54 22 16h20l6 38Z" fill={color} />
            <rect x="24" y="8" width="16" height="9" rx="2" fill={cap} />
            <circle cx="32" cy="34" r="6" fill="#FFB43C" />
            {[0, 60, 120, 180, 240, 300].map((a) => (
              <rect key={a} x="31" y="23" width="2" height="4" rx="1" fill="#FFB43C" transform={`rotate(${a} 32 34)`} />
            ))}
            <text x="32" y="50" textAnchor="middle" fontSize="7" fontWeight="800" fill="#7A4A10">
              SPF
            </text>
          </>
        )
      case 'lipBalm':
        return (
          <>
            <rect x="22" y="28" width="20" height="28" rx="4" fill={color} />
            <path d="M24 28V18q8-8 16 0v10Z" fill="#F2D6CF" />
            <rect x="22" y="40" width="20" height="5" fill="#fff" opacity="0.5" />
          </>
        )
      /* ---------------- makeup ---------------- */
      case 'primer':
      case 'foundation':
        return (
          <>
            <rect x="16" y="20" width="22" height="36" rx="5" fill={color} />
            <rect x="21" y="10" width="12" height="11" rx="2" fill={cap} />
            {kind === 'foundation' && <path d="M44 44c0-6 4-10 8-10s8 4 8 10-4 10-8 10-8-4-8-10Z" fill="#F3A6B8" />}
            {kind === 'primer' && <path d="M46 24l1.6 4 4 1.6-4 1.6L46 35l-1.6-4-4-1.6 4-1.6Z" fill="#F4ECE4" />}
            <rect x="16" y="20" width="22" height="36" rx="5" fill={S} />
          </>
        )
      case 'corrector':
        return (
          <>
            <rect x="8" y="18" width="48" height="30" rx="7" fill="#2B2B33" />
            <circle cx="22" cy="33" r="9" fill={color} />
            <circle cx="42" cy="33" r="9" fill={color2} />
          </>
        )
      case 'concealer':
        return (
          <>
            <rect x="26" y="20" width="12" height="38" rx="5" fill={color} />
            <rect x="27" y="6" width="10" height="16" rx="3" fill={cap} />
            <path d="M8 44q12 8 24 0" stroke={color} strokeWidth="5" fill="none" strokeLinecap="round" opacity="0.7" />
          </>
        )
      case 'powder':
      case 'bronzer':
      case 'blush':
      case 'highlight':
      case 'contour':
        return (
          <>
            <circle cx="28" cy="36" r="20" fill="#26232A" />
            <circle cx="28" cy="36" r="15" fill={color} />
            {kind === 'highlight' && <path d="M20 30q8-6 16 0" stroke="#fff" strokeOpacity="0.8" strokeWidth="3" fill="none" strokeLinecap="round" />}
            {kind === 'bronzer' && <circle cx="28" cy="36" r="6" fill="none" stroke="#fff" strokeOpacity="0.35" strokeWidth="2" />}
            {(kind === 'blush' || kind === 'contour' || kind === 'bronzer') && (
              <g transform="rotate(35 46 20)">
                <rect x="44" y="4" width="6" height="28" rx="3" fill="#2B2B33" />
                <path d="M41 30h12l-2 10q-4 4-8 0Z" fill="#E8D2C2" />
              </g>
            )}
            {kind === 'powder' && <circle cx="46" cy="18" r="9" fill="#F4E6DE" stroke="#E2CFC4" />}
            <circle cx="28" cy="36" r="15" fill={S} />
          </>
        )
      case 'setting':
        return (
          <>
            <rect x="20" y="22" width="20" height="34" rx="6" fill={color} opacity="0.9" />
            <rect x="24" y="12" width="12" height="11" rx="2" fill={cap} />
            {[[44, 12], [50, 16], [46, 20], [54, 10], [52, 22], [58, 17]].map(([x, y], i) => (
              <circle key={i} cx={x} cy={y} r="1.6" fill="#BFE6FF" />
            ))}
            <rect x="20" y="22" width="20" height="34" rx="6" fill={S} />
          </>
        )
      case 'eyeshadow':
      case 'innerCorner':
        return (
          <>
            <rect x="6" y="16" width="52" height="34" rx="6" fill="#26232A" />
            <rect x="11" y="21" width="20" height="24" rx="4" fill={color} />
            <rect x="34" y="21" width="20" height="24" rx="4" fill={color2} />
            <rect x="11" y="21" width="20" height="24" rx="4" fill={S} />
            {kind === 'innerCorner' && <path d="M21 26l1.4 3.6 3.6 1.4-3.6 1.4L21 36l-1.4-3.6-3.6-1.4 3.6-1.4Z" fill="#fff" />}
          </>
        )
      case 'liner':
      case 'lowerLiner':
      case 'browPencil':
      case 'lipLiner':
        return (
          <>
            <path d="M8 32s10-12 24-12 24 12 24 12" stroke="#2B1A14" strokeWidth="0" fill="none" />
            <g transform="rotate(-40 32 32)">
              <rect x="28" y="6" width="8" height="40" rx="2" fill={kind === 'liner' ? '#1A1416' : color} />
              <path d="M28 46h8l-4 10Z" fill={kind === 'lipLiner' ? color : '#E8D2C2'} />
              <path d="M30.5 52h3l-1.5 4Z" fill={kind === 'liner' ? '#000' : color} />
            </g>
            {kind === 'liner' && <path d="M8 50q14 6 30-2l8-6" stroke="#000" strokeWidth="2.6" fill="none" strokeLinecap="round" />}
            {kind === 'lowerLiner' && <path d="M8 46q16 8 32 0" stroke={color} strokeWidth="2.4" fill="none" strokeLinecap="round" />}
            {kind === 'browPencil' && <path d="M6 50q14-10 30-6" stroke={color} strokeWidth="4" fill="none" strokeLinecap="round" />}
            {kind === 'lipLiner' && <path d="M6 50q8-6 14 0t14 0" stroke={color} strokeWidth="2.4" fill="none" strokeLinecap="round" />}
          </>
        )
      case 'mascara':
        return (
          <>
            <g transform="rotate(-35 32 32)">
              <rect x="28" y="22" width="9" height="34" rx="3" fill="#1A1416" />
              <rect x="31" y="6" width="3" height="17" fill="#2B2B33" />
              {[8, 11, 14, 17].map((y) => (
                <path key={y} d={`M27 ${y}h11`} stroke="#000" strokeWidth="2" />
              ))}
            </g>
            <path d="M6 48q12-8 26-2" stroke="#000" strokeWidth="2" fill="none" />
            {[8, 13, 18, 23, 28].map((x) => (
              <path key={x} d={`M${x} ${47 - (x - 6) * 0.1}l-2 -7`} stroke="#000" strokeWidth="1.6" strokeLinecap="round" />
            ))}
          </>
        )
      case 'browShape':
        return <path d="M8 40q16-18 46-8" stroke={color} strokeWidth="7" fill="none" strokeLinecap="round" />
      case 'lashes':
        return (
          <>
            <path d="M8 40q24-14 48 0" stroke="#1A1416" strokeWidth="3" fill="none" />
            {Array.from({ length: 11 }, (_, i) => {
              const x = 10 + i * 4.4
              const y = 40 - Math.sin((i / 10) * Math.PI) * 7
              return <path key={i} d={`M${x} ${y}l${(i - 5) * 0.9} -${10 + Math.sin((i / 10) * Math.PI) * 6}`} stroke="#1A1416" strokeWidth="1.6" strokeLinecap="round" />
            })}
          </>
        )
      case 'lipstick':
        return (
          <>
            <rect x="22" y="34" width="20" height="24" rx="3" fill="#26232A" />
            <rect x="24" y="26" width="16" height="10" fill="#C9A06A" />
            <path d="M25 26V14l14-8v20Z" fill={color} />
            <path d="M27 24V15l4-2" stroke="#fff" strokeOpacity="0.45" strokeWidth="2" fill="none" />
          </>
        )
      case 'gloss':
        return (
          <>
            <rect x="24" y="22" width="16" height="36" rx="5" fill={color} opacity="0.75" />
            <rect x="26" y="8" width="12" height="15" rx="3" fill={cap} />
            <rect x="24" y="22" width="16" height="36" rx="5" fill={S} />
            <path d="M28 30v20" stroke="#fff" strokeOpacity="0.7" strokeWidth="2.4" strokeLinecap="round" />
          </>
        )
      case 'lipCentre':
        return (
          <>
            <path d="M6 32c6-8 14-12 19-12 3 0 5 2 7 2s4-2 7-2c5 0 13 4 19 12-6 9-15 14-26 14S12 41 6 32Z" fill={color2} />
            <ellipse cx="32" cy="33" rx="12" ry="7" fill={color} opacity="0.9" />
            <path d="M6 32h52" stroke="#000" strokeOpacity="0.25" strokeWidth="1.4" />
          </>
        )
      case 'look':
        return (
          <>
            <ellipse cx="32" cy="34" rx="18" ry="22" fill={skin} />
            <path d="M18 28q6-4 11 0M35 28q5-4 11 0" stroke={color2} strokeWidth="3.4" fill="none" strokeLinecap="round" />
            <circle cx="22" cy="40" r="5" fill={color} opacity="0.45" />
            <circle cx="42" cy="40" r="5" fill={color} opacity="0.45" />
            <path d="M25 47q7 5 14 0q-7 2-14 0Z" fill={color} />
          </>
        )
      case 'remove':
        return (
          <>
            <rect x="10" y="18" width="40" height="32" rx="5" fill="#F7F5F2" stroke="#E2DCD4" />
            <path d="M16 30q10 6 22-2" stroke="#C24E7A" strokeWidth="4" fill="none" strokeLinecap="round" opacity="0.5" />
            <path d="M18 40q8 3 16-1" stroke="#1A1416" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.4" />
            {[[52, 14], [56, 22], [48, 10]].map(([x, y], i) => (
              <path key={i} d={`M${x} ${y - 4}l1.2 3 3 1.2-3 1.2L${x} ${y + 2.4}l-1.2-3-3-1.2 3-1.2Z`} fill="#BFE6FF" />
            ))}
          </>
        )
      case 'polish':
        return (
          <>
            <rect x="18" y="28" width="28" height="28" rx="7" fill={color} />
            <rect x="26" y="10" width="12" height="19" rx="3" fill={cap} />
            <rect x="18" y="28" width="28" height="28" rx="7" fill={S} />
          </>
        )
      /* ---------------- jewellery ---------------- */
      case 'earrings':
        return (
          <>
            <circle cx="22" cy="36" r="12" fill="none" stroke={color} strokeWidth="4" />
            <circle cx="44" cy="36" r="12" fill="none" stroke={color} strokeWidth="4" />
            <circle cx="22" cy="22" r="2.4" fill={color} />
            <circle cx="44" cy="22" r="2.4" fill={color} />
          </>
        )
      case 'noseRing':
      case 'piercing':
        return (
          <>
            <path d="M24 14q-4 22 2 30q6 4 12 0q6-8 2-30" fill={skin} />
            <circle cx={kind === 'noseRing' ? 40 : 32} cy="42" r="6" fill="none" stroke={color} strokeWidth="3" />
          </>
        )
      case 'beads':
        return (
          <>
            {Array.from({ length: 11 }, (_, i) => {
              const a = Math.PI * (0.1 + (0.8 * i) / 10)
              return <circle key={i} cx={32 - Math.cos(a) * 22} cy={16 + Math.sin(a) * 26} r="4.2" fill={color} stroke="#000" strokeOpacity="0.15" />
            })}
            {Array.from({ length: 9 }, (_, i) => {
              const a = Math.PI * (0.15 + (0.7 * i) / 8)
              return <circle key={`b${i}`} cx={32 - Math.cos(a) * 15} cy={16 + Math.sin(a) * 17} r="3.4" fill={color} opacity="0.85" />
            })}
          </>
        )
      case 'band':
        return (
          <>
            <path d="M8 40q24-30 48 0" stroke={color} strokeWidth="9" fill="none" strokeLinecap="round" />
            <path d="M8 40q24-30 48 0" stroke="#fff" strokeOpacity="0.35" strokeWidth="2" fill="none" strokeLinecap="round" />
          </>
        )
      case 'whisk':
        return (
          <>
            <rect x="29" y="6" width="6" height="22" rx="3" fill="#3A2216" />
            <rect x="28" y="12" width="8" height="3" fill="#D9452B" />
            <rect x="28" y="18" width="8" height="3" fill="#C9A04A" />
            {Array.from({ length: 9 }, (_, i) => (
              <path key={i} d={`M32 28q${(i - 4) * 2} 14 ${(i - 4) * 4} 30`} stroke="#F4F1EA" strokeWidth="2" fill="none" strokeLinecap="round" />
            ))}
          </>
        )
      case 'fan':
        return (
          <>
            {Array.from({ length: 9 }, (_, i) => {
              const a = -0.95 + (i / 8) * 1.9
              return <path key={i} d={`M32 52L${32 + Math.sin(a) * 26} ${52 - Math.cos(a) * 26}`} stroke={i % 2 ? color : '#C9A04A'} strokeWidth="7" strokeLinecap="round" />
            })}
            <circle cx="32" cy="52" r="3" fill="#3A2216" />
          </>
        )
      case 'clutch':
        return (
          <>
            <rect x="10" y="22" width="44" height="26" rx="5" fill={color} />
            <path d="M10 30h44" stroke="#000" strokeOpacity="0.2" strokeWidth="2" />
            <circle cx="32" cy="30" r="3.4" fill="#D9B35B" />
          </>
        )
      case 'joint':
        return (
          <>
            <path d="M12 44L50 22" stroke="#EFE9DC" strokeWidth="6" strokeLinecap="round" />
            <path d="M12 44L18 40.5" stroke="#C8B48C" strokeWidth="6" strokeLinecap="round" />
            <circle cx="51" cy="21.5" r="3.6" fill="#FF5A1A" />
            <path d="M52 16q-4-5 0-9t0-8" stroke="#D8D8DC" strokeOpacity="0.8" strokeWidth="2.2" fill="none" strokeLinecap="round" />
          </>
        )
      case 'pins':
        return (
          <>
            {[
              [24, 26, 12],
              [42, 38, 9],
            ].map(([cx, cy, r], k) => (
              <g key={k}>
                {['#e40303', '#ff8c00', '#ffed00', '#008026', '#004dff', '#750787'].map((c, i) => (
                  <rect key={i} x={cx - r} y={cy - r + (i * 2 * r) / 6} width={2 * r} height={(2 * r) / 6 + 0.4} fill={c} clipPath={`circle(${r}px at ${r}px ${r - (i * 2 * r) / 6}px)`} />
                ))}
                <circle cx={cx} cy={cy} r={r} fill="none" stroke="#D9B35B" strokeWidth="2" />
              </g>
            ))}
          </>
        )
      case 'necklace':
        return (
          <>
            <path d="M10 14q22 40 44 0" stroke={color} strokeWidth="3.4" fill="none" strokeLinecap="round" />
            <path d="M32 40l6 8-6 8-6-8Z" fill={color} />
          </>
        )
      case 'bracelet':
      case 'rings':
        return (
          <>
            <ellipse cx="32" cy="34" rx="20" ry="9" fill="none" stroke={color} strokeWidth="5" />
            <ellipse cx="32" cy="34" rx="20" ry="9" fill="none" stroke="#fff" strokeOpacity="0.4" strokeWidth="1.4" />
            {kind === 'rings' && <circle cx="32" cy="25" r="4" fill="#BFE6FF" />}
          </>
        )
      case 'glasses':
        return (
          <>
            <circle cx="20" cy="34" r="11" fill="#BFE6FF" fillOpacity="0.3" stroke={color} strokeWidth="3.4" />
            <circle cx="44" cy="34" r="11" fill="#BFE6FF" fillOpacity="0.3" stroke={color} strokeWidth="3.4" />
            <path d="M31 33q1-3 2 0M9 30 4 26M55 30l5-4" stroke={color} strokeWidth="3" strokeLinecap="round" fill="none" />
          </>
        )
      /* ---------------- hair care ---------------- */
      case 'hairBrush':
        return (
          <>
            <rect x="8" y="14" width="30" height="20" rx="9" fill={color} />
            <rect x="34" y="20" width="24" height="8" rx="4" fill={cap} />
            {[12, 16, 20, 24, 28, 32].map((x) => (
              <path key={x} d={`M${x} 34v7`} stroke="#2B2B33" strokeWidth="2" strokeLinecap="round" />
            ))}
          </>
        )
      case 'hairWash':
        return (
          <>
            <path d="M10 18h22a8 8 0 0 1 8 8v2" stroke="#9AA" strokeWidth="5" fill="none" strokeLinecap="round" />
            <ellipse cx="40" cy="31" rx="9" ry="4" fill="#AAB" />
            {[[34, 40], [40, 44], [46, 40], [37, 50], [43, 54]].map(([x, y], i) => (
              <path key={i} d={`M${x} ${y - 3}q2.4 2.4 0 5q-2.4-2.6 0-5Z`} fill="#7FD3FF" />
            ))}
          </>
        )
      case 'hairDry':
        return (
          <>
            <rect x="10" y="18" width="30" height="18" rx="9" fill={color} />
            <rect x="18" y="34" width="9" height="20" rx="3" fill={cap} />
            <rect x="38" y="21" width="8" height="12" fill={cap} />
            {[22, 27, 32].map((y) => (
              <path key={y} d={`M50 ${y}q4 -2 8 0`} stroke="#F4ECE4" strokeWidth="2" fill="none" strokeLinecap="round" />
            ))}
          </>
        )
      case 'takedown':
      case 'retwist':
        return (
          <>
            {[14, 24, 34, 44].map((x, i) => (
              <path key={x} d={`M${x} 8c-4 8 4 12 0 20s4 12 0 20`} stroke={color} strokeWidth="5" fill="none" strokeLinecap="round" opacity={kind === 'takedown' && i > 1 ? 0.45 : 1} />
            ))}
            {kind === 'takedown' && <path d="M38 28c6 6 4 14 10 20M42 26c8 6 6 16 12 22" stroke={color} strokeWidth="2" fill="none" />}
            {kind === 'retwist' && <path d="M50 12a8 8 0 1 1-6 14" stroke="#F4ECE4" strokeWidth="2.4" fill="none" strokeLinecap="round" />}
          </>
        )
      case 'dye':
      case 'ombre':
        return (
          <>
            <path d="M20 8c-6 16-6 32 2 48M32 8c-4 16-4 32 2 48M44 8c-2 16 0 32 6 48" stroke={kind === 'ombre' ? `url(#${id}-g)` : color} strokeWidth="7" fill="none" strokeLinecap="round" />
            <defs>
              <linearGradient id={`${id}-g`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0.3" stopColor={color} />
                <stop offset="1" stopColor={color2} />
              </linearGradient>
            </defs>
          </>
        )
      /* ---------------- clinic ---------------- */
      case 'syringe':
        return (
          <g transform="rotate(-40 32 32)">
            <rect x="26" y="14" width="12" height="30" rx="2" fill="#E6F2F8" stroke="#9BB" />
            <rect x="27.5" y="28" width="9" height="14" fill={color} />
            <rect x="30" y="4" width="4" height="11" fill="#9BB" />
            <rect x="24" y="2" width="16" height="4" rx="2" fill="#9BB" />
            <path d="M32 44v14" stroke="#9BB" strokeWidth="1.6" />
          </g>
        )
      case 'nose':
        return (
          <>
            <path d="M30 8q-4 28-14 36q4 8 16 8t16-8q-10-8-14-36" fill={skin} />
            <path d="M24 46q3 3 6 0M34 46q3 3 6 0" stroke="#000" strokeOpacity="0.3" strokeWidth="2" fill="none" />
            <path d="M44 16l1.4 3.6 3.6 1.4-3.6 1.4L44 26l-1.4-3.6L39 21l3.6-1.4Z" fill="#fff" />
          </>
        )
      case 'chisel':
        return (
          <>
            <path d="M14 14q0 26 18 38q18-12 18-38" fill={skin} />
            <path d="M14 30q4 18 18 22q14-4 18-22" stroke="#fff" strokeOpacity="0.5" strokeWidth="2" fill="none" />
          </>
        )
      case 'hairline':
        return (
          <>
            <ellipse cx="32" cy="40" rx="20" ry="18" fill={skin} />
            <path d="M12 34q20-26 40 0q-6-12-20-12T12 34Z" fill="#1A1416" />
            {[18, 24, 30, 36, 42, 46].map((x) => (
              <path key={x} d={`M${x} ${30 - Math.abs(x - 32) * 0.2}l0 -4`} stroke="#1A1416" strokeWidth="1.6" />
            ))}
          </>
        )
      case 'body':
        return <path d="M26 8a6 6 0 1 1 12 0 6 6 0 0 1-12 0Zm-6 14h24l-2 18q6 6 4 22h-10l-2-16-2 16H22q-2-16 4-22Z" fill={skin} />
      case 'drip':
        return (
          <>
            <rect x="22" y="6" width="20" height="28" rx="6" fill="#E6F2F8" stroke="#9BB" />
            <rect x="24" y="18" width="16" height="14" rx="4" fill={color} />
            <path d="M32 34v8" stroke="#9BB" strokeWidth="2" />
            <path d="M32 44q-4 6 0 10q4-4 0-10Z" fill={color} />
            <path d="M32 54q10 6 18-6" stroke="#9BB" strokeWidth="1.6" fill="none" />
          </>
        )
      case 'none':
        return <circle cx="32" cy="32" r="18" fill="none" stroke="#B3A296" strokeWidth="3" strokeDasharray="4 5" />
    }
  }
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <defs>{shine(id)}</defs>
      {body()}
    </svg>
  )
}
