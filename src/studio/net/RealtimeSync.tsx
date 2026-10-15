import { useEffect } from 'react'
import { channelOf } from '../rooms'
import { SCENE_BY_ID, type SceneId } from '../scenes'
import { useStudio } from '../state/store'
import { realtime, useRealtime } from './realtime'

/** Where the player is going in a scene: the spot they stand on, facing, pose, expression, activity. */
export const myActivity = { act: '' }

/**
 * Keeps the realtime connection in step with the game: connects once the player has named their
 * doll and confirmed they're 18+, follows them from the Hub into rooms and scenes (headcounts), and
 * at a scene sends their position, pose and expression (and their look when it changes).
 */
export function RealtimeSync() {
  const onboarded = useStudio((s) => s.look.profile.onboarded)
  const phase = useStudio((s) => s.phase)
  const room = useStudio((s) => s.room)
  const scene = useStudio((s) => s.look.scene.id)
  const name = useStudio((s) => s.look.profile.name)
  const live = onboarded && phase !== 'boot' && phase !== 'onboard'
  const channel = channelOf(room, phase, scene)

  useEffect(() => {
    if (!live) return
    realtime.start(useStudio.getState().look.profile.name || 'Doll', useStudio.getState().look, channel)
    // connect once; channel changes are joins
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live])

  useEffect(() => {
    if (live) realtime.join(channel)
  }, [live, channel])

  // the doll others see: sent when it changes (debounced)
  useEffect(() => {
    if (!live) return
    let t = 0
    const unsub = useStudio.subscribe((s, p) => {
      if (s.look === p.look) return
      window.clearTimeout(t)
      t = window.setTimeout(() => realtime.look(useStudio.getState().look.profile.name || name || 'Doll', useStudio.getState().look), 1500)
    })
    return () => {
      unsub()
      window.clearTimeout(t)
    }
  }, [live, name])

  // at a scene: where I stand and what I'm doing, 5 times a second when it changes
  useEffect(() => {
    if (!live || phase !== 'event') return
    let last = ''
    const t = window.setInterval(() => {
      const s = useStudio.getState()
      if (useRealtime.getState().status !== 'live') return
      const def = SCENE_BY_ID[s.look.scene.id as SceneId]
      const spot = def?.photoSpots.find((p) => p.id === s.look.scene.spot) ?? def?.photoSpots[0]
      const st = { x: spot?.position[0] ?? 0, z: spot?.position[2] ?? 0, ry: spot?.rotationY ?? 0, pose: s.photo.pose, expr: s.photo.expression, act: myActivity.act }
      const key = JSON.stringify(st)
      if (key === last) return
      last = key
      realtime.state(st)
    }, 200)
    return () => window.clearInterval(t)
  }, [live, phase])

  return null
}
