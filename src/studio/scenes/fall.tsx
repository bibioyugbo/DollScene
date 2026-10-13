import { Crowd, guest, scatter } from './kit/Crowd'
import { useLayoutEffect, useMemo, useRef } from 'react'
import {
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  Matrix4,
  MeshBasicMaterial,
  MeshLambertMaterial,
  PlaneGeometry,
  type InstancedMesh,
} from 'three'
import { canvasTexture, compose, mutate, Parts, pick, range, rng, speckle, useAnim, useBuilt } from './kit/core'
import { GlowPoints, type GlowPoint } from './kit/Glow'
import { Instanced, type Inst } from './kit/Instanced'
import { BlobShadow, LightPool, SceneLights } from './kit/Lights'
import { SkyDome, type SkyParams } from './kit/Sky'
import { Falling, Mist, Rain, Snow } from './kit/Weather'
import { addBench, addLampPost, addTree, blob, leafTexture } from './kit/shapes'
import type { SceneProps, TimeOfDay, V3, Weather } from './types'

const FOLIAGE = ['#d9692b', '#c2421f', '#e89a2c', '#a8301c', '#f0b640', '#cf5a1e', '#8e2a1a', '#e07b28']
const LEAVES = ['#d9692b', '#b8321f', '#e8a23a', '#f2c14e', '#9c2a17']

/** Path centre line: winds through the origin and away into the park. */
const pathX = (z: number) => Math.sin(z * 0.13) * 1.7

const TREES: { p: V3; h: number }[] = [
  { p: [-3.4, 0, -3.6], h: 6.2 },
  { p: [3.6, 0, -4.6], h: 6.8 },
  { p: [-0.9, 0, -8.5], h: 7.4 },
  { p: [2.6, 0, -11.5], h: 6.6 },
  { p: [-5.8, 0, -1.2], h: 5.8 },
  { p: [6.4, 0, -1.4], h: 6.2 },
  { p: [-4.8, 0, -11], h: 7 },
  { p: [6.2, 0, -8.5], h: 6.4 },
  { p: [-2.6, 0, -15], h: 7.2 },
  { p: [-6, 0, 4.5], h: 6 },
  { p: [6.5, 0, 5], h: 6.4 },
]
const BENCH: V3 = [2.05, 0, -2.05]
const LAMP: V3 = [-2.35, 0, -1.7]

interface Look {
  sky: SkyParams
  fog: string
  hemi: [string, string, number]
  key: { color: string; intensity: number }
  rim: { color: string; intensity: number }
  env: { front: string; back: string; ambient: string; intensity: number }
  lamp: number
  ground: string
}

