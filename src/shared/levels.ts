import type { ProgressDoc } from './types'

/** XP needed to reach each level (index 0 = level 1). Every Glam you earn is 1 XP. */
export const LEVEL_XP = [0, 150, 400, 800, 1400, 2200, 3200, 4500, 6000, 8000, 10500, 13500]

/** Dates and parties open up here. */
export const SOCIAL_UNLOCK_LEVEL = 3

export interface LevelInfo {
  level: number
  xp: number
  /** XP at the start of this level and at the next one (null at max level). */
  floor: number
  next: number | null
  /** 0..1 through the current level. */
  progress: number
}

export function levelOf(xp: number): LevelInfo {
  let i = 0
  while (i + 1 < LEVEL_XP.length && xp >= LEVEL_XP[i + 1]) i++
  const floor = LEVEL_XP[i]
  const next = LEVEL_XP[i + 1] ?? null
  return { level: i + 1, xp, floor, next, progress: next === null ? 1 : (xp - floor) / (next - floor) }
}

export const xpOf = (p: Pick<ProgressDoc, 'xp'> | null | undefined): number => p?.xp ?? 0

/** What each level up brings: Glam, free pieces for your wardrobe, and new things to do. */
export interface LevelReward {
  level: number
  glam: number
  items: string[]
  features: string[]
}

const LEVEL_ITEMS: Record<number, string[]> = {
  2: ['go-bonkers-cap-0-solid', 'versassy-chain-0-solid'],
  3: ['booty-robe-0-solid'],
  4: ['balensheega-sneakers-0-solid'],
  5: ['meirre-chen-clutch-0-solid', 'meirre-chen-belt-0-solid'],
  6: ['lui-vutan-tote-0-monogram'],
  7: ['christian-lubutan-heels-0-solid'],
  8: ['dyorr-gown-0-solid'],
  9: ['cashluxe-chain-0-solid'],
  10: ['hermeez-clutch-0-solid'],
  11: ['of-whyte-sneakers-0-solid'],
  12: ['versassy-gown-0-sequin'],
}

/** Decor and crib features that unlock with level (checked when you buy or save). */
export const BALCONY_LEVEL = 4
const LEVEL_FEATURES: Record<number, string[]> = {
  2: ['Posters, neon signs & wine racks in Decor'],
  [SOCIAL_UNLOCK_LEVEL]: ['Dates & parties in DollScene'],
  [BALCONY_LEVEL]: ['A balcony for your crib'],
  5: ['Chandeliers in Decor'],
  6: ['Aquariums & fish'],
  8: ['Bigger cribs to move into'],
}

export function levelReward(level: number): LevelReward {
  return { level, glam: 100 * level, items: LEVEL_ITEMS[level] ?? [], features: LEVEL_FEATURES[level] ?? [] }
}

/** Every reward between the last one collected and the current level. */
export function pendingLevelRewards(p: Pick<ProgressDoc, 'xp' | 'levelRewarded'> | null | undefined): LevelReward[] {
  if (!p) return []
  const now = levelOf(p.xp ?? 0).level
  const out: LevelReward[] = []
  for (let l = (p.levelRewarded ?? 1) + 1; l <= now; l++) out.push(levelReward(l))
  return out
}
