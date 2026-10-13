import { useMemo } from 'react'
import { BoxGeometry, BufferGeometry, ConeGeometry, CylinderGeometry, Float32BufferAttribute, MeshLambertMaterial, SphereGeometry, TorusGeometry } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { V3 } from '../types'
import { mutate, Parts, pick, range, rng, useAnim, useBuilt, type Rand } from './core'
import { GlowPoints, type GlowPoint } from './Glow'

/**
 * Party people: stylised low-poly guests in colour (not silhouettes) that make a scene feel
 * alive. Poses: standing, dancing (they bob), cheering (arms up), holding a drink, sitting, and
 * taking selfies (phone up, a screen glow and the odd flash). Accessories per scene: masquerade
 * masks, gele, fila caps, shades, sun hats, party hats, witch hats, horns, cat ears.
 * One merged mesh per crowd (+ one glow draw call); dancers bob in the vertex shader.
 */

export type Pose = 'stand' | 'dance' | 'cheer' | 'drink' | 'selfie' | 'sit'
export type Accessory = 'none' | 'mask' | 'gele' | 'fila' | 'shades' | 'sunhat' | 'party' | 'witch' | 'horns' | 'ears' | 'cap'

export interface Person {
  p: V3
  rotY: number
  h: number
  skin: string
  top: string
  bottom: string
  hair: string
  hairStyle: 'afro' | 'bun' | 'long' | 'short' | 'braids'
  pose: Pose
  acc: Accessory
  accColor: string
  dress: boolean
}

export const SKINS = ['#2B1A14', '#3B241A', '#4E2F20', '#613B28', '#7E5238', '#9C6B4A', '#B78764', '#D0A684', '#E3C5A9', '#EFDAC5']
const HAIRS = ['#0A0A0C', '#141010', '#2A1A12', '#3A2418', '#6B3A22', '#B9854A', '#5E1A26']

/** A random guest. `palette` = outfit colours for the scene. */
export function guest(r: Rand, p: V3, palette: string[], poses: Pose[], accs: Accessory[], accColors: string[] = palette): Person {
  return {
    p,
    rotY: range(r, -0.6, 0.6),
    h: range(r, 1.55, 1.85),
    skin: pick(r, SKINS),
    top: pick(r, palette),
    bottom: pick(r, ['#1a1a24', '#2a2a3a', pick(r, palette), '#e8e2d6']),
    hair: pick(r, HAIRS),
    hairStyle: pick(r, ['afro', 'bun', 'long', 'short', 'braids'] as const),
    pose: pick(r, poses),
    acc: pick(r, accs),
    accColor: pick(r, accColors),
    dress: r() < 0.45,
  }
}

/** Positions scattered in a box, kept clear of the photo spots and of the camera lane in front of each. */
export function scatter(r: Rand, n: number, box: [number, number, number, number], clear: { p: V3; r: number }[]): V3[] {
  const out: V3[] = []
  let tries = 0
  while (out.length < n && tries++ < n * 60) {
    const x = range(r, box[0], box[1])
    const z = range(r, box[2], box[3])
    // never around a photo spot, and never in the camera's lane in front of it (+Z)
    if (clear.some((c) => Math.hypot(x - c.p[0], z - c.p[2]) < c.r || (Math.abs(x - c.p[0]) < 2.3 && z > c.p[2] - 0.8))) continue
    if (out.some((o) => Math.hypot(x - o[0], z - o[2]) < 0.55)) continue
    out.push([x, 0, z])
  }
  return out
}

