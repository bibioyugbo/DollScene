import { useLayoutEffect, useRef } from 'react'
import { Color, type BufferGeometry, type ColorRepresentation, type InstancedMesh, type Material } from 'three'
import type { V3 } from '../types'
import { compose } from './core'

export interface Inst {
  p: V3
  r?: V3 | number
  s?: V3 | number
  c?: ColorRepresentation
}

/** One draw call for many copies of a prototype (chairs, seats, balloons, pickets, pumpkins…). */
export function Instanced({ geometry, material, items, renderOrder }: { geometry: BufferGeometry; material: Material; items: Inst[]; renderOrder?: number }) {
  const ref = useRef<InstancedMesh>(null)
  useLayoutEffect(() => {
    const m = ref.current
    if (!m) return
    const c = new Color()
    items.forEach((it, i) => {
      m.setMatrixAt(i, compose(it.p, typeof it.r === 'number' ? [0, it.r, 0] : (it.r ?? [0, 0, 0]), it.s ?? 1))
      if (it.c !== undefined) m.setColorAt(i, c.set(it.c))
    })
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
    m.computeBoundingSphere()
  }, [items, geometry, material])
  return <instancedMesh ref={ref} args={[geometry, material, items.length]} renderOrder={renderOrder} />
}
