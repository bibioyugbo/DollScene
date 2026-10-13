import { Crowd, guest, scatter } from './kit/Crowd'
import { useMemo, useRef } from 'react'
import {
  AdditiveBlending,
  BoxGeometry,
  BufferGeometry,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  ConeGeometry,
  IcosahedronGeometry,
  MeshBasicMaterial,
  MeshLambertMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  ShaderMaterial,
  TorusGeometry,
  TubeGeometry,
  CatmullRomCurve3,
  Vector3,
  type Mesh,
  type PerspectiveCamera,
} from 'three'
import { useFrame } from '@react-three/fiber'
import { Beam } from './kit/Beam'
import { canvasTexture, catenary, mutate, Parts, pick, pointScale, range, rng, speckle, useAnim, useBuilt } from './kit/core'
import { GlowPoints, type GlowPoint } from './kit/Glow'
import { Instanced, type Inst } from './kit/Instanced'
import { BlobShadow, LightPool, SceneLights } from './kit/Lights'
import { Mist } from './kit/Weather'
import { blob } from './kit/shapes'
import type { SceneProps, V3 } from './types'

/* Gym: x ±8, floor y 0, ceiling y 7, back wall z -7, front wall z +9.5 */
const W = 8
const H = 7
const BACK = -7
const FRONT = 9.5
const BALL: V3 = [1.15, 3.45, -1.2]

const BALLOON_COLORS = ['#e9b3a3', '#f3c6cf', '#f6efe8', '#d8b26a', '#c9a0c8', '#e7a1b2']

function floorTextures() {
  const planks = canvasTexture(
    1024,
    1024,
    (ctx, w, h) => {
      const r = rng(3)
      const cols = 16
      const pw = w / cols
      for (let c = 0; c < cols; c++) {
        let y = -r() * 300
        while (y < h) {
          const len = range(r, 180, 420)
          const l = range(r, 0.85, 1.08)
          ctx.fillStyle = `rgb(${176 * l},${118 * l},${70 * l})`
          ctx.fillRect(c * pw, y, pw, len)
          // grain
          ctx.globalAlpha = 0.12
          for (let g = 0; g < 6; g++) {
            ctx.fillStyle = r() < 0.5 ? '#7a4a24' : '#f0c890'
            ctx.fillRect(c * pw + r() * pw, y, 1 + r() * 2, len)
          }
          ctx.globalAlpha = 1
          ctx.fillStyle = 'rgba(60,30,10,0.55)'
          ctx.fillRect(c * pw, y, pw, 2)
          y += len
        }
        ctx.fillStyle = 'rgba(60,30,10,0.45)'
        ctx.fillRect(c * pw, 0, 1.5, h)
      }
    },
    { repeat: [8, 8], anisotropy: 8 },
  )
  // court markings over the whole floor (x -8..8, z -7..9.5)
  const lines = canvasTexture(
    1024,
    1024,
    (ctx, w, h) => {
      const sx = (x: number) => ((x + W) / (2 * W)) * w
      const sz = (z: number) => ((z - BACK) / (FRONT - BACK)) * h
      ctx.strokeStyle = 'rgba(250,250,250,0.85)'
      ctx.lineWidth = 6
      ctx.beginPath()
      ctx.arc(sx(0), sz(0), (1.8 / (2 * W)) * w, 0, Math.PI * 2)
      ctx.stroke()
      ctx.strokeStyle = 'rgba(160,30,60,0.8)'
      ctx.fillStyle = 'rgba(160,30,60,0.35)'
      ctx.beginPath()
      ctx.arc(sx(0), sz(0), (0.6 / (2 * W)) * w, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = 'rgba(250,250,250,0.8)'
      ctx.strokeRect(sx(-7.2), sz(-6.6), sx(7.2) - sx(-7.2), sz(9) - sz(-6.6))
      ctx.beginPath()
      ctx.moveTo(sx(-7.2), sz(0))
      ctx.lineTo(sx(-1.8), sz(0))
      ctx.moveTo(sx(1.8), sz(0))
      ctx.lineTo(sx(7.2), sz(0))
      ctx.stroke()
      // key at the back
      ctx.fillStyle = 'rgba(160,30,60,0.35)'
      ctx.fillRect(sx(-1.8), sz(-6.6), sx(1.8) - sx(-1.8), sz(-2.4) - sz(-6.6))
      ctx.strokeRect(sx(-1.8), sz(-6.6), sx(1.8) - sx(-1.8), sz(-2.4) - sz(-6.6))
    },
    { anisotropy: 8 },
  )
  return { planks, lines }
}

function blockTexture() {
  return canvasTexture(
    512,
    512,
    (ctx, w, h) => {
      const r = rng(9)
      ctx.fillStyle = '#d9d6de'
      ctx.fillRect(0, 0, w, h)
      speckle(ctx, w, h, r, 4000, ['#bfbac6', '#ece9f0'], [1, 3], [0.2, 0.5])
      ctx.fillStyle = '#9e98a8'
      const bh = h / 8
      for (let y = 0; y < 8; y++) {
        ctx.fillRect(0, y * bh, w, 4)
        const off = y % 2 ? w / 4 : 0
        for (let x = 0; x < 3; x++) ctx.fillRect(off + (x * w) / 2, y * bh, 4, bh)
      }
    },
    { repeat: [6, 3] },
  )
}

function signTexture() {
  return canvasTexture(1024, 384, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h)
    const neon = (text: string, font: string, x: number, y: number, col: string) => {
      ctx.font = font
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.lineJoin = 'round'
      for (const [blur, lw, a] of [
        [40, 18, 0.5],
        [18, 10, 0.8],
        [6, 5, 1],
      ] as const) {
        ctx.shadowColor = col
        ctx.shadowBlur = blur
        ctx.strokeStyle = col
        ctx.globalAlpha = a
        ctx.lineWidth = lw
        ctx.strokeText(text, x, y)
      }
      ctx.globalAlpha = 1
      ctx.shadowBlur = 8
      ctx.strokeStyle = '#fff6fb'
      ctx.lineWidth = 3
      ctx.strokeText(text, x, y)
    }
    neon('PROM', '900 170px "Arial Black", "Helvetica Neue", Arial, sans-serif', w * 0.36, h * 0.46, '#ff4fa8')
    neon('2016', 'italic 700 150px "Brush Script MT", "Snell Roundhand", "Segoe Script", cursive', w * 0.76, h * 0.56, '#5fd8ff')
  })
}

