import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useRef } from 'react'
import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  DoubleSide,
  Euler,
  Float32BufferAttribute,
  InstancedMesh,
  Matrix4,
  MeshLambertMaterial,
  NormalBlending,
  PlaneGeometry,
  Quaternion,
  ShaderMaterial,
  Vector3,
  type PerspectiveCamera,
  type Texture,
} from 'three'
import type { V3 } from '../types'
import { GLSL_NOISE, mutate, pick, pointScale, range, rng, useAnim, useBuilt } from './core'
import { leafTexture } from './shapes'

/* ------------------------------------------------------------------ rain & snow (GPU-animated points) */

const precipVert = /* glsl */ `
attribute float seed;
uniform float uTime, uScale, uSpeed, uHeight, uSize, uSway, uWind;
uniform vec3 uCenter;
varying float vA;
void main(){
  vec3 p = position;
  float y = mod(p.y - uTime * uSpeed * (0.8 + seed * 0.4), uHeight);
  p.y = y;
  p.x += sin(uTime * 0.9 + seed * 40.0) * uSway + uWind * (uHeight - y) * 0.15;
  p.z += cos(uTime * 0.7 + seed * 30.0) * uSway;
  p += uCenter;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vA = smoothstep(0.0, 1.0, y) * smoothstep(uHeight, uHeight - 1.5, y);
  gl_PointSize = clamp(uSize * uScale / max(-mv.z, 0.2), 1.0, 96.0);
  gl_Position = projectionMatrix * mv;
}`

const rainFrag = /* glsl */ `
uniform vec3 uColor; uniform float uOpacity; varying float vA;
void main(){
  vec2 d = gl_PointCoord - 0.5;
  float a = smoothstep(0.045, 0.0, abs(d.x + d.y * 0.08)) * smoothstep(0.5, 0.1, abs(d.y));
  if (a < 0.01) discard;
  gl_FragColor = vec4(uColor, a * uOpacity * vA);
  #include <colorspace_fragment>
}`

const snowFrag = /* glsl */ `
uniform vec3 uColor; uniform float uOpacity; varying float vA;
void main(){
  float r = length(gl_PointCoord - 0.5) * 2.0;
  float a = smoothstep(1.0, 0.25, r);
  if (a < 0.01) discard;
  gl_FragColor = vec4(uColor, a * uOpacity * vA);
  #include <colorspace_fragment>
}`

interface PrecipProps {
  animate: boolean
  center?: V3
  /** Half-size of the box on x/z around center. */
  radius?: number
  height?: number
  count?: number
  color?: string
  opacity?: number
  wind?: number
}

function usePrecip(kind: 'rain' | 'snow', { center = [0, 0, 0], radius = 9, height = 8, count, color, opacity, wind = 0 }: PrecipProps) {
  const n = count ?? (kind === 'rain' ? 2600 : 1600)
  const built = useBuilt(
    (track) => {
      const r = rng(kind === 'rain' ? 11 : 23)
      const pos = new Float32Array(n * 3)
      const seed = new Float32Array(n)
      for (let i = 0; i < n; i++) {
        // denser near the camera side so drops read against the subject
        const a = r() * Math.PI * 2
        const d = Math.sqrt(r()) * radius
        pos[i * 3] = Math.cos(a) * d
        pos[i * 3 + 1] = r() * height
        pos[i * 3 + 2] = Math.sin(a) * d + radius * 0.25
        seed[i] = r()
      }
      const geo = track(new BufferGeometry())
      geo.setAttribute('position', new Float32BufferAttribute(pos, 3))
      geo.setAttribute('seed', new Float32BufferAttribute(seed, 1))
      const mat = track(
        new ShaderMaterial({
          vertexShader: precipVert,
          fragmentShader: kind === 'rain' ? rainFrag : snowFrag,
          transparent: true,
          depthWrite: false,
          blending: kind === 'rain' ? NormalBlending : NormalBlending,
          toneMapped: false,
          uniforms: {
            uTime: { value: 0 },
            uScale: { value: 500 },
            uSpeed: { value: kind === 'rain' ? 7.5 : 0.55 },
            uHeight: { value: height },
            uSize: { value: kind === 'rain' ? 0.32 : 0.05 },
            uSway: { value: kind === 'rain' ? 0.0 : 0.35 },
            uWind: { value: wind },
            uCenter: { value: new Vector3(...center) },
            uColor: { value: new Color(color ?? (kind === 'rain' ? '#c9d6e8' : '#ffffff')) },
            uOpacity: { value: opacity ?? (kind === 'rain' ? 0.42 : 0.9) },
          },
        }),
      )
      return { geo, mat }
    },
    [kind, n, radius, height, color, opacity, wind, center[0], center[1], center[2]],
  )
  return built
}

