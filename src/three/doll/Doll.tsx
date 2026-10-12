import { useFrame } from '@react-three/fiber'
import { Suspense, useRef } from 'react'
import type { Group } from 'three'
import type { Appearance } from '../../shared/types'
import { ErrorBoundary } from '../ErrorBoundary'
import { useModelManifest } from '../models'
import { GlbDoll } from './GlbDoll'
import { PlaceholderDoll } from './PlaceholderDoll'

interface DollProps {
  appearance: Appearance
  /** Subtle idle breathing. Off for reduced motion. */
  animate?: boolean
  /** Per-doll offset so a crowd does not bob in sync. */
  phase?: number
  /** Show the body without clothes (tattoo and body editing). */
  undress?: boolean
  shadow?: boolean
}

/**
 * The single doll component used everywhere. Uses the starter's GLB when one
 * has been dropped into public/models/starters, otherwise the procedural doll.
 */
export function Doll({ appearance, animate = true, phase = 0, undress = false, shadow = true }: DollProps) {
  const bob = useRef<Group>(null)
  const manifest = useModelManifest()
  const glbUrl = manifest?.starters[appearance.starterId]

  useFrame(({ clock }) => {
    if (!bob.current || glbUrl) return
    const t = clock.elapsedTime * 1.6 + phase
    bob.current.position.y = animate ? Math.sin(t) * 0.006 + 0.006 : 0
    bob.current.scale.x = animate ? 1 + Math.sin(t) * 0.004 : 1
  })

  const placeholder = <PlaceholderDoll appearance={appearance} undress={undress} />

  return (
    <group scale={glbUrl ? 1 : appearance.body.height}>
      <group ref={bob}>
        {glbUrl && manifest ? (
          <ErrorBoundary fallback={placeholder} resetKey={glbUrl}>
            <Suspense fallback={placeholder}>
              <GlbDoll appearance={appearance} manifest={manifest} url={glbUrl} />
            </Suspense>
          </ErrorBoundary>
        ) : (
          placeholder
        )}
      </group>
      {shadow && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]}>
          <circleGeometry args={[0.24, 28]} />
          <meshBasicMaterial color="#1E0B26" transparent opacity={0.16} depthWrite={false} />
        </mesh>
      )}
    </group>
  )
}
