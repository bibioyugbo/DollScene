import { Crowd, guest, scatter } from './kit/Crowd'
import { useMemo, useRef } from 'react'
import {
  AdditiveBlending,
  BoxGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  MeshLambertMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  ShaderMaterial,
  Euler,
  Quaternion,
  Vector3,
  type DirectionalLight,
} from 'three'
import { beamGeometry, beamMaterial, beamMatrix } from './kit/beams'
import { canvasTexture, mutate, Parts, pick, radialTexture, range, rng, speckle, useAnim, useBuilt } from './kit/core'
import { GlowPoints, type GlowPoint } from './kit/Glow'
import { BlobShadow, LightPool, SceneLights } from './kit/Lights'
import { Mist } from './kit/Weather'
import { figure } from './kit/shapes'
import { SCENE_BY_ID } from './defs'
import type { SceneProps, V3 } from './types'

/* Warehouse: x ±10, floor 0, roof truss y 8, back wall z -12, front wall z +10 */
const W = 10
const H = 9
const BACK = -12
const FRONT = 10
const LED_Z = -8.2

const HSV = /* glsl */ `vec3 hsv(float h, float s, float v){ vec3 k = clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0); return v * mix(vec3(1.0), k, s); }`

/** LED wall: pixel-grid equaliser bars over drifting colour waves. */
const ledVert = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`
const ledFrag = /* glsl */ `
uniform float uTime, uGain; varying vec2 vUv;
${HSV}
void main(){
  vec2 grid = vec2(96.0, 48.0);
  vec2 cell = floor(vUv * grid);
  vec2 f = fract(vUv * grid) - 0.5;
  float dotm = smoothstep(0.5, 0.3, length(f));
  float x = cell.x / grid.x; float y = cell.y / grid.y;
  float col = floor(x * 24.0);
  float h = 0.18 + 0.32 * abs(sin(uTime * 2.7 + col * 0.9) * sin(uTime * 1.3 + col * 0.37)) + 0.12 * sin(uTime * 5.0 + col);
  float bars = step(y, h) * step(0.15, fract(x * 24.0)) ;
  float wave = 0.5 + 0.5 * sin((x * 6.0 - y * 3.0) * 3.1416 + uTime * 1.6);
  float ring = smoothstep(0.08, 0.0, abs(length((vUv - 0.5) * vec2(2.0, 1.0)) - fract(uTime * 0.35) * 1.2));
  vec3 bg = hsv(fract(x * 0.4 + uTime * 0.05), 0.9, 0.18 + 0.25 * wave);
  vec3 bar = hsv(fract(0.55 + y * 0.5 + uTime * 0.03), 0.85, 1.0);
  vec3 c = bg + bar * bars * 1.1 + vec3(1.0, 0.4, 0.9) * ring * 0.6;
  gl_FragColor = vec4(c * dotm * uGain, 1.0);
  #include <colorspace_fragment>
}`

/** LED strips: hue chases along world x/y. */
const stripVert = /* glsl */ `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`
const stripFrag = /* glsl */ `
uniform float uTime; varying vec3 vW;
${HSV}
void main(){
  float h = fract(vW.x * 0.035 + vW.y * 0.09 + vW.z * 0.02 - uTime * 0.18);
  gl_FragColor = vec4(hsv(0.75 + h * 0.5, 0.85, 1.0) * 1.1, 1.0);
  #include <colorspace_fragment>
}`

function concreteTexture() {
  return canvasTexture(
    512,
    512,
    (ctx, w, h) => {
      const r = rng(41)
      ctx.fillStyle = '#5d5c62'
      ctx.fillRect(0, 0, w, h)
      speckle(ctx, w, h, r, 9000, ['#4a4950', '#706e76', '#3d3c42'], [1, 3], [0.2, 0.6])
      for (let i = 0; i < 14; i++) {
        const g = ctx.createRadialGradient(r() * w, r() * h, 0, r() * w, r() * h, range(r, 40, 140))
        g.addColorStop(0, 'rgba(25,25,30,0.35)')
        g.addColorStop(1, 'rgba(25,25,30,0)')
        ctx.fillStyle = g
        ctx.fillRect(0, 0, w, h)
      }
      ctx.strokeStyle = 'rgba(20,20,24,0.6)'
      ctx.lineWidth = 2
      ctx.strokeRect(0, 0, w, h)
    },
    { repeat: [5, 6], anisotropy: 8 },
  )
}

function brickTexture() {
  return canvasTexture(
    512,
    512,
    (ctx, w, h) => {
      const r = rng(12)
      ctx.fillStyle = '#2a2224'
      ctx.fillRect(0, 0, w, h)
      const bh = h / 16
      const bw = w / 6
      for (let y = 0; y < 16; y++) {
        const off = y % 2 ? bw / 2 : 0
        for (let x = -1; x < 7; x++) {
          const l = range(r, 0.7, 1.15)
          ctx.fillStyle = `rgb(${110 * l},${62 * l},${52 * l})`
          ctx.fillRect(off + x * bw + 2, y * bh + 2, bw - 4, bh - 4)
        }
      }
      speckle(ctx, w, h, r, 3000, ['#1a1416', '#6a4a42'], [1, 3], [0.2, 0.5])
    },
    { repeat: [6, 3] },
  )
}

const LASER_COLS = ['#2bff7a', '#22e6ff', '#ff2bd6', '#ff3344', '#2bff7a', '#7a5cff']
const EMITTERS: V3[] = [
  [-3.2, 6.9, -7.6],
  [0, 7.1, -7.6],
  [3.2, 6.9, -7.6],
]
const NL = 18

/** Rotate a spot-relative light offset to follow the photo spot's facing. */
function turn(o: V3, r: number): V3 {
  return [o[0] * Math.cos(r) + o[2] * Math.sin(r), o[1], -o[0] * Math.sin(r) + o[2] * Math.cos(r)]
}

export default function Rave({ weather, animate, spot }: SceneProps) {
  const crowdPeople = useMemo(() => {
    const r = rng(303)
    return scatter(r, 34, [-7, 7, -6, 6], [{ p: [0, 0, 0] as V3, r: 2.4 }, { p: [1.6, 0, -3.4] as V3, r: 2.4 }, { p: [-3.2, 0, -0.8] as V3, r: 2.4 }]).map((pp) => guest(r, pp, ['#22e6c8', '#ff2bd6', '#1a1a24', '#c8ff3d', '#7b2cff', '#0c0c10'], ['dance','dance','cheer','cheer','selfie'], ['none','shades','cap','none'], ['#ff2bd6','#22e6c8','#c8ff3d']))
  }, [])
  const haze = weather === 'fog'
  const rot = SCENE_BY_ID.rave.photoSpots.find((p) => p.position.every((v, i) => v === spot[i]))?.rotationY ?? 0
  const rimRef = useRef<DirectionalLight>(null)
  const lasers = useRef<InstancedMesh>(null)
  const strobes = useRef<InstancedMesh>(null)
  const pools = useRef<InstancedMesh>(null)
  const crowdRef = useRef<InstancedMesh>(null)

  const b = useBuilt((track) => {
    const r = rng(303)
    const concrete = track(concreteTexture())
    const brick = track(brickTexture())
    const pool = track(radialTexture(128, 0.7))

    /* shell */
    const shell = new Parts()
    shell.add(new PlaneGeometry(2 * W, H), '#ffffff', [0, H / 2, BACK])
    shell.add(new PlaneGeometry(FRONT - BACK, H), '#d8d0e0', [-W, H / 2, (BACK + FRONT) / 2], [0, Math.PI / 2, 0])
    shell.add(new PlaneGeometry(FRONT - BACK, H), '#d8d0e0', [W, H / 2, (BACK + FRONT) / 2], [0, -Math.PI / 2, 0])
    shell.add(new PlaneGeometry(2 * W, H), '#a8a0b0', [0, H / 2, FRONT], [0, Math.PI, 0])

    /* props: trusses, pillars, booth, speakers */
    const p = new Parts()
    const metal = '#2a2a33'
    p.add(new PlaneGeometry(2 * W, FRONT - BACK), '#09080c', [0, H, (BACK + FRONT) / 2], [Math.PI / 2, 0, 0])
    for (const z of [-7.6, -2.6, 2.4, 7]) {
      for (const y of [7.4, 8]) p.add(new BoxGeometry(2 * W, 0.08, 0.08), metal, [0, y, z])
      for (let x = -W + 0.3; x < W; x += 0.6) p.add(new BoxGeometry(0.035, 0.75, 0.035), metal, [x, 7.7, z], [0, 0, x % 1.2 < 0.6 ? 0.7 : -0.7])
    }
    for (const x of [-4.5, 4.5]) for (const y of [7.4, 8]) p.add(new BoxGeometry(0.08, 0.08, FRONT - BACK), metal, [x, y, (BACK + FRONT) / 2])
    // concrete pillars
    const pillars: [number, number][] = [
      [-5.2, -3.8],
      [5.2, -3.8],
      [-5.2, 3.2],
      [5.2, 3.2],
    ]
    for (const [x, z] of pillars) p.add(new BoxGeometry(0.6, H, 0.6), '#4a4850', [x, H / 2, z])
    // DJ riser + booth desk + speaker stacks
    p.add(new BoxGeometry(7, 0.5, 2.6), '#141218', [0, 0.25, -7.3])
    p.add(new BoxGeometry(3.4, 1.05, 0.9), '#0e0d12', [0, 1.02, -6.7])
    p.add(new BoxGeometry(3.5, 0.06, 1.0), '#26242c', [0, 1.57, -6.7])
    for (const sx of [-1, 1]) {
      for (let k = 0; k < 3; k++) p.add(new BoxGeometry(1.1, 0.9, 0.9), k % 2 ? '#121116' : '#18171d', [sx * 4.3, 0.95 + k * 0.92, -7.2])
    }
    // LED wall frame + under-panel
    p.add(new BoxGeometry(9.4, 0.2, 0.3), metal, [0, 6.15, LED_Z - 0.05])
    p.add(new BoxGeometry(9.4, 1.1, 0.2), '#101015', [0, 1.05, LED_Z - 0.05])
    // laser emitters
    for (const e of EMITTERS) p.add(new BoxGeometry(0.4, 0.22, 0.35), '#1a1a20', [e[0], e[1] + 0.12, e[2]])

    /* LED strips (shader) on pillars, booth front and along walls */
    const s = new Parts()
    for (const [x, z] of pillars) {
      for (const dx of [-0.31, 0.31]) s.add(new BoxGeometry(0.03, H - 0.4, 0.05), '#fff', [x + dx, H / 2, z + 0.31])
      for (let k = 0; k < 4; k++) s.add(new BoxGeometry(0.63, 0.04, 0.63), '#fff', [x, 0.9 + k * 1.8, z])
    }
    s.add(new BoxGeometry(3.42, 0.05, 0.02), '#fff', [0, 1.25, -6.24])
    s.add(new BoxGeometry(3.42, 0.05, 0.02), '#fff', [0, 0.62, -6.24])
    s.add(new BoxGeometry(7.02, 0.05, 0.02), '#fff', [0, 0.47, -5.99])
    for (const x of [-W + 0.03, W - 0.03]) s.add(new BoxGeometry(0.03, 0.06, FRONT - BACK - 1), '#fff', [x, 3.2, (BACK + FRONT) / 2])
    for (const z of [-7.6, -2.6, 2.4, 7]) s.add(new BoxGeometry(2 * W, 0.04, 0.04), '#fff', [0, 7.32, z])

    /* crowd silhouettes */
    const fig = figure(r, '#ffffff')
    const crowd: { p: V3; ph: number; s: number; ry: number }[] = []
    const spots = SCENE_BY_ID.rave.photoSpots.map((q) => q.position)
    let tries = 0
    while (crowd.length < 64 && tries++ < 2000) {
      const back = r() < 0.72
      const x = back ? range(r, -6.5, 6.5) : (r() < 0.5 ? -1 : 1) * range(r, 6, 9)
      const z = back ? range(r, -5.8, -4.6) : range(r, -3, 6)
      if (spots.some((q) => Math.hypot(q[0] - x, q[2] - z) < 1.5)) continue
      if (Math.abs(x) < 1.5 && z > -4.4) continue
      crowd.push({ p: [x, 0, z], ph: r() * 6.28, s: range(r, 0.92, 1.06), ry: back ? range(r, 2.6, 3.6) : x > 0 ? -Math.PI / 2 : Math.PI / 2 })
    }
    crowd.push({ p: [0.3, 0.5, -7.35], ph: 0, s: 1, ry: Math.PI }) // the DJ

    /* glows: par cans along trusses, emitter heads, booth gear, exit sign */
    const glows: GlowPoint[] = []
    for (const z of [-2.6, 2.4]) for (let x = -8; x <= 8; x += 2) glows.push({ p: [x, 7.25, z], c: pick(r, ['#ff2bd6', '#22e6ff', '#7a5cff', '#ff8a2b']), s: 0.35, ph: r() })
    for (const e of EMITTERS) glows.push({ p: [e[0], e[1], e[2] + 0.2], c: '#9fffd0', s: 0.4, ph: r() })
    for (let i = 0; i < 10; i++) glows.push({ p: [range(r, -1.4, 1.4), 1.62, range(r, -6.9, -6.4)], c: pick(r, ['#ff3355', '#33ffcc', '#ffffff']), s: 0.06, ph: r() })
    const ledGlow: GlowPoint[] = []
    for (let x = -4.4; x <= 4.4; x += 0.55) ledGlow.push({ p: [x, 1.75, LED_Z + 0.1], c: pick(r, ['#ff2bd6', '#22e6ff', '#7a5cff']), s: 0.9, ph: (x + 5) / 10 })
    const exit: GlowPoint[] = [{ p: [-W + 0.1, 3.6, 6], c: '#33ff66', s: 0.5 }]

    /* strobes + pools */
    const strobeSrc: V3[] = [
      [-3, 7.3, -2.6],
      [3, 7.3, -2.6],
      [-1.6, 7.3, 2.4],
      [1.6, 7.3, 2.4],
      [-4.5, 7.3, -7.6],
      [4.5, 7.3, -7.6],
    ]
    const strobeDst: V3[] = [
      [-2.6, 0, -2.2],
      [2.7, 0, -1.6],
      [-2.4, 0, 2.2],
      [2.4, 0, 2.4],
      [-3.4, 0, -5.2],
      [3.4, 0, -5.2],
    ]

    return {
      concrete,
      pool,
      shellGeo: track(shell.build()),
      propGeo: track(p.build()),
      stripGeo: track(s.build()),
      figGeo: track(fig),
      crowd,
      glows,
      ledGlow,
      exit,
      strobeSrc,
      strobeDst,
      beamGeo: track(beamGeometry(10)),
      laserMat: track(beamMaterial('#ffffff', 1, 0.15, 0.35)),
      strobeMat: track(beamMaterial('#ffffff', 0.22, 0.6, 1.4)),
      poolGeo: track(new PlaneGeometry(3, 3).rotateX(-Math.PI / 2)),
      poolMat: track(new MeshBasicMaterial({ map: pool, transparent: true, blending: AdditiveBlending, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -1 })),
      shellMat: track(new MeshLambertMaterial({ map: brick, vertexColors: true })),
      propMat: track(new MeshLambertMaterial({ vertexColors: true, side: DoubleSide })),
      crowdMat: track(new MeshLambertMaterial({ color: '#0d0b12' })),
      floorMat: track(new MeshStandardMaterial({ map: concrete, color: '#8a8794', roughness: 0.14, metalness: 0.15, envMapIntensity: 1.2 })),
      ledMat: track(new ShaderMaterial({ vertexShader: ledVert, fragmentShader: ledFrag, toneMapped: false, uniforms: { uTime: { value: 0 }, uGain: { value: 0.8 } } })),
      stripMat: track(new ShaderMaterial({ vertexShader: stripVert, fragmentShader: stripFrag, toneMapped: false, uniforms: { uTime: { value: 0 } } })),
      ledGeo: track(new PlaneGeometry(9, 4.4)),
    }
  }, [])

  const m4 = useRef(new Matrix4())
  const col = useRef(new Color())
  const tmp = useRef({ v: new Vector3(), q: new Quaternion(), e: new Euler(), s: new Vector3() })
  useAnim(animate, (t) => {
    mutate(b.ledMat, (m) => (m.uniforms.uTime.value = t))
    mutate(b.stripMat, (m) => (m.uniforms.uTime.value = t))
    const beat = t * 2.1
    // lasers: fans from each emitter sweeping over the crowd, above head height
    const L = lasers.current
    if (L) {
      for (let i = 0; i < NL; i++) {
        const e = EMITTERS[i % 3]
        const k = Math.floor(i / 3)
        const sweep = Math.sin(t * 0.7 + (i % 3) * 2.1) * 0.9
        const ax = (k - 2.5) * 0.22 + sweep
        const ay = 0.1 + 0.12 * Math.sin(t * 0.9 + k) + (i % 3 === 1 ? 0.05 : 0)
        const len = 22
        const to: V3 = [e[0] + Math.sin(ax) * len, e[1] - ay * len * 0.35 + 0.8, e[2] + Math.cos(ax) * len]
        L.setMatrixAt(i, beamMatrix(e, to, 0.07, m4.current))
        const on = 0.55 + 0.45 * Math.max(0, Math.sin(beat * 1.5707 + i))
        L.setColorAt(i, col.current.set(LASER_COLS[(i + Math.floor(t * 0.25)) % LASER_COLS.length]).multiplyScalar(on))
      }
      L.instanceMatrix.needsUpdate = true
      if (L.instanceColor) L.instanceColor.needsUpdate = true
    }
    // strobes: each fires on its own beat
    const S = strobes.current
    const P = pools.current
    if (S && P) {
      for (let i = 0; i < b.strobeSrc.length; i++) {
        const f = Math.exp(-((beat + i * 0.37) % 1) * 7) * (Math.floor(beat + i * 0.37) % 3 === i % 3 ? 1 : 0.25)
        const c = col.current.setHSL((i * 0.17 + t * 0.03) % 1, 0.6, 0.75).multiplyScalar(0.15 + f)
        S.setMatrixAt(i, beamMatrix(b.strobeSrc[i], b.strobeDst[i], 1.1, m4.current))
        S.setColorAt(i, c)
        P.setMatrixAt(i, m4.current.makeTranslation(b.strobeDst[i][0], 0.01, b.strobeDst[i][2]))
        P.setColorAt(i, c.multiplyScalar(0.8))
      }
      S.instanceMatrix.needsUpdate = true
      P.instanceMatrix.needsUpdate = true
      if (S.instanceColor) S.instanceColor.needsUpdate = true
      if (P.instanceColor) P.instanceColor.needsUpdate = true
    }
    // crowd bobbing to the beat
    const C = crowdRef.current
    if (C) {
      const { v, q, e, s } = tmp.current
      b.crowd.forEach((c, i) => {
        const bob = Math.abs(Math.sin(beat * Math.PI * 0.5 + c.ph)) * 0.07
        v.set(c.p[0], c.p[1] + bob, c.p[2])
        e.set(Math.sin(beat * 0.5 + c.ph) * 0.05, c.ry, Math.sin(beat * Math.PI * 0.25 + c.ph) * 0.06)
        q.setFromEuler(e)
        s.setScalar(c.s)
        C.setMatrixAt(i, m4.current.compose(v, q, s))
      })
      C.instanceMatrix.needsUpdate = true
      C.computeBoundingSphere()
    }
    // rim light colour cycles magenta <-> cyan
    if (rimRef.current) rimRef.current.color.setHSL(0.83 + 0.17 * Math.sin(t * 0.6), 0.85, 0.62)
  })

  const fog = haze ? '#1d1030' : '#0f0918'
  return (
    <>
      <color attach="background" args={[fog]} />
      <fog attach="fog" args={[fog, haze ? 3 : 7, haze ? 20 : 32]} />
      <SceneLights
        spot={spot}
        rimRef={rimRef}
        hemi={['#3a2a6a', '#0a0612', 0.55]}
        keyLight={{ color: '#f4eeff', intensity: 2.1, offset: turn([-1.3, 2.0, 3.2], rot) }}
        rim={{ color: '#ff3bd0', intensity: 3.2, offset: turn([1.6, 2.4, -2.6], rot) }}
        env={{
          intensity: 0.8,
          front: '#f6f0ff',
          back: '#ff3bd0',
          ambient: '#140a24',
          extra: [
            { color: '#22e6ff', intensity: 1.6, position: [-3, 1.6, -2], scale: [1, 3] },
            { color: '#7a5cff', intensity: 1.2, position: [0, 3, -5], scale: [6, 2] },
          ],
        }}
      />
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, (BACK + FRONT) / 2]} material={b.floorMat}>
        <planeGeometry args={[2 * W, FRONT - BACK]} />
      </mesh>
      <mesh geometry={b.shellGeo} material={b.shellMat} />
      <mesh geometry={b.propGeo} material={b.propMat} />
      <mesh geometry={b.stripGeo} material={b.stripMat} />
      <mesh geometry={b.ledGeo} material={b.ledMat} position={[0, 3.85, LED_Z]} />
      <instancedMesh ref={crowdRef} args={[b.figGeo, b.crowdMat, b.crowd.length]} frustumCulled={false} />
      <GlowPoints points={b.glows} mode="twinkle" animate={animate} mirrorY={0} mirrorStrength={0.45} />
      <GlowPoints points={b.ledGlow} mode="chase" animate={animate} intensity={0.55} mirrorY={0} mirrorStrength={0.6} />
      <GlowPoints points={b.exit} animate={animate} intensity={0.8} />
      <instancedMesh ref={lasers} args={[b.beamGeo, b.laserMat, NL]} frustumCulled={false} renderOrder={7} />
      <instancedMesh ref={strobes} args={[b.beamGeo, b.strobeMat, b.strobeSrc.length]} frustumCulled={false} renderOrder={7} />
      <instancedMesh ref={pools} args={[b.poolGeo, b.poolMat, b.strobeSrc.length]} frustumCulled={false} renderOrder={1} />
      <LightPool position={spot} color="#d9c8ff" size={2.8} opacity={0.22} />
      <Crowd people={crowdPeople} animate={animate} />
      <BlobShadow position={spot} />
      {haze && <Mist animate={animate} color="#8a5cff" opacity={0.28} size={22} center={[0, 0, -3]} layers={4} height={1.4} additive />}
    </>
  )
}

// Silence unused import warnings for geometry used only in type position.
void CylinderGeometry
