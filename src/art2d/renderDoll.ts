import type { Look2D } from '../shared/look2d'

/**
 * Draws a 2D DollScene character as an SVG string: big glossy eyes, warm
 * cel shading and long cartoon limbs, after the style references
 * (headphones girl, cargo-pants girl, travel girl).
 * One pure function so the same art works in the DOM and as a globe texture.
 */

export type DollCrop = 'full' | 'bust' | 'head'

const VIEW: Record<DollCrop, [number, number, number, number]> = {
  full: [0, -4, 200, 420],
  bust: [26, -2, 148, 150],
  head: [40, 2, 120, 120],
}

/* ------------------------------------------------------------------ colour */

function rgb(h: string): [number, number, number] {
  const n = parseInt(h.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
const hx = (n: number) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, '0')
export function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = rgb(a)
  const [r2, g2, b2] = rgb(b)
  return `#${hx(r1 + (r2 - r1) * t)}${hx(g1 + (g2 - g1) * t)}${hx(b1 + (b2 - b1) * t)}`
}
const darken = (c: string, t: number) => mix(c, '#000000', t)
const lighten = (c: string, t: number) => mix(c, '#FFFFFF', t)
function luma(c: string): number {
  const [r, g, b] = rgb(c)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255
}

/** Seeded random so a look always draws the same strands. */
function rng(seed: number) {
  let s = Math.abs(Math.floor(seed)) % 2147483647 || 7
  return () => (s = (s * 16807) % 2147483647) / 2147483647
}
function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

const f = (n: number) => Math.round(n * 10) / 10
const MIRROR = 'matrix(-1 0 0 1 200 0)'
const INK = '#1A1012'

/* -------------------------------------------------------------------- body */

interface Body {
  sh: number
  wa: number
  hi: number
  arm: number
  thigh: number
  shin: number
  seated: boolean
  hipY: number
  kneeY: number
  ankleY: number
  /** Shoulder, elbow and wrist x offsets from the centre line. */
  sx: number
  ex: number
  wx: number
  wy: number
}

function bodyOf(l: Look2D): Body {
  const men = l.group === 'men'
  const andro = l.group === 'androgynous'
  let sh = men ? 32 : andro ? 29 : 27
  let wa = { slim: 16, curvy: 16, athletic: 19, broad: 22, plus: 27 }[l.build]
  let hi = { slim: 22, curvy: 30, athletic: 23, broad: 24, plus: 33 }[l.build]
  if (l.build === 'athletic' || l.build === 'broad') sh += 3
  if (l.build === 'plus') sh += 5
  if (men) {
    wa += 3
    hi -= 2
  }
  const arm = (men ? 12 : 10.5) + (l.build === 'plus' ? 2.5 : l.build === 'broad' ? 1.5 : 0)
  const thigh = { slim: 17, curvy: 21, athletic: 18, broad: 19, plus: 25 }[l.build] + (men ? 1 : 0)
  const seated = l.wheelchair
  const sx = sh - 4
  const wx = seated ? hi + 14 : Math.max(sh + 7, hi + arm / 2 + 4)
  return {
    sh,
    wa,
    hi,
    arm,
    thigh,
    shin: thigh * 0.68,
    seated,
    hipY: 240,
    kneeY: seated ? 262 : 318,
    ankleY: seated ? 336 : 388,
    sx,
    ex: (sx + wx) / 2 + 4,
    wx,
    wy: seated ? 238 : 236,
  }
}

/** Half-width of the torso at height y. */
function halfAt(b: Body, y: number): number {
  const pts: [number, number][] = [
    [120, b.sh - 7],
    [129, b.sh],
    [148, b.sh - 2.5],
    [172, b.wa + (b.sh - b.wa) * 0.35],
    [196, b.wa],
    [218, b.hi - 3],
    [236, b.hi],
    [256, b.hi - 1],
  ]
  if (y <= pts[0][0]) return pts[0][1]
  for (let i = 1; i < pts.length; i++) {
    const [y1, w1] = pts[i]
    const [y0, w0] = pts[i - 1]
    if (y <= y1) return w0 + ((w1 - w0) * (y - y0)) / (y1 - y0)
  }
  return pts[pts.length - 1][1]
}

/** A garment or skin panel that follows the torso between y0 and y1. */
function panel(b: Body, y0: number, y1: number, pad: number, dip = 0, flare = 0): string {
  const L: string[] = []
  const R: string[] = []
  const ys: number[] = []
  for (let y = y0; y < y1; y += 4) ys.push(y)
  ys.push(y1)
  for (const y of ys) {
    const w = halfAt(b, y) + pad + (flare * (y - y0)) / Math.max(1, y1 - y0)
    L.push(`${f(100 - w)} ${f(y)}`)
    R.unshift(`${f(100 + w)} ${f(y)}`)
  }
  return `M${L.join(' L')} L${R.join(' L')} Q100 ${f(y0 + dip * 2)} ${L[0]} Z`
}

const stroke = (d: string, color: string, width: number, extra = '') =>
  `<path d="${d}" fill="none" stroke="${color}" stroke-width="${f(width)}" stroke-linecap="round" stroke-linejoin="round"${extra}/>`

/** Arm polyline for one side (1 = right of the picture). */
function armPath(b: Body, side: 1 | -1, frac = 1): string {
  const s: [number, number] = [100 + side * b.sx, 131]
  const e: [number, number] = [100 + side * b.ex, 186]
  const w: [number, number] = [100 + side * b.wx, b.wy]
  const l1 = Math.hypot(e[0] - s[0], e[1] - s[1])
  const l2 = Math.hypot(w[0] - e[0], w[1] - e[1])
  const t = frac * (l1 + l2)
  if (t <= l1) {
    const k = t / l1
    return `M${f(s[0])} ${f(s[1])} L${f(s[0] + (e[0] - s[0]) * k)} ${f(s[1] + (e[1] - s[1]) * k)}`
  }
  const k = (t - l1) / l2
  return `M${f(s[0])} ${f(s[1])} L${f(e[0])} ${f(e[1])} L${f(e[0] + (w[0] - e[0]) * k)} ${f(e[1] + (w[1] - e[1]) * k)}`
}

interface Leg {
  hip: [number, number]
  knee: [number, number]
  ankle: [number, number]
}
function legOf(b: Body, side: 1 | -1): Leg {
  if (b.seated) return { hip: [100 + side * b.hi * 0.45, b.hipY], knee: [100 + side * (b.hi * 0.5 + 2), b.kneeY], ankle: [100 + side * 14, b.ankleY] }
  return { hip: [100 + side * b.hi * 0.45, b.hipY], knee: [100 + side * (b.hi * 0.36 + 1), b.kneeY], ankle: [100 + side * 11, b.ankleY] }
}
const seg = (a: [number, number], c: [number, number]) => `M${f(a[0])} ${f(a[1])} L${f(c[0])} ${f(c[1])}`

/* -------------------------------------------------------------------- hair */

function strandSet(
  r: () => number,
  o: { n: number; x0: number; x1: number; y: number; len: [number, number]; width: number | [number, number]; spread: number; wave: number; color: string; texture?: string; dash?: string },
): string {
  let out = ''
  for (let i = 0; i < o.n; i++) {
    const x = o.x0 + ((o.x1 - o.x0) * i) / Math.max(1, o.n - 1)
    const dir = (x - 100) / 40
    const len = o.len[0] + r() * (o.len[1] - o.len[0])
    const ex = x + dir * o.spread + (r() - 0.5) * 6
    const mx = (x + ex) / 2 + (r() - 0.5) * o.wave
    const w = Array.isArray(o.width) ? o.width[0] + r() * (o.width[1] - o.width[0]) : o.width
    const d = `M${f(x)} ${f(o.y)} Q${f(mx)} ${f(o.y + len / 2)} ${f(ex)} ${f(o.y + len)}`
    out += stroke(d, o.color, w)
    if (o.texture) out += stroke(d, o.texture, w * 0.45, ` stroke-dasharray="${o.dash ?? '2 3'}" opacity="0.55"`)
  }
  return out
}

/** Bumpy circle used for afros, puffs and curls. */
function bumpy(cx: number, cy: number, R: number, n: number, bump: number): string {
  let d = ''
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2
    const x = cx + Math.cos(a) * R
    const y = cy + Math.sin(a) * R
    if (i === 0) d += `M${f(x)} ${f(y)}`
    else {
      const am = ((i - 0.5) / n) * Math.PI * 2
      d += ` Q${f(cx + Math.cos(am) * (R + bump))} ${f(cy + Math.sin(am) * (R + bump))} ${f(x)} ${f(y)}`
    }
  }
  return d + 'Z'
}

const CAP = 'M68 66C66 36 82 22 100 22C118 22 134 36 132 66C128 56 122 50 116 48C106 44 94 44 84 48C78 50 72 56 68 66Z'
const TIGHT_CAP = 'M69.5 62C68 36 82 25 100 25C118 25 132 36 130.5 62C127 53 121 48.5 114 46.8C105 45 95 45 86 46.8C79 48.5 73 53 69.5 62Z'

