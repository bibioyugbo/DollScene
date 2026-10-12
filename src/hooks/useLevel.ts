import { levelOf, SOCIAL_UNLOCK_LEVEL, type LevelInfo } from '../shared/levels'
import { useSession } from '../store/useSession'

/** Your level, XP progress, and whether dates and parties are open yet. */
export function useLevel(): LevelInfo & { social: boolean } {
  const xp = useSession((s) => s.progress?.xp ?? 0)
  const info = levelOf(xp)
  return { ...info, social: info.level >= SOCIAL_UNLOCK_LEVEL }
}