function Precip({ kind, ...p }: PrecipProps & { kind: 'rain' | 'snow' }) {
  const { geo, mat } = usePrecip(kind, p)
  useFrame((s) => mutate(mat, (m) => (m.uniforms.uScale.value = pointScale({ size: s.size, viewport: s.viewport, camera: s.camera as PerspectiveCamera }))))
  useAnim(p.animate, (t) => mutate(mat, (m) => (m.uniforms.uTime.value = t)))
  return <points geometry={geo} material={mat} frustumCulled={false} renderOrder={8} />
}

export const Rain = (p: PrecipProps) => <Precip kind="rain" {...p} />
export const Snow = (p: PrecipProps) => <Precip kind="snow" {...p} />

/* ------------------------------------------------------------------ falling leaves / petals (instanced) */

interface FallingProps {
  animate: boolean
  count: number
  colors: string[]
  kind?: 'leaf' | 'petal' | 'maple'
  center?: V3
  radius?: number
  height?: number
  size?: number
  speed?: number
  wind?: number
  seed?: number
  /** Optional shared texture (otherwise one is made). */
  map?: Texture
}

/** Leaves / petals tumbling down (CPU-animated InstancedMesh, ~1 draw call). */
export function Falling({ animate, count, colors, kind = 'leaf', center = [0, 0, 0], radius = 6, height = 6, size = 0.09, speed = 0.55, wind = 0.4, seed = 5 }: FallingProps) {
  const ref = useRef<InstancedMesh>(null)
  const { geo, mat, data } = useBuilt(
    (track) => {
      const r = rng(seed)
      const map = track(leafTexture(kind))
      const geo = track(new PlaneGeometry(1, 1))
      const mat = track(new MeshLambertMaterial({ map, alphaTest: 0.5, side: DoubleSide }))
      const data = Array.from({ length: count }, () => ({
        x: range(r, -radius, radius),
        z: range(r, -radius, radius * 0.9),
        off: r() * height,
        sp: speed * range(r, 0.7, 1.3),
        ph: r() * 10,
        sw: range(r, 0.15, 0.5),
        rx: range(r, 1.5, 4),
        ry: range(r, 0.8, 3),
        s: size * range(r, 0.7, 1.3),
        c: pick(r, colors),
      }))
      return { geo, mat, data }
    },
    [count, kind, radius, height, size, speed, seed, colors.join()],
  )
  const m4 = useRef(new Matrix4())
  const q = useRef(new Quaternion())
  const e = useRef(new Euler())
  const v = useRef(new Vector3())
  const sc = useRef(new Vector3())
  const colored = useRef<InstancedMesh | null>(null)
  useAnim(
    animate,
    (t) => {
      const m = ref.current
      if (!m) return
      if (colored.current !== m) {
        const c = new Color()
        data.forEach((d, i) => m.setColorAt(i, c.set(d.c)))
        if (m.instanceColor) m.instanceColor.needsUpdate = true
        colored.current = m
      }
      data.forEach((d, i) => {
        const y = height - ((t * d.sp + d.off) % height)
        const fall = height - y
        v.current.set(center[0] + d.x + Math.sin(t * 0.8 + d.ph) * d.sw + wind * fall * 0.35, center[1] + y, center[2] + d.z + Math.cos(t * 0.6 + d.ph) * d.sw * 0.6)
        e.current.set(t * d.rx + d.ph, t * d.ry, Math.sin(t + d.ph) * 0.8)
        q.current.setFromEuler(e.current)
        sc.current.setScalar(d.s * Math.min(1, y * 4))
        m4.current.compose(v.current, q.current, sc.current)
        m.setMatrixAt(i, m4.current)
      })
      m.instanceMatrix.needsUpdate = true
    },
    7.3,
  )
  return <instancedMesh ref={ref} args={[geo, mat, count]} frustumCulled={false} />
}