function hairBack(l: Look2D, hair: string, r: () => number): string {
  const hd = darken(l.hairColor, 0.35)
  const tex = darken(l.hairColor, 0.5)
  switch (l.hair) {
    case 'microlocs':
      return (
        `<path d="M66 60C66 30 84 20 100 20C116 20 134 30 134 60L138 126L62 126Z" fill="${hd}"/>` +
        strandSet(r, { n: 28, x0: 62, x1: 138, y: 38, len: [140, 168], width: 3.2, spread: 18, wave: 8, color: hair })
      )
    case 'trad-locs':
      return (
        `<path d="M66 60C66 30 84 20 100 20C116 20 134 30 134 60L138 120L62 120Z" fill="${hd}"/>` +
        strandSet(r, { n: 13, x0: 62, x1: 138, y: 40, len: [118, 142], width: 7.5, spread: 16, wave: 6, color: hair, texture: tex, dash: '1.5 4' })
      )
    case 'freeform-locs':
      return (
        `<path d="M60 62C54 26 80 8 100 10C122 8 148 26 140 62L142 110L58 110Z" fill="${hd}"/>` +
        strandSet(r, { n: 12, x0: 58, x1: 142, y: 36, len: [90, 170], width: [8, 12.5], spread: 22, wave: 18, color: hair, texture: tex, dash: '3 5' })
      )
    case 'knotless':
      return (
        `<path d="M66 60C66 30 84 20 100 20C116 20 134 30 134 60L138 120L62 120Z" fill="${hd}"/>` +
        strandSet(r, { n: 30, x0: 62, x1: 138, y: 40, len: [200, 216], width: 4, spread: 26, wave: 6, color: hair, texture: tex, dash: '1.4 1.6' })
      )
    case 'box-braids':
      return (
        `<path d="M66 60C66 30 84 20 100 20C116 20 134 30 134 60L138 120L62 120Z" fill="${hd}"/>` +
        strandSet(r, { n: 24, x0: 62, x1: 138, y: 40, len: [168, 186], width: 5.2, spread: 22, wave: 5, color: hair, texture: tex, dash: '1.8 1.8' })
      )
    case 'tyla-braids': {
      let wisps = ''
      for (let i = 0; i < 14; i++) {
        const x = 58 + r() * 84
        const y = 120 + r() * 120
        wisps += stroke(`M${f(x)} ${f(y)}c3.4-2 3.4 4 0 4.4c-3.4.4-3.4 6 0 6.4c3.4.4 3.4 5 .4 6`, l.hairColor2, 1.3)
      }
      return (
        `<path d="M66 60C66 30 84 20 100 20C116 20 134 30 134 60L138 120L62 120Z" fill="${hd}"/>` +
        strandSet(r, { n: 28, x0: 62, x1: 138, y: 40, len: [184, 204], width: 3.4, spread: 26, wave: 6, color: hair, texture: tex, dash: '1.2 1.4' }) +
        wisps
      )
    }
    case 'fulani':
      return (
        `<path d="M66 60C66 30 84 20 100 20C116 20 134 30 134 60L138 116L62 116Z" fill="${hd}"/>` +
        strandSet(r, { n: 18, x0: 64, x1: 136, y: 42, len: [150, 168], width: 3.8, spread: 20, wave: 5, color: hair, texture: tex, dash: '1.4 1.6' })
      )
    case 'cornrows':
      return strandSet(r, { n: 6, x0: 84, x1: 116, y: 60, len: [58, 66], width: 4, spread: 4, wave: 3, color: hair, texture: tex, dash: '1.4 1.6' })
    case 'bussdown':
      return `<path d="M66 64C64 32 82 18 100 18C118 18 136 32 134 64L142 254C120 262 80 262 58 254Z" fill="${hair}"/>`
    case 'leave-out':
      return `<path d="M64 60C50 90 66 112 54 142C46 172 62 188 56 210C86 218 114 218 144 210C138 188 154 172 146 142C134 112 150 90 136 60C134 30 118 16 100 16C82 16 66 30 64 60Z" fill="${hair}"/>`
    case 'afro':
      return `<path d="${bumpy(100, 56, 47, 26, 4.5)}" fill="${hair}"/>` + afroSwirls(r, tex, 100, 56, 47)
    case 'curly-fro': {
      let curls = ''
      const spots: [number, number][] = []
      for (let i = 0; i < 18; i++) {
        const a = Math.PI * 1.08 + (i / 17) * Math.PI * 0.84
        spots.push([100 + Math.cos(a) * 40, 52 + Math.sin(a) * 34])
      }
      for (let y = 60; y <= 140; y += 12) {
        spots.push([64 - (y - 60) * 0.06 + r() * 3, y])
        spots.push([136 + (y - 60) * 0.06 - r() * 3, y])
        spots.push([72 - r() * 2, y + 5])
        spots.push([128 + r() * 2, y + 5])
      }
      curls += `<path d="M64 60C62 28 82 14 100 14C118 14 138 28 136 60L142 140L58 140Z" fill="${hd}"/>`
      for (const [x, y] of spots) curls += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(9 + r() * 3)}" fill="${hair}"/>`
      for (const [x, y] of spots) curls += stroke(`M${f(x - 4)} ${f(y)}a4 4 0 1 1 4 4`, tex, 1.1, ' opacity="0.6"')
      return curls
    }
    case 'puffs':
      return `<path d="${bumpy(64, 30, 21, 16, 3.5)}" fill="${hair}"/><path d="${bumpy(136, 30, 21, 16, 3.5)}" fill="${hair}"/>` + afroSwirls(r, tex, 64, 30, 18) + afroSwirls(r, tex, 136, 30, 18)
    case 'twists':
      return (
        `<path d="M66 60C66 30 84 20 100 20C116 20 134 30 134 60L138 100L62 100Z" fill="${hd}"/>` +
        strandSet(r, { n: 16, x0: 62, x1: 138, y: 36, len: [74, 92], width: 6.2, spread: 12, wave: 6, color: hair, texture: tex, dash: '2.4 2' })
      )
    case 'high-pony':
      return `<path d="M100 22C140 8 152 60 144 110C140 140 130 164 120 178C126 142 132 100 124 62C120 42 110 32 100 30Z" fill="${hair}"/>`
    case 'bob':
      return `<path d="M65 62C63 30 82 19 100 19C118 19 137 30 135 62L139 114L61 114Z" fill="${hair}"/>`
    case 'wolf-cut':
      return `<path d="M63 64C59 30 82 17 100 17C118 17 141 30 137 64L141 100L135 96L139 122L129 112L127 130L118 117L82 117L73 130L71 112L61 122L65 96L59 100Z" fill="${hair}"/>`
    case 'hijab':
      return `<path d="M100 13C69 13 57 38 59 70C57 100 52 122 36 142C70 160 130 160 164 142C148 122 143 100 141 70C143 38 131 13 100 13Z" fill="${hair}"/><path d="M60 128C80 140 120 140 140 128" fill="none" stroke="${darken(l.hairColor, 0.15)}" stroke-width="1.4"/>`
    default:
      return ''
  }
}

function afroSwirls(r: () => number, color: string, cx: number, cy: number, R: number): string {
  let out = ''
  for (let i = 0; i < Math.round(R / 3); i++) {
    const a = r() * Math.PI * 2
    const d = R * (0.45 + r() * 0.45)
    const x = cx + Math.cos(a) * d
    const y = cy + Math.sin(a) * d
    // keep swirls off the face
    if (Math.abs(x - 100) < 28 && y > 40) continue
    out += stroke(`M${f(x - 3)} ${f(y + 1)}a3.4 3.4 0 1 1 3.4 3.4`, color, 1.2, ' opacity="0.5"')
  }
  return out
}

