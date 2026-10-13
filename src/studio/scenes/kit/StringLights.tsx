import { useMemo } from 'react'
import { BufferGeometry, Float32BufferAttribute, LineBasicMaterial, MeshBasicMaterial, SphereGeometry } from 'three'
import type { V3 } from '../types'
import { catenary, useBuilt } from './core'
import { GlowPoints, type GlowMode, type GlowPoint } from './Glow'
import { Instanced, type Inst } from './Instanced'

export interface Span {
  a: V3
  b: V3
  sag: number
  bulbs: number
}

/**
 * Festoon lights: sagging wires, tiny bulbs (instanced) and their glow (points). 3 draw calls
 * for any number of strands.
 */
export function StringLights({
  spans,
  color = '#ffcf8a',
  wire = '#2a2420',
  glow = 0.22,
  intensity = 1,
  animate,
  mode = 'twinkle',
  mirrorY,
}: {
  spans: Span[]
  color?: string | string[]
  wire?: string
  glow?: number
  intensity?: number
  animate: boolean
  mode?: GlowMode
  mirrorY?: number
}) {
  const colors = Array.isArray(color) ? color : [color]
  const key = colors.join()
  const { wires, bulbs, glows } = useMemo(() => {
    const segs: number[] = []
    const bulbs: Inst[] = []
    const glows: GlowPoint[] = []
    let k = 0
    for (const s of spans) {
      const pts = catenary(s.a, s.b, s.sag, Math.max(8, s.bulbs * 2))
      for (let i = 0; i < pts.length - 1; i++) segs.push(...pts[i], ...pts[i + 1])
      const bp = catenary(s.a, s.b, s.sag, s.bulbs + 1).slice(1, -1)
      for (const p of bp) {
        const c = colors[k++ % colors.length]
        const q: V3 = [p[0], p[1] - 0.05, p[2]]
        bulbs.push({ p: q, c })
        glows.push({ p: q, c, s: glow, ph: (k * 0.37) % 1 })
      }
    }
    return { wires: segs, bulbs, glows }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spans, key, glow])
  const res = useBuilt(
    (track) => {
      const g = track(new BufferGeometry())
      g.setAttribute('position', new Float32BufferAttribute(wires, 3))
      return {
        lineGeo: g,
        lineMat: track(new LineBasicMaterial({ color: wire })),
        bulbGeo: track(new SphereGeometry(0.028, 8, 6)),
        bulbMat: track(new MeshBasicMaterial({ color: '#ffffff', toneMapped: false, depthWrite: false })),
      }
    },
    [wires, wire],
  )
  return (
    <group>
      <lineSegments geometry={res.lineGeo} material={res.lineMat} />
      <Instanced geometry={res.bulbGeo} material={res.bulbMat} items={bulbs} />
      <GlowPoints points={glows} mode={mode} intensity={intensity} animate={animate} mirrorY={mirrorY} />
    </group>
  )
}
