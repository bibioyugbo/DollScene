import { Crowd, guest, scatter } from './kit/Crowd'
import { useLayoutEffect, useMemo } from 'react'
import { AdditiveBlending, BoxGeometry, CylinderGeometry, DoubleSide, MeshBasicMaterial, MeshLambertMaterial, PlaneGeometry, SphereGeometry, type Material } from 'three'
import { Palms, type PalmSpec } from './kit/beach-palms'
import { canvasTexture, GLSL_NOISE, mutate, Parts, range, rng, speckle, useAnim, useBuilt } from './kit/core'
import { GlowPoints, type GlowPoint } from './kit/Glow'
import { BlobShadow, LightPool, SceneLights } from './kit/Lights'
import { SkyDome, type SkyParams } from './kit/Sky'
import { Rain } from './kit/Weather'
import type { SceneProps, TimeOfDay, V3, Weather } from './types'

/**
 * Beach: warm sand, the Atlantic rolling in (animated waves and shore foam), palms, striped
 * umbrellas and loungers; tiki torches and a fire pit at night. The sea sits behind the doll.
 */

const SHORE = -3.2

interface Look {
  sky: SkyParams
  fog: string
  hemi: [string, string, number]
  key: { color: string; intensity: number }
  rim: { color: string; intensity: number }
  env: { front: string; back: string; ambient: string; intensity: number }
  sea: [string, string]
  sand: string
  fire: number
}

function look(time: TimeOfDay, weather: Weather): Look {
  let l: Look
  if (time === 'morning')
    l = {
      sky: { top: '#3d8fe0', mid: '#d6eef5', bottom: '#9ec6c8', sunDir: [0.7, 0.55, -0.4], sunColor: '#fff6e0', sunSize: 0, sunGlow: 0.6, clouds: 0.3, cloudLit: '#ffffff', cloudShade: '#b0c6d8', haze: 0.6 },
      fog: '#cfe6ee',
      hemi: ['#d8ecff', '#b89a6a', 1.05],
      key: { color: '#fff6ea', intensity: 2.3 },
      rim: { color: '#fff0d0', intensity: 1.6 },
      env: { front: '#fffaf0', back: '#d8f0ff', ambient: '#a0b8c0', intensity: 1 },
      sea: ['#1f8fb0', '#0a4f78'],
      sand: '#ffffff',
      fire: 0,
    }
  else if (time === 'golden')
    l = {
      sky: { top: '#3f5d9e', mid: '#ffb070', bottom: '#d87a50', sunDir: [0.12, 0.05, -1], sunColor: '#ffb060', sunSize: 0.04, sunGlow: 1.6, clouds: 0.35, cloudLit: '#ffc890', cloudShade: '#8a5a7a', haze: 0.5 },
      fog: '#f0a070',
      hemi: ['#ffd2a8', '#8a5a3a', 0.85],
      key: { color: '#ffe6cc', intensity: 2.0 },
      rim: { color: '#ff9a40', intensity: 3.4 },
      env: { front: '#ffeedd', back: '#ff9a50', ambient: '#8a5a48', intensity: 1 },
      sea: ['#d0805a', '#3a3a6a'],
      sand: '#ffe2c8',
      fire: 0.4,
    }
  else
    l = {
      sky: { top: '#040818', mid: '#18244a', bottom: '#101828', stars: 1, moonDir: [-0.25, 0.32, -1], moonSize: 0.04, moonColor: '#fff8e6', clouds: 0.2, cloudLit: '#3a4466', cloudShade: '#0c1024', haze: 0.55 },
      fog: '#121a32',
      hemi: ['#3a4880', '#2a2018', 0.55],
      key: { color: '#ffd8a8', intensity: 1.9 },
      rim: { color: '#9ab4ff', intensity: 2.4 },
      env: { front: '#ffd6a8', back: '#8ea8ff', ambient: '#1a2240', intensity: 0.8 },
      sea: ['#2a3a6a', '#081028'],
      sand: '#b8b4c4',
      fire: 1,
    }
  if (weather === 'rain') {
    const night = time === 'night'
    l.sky = { ...l.sky, top: night ? '#0a0f1e' : '#6a7684', mid: night ? '#1f2636' : '#a3aab0', clouds: 0.95, cloudLit: night ? '#363c4e' : '#cfd3d8', cloudShade: night ? '#121622' : '#757b86', sunSize: 0, sunGlow: 0.15, stars: 0, moonSize: 0 }
    l.fog = night ? '#1c2234' : '#97a0a6'
    l.sea = night ? ['#26304a', '#0a1020'] : ['#4a6a7a', '#1f3a4a']
    l.rim = { ...l.rim, intensity: l.rim.intensity * 0.55 }
  }
  return l
}

