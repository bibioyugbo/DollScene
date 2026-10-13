import { Crowd, guest, scatter } from './kit/Crowd'
import { useMemo, useRef } from 'react'
import { BoxGeometry, CatmullRomCurve3, CylinderGeometry, DoubleSide, MeshLambertMaterial, MeshStandardMaterial, SphereGeometry, TubeGeometry, Vector3, type Group } from 'three'
import { Beam } from './kit/Beam'
import { canvasTexture, catenary, Parts, range, rng, useAnim, useBuilt } from './kit/core'
import { GlowPoints, type GlowPoint } from './kit/Glow'
import { Instanced, type Inst } from './kit/Instanced'
import { BlobShadow, LightPool, SceneLights } from './kit/Lights'
import { SkyDome, type SkyParams } from './kit/Sky'
import { Rain } from './kit/Weather'
import { figure } from './kit/shapes'
import type { SceneProps, TimeOfDay, V3, Weather } from './types'

/**
 * Movie Festival: the red carpet. A step-and-repeat wall behind the doll, velvet ropes on brass
 * stanchions along the carpet, a marquee lined with chasing bulbs, sweeping searchlights, and a
 * press pen of photographers whose flashes pop at random.
 */

interface Look {
  sky: SkyParams
  fog: string
  hemi: [string, string, number]
  key: { color: string; intensity: number }
  rim: { color: string; intensity: number }
  env: { front: string; back: string; ambient: string; intensity: number }
  bulbs: number
  beams: number
}

function look(time: TimeOfDay, weather: Weather): Look {
  let l: Look =
    time === 'golden'
      ? {
          sky: { top: '#40508a', mid: '#ffa070', bottom: '#5a3a3a', sunDir: [0.6, 0.05, -1], sunColor: '#ffb070', sunSize: 0.03, sunGlow: 1.3, clouds: 0.3, cloudLit: '#ffc49a', cloudShade: '#6a4a6a', haze: 0.55 },
          fog: '#c27a62',
          hemi: ['#ffd0aa', '#3a1a1a', 0.8],
          key: { color: '#fff0e0', intensity: 2.4 },
          rim: { color: '#ffb070', intensity: 3.0 },
          env: { front: '#fff6ec', back: '#ffb070', ambient: '#5a3a3a', intensity: 0.95 },
          bulbs: 0.6,
          beams: 0.3,
        }
      : {
          sky: { top: '#02040e', mid: '#141a36', bottom: '#0e0a14', stars: 0.4, clouds: 0.15, cloudLit: '#3a2a4a', cloudShade: '#0a0a18', haze: 0.7 },
          fog: '#120e1c',
          hemi: ['#4a3a6a', '#1a0a0e', 0.5],
          key: { color: '#fff4ea', intensity: 2.6 },
          rim: { color: '#ffd28a', intensity: 2.8 },
          env: { front: '#fff6f0', back: '#ffcf8a', ambient: '#2a1a24', intensity: 0.9 },
          bulbs: 1,
          beams: 1,
        }
  if (weather === 'rain') {
    const night = time === 'night'
    l = { ...l, sky: { ...l.sky, top: night ? '#080a14' : '#5a6070', mid: night ? '#1c2030' : '#94909a', clouds: 0.95, cloudLit: night ? '#2e3244' : '#c0bcc4', cloudShade: night ? '#0e1018' : '#6a6a78', sunSize: 0, sunGlow: 0.2, stars: 0 }, fog: night ? '#181a26' : '#7e7a82' }
  }
  return l
}

function backdropTexture() {
  return canvasTexture(1024, 512, (ctx, w, h) => {
    ctx.fillStyle = '#f6f2ec'
    ctx.fillRect(0, 0, w, h)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const rows = 5
    const cols = 4
    for (let y = 0; y < rows; y++)
      for (let x = 0; x < cols; x++) {
        const cx = (x + (y % 2 ? 0.5 : 0) + 0.25) * (w / cols)
        const cy = (y + 0.5) * (h / rows)
        if ((x + y) % 2) {
          ctx.fillStyle = '#c8102e'
          ctx.font = '900 34px "Arial Black", Arial, sans-serif'
          ctx.fillText('DOLLSCENE', cx, cy - 8)
          ctx.fillStyle = '#9a7a3a'
          ctx.font = '600 18px Georgia, serif'
          ctx.fillText('FILM FESTIVAL · LAGOS', cx, cy + 20)
        } else {
          ctx.strokeStyle = '#c9a24a'
          ctx.lineWidth = 3
          ctx.beginPath()
          ctx.arc(cx, cy, 30, 0, Math.PI * 2)
          ctx.stroke()
          ctx.fillStyle = '#c9a24a'
          ctx.font = 'italic 700 30px Georgia, serif'
          ctx.fillText('DS', cx, cy + 2)
        }
      }
  })
}

