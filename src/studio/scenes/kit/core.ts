import { useFrame } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef, type DependencyList } from 'react'
import {
  BufferGeometry,
  CanvasTexture,
  CylinderGeometry,
  Color,
  Euler,
  Float32BufferAttribute,
  Matrix4,
  Quaternion,
  RepeatWrapping,
  SRGBColorSpace,
  Vector3,
  type ColorRepresentation,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { V3 } from '../types'

/* ------------------------------------------------------------------ random */

/** Small deterministic PRNG (mulberry32), so scenes look the same every visit. */
export function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
export type Rand = ReturnType<typeof rng>
export const range = (r: Rand, a: number, b: number) => a + (b - a) * r()
export const pick = <T,>(r: Rand, list: readonly T[]): T => list[Math.floor(r() * list.length) % list.length]

/* ------------------------------------------------------------------ lifetimes */

export interface Disposable {
  dispose(): void
}
export type Track = <T extends Disposable>(x: T) => T

/**
 * useMemo for GPU resources: everything passed to `track` is disposed when the deps change
 * or the component unmounts (no leaks when scenes switch).
 */
export function useBuilt<R>(make: (track: Track) => R, deps: DependencyList): R {
  const built = useMemo(() => {
    const list: Disposable[] = []
    const track: Track = (x) => {
      list.push(x)
      return x
    }
    return { value: make(track), list }
    // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/use-memo
  }, deps)
  useEffect(() => () => built.list.forEach((d) => d.dispose()), [built])
  return built.value
}

/**
 * three.js objects are external, mutable state (like refs). The React Compiler lint treats
 * values returned from hooks as frozen, so per-frame / per-prop mutations of materials,
 * uniforms and meshes go through this helper: mutate(mat, (m) => (m.uniforms.uTime.value = t)).
 */
export function mutate<T>(x: T, fn: (x: T) => void) {
  fn(x)
}

/**
 * Per-frame animation that only runs while `animate` is true. The callback also runs once on
 * mount (at `t0`) so a paused scene still shows a natural, mid-animation state.
 */
export function useAnim(animate: boolean, fn: (t: number, dt: number) => void, t0 = 3.7) {
  const t = useRef(t0)
  const cb = useRef(fn)
  useLayoutEffect(() => {
    cb.current = fn
  })
  useLayoutEffect(() => {
    cb.current(t.current, 0)
  }, [])
  useFrame((_, dt) => {
    if (!animate) return
    const d = Math.min(dt, 0.1)
    t.current += d
    cb.current(t.current, d)
  })
}

/** Pixels per metre at distance 1 for gl_PointSize attenuation (custom point shaders). */
export function pointScale(s: { size: { height: number }; viewport: { dpr: number }; camera: { fov?: number } }) {
  return (s.size.height * s.viewport.dpr * 0.5) / Math.tan(((s.camera.fov ?? 30) * Math.PI) / 360)
}

/* ------------------------------------------------------------------ canvas textures */

export interface CanvasTexOpts {
  repeat?: [number, number]
  /** Colour data (sRGB). False for masks / data. */
  srgb?: boolean
  anisotropy?: number
}

export function canvasTexture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void, opts: CanvasTexOpts = {}) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')!
  draw(ctx, w, h)
  const tex = new CanvasTexture(c)
  if (opts.srgb !== false) tex.colorSpace = SRGBColorSpace
  if (opts.repeat) {
    tex.wrapS = tex.wrapT = RepeatWrapping
    tex.repeat.set(opts.repeat[0], opts.repeat[1])
  }
  tex.anisotropy = opts.anisotropy ?? 4
  return tex
}

/** Soft radial blob (white centre to transparent), for glows, light pools and shadows. */
export function radialTexture(size = 128, falloff = 1) {
  return canvasTexture(size, size, (ctx, w) => {
    const g = ctx.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2)
    for (let i = 0; i <= 8; i++) {
      const t = i / 8
      g.addColorStop(t, `rgba(255,255,255,${Math.pow(1 - t, 1.6 * falloff) * (1 - t * t)})`)
    }
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, w)
  })
}

