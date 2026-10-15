import type { StudioLook } from './look'

/**
 * Daily makeover briefs. Scoring only reads styling choices (colours, finish, outfit,
 * hair styling). It never reads skin tone, face shape, body shape or height, so no
 * appearance is worth more than another.
 */

export interface Criterion {
  id: string
  label: string
  weight: number
  /** 0..1 how well the look meets it. */
  test: (l: StudioLook) => number
}

export interface Brief {
  id: string
  title: string
  story: string
  criteria: Criterion[]
}

function hsl(hex: string): { h: number; s: number; l: number } {
  const n = parseInt(hex.slice(1), 16)
  const r = ((n >> 16) & 255) / 255
  const g = ((n >> 8) & 255) / 255
  const b = (n & 255) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  const d = max - min
  if (!d) return { h: 0, s: 0, l }
  const s = d / (1 - Math.abs(2 * l - 1))
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  h *= 60
  if (h < 0) h += 360
  return { h, s, l }
}

const near = (v: number, target: number, tol: number) => Math.max(0, 1 - Math.abs(v - target) / tol)
const atLeast = (v: number, min: number) => Math.min(1, v / min)
const atMost = (v: number, max: number) => (v <= max ? 1 : Math.max(0, 1 - (v - max) / (1 - max + 1e-6)))
const hueIn = (hex: string, lo: number, hi: number) => {
  const { h, s } = hsl(hex)
  if (s < 0.15) return 0.3
  const inRange = lo <= hi ? h >= lo && h <= hi : h >= lo || h <= hi
  return inRange ? 1 : 0.2
}
const wearing = (l: StudioLook) => [l.wear.top?.id, l.wear.bottom?.id, l.wear.dress?.id].filter(Boolean) as string[]
const outfitIn = (l: StudioLook, ids: string[]) => (wearing(l).some((id) => ids.includes(id)) ? 1 : 0)
const totalMakeup = (l: StudioLook) => {
  const m = l.makeup
  return (m.foundation.amount + m.contour.amount + m.blush.amount + m.highlight.amount + m.eyeshadow.amount + m.liner.amount + m.lipstick.amount) / 7
}

