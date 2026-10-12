import { dayKey, weekKey } from './economy'
import type { Aesthetic } from './types'

export interface ChallengeDef {
  id: string
  title: string
  prompt: string
  aesthetic: Aesthetic
}

/** Themes rotate by day and by week. Keys look like `daily:2026-10-09:afrobeats` so entries are grouped per run. */
export const DAILY_THEMES: ChallengeDef[] = [
  { id: 'detty-december', title: 'Detty December', prompt: 'Your look for the biggest night of the Lagos calendar.', aesthetic: 'nightlife' },
  { id: 'clean-girl-monday', title: 'Clean Girl Monday', prompt: 'Effortless, minimal, expensive-looking.', aesthetic: 'minimal' },
  { id: 'owambe-ready', title: 'Owambe Ready', prompt: 'Gele, aso-oke or your modern take on party wear.', aesthetic: 'owambe' },
  { id: 'y2k-mall-rat', title: 'Y2K Mall Rat', prompt: 'Baby tees, low rise, tiny shades.', aesthetic: 'y2k' },
  { id: 'goth-brunch', title: 'Goth Brunch', prompt: 'Dark florals at noon.', aesthetic: 'goth' },
  { id: 'yaba-streets', title: 'Yaba Streets', prompt: 'Cargos, graphic tees and a fit that moves.', aesthetic: 'streetwear' },
  { id: 'editorial-moment', title: 'Editorial Moment', prompt: 'Dress for the magazine cover.', aesthetic: 'editorial' },
]

export const WEEKLY_THEMES: ChallengeDef[] = [
  { id: 'lagos-fashion-week', title: 'Lagos Fashion Week', prompt: 'Front row or runway: show us the look.', aesthetic: 'editorial' },
  { id: 'soft-life-sunday', title: 'Soft Life Sunday', prompt: 'Rest, but make it couture.', aesthetic: 'soft-glam' },
  { id: 'after-dark', title: 'After Dark', prompt: 'The Strip at 2am.', aesthetic: 'nightlife' },
  { id: 'kawaii-chaos', title: 'Kawaii Chaos', prompt: 'Cute with a bite.', aesthetic: 'kawaii' },
]

export const CHALLENGE_REWARDS = { enter: 40, vote: 2, prize: [500, 300, 150] } as const
export const VOTES_PER_DAY = 30

const pick = <T,>(xs: T[], key: string) => xs[[...key].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % xs.length]

export interface ChallengeRun extends ChallengeDef {
  key: string
  period: 'daily' | 'weekly'
  endsAt: number
}

export function currentChallenges(now: number): ChallengeRun[] {
  const d = dayKey(now)
  const w = weekKey(now)
  const daily = pick(DAILY_THEMES, d)
  const weekly = pick(WEEKLY_THEMES, w)
  const endOfDay = Date.parse(`${d}T00:00:00Z`) + 86400000
  const dow = new Date(now).getUTCDay() || 7
  const endOfWeek = Date.parse(`${d}T00:00:00Z`) + (8 - dow) * 86400000
  return [
    { ...daily, key: `daily:${d}:${daily.id}`, period: 'daily', endsAt: endOfDay },
    { ...weekly, key: `weekly:${w}:${weekly.id}`, period: 'weekly', endsAt: endOfWeek },
  ]
}

/** Whether a challenge key belongs to a run that has finished. */
export function challengeEnded(key: string, now: number): boolean {
  return !currentChallenges(now).some((c) => c.key === key)
}

export function challengeTitle(key: string): string {
  const id = key.split(':')[2]
  return [...DAILY_THEMES, ...WEEKLY_THEMES].find((t) => t.id === id)?.title ?? 'Challenge'
}