function marqueeTexture() {
  return canvasTexture(1024, 256, (ctx, w, h) => {
    ctx.fillStyle = '#16080c'
    ctx.fillRect(0, 0, w, h)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#ffe9b0'
    ctx.shadowColor = '#ffb050'
    ctx.shadowBlur = 18
    ctx.font = '900 92px "Arial Black", Arial, sans-serif'
    ctx.fillText('PREMIERE', w / 2, h * 0.42)
    ctx.shadowBlur = 8
    ctx.font = '600 38px Georgia, serif'
    ctx.fillText('TONIGHT · RED CARPET 7PM', w / 2, h * 0.8)
  })
}

/** A searchlight cone that sweeps the sky. */
function Searchlight({ base, phase, animate, color, opacity }: { base: V3; phase: number; animate: boolean; color: string; opacity: number }) {
  const ref = useRef<Group>(null)
  useAnim(animate, (t) => {
    if (ref.current) ref.current.rotation.z = Math.sin(t * 0.35 + phase) * 0.45
  })
  return (
    <group ref={ref} position={base}>
      <Beam from={[0, 0, 0]} to={[0, 26, -10]} radius={1.8} color={color} opacity={opacity} falloff={0.6} />
    </group>
  )
}

export default function MovieFest({ time, weather, animate, spot }: SceneProps) {
  const crowdPeople = useMemo(() => {
    const r = rng(1955)
    // fans with phones behind the ropes, a few stars posing further down the carpet
    const fans = [...scatter(r, 10, [-4.6, -2.6, 0.8, 7.5], []), ...scatter(r, 10, [2.6, 4.6, 0.8, 7.5], [])].map((pp) => guest(r, pp, ['#0c0c10', '#c8102e', '#e6c36a', '#f4f0e8', '#1f3fb0'], ['selfie', 'cheer', 'selfie', 'stand'], ['none', 'cap', 'none'], ['#0c0c10']))
    const stars = [...scatter(r, 2, [-3.9, -2.7, -1.3, 0.6], []), ...scatter(r, 2, [2.7, 3.9, -1.3, 0.6], [])].map((pp) => ({ ...guest(r, pp, ['#c8102e', '#e6c36a', '#0c0c10', '#f4f0e8'], ['stand'], ['shades', 'none']), dress: true }))
    return [...fans, ...stars]
  }, [])
  const l = useMemo(() => look(time, weather), [time, weather])
  const tex = useBuilt((track) => ({ wall: track(backdropTexture()), marquee: track(marqueeTexture()) }), [])
  const built = useBuilt(
    (track) => {
      const r = rng(1957)
      const p = new Parts()
      // theatre facade behind the wall
      p.add(new BoxGeometry(24, 9, 0.6), '#2a1a20', [0, 4.5, -6])
      for (let x = -10; x <= 10; x += 4) p.add(new BoxGeometry(0.7, 9, 0.8), '#3a2228', [x, 4.5, -5.6])
      p.add(new BoxGeometry(24, 0.5, 1.4), '#c9a24a', [0, 6.6, -5.2])
      // marquee box
      p.add(new BoxGeometry(8.4, 1.8, 0.5), '#16080c', [0, 7.8, -5.0])
      // step-and-repeat frame
      p.add(new BoxGeometry(6.6, 0.08, 0.08), '#c9a24a', [0, 3.04, -1.65])
      for (const x of [-3.3, 3.3]) p.add(new BoxGeometry(0.08, 3.04, 0.08), '#c9a24a', [x, 1.52, -1.65])
      // stanchions with velvet ropes along the carpet (both sides), and a press-pen barrier
      const posts: V3[] = []
      for (let z = -0.6; z <= 7; z += 1.6) for (const x of [-1.9, 1.9]) posts.push([x, 0, z])
      for (const q of posts) {
        p.add(new CylinderGeometry(0.04, 0.04, 0.95, 8), '#d4b26a', [q[0], 0.48, q[2]])
        p.add(new CylinderGeometry(0.16, 0.18, 0.05, 12), '#d4b26a', [q[0], 0.025, q[2]])
        p.add(new SphereGeometry(0.06, 8, 6), '#d4b26a', [q[0], 0.98, q[2]])
      }
      const ropes = new Parts()
      for (const x of [-1.9, 1.9])
        for (let z = -0.6; z < 7; z += 1.6) {
          const pts = catenary([x, 0.92, z], [x, 0.92, z + 1.6], 0.18, 10).map((v) => new Vector3(...v))
          ropes.add(new TubeGeometry(new CatmullRomCurve3(pts), 12, 0.025, 6), '#8a0f22')
        }
      // potted palms by the wall
      for (const x of [-4.2, 4.2]) {
        p.add(new CylinderGeometry(0.35, 0.28, 0.6, 12), '#c9a24a', [x, 0.3, -1.4])
        for (let k = 0; k < 7; k++) p.add(new BoxGeometry(0.12, 1.4, 0.02), '#2f6a3a', [x, 1.3, -1.4], [range(r, -0.6, 0.6), (k / 7) * Math.PI, range(r, -0.6, 0.6)])
      }
      // press pen: photographers at the sides, behind the ropes
      const crowd: Inst[] = []
      const flashes: GlowPoint[] = []
      for (let i = 0; i < 26; i++) {
        const side = i % 2 ? 1 : -1
        const x = side * range(r, 2.6, 4.6)
        const z = range(r, 0.2, 7.5)
        crowd.push({ p: [x, 0, z], r: side > 0 ? -Math.PI / 2 + range(r, -0.4, 0.4) : Math.PI / 2 + range(r, -0.4, 0.4), s: range(r, 0.92, 1.06) })
        flashes.push({ p: [x - side * 0.25, 1.7, z], c: '#ffffff', s: 0.9, ph: r() })
      }
      const crowdGeo = figure(rng(3), '#0c0a10')
      // marquee bulbs around the sign and the step-and-repeat frame top
      const bulbs: GlowPoint[] = []
      for (let i = 0; i <= 40; i++) {
        bulbs.push({ p: [-4.2 + (i / 40) * 8.4, 8.75, -4.7], c: '#ffd9a0', s: 0.22, ph: i / 40 })
        bulbs.push({ p: [-4.2 + (i / 40) * 8.4, 6.85, -4.7], c: '#ffd9a0', s: 0.22, ph: i / 40 })
      }
      for (let i = 0; i <= 10; i++) {
        bulbs.push({ p: [-4.2, 6.85 + (i / 10) * 1.9, -4.7], c: '#ffd9a0', s: 0.22, ph: i / 10 })
        bulbs.push({ p: [4.2, 6.85 + (i / 10) * 1.9, -4.7], c: '#ffd9a0', s: 0.22, ph: i / 10 })
      }
      return {
        propGeo: track(p.build()),
        ropeGeo: track(ropes.build()),
        crowdGeo: track(crowdGeo),
        crowd,
        flashes,
        bulbs,
        propMat: track(new MeshLambertMaterial({ vertexColors: true, side: DoubleSide })),
        ropeMat: track(new MeshLambertMaterial({ vertexColors: true })),
        crowdMat: track(new MeshLambertMaterial({ color: '#0c0a10' })),
        wallMat: track(new MeshLambertMaterial({ map: tex.wall })),
        marqueeMat: track(new MeshLambertMaterial({ map: tex.marquee, emissiveMap: tex.marquee, emissive: '#ffffff' })),
        carpetMat: track(new MeshStandardMaterial({ color: '#a50f26', roughness: 0.9 })),
      }
    },
    [tex],
  )
  const rain = weather === 'rain'
  return (
    <>
      <color attach="background" args={[l.fog]} />
      <fog attach="fog" args={[l.fog, 14, 60]} />
      <SkyDome animate={animate} {...l.sky} radius={70} />
      <SceneLights spot={spot} envKey={`${time}${weather}`} hemi={l.hemi} keyLight={l.key} rim={l.rim} env={{ ...l.env, extra: [{ color: '#ffffff', intensity: 1.2, position: [0, 1.6, 4], scale: [3, 2] }, { color: '#c8102e', intensity: 0.8, position: [0, 0.2, 2], scale: [2, 6] }] }} />
      {/* pavement and the carpet */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, 0]}>
        <planeGeometry args={[80, 80]} />
        <meshStandardMaterial color={rain ? '#2a2a30' : '#3a3438'} roughness={rain ? 0.25 : 0.85} metalness={rain ? 0.3 : 0} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.006, 2.5]} material={built.carpetMat}>
        <planeGeometry args={[3.2, 12]} />
      </mesh>
      <mesh geometry={built.propGeo} material={built.propMat} />
      <mesh geometry={built.ropeGeo} material={built.ropeMat} />
      <mesh position={[0, 1.52, -1.7]} material={built.wallMat}>
        <planeGeometry args={[6.5, 3]} />
      </mesh>
      <mesh position={[0, 7.8, -4.74]} material={built.marqueeMat}>
        <planeGeometry args={[8, 1.6]} />
      </mesh>
      <Instanced geometry={built.crowdGeo} material={built.crowdMat} items={built.crowd} />
      <GlowPoints points={built.flashes} mode="flash" animate={animate} intensity={1.6} />
      <GlowPoints points={built.bulbs} mode="chase" animate={animate} intensity={l.bulbs} />
      {[-9, -3.5, 3.5, 9].map((x, i) => (
        <Searchlight key={x} base={[x, 0, -9]} phase={i * 1.7} animate={animate} color="#fff4e0" opacity={0.08 * l.beams} />
      ))}
      {rain && <Rain animate={animate} />}
      <LightPool position={spot} color="#ffffff" size={3} opacity={0.3} />
      <Crowd people={crowdPeople} animate={animate} />
      <BlobShadow position={spot} />
    </>
  )
}