function hairFront(l: Look2D, hair: string, r: () => number): string {
  const tex = darken(l.hairColor, 0.5)
  const shine = luma(l.hairColor) > 0.55 ? darken(l.hairColor, 0.25) : lighten(l.hairColor, 0.35)
  const sideStrands = (width: number, len: number, dash?: string) =>
    strandSet(r, { n: 3, x0: 66, x1: 74, y: 50, len: [len, len + 14], width, spread: 8, wave: 4, color: hair, texture: dash ? tex : undefined, dash }) +
    strandSet(r, { n: 3, x0: 126, x1: 134, y: 50, len: [len, len + 14], width, spread: 8, wave: 4, color: hair, texture: dash ? tex : undefined, dash })
  switch (l.hair) {
    case 'pixie':
      return (
        `<path d="M67 72C61 40 80 16 104 18C127 20 139 40 133 68C131 57 126 50 120 48C112 53 100 59 86 59C78 59 72 63 67 72Z" fill="${hair}"/>` +
        `<path d="M68 70L66 58L72 62Z" fill="${hair}"/>` +
        stroke('M84 40Q102 30 122 36', shine, 2.2, ' opacity="0.6"') +
        stroke('M80 50Q96 46 112 40', shine, 1.4, ' opacity="0.45"')
      )
    case 'microlocs':
      return `<path d="${CAP}" fill="${hair}"/>` + stroke('M100 23L100 44', tex, 1, ' opacity="0.6"') + sideStrands(3.2, 120)
    case 'trad-locs':
      return `<path d="${CAP}" fill="${hair}"/>` + stroke('M100 23L100 44', tex, 1, ' opacity="0.6"') + sideStrands(7, 92, '1.5 4')
    case 'freeform-locs':
      return `<path d="M64 66C58 30 80 12 100 14C122 12 144 30 136 66C130 54 122 48 114 46C104 42 94 42 86 46C76 48 70 56 64 66Z" fill="${hair}"/>` + sideStrands(10, 70, '3 5')
    case 'knotless':
    case 'box-braids':
    case 'tyla-braids': {
      const grid =
        l.hair === 'box-braids'
          ? stroke('M84 28L86 46M100 22L100 44M116 28L114 46M74 40L126 40M70 52L80 50M120 50L130 52', tex, 0.8, ' opacity="0.55"')
          : stroke('M100 23L100 44', tex, 1, ' opacity="0.6"')
      return `<path d="${CAP}" fill="${hair}"/>` + grid + sideStrands(l.hair === 'box-braids' ? 5 : 3.6, 150, '1.4 1.6')
    }
    case 'fulani': {
      const beads = [66, 134].map((x) => `<circle cx="${x}" cy="152" r="3.2" fill="#E9C46A" stroke="#8A6A1E" stroke-width=".6"/><circle cx="${x}" cy="159" r="2.6" fill="#B3123F"/>`).join('')
      return (
        `<path d="${CAP}" fill="${hair}"/>` +
        stroke('M100 22L100 46', tex, 2.6, ' stroke-dasharray="1.6 1.6"') +
        stroke('M88 26Q80 36 76 50M112 26Q120 36 124 50', tex, 1.8, ' stroke-dasharray="1.4 1.4"') +
        stroke('M72 50Q66 100 66 148', hair, 4.2) +
        stroke('M128 50Q134 100 134 148', hair, 4.2) +
        stroke('M72 50Q66 100 66 148M128 50Q134 100 134 148', tex, 1.8, ' stroke-dasharray="1.4 1.6" opacity=".55"') +
        beads
      )
    }
    case 'cornrows':
      return (
        `<path d="${TIGHT_CAP}" fill="${hair}"/>` +
        stroke('M78 52Q80 36 86 26M89 47Q90 34 94 24M100 46L100 23M111 47Q110 34 106 24M122 52Q120 36 114 26', tex, 2, ' stroke-dasharray="1.6 1.4"')
      )
    case 'bussdown':
      return (
        `<path d="M100 22C84 24 69 40 67 70L62 160C68 160 72 158 75 156L77 84C79 58 88 38 100 28Z" fill="${hair}"/>` +
        `<path d="M100 22C116 24 131 40 133 70L138 160C132 160 128 158 125 156L123 84C121 58 112 38 100 28Z" fill="${hair}"/>` +
        stroke('M88 30Q76 50 74 90', shine, 2, ' opacity="0.5"') +
        stroke('M114 32Q124 50 126 86', shine, 1.4, ' opacity="0.4"')
      )
    case 'leave-out':
      return (
        `<path d="M104 22C80 20 62 40 66 74C66 92 60 106 64 122C72 112 72 98 74 82C76 62 88 48 114 42C122 42 130 46 134 58C132 36 118 22 104 22Z" fill="${hair}"/>` +
        `<path d="M132 56C138 80 132 100 136 120C130 112 127 96 127 80C126 66 124 58 120 52Z" fill="${hair}"/>` +
        stroke('M78 40Q70 60 70 90', shine, 1.6, ' opacity="0.45"')
      )
    case 'afro':
      return `<path d="M66 70C62 34 82 22 100 22C118 22 138 34 134 70C130 58 124 52 117 49C110 54 104 50 100 52C96 50 90 54 83 49C76 52 70 58 66 70Z" fill="${hair}"/>`
    case 'curly-fro': {
      let bangs = `<path d="${CAP}" fill="${hair}"/>`
      for (let x = 74; x <= 126; x += 8) bangs += `<circle cx="${x}" cy="${f(48 + Math.abs(x - 100) * 0.12 + r() * 2)}" r="${f(6.4 + r() * 1.6)}" fill="${hair}"/>`
      for (let x = 74; x <= 126; x += 8) bangs += stroke(`M${x - 3} ${f(50 + r() * 2)}a3 3 0 1 1 3 3`, tex, 1, ' opacity="0.55"')
      bangs += stroke('M70 58q-4 10 0 18q4 8 -1 16', hair, 4.6) + stroke('M130 58q4 10 0 18q-4 8 1 16', hair, 4.6)
      return bangs
    }
    case 'puffs':
      return `<path d="${CAP}" fill="${hair}"/>` + stroke('M100 23L100 44', tex, 1, ' opacity="0.6"')
    case 'bantu': {
      let knots = `<path d="${TIGHT_CAP}" fill="${hair}"/>`
      for (const [x, y] of [
        [72, 46],
        [86, 28],
        [114, 28],
        [128, 46],
        [100, 36],
      ] as const) {
        knots += `<circle cx="${x}" cy="${y}" r="9.4" fill="${hair}"/>` + stroke(`M${x - 5} ${y + 1}a5 5 0 1 1 5 5M${x - 2} ${y}a2.4 2.4 0 1 1 2.4 2.4`, tex, 1.2, ' opacity="0.65"')
      }
      return knots + stroke('M86 38L80 52M114 38L120 52M100 46V26', tex, 0.8, ' opacity=".5"')
    }
    case 'twists':
      return `<path d="${CAP}" fill="${hair}"/>` + strandSet(r, { n: 5, x0: 74, x1: 126, y: 30, len: [18, 24], width: 6, spread: 2, wave: 3, color: hair, texture: tex, dash: '2.4 2' }) + sideStrands(6, 60, '2.4 2')
    case 'fade':
      return (
        `<path d="M69 60C67 26 84 14 100 14C116 14 133 26 131 60C127 52 121 47 114 45.5C104 43.5 96 43.5 86 45.5C79 47 73 52 69 60Z" fill="${hair}"/>` +
        `<path d="M68.5 62L68.5 76L72 74L72 56Z M131.5 62L131.5 76L128 74L128 56Z" fill="${hair}" opacity=".35"/>` +
        dots(r, 76, 124, 20, 42, 22, tex)
      )
    case 'waves': {
      let w = `<path d="${TIGHT_CAP}" fill="${hair}"/>`
      for (let i = 0; i < 4; i++) w += stroke(`M${78 + i * 2} ${44 - i * 5}Q100 ${32 - i * 5} ${122 - i * 2} ${44 - i * 5}`, '#FFFFFF', 1, ' opacity="0.22"')
      return w
    }
    case 'buzz':
      return `<path d="${TIGHT_CAP}" fill="${hair}"/>` + dots(r, 74, 126, 28, 44, 40, luma(l.hairColor) > 0.5 ? darken(l.hairColor, 0.3) : lighten(l.hairColor, 0.3))
    case 'bun':
      return (
        `<path d="${TIGHT_CAP}" fill="${hair}"/>` +
        `<circle cx="100" cy="16" r="13.5" fill="${hair}"/>` +
        stroke('M90 16Q100 8 110 16M92 22Q100 14 108 22', tex, 1, ' opacity=".5"') +
        stroke('M84 32Q100 26 116 32', shine, 1.4, ' opacity=".45"')
      )
    case 'high-pony':
      return `<path d="${TIGHT_CAP}" fill="${hair}"/><ellipse cx="100" cy="22" rx="7" ry="5" fill="${hair}"/>` + stroke('M84 34Q100 26 116 34', shine, 1.6, ' opacity=".45"')
    case 'bob':
      return `<path d="M67 76C65 34 82 21 100 21C118 21 135 34 133 76L129 55Q100 58 71 55Z" fill="${hair}"/>` + stroke('M80 32Q100 24 120 32', shine, 1.6, ' opacity=".45"')
    case 'wolf-cut':
      return `<path d="M66 74C62 34 82 19 100 19C118 19 138 34 134 74L129 60L125 68L121 52Q111 46 103 53L100 60L97 53Q89 46 79 52L75 68L71 60Z" fill="${hair}"/>`
    case 'mohawk':
      return (
        `<path d="${TIGHT_CAP}" fill="${hair}" opacity=".28"/>` +
        `<path d="M89 47L84 30L91 33L90 12L97 23L100 4L104 21L111 10L110 32L117 26L112 47Q100 43 89 47Z" fill="${hair}"/>`
      )
    case 'hijab':
      return `<path d="M68.5 72C65 40 82 27 100 27C118 27 135 40 131.5 72C128 52 116 44 100 44C84 44 72 52 68.5 72Z" fill="${hair}"/>`
    default:
      return ''
  }
}

function dots(r: () => number, x0: number, x1: number, y0: number, y1: number, n: number, color: string): string {
  let out = ''
  for (let i = 0; i < n; i++) out += `<circle cx="${f(x0 + r() * (x1 - x0))}" cy="${f(y0 + r() * (y1 - y0))}" r=".7" fill="${color}" opacity=".6"/>`
  return out
}

/* -------------------------------------------------------------------- face */

const EYE_ROUND = '<ellipse cx="113" cy="73" rx="8" ry="9.2"/>'
const EYE_ALMOND = '<path d="M104.5 73.5Q109 65.5 116 66.2Q120.5 66.8 122.4 70.4Q119 78.5 112 79Q106.8 79 104.5 73.5Z"/>'

function eyeShadow(l: Look2D, p: string): string {
  const blob = 'M103.4 72C104 60 112 56.6 118 57.8C123 58.8 126 63.4 126.4 69C122 63 104.6 62 103.4 72Z'
  const wing = (len = 1) => `<path d="M120.8 68.6L${f(120.8 + 5.6 * len)} ${f(68.6 - 4.2 * len)}L122 70.6Z" fill="${INK}"/>`
  switch (l.makeup) {
    case 'soft-glam':
      return `<path d="${blob}" fill="#B76E5A" opacity=".5"/>` + wing()
    case 'lagos-baddie':
      return `<path d="${blob}" fill="#8A4A2E" opacity=".62"/>` + wing(1.5) + stroke('M106 80Q112 83 119.6 79', '#3B1F14', 1, ' opacity=".7"')
    case 'owambe':
      return `<path d="${blob}" fill="#E9C46A" opacity=".85"/>` + wing(1.2) + `<circle cx="110" cy="60.6" r=".7" fill="#FFF6D0"/><circle cx="116.6" cy="60" r=".6" fill="#FFF6D0"/><circle cx="121" cy="62.6" r=".6" fill="#FFF6D0"/>`
    case 'goth':
      return `<path d="${blob}" fill="#2B1530" opacity=".85"/>` + `<path d="M104.6 78.6Q112 86 122 78Q113 82.6 104.6 78.6Z" fill="#2B1530" opacity=".7"/>` + wing(1.3)
    case 'rainbow':
      return `<path d="${blob}" fill="url(#${p}rb)" opacity=".9"/>` + wing()
    case 'alt':
      return `<path d="${blob}" fill="#5B2A86" opacity=".5"/>` + stroke('M104.2 60.6Q113 53.6 126 61', '#120A0A', 1.2) + wing(1.2) + `<circle cx="110" cy="85" r=".9" fill="#120A0A"/><circle cx="114.4" cy="85.8" r=".7" fill="#120A0A"/>`
    case 'e-girl':
      return `<path d="${blob}" fill="#FF7AB6" opacity=".42"/>` + wing()
    case 'y2k':
      return `<path d="${blob}" fill="#9EDCF5" opacity=".78"/>` + `<circle cx="123.4" cy="76" r="1" fill="#FFFFFF"/><circle cx="125.4" cy="78.6" r=".7" fill="#7CF0FF"/><circle cx="104.6" cy="72" r=".9" fill="#FFFFFF" opacity=".9"/>`
    case 'editorial':
      return `<path d="M103.6 71L105.6 57.6L127.4 59.4L124.6 70Q114 61.4 103.6 71Z" fill="#FF5C2B" opacity=".88"/>` + wing(1.1)
    default:
      return ''
  }
}

