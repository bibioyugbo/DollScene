import type { SpotId } from '../../shared/studio/look'
import { useStudio } from '../state/store'

/**
 * "Tap the pimple first": the face zooms in, every pimple gets a pulsing ring, and the routine
 * starts on the one the player taps (null: they cancelled).
 */
let resolver: ((id: SpotId | null) => void) | null = null

export function pickSpot(ids: SpotId[], hint: string): Promise<SpotId | null> {
  resolver?.(null)
  return new Promise((resolve) => {
    resolver = resolve
    useStudio.setState({ spotPick: { ids, hint } })
    useStudio.getState().setFraming('face')
  })
}

export function resolveSpot(id: SpotId | null) {
  useStudio.setState({ spotPick: null })
  const r = resolver
  resolver = null
  r?.(id)
}
