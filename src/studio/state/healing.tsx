import { useEffect } from 'react'
import type { SpotId, SpotState } from '../../shared/studio/look'
import { fx } from './fx'
import { useStudio } from './store'

/**
 * Skin heals on its own clock: a popped pimple leaves a small red mark that fades away, a spot a
 * patch drew out (flat) fades a little slower, a treated or drained one settles. The fade plays in
 * the skin shader (fx.skin.heal), then the spot leaves the saved look, so the result persists.
 */
const HEAL_S: Partial<Record<SpotState, number>> = { popped: 7, flat: 10, treated: 8 }

export function SkinHealer() {
  useEffect(() => {
    const started = new Map<SpotId, { state: SpotState; at: number }>()
    const tick = window.setInterval(() => {
      const s = useStudio.getState()
      if (s.phase === 'boot' || s.phase === 'onboard') return
      const spots = s.look.care.spots
      const now = performance.now()
      const done: SpotId[] = []
      for (const [id, st] of Object.entries(spots) as [SpotId, SpotState][]) {
        const dur = HEAL_S[st]
        if (!dur || s.look.care.patches.includes(id)) {
          started.delete(id)
          fx.skin.heal[id] = 0
          continue
        }
        const e = started.get(id)
        if (!e || e.state !== st) {
          started.set(id, { state: st, at: now })
          continue
        }
        const k = Math.min(1, (now - e.at) / 1000 / dur)
        fx.skin.heal[id] = k * k
        if (k >= 1) done.push(id)
      }
      for (const id of [...started.keys()]) if (!spots[id]) started.delete(id)
      if (done.length) {
        // healing isn't an edit the player made: it updates the look without an undo step
        const look = structuredClone(s.look)
        for (const id of done) {
          delete look.care.spots[id]
          fx.skin.heal[id] = 0
          started.delete(id)
        }
        useStudio.setState({ look })
      }
    }, 120)
    return () => window.clearInterval(tick)
  }, [])
  return null
}