function eyeRight(l: Look2D, p: string): string {
  const iris = l.eyeColor
  const highlights = (x: number, y: number) => `<circle cx="${f(x + 2.6)}" cy="${f(y - 2.8)}" r="2.2" fill="#FFFFFF"/><circle cx="${f(x - 2)}" cy="${f(y + 2.6)}" r=".9" fill="#FFFFFF" opacity=".9"/>`
  const lashes = (l.makeup === 'lagos-baddie' || l.makeup === 'soft-glam' || l.makeup === 'owambe' || l.makeup === 'e-girl') && l.group !== 'men'
  const lashFlick = stroke(lashes ? 'M120.4 67.4L125 64.4M121.4 69.4L125.8 67.8M118.6 66L122.4 62.6' : 'M120.6 67.6L123.6 65.6', INK, lashes ? 1.4 : 1.2)
  if (l.eyes === 'shades') return ''
  if (l.eyes === 'almond') {
    return (
      `<clipPath id="${p}ea">${EYE_ALMOND}</clipPath>` +
      `<g fill="#FFFFFF">${EYE_ALMOND}</g>` +
      `<g clip-path="url(#${p}ea)"><circle cx="112.6" cy="72.6" r="5.6" fill="${iris}"/><path d="M104 66H122V71.4Q113 67 104 71.4Z" fill="#000" opacity=".22"/><circle cx="112.6" cy="72.8" r="2.7" fill="#120A0A"/>${highlights(112.6, 72.6)}</g>` +
      stroke('M104.5 73.5Q109 65.5 116 66.2Q120.5 66.8 122.4 70.4L124.8 68.4', INK, 2.2) +
      stroke('M106.4 77.6Q112 80.6 120 76', INK, 0.8, ' opacity=".45"') +
      (lashes ? lashFlick : '')
    )
  }
  const stoner = l.eyes === 'stoner'
  const contacts = l.eyes === 'contacts'
  const irisFill = contacts ? `url(#${p}ct)` : iris
  const iy = stoner ? 76.2 : 74.4
  return (
    `<clipPath id="${p}er">${EYE_ROUND}</clipPath>` +
    `<ellipse cx="113" cy="73" rx="8" ry="9.2" fill="${stoner ? '#FFE0E0' : '#FFFFFF'}"/>` +
    `<g clip-path="url(#${p}er)">` +
    (stoner ? stroke('M105.4 77.4L108.4 76.4M120.6 76.2L117.6 75', '#E05A5A', 0.8) : '') +
    `<circle cx="112.2" cy="${iy}" r="6.4" fill="${irisFill}"/>` +
    (contacts ? `<circle cx="112.2" cy="${iy}" r="6.4" fill="none" stroke="${darken(iris, 0.5)}" stroke-width="1.2"/>` : '') +
    `<path d="M104 63H122V70Q113 64.6 104 70Z" fill="#000" opacity=".2"/>` +
    `<circle cx="112.2" cy="${f(iy + 0.3)}" r="${contacts ? 2.6 : 3.1}" fill="#120A0A"/>` +
    highlights(112.2, iy) +
    (stoner ? `<path d="M103 74Q112 66.6 123 72V60H103Z" fill="${darken(l.skin, 0.06)}"/>` : '') +
    `</g>` +
    (stoner
      ? stroke('M104.6 73.6Q112 67.2 121.8 71.6', INK, 2.2) + stroke('M106 80.6Q112 84 119 80', '#C05050', 1.8, ' opacity=".35"')
      : stroke('M104.6 70.8Q108 63.2 115 63.8Q119.5 64.4 121.6 69.5', INK, 2.4) + lashFlick) +
    stroke('M106 79.6Q112 83 119.4 78.8', INK, 0.9, ' opacity=".4"')
  )
}

function browRight(l: Look2D, browColor: string): string {
  const fill = (d: string) => `<path d="${d}" fill="${browColor}"${l.brows === 'bleached' ? ' stroke="#C9B27A" stroke-width=".5"' : ''}/>`
  const natural = 'M104 61.5Q112 55.5 123 58.5Q123.6 59.8 122.4 60Q112 58.2 104.4 63.4Z'
  switch (l.brows) {
    case 'bold':
      return fill('M103.8 62Q112 53.6 123.4 58Q124 60.4 122.4 60.8Q112 57.6 104.2 64.6Z')
    case 'arched':
      return fill('M104 62Q114 51.6 123.6 59.4Q123.8 60.8 122.6 60.8Q114 55.4 104.4 63.8Z')
    case 'thin':
      return stroke('M104.5 62Q114 54.4 123 59', browColor, 1.1)
    case 'slit':
      return fill(natural) + stroke('M114 55L116.4 61.4', l.skin, 1.8)
    default:
      return fill(natural)
  }
}

function mouth(l: Look2D, lip: string): string {
  const line = darken(lip, 0.45)
  const gloss = ['soft-glam', 'y2k', 'lagos-baddie', 'e-girl', 'natural-glow', 'owambe'].includes(l.makeup)
  const shine = gloss ? '<ellipse cx="101.6" cy="101.6" rx="2.4" ry=".9" fill="#FFFFFF" opacity=".55"/>' : ''
  const liner = l.makeup === 'lagos-baddie' ? ' stroke="' + darken(lip, 0.4) + '" stroke-width=".9"' : ''
  switch (l.mouth) {
    case 'smirk':
      return (
        `<path d="M92.5 98.4Q96 95.6 100 96.8Q104.6 95 109 95.4Q101 99.6 92.5 98.4Z" fill="${darken(lip, 0.12)}"${liner}/>` +
        `<path d="M93 98.6Q101 99.8 108.6 95.8Q106 102.4 100 103Q95 103 93 98.6Z" fill="${lip}"${liner}/>` +
        stroke('M92.5 98.4Q101 100 109 95.4', line, 1) +
        stroke('M110.2 94Q111.4 95.6 110.6 97.2', darken(l.skin, 0.3), 0.9) +
        shine
      )
    case 'smile':
      return (
        `<path d="M91.5 97Q96 95.4 100 96.4Q104 95.4 108.5 97Q100 100.6 91.5 97Z" fill="${darken(lip, 0.12)}"${liner}/>` +
        `<path d="M92 97.4Q100 101 108 97.4Q105.5 103.6 100 104Q94.5 103.6 92 97.4Z" fill="${lip}"${liner}/>` +
        stroke('M91.5 96.6Q100 101.4 108.5 96.6', line, 1) +
        shine
      )
    case 'grin':
      return (
        `<path d="M91 96.5Q100 99 109 96.5Q107 106.4 100 107Q93 106.4 91 96.5Z" fill="#5A1A22"/>` +
        `<path d="M92.4 97.4Q100 99.6 107.6 97.4L107 100Q100 101.6 93 100Z" fill="#FFFFFF"/>` +
        `<path d="M95 104.6Q100 102.4 105 104.6Q100 106.6 95 104.6Z" fill="#E8607A"/>` +
        stroke('M91 96.5Q96 94.4 100 95.6Q104 94.4 109 96.5', lip, 2) +
        stroke('M92.4 101Q100 109 107.6 101', lip, 2.4)
      )
    case 'tongue':
      return (
        `<path d="M92 97Q100 99.6 108 97Q106 104 100 104.4Q94 104 92 97Z" fill="#5A1A22"/>` +
        `<path d="M92.8 97.6Q100 99.8 107.2 97.6L106.8 99.4Q100 100.8 93.2 99.4Z" fill="#FFFFFF"/>` +
        `<path d="M97.4 101.4Q99 110.4 104 109Q107.6 107.4 105.6 100.6Z" fill="#E8607A"/>` +
        stroke('M101.4 102.4Q102.4 105.6 103.4 107.4', '#C04060', 0.8) +
        stroke('M92 97Q96 95 100 96Q104 95 108 97', lip, 1.8) +
        shine
      )
    case 'pout':
      return (
        `<path d="M94.5 98Q97 95 100 96.6Q103 95 105.5 98Q100 99 94.5 98Z" fill="${darken(lip, 0.12)}"${liner}/>` +
        `<path d="M95 98.3Q100 99.3 105 98.3Q104 104.6 100 104.8Q96 104.6 95 98.3Z" fill="${lip}"${liner}/>` +
        stroke('M94.5 98Q100 99.4 105.5 98', line, 0.9) +
        shine
      )
    default:
      return (
        `<path d="M92.5 98Q96 95 100 96.4Q104 95 107.5 98Q100 99.2 92.5 98Z" fill="${darken(lip, 0.12)}"${liner}/>` +
        `<path d="M93 98.4Q100 99.6 107 98.4Q104.5 103.4 100 103.6Q95.5 103.4 93 98.4Z" fill="${lip}"${liner}/>` +
        stroke('M92.5 98Q100 99.6 107.5 98', line, 1) +
        shine
      )
  }
}

function facialHair(l: Look2D, color: string): string {
  const stache = `<path d="M91 96Q95 91.6 100 93.6Q105 91.6 109 96Q105 94.6 100 95.4Q95 94.6 91 96Z" fill="${color}"/>`
  switch (l.facialHair) {
    case 'stubble':
      return (
        `<path d="M73 78C75 96 88 108.4 100 109C112 108.4 125 96 127 78C123 92 114 100.6 100 101C86 100.6 77 92 73 78Z" fill="${color}" opacity=".24"/>` +
        `<path d="M92 94.6Q100 92 108 94.6Q100 96 92 94.6Z" fill="${color}" opacity=".32"/>`
      )
    case 'moustache':
      return stache
    case 'goatee':
      return stache + `<path d="M94.6 104.4Q100 103 105.4 104.4Q104.6 111 100 111.6Q95.4 111 94.6 104.4Z" fill="${color}"/>`
    case 'full':
      return `<path d="M71 68C71.4 92 84 113 100 114.4C116 113 128.6 92 129 68C126 82 122 91 116 95.6Q108 92 100 92.8Q92 92 84 95.6C78 91 74 82 71 68Z" fill="${color}"/>` + stache
    default:
      return ''
  }
}

