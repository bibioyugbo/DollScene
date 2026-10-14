import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import type { Group } from 'three'
import type { SpotId } from '../../shared/studio/look'
import { getCharacter, landmark } from '../actions/engine'
import { useStudio } from '../state/store'
import { resolveSpot } from '../ui/spotPick'
import { click, haptic } from '../ui/sound'

/** A pulsing ring on one spot of her face, following it as she moves; tap it to pick it. */
function Marker({ id }: { id: SpotId }) {
  const g = useRef<Group>(null)
  useFrame(() => {
    const c = getCharacter()
    const p = c && landmark(c, `spot:${id}`)
    if (p && g.current) g.current.position.copy(g.current.parent!.worldToLocal(p.clone()))
  })
  return (
    <group ref={g}>
      <Html center zIndexRange={[30, 0]}>
        <button
          type="button"
          aria-label="Squeeze this pimple"
          onClick={() => {
            click('select')
            haptic(12)
            resolveSpot(id)
          }}
          className="ds-spot grid h-11 w-11 place-items-center rounded-full"
        >
          <span className="h-5 w-5 rounded-full border-2 border-white shadow-[0_0_0_3px_rgb(255_79_163/0.85),0_0_14px_4px_rgb(255_255_255/0.6)]" />
        </button>
      </Html>
    </group>
  )
}

/** Rings on every spot the player can pick (see ui/spotPick.ts). */
export function SpotMarkers() {
  const pick = useStudio((s) => s.spotPick)
  if (!pick) return null
  return (
    <group>
      {pick.ids.map((id) => (
        <Marker key={id} id={id} />
      ))}
    </group>
  )
}
