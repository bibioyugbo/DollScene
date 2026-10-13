import { Crowd, guest, scatter } from './kit/Crowd'
import { useMemo, useRef } from 'react'
import { BoxGeometry, ConeGeometry, CylinderGeometry, DoubleSide, MeshLambertMaterial, PlaneGeometry, type InstancedMesh } from 'three'
import { Matrix4, Quaternion, Vector3 } from 'three'
import { canvasTexture, Parts, pick, range, rng, speckle, useAnim, useBuilt } from './kit/core'
import { GlowPoints, type GlowPoint } from './kit/Glow'
import { Instanced, type Inst } from './kit/Instanced'
import { BlobShadow, LightPool, SceneLights } from './kit/Lights'
import { SkyDome, type SkyParams } from './kit/Sky'
import { Falling, Mist, Rain } from './kit/Weather'
import { addTree, blob } from './kit/shapes'
import type { SceneProps, TimeOfDay, V3, Weather } from './types'

/**
 * Halloween: a moonlit pumpkin patch at the graveyard's edge. Grinning jack-o'-lanterns (their
 * candles flicker), twisted bare trees, leaning headstones, a wrought-iron fence and gate, fog
 * creeping between the graves and bats looping across the moon. Purple and orange light.
 */

interface Look {
  sky: SkyParams
  fog: string
  hemi: [string, string, number]
  key: { color: string; intensity: number }
  rim: { color: string; intensity: number }
  env: { front: string; back: string; ambient: string; intensity: number }
  ground: string
}

function look(time: TimeOfDay, weather: Weather): Look {
  let l: Look =
    time === 'golden'
      ? {
          sky: { top: '#2a2350', mid: '#e0703a', bottom: '#3a1a1a', sunDir: [0.4, 0.04, -1], sunColor: '#ff8a3a', sunSize: 0.03, sunGlow: 1.5, clouds: 0.45, cloudLit: '#ff9a5a', cloudShade: '#3a2440', haze: 0.5 },
          fog: '#6a3a3a',
          hemi: ['#ff9a6a', '#1a0e14', 0.65],
          key: { color: '#ffd2a8', intensity: 2.0 },
          rim: { color: '#ff7a1a', intensity: 3.0 },
          env: { front: '#ffe0c0', back: '#ff7a1a', ambient: '#3a1a2a', intensity: 0.85 },
          ground: '#e0c8b8',
        }
      : {
          sky: { top: '#05030f', mid: '#2a1a4a', bottom: '#0e0a16', stars: 0.8, moonDir: [0.15, 0.35, -1], moonSize: 0.075, moonColor: '#fff4d6', clouds: 0.35, cloudLit: '#5a4a7a', cloudShade: '#0e0a1c', haze: 0.65 },
          fog: '#1c1430',
          hemi: ['#5a3e8a', '#120a0a', 0.5],
          key: { color: '#e0d4ff', intensity: 1.8 },
          rim: { color: '#ff7a1a', intensity: 2.6 },
          env: { front: '#d8ccff', back: '#ff7a1a', ambient: '#1a1028', intensity: 0.8 },
          ground: '#a8a0b8',
        }
  if (weather === 'rain') l = { ...l, sky: { ...l.sky, clouds: 0.95, moonSize: 0, stars: 0, sunSize: 0 }, fog: time === 'night' ? '#141022' : '#4a3438' }
  return l
}

function groundTexture() {
  return canvasTexture(
    512,
    512,
    (ctx, w, h) => {
      const r = rng(1031)
      ctx.fillStyle = '#2a2a1c'
      ctx.fillRect(0, 0, w, h)
      speckle(ctx, w, h, r, 12000, ['#3a3a22', '#242414', '#4a4226', '#1c1c12'], [1, 3], [0.4, 0.9])
      for (let i = 0; i < 500; i++) {
        ctx.globalAlpha = range(r, 0.4, 0.9)
        ctx.fillStyle = pick(r, ['#7a3a12', '#a0521a', '#5a2a10', '#c06a20'])
        ctx.beginPath()
        ctx.ellipse(r() * w, r() * h, range(r, 2, 4), range(r, 4, 7), r() * 3, 0, Math.PI * 2)
        ctx.fill()
      }
    },
    { repeat: [10, 10], anisotropy: 4 },
  )
}

