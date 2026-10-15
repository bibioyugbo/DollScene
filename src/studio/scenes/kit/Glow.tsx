import { useFrame } from '@react-three/fiber'
import { useLayoutEffect } from 'react'
import { AdditiveBlending, BufferGeometry, Color, Float32BufferAttribute, ShaderMaterial, type PerspectiveCamera } from 'three'
import type { V3 } from '../types'
import { mutate, pointScale, useAnim, useBuilt } from './core'

export interface GlowPoint {
  p: V3
  c: string
  /** Diameter in metres. */
  s: number
  /** 0..1 random phase for twinkle/flicker/flash. */
  ph?: number
}

export type GlowMode = 'steady' | 'twinkle' | 'flicker' | 'flash' | 'chase'

const vert = /* glsl */ `
attribute float size; attribute float phase; attribute vec3 color;
uniform float uTime, uScale, uMode, uIntensity, uMirror;
varying vec3 vColor; varying float vA;
float h11(float p){ p = fract(p * .1031); p *= p + 33.33; p *= p + p; return fract(p); }
void main(){
  vec3 pos = position;
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  float f = 1.0;
  if (uMode == 1.0) f = 0.72 + 0.28 * sin(uTime * (1.5 + phase * 2.5) + phase * 40.0);
  else if (uMode == 2.0) f = 0.78 + 0.22 * sin(uTime * 11.0 + phase * 31.0) * sin(uTime * 6.7 + phase * 17.0) + 0.06 * sin(uTime * 23.0 + phase * 9.0);
  else if (uMode == 3.0) { float k = uTime * 1.6 + phase * 13.0; float e = floor(k); float on = step(0.82, h11(e + phase * 97.0)); f = on * exp(-fract(k) * 22.0); }
  else if (uMode == 4.0) f = 0.35 + 0.65 * pow(0.5 + 0.5 * sin(uTime * 4.0 - phase * 6.2832 * 6.0), 4.0);
  vA = f * uIntensity;
  vColor = color;
  gl_PointSize = min(size * uScale / max(-mv.z, 0.1), 384.0);
  gl_Position = projectionMatrix * mv;
}`

const frag = /* glsl */ `
varying vec3 vColor; varying float vA;
void main(){
  vec2 d = gl_PointCoord - 0.5;
  float r = length(d) * 2.0;
  if (r > 1.0 || vA < 0.002) discard;
  float a = exp(-r * r * 6.0) * 0.75 + exp(-r * r * 60.0) * 0.9;
  vec3 c = vColor + vec3(1.0) * exp(-r * r * 90.0) * 0.6;
  gl_FragColor = vec4(c, a * vA);
  #include <colorspace_fragment>
}`

const MODES: Record<GlowMode, number> = { steady: 0, twinkle: 1, flicker: 2, flash: 3, chase: 4 }

/**
 * Many soft additive glows in ONE draw call: bulbs, candle flames, camera flashes, windows.
 * `mirrorY` adds a faint reflected copy under a glossy floor at that height.
 */
export function GlowPoints({
  points,
  mode = 'steady',
  intensity = 1,
  animate,
  mirrorY,
  mirrorStrength = 0.35,
}: {
  points: GlowPoint[]
  mode?: GlowMode
  intensity?: number
  animate: boolean
  mirrorY?: number
  mirrorStrength?: number
}) {
  const { geo, mat } = useBuilt(
    (track) => {
      const list = mirrorY === undefined ? points : [...points, ...points.map((g) => ({ ...g, p: [g.p[0], 2 * mirrorY - g.p[1], g.p[2]] as V3, s: g.s * 0.9, mirror: true }))]
      const n = list.length
      const pos = new Float32Array(n * 3)
      const col = new Float32Array(n * 3)
      const size = new Float32Array(n)
      const phase = new Float32Array(n)
      const c = new Color()
      list.forEach((g, i) => {
        pos.set(g.p, i * 3)
        c.set(g.c)
        const k = 'mirror' in g ? mirrorStrength : 1
        col.set([c.r * k, c.g * k, c.b * k], i * 3)
        size[i] = g.s
        phase[i] = g.ph ?? (i * 0.6180339) % 1
      })
      const geo = track(new BufferGeometry())
      geo.setAttribute('position', new Float32BufferAttribute(pos, 3))
      geo.setAttribute('color', new Float32BufferAttribute(col, 3))
      geo.setAttribute('size', new Float32BufferAttribute(size, 1))
      geo.setAttribute('phase', new Float32BufferAttribute(phase, 1))
      geo.computeBoundingSphere()
      const mat = track(
        new ShaderMaterial({
          vertexShader: vert,
          fragmentShader: frag,
          transparent: true,
          depthWrite: false,
          blending: AdditiveBlending,
          toneMapped: false,
          uniforms: { uTime: { value: 0 }, uScale: { value: 500 }, uMode: { value: 0 }, uIntensity: { value: 1 }, uMirror: { value: 0 } },
        }),
      )
      return { geo, mat }
    },
    [points, mirrorY, mirrorStrength],
  )
  useLayoutEffect(() => {
    mutate(mat, (m) => {
      m.uniforms.uMode.value = MODES[mode]
      m.uniforms.uIntensity.value = intensity
    })
  }, [mat, mode, intensity])
  useFrame((s) => mutate(mat, (m) => (m.uniforms.uScale.value = pointScale({ size: s.size, viewport: s.viewport, camera: s.camera as PerspectiveCamera }))))
  useAnim(animate, (t) => mutate(mat, (m) => (m.uniforms.uTime.value = t)))
  return <points geometry={geo} material={mat} renderOrder={5} frustumCulled={false} />
}
