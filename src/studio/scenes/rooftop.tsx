import { Crowd, guest, scatter } from './kit/Crowd'
import { useLayoutEffect, useMemo } from 'react'
import { BoxGeometry, CylinderGeometry, DoubleSide, MeshLambertMaterial, MeshStandardMaterial, type Texture } from 'three'
import { canvasTexture, mutate, Parts, pick, range, rng, useBuilt } from './kit/core'
import { GlowPoints, type GlowPoint } from './kit/Glow'
import { Instanced, type Inst } from './kit/Instanced'
import { BlobShadow, LightPool, SceneLights } from './kit/Lights'
import { SkyDome, type SkyParams } from './kit/Sky'
import { StringLights, type Span } from './kit/StringLights'
import { Mist, Rain } from './kit/Weather'
import type { SceneProps, TimeOfDay, V3, Weather } from './types'

/**
 * Rooftop Party: a Victoria Island rooftop. Teak deck, glass railing, low lounge sofas, a backlit
 * bar, festoon lights overhead, and the skyline across the lagoon: lit office windows, the Eko
 * Atlantic towers, the bridge lights and their reflections on the water.
 */

const DECK_Z = -4.2 // the railing; the city is beyond it

interface Look {
  sky: SkyParams
  fog: string
  hemi: [string, string, number]
  key: { color: string; intensity: number }
  rim: { color: string; intensity: number }
  env: { front: string; back: string; ambient: string; intensity: number }
  windows: number
  water: string
  towers: string
}

function look(time: TimeOfDay, weather: Weather): Look {
  let l: Look =
    time === 'golden'
      ? {
          sky: { top: '#3e5592', mid: '#ff9e6a', bottom: '#6a4a52', sunDir: [-0.5, 0.06, -1], sunColor: '#ffae60', sunSize: 0.03, sunGlow: 1.5, clouds: 0.35, cloudLit: '#ffbf8a', cloudShade: '#7a5878', haze: 0.55 },
          fog: '#d98a6a',
          hemi: ['#ffcfa8', '#3a2a2a', 0.8],
          key: { color: '#ffe6cc', intensity: 2.1 },
          rim: { color: '#ff9a50', intensity: 3.0 },
          env: { front: '#fff0e0', back: '#ffa060', ambient: '#6a4a4a', intensity: 0.9 },
          windows: 0.35,
          water: '#b0705a',
          towers: '#4a4a62',
        }
      : {
          sky: { top: '#03061a', mid: '#1a2148', bottom: '#120f20', stars: 0.6, moonDir: [0.6, 0.35, -1], moonSize: 0.025, moonColor: '#fff4dc', clouds: 0.2, cloudLit: '#4a3a5a', cloudShade: '#0c0c22', haze: 0.7 },
          fog: '#151a33',
          hemi: ['#3a3e78', '#140e18', 0.5],
          key: { color: '#ffe0bc', intensity: 2.0 },
          rim: { color: '#7fa0ff', intensity: 2.6 },
          env: { front: '#ffe4c4', back: '#6f8cff', ambient: '#1a1a38', intensity: 0.85 },
          windows: 1,
          water: '#0c1430',
          towers: '#141a2e',
        }
  if (weather === 'rain' || weather === 'fog') {
    const night = time === 'night'
    l = {
      ...l,
      sky: { ...l.sky, top: night ? '#0a0e1c' : '#5e6676', mid: night ? '#242a3c' : weather === 'fog' ? '#b4a8a0' : '#98989c', clouds: 0.95, cloudLit: night ? '#3a3e52' : '#c8c8cc', cloudShade: night ? '#121522' : '#6e7280', sunSize: 0, sunGlow: 0.2, stars: 0, moonSize: 0 },
      fog: night ? '#1e2434' : weather === 'fog' ? '#a89c94' : '#86888e',
      rim: { ...l.rim, intensity: l.rim.intensity * 0.6 },
    }
  }
  return l
}

function windowTexture(seed: number) {
  return canvasTexture(256, 512, (ctx, w, h) => {
    const r = rng(seed)
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, w, h)
    const cols = 8
    const rows = 32
    for (let y = 0; y < rows; y++)
      for (let x = 0; x < cols; x++) {
        if (r() < 0.42) continue
        ctx.fillStyle = pick(r, ['#ffd9a0', '#fff1d0', '#bcd8ff', '#ffe6b8', '#ffc880'])
        ctx.globalAlpha = range(r, 0.45, 1)
        ctx.fillRect(x * (w / cols) + 4, y * (h / rows) + 3, w / cols - 8, h / rows - 6)
      }
  })
}