function marks(l: Look2D, shade: string): string {
  let out = ''
  const ink = darken(l.skin, 0.35)
  if (l.marks.includes('vitiligo')) {
    const v = mix(l.skin, '#F6DCCB', 0.78)
    out += `<g fill="${v}"><path d="M77 64C81 57 92 59 94 66C96 74 90 80 84 79C78 78 74 70 77 64Z"/><path d="M94 104.6C96 100.6 104 100.6 106 104.6C104 108 96 108 94 104.6Z"/><path d="M109 37C115 35 121 39 119 45C115 49 108 45 109 37Z"/></g>`
  }
  if (l.marks.includes('freckles')) {
    for (const [x, y] of [
      [86, 84], [89.6, 86.4], [84, 88], [92.6, 83.4], [88.4, 90], [107.4, 83.4], [110.4, 86.4], [113.6, 83], [115.6, 88], [111.6, 90], [116.4, 84.6], [97, 81.6], [103, 81.6],
    ])
      out += `<circle cx="${x}" cy="${y}" r=".75" fill="${ink}" opacity=".7"/>`
  }
  if (l.marks.includes('beauty-mark')) out += `<circle cx="109" cy="94" r="1" fill="${darken(l.skin, 0.55)}"/>`
  if (l.marks.includes('tribal-marks')) {
    const t = stroke('M113.6 86L121 85M113.6 89L121 88M113.6 92L121 91', ink, 0.9, ' opacity=".8"')
    out += t + `<g transform="${MIRROR}">${t}</g>`
  }
  if (l.marks.includes('wrinkles')) {
    const w = stroke('M106.6 92.4Q108.4 96 107.4 100.6M123 71.4L126.4 69.8M123.4 74.6L126.6 75M106 82Q112 85 119.2 81.6', shade, 0.8, ' opacity=".8"')
    out += w + `<g transform="${MIRROR}">${w}</g>` + stroke('M88 41.6Q100 38.6 112 41.6M90.4 45.6Q100 43 109.6 45.6', shade, 0.8, ' opacity=".6"')
  }
  return out
}

function faceTattoo(l: Look2D): string {
  const ink = '#1E1416'
  switch (l.tattoo) {
    case 'tears':
      return stroke('M87.6 82.6Q85.6 87.2 87.6 88.2Q89.6 87.2 87.6 82.6Z', ink, 0.8)
    case 'star':
      return `<path d="M126 77.4l1.1 2.3 2.5.3-1.8 1.7.5 2.5-2.3-1.2-2.3 1.2.5-2.5-1.8-1.7 2.5-.3z" fill="none" stroke="${ink}" stroke-width=".7"/>`
    case 'script':
      return stroke('M79 52.6q1.6-3 3 0t3 0 3 0 3 0q1.6-3 2.4.4', ink, 0.7)
    case 'vine':
      return (
        stroke('M127.4 54Q124 66 126.4 78Q127.4 86 122.4 94', ink, 0.8) +
        `<g fill="${ink}"><ellipse cx="124.4" cy="62" rx="1.8" ry=".8" transform="rotate(-30 124.4 62)"/><ellipse cx="128.2" cy="72" rx="1.8" ry=".8" transform="rotate(30 128.2 72)"/><ellipse cx="124" cy="86" rx="1.8" ry=".8" transform="rotate(-40 124 86)"/></g>`
      )
    case 'dots':
      return `<g fill="${ink}"><circle cx="84" cy="84" r=".9"/><circle cx="87" cy="85.6" r=".9"/><circle cx="90" cy="86.6" r=".9"/></g>`
    default:
      return ''
  }
}

function piercings(l: Look2D, afterHair: boolean): string {
  const gold = l.makeup === 'owambe' || l.makeup === 'lagos-baddie'
  const metal = gold ? '#E9C46A' : '#DADDE3'
  const edge = gold ? '#8A6A1E' : '#7D828C'
  const ball = (x: number, y: number, r = 1) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${metal}" stroke="${edge}" stroke-width=".4"/>`
  let out = ''
  for (const pc of l.piercings) {
    if (afterHair !== (pc === 'ears')) continue
    switch (pc) {
      case 'ears':
        if (l.hair !== 'hijab') out += `<circle cx="70.4" cy="84" r="3" fill="none" stroke="${metal}" stroke-width="1.3"/><circle cx="129.6" cy="84" r="3" fill="none" stroke="${metal}" stroke-width="1.3"/>`
        break
      case 'nose-stud':
        out += ball(104.2, 88.2) + '<circle cx="103.9" cy="87.9" r=".35" fill="#FFFFFF"/>'
        break
      case 'nose-ring':
        out += stroke('M103.8 88.4a2.4 2.4 0 1 0 1.6 2.8', metal, 1)
        break
      case 'septum':
        out += stroke('M97.8 90.6Q100 94.4 102.2 90.6', metal, 1.2) + ball(97.8, 90.6, 0.9) + ball(102.2, 90.6, 0.9)
        break
      case 'bridge':
        out += ball(97.4, 70.2) + ball(102.6, 70.2)
        break
      case 'brow':
        out += ball(121.6, 56.6) + ball(122.6, 62.4)
        break
      case 'lip':
        out += stroke('M102.6 102.6a2.1 2.1 0 1 0 3 .6', metal, 1)
        break
      case 'snakebites':
        out += ball(95, 104.2) + ball(105, 104.2)
        break
      case 'dermal':
        out += `<circle cx="121.6" cy="82.6" r="1.6" fill="#FFFFFF" stroke="${edge}" stroke-width=".5"/>` + stroke('M121.6 79.6V85.6M118.6 82.6H124.6', '#FFFFFF', 0.4, ' opacity=".9"')
        break
    }
  }
  return out
}

/* ----------------------------------------------------------------- clothes */

function sleeve(b: Body, frac: number, width: number, color: string): string {
  return stroke(armPath(b, 1, frac), color, width) + stroke(armPath(b, -1, frac), color, width)
}

function topLayer(l: Look2D, b: Body): { under: string; main: string } {
  const c = l.topColor
  const c2 = l.topColor2
  const d = darken(c, 0.2)
  const under = l.top === 'hoodie' ? `<path d="M83 116Q100 136 117 116L122 126Q100 148 78 126Z" fill="${d}"/>` : ''
  const fill = (path: string, color = c, extra = '') => `<path d="${path}" fill="${color}"${extra}/>`
  switch (l.top) {
    case 'crop':
      return {
        under,
        main: fill(panel(b, 128, 170, 1, 8)) + stroke(`M${f(100 - halfAt(b, 166) - 1)} 166 L${f(100 + halfAt(b, 166) + 1)} 166`, d, 2) + stroke(`M${f(100 - b.sh + 9)} 126L${f(100 - b.sh + 8)} 132M${f(100 + b.sh - 9)} 126L${f(100 + b.sh - 8)} 132`, c, 4),
      }
    case 'tee':
      return {
        under,
        main:
          sleeve(b, 0.4, b.arm + 9, c) +
          fill(panel(b, 123, 244, 4, 4)) +
          `<circle cx="100" cy="168" r="11" fill="${c2}" opacity=".9"/><path d="M95 166h10M93 171h14" stroke="${c}" stroke-width="2" stroke-linecap="round"/>` +
          stroke('M90 124Q100 132 110 124', d, 1.6),
      }
    case 'tank':
      return {
        under,
        main: fill(panel(b, 136, 240, 1.5, 6)) + stroke(`M${f(100 - b.sh + 11)} 124L${f(100 - b.sh + 13)} 138M${f(100 + b.sh - 11)} 124L${f(100 + b.sh - 13)} 138`, c, 4.4),
      }
    case 'shirt':
      return {
        under,
        main:
          sleeve(b, 0.62, b.arm + 5, c) +
          armBand(b, 0.57, 0.62, b.arm + 6, d) +
          fill(panel(b, 123, 248, 4, 3)) +
          `<path d="M90 121L100 132L95 138L86 126Z M110 121L100 132L105 138L114 126Z" fill="${c2}"/>` +
          stroke('M100 132V246', d, 1) +
          [150, 172, 194, 216].map((y) => `<circle cx="102.6" cy="${y}" r="1" fill="${d}"/>`).join(''),
      }
    case 'hoodie':
      return {
        under,
        main:
          sleeve(b, 1, b.arm + 7, c) +
          fill(panel(b, 123, 250, 6, 5)) +
          `<path d="M84 212L116 212L122 238L78 238Z" fill="${d}"/>` +
          stroke(`M${f(100 - halfAt(b, 246) - 6)} 246L${f(100 + halfAt(b, 246) + 6)} 246`, d, 5) +
          stroke('M95 128V150M105 128V150', c2, 1.4) +
          `<circle cx="95" cy="151" r="1.4" fill="${c2}"/><circle cx="105" cy="151" r="1.4" fill="${c2}"/>`,
      }
    case 'jersey':
      return {
        under,
        main:
          sleeve(b, 0.38, b.arm + 8, c) +
          armBand(b, 0.34, 0.38, b.arm + 9, c2) +
          fill(panel(b, 123, 242, 4, 0)) +
          `<path d="M90 123L100 140L110 123Z" fill="${l.skin}"/>` +
          stroke('M89 123L100 141L111 123', c2, 2.6) +
          `<text x="100" y="186" text-anchor="middle" font-family="Comfortaa, Arial, sans-serif" font-weight="700" font-size="24" fill="${c2}">10</text>`,
      }
    case 'corset':
      return {
        under,
        main:
          fill(panel(b, 146, 216, 0.8, 0)) +
          `<path d="M${f(100 - halfAt(b, 146) - 0.8)} 146Q${f(100 - b.sh / 2)} 134 100 144Q${f(100 + b.sh / 2)} 134 ${f(100 + halfAt(b, 146) + 0.8)} 146Z" fill="${c}"/>` +
          stroke(`M${f(100 - b.sh + 11)} 124L${f(100 - b.sh + 12)} 142M${f(100 + b.sh - 11)} 124L${f(100 + b.sh - 12)} 142`, c, 2) +
          stroke('M88 150V214M112 150V214M80 154V212M120 154V212', c2, 0.9, ' opacity=".7"') +
          stroke('M97 152L103 160M103 152L97 160M97 164L103 172M103 164L97 172M97 176L103 184M103 176L97 184M97 188L103 196M103 188L97 196', c2, 0.9),
      }
    case 'kaftan': {
      const y1 = b.seated ? 300 : 334
      return {
        under,
        main:
          sleeve(b, 1, b.arm + 11, c) +
          fill(panel(b, 123, y1, 7, 4, 22)) +
          stroke('M90 124Q100 138 110 124', c2, 2.4) +
          stroke(`M100 134V${y1 - 6}`, c2, 2, ' stroke-dasharray="1 3"') +
          stroke(`M94 136V${f(y1 * 0.6)}M106 136V${f(y1 * 0.6)}`, c2, 0.9, ' opacity=".7"'),
      }
    }
    case 'blazer':
      return {
        under,
        main:
          fill(panel(b, 124, 236, 2, 6), c2) +
          sleeve(b, 1, b.arm + 5, c) +
          `<path d="M${f(100 - halfAt(b, 124) - 4)} 124L93 124L98 198L96 254L${f(100 - halfAt(b, 250) - 5)} 254Q${f(100 - halfAt(b, 190) - 6)} 190 ${f(100 - halfAt(b, 124) - 4)} 124Z" fill="${c}"/>` +
          `<path d="M${f(100 + halfAt(b, 124) + 4)} 124L107 124L102 198L104 254L${f(100 + halfAt(b, 250) + 5)} 254Q${f(100 + halfAt(b, 190) + 6)} 190 ${f(100 + halfAt(b, 124) + 4)} 124Z" fill="${c}"/>` +
          stroke('M93 124L88 150L97 160M107 124L112 150L103 160', d, 1.4) +
          `<circle cx="99" cy="214" r="1.4" fill="${d}"/>`,
      }
  }
}