/** Speckle noise over a filled canvas: n dots of random size/alpha in the given colours. */
export function speckle(ctx: CanvasRenderingContext2D, w: number, h: number, r: Rand, n: number, colors: string[], size: [number, number], alpha: [number, number]) {
  for (let i = 0; i < n; i++) {
    ctx.globalAlpha = range(r, alpha[0], alpha[1])
    ctx.fillStyle = pick(r, colors)
    const s = range(r, size[0], size[1])
    ctx.fillRect(r() * w, r() * h, s, s)
  }
  ctx.globalAlpha = 1
}

/* ------------------------------------------------------------------ merged, vertex-coloured props */

const KEEP = new Set(['position', 'normal', 'uv'])
const tmpM = new Matrix4()

/**
 * Collects many small primitives (each with its own colour) into ONE geometry with a colour
 * attribute, so a whole set of props is a single draw call with a vertexColors material.
 * Nest transforms with `group()`.
 */
export class Parts {
  private list: BufferGeometry[] = []
  private stack: Matrix4[] = [new Matrix4()]

  get matrix() {
    return this.stack[this.stack.length - 1]
  }

  group(pos: V3, rot: V3 | number, scale: V3 | number, fn: () => void) {
    this.stack.push(this.matrix.clone().multiply(compose(pos, typeof rot === 'number' ? [0, rot, 0] : rot, scale)))
    fn()
    this.stack.pop()
  }

  add(geo: BufferGeometry, color: ColorRepresentation, pos: V3 = [0, 0, 0], rot: V3 = [0, 0, 0], scale: V3 | number = 1) {
    return this.addMatrix(geo, color, compose(pos, rot, scale))
  }

  addMatrix(geo: BufferGeometry, color: ColorRepresentation, m: Matrix4) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone()
    for (const k of Object.keys(g.attributes)) if (!KEEP.has(k)) g.deleteAttribute(k)
    if (!g.attributes.normal) g.computeVertexNormals()
    const n = g.attributes.position.count
    if (!g.attributes.uv) g.setAttribute('uv', new Float32BufferAttribute(new Float32Array(n * 2), 2))
    g.morphAttributes = {}
    g.clearGroups()
    g.applyMatrix4(tmpM.multiplyMatrices(this.matrix, m))
    const c = new Color(color)
    const col = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      col[i * 3] = c.r
      col[i * 3 + 1] = c.g
      col[i * 3 + 2] = c.b
    }
    g.setAttribute('color', new Float32BufferAttribute(col, 3))
    this.list.push(g)
    return this
  }

  /** A cylinder running from a to b (for branches, poles, ropes, legs). */
  limb(a: V3, b: V3, r0: number, r1: number, color: ColorRepresentation, segs = 6) {
    const va = new Vector3(...a)
    const vb = new Vector3(...b)
    const dir = vb.clone().sub(va)
    const len = dir.length()
    if (len < 1e-5) return this
    const q = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), dir.normalize())
    const m = new Matrix4().compose(va.clone().add(vb).multiplyScalar(0.5), q, new Vector3(1, 1, 1))
    return this.addMatrix(new CylinderGeometry(r1, r0, len, segs, 1, true), color, m)
  }

  get size() {
    return this.list.length
  }

  build() {
    const g = this.list.length ? mergeGeometries(this.list, false)! : new BufferGeometry()
    this.list.forEach((x) => x.dispose())
    this.list = []
    g.computeBoundingSphere()
    return g
  }
}

export function compose(pos: V3, rot: V3, scale: V3 | number) {
  const s = typeof scale === 'number' ? new Vector3(scale, scale, scale) : new Vector3(...scale)
  return new Matrix4().compose(new Vector3(...pos), new Quaternion().setFromEuler(new Euler(...rot)), s)
}

/** Points along a hanging cable from a to b (parabolic sag), inclusive of both ends. */
export function catenary(a: V3, b: V3, sag: number, n: number): V3[] {
  const out: V3[] = []
  for (let i = 0; i <= n; i++) {
    const t = i / n
    out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - sag * 4 * t * (1 - t), a[2] + (b[2] - a[2]) * t])
  }
  return out
}

/** GLSL helpers shared by the shaders in this folder. */
export const GLSL_NOISE = /* glsl */ `
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float hash13(vec3 p3){ p3 = fract(p3 * .1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p){ vec2 i = floor(p); vec2 f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(hash12(i), hash12(i+vec2(1,0)), f.x), mix(hash12(i+vec2(0,1)), hash12(i+vec2(1,1)), f.x), f.y); }
float fbm(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++){ s += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; } return s; }
`
