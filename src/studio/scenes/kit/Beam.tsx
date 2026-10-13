import { useLayoutEffect, useRef } from 'react'
import type { InstancedMesh } from 'three'
import type { V3 } from '../types'
import { beamGeometry, beamMaterial, beamMatrix } from './beams'
import { mutate, useBuilt } from './core'

/** A soft volumetric-looking light shaft (spotlight cone, projector beam, searchlight). */
export function Beam({ from, to, radius, color, opacity = 0.18, falloff = 1.2, soft = 1.6 }: { from: V3; to: V3; radius: number; color: string; opacity?: number; falloff?: number; soft?: number }) {
  const { geo, mat } = useBuilt((track) => ({ geo: track(beamGeometry()), mat: track(beamMaterial(color, opacity, falloff, soft)) }), [])
  const ref = useRef<InstancedMesh>(null)
  useLayoutEffect(() => {
    mutate(mat.uniforms, (u) => {
      u.uColor.value.set(color)
      u.uOpacity.value = opacity
      u.uFalloff.value = falloff
      u.uSoft.value = soft
    })
    const m = ref.current
    if (!m) return
    m.setMatrixAt(0, beamMatrix(from, to, radius))
    m.instanceMatrix.needsUpdate = true
    m.computeBoundingSphere()
  })
  return <instancedMesh ref={ref} args={[geo, mat, 1]} renderOrder={7} />
}
