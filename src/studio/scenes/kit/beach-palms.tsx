import { useLayoutEffect } from 'react'
import { DoubleSide, MeshLambertMaterial } from 'three'
import type { V3 } from '../types'
import { mutate, Parts, useAnim, useBuilt } from './core'
import { addPalm, frondTexture } from './shapes'

export interface PalmSpec {
  p: V3
  height: number
  lean: number
  dir: number
  seed: number
}

/**
 * A grove of palms: merged ringed trunks (1 draw call) + merged textured fronds (1 draw call)
 * that sway in the wind via a tiny vertex-shader patch (tips move most).
 */
export function Palms({ palms, animate, sway = 0.05, tint = '#ffffff', frondColors }: { palms: PalmSpec[]; animate: boolean; sway?: number; tint?: string; frondColors?: string[] }) {
  const built = useBuilt(
    (track) => {
      const trunk = new Parts()
      const fronds = new Parts()
      for (const s of palms) addPalm(trunk, fronds, s.p, { height: s.height, lean: s.lean, dir: s.dir, seed: s.seed, frondColors })
      const map = track(frondTexture())
      const uni = { uTime: { value: 0 }, uSway: { value: sway } }
      const frondMat = track(new MeshLambertMaterial({ map, alphaTest: 0.45, side: DoubleSide, vertexColors: true }))
      frondMat.onBeforeCompile = (sh) => {
        sh.uniforms.uTime = uni.uTime
        sh.uniforms.uSway = uni.uSway
        sh.vertexShader =
          'uniform float uTime; uniform float uSway;\n' +
          sh.vertexShader.replace(
            '#include <begin_vertex>',
            `#include <begin_vertex>
            float kk = uv.y * uv.y;
            transformed.x += sin(uTime * 1.3 + position.x * 0.7 + position.z * 0.5) * uSway * kk;
            transformed.y += sin(uTime * 1.9 + position.z * 0.6 + position.x) * uSway * 0.6 * kk;
            transformed.z += cos(uTime * 1.1 + position.x * 0.4) * uSway * 0.7 * kk;`,
          )
      }
      frondMat.customProgramCacheKey = () => 'ds-palm-sway'
      return {
        trunkGeo: track(trunk.build()),
        frondGeo: track(fronds.build()),
        trunkMat: track(new MeshLambertMaterial({ vertexColors: true })),
        frondMat,
        uni,
      }
    },
    [palms, frondColors?.join()],
  )
  useLayoutEffect(() => {
    mutate(built, (b) => {
      b.uni.uSway.value = sway
      b.trunkMat.color.set(tint)
      b.frondMat.color.set(tint)
    })
  }, [built, sway, tint])
  useAnim(animate, (t) => {
    mutate(built, (b) => (b.uni.uTime.value = t))
  })
  return (
    <group>
      <mesh geometry={built.trunkGeo} material={built.trunkMat} />
      <mesh geometry={built.frondGeo} material={built.frondMat} />
    </group>
  )
}
