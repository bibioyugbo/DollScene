import { Crowd, guest, scatter } from './kit/Crowd'
import { useMemo } from 'react'
import { BoxGeometry, CylinderGeometry, DoubleSide, MeshLambertMaterial, MeshStandardMaterial, PlaneGeometry, TorusGeometry, Vector3 } from 'three'
import { Palms, type PalmSpec } from './kit/beach-palms'
import { canvasTexture, Parts, pick, range, rng, speckle, useBuilt } from './kit/core'
import { GlowPoints, type GlowPoint } from './kit/Glow'
import { Instanced, type Inst } from './kit/Instanced'
import { BlobShadow, LightPool, SceneLights } from './kit/Lights'
import { SkyDome, type SkyParams } from './kit/Sky'
import { StringLights, type Span } from './kit/StringLights'
import { Falling, Rain } from './kit/Weather'
import { blob, chiavariChair } from './kit/shapes'
import type { SceneProps, TimeOfDay, V3, Weather } from './types'

/**
 * Best Friend's Wedding: a Lagos garden owambe. The couple's flower arch behind the doll, gold
 * chiavari chairs down both sides of an ivory aisle, aso-ebi coloured tables (coral, gold,
 * emerald) under a draped canopy, palms and festoon lights. Clear centre and aisle for photos.
 */

const ASO_EBI = ['#e8735a', '#d9b25f', '#1f7a5c', '#c94b7b', '#f2e6cf']
const FLOWERS = ['#ffffff', '#f6d7de', '#f2b8c6', '#e9c46a', '#fff1e0', '#d97a9a']

interface Look {
  sky: SkyParams
  fog: string
  hemi: [string, string, number]
  key: { color: string; intensity: number }
  rim: { color: string; intensity: number }
  env: { front: string; back: string; ambient: string; intensity: number }
  lights: number
  lawn: string
}

function look(time: TimeOfDay, weather: Weather): Look {
  const rain = weather === 'rain'
  let l: Look
  if (time === 'morning')
    l = {
      sky: { top: '#5aa0e0', mid: '#e8f1f2', bottom: '#b9c4a0', sunDir: [0.5, 0.6, 0.4], sunColor: '#fff6e0', sunSize: 0, sunGlow: 0.6, clouds: 0.3, cloudLit: '#ffffff', cloudShade: '#b6c2d4', haze: 0.65 },
      fog: '#e5ece6',
      hemi: ['#e0efff', '#5a6a3a', 1],
      key: { color: '#fff6ea', intensity: 2.2 },
      rim: { color: '#fff4d8', intensity: 1.6 },
      env: { front: '#fffaf0', back: '#ffeccc', ambient: '#9aaa8a', intensity: 0.95 },
      lights: 0.15,
      lawn: '#ffffff',
    }
  else if (time === 'golden')
    l = {
      sky: { top: '#4f6aa6', mid: '#ffc489', bottom: '#8a6a3a', sunDir: [-0.3, 0.08, -1], sunColor: '#ffc37a', sunSize: 0.035, sunGlow: 1.4, clouds: 0.35, cloudLit: '#ffd9a8', cloudShade: '#9a7088', haze: 0.55 },
      fog: '#f3b98a',
      hemi: ['#ffd9b0', '#4a3a20', 0.85],
      key: { color: '#ffe9d2', intensity: 2.1 },
      rim: { color: '#ffae55', intensity: 3.2 },
      env: { front: '#fff0e0', back: '#ffb35a', ambient: '#7a5a3a', intensity: 0.95 },
      lights: 0.6,
      lawn: '#fff0dc',
    }
  else
    l = {
      sky: { top: '#060a1e', mid: '#1f2748', bottom: '#14141c', stars: 1, moonDir: [0.4, 0.45, -1], moonSize: 0.03, moonColor: '#fff6e0', clouds: 0.2, cloudLit: '#3a4262', cloudShade: '#10142a', haze: 0.6 },
      fog: '#1a2036',
      hemi: ['#4a5288', '#1a140c', 0.55],
      key: { color: '#ffe0b8', intensity: 2.0 },
      rim: { color: '#ffd28a', intensity: 2.4 },
      env: { front: '#ffe6c4', back: '#ffcf8a', ambient: '#2a2438', intensity: 0.8 },
      lights: 1,
      lawn: '#c8c8d0',
    }
  if (rain) {
    const night = time === 'night'
    l.sky = { ...l.sky, top: night ? '#0c1120' : '#6f7a8a', mid: night ? '#222838' : '#a9aeb0', clouds: 0.95, cloudLit: night ? '#363c4e' : '#d0d4d8', cloudShade: night ? '#121622' : '#7a808a', sunSize: 0, sunGlow: 0.2, stars: 0, moonSize: 0 }
    l.fog = night ? '#20263a' : '#9ea3a6'
    l.rim = { ...l.rim, intensity: l.rim.intensity * 0.6 }
    l.lights = Math.max(l.lights, 0.7)
    l.lawn = night ? '#9a9aa4' : '#cfd2cc'
  }
  return l
}