function sandTexture() {
  return canvasTexture(
    512,
    512,
    (ctx, w, h) => {
      const r = rng(31)
      ctx.fillStyle = '#e2c493'
      ctx.fillRect(0, 0, w, h)
      speckle(ctx, w, h, r, 16000, ['#d4b27c', '#f0d8ac', '#c9a26e', '#f6e4c0'], [1, 2.5], [0.3, 0.8])
      // a few shells and footprints
      for (let i = 0; i < 40; i++) {
        ctx.globalAlpha = 0.25
        ctx.fillStyle = '#b8935e'
        ctx.beginPath()
        ctx.ellipse(r() * w, r() * h, 5, 9, r() * 3, 0, Math.PI * 2)
        ctx.fill()
      }
    },
    { repeat: [12, 12], anisotropy: 4 },
  )
}

const SEA_VERT = /* glsl */ `
uniform float uTime;
varying float vH;
varying float vDist;
${GLSL_NOISE}
`

function seaMaterial(uni: { uTime: { value: number }; uA: { value: [number, number, number] }; uB: { value: [number, number, number] } }) {
  const m = new MeshLambertMaterial({ color: '#ffffff', transparent: true, opacity: 0.96 })
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uni.uTime
    sh.uniforms.uA = uni.uA
    sh.uniforms.uB = uni.uB
    sh.vertexShader = SEA_VERT + sh.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      float w1 = sin(position.x * 0.35 + uTime * 0.9) * 0.08;
      float w2 = sin(position.y * 0.6 - uTime * 1.3) * 0.12;
      float w3 = (vnoise(position.xy * 0.4 + uTime * 0.2) - 0.5) * 0.18;
      transformed.z += w1 + w2 + w3;
      vH = w1 + w2 + w3;
      vDist = position.y;`,
    )
    sh.fragmentShader =
      'uniform float uTime; uniform vec3 uA; uniform vec3 uB; varying float vH; varying float vDist;\n' +
      sh.fragmentShader.replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float far = smoothstep(-2.0, 40.0, vDist);
        diffuseColor.rgb = mix(uA, uB, far) + vec3(0.25) * smoothstep(0.12, 0.3, vH) * (1.0 - far);`,
      )
  }
  return m
}

const PALMS: PalmSpec[] = [
  { p: [-3.6, 0, -0.6], height: 6.4, lean: 0.25, dir: 0.3, seed: 21 },
  { p: [-5.4, 0, 1.6], height: 7.2, lean: 0.18, dir: -0.4, seed: 22 },
  { p: [4.8, 0, -1.2], height: 6.8, lean: 0.22, dir: 2.8, seed: 23 },
  { p: [6.4, 0, 2.4], height: 6, lean: 0.2, dir: 3.3, seed: 24 },
  { p: [-8, 0, -1.8], height: 7.8, lean: 0.15, dir: 0.1, seed: 25 },
  { p: [8.6, 0, -0.4], height: 7.4, lean: 0.16, dir: 3, seed: 26 },
]