/** A cuff or trim: the stretch of arm between two fractions of its length. */
function armBand(b: Body, from: number, to: number, width: number, color: string): string {
  const end = (side: 1 | -1, frac: number) => armPath(b, side, frac).match(/(-?[\d.]+) (-?[\d.]+)$/)?.slice(1).join(' ') ?? '100 130'
  return ([1, -1] as const).map((side) => stroke(`M${end(side, from)} L${end(side, to)}`, color, width)).join('')
}

function bottomLayer(l: Look2D, b: Body, legs: Leg[]): string {
  const c = l.bottomColor
  const d = darken(c, 0.22)
  const pelvis = `<path d="${panel(b, 224, 256, 2.5)}" fill="${c}"/>` + stroke(`M${f(100 - halfAt(b, 227) - 2.5)} 227L${f(100 + halfAt(b, 227) + 2.5)} 227`, d, 2.4)
  const legStroke = (padT: number, padS: number, color: string, endPad = 0) =>
    legs.map((g) => stroke(seg(g.hip, g.knee), color, b.thigh + padT) + stroke(seg(g.knee, [g.ankle[0], g.ankle[1] + endPad]), color, b.shin + padS)).join('')
  switch (l.bottom) {
    case 'cargo':
      return (
        legStroke(10, 15, c, 4) +
        pelvis +
        legs
          .map((g) => {
            const side = g.hip[0] > 100 ? 1 : -1
            const px = g.knee[0] + side * (b.thigh / 2 + 3)
            return `<rect x="${f(px - 6)}" y="${f(g.knee[1] - 30)}" width="12" height="18" rx="2" fill="${d}"/>` + stroke(seg([g.hip[0] - side * 3, g.hip[1] + 4], [g.ankle[0] - side * 4, g.ankle[1]]), '#FFFFFF', 0.7, ' stroke-dasharray="2 2" opacity=".45"')
          })
          .join('') +
        stroke('M100 230V252', d, 1)
      )
    case 'jeans':
      return legStroke(4, 6, c) + pelvis + legs.map((g) => stroke(seg([g.hip[0], g.hip[1] + 4], g.ankle), lighten(c, 0.25), 0.8, ' opacity=".6"')).join('') + stroke('M100 230V250', d, 1)
    case 'joggers':
      return legStroke(7, 6, c) + pelvis + legs.map((g) => stroke(`M${f(g.ankle[0])} ${f(g.ankle[1] - 6)}L${f(g.ankle[0])} ${f(g.ankle[1] - 1)}`, d, b.shin + 4)).join('') + stroke('M97 229L95 240M103 229L105 240', '#FFFFFF', 1)
    case 'wide-leg':
      return (
        legs
          .map((g) => {
            const top = b.thigh / 2 + 4
            const bot = b.seated ? b.shin / 2 + 8 : b.shin / 2 + 13
            return `<path d="M${f(g.hip[0] - top)} ${f(g.hip[1] - 6)}L${f(g.hip[0] + top)} ${f(g.hip[1] - 6)}L${f(g.ankle[0] + bot)} ${f(g.ankle[1] + 5)}L${f(g.ankle[0] - bot)} ${f(g.ankle[1] + 5)}Z" fill="${c}"/>`
          })
          .join('') +
        pelvis +
        stroke(`M100 236V${b.seated ? 256 : 300}`, d, 1, ' opacity=".6"')
      )
    case 'shorts':
      return legs.map((g) => stroke(seg(g.hip, [g.hip[0] + (g.knee[0] - g.hip[0]) * 0.42, g.hip[1] + (g.knee[1] - g.hip[1]) * 0.42]), c, b.thigh + 7)).join('') + pelvis + stroke('M100 230V248', d, 1)
    case 'mini': {
      const w0 = halfAt(b, 222) + 2
      const y1 = b.seated ? 262 : 272
      return `<path d="M${f(100 - w0)} 222L${f(100 + w0)} 222L${f(100 + b.hi + 10)} ${y1}Q100 ${y1 + 4} ${f(100 - b.hi - 10)} ${y1}Z" fill="${c}"/>` + stroke(`M${f(100 - w0)} 225L${f(100 + w0)} 225`, d, 2.4)
    }
    case 'maxi':
    case 'wrapper': {
      const w0 = halfAt(b, 222) + 2
      const y1 = b.ankleY - 2
      const w1 = b.hi + (b.seated ? 18 : 22)
      const base = `<path d="M${f(100 - w0)} 222L${f(100 + w0)} 222L${f(100 + w1)} ${y1}Q100 ${y1 + 5} ${f(100 - w1)} ${y1}Z" fill="${c}"/>`
      if (l.bottom === 'maxi') return base + stroke(`M92 236L86 ${y1 - 4}M108 236L114 ${y1 - 4}`, d, 1, ' opacity=".6"')
      let pattern = ''
      const r = rng(hash(c))
      for (let i = 0; i < 26; i++) {
        const y = 230 + r() * (y1 - 236)
        const half = w0 + ((w1 - w0) * (y - 222)) / (y1 - 222) - 4
        pattern += `<circle cx="${f(100 + (r() * 2 - 1) * half)}" cy="${f(y)}" r="${f(2 + r() * 2.4)}" fill="${l.topColor2}" opacity=".8"/>`
      }
      return base + pattern + stroke(`M${f(100 + w0)} 224L${f(100 - w1 + 10)} ${y1}`, d, 1.4) + stroke(`M${f(100 - w0)} 226L${f(100 + w0)} 226`, d, 3)
    }
  }
}

function shoes(l: Look2D, legs: Leg[], b: Body): string {
  const c = l.shoeColor
  const d = darken(c, 0.25)
  return legs
    .map((g) => {
      const x = g.ankle[0]
      const y = g.ankle[1] + 4
      switch (l.shoes) {
        case 'sneakers':
          return `<path d="M${f(x - 10)} ${f(y + 5)}C${f(x - 10)} ${f(y - 7)} ${f(x + 10)} ${f(y - 7)} ${f(x + 10)} ${f(y + 5)}Z" fill="${c}"/><rect x="${f(x - 11.5)}" y="${f(y + 3)}" width="23" height="5" rx="2.5" fill="#FFFFFF"/>` + stroke(`M${f(x - 3)} ${f(y - 2)}L${f(x + 3)} ${f(y - 1)}M${f(x - 3)} ${f(y + 1)}L${f(x + 3)} ${f(y)}`, d, 0.9)
        case 'chunky':
          return `<path d="M${f(x - 11)} ${f(y + 4)}C${f(x - 11)} ${f(y - 8)} ${f(x + 11)} ${f(y - 8)} ${f(x + 11)} ${f(y + 4)}Z" fill="${c}"/><rect x="${f(x - 13)}" y="${f(y + 1)}" width="26" height="9" rx="4" fill="#F4F0EA" stroke="#C7CAD1" stroke-width=".8"/>` + stroke(`M${f(x - 4)} ${f(y - 3)}L${f(x + 4)} ${f(y - 1)}M${f(x + 4)} ${f(y - 3)}L${f(x - 4)} ${f(y - 1)}`, '#FF5C2B', 1)
        case 'boots':
          return `<rect x="${f(x - b.shin / 2 - 3)}" y="${f(y - 34)}" width="${f(b.shin + 6)}" height="34" rx="3" fill="${c}"/><path d="M${f(x - 11)} ${f(y + 4)}C${f(x - 11)} ${f(y - 6)} ${f(x + 11)} ${f(y - 6)} ${f(x + 11)} ${f(y + 4)}Z" fill="${c}"/><rect x="${f(x - 12)}" y="${f(y + 2)}" width="24" height="5" rx="2" fill="${d}"/>`
        case 'heels':
          return `<path d="M${f(x - 5)} ${f(y - 8)}L${f(x + 5)} ${f(y - 8)}L${f(x + 4)} ${f(y)}Q${f(x)} ${f(y + 9)} ${f(x - 4)} ${f(y)}Z" fill="${l.skin}"/><path d="M${f(x - 5.4)} ${f(y - 2)}Q${f(x)} ${f(y + 11)} ${f(x + 5.4)} ${f(y - 2)}L${f(x + 4)} ${f(y + 3)}Q${f(x)} ${f(y + 8)} ${f(x - 4)} ${f(y + 3)}Z" fill="${c}"/>` + stroke(`M${f(x - 5)} ${f(y - 7)}L${f(x + 5)} ${f(y - 7)}`, c, 1.6)
        default:
          return `<ellipse cx="${f(x)}" cy="${f(y + 2)}" rx="7" ry="6" fill="${l.skin}"/><rect x="${f(x - 9)}" y="${f(y - 2)}" width="18" height="6" rx="3" fill="${c}"/><rect x="${f(x - 10)}" y="${f(y + 6)}" width="20" height="3" rx="1.5" fill="${d}"/>`
      }
    })
    .join('')
}