const BRIEFS: Brief[] = [
  {
    id: 'owambe',
    title: 'Owambe Saturday',
    story: 'Your aunty’s 60th in Ikoyi. Photos all night: sculpted, shimmering, unforgettable.',
    criteria: [
      { id: 'shimmer', label: 'Shimmering lids', weight: 2, test: (l) => atLeast(l.makeup.eyeshadow.amount, 0.6) * atLeast(l.makeup.eyeshadow.shimmer, 0.6) },
      { id: 'gold', label: 'Gold or bronze eyes', weight: 1, test: (l) => hueIn(l.makeup.eyeshadow.color, 25, 55) },
      { id: 'sculpt', label: 'Sculpted cheeks', weight: 1, test: (l) => atLeast(l.makeup.contour.amount, 0.4) * atLeast(l.makeup.highlight.amount, 0.4) },
      { id: 'lip', label: 'A statement lip', weight: 1, test: (l) => atLeast(l.makeup.lipstick.amount, 0.7) },
      { id: 'dress', label: 'Dressed up', weight: 1, test: (l) => outfitIn(l, ['female_elegantsuit01', 'dress_sequin_mini', 'dress_velvet_mini', 'dress_slip']) },
    ],
  },
  {
    id: 'brunch',
    title: 'Lekki brunch',
    story: 'Sunlight, mimosas, candid shots. Fresh skin, not a full beat.',
    criteria: [
      { id: 'light', label: 'Light touch', weight: 2, test: (l) => atMost(totalMakeup(l), 0.35) * atLeast(totalMakeup(l) + 0.01, 0.12) },
      { id: 'glow', label: 'Glowing skin', weight: 1, test: (l) => atLeast(l.makeup.highlight.amount + l.skin.glow * 0.5, 0.45) },
      { id: 'gloss', label: 'Glossy lips', weight: 1, test: (l) => atLeast(l.makeup.gloss, 0.6) },
      { id: 'casual', label: 'Easy outfit', weight: 1, test: (l) => outfitIn(l, ['female_casualsuit01', 'female_casualsuit02', 'top_tank', 'top_baby_tee', 'top_oversized_tee', 'bottom_baggy_jeans', 'bottom_skinny_jeans']) },
    ],
  },
  {
    id: 'fashion-week',
    title: 'Front row, Lagos Fashion Week',
    story: 'Editors are watching. Be the look they photograph.',
    criteria: [
      { id: 'graphic', label: 'Graphic eye', weight: 2, test: (l) => atLeast(l.makeup.liner.amount, 0.8) * atLeast(l.makeup.eyeshadow.amount, 0.6) },
      { id: 'colour', label: 'Bold colour', weight: 1, test: (l) => atLeast(hsl(l.makeup.eyeshadow.color).s, 0.5) },
      { id: 'matte', label: 'Matte lip', weight: 1, test: (l) => atMost(l.makeup.gloss, 0.25) * atLeast(l.makeup.lipstick.amount, 0.6) },
      { id: 'styled', label: 'Styled outfit', weight: 1, test: (l) => (l.wear.dress || outfitIn(l, ['top_corset', 'top_bandeau', 'top_lace_bralette', 'bottom_satin_mini', 'bottom_pencil_skirt']) ? 1 : 0.3) },
    ],
  },
  {
    id: 'engagement',
    title: 'Traditional engagement',
    story: 'You are the bride’s best friend and the camera loves you.',
    criteria: [
      { id: 'flawless', label: 'Even base', weight: 1, test: (l) => atLeast(l.makeup.foundation.amount, 0.6) * atLeast(l.makeup.concealer.amount, 0.4) },
      { id: 'wing', label: 'Defined liner', weight: 1, test: (l) => atLeast(l.makeup.liner.amount, 0.7) },
      { id: 'rose', label: 'Rose or berry lip', weight: 2, test: (l) => hueIn(l.makeup.lipstick.color, 320, 10) * atLeast(l.makeup.lipstick.amount, 0.6) },
      { id: 'blush', label: 'Flushed cheeks', weight: 1, test: (l) => atLeast(l.makeup.blush.amount, 0.3) },
    ],
  },
  {
    id: 'video',
    title: 'Afrobeats video set',
    story: 'Night shoot under neon. Shine is the point.',
    criteria: [
      { id: 'wet', label: 'High-shine lips', weight: 2, test: (l) => atLeast(l.makeup.gloss, 0.85) },
      { id: 'glow', label: 'Strobed highlight', weight: 1, test: (l) => atLeast(l.makeup.highlight.amount, 0.65) },
      { id: 'night', label: 'Night-out eyes', weight: 1, test: (l) => atLeast(l.makeup.eyeshadow.amount * (0.5 + l.makeup.eyeshadow.shimmer * 0.5), 0.55) },
      { id: 'nails', label: 'Done nails', weight: 1, test: (l) => atLeast(l.nails.amount, 0.8) },
    ],
  },
  {
    id: 'gym',
    title: 'Morning run at Muri Okunola',
    story: 'Sweat-proof and effortless. Brows done, nothing else.',
    criteria: [
      { id: 'minimal', label: 'Barely-there makeup', weight: 2, test: (l) => atMost(totalMakeup(l), 0.18) },
      { id: 'sport', label: 'Sportswear', weight: 2, test: (l) => outfitIn(l, ['female_sportsuit01', 'top_sports_bra', 'bottom_leggings']) },
      { id: 'sneakers', label: 'Sneakers', weight: 1, test: (l) => (['shoes02', 'shoes05', 'shoes06'].includes(l.wear.shoes?.id ?? '') ? 1 : 0) },
      { id: 'hair', label: 'Hair off the face', weight: 1, test: (l) => (['ponytail01', 'braid01', 'short02', 'none'].includes(l.hair.style) ? 1 : 0.4) },
    ],
  },
  {
    id: 'interview',
    title: 'First day at the agency',
    story: 'Victoria Island office, 9am. Polished, calm, confident.',
    criteria: [
      { id: 'neutral', label: 'Neutral eyes', weight: 1, test: (l) => (hsl(l.makeup.eyeshadow.color).s < 0.45 ? 1 : 0.3) * near(l.makeup.eyeshadow.amount, 0.35, 0.4) },
      { id: 'polish', label: 'Polished base', weight: 1, test: (l) => atLeast(l.makeup.foundation.amount, 0.4) },
      { id: 'lip', label: 'Soft lip colour', weight: 1, test: (l) => near(l.makeup.lipstick.amount, 0.5, 0.35) },
      { id: 'smart', label: 'Smart outfit', weight: 2, test: (l) => outfitIn(l, ['female_elegantsuit01', 'female_casualsuit01', 'bottom_pencil_skirt', 'top_peplum']) },
    ],
  },
]

/** UTC day key, e.g. 2026-10-12. */
export function studioDay(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10)
}

export function briefForDay(day: string): Brief {
  const n = Math.floor(Date.parse(day + 'T00:00:00Z') / 86_400_000)
  return BRIEFS[((n % BRIEFS.length) + BRIEFS.length) % BRIEFS.length]
}

export interface ScoreResult {
  score: number
  parts: { id: string; label: string; got: number }[]
}

export function scoreLook(brief: Brief, look: StudioLook): ScoreResult {
  let total = 0
  let max = 0
  const parts = brief.criteria.map((c) => {
    const got = Math.max(0, Math.min(1, c.test(look)))
    total += got * c.weight
    max += c.weight
    return { id: c.id, label: c.label, got }
  })
  return { score: Math.round((total / max) * 100), parts }
}

/* ------------------------------------------------------------------ progression */

export const LEVELS = [
  { name: 'Newcomer', xp: 0 },
  { name: 'Rising artist', xp: 150 },
  { name: 'Salon regular', xp: 450 },
  { name: 'Beauty influencer', xp: 1000 },
  { name: 'Celebrity artist', xp: 2000 },
  { name: 'Icon', xp: 4000 },
] as const

export function levelFor(xp: number) {
  let i = 0
  for (let k = 0; k < LEVELS.length; k++) if (xp >= LEVELS[k].xp) i = k
  const next = LEVELS[i + 1]
  return { index: i, name: LEVELS[i].name, next: next?.xp ?? null, progress: next ? (xp - LEVELS[i].xp) / (next.xp - LEVELS[i].xp) : 1 }
}