export default function Beach({ time, weather, animate, spot }: SceneProps) {
  const crowdPeople = useMemo(() => {
    const r = rng(77)
    return scatter(r, 14, [-9, 9, -2.6, 6], [{ p: [0, 0, 0] as V3, r: 2.4 }, { p: [2.3, 0, 0.6] as V3, r: 2.4 }, { p: [-2.5, 0, -0.2] as V3, r: 2.4 }]).map((pp) => guest(r, pp, ['#ff9a62', '#2fb3c9', '#f4f0e8', '#e9c46a', '#c94b7b', '#1f7a5c'], ['stand','selfie','drink','cheer','dance'], ['shades','sunhat','none','shades'], ['#f4e2c0','#e8735a','#2fb3c9']))
  }, [])
  const l = useMemo(() => look(time, weather), [time, weather])
  const sand = useBuilt((track) => track(sandTexture()), [])
  const built = useBuilt(
    (track) => {
      const r = rng(77)
      const p = new Parts()
      // striped umbrellas: 8 alternating wedges, a pole, a little finial
      const umbrella = (at: V3, a: string, b: string, tilt: number) => {
        p.group(at, [tilt, r() * 3, 0], 1, () => {
          p.add(new CylinderGeometry(0.025, 0.025, 2.2, 6), '#f4f0e8', [0, 1.1, 0])
          for (let k = 0; k < 8; k++) p.add(new CylinderGeometry(0.02, 1.1, 0.42, 3, 1, true, (k / 8) * Math.PI * 2, (Math.PI * 2) / 8), k % 2 ? a : b, [0, 2.1, 0])
          p.add(new SphereGeometry(0.05, 6, 4), a, [0, 2.33, 0])
        })
      }
      umbrella([2.9, 0, -0.2], '#e8735a', '#fff4e8', 0.08)
      umbrella([-2.2, 0, 2.4], '#2fb3c9', '#fff4e8', -0.06)
      umbrella([5.6, 0, 3.6], '#e9c46a', '#fff4e8', 0.05)
      // loungers and towels
      const lounger = (at: V3, rot: number, col: string) =>
        p.group(at, rot, 1, () => {
          p.add(new BoxGeometry(0.62, 0.06, 1.5), col, [0, 0.32, 0])
          p.add(new BoxGeometry(0.62, 0.06, 0.62), col, [0, 0.52, -0.82], [0.7, 0, 0])
          for (const sx of [-0.27, 0.27]) for (const sz of [-0.6, 0.6]) p.add(new BoxGeometry(0.04, 0.3, 0.04), '#f4f0e8', [sx, 0.15, sz])
        })
      lounger([3.4, 0, 0.9], -0.3, '#f4f0e8')
      lounger([4.3, 0, 0.5], -0.35, '#2fb3c9')
      lounger([-2.9, 0, 3.4], 0.4, '#f4f0e8')
      p.add(new BoxGeometry(0.8, 0.01, 1.7), '#ff9a62', [-1.6, 0.006, 1.6], [0, 0.3, 0])
      p.add(new BoxGeometry(0.8, 0.01, 1.7), '#c94b7b', [1.8, 0.006, 2.4], [0, -0.2, 0])
      // beach balls, a cooler, sandcastle
      for (const [x, z, c] of [[1.2, 1.4, '#e8735a'], [-1, 3.2, '#2fb3c9']] as [number, number, string][]) p.add(new SphereGeometry(0.16, 12, 8), c, [x, 0.16, z])
      p.add(new BoxGeometry(0.5, 0.36, 0.34), '#2f6fb0', [-3.6, 0.18, 2.2])
      p.add(new CylinderGeometry(0.2, 0.28, 0.3, 8), '#d4b27c', [1.6, 0.15, -1.6])
      p.add(new CylinderGeometry(0.12, 0.16, 0.24, 8), '#d4b27c', [1.6, 0.42, -1.6])
      // fire pit with stones and logs, tiki torches
      const pit: V3 = [-1.8, 0, -1.2]
      for (let k = 0; k < 9; k++) {
        const a = (k / 9) * Math.PI * 2
        p.add(new SphereGeometry(0.12, 6, 4), '#6a625a', [pit[0] + Math.cos(a) * 0.45, 0.06, pit[2] + Math.sin(a) * 0.45], [0, 0, 0], [1, 0.7, 1])
      }
      for (let k = 0; k < 3; k++) p.add(new CylinderGeometry(0.05, 0.05, 0.6, 6), '#5a3a22', [pit[0], 0.08, pit[2]], [Math.PI / 2, (k / 3) * Math.PI, 0])
      const torches: V3[] = [
        [-4.2, 0, 1],
        [3.6, 0, -2],
        [-0.6, 0, 4.2],
        [2.2, 0, 4.6],
      ]
      for (const t of torches) {
        p.add(new CylinderGeometry(0.03, 0.035, 1.8, 6), '#7a5a3a', [t[0], 0.9, t[2]])
        p.add(new CylinderGeometry(0.08, 0.05, 0.18, 8), '#3a2a1a', [t[0], 1.85, t[2]])
      }
      // boats on the horizon
      for (let i = 0; i < 4; i++) {
        const x = range(r, -30, 30)
        const z = range(r, -38, -26)
        p.add(new BoxGeometry(1.6, 0.25, 0.5), '#f4f0e8', [x, 0.15, z])
        p.add(new CylinderGeometry(0.02, 0.02, 1.4, 4), '#f4f0e8', [x, 0.9, z])
        p.add(new CylinderGeometry(0.01, 0.55, 1.2, 3, 1, true, 0, 0.6), '#ffffff', [x + 0.2, 0.9, z])
      }
      const fire: GlowPoint[] = [
        { p: [pit[0], 0.3, pit[2]], c: '#ff9a3a', s: 0.9, ph: 0.1 },
        { p: [pit[0] + 0.08, 0.45, pit[2]], c: '#ffd27a', s: 0.5, ph: 0.6 },
        ...torches.map((t, i) => ({ p: [t[0], 2.02, t[2]] as V3, c: '#ffb04a', s: 0.45, ph: i * 0.23 })),
      ]
      // dunes: a soft rise behind the sides
      const dunes = new PlaneGeometry(80, 40, 80, 40)
      const dp = dunes.attributes.position
      for (let i = 0; i < dp.count; i++) {
        const x = dp.getX(i)
        const y = dp.getY(i)
        const zWorld = -y
        const away = Math.max(0, Math.abs(x) - 6) / 30
        dp.setZ(i, zWorld > SHORE ? (Math.sin(x * 0.3) * 0.15 + away * 1.4) * Math.min(1, (zWorld - SHORE) / 4) : -0.3 * Math.min(1, (SHORE - zWorld) / 2))
      }
      dunes.computeVertexNormals()
      const uni = { uTime: { value: 0 }, uA: { value: [0, 0, 0] as [number, number, number] }, uB: { value: [0, 0, 0] as [number, number, number] } }
      return {
        propGeo: track(p.build()),
        propMat: track(new MeshLambertMaterial({ vertexColors: true, side: DoubleSide })),
        fire,
        dunes: track(dunes),
        uni,
        seaMat: track(seaMaterial(uni)) as Material,
        foamMat: track(new MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.55, blending: AdditiveBlending, depthWrite: false })),
        seaGeo: track(new PlaneGeometry(140, 70, 120, 60)),
      }
    },
    [],
  )
  // sea colours follow the time of day
  useLayoutEffect(() => {
    const hex = (c: string) => {
      const n = parseInt(c.slice(1), 16)
      return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255] as [number, number, number]
    }
    mutate(built.uni, (u) => {
      u.uA.value = hex(l.sea[0])
      u.uB.value = hex(l.sea[1])
    })
  }, [l, built])
  useAnim(animate, (t) => {
    mutate(built.uni, (u) => (u.uTime.value = t))
    mutate(built.foamMat, (m) => (m.opacity = 0.35 + 0.25 * Math.sin(t * 1.1)))
  })
  const rain = weather === 'rain'
  const breeze = weather === 'breeze'

  return (
    <>
      <color attach="background" args={[l.fog]} />
      <fog attach="fog" args={[l.fog, rain ? 10 : 18, rain ? 45 : 90]} />
      <SkyDome animate={animate} {...l.sky} radius={60} />
      <SceneLights spot={spot} envKey={`${time}${weather}`} hemi={l.hemi} keyLight={l.key} rim={l.rim} env={{ ...l.env, extra: time === 'golden' ? [{ color: '#ff9a50', intensity: 1.4, position: [0, 1.5, -6], scale: [8, 2] }] : undefined }} />
      <mesh geometry={built.dunes} rotation-x={-Math.PI / 2} position={[0, 0, -10]}>
        <meshLambertMaterial map={sand} color={l.sand} />
      </mesh>
      <mesh geometry={built.seaGeo} material={built.seaMat} rotation-x={-Math.PI / 2} position={[0, -0.12, SHORE - 35]} />
      {/* the shore break: a bright band that swells with the waves */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.01, SHORE + 0.1]} material={built.foamMat}>
        <planeGeometry args={[80, 0.6]} />
      </mesh>
      <mesh geometry={built.propGeo} material={built.propMat} />
      <Palms palms={PALMS} animate={animate} sway={breeze ? 0.14 : rain ? 0.1 : 0.05} />
      {l.fire > 0 && <GlowPoints points={built.fire} mode="flicker" animate={animate} intensity={l.fire} />}
      {rain && <Rain animate={animate} />}
      <LightPool position={spot} color={time === 'night' ? '#ffcf9a' : '#fff4e0'} size={3} opacity={0.2} />
      <Crowd people={crowdPeople} animate={animate} />
      <BlobShadow position={spot} />
    </>
  )
}