function lawnTexture() {
  return canvasTexture(
    512,
    512,
    (ctx, w, h) => {
      const r = rng(61)
      ctx.fillStyle = '#4f7a34'
      ctx.fillRect(0, 0, w, h)
      speckle(ctx, w, h, r, 12000, ['#5f8c3c', '#3f6a2a', '#6f9a44', '#47722e'], [1, 3], [0.4, 0.9])
    },
    { repeat: [10, 10], anisotropy: 4 },
  )
}

function runnerTexture() {
  return canvasTexture(256, 1024, (ctx, w, h) => {
    ctx.fillStyle = '#f7f1e6'
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = '#d9b25f'
    ctx.fillRect(10, 0, 8, h)
    ctx.fillRect(w - 18, 0, 8, h)
    // scattered petals
    const r = rng(8)
    for (let i = 0; i < 260; i++) {
      ctx.globalAlpha = range(r, 0.5, 0.95)
      ctx.fillStyle = pick(r, ['#f2b8c6', '#ffffff', '#e9c46a', '#d97a9a'])
      ctx.beginPath()
      ctx.ellipse(r() * w, r() * h, 3, 5, r() * 3, 0, Math.PI * 2)
      ctx.fill()
    }
  })
}

const PALMS: PalmSpec[] = [
  { p: [-4.2, 0, -2.4], height: 6.5, lean: 0.12, dir: 0.4, seed: 11 },
  { p: [4.6, 0, -2.8], height: 7.2, lean: 0.1, dir: 2.6, seed: 12 },
  { p: [-6.5, 0, 2.2], height: 6, lean: 0.14, dir: -0.3, seed: 13 },
  { p: [7, 0, 1.8], height: 6.6, lean: 0.12, dir: 3.4, seed: 14 },
  { p: [-2.6, 0, -6.5], height: 7.8, lean: 0.08, dir: 1, seed: 15 },
  { p: [2.2, 0, -7.2], height: 7, lean: 0.1, dir: 2, seed: 16 },
]

