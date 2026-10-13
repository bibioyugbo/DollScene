import { Crowd, guest, type Person } from './kit/Crowd'
import { useMemo, useRef } from 'react'
import { BoxGeometry, CylinderGeometry, DoubleSide, MeshBasicMaterial, MeshLambertMaterial, ShaderMaterial, type DirectionalLight } from 'three'
import { Beam } from './kit/Beam'
import { GLSL_NOISE, mutate, Parts, range, rng, useAnim, useBuilt } from './kit/core'
import { GlowPoints, type GlowPoint } from './kit/Glow'
import { Instanced, type Inst } from './kit/Instanced'
import { BlobShadow, LightPool, SceneLights } from './kit/Lights'
import { Mist } from './kit/Weather'
import type { SceneProps } from './types'

/**
 * Cinema Date: inside the theatre with the lights down. Tiered red velvet seats rise behind the
 * doll; the big screen (behind the camera) flickers with the film and lights her face, the
 * projector beam cuts through the dark (thicker in haze), step lights glow along the aisle.
 */

const SCREEN_Z = 10
const ROW0 = -1.6
const ROW_D = 1.05
const ROW_H = 0.32

const FILM_FRAG = /* glsl */ `
uniform float uTime;
varying vec2 vUv;
${GLSL_NOISE}
void main(){
  vec2 p = vUv * vec2(3.2, 1.6);
  float a = fbm(p + vec2(uTime * 0.07, uTime * 0.03));
  float b = fbm(p * 1.7 - vec2(uTime * 0.05, 0.0) + 4.0);
  vec3 c = mix(vec3(0.15, 0.25, 0.55), vec3(0.95, 0.6, 0.35), smoothstep(0.35, 0.75, a));
  c = mix(c, vec3(0.9, 0.85, 0.75), smoothstep(0.6, 0.9, b) * 0.6);
  float cut = step(0.93, fract(uTime * 0.08)) * 0.35;
  float edge = smoothstep(0.0, 0.04, vUv.x) * smoothstep(1.0, 0.96, vUv.x) * smoothstep(0.0, 0.05, vUv.y) * smoothstep(1.0, 0.95, vUv.y);
  gl_FragColor = vec4(c * (0.85 + 0.15 * sin(uTime * 24.0)) * (1.0 - cut) * edge, 1.0);
  #include <colorspace_fragment>
}`

