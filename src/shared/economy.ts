import type { ApartmentTierId, BodyState, FaceState, SkinState } from './types'

/** The earned in-game currency. Stored as `dollies` in data for compatibility. */
export const CURRENCY = { name: 'Glam', short: 'G' } as const
/** Premium currency, kept separate from earned currency. */
export const PREMIUM = { name: 'Gems' } as const

export const STARTING_DOLLIES = 500
export const STARTING_GEMS = 10

export const SHIFT_DAILY_LIMIT = 5
export const SHIFT_COOLDOWN_MS = 3 * 60 * 1000
/** A shift shorter than this is treated as a cheat and pays nothing. */
export const SHIFT_MIN_MS = 8 * 1000
export const SHIFT_MAX_MS = 10 * 60 * 1000

export const CAREER_UNLOCK_DAYS = 7
export const FRIEND_REQUEST_DAILY_LIMIT = 20
export const SELL_BACK_RATE = 0.5
export const STARTER_CHANGE_COST = 300

export const PIERCING_PRICE = 40
export const TATTOO_PRICE = 60
export const TEMP_TATTOO_PRICE = 15

export const MESSAGE_MAX_CHARS = 2000
export const NOTE_MAX_CHARS = 140

export interface ClinicProcedure {
  id: string
  name: string
  blurb: string
  price: number
  face?: Partial<Record<keyof FaceState, number>>
  body?: Partial<Record<keyof BodyState, number>>
  skin?: Partial<Pick<SkinState, 'glow'>>
}

/**
 * Beauty Studio (adult avatars only). Fictional treatments: values are deltas
 * added to the current sliders, previewed before you pay, and undoable until saved.
 */
export const CLINIC_PROCEDURES: ClinicProcedure[] = [
  { id: 'smoothing', name: 'Botox', blurb: 'Smooth, rested, a little bit shiny.', price: 180, face: { asymmetry: -0.15, brows: 0.05 }, skin: { glow: 0.1 } },
  { id: 'lip-filler', name: 'Lip filler', blurb: 'Fuller, defined lips.', price: 250, face: { lips: 0.2 } },
  { id: 'rhinoplasty', name: 'Nose job', blurb: 'Narrower bridge and tip.', price: 400, face: { nose: -0.2 } },
  { id: 'jawline', name: 'Jawline contour', blurb: 'Sharper jaw.', price: 380, face: { jaw: 0.2 } },
  { id: 'chin', name: 'Chin sculpt', blurb: 'More projection.', price: 300, face: { chin: 0.18 } },
  { id: 'brow-lift', name: 'Brow lift', blurb: 'Lifted, open eyes.', price: 260, face: { brows: 0.18 } },
  { id: 'smile', name: 'Veneers', blurb: 'Hollywood smile.', price: 350, face: { cheekbones: 0.08 } },
  { id: 'facial', name: 'Glow facial', blurb: 'Even, dewy skin.', price: 120, skin: { glow: 0.25 } },
  { id: 'bbl', name: 'BBL', blurb: 'Brazilian butt lift: fuller hips, snatched waist.', price: 900, body: { hips: 0.25, waist: -0.08 } },
  { id: 'breast-lift', name: 'Breast lift', blurb: 'Fuller, lifted bust.', price: 700, body: { bust: 0.15 } },
  { id: 'tummy-tuck', name: 'Tummy tuck', blurb: 'Flatter, tighter middle.', price: 650, body: { waist: -0.15, softness: -0.1 } },
  { id: 'lipo', name: 'Lipo', blurb: 'Less softness overall.', price: 500, body: { softness: -0.2 } },
  { id: 'contour', name: 'Body contour', blurb: 'Snatched waist, fuller hips.', price: 600, body: { waist: -0.15, hips: 0.15 } },
]
export const CLINIC_BY_ID = new Map(CLINIC_PROCEDURES.map((p) => [p.id, p]))

export interface ApartmentTier {
  id: ApartmentTierId
  name: string
  /** Interior floor size in metres. */
  w: number
  d: number
  price: number
}

export const APARTMENT_TIERS: ApartmentTier[] = [
  { id: 'studio', name: 'Studio', w: 6, d: 6, price: 0 },
  { id: 'loft', name: 'Loft', w: 8, d: 7, price: 2500 },
  { id: 'penthouse', name: 'Penthouse', w: 10, d: 8, price: 8000 },
  { id: 'mansion', name: 'Mansion', w: 12, d: 10, price: 20000 },
  { id: 'beach-house', name: 'Beach House', w: 12, d: 12, price: 40000 },
]
export const TIER_BY_ID = new Map(APARTMENT_TIERS.map((t) => [t.id, t]))

export const FAME_TIERS = [
  { name: 'Nobody', min: 0 },
  { name: 'Local', min: 50 },
  { name: 'Rising', min: 200 },
  { name: 'Famous', min: 800 },
  { name: 'Celebrity', min: 2500 },
  { name: 'Icon', min: 8000 },
] as const

export function fameTier(fame: number): string {
  let name: string = FAME_TIERS[0].name
  for (const t of FAME_TIERS) if (fame >= t.min) name = t.name
  return name
}

export const FAME_POINTS = { follower: 5, like: 1, comment: 2, post: 3, promotion: 25, friend: 4 } as const

/* -------------------------------------------------------------------- time */

/** UTC day key, e.g. 2026-10-08. */
export function dayKey(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10)
}

/** ISO week key, e.g. 2026-W41. */
export function weekKey(ts: number): string {
  const d = new Date(ts)
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const day = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

/** Rent a Fit: share of the price you pay per rental length. */
export const RENT_RATES = { 1: 0.15, 3: 0.3, 7: 0.5 } as const
export type RentDays = keyof typeof RENT_RATES
export const RENT_MIN_PRICE = 200
export function rentPrice(price: number, days: RentDays): number {
  return Math.max(10, Math.ceil(price * RENT_RATES[days]))
}
