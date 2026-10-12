import { useMemo } from 'react'
import { useSession } from '../store/useSession'

/** Everything you can wear right now: bought pieces plus Rent a Fit pieces that haven't expired. */
export function useOwned(): Record<string, number> {
  const items = useSession((s) => s.inventory?.items)
  const rentals = useSession((s) => s.inventory?.rentals)
  return useMemo(() => {
    const now = Date.now()
    const out: Record<string, number> = { ...(items ?? {}) }
    for (const [id, until] of Object.entries(rentals ?? {})) if (until > now && !out[id]) out[id] = 1
    return out
  }, [items, rentals])
}