/* ------------------------------------------------------------------ ground mist */

const mistFrag = /* glsl */ `
uniform float uTime, uOpacity; uniform vec3 uColor; varying vec2 vUv; varying vec3 vW;
${GLSL_NOISE}
void main(){
  vec2 p = vW.xz * 0.35;
  float n = fbm(p + vec2(uTime * 0.05, uTime * 0.02)) * 0.65 + fbm(p * 2.1 - vec2(uTime * 0.03, 0.0)) * 0.35;
  float edge = smoothstep(0.0, 0.35, vUv.x) * smoothstep(1.0, 0.65, vUv.x) * smoothstep(0.0, 0.35, vUv.y) * smoothstep(1.0, 0.65, vUv.y);
  vec3 vd = vW - cameraPosition;
  float graze = smoothstep(0.03, 0.22, abs(vd.y) / max(length(vd), 0.001));
  float a = smoothstep(0.35, 0.8, n) * edge * uOpacity * graze;
  gl_FragColor = vec4(uColor, a);
  #include <colorspace_fragment>
}`
const mistVert = /* glsl */ `
varying vec2 vUv; varying vec3 vW;
void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`

/** Low drifting fog layers (a few stacked horizontal sheets, one draw call). */
export function Mist({ animate, color = '#c9cfdc', opacity = 0.5, size = 26, center = [0, 0, -4], layers = 3, height = 0.5, additive = false }: { animate: boolean; color?: string; opacity?: number; size?: number; center?: V3; layers?: number; height?: number; additive?: boolean }) {
  const { geo, mat } = useBuilt(
    (track) => {
      const parts: BufferGeometry[] = []
      for (let i = 0; i < layers; i++) {
        const g = new PlaneGeometry(size, size)
        g.rotateX(-Math.PI / 2)
        g.translate(0, 0.08 + (i / Math.max(1, layers - 1)) * height, 0)
        parts.push(g)
      }
      // merge manually (all same layout)
      const n = parts[0].attributes.position.count
      const geo = track(new BufferGeometry())
      const pos = new Float32Array(n * 3 * layers)
      const uv = new Float32Array(n * 2 * layers)
      const idx: number[] = []
      parts.forEach((g, i) => {
        pos.set(g.attributes.position.array as Float32Array, i * n * 3)
        uv.set(g.attributes.uv.array as Float32Array, i * n * 2)
        ;(g.index!.array as Uint16Array).forEach((k) => idx.push(k + i * n))
        g.dispose()
      })
      geo.setAttribute('position', new Float32BufferAttribute(pos, 3))
      geo.setAttribute('uv', new Float32BufferAttribute(uv, 2))
      geo.setIndex(idx)
      const mat = track(
        new ShaderMaterial({
          vertexShader: mistVert,
          fragmentShader: mistFrag,
          transparent: true,
          depthWrite: false,
          blending: additive ? AdditiveBlending : NormalBlending,
          toneMapped: false,
          uniforms: { uTime: { value: 0 }, uOpacity: { value: opacity }, uColor: { value: new Color(color) } },
        }),
      )
      return { geo, mat }
    },
    [layers, size, height, additive],
  )
  useLayoutEffect(() =>
    mutate(mat, (m) => {
      m.uniforms.uOpacity.value = opacity
      m.uniforms.uColor.value.set(color)
    }),
  )
  useAnim(animate, (t) => mutate(mat, (m) => (m.uniforms.uTime.value = t)))
  return <mesh geometry={geo} material={mat} position={center} renderOrder={6} />
}
