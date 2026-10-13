import { Suspense, useEffect, type JSX, type ReactNode } from 'react'
import { SCENE_BY_ID } from './defs'
import { components } from './loaders'
import type { SceneId, TimeOfDay, V3, Weather } from './types'

export interface SceneEnvironmentProps {
  id: SceneId
  time: TimeOfDay
  weather: Weather
  animate: boolean
  /** Optional PhotoSpot id: the scene moves its key/rim aim and contact shadow there. */
  spot?: string
  /** Called once the scene's code has loaded and it has committed (it renders on the next frame). */
  onReady?: () => void
  /** Shown (lit) while the scene's code loads, so the screen is never black. */
  fallback?: ReactNode
}

function Ready({ onReady }: { onReady?: () => void }) {
  useEffect(() => onReady?.(), [onReady])
  return null
}

/**
 * Renders a scene (background, fog, lights, environment map, props, weather) inside an existing
 * R3F <Canvas>. Unsupported time/weather values fall back to the scene's defaults.
 */
export function SceneEnvironment({ id, time, weather, animate, spot, onReady, fallback = null }: SceneEnvironmentProps): JSX.Element {
  const def = SCENE_BY_ID[id] ?? SCENE_BY_ID.prom2016
  const t = def.times.includes(time) ? time : def.defaultTime
  const w = def.weathers.includes(weather) ? weather : def.defaultWeather
  const s = def.photoSpots.find((p) => p.id === spot) ?? def.photoSpots[0]
  const pos: V3 = s ? s.position : [0, 0, 0]
  const Scene = components[def.id]
  return (
    <Suspense key={def.id} fallback={fallback}>
      <Scene time={t} weather={w} animate={animate} spot={pos} />
      <Ready onReady={onReady} />
    </Suspense>
  )
}