export default function Cinema({ weather, animate, spot }: SceneProps) {
  const crowdPeople = useMemo(() => {
    const r = rng(1895)
    const out: Person[] = []
    // a scattered audience in the seats behind, a row's height up each row
    for (let i = 1; i < 9; i++)
      for (let k = -6; k <= 6; k++) {
        const x = k * 0.62
        if (Math.abs(x) < 0.7 || r() > 0.32) continue
        out.push({ ...guest(r, [x, i * ROW_H, ROW0 - i * ROW_D + 0.1], ['#2a2a3a', '#7a1f2b', '#1f3a6b', '#e8e2d6', '#3a5a3a'], ['sit'], ['none', 'none', 'cap'], ['#1a1a24']), rotY: 0 })
      }
    return out
  }, [])
  const haze = weather === 'fog'
  const key = useRef<DirectionalLight>(null)
  const built = useBuilt((track) => {
    const r = rng(1895)
    const p = new Parts()
    const rows = 9
    // stadium steps and walls
    for (let i = 0; i < rows; i++) {
      const z = ROW0 - i * ROW_D
      const y = i * ROW_H
      p.add(new BoxGeometry(14, y + 0.02, ROW_D), '#1a0d12', [0, (y + 0.02) / 2, z])
    }
    p.add(new BoxGeometry(0.2, 7, 22), '#3a0f18', [-7, 3.5, 0])
    p.add(new BoxGeometry(0.2, 7, 22), '#3a0f18', [7, 3.5, 0])
    p.add(new BoxGeometry(14, 7, 0.2), '#220a10', [0, 3.5, ROW0 - rows * ROW_D - 0.4])
    // wall drapes
    for (let i = 0; i < 21; i++) {
      p.add(new BoxGeometry(0.06, 6.2, 0.9), i % 2 ? '#5a1424' : '#4a101d', [-6.85, 3.4, 9 - i * 1], [0, 0, 0])
      p.add(new BoxGeometry(0.06, 6.2, 0.9), i % 2 ? '#5a1424' : '#4a101d', [6.85, 3.4, 9 - i * 1], [0, 0, 0])
    }
    // the screen frame and stage lip
    p.add(new BoxGeometry(10.6, 5.6, 0.2), '#0a0608', [0, 3.2, SCREEN_Z + 0.15])
    p.add(new BoxGeometry(12, 0.6, 1.4), '#2a0e16', [0, 0.3, SCREEN_Z - 0.6])
    // projector booth window at the back
    p.add(new BoxGeometry(1.2, 0.6, 0.3), '#0a0608', [0, 5.4, ROW0 - rows * ROW_D - 0.2])
    // seats on every row except the aisle
    const seats: Inst[] = []
    for (let i = 0; i < rows; i++) {
      const z = ROW0 - i * ROW_D + 0.1
      const y = i * ROW_H
      for (let k = -6; k <= 6; k++) {
        const x = k * 0.62
        if (Math.abs(x) < 0.7) continue
        seats.push({ p: [x, y, z], r: 0, c: '#9a1a2a' })
      }
    }
    // a few seats in front (the front row the spots use)
    for (let k = -5; k <= -2; k++) seats.push({ p: [k * 0.62, 0, -0.15], r: 0, c: '#9a1a2a' })
    const seatP = new Parts()
    seatP.add(new BoxGeometry(0.5, 0.12, 0.5), '#ffffff', [0, 0.45, 0])
    seatP.add(new BoxGeometry(0.5, 0.62, 0.1), '#ffffff', [0, 0.8, -0.24], [-0.12, 0, 0])
    seatP.add(new BoxGeometry(0.06, 0.62, 0.5), '#3a3a3a', [0.28, 0.31, 0])
    // popcorn and drinks on a couple of seats
    const treats = new Parts()
    treats.add(new CylinderGeometry(0.1, 0.07, 0.2, 10), '#f4f0e8', [-1.86, 0.62, -0.15])
    for (let k = 0; k < 8; k++) treats.add(new BoxGeometry(0.205, 0.04, 0.012), '#c8102e', [-1.86, 0.56 + k * 0.02, -0.15], [0, (k / 8) * Math.PI, 0])
    for (let k = 0; k < 14; k++) treats.add(new BoxGeometry(0.035, 0.03, 0.035), '#ffe9a0', [-1.86 + range(r, -0.06, 0.06), 0.74 + range(r, 0, 0.04), -0.15 + range(r, -0.06, 0.06)])
    treats.add(new CylinderGeometry(0.045, 0.04, 0.18, 10), '#2a5ab0', [-3.1, 0.62, -0.1])
    // aisle step lights and wall sconces
    const glows: GlowPoint[] = []
    for (let i = 0; i < rows; i++) for (const x of [-0.62, 0.62]) glows.push({ p: [x, i * ROW_H + 0.05, ROW0 - i * ROW_D + 0.4], c: '#ffb46a', s: 0.12, ph: 0 })
    for (let z = 8; z > -9; z -= 3) for (const x of [-6.85, 6.85]) glows.push({ p: [x * 0.985, 3.6, z], c: '#ffcf8a', s: 0.5, ph: r() })
    const exits: GlowPoint[] = [
      { p: [-6.8, 2.4, 8.5], c: '#3aff7a', s: 0.4 },
      { p: [6.8, 2.4, 8.5], c: '#3aff7a', s: 0.4 },
    ]
    // ceiling star lights
    for (let i = 0; i < 70; i++) glows.push({ p: [range(r, -6.5, 6.5), 6.95, range(r, -10, 9.5)], c: '#fff4e0', s: 0.06, ph: r() })
    return {
      propGeo: track(p.build()),
      seatGeo: track(seatP.build()),
      treatGeo: track(treats.build()),
      seats,
      glows,
      exits,
      propMat: track(new MeshLambertMaterial({ vertexColors: true, side: DoubleSide })),
      seatMat: track(new MeshLambertMaterial({ vertexColors: true })),
      treatMat: track(new MeshLambertMaterial({ vertexColors: true, emissive: '#1a0a0a' })),
      filmMat: track(new ShaderMaterial({ vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }', fragmentShader: FILM_FRAG, uniforms: { uTime: { value: 0 } }, toneMapped: false })),
      ceilMat: track(new MeshBasicMaterial({ color: '#0a0508' })),
    }
  }, [])
  // the film's light flickers on her face through the key light
  useAnim(animate, (t) => {
    mutate(built.filmMat, (m) => (m.uniforms.uTime.value = t))
    if (key.current) {
      const k = 0.85 + 0.25 * Math.sin(t * 1.3) * Math.sin(t * 0.7) + 0.08 * Math.sin(t * 24)
      key.current.intensity = 2.0 * k
      key.current.color.setRGB(0.8 + 0.2 * Math.sin(t * 0.4), 0.78, 0.85 - 0.15 * Math.sin(t * 0.4))
    }
  })
  const back = useMemo(() => ROW0 - 9 * ROW_D, [])
  return (
    <>
      <color attach="background" args={['#050206']} />
      <fog attach="fog" args={['#0a0408', haze ? 4 : 10, haze ? 18 : 34]} />
      <SceneLights
        spot={spot}
        keyRef={key}
        hemi={['#3a2a4a', '#120408', 0.42]}
        keyLight={{ color: '#d8d0ff', intensity: 2.0, offset: [0, 1.0, 4.5] }}
        rim={{ color: '#ffb46a', intensity: 1.8 }}
        env={{ intensity: 0.75, front: '#c8c4ff', back: '#ffb46a', ambient: '#1a0a12', extra: [{ color: '#b0b8ff', intensity: 1.6, position: [0, 2.6, 6], scale: [6, 3] }] }}
      />
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, 5]}>
        <planeGeometry args={[14, 10]} />
        <meshLambertMaterial color="#2a0d14" />
      </mesh>
      <mesh rotation-x={Math.PI / 2} position={[0, 7, 0]} material={built.ceilMat}>
        <planeGeometry args={[14, 22]} />
      </mesh>
      <mesh geometry={built.propGeo} material={built.propMat} />
      <Instanced geometry={built.seatGeo} material={built.seatMat} items={built.seats} />
      <mesh geometry={built.treatGeo} material={built.treatMat} />
      {/* the screen (behind the default camera; spin round to see the film) */}
      <mesh position={[0, 3.2, SCREEN_Z]} rotation-y={Math.PI} material={built.filmMat}>
        <planeGeometry args={[10, 5]} />
      </mesh>
      <GlowPoints points={built.glows} mode="twinkle" animate={animate} intensity={0.8} />
      <GlowPoints points={built.exits} mode="steady" animate={animate} intensity={0.9} />
      <Beam from={[0, 5.4, back - 0.1]} to={[0, 3.2, SCREEN_Z]} radius={2.6} color="#cfd8ff" opacity={haze ? 0.16 : 0.06} falloff={0.5} />
      {haze && <Mist animate={animate} color="#8a7aa8" opacity={0.3} size={14} center={[0, 0, -2]} layers={3} height={1.2} additive />}
      <LightPool position={spot} color="#b8c0ff" size={2.6} opacity={0.22} />
      <Crowd people={crowdPeople} animate={animate} />
      <BlobShadow position={spot} />
    </>
  )
}