function boothTexture() {
  return canvasTexture(512, 512, (ctx, w, h) => {
    const r = rng(21)
    const g = ctx.createLinearGradient(0, 0, w, h)
    g.addColorStop(0, '#caa0a4')
    g.addColorStop(1, '#8f6a8a')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
    // sequins
    for (let y = 0; y < h; y += 10) {
      for (let x = (y / 10) % 2 ? 5 : 0; x < w; x += 10) {
        const l = r()
        ctx.fillStyle = l > 0.92 ? '#fff6ee' : l > 0.6 ? '#f2cfc4' : l > 0.3 ? '#d7a9a6' : '#a77d8f'
        ctx.beginPath()
        ctx.arc(x, y, 4.2, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    ctx.fillStyle = 'rgba(30,10,30,0.35)'
    ctx.fillRect(w * 0.08, h * 0.08, w * 0.84, h * 0.18)
    ctx.font = '700 64px "Brush Script MT", "Snell Roundhand", cursive'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#fff'
    ctx.shadowColor = '#ff7ac0'
    ctx.shadowBlur = 14
    ctx.fillText('#Prom16', w / 2, h * 0.17)
  })
}

/** Disco-ball light specks swept across walls, floor and ceiling (GPU, one draw call). */
const speckVert = /* glsl */ `
attribute vec3 dir; attribute float seed;
uniform float uTime, uScale; uniform vec3 uBall; uniform vec3 uMin; uniform vec3 uMax;
varying float vA; varying vec3 vC;
void main(){
  float a = uTime * 0.32;
  float c = cos(a), s = sin(a);
  vec3 d = normalize(vec3(c * dir.x - s * dir.z, dir.y, s * dir.x + c * dir.z));
  vec3 t1 = (uMin - uBall) / d; vec3 t2 = (uMax - uBall) / d;
  vec3 tf = max(t1, t2);
  float t = min(min(tf.x, tf.y), tf.z);
  vec3 p = uBall + d * (t - 0.03);
  vec4 mv = viewMatrix * vec4(p, 1.0);
  vA = 0.55 + 0.45 * sin(uTime * 3.0 + seed * 50.0);
  vC = mix(vec3(1.0, 0.92, 0.97), mix(vec3(1.0, 0.45, 0.8), vec3(0.45, 0.8, 1.0), step(0.5, fract(seed * 7.0))), step(0.7, seed));
  gl_PointSize = clamp((0.05 + t * 0.012) * uScale / max(-mv.z, 0.2), 1.0, 48.0);
  gl_Position = projectionMatrix * mv;
}`
const speckFrag = /* glsl */ `
varying float vA; varying vec3 vC;
void main(){ float r = length(gl_PointCoord - 0.5) * 2.0; float a = smoothstep(1.0, 0.2, r); if (a < 0.01) discard; gl_FragColor = vec4(vC, a * vA * 0.75);
#include <colorspace_fragment>
}`

function DiscoBall({ animate, intensity }: { animate: boolean; intensity: number }) {
  const ball = useRef<Mesh>(null)
  const { geo, mat, ballGeo, ballMat, sparkles } = useBuilt((track) => {
    const r = rng(77)
    const n = 520
    const dir = new Float32Array(n * 3)
    const seed = new Float32Array(n)
    for (let i = 0; i < n; i++) {
      const v = new Vector3(range(r, -1, 1), range(r, -1, 0.6), range(r, -1, 1)).normalize()
      dir.set([v.x, v.y, v.z], i * 3)
      seed[i] = r()
    }
    const geo = track(new BufferGeometry())
    geo.setAttribute('position', new Float32BufferAttribute(new Float32Array(n * 3), 3))
    geo.setAttribute('dir', new Float32BufferAttribute(dir, 3))
    geo.setAttribute('seed', new Float32BufferAttribute(seed, 1))
    const mat = track(
      new ShaderMaterial({
        vertexShader: speckVert,
        fragmentShader: speckFrag,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        toneMapped: false,
        uniforms: {
          uTime: { value: 0 },
          uScale: { value: 500 },
          uBall: { value: new Vector3(...BALL) },
          uMin: { value: new Vector3(-W, 0, BACK) },
          uMax: { value: new Vector3(W, H, FRONT) },
        },
      }),
    )
    const ballGeo = track(new IcosahedronGeometry(0.34, 3))
    const ballMat = track(new MeshStandardMaterial({ color: '#e8e6f2', metalness: 0.85, roughness: 0.22, flatShading: true, envMapIntensity: 3, emissive: '#3a3448' }))
    const sparkles: GlowPoint[] = Array.from({ length: 14 }, () => {
      const v = new Vector3(range(r, -1, 1), range(r, -1, 1), range(r, 0.2, 1)).normalize().multiplyScalar(0.35)
      return { p: [BALL[0] + v.x, BALL[1] + v.y, BALL[2] + v.z] as V3, c: r() < 0.5 ? '#ffffff' : '#ffd0f0', s: range(r, 0.12, 0.3), ph: r() }
    })
    return { geo, mat, ballGeo, ballMat, sparkles }
  }, [])
  useFrame((s) => mutate(mat, (m) => (m.uniforms.uScale.value = pointScale({ size: s.size, viewport: s.viewport, camera: s.camera as PerspectiveCamera }))))
  useAnim(animate, (t) => {
    mutate(mat, (m) => (m.uniforms.uTime.value = t))
    if (ball.current) ball.current.rotation.y = t * 0.32
  })
  return (
    <group>
      <mesh ref={ball} geometry={ballGeo} material={ballMat} position={BALL} />
      <mesh position={[BALL[0], (BALL[1] + H) / 2 + 0.17, BALL[2]]}>
        <cylinderGeometry args={[0.006, 0.006, H - BALL[1] - 0.34, 4, 1, true]} />
        <meshBasicMaterial color="#555" />
      </mesh>
      <points geometry={geo} material={mat} frustumCulled={false} renderOrder={4} visible={intensity > 0} />
      <GlowPoints points={sparkles} mode="flash" animate={animate} intensity={1.4} />
    </group>
  )
}

export default function Prom2016({ time, weather, animate, spot }: SceneProps) {
  const crowdPeople = useMemo(() => {
    const r = rng(2016)
    return scatter(r, 30, [-7, 7, -6.5, 8.5], [{ p: [0, 0, 0] as V3, r: 2.4 }, { p: [2.7, 0, -0.6] as V3, r: 2.4 }, { p: [-1.6, 0, 1.4] as V3, r: 2.4 }]).map((pp) => guest(r, pp, ['#e8a0b4', '#6a4bd6', '#f6efe8', '#d8b26a', '#c94b7b', '#2fb3c9', '#1a1a24'], ['dance','dance','selfie','cheer','stand','drink'], ['mask','mask','mask','none','party'], ['#d8b26a','#c0c0c8','#c94b7b','#6a4bd6']))
  }, [])
  const golden = time === 'golden'
  const tex = useBuilt(
    (track) => {
      const f = floorTextures()
      return { planks: track(f.planks), lines: track(f.lines), blocks: track(blockTexture()), sign: track(signTexture()), booth: track(boothTexture()) }
    },
    [],
  )

  const built = useBuilt((track) => {
    const r = rng(2016)
    /* ---- room shell (walls + ceiling share the cinderblock texture) */
    const shell = new Parts()
    const wallCol = '#5b4d86'
    shell.add(new PlaneGeometry(2 * W, H), wallCol, [0, H / 2, BACK])
    shell.add(new PlaneGeometry(FRONT - BACK, H), '#4e4378', [-W, H / 2, (BACK + FRONT) / 2], [0, Math.PI / 2, 0])
    shell.add(new PlaneGeometry(FRONT - BACK, H), '#4e4378', [W, H / 2, (BACK + FRONT) / 2], [0, -Math.PI / 2, 0])
    shell.add(new PlaneGeometry(2 * W, H), '#3f3766', [0, H / 2, FRONT], [0, Math.PI, 0])
    shell.add(new PlaneGeometry(2 * W, FRONT - BACK), '#1c1830', [0, H, (BACK + FRONT) / 2], [Math.PI / 2, 0, 0])

    /* ---- solid props (one Lambert, vertex coloured) */
    const p = new Parts()
    // ceiling trusses
    for (let z = BACK + 1.5; z < FRONT; z += 3.2) {
      p.add(new BoxGeometry(2 * W, 0.18, 0.12), '#2b2638', [0, H - 0.5, z])
      p.add(new BoxGeometry(2 * W, 0.08, 0.08), '#2b2638', [0, H - 1.1, z])
      for (let x = -W + 0.5; x < W; x += 1) p.add(new BoxGeometry(0.05, 0.62, 0.05), '#2b2638', [x, H - 0.8, z], [0, 0, x % 2 ? 0.7 : -0.7])
    }
    // folded bleachers along the left wall
    for (let i = 0; i < 7; i++) p.add(new BoxGeometry(0.42, 0.42, 9), i % 2 ? '#6d5a3a' : '#7d6844', [-W + 0.25 + i * 0.05, 0.21 + i * 0.42, 0.5])
    // basketball backboard + hoop (raised) on the back wall
    p.add(new BoxGeometry(1.8, 1.05, 0.06), '#e9eef2', [0, 5.3, BACK + 0.7])
    p.add(new BoxGeometry(0.6, 0.45, 0.07), '#c03a2b', [0, 5.05, BACK + 0.68])
    p.add(new TorusGeometry(0.23, 0.018, 6, 18), '#e0571f', [0, 4.75, BACK + 1.0], [Math.PI / 2, 0, 0])
    p.add(new BoxGeometry(0.1, 0.1, 0.7), '#4a4a55', [0, 5.95, BACK + 0.35])
    // banner pennants on the right wall
    for (let i = 0; i < 5; i++) p.add(new BoxGeometry(0.04, 1.3, 2), i % 2 ? '#b8264f' : '#e8c55a', [W - 0.03, 4.6, -5 + i * 2.6])
    // round tables with cloths + centrepieces
    const tables: V3[] = [
      [-4.6, 0, 2.6],
      [4.8, 0, 3.4],
      [-5.2, 0, -2.2],
      [5.3, 0, -3.6],
      [-3.6, 0, 6.2],
      [3.9, 0, 7.2],
    ]
    for (const t of tables) {
      p.add(new CylinderGeometry(0.75, 0.82, 0.76, 18, 1, true), '#f1e7ef', [t[0], 0.38, t[2]])
      p.add(new CylinderGeometry(0.75, 0.75, 0.02, 18), '#f7eef4', [t[0], 0.77, t[2]])
      p.add(new CylinderGeometry(0.06, 0.1, 0.25, 8), '#d8b26a', [t[0], 0.9, t[2]])
    }
    // punch station: a long draped table, a crystal bowl of pink punch, cups, and masquerade masks
    p.group([-4.6, 0, -4.4], 0.35, 1, () => {
      p.add(new BoxGeometry(2.4, 0.78, 0.8), '#f6eef4', [0, 0.39, 0])
      p.add(new BoxGeometry(2.45, 0.05, 0.85), '#d8b26a', [0, 0.8, 0])
      p.add(new CylinderGeometry(0.28, 0.12, 0.2, 18, 1, true), '#e8f0ff', [0, 0.94, 0])
      p.add(new CylinderGeometry(0.26, 0.26, 0.02, 18), '#ff5a9a', [0, 1.0, 0])
      p.add(new CylinderGeometry(0.16, 0.2, 0.04, 14), '#d8b26a', [0, 0.84, 0])
      for (let k = 0; k < 10; k++) p.add(new CylinderGeometry(0.035, 0.028, 0.09, 8), k % 3 ? '#ff7ab8' : '#e9e3f2', [-1.0 + (k % 5) * 0.12, 0.87, -0.2 + Math.floor(k / 5) * 0.14])
      for (let k = 0; k < 6; k++) {
        const x = 0.45 + (k % 3) * 0.22
        const z = -0.18 + Math.floor(k / 3) * 0.28
        const c = ['#d8b26a', '#c9a0c8', '#2b2638', '#c94b7b', '#e9e3f2', '#6a4bd6'][k]
        p.add(new BoxGeometry(0.18, 0.05, 0.01), c, [x, 0.83, z], [-Math.PI / 2 + 0.1, 0, 0])
        p.add(new ConeGeometry(0.025, 0.12, 4), c, [x + 0.08, 0.83, z - 0.06], [-Math.PI / 2, 0, -0.6])
      }
    })

    p.group([W - 0.9, 0, -0.6], -Math.PI / 2, 1, () => {
      p.add(new BoxGeometry(2.5, 0.12, 0.12), '#c9a24a', [0, 2.62, 0.02])
      p.add(new BoxGeometry(0.12, 2.62, 0.12), '#c9a24a', [-1.2, 1.31, 0.02])
      p.add(new BoxGeometry(0.12, 2.62, 0.12), '#c9a24a', [1.2, 1.31, 0.02])
      p.add(new BoxGeometry(0.5, 0.42, 0.4), '#2c2238', [1.55, 0.21, 0.5])
    })
    p.add(new CylinderGeometry(0.02, 0.02, 1.5, 6, 1, true), '#222', [-1.4, 0.75, -1.6])
    p.add(new CylinderGeometry(0.25, 0.25, 0.03, 10), '#222', [-1.4, 0.015, -1.6])
    // backdrop curtain rail
    p.add(new BoxGeometry(4.3, 0.08, 0.08), '#2a2236', [0, 4.02, -2.35])
    // streamers: crepe swags radiating from the ceiling centre
    const centre: V3 = [0, H - 0.35, 0.5]
    const streamCols = ['#ff7ab8', '#b48cff', '#e9e3f2', '#ffd27a']
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2
      const end: V3 = [Math.cos(a) * 7.6, H - 0.6, 0.5 + Math.sin(a) * 7.8]
      const pts = catenary(centre, end, 1.1, 16).map((v) => new Vector3(...v))
      p.add(new TubeGeometry(new CatmullRomCurve3(pts), 24, 0.035, 4, false), streamCols[i % 4], [0, 0, 0], [0, 0, 0], [1, 1, 1])
    }
    // hanging spiral streamers above the dance floor
    for (let i = 0; i < 26; i++) {
      const x = range(r, -6, 6)
      const z = range(r, -5, 7)
      if (Math.hypot(x, z) < 1.6) continue
      const len = range(r, 0.8, 1.8)
      p.add(new BoxGeometry(0.06, len, 0.004), pick(r, streamCols), [x, H - 0.6 - len / 2, z], [0, r() * 3, 0])
    }

    /* ---- self-lit bits (one basic material): windows, exit sign, ring light */
    const e = new Parts()
    const win = new Parts()
    for (let i = 0; i < 6; i++) {
      const x = -6.25 + i * 2.5
      win.add(new PlaneGeometry(1.9, 1.1), '#ffffff', [x, 6.0, BACK + 0.02])
    }
    e.add(new PlaneGeometry(0.5, 0.22), '#ff3b3b', [-W + 0.02, 3.1, 6], [0, Math.PI / 2, 0])
    e.add(new TorusGeometry(0.3, 0.035, 6, 28), '#fff4ec', [-1.4, 1.65, -1.6], [0, Math.PI / 2 + 0.6, 0])
    // mullions drawn as dark bars in the props
    for (let i = 0; i < 6; i++) {
      const x = -6.25 + i * 2.5
      p.add(new BoxGeometry(0.06, 1.1, 0.04), '#2b2638', [x, 6.0, BACK + 0.05])
      p.add(new BoxGeometry(1.9, 0.06, 0.04), '#2b2638', [x, 6.0, BACK + 0.05])
      p.add(new BoxGeometry(2.05, 0.08, 0.1), '#2b2638', [x, 5.42, BACK + 0.05])
    }

    /* ---- backdrop curtain: gently pleated sheet */
    const curtain = new PlaneGeometry(4.2, 4.0, 60, 1)
    const cp = curtain.attributes.position
    for (let i = 0; i < cp.count; i++) cp.setZ(i, Math.sin(cp.getX(i) * 9) * 0.05)
    curtain.computeVertexNormals()

    /* ---- balloon arch (garland of 3 per sample) + floor clusters */
    const balloons: Inst[] = []
    const arch = (t: number): V3 => [Math.cos(t) * 1.45, Math.sin(t) * 2.75, -1.45]
    for (let i = 0; i <= 46; i++) {
      const t = (i / 46) * Math.PI
      const c = arch(t)
      const tang = new Vector3(-Math.sin(t) * 1.45, Math.cos(t) * 2.75, 0).normalize()
      const nrm = new Vector3(tang.y, -tang.x, 0)
      for (let k = 0; k < 3; k++) {
        const a = (k / 3) * Math.PI * 2 + i * 0.9
        const o = nrm.clone().multiplyScalar(Math.cos(a) * 0.15).add(new Vector3(0, 0, Math.sin(a) * 0.15))
        const s = range(r, 0.13, 0.19)
        balloons.push({ p: [c[0] + o.x, c[1] + o.y, c[2] + o.z], s: [s, s * 1.12, s], r: [range(r, -0.4, 0.4), 0, range(r, -0.4, 0.4)], c: pick(r, BALLOON_COLORS) })
      }
    }
    for (const sx of [-1, 1]) {
      for (let k = 0; k < 7; k++) {
        const s = range(r, 0.15, 0.22)
        balloons.push({ p: [sx * (1.45 + range(r, -0.25, 0.3)), s * 0.9 + (k > 3 ? 0.3 : 0), -1.45 + range(r, -0.3, 0.3)], s: [s, s * 1.12, s], c: pick(r, BALLOON_COLORS) })
      }
    }
    // centrepiece balloon bunches on the tables
    for (const t of tables) for (let k = 0; k < 3; k++) balloons.push({ p: [t[0] + range(r, -0.2, 0.2), 1.45 + k * 0.08, t[2] + range(r, -0.2, 0.2)], s: [0.16, 0.18, 0.16], c: pick(r, BALLOON_COLORS) })
    // balloons floating against the ceiling
    for (let i = 0; i < 40; i++) balloons.push({ p: [range(r, -7, 7), H - 0.25 - r() * 0.15, range(r, -6, 8)], s: [0.16, 0.18, 0.16], c: pick(r, BALLOON_COLORS) })

    /* ---- fairy-light curtain behind the arch + marquee bulbs */
    const fairy: GlowPoint[] = []
    for (let s = 0; s < 26; s++) {
      const x = -2 + (s / 25) * 4
      for (let k = 0; k < 26; k++) fairy.push({ p: [x + range(r, -0.02, 0.02), 3.95 - k * 0.15 - (s % 2) * 0.075, -2.25], c: k % 7 === 3 ? '#ffb3d9' : '#ffd9a8', s: 0.055, ph: r() })
    }

    return {
      shellGeo: track(shell.build()),
      propGeo: track(p.build()),
      emisGeo: track(e.build()),
      winGeo: track(win.build()),
      curtainGeo: track(curtain),
      balloonGeo: track(blob(1, 0.02, 4)),
      balloons,
      fairy,
      shellMat: track(new MeshLambertMaterial({ map: tex.blocks, vertexColors: true })),
      propMat: track(new MeshLambertMaterial({ vertexColors: true, side: DoubleSide })),
      emisMat: track(new MeshBasicMaterial({ vertexColors: true, toneMapped: false })),
      curtainMat: track(new MeshLambertMaterial({ color: '#3a1f4d', emissive: '#1a0a24', side: DoubleSide })),
      balloonMat: track(new MeshStandardMaterial({ roughness: 0.28, metalness: 0.45, envMapIntensity: 1.4 })),
      floorMat: track(new MeshStandardMaterial({ map: tex.planks, color: '#9c8496', roughness: 0.2, metalness: 0.0, envMapIntensity: 0.7 })),
      linesMat: track(new MeshBasicMaterial({ map: tex.lines, transparent: true, opacity: 0.6, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 })),
      signMat: track(new MeshBasicMaterial({ map: tex.sign, transparent: true, depthWrite: false, blending: AdditiveBlending, toneMapped: false })),
      boothMat: track(new MeshLambertMaterial({ map: tex.booth, emissive: '#2a1420' })),
    }
  }, [tex])

  // time of day: windows and ambient colour
  const look = useMemo(
    () =>
      golden
        ? { window: '#ffb36a', hemi: ['#b07a8e', '#3a2026', 0.75] as [string, string, number], rim: '#ffb27a', fog: '#3a2533', floorTint: '#ffffff' }
        : { window: '#2b3f8f', hemi: ['#5a4aa0', '#1d1028', 0.62] as [string, string, number], rim: '#a98bff', fog: '#1b1430', floorTint: '#e6dcff' },
    [golden],
  )
  const haze = weather === 'fog'

  return (
    <>
      <color attach="background" args={[look.fog]} />
      <fog attach="fog" args={[look.fog, haze ? 4 : 9, haze ? 18 : 30]} />
      <SceneLights
        spot={spot}
        envKey={time}
        hemi={look.hemi}
        keyLight={{ color: '#ffe8ee', intensity: 2.3 }}
        rim={{ color: look.rim, intensity: 2.6 }}
        env={{ intensity: 0.85, front: '#fff0f4', back: look.rim, ambient: golden ? '#5a3a44' : '#2a2050', extra: [{ color: '#ff4fa8', intensity: 1.2, position: [0, 2.5, -3], scale: [3, 0.8] }] }}
      />
      {/* gym floor */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, (BACK + FRONT) / 2]} material={built.floorMat}>
        <planeGeometry args={[2 * W, FRONT - BACK]} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.001, (BACK + FRONT) / 2]} material={built.linesMat} renderOrder={1}>
        <planeGeometry args={[2 * W, FRONT - BACK]} />
      </mesh>
      <mesh geometry={built.shellGeo} material={built.shellMat} />
      <mesh geometry={built.propGeo} material={built.propMat} />
      <mesh geometry={built.winGeo}>
        <meshBasicMaterial color={look.window} toneMapped={false} />
      </mesh>
      <mesh geometry={built.emisGeo} material={built.emisMat} />
      {/* backdrop: curtain, fairy lights, neon sign */}
      <mesh geometry={built.curtainGeo} material={built.curtainMat} position={[0, 2.0, -2.4]} />
      <GlowPoints points={built.fairy} mode="twinkle" animate={animate} intensity={golden ? 0.8 : 1} />
      <mesh position={[0, 3.38, -1.3]} material={built.signMat} renderOrder={6}>
        <planeGeometry args={[2.1, 0.79]} />
      </mesh>
      <Instanced geometry={built.balloonGeo} material={built.balloonMat} items={built.balloons} />
      {/* photo booth backdrop */}
      <mesh position={[W - 0.85, 1.3, -0.6]} rotation-y={-Math.PI / 2} material={built.boothMat}>
        <planeGeometry args={[2.3, 2.5]} />
      </mesh>
      <DiscoBall animate={animate} intensity={1} />
      <Beam from={[-4.5, H - 0.3, 3]} to={BALL} radius={0.3} color={golden ? '#ffd2b0' : '#d8c8ff'} opacity={haze ? 0.22 : 0.1} />
      <Beam from={[0, H - 0.2, 4.5]} to={[spot[0], 0, spot[2]]} radius={1.25} color="#ffe2ef" opacity={haze ? 0.12 : 0.05} falloff={0.4} />
      <LightPool position={spot} color="#ffd6e6" size={3.2} opacity={0.32} />
      <Crowd people={crowdPeople} animate={animate} />
      <BlobShadow position={spot} />
      {haze && <Mist animate={animate} color="#b9a6e0" opacity={0.35} size={18} center={[0, 0, -1]} layers={3} height={0.7} additive />}
    </>
  )
}