/** Bats: little flapping wings looping across the sky (one instanced mesh). */
function Bats({ animate }: { animate: boolean }) {
  const ref = useRef<InstancedMesh>(null)
  const { geo, mat, bats } = useBuilt((track) => {
    const r = rng(13)
    const g = new Parts()
    g.add(new PlaneGeometry(0.5, 0.18), '#0a0610', [0.25, 0, 0])
    g.add(new PlaneGeometry(0.5, 0.18), '#0a0610', [-0.25, 0, 0])
    return {
      geo: track(g.build()),
      mat: track(new MeshLambertMaterial({ vertexColors: true, side: DoubleSide })),
      bats: Array.from({ length: 14 }, () => ({ c: new Vector3(range(r, -10, 10), range(r, 6, 11), range(r, -22, -10)), rad: range(r, 2, 5), sp: range(r, 0.4, 0.9), ph: r() * 6 })),
    }
  }, [])
  const m = useMemo(() => ({ mat: new Matrix4(), q: new Quaternion(), p: new Vector3(), s: new Vector3(1, 1, 1) }), [])
  useAnim(animate, (t) => {
    const mesh = ref.current
    if (!mesh) return
    bats.forEach((b, i) => {
      const a = t * b.sp + b.ph
      m.p.set(b.c.x + Math.cos(a) * b.rad, b.c.y + Math.sin(a * 2) * 0.6, b.c.z + Math.sin(a) * b.rad * 0.5)
      m.q.setFromAxisAngle(new Vector3(0, 1, 0), -a)
      m.s.set(1, 1 + Math.sin(t * 14 + i) * 0.6, 1)
      mesh.setMatrixAt(i, m.mat.compose(m.p, m.q, m.s))
    })
    mesh.instanceMatrix.needsUpdate = true
  })
  return <instancedMesh ref={ref} args={[geo, mat, bats.length]} frustumCulled={false} />
}