function extraBody(l: Look2D, b: Body): { behind: string; front: string } {
  const c = l.extraColor
  switch (l.extra) {
    case 'headphones':
      return {
        behind: stroke('M83 122Q100 106 117 122', '#2A2730', 3.4),
        front: [84, 116].map((x) => `<circle cx="${x}" cy="128" r="9.4" fill="${c}"/><circle cx="${x}" cy="128" r="5.4" fill="#B3123F"/><circle cx="${x}" cy="128" r="2" fill="#4CE0F0"/>`).join('') + stroke('M116 137Q118 170 108 200Q100 222 110 236', '#2A2730', 1.2),
      }
    case 'chain':
      return { behind: '', front: stroke('M86 125Q100 152 114 125', c, 1.6) + `<circle cx="100" cy="140" r="2.8" fill="${c}"/>` }
    case 'bag': {
      const x = 100 + b.hi + 6
      return { behind: '', front: stroke(`M${f(100 - b.sx)} 128L${f(x)} 226`, darken(c, 0.25), 2.4) + `<rect x="${f(x - 12)}" y="224" width="24" height="20" rx="6" fill="${c}"/><path d="M${f(x - 12)} 230H${f(x + 12)}" stroke="${darken(c, 0.25)}" stroke-width="1.4"/>` }
    }
    default:
      return { behind: '', front: '' }
  }
}

function headExtra(l: Look2D): string {
  const c = l.extraColor
  const d = darken(c, 0.22)
  const big = ['afro', 'curly-fro', 'freeform-locs', 'puffs'].includes(l.hair) ? -8 : 0
  switch (l.extra) {
    case 'bucket-hat':
      return `<g transform="translate(0 ${big})"><path d="M70 44C71 20 129 20 130 44Z" fill="${c}"/><path d="M57 46Q100 32 143 46Q147 55 136 57Q100 46 64 57Q53 55 57 46Z" fill="${d}"/>${stroke('M72 36Q100 28 128 36', darken(c, 0.35), 0.7, ' stroke-dasharray="1.6 1.6"')}</g>`
    case 'cap':
      return `<g transform="translate(0 ${big})"><path d="M68 54C67 22 133 22 132 54Q100 45 68 54Z" fill="${c}"/><path d="M70 52Q100 42 130 52Q124 62 100 60Q76 62 70 52Z" fill="${d}"/><circle cx="100" cy="25" r="2" fill="${d}"/></g>`
    case 'beanie':
      return `<g transform="translate(0 ${big})"><path d="M67 56C65 20 135 20 133 56Z" fill="${c}"/><path d="M65 48Q100 42 135 48L135 59Q100 53 65 59Z" fill="${d}"/>${stroke('M74 50V57M82 48V56M90 47V55M98 46V54M106 46V54M114 47V55M122 48V56M130 49V57', darken(c, 0.4), 0.7, ' opacity=".6"')}</g>`
    case 'gele':
      return (
        `<path d="M56 46C46 20 70 0 100 3C130 0 154 20 144 46C152 30 142 13 124 15C140 25 137 40 130 47Q100 36 70 47C63 40 60 25 76 15C58 13 48 30 56 46Z" fill="${c}"/>` +
        stroke('M70 46Q66 26 80 12M86 40Q84 22 94 6M100 38V4M114 40Q116 22 106 6M130 46Q134 26 120 12', d, 1.2) +
        `<path d="M68 52Q100 38 132 52L132 58Q100 46 68 58Z" fill="${d}"/>`
      )
    default:
      return ''
  }
}

function glasses(l: Look2D, p: string): string {
  if (l.eyes === 'glasses') {
    const frame = l.age === 'elder' ? '#B08D3A' : '#1B1214'
    return (
      `<circle cx="113" cy="73" r="11.4" fill="#FFFFFF" fill-opacity=".1" stroke="${frame}" stroke-width="2.2"/><circle cx="87" cy="73" r="11.4" fill="#FFFFFF" fill-opacity=".1" stroke="${frame}" stroke-width="2.2"/>` +
      stroke('M98.6 72Q100 69.6 101.4 72M124.4 70.6L131 68.6M75.6 70.6L69 68.6', frame, 2) +
      stroke('M106 66L110 63', '#FFFFFF', 1.2, ' opacity=".7"') +
      stroke('M80 66L84 63', '#FFFFFF', 1.2, ' opacity=".7"')
    )
  }
  if (l.eyes === 'shades') {
    const lens = 'M101.6 65.4L125.6 65.4Q126.6 76 119 81Q110 83.4 104.2 78Q101 73 101.6 65.4Z'
    return (
      `<path d="${lens}" fill="url(#${p}sh)" stroke="#0E0B10" stroke-width="1.4"/><g transform="${MIRROR}"><path d="${lens}" fill="url(#${p}sh)" stroke="#0E0B10" stroke-width="1.4"/></g>` +
      stroke('M98 66.6L102 66.6M125.4 66.8L131 66M74.6 66.8L69 66', '#0E0B10', 1.8) +
      stroke('M107 69L114 69M83 69L90 69', '#FFFFFF', 1.4, ' opacity=".45"')
    )
  }
  return ''
}

/* ------------------------------------------------------------------ public */

let counter = 0

export interface RenderOpts {
  crop?: DollCrop
  /** Pixel size for raster use (globe textures); omit in the DOM. */
  px?: number
  bg?: string | null
}