function look(time: TimeOfDay, weather: Weather): Look {
  const wet = weather === 'rain'
  const snow = weather === 'snow'
  const fog = weather === 'fog'
  const grey = wet || snow || fog
  let l: Look
  if (time === 'morning') {
    l = {
      sky: { top: '#5f97d1', mid: '#e3e9e6', bottom: '#b8b39a', sunDir: [0.6, 0.55, 0.5], sunColor: '#fff2d6', sunSize: 0, sunGlow: 0.6, clouds: 0.35, cloudLit: '#ffffff', cloudShade: '#aab4c4', haze: 0.7 },
      fog: '#dfe3dc',
      hemi: ['#d6e6f5', '#6b5636', 0.95],
      key: { color: '#fff3e4', intensity: 2.2 },
      rim: { color: '#fff0d0', intensity: 1.7 },
      env: { front: '#fff6ea', back: '#ffe6c0', ambient: '#8a9a8a', intensity: 0.9 },
      lamp: 0,
      ground: '#ffffff',
    }
  } else if (time === 'golden') {
    l = {
      sky: { top: '#4d679f', mid: '#ffb877', bottom: '#8a5a3a', sunDir: [0.35, 0.07, -1], sunColor: '#ffc27a', sunSize: 0.035, sunGlow: 1.3, clouds: 0.4, cloudLit: '#ffcf9a', cloudShade: '#8e6a7e', haze: 0.55 },
      fog: '#f0a872',
      hemi: ['#ffd2a2', '#4e3220', 0.78],
      key: { color: '#ffe7cf', intensity: 2.0 },
      rim: { color: '#ffa04a', intensity: 3.3 },
      env: { front: '#ffeedd', back: '#ffa850', ambient: '#7a5038', intensity: 0.9 },
      lamp: 0.35,
      ground: '#fff2e6',
    }
  } else {
    l = {
      sky: { top: '#070c22', mid: '#27304f', bottom: '#151520', stars: 1, moonDir: [-0.45, 0.42, -1], moonSize: 0.035, moonColor: '#f1ecdc', clouds: 0.25, cloudLit: '#4a5272', cloudShade: '#141a2e', haze: 0.6 },
      fog: '#1d2338',
      hemi: ['#3e4c80', '#1c140c', 0.55],
      key: { color: '#ffdcb0', intensity: 1.9 },
      rim: { color: '#9fb4ff', intensity: 2.2 },
      env: { front: '#ffe2bf', back: '#8ea4ff', ambient: '#1c2238', intensity: 0.75 },
      lamp: 1,
      ground: '#c8c4cc',
    }
  }
  if (grey) {
    const night = time === 'night'
    l.sky = {
      ...l.sky,
      top: night ? '#0d1220' : snow ? '#9fa9b8' : '#6c7686',
      mid: night ? '#262c3c' : snow ? '#dfe3e8' : fog ? '#c9c6bd' : '#a3a39c',
      clouds: night ? 0.5 : 0.9,
      cloudLit: night ? '#3a4052' : '#d6d8dc',
      cloudShade: night ? '#161a26' : '#7d828c',
      sunGlow: (l.sky.sunGlow ?? 0) * 0.3,
      sunSize: 0,
      stars: 0,
      moonSize: 0,
    }
    l.fog = night ? '#232838' : snow ? '#d9dde3' : fog ? '#c6c2b6' : '#8e918e'
    l.rim = { ...l.rim, intensity: l.rim.intensity * 0.6 }
    l.hemi = [l.hemi[0], l.hemi[1], l.hemi[2] * 1.05]
    l.lamp = Math.max(l.lamp, night ? 1 : 0.5)
  }
  if (snow) l.ground = time === 'night' ? '#d8dcea' : '#ffffff'
  if (wet) l.ground = time === 'night' ? '#9a98a2' : '#c8c2b8'
  return l
}