/** One person, feet at the origin, facing +Z. Returns the phone position (selfies) if any. */
function body(person: Person, parts: Parts): V3 | null {
  const h = person.h
  const k = h / 1.7
  const sit = person.pose === 'sit'
  const hipY = sit ? 0.45 * k : 0.86 * k
  const add = (g: BufferGeometry, c: string, pos: V3, rot: V3 = [0, 0, 0], s: V3 | number = 1) => parts.add(g, c, pos, rot, s)
  // legs (or a seated pair) and the outfit
  if (sit) {
    for (const x of [-0.08, 0.08]) {
      add(new CylinderGeometry(0.06 * k, 0.055 * k, 0.42 * k, 6), person.bottom, [x * k, hipY, 0.18 * k], [Math.PI / 2, 0, 0])
      add(new CylinderGeometry(0.05 * k, 0.045 * k, 0.45 * k, 6), person.bottom, [x * k, 0.22 * k, 0.4 * k])
    }
  } else if (person.dress) {
    add(new ConeGeometry(0.26 * k, 0.62 * k, 10, 1, true), person.top, [0, 0.55 * k, 0])
    for (const x of [-0.07, 0.07]) add(new CylinderGeometry(0.045 * k, 0.04 * k, 0.3 * k, 6), person.skin, [x * k, 0.15 * k, 0])
  } else {
    for (const x of [-0.08, 0.08]) add(new CylinderGeometry(0.065 * k, 0.05 * k, hipY, 6), person.bottom, [x * k, hipY / 2, 0])
  }
  // torso, shoulders, neck, head
  add(new CylinderGeometry(0.15 * k, 0.13 * k, 0.5 * k, 8), person.top, [0, hipY + 0.25 * k, 0])
  add(new SphereGeometry(0.15 * k, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), person.top, [0, hipY + 0.5 * k, 0], [0, 0, 0], [1, 0.45, 0.8])
  add(new CylinderGeometry(0.045 * k, 0.05 * k, 0.1 * k, 6), person.skin, [0, hipY + 0.58 * k, 0])
  const headY = hipY + 0.73 * k
  add(new SphereGeometry(0.105 * k, 10, 8), person.skin, [0, headY, 0], [0, 0, 0], [0.9, 1.1, 0.95])
  // hair
  if (person.hairStyle === 'afro') add(new SphereGeometry(0.16 * k, 10, 8), person.hair, [0, headY + 0.04 * k, -0.02 * k])
  else if (person.hairStyle === 'bun') {
    add(new SphereGeometry(0.11 * k, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.6), person.hair, [0, headY + 0.005 * k, -0.005 * k])
    add(new SphereGeometry(0.06 * k, 8, 6), person.hair, [0, headY + 0.13 * k, -0.04 * k])
  } else if (person.hairStyle === 'long') {
    add(new SphereGeometry(0.115 * k, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.6), person.hair, [0, headY + 0.005 * k, -0.005 * k])
    add(new BoxGeometry(0.22 * k, 0.32 * k, 0.07 * k), person.hair, [0, headY - 0.12 * k, -0.07 * k])
  } else if (person.hairStyle === 'braids') {
    add(new SphereGeometry(0.112 * k, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.6), person.hair, [0, headY + 0.005 * k, -0.005 * k])
    for (const x of [-0.06, 0, 0.06]) add(new CylinderGeometry(0.018 * k, 0.012 * k, 0.4 * k, 5), person.hair, [x * k, headY - 0.2 * k, -0.08 * k])
  } else add(new SphereGeometry(0.11 * k, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.45), person.hair, [0, headY + 0.01 * k, -0.005 * k])
  // accessories
  const a = person.accColor
  switch (person.acc) {
    case 'mask':
      add(new BoxGeometry(0.19 * k, 0.05 * k, 0.03 * k), a, [0, headY + 0.015 * k, 0.09 * k])
      add(new ConeGeometry(0.03 * k, 0.1 * k, 4), a, [0.07 * k, headY + 0.07 * k, 0.09 * k], [0, 0, -0.5])
      break
    case 'gele':
      add(new TorusGeometry(0.11 * k, 0.045 * k, 6, 12), a, [0, headY + 0.07 * k, 0], [Math.PI / 2 - 0.3, 0, 0], [1.1, 1, 1.2])
      add(new ConeGeometry(0.14 * k, 0.16 * k, 8), a, [0.03 * k, headY + 0.15 * k, -0.04 * k], [-0.35, 0, 0.3])
      break
    case 'fila':
      add(new CylinderGeometry(0.1 * k, 0.11 * k, 0.09 * k, 10), a, [0.02 * k, headY + 0.1 * k, 0], [0, 0, 0.25])
      break
    case 'shades':
      add(new BoxGeometry(0.18 * k, 0.04 * k, 0.03 * k), '#0c0c10', [0, headY + 0.015 * k, 0.095 * k])
      break
    case 'sunhat':
      add(new CylinderGeometry(0.2 * k, 0.2 * k, 0.012 * k, 14), a, [0, headY + 0.08 * k, 0])
      add(new CylinderGeometry(0.09 * k, 0.1 * k, 0.08 * k, 10), a, [0, headY + 0.12 * k, 0])
      break
    case 'party':
      add(new ConeGeometry(0.06 * k, 0.17 * k, 8), a, [0, headY + 0.17 * k, 0], [0, 0, 0.15])
      break
    case 'witch':
      add(new CylinderGeometry(0.19 * k, 0.19 * k, 0.012 * k, 14), '#121018', [0, headY + 0.08 * k, 0])
      add(new ConeGeometry(0.1 * k, 0.32 * k, 10), '#121018', [0.02 * k, headY + 0.24 * k, -0.02 * k], [-0.15, 0, 0.2])
      break
    case 'horns':
      for (const s of [-1, 1]) add(new ConeGeometry(0.025 * k, 0.09 * k, 6), '#c8102e', [s * 0.06 * k, headY + 0.12 * k, 0], [0, 0, -s * 0.4])
      break
    case 'ears':
      for (const s of [-1, 1]) add(new ConeGeometry(0.035 * k, 0.07 * k, 3), a, [s * 0.065 * k, headY + 0.12 * k, 0], [0, 0, -s * 0.3])
      break
    case 'cap':
      add(new SphereGeometry(0.115 * k, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.45), a, [0, headY + 0.015 * k, 0])
      add(new BoxGeometry(0.16 * k, 0.012 * k, 0.1 * k), a, [0, headY + 0.04 * k, 0.12 * k])
      break
  }
  // arms by pose
  const sh = hipY + 0.47 * k
  const arm = (side: number, rot: V3, len = 0.5) => add(new CylinderGeometry(0.035 * k, 0.03 * k, len * k, 6), person.top, [side * 0.18 * k, sh - Math.cos(rot[0]) * len * 0.5 * k, Math.sin(rot[0]) * len * 0.5 * k], rot)
  let phone: V3 | null = null
  if (person.pose === 'selfie') {
    arm(-1, [0.15, 0, 0.05])
    // right arm up and forward, phone held facing the person
    add(new CylinderGeometry(0.035 * k, 0.03 * k, 0.55 * k, 6), person.top, [0.2 * k, sh + 0.12 * k, 0.2 * k], [-1.1, 0, -0.35])
    phone = [0.28 * k, sh + 0.28 * k, 0.42 * k]
    add(new BoxGeometry(0.07 * k, 0.13 * k, 0.012 * k), '#141418', phone, [0.25, Math.PI, 0])
  } else if (person.pose === 'cheer' || person.pose === 'dance') {
    const up = person.pose === 'cheer' ? 2.7 : 2.2
    for (const s of [-1, 1]) add(new CylinderGeometry(0.035 * k, 0.03 * k, 0.55 * k, 6), person.top, [s * 0.24 * k, sh + 0.22 * k, 0.04 * k], [0, 0, -s * (Math.PI - up)])
  } else if (person.pose === 'drink') {
    arm(-1, [0.1, 0, 0.08])
    add(new CylinderGeometry(0.035 * k, 0.03 * k, 0.32 * k, 6), person.top, [0.2 * k, sh - 0.14 * k, 0.04 * k], [0, 0, 0.1])
    add(new CylinderGeometry(0.035 * k, 0.03 * k, 0.28 * k, 6), person.top, [0.2 * k, sh - 0.3 * k, 0.15 * k], [-1.3, 0, 0])
    add(new CylinderGeometry(0.03 * k, 0.02 * k, 0.09 * k, 8), '#f2c14e', [0.2 * k, sh - 0.26 * k, 0.3 * k])
  } else {
    arm(-1, [0.05, 0, 0.12])
    arm(1, [0.05, 0, -0.12])
  }
  return phone
}