export default function Rooftop({ time, weather, animate, spot }: SceneProps) {
  const crowdPeople = useMemo(() => {
    const r = rng(909)
    return scatter(r, 18, [-7, 7, -3.8, 5.5], [{ p: [0, 0, 0] as V3, r: 2.4 }, { p: [-2.4, 0, 0.8] as V3, r: 2.4 }, { p: [2.6, 0, 0.6] as V3, r: 2.4 }]).map((pp) => guest(r, pp, ['#f2b84b', '#1f3a6b', '#e8e2d6', '#c94b7b', '#0c0c10', '#7a1f2b'], ['drink','drink','selfie','dance','stand','cheer'], ['none','none','shades','party'], ['#f2b84b','#c94b7b']))
  }, [])
  const l = useMemo(() => look(time, weather), [time, weather])
  const wins = useBuilt((track) => [track(windowTexture(5)), track(windowTexture(9)), track(windowTexture(13))] as Texture[], [])
  const built = useBuilt(
    (track) => {
      const r = rng(1010)
      const deck = new Parts()
      // teak deck planks and the parapet
      for (let i = 0; i < 40; i++) deck.add(new BoxGeometry(0.39, 0.05, 11), i % 3 ? '#7a5034' : '#6a442c', [-7.8 + i * 0.4, -0.025, 1])
      deck.add(new BoxGeometry(16.5, 1.0, 0.25), '#2a2a32', [0, -0.5, DECK_Z])
      // lounge: low sofas, cushions, coffee tables, planters
      const sofa = (at: V3, rot: number, col: string) =>
        deck.group(at, rot, 1, () => {
          deck.add(new BoxGeometry(2.2, 0.38, 0.85), '#e9e2d6', [0, 0.19, 0])
          deck.add(new BoxGeometry(2.2, 0.5, 0.2), '#e9e2d6', [0, 0.55, -0.34])
          for (const x of [-0.6, 0, 0.6]) deck.add(new BoxGeometry(0.45, 0.4, 0.14), col, [x, 0.6, -0.2], [-0.2, 0, 0])
        })
      sofa([-3.4, 0, 0.6], 0.6, '#e8735a')
      sofa([-4.6, 0, 2.6], 1.4, '#2fb3c9')
      sofa([3.8, 0, 2.8], -1.3, '#c94b7b')
      deck.add(new CylinderGeometry(0.5, 0.5, 0.36, 18), '#2a2a32', [-3.0, 0.18, 2.0])
      deck.add(new CylinderGeometry(0.5, 0.5, 0.02, 18), '#d9b25f', [-3.0, 0.37, 2.0])
      for (const [x, z] of [
        [-6.8, -3.2],
        [6.8, -3.2],
        [-6.8, 4],
        [6.8, 4.2],
      ])
        deck.add(new BoxGeometry(0.8, 0.7, 0.8), '#3a3a42', [x, 0.35, z])
      // the bar on the right: counter, back shelf, stools
      deck.group([3.2, 0, -1.6], -0.4, 1, () => {
        deck.add(new BoxGeometry(3, 1.05, 0.7), '#1c1c24', [0, 0.52, 0])
        deck.add(new BoxGeometry(3.1, 0.06, 0.8), '#d9b25f', [0, 1.07, 0])
        deck.add(new BoxGeometry(3, 2.2, 0.25), '#24242e', [0, 1.1, -1.1])
        for (const y of [1.1, 1.6]) deck.add(new BoxGeometry(2.8, 0.04, 0.3), '#d9b25f', [0, y, -0.95])
        for (const x of [-1, 0, 1]) {
          deck.add(new CylinderGeometry(0.2, 0.2, 0.06, 12), '#d9b25f', [x, 0.78, 0.65])
          deck.add(new CylinderGeometry(0.03, 0.03, 0.75, 6), '#d9b25f', [x, 0.38, 0.65])
        }
      })
      // glass railing posts and top rail
      for (let x = -8; x <= 8; x += 2) deck.add(new BoxGeometry(0.06, 1.1, 0.06), '#c8ccd4', [x, 0.55, DECK_Z])
      deck.add(new BoxGeometry(16.2, 0.06, 0.1), '#c8ccd4', [0, 1.1, DECK_Z])
      // string-light poles
      for (const x of [-6, 6]) for (const z of [-3.6, 4.6]) deck.add(new CylinderGeometry(0.05, 0.05, 3.2, 6), '#1c1c24', [x, 1.6, z])

      // bottles on the bar shelf (glowing a little)
      const bottles: GlowPoint[] = []
      for (let k = 0; k < 18; k++) {
        const x = -1.3 + (k % 9) * 0.32
        const y = k < 9 ? 1.25 : 1.75
        // bar local (x, -0.95) rotated by the bar's -0.4 rad turn
        const th = -0.4
        const lz = -0.95
        bottles.push({ p: [3.2 + x * Math.cos(th) + lz * Math.sin(th), y, -1.6 - x * Math.sin(th) + lz * Math.cos(th)] as V3, c: pick(r, ['#ffb45a', '#7ad8ff', '#ff6fb0', '#a0ff9a']), s: 0.14, ph: r() })
      }

      // skyline: towers across the lagoon
      const towers: Inst[][] = [[], [], []]
      for (let i = 0; i < 70; i++) {
        const x = range(r, -60, 60)
        const z = range(r, -70, -32)
        const h = range(r, 6, 22) * (Math.abs(x) < 20 ? 1.4 : 1)
        const w = range(r, 2.5, 6)
        towers[i % 3].push({ p: [x, h / 2, z], s: [w, h, range(r, 2.5, 6)] })
      }
      // Eko Atlantic: a cluster of tall glass towers
      for (let i = 0; i < 7; i++) towers[i % 3].push({ p: [-20 + i * 5.5, 20, -55 - (i % 2) * 6], s: [4.5, 40 + (i % 3) * 8, 4.5] })
      // bridge lights over the lagoon
      const bridge: GlowPoint[] = []
      for (let i = 0; i < 80; i++) bridge.push({ p: [-70 + i * 1.75, 1.6 + Math.sin(i * 0.08) * 0.6, -28], c: i % 2 ? '#ffd27a' : '#fff1d0', s: 0.5, ph: i / 80 })
      // aircraft warning lights on the tallest towers
      const beacons: GlowPoint[] = towers.flat().filter((t) => (t.s as V3)[1] > 25).map((t) => ({ p: [t.p[0], (t.s as V3)[1] + 0.3, t.p[2]] as V3, c: '#ff3a3a', s: 1.2, ph: r() }))
      return {
        deckGeo: track(deck.build()),
        deckMat: track(new MeshLambertMaterial({ vertexColors: true, side: DoubleSide })),
        towerGeo: track(new BoxGeometry(1, 1, 1)),
        towers,
        bottles,
        bridge,
        beacons,
        glassMat: track(new MeshStandardMaterial({ color: '#b8d4ff', transparent: true, opacity: 0.16, roughness: 0.05, metalness: 0.2, depthWrite: false })),
      }
    },
    [],
  )
  const towerMats = useBuilt(
    (track) => wins.map((w) => track(new MeshLambertMaterial({ color: '#141a2e', emissiveMap: w, emissive: '#ffffff', emissiveIntensity: 1 }))),
    [wins],
  )
  useLayoutEffect(() => {
    for (const m of towerMats)
      mutate(m, (x) => {
        x.color.set(l.towers)
        x.emissiveIntensity = l.windows
      })
  }, [towerMats, l])

  const spans = useMemo<Span[]>(
    () => [
      { a: [-6, 3.15, -3.6], b: [6, 3.15, 4.6], sag: 0.5, bulbs: 22 },
      { a: [6, 3.15, -3.6], b: [-6, 3.15, 4.6], sag: 0.5, bulbs: 22 },
      { a: [-6, 3.15, -3.6], b: [6, 3.15, -3.6], sag: 0.4, bulbs: 18 },
      { a: [-6, 3.15, 4.6], b: [6, 3.15, 4.6], sag: 0.4, bulbs: 18 },
    ],
    [],
  )
  const rain = weather === 'rain'
  const fog = weather === 'fog'

  return (
    <>
      <color attach="background" args={[l.fog]} />
      <fog attach="fog" args={[l.fog, fog ? 10 : 25, fog ? 45 : 120]} />
      <SkyDome animate={animate} {...l.sky} radius={100} />
      <SceneLights
        spot={spot}
        envKey={`${time}${weather}`}
        hemi={l.hemi}
        keyLight={l.key}
        rim={l.rim}
        env={{ ...l.env, extra: [{ color: '#ffcf8a', intensity: 0.8, position: [0, 3.2, 0], scale: [6, 2] }, { color: '#ff6fb0', intensity: 0.5, position: [3, 1.2, -2], scale: [2, 1] }] }}
      />
      <mesh geometry={built.deckGeo} material={built.deckMat} />
      {/* glass panels of the railing */}
      <mesh position={[0, 0.55, DECK_Z]} material={built.glassMat} renderOrder={3}>
        <planeGeometry args={[16.2, 1.1]} />
      </mesh>
      {/* the lagoon, a little glossy so the city lights shimmer */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -6, -50]}>
        <planeGeometry args={[240, 100]} />
        <meshStandardMaterial color={l.water} roughness={0.25} metalness={0.4} />
      </mesh>
      {built.towers.map((items, i) => (
        <group key={i} position={[0, -6, 0]}>
          <Instanced geometry={built.towerGeo} material={towerMats[i]} items={items} />
        </group>
      ))}
      <group position={[0, -6, 0]}>
        <GlowPoints points={built.bridge} mode="chase" animate={animate} intensity={l.windows} mirrorY={0} />
        <GlowPoints points={built.beacons} mode="flash" animate={animate} intensity={l.windows} />
      </group>
      <GlowPoints points={built.bottles} mode="steady" animate={animate} intensity={0.6} />
      <StringLights spans={spans} animate={animate} intensity={time === 'night' ? 1 : 0.55} color={['#ffcf8a', '#fff1d0']} glow={0.24} />
      {rain && <Rain animate={animate} />}
      {fog && <Mist animate={animate} color="#c8bcb4" opacity={0.4} size={30} center={[0, 0, -8]} layers={3} height={1.2} />}
      <LightPool position={spot} color="#ffd8a8" size={3.2} opacity={0.28} />
      <Crowd people={crowdPeople} animate={animate} />
      <BlobShadow position={spot} />
    </>
  )
}