function groundTexture(snow: boolean) {
  return canvasTexture(
    512,
    512,
    (ctx, w, h) => {
      const r = rng(snow ? 41 : 40)
      ctx.fillStyle = snow ? '#e9edf2' : '#62692f'
      ctx.fillRect(0, 0, w, h)
      if (!snow) {
        speckle(ctx, w, h, r, 9000, ['#4f5826', '#7a7a34', '#8a7d3a', '#556a2a'], [1, 3], [0.4, 0.8])
      } else {
        speckle(ctx, w, h, r, 4000, ['#d5dce6', '#ffffff', '#c9d2de'], [1, 4], [0.3, 0.7])
      }
      // fallen leaves
      for (let i = 0; i < (snow ? 220 : 900); i++) {
        ctx.save()
        ctx.translate(r() * w, r() * h)
        ctx.rotate(r() * Math.PI)
        ctx.globalAlpha = range(r, 0.55, 0.95)
        ctx.fillStyle = pick(r, LEAVES)
        ctx.beginPath()
        ctx.ellipse(0, 0, range(r, 2, 4), range(r, 4, 8), 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      }
      ctx.globalAlpha = 1
    },
    { repeat: [26, 26], anisotropy: 8 },
  )
}

function pathTexture(snow: boolean) {
  return canvasTexture(
    256,
    512,
    (ctx, w, h) => {
      const r = rng(7)
      ctx.clearRect(0, 0, w, h)
      const g = ctx.createLinearGradient(0, 0, w, 0)
      g.addColorStop(0, 'rgba(0,0,0,0)')
      g.addColorStop(0.1, 'rgba(255,255,255,1)')
      g.addColorStop(0.9, 'rgba(255,255,255,1)')
      g.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, w, h)
      ctx.globalCompositeOperation = 'source-atop'
      ctx.fillStyle = snow ? '#e4e8ee' : '#b39a78'
      ctx.fillRect(0, 0, w, h)
      speckle(ctx, w, h, r, 7000, snow ? ['#c8d0dc', '#ffffff'] : ['#8f7a5c', '#cdb895', '#a08866', '#e0cfae'], [1, 3], [0.4, 0.9])
      for (let i = 0; i < (snow ? 30 : 140); i++) {
        ctx.save()
        ctx.translate(r() * w, r() * h)
        ctx.rotate(r() * Math.PI)
        ctx.fillStyle = pick(r, LEAVES)
        ctx.globalAlpha = 0.85
        ctx.beginPath()
        ctx.ellipse(0, 0, range(r, 3, 5), range(r, 6, 10), 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      }
    },
    { repeat: [1, 1], anisotropy: 8 },
  )
}

/** Ribbon following the path centre line (uv.u across, uv.v along every 4 m). */
function pathGeometry() {
  const n = 70
  const z0 = 10
  const z1 = -30
  const half = 1.15
  const pos: number[] = []
  const uv: number[] = []
  const idx: number[] = []
  for (let i = 0; i <= n; i++) {
    const z = z0 + ((z1 - z0) * i) / n
    const x = pathX(z)
    const dx = (pathX(z - 0.1) - pathX(z + 0.1)) / -0.2
    const nx = 1 / Math.hypot(1, dx)
    const nz = -dx * nx
    const w = half * (1 + 0.08 * Math.sin(z * 0.9))
    pos.push(x - nx * w, 0, z - nz * w, x + nx * w, 0, z + nz * w)
    const v = (z0 - z) / 4
    uv.push(0, v, 1, v)
    if (i < n) {
      const a = i * 2
      idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3)
    }
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

/** Canopy clumps that sway with the breeze (InstancedMesh matrices updated on the CPU). */
function Foliage({ items, sway, animate }: { items: Inst[]; sway: number; animate: boolean }) {
  const ref = useRef<InstancedMesh>(null)
  const { geo, mat, base } = useBuilt((track) => {
    const geo = track(blob(1, 0.22, 9))
    const mat = track(new MeshLambertMaterial({ color: '#ffffff' }))
    const base = items.map((it, i) => ({ m: compose(it.p, typeof it.r === 'number' ? [0, it.r, 0] : (it.r ?? [0, 0, 0]), it.s ?? 1), y: it.p[1], ph: i * 1.7 }))
    return { geo, mat, base }
  }, [items])
  const m4 = useMemo(() => new Matrix4(), [])
  const off = useMemo(() => new Matrix4(), [])
  const colored = useRef<InstancedMesh | null>(null)
  useAnim(animate, (t) => {
    const m = ref.current
    if (!m) return
    if (colored.current !== m) {
      const c = new Color()
      items.forEach((it, i) => m.setColorAt(i, c.set(it.c ?? '#ffffff')))
      if (m.instanceColor) m.instanceColor.needsUpdate = true
      colored.current = m
    }
    base.forEach((b, i) => {
      const k = Math.max(0, b.y - 1.5) * sway
      off.makeTranslation(Math.sin(t * 1.3 + b.ph) * k, 0, Math.cos(t * 1.05 + b.ph * 0.7) * k * 0.6)
      m4.multiplyMatrices(off, b.m)
      m.setMatrixAt(i, m4)
    })
    m.instanceMatrix.needsUpdate = true
    if (!m.boundingSphere) m.computeBoundingSphere()
  })
  return <instancedMesh ref={ref} args={[geo, mat, items.length]} />
}

export default function Fall({ time, weather, animate, spot }: SceneProps) {
  const crowdPeople = useMemo(() => {
    const r = rng(1031)
    return scatter(r, 10, [-7, 7, -12, 5], [{ p: [0, 0, 0] as V3, r: 2.4 }, { p: [1.7, 0, -1.2] as V3, r: 2.4 }, { p: [-1.8, 0, -0.9] as V3, r: 2.4 }]).map((pp) => guest(r, pp, ['#7a2e1f', '#d9692b', '#3a3a2a', '#e8c55a', '#2a3a5a', '#8a5a3a'], ['stand','stand','selfie','drink'], ['none','cap','none'], ['#7a2e1f','#2a3a5a']))
  }, [])
  const snow = weather === 'snow'
  const L = useMemo(() => look(time, weather), [time, weather])

  const tex = useBuilt((track) => ({ ground: track(groundTexture(snow)), path: track(pathTexture(snow)), leaf: track(leafTexture('maple')) }), [snow])

  const built = useBuilt((track) => {
    const r = rng(1031)
    const wood = new Parts()
    const foliage: Inst[] = []
    for (const [i, t] of TREES.entries()) {
      const tips = addTree(wood, t.p, { height: t.h, seed: 50 + i, color: i % 2 ? '#3d2c22' : '#47332a', depth: 3, spread: 0.85, twist: 0.2, radius: 0.16 })
      const palette = [pick(r, FOLIAGE), pick(r, FOLIAGE), pick(r, FOLIAGE)]
      for (const tip of tips) {
        const n = 2
        for (let k = 0; k < n; k++) {
          const s = range(r, 0.75, 1.15) * (t.h / 6.5)
          foliage.push({
            p: [tip.p[0] + range(r, -0.4, 0.4), tip.p[1] + range(r, -0.2, 0.45), tip.p[2] + range(r, -0.4, 0.4)],
            s: [s, s * 0.82, s],
            r: [r(), r() * 6, r()],
            c: pick(r, palette),
          })
        }
      }
      // inner fill so the canopy reads as a full crown
      for (let k = 0; k < 4; k++) {
        const s = t.h * 0.2
        foliage.push({ p: [t.p[0] + range(r, -0.7, 0.7), t.h * 0.66 + range(r, -0.3, 0.4), t.p[2] + range(r, -0.7, 0.7)], s: [s, s * 0.8, s], r: [r(), r() * 6, r()], c: pick(r, palette) })
      }
      // leaf pile round the trunk
      for (let k = 0; k < 3; k++) {
        const a = r() * Math.PI * 2
        const d = range(r, 0.3, 0.9)
        foliage.push({ p: [t.p[0] + Math.cos(a) * d, 0.02, t.p[2] + Math.sin(a) * d], s: [range(r, 0.45, 0.7), 0.13, range(r, 0.45, 0.7)], c: pick(r, LEAVES) })
      }
    }
    // distant tree line (big muted clumps, fog does the rest)
    for (let i = 0; i < 70; i++) {
      const a = -Math.PI * 0.95 + (i / 70) * Math.PI * 1.9 + range(r, -0.03, 0.03)
      const d = range(r, 22, 30)
      const x = Math.sin(a) * d
      const z = -Math.cos(a) * d
      const s = range(r, 2.6, 4.2)
      foliage.push({ p: [x, s * 0.75, z], s: [s, s * 1.1, s], r: [0, r() * 6, 0], c: pick(r, ['#9a4a26', '#b0662c', '#7a3a22', '#8a6a2c', '#5e5a2a', '#a8521f']) })
    }
    // bushes along the path edges
    for (let i = 0; i < 16; i++) {
      const z = range(r, -14, 6)
      const side = r() < 0.5 ? -1 : 1
      const x = pathX(z) + side * range(r, 1.6, 2.6)
      if (Math.hypot(x - spot[0], z - spot[2]) < 1.6) continue
      const s = range(r, 0.35, 0.6)
      foliage.push({ p: [x, s * 0.55, z], s: [s * 1.3, s, s * 1.2], r: [0, r() * 6, 0], c: pick(r, ['#8e2a1a', '#a8361c', '#6e3a1e', '#7d4a1c']) })
    }

    // bench, lamp posts, bin
    const props = new Parts()
    props.group(BENCH, -0.35, 1, () => addBench(props))
    const lampHeads: V3[] = [addLampPost(props, LAMP), addLampPost(props, [pathX(-9) + 1.9, 0, -9]), addLampPost(props, [pathX(5) - 1.9, 0, 5])]

    // scattered flat leaves round the subject (instanced, alpha-tested quads)
    const ground: Inst[] = []
    for (let i = 0; i < 260; i++) {
      const a = r() * Math.PI * 2
      const d = 0.4 + Math.sqrt(r()) * 6
      const x = spot[0] + Math.cos(a) * d
      const z = spot[2] + Math.sin(a) * d - 1
      ground.push({ p: [x, 0.012 + r() * 0.006, z], r: [-Math.PI / 2, 0, r() * 6], s: range(r, 0.07, 0.12), c: pick(r, LEAVES) })
    }

    const glows: GlowPoint[] = lampHeads.flatMap((p, i) => [
      { p, c: '#ffd59a', s: 0.9, ph: i * 0.3 },
      { p, c: '#fff1d6', s: 0.25, ph: i * 0.3 },
    ])

    return {
      woodGeo: track(wood.build()),
      propGeo: track(props.build()),
      woodMat: track(new MeshLambertMaterial({ vertexColors: true })),
      propMat: track(new MeshLambertMaterial({ vertexColors: true, side: DoubleSide })),
      pathGeo: track(pathGeometry()),
      leafQuad: track(new PlaneGeometry(1, 1)),
      foliage,
      ground,
      lampHeads,
      glows,
    }
  }, [spot[0], spot[2]])

  const mats = useBuilt(
    (track) => ({
      ground: track(new MeshLambertMaterial({ map: tex.ground })),
      path: track(new MeshLambertMaterial({ map: tex.path, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 })),
      leaf: track(new MeshLambertMaterial({ map: tex.leaf, alphaTest: 0.5, side: DoubleSide })),
      lampGlass: track(new MeshBasicMaterial({ color: '#ffe0a8', toneMapped: false })),
    }),
    [tex],
  )
  useLayoutEffect(() => {
    mutate(mats, (m) => {
      m.ground.color.set(L.ground)
      m.path.color.set(L.ground)
    })
  }, [mats, L.ground])

  const night = time === 'night'
  const fogNear = weather === 'fog' ? 2 : weather === 'rain' || snow ? 6 : 12
  const fogFar = weather === 'fog' ? 20 : weather === 'rain' || snow ? 32 : 46
  const leafCount = weather === 'leaves' ? 260 : weather === 'breeze' ? 150 : weather === 'snow' ? 0 : weather === 'rain' ? 25 : 60
  const sway = weather === 'breeze' ? 0.035 : weather === 'leaves' ? 0.02 : weather === 'rain' ? 0.015 : 0.008

  return (
    <>
      <color attach="background" args={[L.fog]} />
      <fog attach="fog" args={[L.fog, fogNear, fogFar]} />
      <SkyDome animate={animate} {...L.sky} bottom={L.fog} />
      <SceneLights spot={spot} envKey={`${time}-${weather}`} hemi={L.hemi} keyLight={L.key} rim={L.rim} env={L.env} />
      <mesh rotation-x={-Math.PI / 2} material={mats.ground}>
        <circleGeometry args={[46, 48]} />
      </mesh>
      <mesh geometry={built.pathGeo} material={mats.path} position-y={0.004} renderOrder={1} />
      <mesh geometry={built.woodGeo} material={built.woodMat} />
      <mesh geometry={built.propGeo} material={built.propMat} />
      <Foliage items={built.foliage} sway={sway} animate={animate} />
      <Instanced geometry={built.leafQuad} material={mats.leaf} items={built.ground} />
      {L.lamp > 0 && (
        <>
          <GlowPoints points={built.glows} mode="steady" intensity={L.lamp} animate={animate} />
          <LightPool position={[LAMP[0], 0, LAMP[2]]} color="#ffc98a" size={3.4} opacity={0.32 * L.lamp} />
          {built.lampHeads.map((p, i) => (
            <mesh key={i} position={p} material={mats.lampGlass} visible={night || weather !== 'clear'}>
              <cylinderGeometry args={[0.1, 0.08, 0.3, 6]} />
            </mesh>
          ))}
        </>
      )}
      <LightPool position={spot} color={night ? '#ffd9b0' : '#fff0dc'} size={2.6} opacity={night ? 0.22 : 0.12} />
      <Crowd people={crowdPeople} animate={animate} />
      <BlobShadow position={spot} opacity={night ? 0.5 : 0.6} />
      {leafCount > 0 && (
        <Falling
          key={weather}
          animate={animate}
          count={leafCount}
          colors={LEAVES}
          kind="maple"
          center={[spot[0], 0, spot[2] - 1]}
          radius={6}
          height={6}
          size={0.11}
          speed={weather === 'breeze' ? 0.7 : 0.5}
          wind={weather === 'breeze' ? 1.4 : weather === 'leaves' ? 0.5 : 0.2}
        />
      )}
      {weather === 'rain' && <Rain animate={animate} center={[spot[0], 0, spot[2]]} opacity={night ? 0.3 : 0.45} color={night ? '#9aa6c0' : '#d6dde6'} />}
      {snow && <Snow animate={animate} center={[spot[0], 0, spot[2]]} />}
      {weather === 'fog' && <Mist animate={animate} color={night ? '#4a5270' : '#e6e2d6'} opacity={0.55} size={30} center={[0, 0, -5]} layers={3} height={0.9} />}
    </>
  )
}