const VERT = /* glsl */ `
attribute vec2 aBob;
uniform float uTime;
`

export function Crowd({ people, animate, flash = true }: { people: Person[]; animate: boolean; flash?: boolean }) {
  const built = useBuilt(
    (track) => {
      const geos: BufferGeometry[] = []
      const glows: GlowPoint[] = []
      const r = rng(people.length * 7 + 3)
      for (const person of people) {
        const parts = new Parts()
        let phone: V3 | null = null
        parts.group(person.p, person.rotY, 1, () => {
          phone = body(person, parts)
        })
        const g = parts.build()
        const n = g.attributes.position.count
        const bob = new Float32Array(n * 2)
        const amp = person.pose === 'dance' ? 0.06 : person.pose === 'cheer' ? 0.035 : 0.008
        const ph = r() * 6.28
        for (let i = 0; i < n; i++) {
          bob[i * 2] = ph
          bob[i * 2 + 1] = amp
        }
        g.setAttribute('aBob', new Float32BufferAttribute(bob, 2))
        geos.push(g)
        if (phone) {
          const [px, py, pz] = phone as V3
          const c = Math.cos(person.rotY)
          const s = Math.sin(person.rotY)
          const wp: V3 = [person.p[0] + px * c + pz * s, py, person.p[2] - px * s + pz * c]
          glows.push({ p: wp, c: '#bfe0ff', s: 0.12, ph: r() })
          if (flash) glows.push({ p: wp, c: '#ffffff', s: 0.7, ph: r() })
        }
      }
      const geo = track(geos.length ? mergeGeometries(geos, false)! : new BufferGeometry())
      geos.forEach((g) => g.dispose())
      const uni = { uTime: { value: 0 } }
      const mat = track(new MeshLambertMaterial({ vertexColors: true }))
      mat.onBeforeCompile = (sh) => {
        sh.uniforms.uTime = uni.uTime
        sh.vertexShader = VERT + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed.y += abs(sin(uTime * 3.2 + aBob.x)) * aBob.y;\ntransformed.x += sin(uTime * 1.6 + aBob.x) * aBob.y * 0.5;')
      }
      return { geo, mat, uni, glows }
    },
    [people, flash],
  )
  useAnim(animate, (t) => mutate(built.uni, (u) => (u.uTime.value = t)))
  const steady = useMemo(() => built.glows.filter((g) => g.c === '#bfe0ff'), [built])
  const flashes = useMemo(() => built.glows.filter((g) => g.c === '#ffffff'), [built])
  return (
    <group>
      <mesh geometry={built.geo} material={built.mat} frustumCulled={false} />
      {steady.length > 0 && <GlowPoints points={steady} mode="twinkle" animate={animate} intensity={0.8} />}
      {flashes.length > 0 && <GlowPoints points={flashes} mode="flash" animate={animate} intensity={1.4} />}
    </group>
  )
}
