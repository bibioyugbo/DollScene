import { dayKey, weekKey } from './economy'
import type { ProgressDoc } from './types'

export type GameEvent =
  | 'shift'
  | 'purchase'
  | 'place'
  | 'message'
  | 'challenge'
  | 'vote'
  | 'unpack'
  | 'outing'
  | 'party'
  | 'post'
  | 'like'
  | 'friend'
  | 'wear'
  | 'customize'
  | 'visit'
  | 'earn'
  | 'play-day'

export interface MissionDef {
  id: string
  title: string
  event: GameEvent
  target: number
  reward: number
}

export const DAILY_MISSIONS: MissionDef[] = [
  { id: 'd-shift-1', title: 'Clock in for one shift', event: 'shift', target: 1, reward: 40 },
  { id: 'd-shift-3', title: 'Work three shifts', event: 'shift', target: 3, reward: 90 },
  { id: 'd-buy', title: 'Buy something new', event: 'purchase', target: 1, reward: 30 },
  { id: 'd-message', title: 'Send three messages', event: 'message', target: 3, reward: 25 },
  { id: 'd-like', title: 'Like two posts', event: 'like', target: 2, reward: 20 },
  { id: 'd-vote', title: 'Vote on five challenge looks', event: 'vote', target: 5, reward: 25 },
]

export const WEEKLY_MISSIONS: MissionDef[] = [
  { id: 'w-days', title: 'Play on four days', event: 'play-day', target: 4, reward: 250 },
  { id: 'w-shifts', title: 'Work twelve shifts', event: 'shift', target: 12, reward: 300 },
  { id: 'w-post', title: 'Post three looks', event: 'post', target: 3, reward: 150 },
  { id: 'w-challenge', title: 'Enter three fashion challenges', event: 'challenge', target: 3, reward: 200 },
  { id: 'w-friend', title: 'Make a new friend', event: 'friend', target: 1, reward: 120 },
  { id: 'w-earn', title: 'Earn 1,000 Glam', event: 'earn', target: 1000, reward: 200 },
]

/** One-time onboarding objectives. "Fill your space" guides the first session. */
export const OBJECTIVES: MissionDef[] = [
  { id: 'o-move-in', title: 'Unpack your load from the truck', event: 'unpack', target: 7, reward: 100 },
  { id: 'o-fill-space', title: 'Fill your space: place 5 pieces', event: 'place', target: 5, reward: 150 },
  { id: 'o-first-date', title: 'Go on a date in DollScene', event: 'outing', target: 1, reward: 80 },
  { id: 'o-first-shift', title: 'Work your first shift', event: 'shift', target: 1, reward: 60 },
  { id: 'o-first-look', title: 'Buy and wear a new piece', event: 'wear', target: 1, reward: 80 },
  { id: 'o-first-friend', title: 'Make your first friend', event: 'friend', target: 1, reward: 100 },
  { id: 'o-challenge', title: 'Enter a fashion challenge', event: 'challenge', target: 1, reward: 80 },
]

export const ALL_MISSIONS = [...DAILY_MISSIONS, ...WEEKLY_MISSIONS, ...OBJECTIVES]
export const MISSION_BY_ID = new Map(ALL_MISSIONS.map((m) => [m.id, m]))

/** Roll the daily and weekly windows forward when the period changed. */
export function rollPeriods(p: ProgressDoc, now: number): void {
  const d = dayKey(now)
  const w = weekKey(now)
  if (p.daily.key !== d) p.daily = { key: d, counts: {}, claimed: [] }
  if (p.weekly.key !== w) p.weekly = { key: w, counts: {}, claimed: [] }
}

/**
 * Apply an event to mission counters. Objectives count lifetime totals,
 * except "place" which the caller sets as an absolute value.
 */
export function applyEvent(p: ProgressDoc, event: GameEvent, n: number, now: number, absolute = false): void {
  rollPeriods(p, now)
  if (!absolute) {
    p.daily.counts[event] = (p.daily.counts[event] ?? 0) + n
    p.weekly.counts[event] = (p.weekly.counts[event] ?? 0) + n
  }
  p.counters[event] = absolute ? Math.max(p.counters[event] ?? 0, n) : (p.counters[event] ?? 0) + n
  for (const o of OBJECTIVES) {
    if (o.event === event && !p.objectives[o.id] && (p.counters[event] ?? 0) >= o.target) p.objectives[o.id] = 'done'
  }
}

export type MissionStatus = 'progress' | 'ready' | 'claimed'

export function missionState(p: ProgressDoc, m: MissionDef, now: number): { count: number; status: MissionStatus } {
  if (OBJECTIVES.includes(m)) {
    const st = p.objectives[m.id]
    const count = Math.min(m.target, p.counters[m.event] ?? 0)
    return { count: st ? m.target : count, status: st === 'claimed' ? 'claimed' : st === 'done' ? 'ready' : 'progress' }
  }
  const daily = DAILY_MISSIONS.includes(m)
  const period = daily ? p.daily : p.weekly
  const currentKey = daily ? dayKey(now) : weekKey(now)
  const counts = period.key === currentKey ? period.counts : {}
  const claimed = period.key === currentKey ? period.claimed : []
  const count = Math.min(m.target, counts[m.event] ?? 0)
  if (claimed.includes(m.id)) return { count, status: 'claimed' }
  return { count, status: count >= m.target ? 'ready' : 'progress' }
}