export function renderDoll(l: Look2D, opts: RenderOpts = {}): string {
  const crop = opts.crop ?? 'full'
  const [vx, vy, vw, vh] = VIEW[crop]
  const p = `d${(counter++).toString(36)}`
  const r = rng(hash(`${l.hair}${l.hairColor}${l.skin}`))
  const b = bodyOf(l)
  const skin = l.skin
  const shade = darken(skin, 0.18)
  const deep = darken(skin, 0.32)
  const hair = `url(#${p}h)`
  const gray = l.age === 'elder' && luma(l.hairColor) > 0.6
  const browColor = l.brows === 'bleached' ? '#EFDDA8' : gray ? '#B8B0A6' : '#22140F'
  const naturalLip = mix(darken(skin, 0.22), '#B5555F', 0.3)
  const lip = l.makeup === 'none' ? naturalLip : l.lip
  const legs = [legOf(b, -1), legOf(b, 1)]
  const fhColor = l.hair === 'bald' || l.hair === 'hijab' ? (l.age === 'elder' ? '#CFC8BE' : '#1B1214') : gray ? l.hairColor : darken(l.hairColor, 0.1)
  const jaw = l.group === 'men' ? 4 : l.group === 'androgynous' ? 2 : 0
  const FACE = `M70 62C70 38 84 27 100 27C116 27 130 38 130 62C130 ${84 + jaw} ${121 + jaw} ${102 + jaw / 2} 100 108C${79 - jaw} ${102 + jaw / 2} 70 ${84 + jaw} 70 62Z`
  const blushAmt = { none: 0.1, 'natural-glow': 0.2, 'soft-glam': 0.3, 'lagos-baddie': 0.22, owambe: 0.26, goth: 0, rainbow: 0.24, alt: 0.08, 'e-girl': 0.48, y2k: 0.3, editorial: 0.18 }[l.makeup]
  const glow = ['natural-glow', 'lagos-baddie', 'soft-glam', 'owambe', 'y2k'].includes(l.makeup)
  const bodyExtra = extraBody(l, b)
  const top = topLayer(l, b)
  const full = crop === 'full'

  const defs =
    `<defs>` +
    `<linearGradient id="${p}h" gradientUnits="userSpaceOnUse" x1="0" y1="20" x2="0" y2="250"><stop offset="0" stop-color="${lighten(l.hairColor, 0.14)}"/><stop offset=".16" stop-color="${l.hairColor}"/><stop offset=".4" stop-color="${l.hairColor}"/><stop offset="1" stop-color="${l.hairColor2}"/></linearGradient>` +
    `<linearGradient id="${p}rb" gradientUnits="userSpaceOnUse" x1="103" y1="0" x2="127" y2="0"><stop offset="0" stop-color="#FF3D8B"/><stop offset=".25" stop-color="#FF9F1C"/><stop offset=".45" stop-color="#FFE14D"/><stop offset=".65" stop-color="#2FBF71"/><stop offset=".85" stop-color="#2F6BFF"/><stop offset="1" stop-color="#A86BFF"/></linearGradient>` +
    `<linearGradient id="${p}sh" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2A2235"/><stop offset="1" stop-color="#5A4470"/></linearGradient>` +
    `<radialGradient id="${p}ct"><stop offset="0" stop-color="${lighten(l.eyeColor, 0.5)}"/><stop offset=".7" stop-color="${l.eyeColor}"/><stop offset="1" stop-color="${darken(l.eyeColor, 0.3)}"/></radialGradient>` +
    // Painted look: the face is lit from the upper left, and every outer edge gets a soft
    // core shadow on the right and a rim light on the left, so shapes read as rounded.
    `<radialGradient id="${p}sk" gradientUnits="userSpaceOnUse" cx="94" cy="62" r="50"><stop offset="0" stop-color="${lighten(skin, 0.14)}"/><stop offset=".5" stop-color="${skin}"/><stop offset="1" stop-color="${darken(skin, 0.2)}"/></radialGradient>` +
    `<filter id="${p}v" x="-5%" y="-5%" width="110%" height="110%" color-interpolation-filters="sRGB">` +
    `<feGaussianBlur in="SourceAlpha" stdDeviation="2.6" result="b"/>` +
    `<feOffset in="b" dx="-4.5" dy="-2" result="o1"/><feComposite in="SourceAlpha" in2="o1" operator="out" result="e1"/>` +
    `<feFlood flood-color="#2A0F1A" flood-opacity=".34"/><feComposite in2="e1" operator="in" result="core"/>` +
    `<feOffset in="b" dx="3.5" dy="1.5" result="o2"/><feComposite in="SourceAlpha" in2="o2" operator="out" result="e2"/>` +
    `<feFlood flood-color="#FFFFFF" flood-opacity=".2"/><feComposite in2="e2" operator="in" result="rim"/>` +
    `<feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="core"/><feMergeNode in="rim"/></feMerge></filter>` +
    `</defs>`

  let s = defs
  if (opts.bg) s += `<rect x="${vx}" y="${vy}" width="${vw}" height="${vh}" fill="${opts.bg}"/>`
  s += '<g filter="url(#' + p + 'v)">'

  // Back: hair behind the body, wheelchair frame.
  s += hairBack(l, hair, r)
  if (full && b.seated) {
    for (const side of [-1, 1] as const) {
      const cx = 100 + side * (b.hi + 15)
      s += `<circle cx="${f(cx)}" cy="290" r="50" fill="none" stroke="#1F1D24" stroke-width="7"/><circle cx="${f(cx)}" cy="290" r="44" fill="none" stroke="#C7CAD1" stroke-width="2.4"/><circle cx="${f(cx)}" cy="290" r="47.4" fill="none" stroke="#8A8F98" stroke-width="1.4"/>`
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI
        s += stroke(`M${f(cx + Math.cos(a) * 44)} ${f(290 + Math.sin(a) * 44)}L${f(cx - Math.cos(a) * 44)} ${f(290 - Math.sin(a) * 44)}`, '#C7CAD1', 0.9)
      }
      s += `<circle cx="${f(cx)}" cy="290" r="4.4" fill="#8A8F98"/>`
    }
    s += `<rect x="${f(100 - b.sh + 3)}" y="150" width="${f(2 * b.sh - 6)}" height="96" rx="8" fill="#2A2730"/>`
    s += stroke(`M${f(100 - b.sh + 6)} 152L${f(100 - b.sh + 2)} 140M${f(100 + b.sh - 6)} 152L${f(100 + b.sh - 2)} 140`, '#1F1D24', 4.4)
    s += `<rect x="${f(100 - b.hi - 9)}" y="236" width="${f(2 * b.hi + 18)}" height="13" rx="5" fill="#3B3640"/>`
    s += stroke(`M${f(100 - b.hi - 4)} 250L${f(100 - 18)} ${b.ankleY + 13}M${f(100 + b.hi + 4)} 250L${f(100 + 18)} ${b.ankleY + 13}`, '#8A8F98', 2.6)
    s += `<rect x="${f(100 - 30)}" y="${b.ankleY + 11}" width="60" height="5" rx="2" fill="#3B3640"/>`
    s += `<circle cx="${f(100 - b.hi - 2)}" cy="${b.ankleY + 18}" r="6" fill="#1F1D24"/><circle cx="${f(100 + b.hi + 2)}" cy="${b.ankleY + 18}" r="6" fill="#1F1D24"/>`
  }

  // Legs, shoes, bottoms.
  if (full) {
    for (const g of legs) s += stroke(seg(g.hip, g.knee), skin, b.thigh) + stroke(seg(g.knee, g.ankle), skin, b.shin)
    s += stroke(seg(legs[0].knee, legs[0].ankle), shade, b.shin * 0.3, ' opacity=".5"')
    s += shoes(l, legs, b)
    s += bottomLayer(l, b, legs)
  }

  // Torso, arms, neck.
  s += top.under + bodyExtra.behind
  s += `<path d="M92 94L92 124Q100 130 108 124L108 94Z" fill="${skin}"/><path d="M92 102Q100 114 108 102L108 112Q100 121 92 112Z" fill="${shade}"/>`
  s += `<path d="${panel(b, 121, 254, 0)}" fill="${skin}"/>`
  s += stroke('M86 129Q93 131.6 98 129.4M114 129Q107 131.6 102 129.4', shade, 0.9, ' opacity=".7"')
  if (l.top === 'crop') {
    s += stroke('M100 194V200', shade, 1.1) + stroke('M98 206Q100 208.6 102 206', deep, 1.1)
    if (l.build === 'athletic' || l.build === 'slim') s += stroke('M94 176Q100 178 106 176M95 188Q100 190 105 188', shade, 0.8, ' opacity=".6"')
  }
  s += stroke(armPath(b, 1), skin, b.arm) + stroke(armPath(b, -1), skin, b.arm)
  s += stroke(armPath(b, -1), shade, b.arm * 0.32, ' opacity=".55"')
  if (l.marks.includes('vitiligo')) s += `<ellipse cx="${f(100 + b.ex)}" cy="190" rx="4" ry="7" fill="${mix(skin, '#F6DCCB', 0.78)}"/>`
  s += top.main
  if (full && b.seated === false && l.cane) {
    const hx0 = 100 + b.wx
    s += stroke(`M${f(hx0)} ${b.wy + 4}L${f(hx0 + 24)} 398`, '#FFFFFF', 3.2) + stroke(`M${f(hx0 + 20)} 380L${f(hx0 + 24)} 398`, '#D62F3A', 3.4) + stroke(`M${f(hx0)} ${b.wy + 2}L${f(hx0 + 2)} ${b.wy + 14}`, '#1B1214', 3.6)
  }
  for (const side of [-1, 1] as const) {
    const x = 100 + side * b.wx
    s += `<ellipse cx="${f(x)}" cy="${f(b.wy + 6)}" rx="${f(b.arm * 0.52)}" ry="${f(b.arm * 0.72)}" fill="${skin}"/>` + stroke(`M${f(x - 2)} ${f(b.wy + 9)}L${f(x - 2)} ${f(b.wy + 12)}M${f(x + 1)} ${f(b.wy + 9.4)}L${f(x + 1)} ${f(b.wy + 12.6)}`, shade, 0.8)
  }
  s += bodyExtra.front

  // Head.
  if (l.hair !== 'hijab') {
    s += `<ellipse cx="70" cy="73" rx="5.6" ry="8.6" fill="${skin}"/><ellipse cx="130" cy="73" rx="5.6" ry="8.6" fill="${skin}"/>`
    s += stroke('M68.6 69Q66.4 73 69 77M131.4 69Q133.6 73 131 77', shade, 1.1)
  }
  s += `<path d="${FACE}" fill="url(#${p}sk)"/>`
  s += `<path d="M70 62C70 ${84 + jaw} ${79 - jaw} ${102 + jaw / 2} 100 108C88 104 78 92 75 74C74 68 73 64 70 62Z" fill="${shade}" opacity=".55"/>`
  s += marks(l, deep)
  s += `<ellipse cx="85.4" cy="88.4" rx="6.6" ry="3.6" fill="#FF5C7A" opacity="${blushAmt}"/><ellipse cx="114.6" cy="88.4" rx="6.6" ry="3.6" fill="#FF5C7A" opacity="${blushAmt}"/>`
  if (l.makeup === 'e-girl') s += `<ellipse cx="100" cy="85" rx="4" ry="2" fill="#FF5C7A" opacity=".4"/>`
  if (glow) s += `<ellipse cx="118.4" cy="81.6" rx="3.4" ry="1.4" fill="#FFFFFF" opacity=".32"/><ellipse cx="81.6" cy="81.6" rx="3.4" ry="1.4" fill="#FFFFFF" opacity=".22"/><ellipse cx="101" cy="85.4" rx="1" ry="1.6" fill="#FFFFFF" opacity=".4"/>`

  // Eyes (designed on the right, mirrored for the left).
  const eyeR = eyeShadow(l, p) + eyeRight(l, p) + browRight(l, browColor)
  s += `<g>${eyeR}</g><g transform="${MIRROR}">${eyeR.replace(new RegExp(`${p}e([ar])`, 'g'), `${p}m$1`)}</g>`
  if (l.makeup === 'e-girl') s += `<path d="M121.6 87c-1-1.6-3.4-.6-2.4 1.2l2.4 2.4 2.4-2.4c1-1.8-1.4-2.8-2.4-1.2z" fill="#FF3D8B"/>`

  // Nose and mouth.
  s += stroke('M101 76Q102.4 82 102.2 86', shade, 1, ' opacity=".55"')
  s += stroke('M97.4 88.6Q100 90.6 102.6 88.6', deep, 1.5) + stroke('M95.2 87.2Q95.8 89.4 97.6 89.4M104.8 87.2Q104.2 89.4 102.4 89.4', deep, 1)
  s += `<circle cx="101.2" cy="85.6" r=".9" fill="#FFFFFF" opacity=".45"/>`
  s += facialHair(l, fhColor)
  s += mouth(l, lip)
  s += faceTattoo(l)
  s += piercings(l, false)

  // Front hair, headwear, eyewear, hearing aid.
  s += hairFront(l, hair, r)
  // Sheen across the crown.
  if (!['bald', 'hijab', 'buzz', 'fade', 'waves', 'cornrows'].includes(l.hair)) s += stroke('M80 38Q90 29.5 104 30.5', '#FFFFFF', 4, ' opacity=".16"') + stroke('M108 31.5Q113 32.5 116 34.6', '#FFFFFF', 2.6, ' opacity=".12"')
  if (l.hair === 'hijab') s += `<path d="M70 78C74 102 86 113 100 113C114 113 126 102 130 78L134 98C130 130 118 142 100 144C82 142 70 130 66 98Z" fill="${hair}"/>`
  if (l.hair === 'bald') s += `<ellipse cx="108" cy="36" rx="9" ry="4" fill="#FFFFFF" opacity=".22" transform="rotate(-18 108 36)"/>`
  s += headExtra(l)
  s += piercings(l, true)
  s += glasses(l, p)
  if (l.hearingAid) s += `<path d="M131.6 62Q138.6 64 137 74Q135.4 80 131 79" fill="none" stroke="#FF7AB6" stroke-width="3.6" stroke-linecap="round"/><circle cx="131" cy="79" r="2" fill="#FF7AB6"/><path d="M133 68L136 66" stroke="#FFFFFF" stroke-width="1" stroke-linecap="round"/>`

  s += '</g>'
  const size = opts.px ? ` width="${opts.px}" height="${f((opts.px * vh) / vw)}"` : ' style="width:100%;height:100%;display:block"'
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vx} ${vy} ${vw} ${vh}"${size} preserveAspectRatio="xMidYMid meet">${s}</svg>`
}

/** As an image URL, for canvases and <img>. */
export function dollDataUrl(l: Look2D, opts: RenderOpts = {}): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(renderDoll(l, opts))}`
}