export default function Halloween({ time, weather, animate, spot }: SceneProps) {
  const crowdPeople = useMemo(() => {
    const r = rng(31)
    return scatter(r, 14, [-7, 7, -8, 4], [{ p: [0, 0, 0] as V3, r: 2.4 }, { p: [-2.2, 0, -1.3] as V3, r: 2.4 }, { p: [2.3, 0, -0.9] as V3, r: 2.4 }]).map((pp) => guest(r, pp, ['#1a1a24', '#ff7a1a', '#3b2a5c', '#6a1e2a', '#2a5a2a'], ['stand','selfie','cheer','dance'], ['witch','horns','ears','witch','mask'], ['#ff7a1a','#c8102e','#0c0c10']))
  }, [])
  const l = useMemo(() => look(time, weather), [time, weather])
  const ground = useBuilt((track) => track(groundTexture()), [])
  const built = useBuilt((track) => {
    const r = rng(31)
    const trees = new Parts()
    for (const [x, z, h, s] of [
      [-4.2, -2.6, 6.2, 3],
      [4.6, -3.4, 6.8, 5],
      [-7.5, 1.4, 5.6, 7],
      [7.8, 0.8, 6, 9],
      [-1.2, -8.5, 7.4, 11],
      [3, -10, 7, 12],
    ] as [number, number, number, number][])
      addTree(trees, [x, 0, z], { height: h, seed: s, color: '#1a1414', depth: 4, spread: 0.85, twist: 0.42 })
    const p = new Parts()
    // headstones: rounded tops, leaning, in loose rows behind the patch
    for (let i = 0; i < 22; i++) {
      const x = range(r, -6.5, 6.5)
      const z = range(r, -9, -2.4)
      if (Math.abs(x) < 1.2 && z > -3.5) continue
      const h = range(r, 0.6, 1.1)
      const lean: V3 = [range(r, -0.12, 0.12), range(r, -0.3, 0.3), range(r, -0.12, 0.12)]
      p.group([x, 0, z], lean, 1, () => {
        p.add(new BoxGeometry(0.55, h, 0.14), '#6a6a72', [0, h / 2, 0])
        p.add(new CylinderGeometry(0.275, 0.275, 0.14, 12, 1, false, 0, Math.PI), '#6a6a72', [0, h, 0], [Math.PI / 2, 0, Math.PI / 2])
      })
    }
    // a cross and a crypt
    p.add(new BoxGeometry(0.14, 1.5, 0.14), '#5a5a62', [-2.8, 0.75, -5])
    p.add(new BoxGeometry(0.7, 0.14, 0.14), '#5a5a62', [-2.8, 1.1, -5])
    p.add(new BoxGeometry(2.6, 2.2, 2.2), '#4a4a52', [3.6, 1.1, -7.5])
    p.add(new ConeGeometry(1.9, 1, 4), '#3a3a42', [3.6, 2.7, -7.5], [0, Math.PI / 4, 0])
    // wrought-iron fence with spikes, and the gate
    for (let x = -9; x <= 9; x += 0.3) {
      if (Math.abs(x - -2.2) < 0.9) continue
      p.add(new BoxGeometry(0.03, 1.4, 0.03), '#0e0c10', [x, 0.7, -1.3 + (x > 0 ? 0.4 : 0)])
      p.add(new ConeGeometry(0.04, 0.12, 4), '#0e0c10', [x, 1.46, -1.3 + (x > 0 ? 0.4 : 0)])
    }
    for (const y of [0.3, 1.25]) {
      p.add(new BoxGeometry(6.0, 0.04, 0.04), '#0e0c10', [-6.1, y, -1.3])
      p.add(new BoxGeometry(9, 0.04, 0.04), '#0e0c10', [4.5, y, -0.9])
    }
    for (const x of [-3.1, -1.3]) p.add(new BoxGeometry(0.18, 2.1, 0.18), '#2a2830', [x, 1.05, -1.3])
    p.add(new CylinderGeometry(0.9, 0.9, 0.05, 16, 1, true, -Math.PI / 2, Math.PI), '#0e0c10', [-2.2, 1.9, -1.3], [Math.PI / 2, 0, 0])
    // hay bales
    for (const [x, z] of [
      [2.4, 0.6],
      [-3.4, 1.8],
      [3.2, 2.4],
    ])
      p.add(new BoxGeometry(1, 0.5, 0.6), '#b8903a', [x, 0.25, z], [0, range(r, -0.3, 0.3), 0])
    // pumpkins: a patch around the clear centre, some carved (they glow)
    const pumpkins: Inst[] = []
    const glows: GlowPoint[] = []
    for (let i = 0; i < 46; i++) {
      const a = range(r, 0, Math.PI * 2)
      const d = range(r, 1.3, 6.5)
      const x = Math.cos(a) * d
      const z = Math.sin(a) * d * 0.7 + 0.5
      if (z < -1.1) continue
      const s = range(r, 0.16, 0.34)
      pumpkins.push({ p: [x, s * 0.75, z], s: [s, s * 0.8, s], r: [0, r() * 6, 0], c: pick(r, ['#e86a12', '#d85a0a', '#f08a2a', '#c94a0a']) })
      if (i % 3 === 0) glows.push({ p: [x, s * 0.75, z + s * 0.6], c: '#ffa030', s: s * 2.2, ph: r() })
    }
    // big carved pumpkins either side of the spot
    for (const x of [-1.6, 1.6]) {
      pumpkins.push({ p: [x, 0.36, 0.4], s: [0.48, 0.38, 0.48], c: '#e86a12' })
      glows.push({ p: [x, 0.4, 0.88], c: '#ffb040', s: 1.1, ph: x > 0 ? 0.3 : 0.7 })
    }
    // candles on the graves
    for (let i = 0; i < 12; i++) glows.push({ p: [range(r, -6, 6), 0.12, range(r, -8, -2.6)], c: '#ffcf7a', s: 0.25, ph: r() })
    const stems = new Parts()
    for (const pk of pumpkins) stems.add(new CylinderGeometry(0.015, 0.025, 0.08, 5), '#3a5a1a', [pk.p[0], pk.p[1] + (pk.s as V3)[1] * 0.95, pk.p[2]])
    return {
      treeGeo: track(trees.build()),
      propGeo: track(p.build()),
      stemGeo: track(stems.build()),
      pumpkinGeo: track(blob(1, 0.12, 21)),
      pumpkins,
      glows,
      mat: track(new MeshLambertMaterial({ vertexColors: true, side: DoubleSide })),
      pumpkinMat: track(new MeshLambertMaterial({ color: '#ffffff', emissive: '#3a1400' })),
    }
  }, [])
  const fog = weather === 'fog'
  const rain = weather === 'rain'
  const leaves = weather === 'leaves'
  return (
    <>
      <color attach="background" args={[l.fog]} />
      <fog attach="fog" args={[l.fog, fog ? 5 : 12, fog ? 26 : 55]} />
      <SkyDome animate={animate} {...l.sky} radius={60} />
      <SceneLights spot={spot} envKey={`${time}${weather}`} hemi={l.hemi} keyLight={l.key} rim={l.rim} env={{ ...l.env, extra: [{ color: '#ff8a2a', intensity: 1.0, position: [0, 0.6, 2], scale: [4, 1] }] }} />
      <mesh rotation-x={-Math.PI / 2}>
        <circleGeometry args={[45, 40]} />
        <meshLambertMaterial map={ground} color={l.ground} />
      </mesh>
      <mesh geometry={built.treeGeo} material={built.mat} />
      <mesh geometry={built.propGeo} material={built.mat} />
      <mesh geometry={built.stemGeo} material={built.mat} />
      <Instanced geometry={built.pumpkinGeo} material={built.pumpkinMat} items={built.pumpkins} />
      <GlowPoints points={built.glows} mode="flicker" animate={animate} intensity={time === 'night' ? 1 : 0.7} />
      <Bats animate={animate} />
      {(fog || time === 'night') && <Mist animate={animate} color="#8a78b8" opacity={fog ? 0.55 : 0.3} size={26} center={[0, 0, -4]} layers={3} height={0.6} />}
      {rain && <Rain animate={animate} />}
      {leaves && <Falling animate={animate} count={120} colors={['#a0521a', '#c06a20', '#7a3a12']} kind="maple" />}
      <LightPool position={spot} color="#ffb060" size={3} opacity={0.3} />
      <Crowd people={crowdPeople} animate={animate} />
      <BlobShadow position={spot} />
    </>
  )
}