export default function Wedding({ time, weather, animate, spot }: SceneProps) {
  const crowdPeople = useMemo(() => {
    const r = rng(2026)
    return scatter(r, 24, [-7, 7, -2, 8.5], [{ p: [0, 0, 0] as V3, r: 2.4 }, { p: [0, 0, 2.8] as V3, r: 2.4 }, { p: [-3, 0, -0.6] as V3, r: 2.4 }]).map((pp) => guest(r, pp, ['#e8735a', '#d9b25f', '#1f7a5c', '#c94b7b', '#f2e6cf', '#7a1f2b'], ['dance','dance','stand','drink','selfie','cheer'], ['gele','gele','fila','none'], ['#d9b25f','#e8735a','#1f7a5c','#c94b7b']))
  }, [])
  const l = useMemo(() => look(time, weather), [time, weather])
  const tex = useBuilt((track) => ({ lawn: track(lawnTexture()), runner: track(runnerTexture()) }), [])

  const built = useBuilt(
    (track) => {
      const r = rng(2026)
      const p = new Parts()
      /* the arch: two gold posts and a curved top, wrapped in fabric */
      for (const sx of [-1.25, 1.25]) {
        p.add(new CylinderGeometry(0.05, 0.06, 2.7, 10), '#d4b26a', [sx, 1.35, -1.1])
        p.add(new CylinderGeometry(0.22, 0.26, 0.12, 12), '#d4b26a', [sx, 0.06, -1.1])
      }
      p.add(new TorusGeometry(1.25, 0.05, 8, 40, Math.PI), '#d4b26a', [0, 2.7, -1.1])
      // fabric drapes hanging from the arch (ivory and gold)
      for (const sx of [-1, 1]) {
        p.add(new BoxGeometry(0.5, 2.9, 0.02), '#f7f0e2', [sx * 1.45, 1.6, -1.2], [0, 0, sx * 0.05])
        p.add(new BoxGeometry(0.3, 2.6, 0.02), '#e5c77e', [sx * 1.62, 1.5, -1.18], [0, 0, sx * 0.08])
      }
      /* stage backdrop: pleated ivory wall with gold trim */
      p.add(new BoxGeometry(6.4, 3.4, 0.08), '#f4ead8', [0, 1.7, -2.6])
      p.add(new BoxGeometry(6.5, 0.12, 0.12), '#d4b26a', [0, 3.42, -2.55])
      for (let i = 0; i < 16; i++) p.add(new BoxGeometry(0.18, 3.3, 0.06), i % 2 ? '#efe2c8' : '#fbf5ea', [-3 + i * 0.4, 1.7, -2.52])
      // the couple's sweetheart table and two throne chairs behind the arch
      p.add(new BoxGeometry(1.8, 0.75, 0.7), '#fbf5ea', [0, 0.38, -2.05])
      p.add(new BoxGeometry(1.9, 0.04, 0.8), '#d4b26a', [0, 0.77, -2.05])
      for (const sx of [-0.45, 0.45]) {
        p.add(new BoxGeometry(0.62, 1.4, 0.1), '#d4b26a', [sx, 0.95, -2.42])
        p.add(new BoxGeometry(0.56, 0.5, 0.5), '#f7f0e2', [sx, 0.3, -2.3])
      }
      /* guest tables in aso-ebi colours at the sides */
      const tables: V3[] = [
        [-4.4, 0, 0.8],
        [4.6, 0, 1.2],
        [-5, 0, 4.4],
        [5.2, 0, 4.8],
        [-3.8, 0, -1.8],
        [4, 0, -1.4],
      ]
      tables.forEach((t, i) => {
        const cloth = ASO_EBI[i % ASO_EBI.length]
        p.add(new CylinderGeometry(0.85, 0.95, 0.76, 20, 1, true), cloth, [t[0], 0.38, t[2]])
        p.add(new CylinderGeometry(0.85, 0.85, 0.02, 20), '#fbf5ea', [t[0], 0.77, t[2]])
        p.add(new CylinderGeometry(0.03, 0.03, 0.5, 6), '#d4b26a', [t[0], 1.02, t[2]])
      })
      /* canopy poles and a draped roof over the guests (open in the middle for the sky) */
      const poles: V3[] = [
        [-3.2, 0, -2.6],
        [3.2, 0, -2.6],
        [-3.2, 0, 6.5],
        [3.2, 0, 6.5],
        [-6.2, 0, -2.6],
        [6.2, 0, -2.6],
        [-6.2, 0, 6.5],
        [6.2, 0, 6.5],
      ]
      for (const q of poles) p.add(new CylinderGeometry(0.06, 0.07, 3.6, 8), '#f4ead8', [q[0], 1.8, q[2]])
      for (const sx of [-1, 1]) {
        const drape = new PlaneGeometry(3.2, 9.4, 1, 18)
        const dp = drape.attributes.position
        for (let i = 0; i < dp.count; i++) dp.setZ(i, -Math.abs(Math.sin((dp.getY(i) / 9.4) * Math.PI * 3)) * 0.35)
        drape.computeVertexNormals()
        p.add(drape, '#fbf5ea', [sx * 4.7, 3.55, 1.95], [-Math.PI / 2, 0, 0])
      }
      /* the aisle: chairs in rows, both sides */
      const chairs: Inst[] = []
      for (let row = 0; row < 6; row++) {
        const z = 0.9 + row * 0.9
        for (let k = 0; k < 3; k++) {
          const x = 1.15 + k * 0.62
          chairs.push({ p: [x, 0, z], r: Math.PI })
          chairs.push({ p: [-x, 0, z], r: Math.PI })
        }
      }
      // chairs around the guest tables
      tables.forEach((t) => {
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * Math.PI * 2
          chairs.push({ p: [t[0] + Math.cos(a) * 1.25, 0, t[2] + Math.sin(a) * 1.25], r: -a - Math.PI / 2 })
        }
      })
      /* flowers on the arch and table centrepieces */
      const flowers: Inst[] = []
      for (let i = 0; i <= 60; i++) {
        const a = (i / 60) * Math.PI
        const c = new Vector3(Math.cos(a) * 1.25, 2.7 + Math.sin(a) * 1.25, -1.1)
        if (a > 0.6 && a < 2.5 && r() < 0.35) continue
        for (let k = 0; k < 2; k++) {
          const s = range(r, 0.08, 0.15)
          flowers.push({ p: [c.x + range(r, -0.1, 0.1), c.y + range(r, -0.1, 0.1), c.z + range(r, -0.12, 0.12)], s, c: pick(r, FLOWERS) })
        }
      }
      // floor arrangements at the arch feet
      for (const sx of [-1.25, 1.25]) for (let k = 0; k < 16; k++) flowers.push({ p: [sx + range(r, -0.35, 0.35), range(r, 0.1, 0.65), -1.1 + range(r, -0.3, 0.3)], s: range(r, 0.1, 0.18), c: pick(r, FLOWERS) })
      tables.forEach((t) => {
        for (let k = 0; k < 6; k++) flowers.push({ p: [t[0] + range(r, -0.12, 0.12), 1.28 + range(r, 0, 0.12), t[2] + range(r, -0.12, 0.12)], s: range(r, 0.07, 0.11), c: pick(r, FLOWERS) })
      })
      // greenery under the flowers
      const leaves: Inst[] = flowers.filter((_, i) => i % 3 === 0).map((f) => ({ p: [f.p[0] + 0.05, f.p[1] - 0.04, f.p[2] - 0.05] as V3, s: 0.14, c: pick(r, ['#2f6a3a', '#3f7a44']) }))
      /* candles on tables and along the aisle */
      const candles: GlowPoint[] = []
      tables.forEach((t) => {
        for (let k = 0; k < 3; k++) candles.push({ p: [t[0] + Math.cos(k * 2.1) * 0.4, 0.86, t[2] + Math.sin(k * 2.1) * 0.4], c: '#ffb45a', s: 0.12, ph: r() })
      })
      for (let z = 0.6; z < 6.4; z += 0.9) for (const sx of [-0.7, 0.7]) candles.push({ p: [sx, 0.32, z], c: '#ffbf6a', s: 0.16, ph: r() })
      const lanterns = new Parts()
      for (let z = 0.6; z < 6.4; z += 0.9) for (const sx of [-0.7, 0.7]) {
        lanterns.add(new BoxGeometry(0.16, 0.26, 0.16), '#d4b26a', [sx, 0.13, z])
        lanterns.add(new BoxGeometry(0.13, 0.2, 0.13), '#fff2d8', [sx, 0.14, z])
      }
      return {
        propGeo: track(p.build()),
        lanternGeo: track(lanterns.build()),
        chairGeo: track(chairiavari()),
        chairs,
        flowerGeo: track(blob(1, 0.25, 7)),
        flowers,
        leaves,
        candles,
        propMat: track(new MeshLambertMaterial({ vertexColors: true, side: DoubleSide })),
        lanternMat: track(new MeshLambertMaterial({ vertexColors: true, emissive: '#3a2400' })),
        chairMat: track(new MeshStandardMaterial({ vertexColors: true, metalness: 0.55, roughness: 0.35, envMapIntensity: 1.2 })),
        flowerMat: track(new MeshLambertMaterial({ color: '#ffffff' })),
        runnerMat: track(new MeshLambertMaterial({ map: tex.runner })),
      }
    },
    [tex],
  )

  const spans = useMemo<Span[]>(
    () => [
      ...[-2.6, 0.4, 3.4, 6.4].map((z) => ({ a: [-3.2, 3.5, z] as V3, b: [3.2, 3.5, z] as V3, sag: 0.45, bulbs: 16 })),
      { a: [-3.2, 3.5, -2.6], b: [-3.2, 3.5, 6.5], sag: 0.3, bulbs: 18 },
      { a: [3.2, 3.5, -2.6], b: [3.2, 3.5, 6.5], sag: 0.3, bulbs: 18 },
    ],
    [],
  )
  const breeze = weather === 'breeze'
  const rain = weather === 'rain'

  return (
    <>
      <color attach="background" args={[l.fog]} />
      <fog attach="fog" args={[l.fog, rain ? 8 : 14, rain ? 32 : 55]} />
      <SkyDome animate={animate} {...l.sky} />
      <SceneLights spot={spot} envKey={`${time}${weather}`} hemi={l.hemi} keyLight={l.key} rim={l.rim} env={{ ...l.env, extra: [{ color: '#ffe6b8', intensity: 0.8, position: [0, 2.6, -2.4], scale: [4, 2] }] }} />
      <mesh rotation-x={-Math.PI / 2}>
        <circleGeometry args={[45, 48]} />
        <meshLambertMaterial map={tex.lawn} color={l.lawn} />
      </mesh>
      {/* the aisle runner, from the arch toward the guests */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.004, 2.6]} material={built.runnerMat}>
        <planeGeometry args={[1.2, 7.6]} />
      </mesh>
      <mesh geometry={built.propGeo} material={built.propMat} />
      <mesh geometry={built.lanternGeo} material={built.lanternMat} />
      <Instanced geometry={built.chairGeo} material={built.chairMat} items={built.chairs} />
      <Instanced geometry={built.flowerGeo} material={built.flowerMat} items={built.leaves} />
      <Instanced geometry={built.flowerGeo} material={built.flowerMat} items={built.flowers} />
      <Palms palms={PALMS} animate={animate} sway={breeze ? 0.12 : rain ? 0.08 : 0.04} />
      <StringLights spans={spans} animate={animate} intensity={l.lights} glow={0.2} />
      <GlowPoints points={built.candles} mode="flicker" animate={animate} intensity={0.5 + l.lights * 0.6} />
      {breeze && <Falling animate={animate} count={110} colors={['#ffffff', '#f6d7de', '#f2b8c6']} kind="petal" center={[0, 0, 1]} radius={5} height={4.5} size={0.06} wind={0.9} />}
      {rain && <Rain animate={animate} />}
      <LightPool position={spot} color={time === 'night' ? '#ffd8a8' : '#fff1dc'} size={3} opacity={0.25} />
      <Crowd people={crowdPeople} animate={animate} />
      <BlobShadow position={spot} />
    </>
  )
}

/** Gold chiavari chair with the white cushion, merged once. */
function chairiavari() {
  return chiavariChair('#d4b26a', '#fbf5ea')
}
