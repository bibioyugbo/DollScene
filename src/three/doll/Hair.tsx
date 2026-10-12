import { useLayoutEffect, useMemo, useRef, type ReactNode } from 'react'
import {
  CatmullRomCurve3,
  CylinderGeometry,
  DoubleSide,
  InstancedMesh,
  Matrix4,
  Object3D,
  Quaternion,
  SphereGeometry,
  TubeGeometry,
  Vector3,
  type Texture,
} from 'three'
import type { EdgeStyle, HairLook } from '../../shared/types'
import { hairTexture } from '../textures'
import { HEAD_R } from './dims'

const TAU = Math.PI * 2
const R = HEAD_R

function rng(seed: number) {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

function HairMat({ map, gloss, color }: { map: Texture; gloss: number; color?: string }) {
  return (
    <meshPhysicalMaterial
      map={color ? null : map}
      color={color ?? '#ffffff'}
      roughness={0.78 - gloss * 0.45}
      sheen={0.9}
      sheenRoughness={0.35}
      sheenColor="#ffffff"
      clearcoat={gloss * 0.6}
      clearcoatRoughness={0.4}
      side={DoubleSide}
    />
  )
}

interface Strand {
  pos: [number, number, number]
  dir: [number, number, number]
  len: number
  r: number
}

const DOWN = new Vector3(0, -1, 0)
const cylinder = new CylinderGeometry(1, 0.8, 1, 7, 1).translate(0, -0.5, 0)
const bump = new SphereGeometry(1, 8, 6)

/** Instanced hanging strands: locs, braids, twists. */
function Strands({ strands, map, gloss, geometry = cylinder }: { strands: Strand[]; map: Texture; gloss: number; geometry?: typeof cylinder }) {
  const ref = useRef<InstancedMesh>(null)
  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const m = new Matrix4()
    const q = new Quaternion()
    const v = new Vector3()
    strands.forEach((s, i) => {
      q.setFromUnitVectors(DOWN, v.set(...s.dir).normalize())
      m.compose(new Vector3(...s.pos), q, new Vector3(s.r, s.len, s.r))
      mesh.setMatrixAt(i, m)
    })
    mesh.count = strands.length
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [strands])
  return (
    <instancedMesh ref={ref} args={[geometry, undefined, Math.max(1, strands.length)]} frustumCulled={false}>
      <HairMat map={map} gloss={gloss} />
    </instancedMesh>
  )
}

/** Small bumps scattered over a sphere for coily texture. */
function Bumps({ center, radius, count, size, map, gloss, seed = 7 }: { center: [number, number, number]; radius: number; count: number; size: number; map: Texture; gloss: number; seed?: number }) {
  const ref = useRef<InstancedMesh>(null)
  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const r = rng(seed)
    const o = new Object3D()
    for (let i = 0; i < count; i++) {
      const u = r() * 2 - 1
      const a = r() * TAU
      const s = Math.sqrt(1 - u * u)
      o.position.set(center[0] + Math.cos(a) * s * radius, center[1] + Math.abs(u) * radius * (u > -0.3 ? 1 : -1), center[2] + Math.sin(a) * s * radius)
      o.scale.setScalar(size * (0.7 + r() * 0.6))
      o.updateMatrix()
      mesh.setMatrixAt(i, o.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [center, radius, count, size, seed])
  return (
    <instancedMesh ref={ref} args={[bump, undefined, count]} frustumCulled={false}>
      <HairMat map={map} gloss={gloss} />
    </instancedMesh>
  )
}

function hanging(count: number, len: number, r: number, seed: number, opts: { faceGap?: number; jitter?: number; maxElev?: number } = {}): Strand[] {
  const rand = rng(seed)
  const gap = opts.faceGap ?? 0.95
  const out: Strand[] = []
  for (let i = 0; i < count; i++) {
    const a = gap + ((TAU - 2 * gap) * (i + rand() * 0.6)) / count
    const e = rand() * (opts.maxElev ?? 0.55) + 0.05
    const x = Math.sin(a) * Math.cos(e) * (R + 0.01)
    const z = Math.cos(a) * Math.cos(e) * (R + 0.01)
    const y = Math.sin(e) * (R + 0.01)
    const spread = 0.22 + (opts.jitter ?? 0) * (rand() - 0.5)
    out.push({
      pos: [x, y, z],
      dir: [Math.sin(a) * spread, -1, Math.cos(a) * spread + (Math.cos(a) > 0 ? 0.12 : 0)],
      len: len * (0.85 + rand() * 0.3) + e * 0.12,
      r: r * (opts.jitter ? 0.7 + rand() * 0.8 : 1),
    })
  }
  return out
}

function Cap({ map, gloss, thetaLength = Math.PI * 0.56, extra = 0.012, tilt = -0.3 }: { map: Texture; gloss: number; thetaLength?: number; extra?: number; tilt?: number }) {
  return (
    <mesh position={[0, 0.005, -0.008]} rotation={[tilt, 0, 0]}>
      <sphereGeometry args={[R + extra, 32, 16, 0, TAU, 0, thetaLength]} />
      <HairMat map={map} gloss={gloss} />
    </mesh>
  )
}

/** Projected onto the head so edges hug the hairline. */
function onHead(x: number, y: number, lift = 0.0025): Vector3 {
  const z = Math.sqrt(Math.max(0, (R + lift) ** 2 - x * x - y * y))
  return new Vector3(x, y, z)
}

function Edges({ style, density, swirl, color }: { style: EdgeStyle; density: number; swirl: number; color: string }) {
  const geos = useMemo(() => {
    if (style === 'none') return []
    const curves: Vector3[][] = []
    const y0 = 0.075
    const amp = 0.006 + swirl * 0.014
    if (style === 'sleek') {
      curves.push([-0.09, -0.05, 0, 0.05, 0.09].map((x) => onHead(x, y0 + 0.012 - Math.abs(x) * 0.15)))
    }
    if (style === 'swoop' || style === 'dramatic') {
      const big = style === 'dramatic' ? 1.6 : 1
      for (const s of [-1, 1]) {
        const pts: Vector3[] = []
        for (let t = 0; t <= 1.001; t += 0.1) {
          const x = s * (0.04 + t * 0.07)
          const y = y0 - 0.005 - t * 0.04 + Math.sin(t * Math.PI * (1 + swirl)) * amp * big
          pts.push(onHead(x, y))
        }
        // curl at the end
        const end = pts[pts.length - 1]
        for (let k = 1; k <= 6; k++) {
          const a = (k / 6) * Math.PI * (1.2 + swirl)
          pts.push(onHead(end.x - s * Math.sin(a) * amp * big * 1.4, end.y + (1 - Math.cos(a)) * amp * big))
        }
        curves.push(pts)
      }
    }
    if (style === 'waves' || style === 'scallop') {
      const n = 3 + Math.round(density * 5)
      for (let i = 0; i < n; i++) {
        const cx = -0.08 + (0.16 * (i + 0.5)) / n
        const w = 0.16 / n / 2
        const pts: Vector3[] = []
        for (let t = 0; t <= 1.001; t += 0.125) {
          const x = cx - w + t * 2 * w
          const y = y0 + (style === 'scallop' ? -Math.sin(t * Math.PI) * amp : Math.sin(t * TAU) * amp * 0.5)
          pts.push(onHead(x, y))
        }
        curves.push(pts)
      }
    }
    const tube = 0.0012 + density * 0.0016
    return curves.map((pts) => new TubeGeometry(new CatmullRomCurve3(pts), 32, tube, 4, false))
  }, [style, density, swirl])
  return (
    <group>
      {geos.map((g, i) => (
        <mesh key={i} geometry={g}>
          <meshStandardMaterial color={color} roughness={0.4} />
        </mesh>
      ))}
    </group>
  )
}

function Parting({ parting }: { parting: HairLook['parting'] }) {
  if (parting === 'none') return null
  const x = parting === 'side-left' ? 0.05 : parting === 'side-right' ? -0.05 : 0
  if (parting === 'zigzag') {
    const pts: Vector3[] = []
    for (let i = 0; i <= 8; i++) {
      const z = 0.1 - i * 0.02
      const y = Math.sqrt(Math.max(0, (R + 0.016) ** 2 - z * z))
      pts.push(new Vector3(i % 2 ? 0.012 : -0.012, y, z))
    }
    return (
      <mesh geometry={new TubeGeometry(new CatmullRomCurve3(pts, false, 'chordal'), 32, 0.003, 4, false)}>
        <meshStandardMaterial color="#C8957A" />
      </mesh>
    )
  }
  return (
    <mesh position={[x, R + 0.005, 0.02]} rotation={[-0.3, 0, 0]}>
      <boxGeometry args={[0.005, 0.004, 0.13]} />
      <meshStandardMaterial color="#C8957A" />
    </mesh>
  )
}

function Accessories({ look, strands }: { look: HairLook; strands: Strand[] }) {
  const c = look.accessoryColor
  const acc = new Set(look.accessories)
  const tips = strands.filter((_, i) => i % 2 === 0).slice(0, 18)
  return (
    <group>
      {acc.has('beads') &&
        tips.map((s, i) => {
          const d = new Vector3(...s.dir).normalize().multiplyScalar(s.len)
          return (
            <mesh key={`b${i}`} position={[s.pos[0] + d.x, s.pos[1] + d.y, s.pos[2] + d.z]}>
              <sphereGeometry args={[0.012, 10, 8]} />
              <meshPhysicalMaterial color={i % 3 ? c : '#FFFFFF'} roughness={0.2} clearcoat={1} />
            </mesh>
          )
        })}
      {acc.has('cuffs') &&
        tips.map((s, i) => {
          const d = new Vector3(...s.dir).normalize().multiplyScalar(s.len * 0.45)
          return (
            <mesh key={`c${i}`} position={[s.pos[0] + d.x, s.pos[1] + d.y, s.pos[2] + d.z]}>
              <cylinderGeometry args={[s.r * 1.5, s.r * 1.5, 0.018, 10]} />
              <meshStandardMaterial color="#D9B24C" metalness={1} roughness={0.25} />
            </mesh>
          )
        })}
      {acc.has('clips') &&
        [-1, 1].map((sd) => (
          <mesh key={`cl${sd}`} position={[sd * 0.1, 0.09, 0.08]} rotation={[0, 0, sd * 0.6]}>
            <boxGeometry args={[0.05, 0.012, 0.01]} />
            <meshPhysicalMaterial color={c} clearcoat={1} roughness={0.2} />
          </mesh>
        ))}
      {acc.has('bows') && (
        <group position={[0.09, 0.12, 0.02]} rotation={[0, 0.4, 0.3]}>
          {[-1, 1].map((sd) => (
            <mesh key={sd} position={[sd * 0.028, 0, 0]} rotation={[0, 0, sd * -Math.PI / 2]}>
              <coneGeometry args={[0.025, 0.05, 12]} />
              <meshPhysicalMaterial color={c} sheen={1} roughness={0.5} />
            </mesh>
          ))}
          <mesh>
            <sphereGeometry args={[0.012, 10, 8]} />
            <meshPhysicalMaterial color={c} />
          </mesh>
        </group>
      )}
      {acc.has('scarf') && (
        <mesh position={[0, 0.05, -0.005]} rotation={[0.35, 0, 0]}>
          <torusGeometry args={[R + 0.018, 0.016, 10, 40]} />
          <meshPhysicalMaterial color={c} sheen={1} roughness={0.6} />
        </mesh>
      )}
      {acc.has('headwrap') && (
        <group>
          <mesh position={[0, 0.04, -0.02]} rotation={[-0.35, 0, 0]} scale={[1.08, 1.15, 1.12]}>
            <sphereGeometry args={[R + 0.02, 32, 16, 0, TAU, 0, Math.PI * 0.55]} />
            <meshPhysicalMaterial color={c} sheen={1} roughness={0.7} />
          </mesh>
          <mesh position={[0, 0.17, 0.06]}>
            <torusKnotGeometry args={[0.025, 0.012, 40, 6]} />
            <meshPhysicalMaterial color={c} sheen={1} roughness={0.7} />
          </mesh>
        </group>
      )}
      {acc.has('gele') && <Gele color={c} />}
      {acc.has('flowers') &&
        [
          [0.1, 0.1, 0.07],
          [0.12, 0.06, 0.05],
          [0.08, 0.13, 0.04],
        ].map((p, i) => (
          <group key={`f${i}`} position={p as [number, number, number]}>
            {[0, 1, 2, 3, 4].map((k) => (
              <mesh key={k} position={[Math.cos((k / 5) * TAU) * 0.012, Math.sin((k / 5) * TAU) * 0.012, 0]}>
                <sphereGeometry args={[0.009, 8, 6]} />
                <meshStandardMaterial color={c} />
              </mesh>
            ))}
            <mesh>
              <sphereGeometry args={[0.007, 8, 6]} />
              <meshStandardMaterial color="#FFC24D" />
            </mesh>
          </group>
        ))}
      {acc.has('pearls') &&
        Array.from({ length: 9 }, (_, i) => {
          const a = -0.9 + (i / 8) * 1.8
          return (
            <mesh key={`p${i}`} position={[Math.sin(a) * (R + 0.012), 0.08 + Math.cos(a) * 0.03, Math.cos(a) * 0.06]}>
              <sphereGeometry args={[0.008, 10, 8]} />
              <meshPhysicalMaterial color="#F5F0E6" clearcoat={1} roughness={0.25} />
            </mesh>
          )
        })}
    </group>
  )
}

/** Gele: stacked, flared folds of stiff fabric. */
export function Gele({ color, map }: { color: string; map?: Texture | null }) {
  return (
    <group position={[0, 0.07, -0.01]}>
      <mesh rotation={[-0.25, 0, 0]} scale={[1.12, 1.1, 1.15]}>
        <sphereGeometry args={[R + 0.025, 32, 16, 0, TAU, 0, Math.PI * 0.5]} />
        <meshPhysicalMaterial color={map ? '#fff' : color} map={map ?? null} sheen={1} roughness={0.45} side={DoubleSide} />
      </mesh>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} position={[0, 0.07 + i * 0.03, -0.02 - i * 0.012]} rotation={[-0.5 - i * 0.12, 0, 0]} scale={[1.25 - i * 0.12, 0.5, 1]}>
          <coneGeometry args={[0.16 - i * 0.02, 0.07, 24, 1, true]} />
          <meshPhysicalMaterial color={map ? '#fff' : color} map={map ?? null} sheen={1} roughness={0.4} side={DoubleSide} />
        </mesh>
      ))}
      <mesh position={[0.11, 0.12, 0.04]} rotation={[0, 0, -0.9]} scale={[1, 0.4, 1]}>
        <coneGeometry args={[0.06, 0.14, 16, 1, true]} />
        <meshPhysicalMaterial color={map ? '#fff' : color} map={map ?? null} sheen={1} roughness={0.4} side={DoubleSide} />
      </mesh>
    </group>
  )
}

/** All 25 hairstyles. Rendered in head space (origin at the head centre). */
export function Hair({ look, hideTop = false }: { look: HairLook; hideTop?: boolean }) {
  const map = hairTexture(look)
  const gloss = look.dye.gloss
  const style = look.style
  const length = look.length
  const volume = look.volume

  const strands = useMemo<Strand[]>(() => {
    const L = 0.12 + length * 0.5
    switch (style) {
      case 'locs':
        return hanging(26, L, 0.017, 11)
      case 'sisterlocs':
        return hanging(60, L, 0.008, 12)
      case 'freeform-locs':
        return hanging(18, L, 0.026, 13, { jitter: 0.6 })
      case 'faux-locs':
        return hanging(30, L, 0.018, 14)
      case 'knotless-braids':
        return hanging(54, L, 0.01, 15)
      case 'box-braids':
        return hanging(44, L, 0.012, 16)
      case 'fulani-braids':
        return hanging(24, L, 0.01, 17, { maxElev: 0.2 })
      case 'twists':
        return hanging(40, L * 0.8, 0.014, 18)
      default:
        return []
    }
  }, [style, length])

  const sheetLen = 0.14 + length * 0.42
  const sideArc = { start: 0.85, length: TAU - 1.7 }

  let body: ReactNode
  switch (style) {
    case 'bald':
      body = null
      break
    case 'buzz':
      body = <Cap map={map} gloss={0} extra={0.004} thetaLength={Math.PI * 0.6} />
      break
    case 'fade':
    case 'taper':
      body = (
        <group>
          <Cap map={map} gloss={gloss} extra={0.016} thetaLength={Math.PI * 0.32} tilt={-0.25} />
          <mesh position={[0, 0.005, -0.008]} rotation={[-0.3, 0, 0]}>
            <sphereGeometry args={[R + 0.003, 32, 16, 0, TAU, 0, Math.PI * 0.58]} />
            <meshStandardMaterial color={look.color} transparent opacity={style === 'fade' ? 0.35 : 0.65} roughness={1} />
          </mesh>
        </group>
      )
      break
    case 'short-cut':
    case 'twa':
      body = (
        <group>
          <Cap map={map} gloss={gloss} extra={0.02 + volume * 0.012} thetaLength={Math.PI * 0.56} />
          {style === 'twa' && <Bumps center={[0, 0.03, -0.01]} radius={R + 0.02} count={90} size={0.014} map={map} gloss={gloss} />}
        </group>
      )
      break
    case 'afro': {
      const rad = 0.2 + volume * 0.12
      body = (
        <group>
          <mesh position={[0, 0.06, -0.035]} scale={[1.08, 0.95, 0.95]}>
            <sphereGeometry args={[rad, 32, 24]} />
            <HairMat map={map} gloss={gloss} />
          </mesh>
          <Bumps center={[0, 0.06, -0.035]} radius={rad * 0.97} count={180} size={0.03} map={map} gloss={gloss} />
        </group>
      )
      break
    }
    case 'puffs':
      body = (
        <group>
          <Cap map={map} gloss={gloss} />
          {[-1, 1].map((s) => (
            <group key={s}>
              <mesh position={[s * 0.14, 0.12, -0.04]}>
                <sphereGeometry args={[0.07 + volume * 0.05, 24, 16]} />
                <HairMat map={map} gloss={gloss} />
              </mesh>
              <Bumps center={[s * 0.14, 0.12, -0.04]} radius={0.07 + volume * 0.05} count={50} size={0.018} map={map} gloss={gloss} seed={s + 20} />
            </group>
          ))}
        </group>
      )
      break
    case 'high-puff':
      body = (
        <group>
          <Cap map={map} gloss={gloss} />
          <mesh position={[0, 0.2, -0.05]}>
            <sphereGeometry args={[0.1 + volume * 0.07, 24, 16]} />
            <HairMat map={map} gloss={gloss} />
          </mesh>
          <Bumps center={[0, 0.2, -0.05]} radius={0.1 + volume * 0.07} count={70} size={0.02} map={map} gloss={gloss} seed={33} />
        </group>
      )
      break
    case 'bun':
      body = (
        <group>
          <Cap map={map} gloss={gloss} />
          <mesh position={[0, 0.15, -0.07]}>
            <sphereGeometry args={[0.06 + volume * 0.04, 20, 14]} />
            <HairMat map={map} gloss={gloss} />
          </mesh>
        </group>
      )
      break
    case 'natural-updo':
      body = (
        <group>
          <Cap map={map} gloss={gloss} extra={0.02} />
          <mesh position={[0, 0.12, -0.03]} rotation={[Math.PI / 2 - 0.4, 0, 0]}>
            <torusGeometry args={[0.1, 0.04 + volume * 0.025, 12, 32]} />
            <HairMat map={map} gloss={gloss} />
          </mesh>
        </group>
      )
      break
    case 'bantu-knots': {
      const knots: [number, number, number][] = [
        [0, 0.15, 0.04],
        [-0.08, 0.13, 0.02],
        [0.08, 0.13, 0.02],
        [-0.1, 0.08, -0.07],
        [0.1, 0.08, -0.07],
        [0, 0.13, -0.08],
        [0, 0.03, -0.14],
      ]
      body = (
        <group>
          <Cap map={map} gloss={gloss} extra={0.006} />
          {knots.map((p, i) => (
            <mesh key={i} position={p} rotation={[0.1, i, 0]}>
              <coneGeometry args={[0.035 + volume * 0.012, 0.06, 12]} />
              <HairMat map={map} gloss={gloss} />
            </mesh>
          ))}
        </group>
      )
      break
    }
    case 'cornrows':
      body = (
        <group>
          <Cap map={map} gloss={gloss} extra={0.004} />
          {[-0.09, -0.06, -0.03, 0, 0.03, 0.06, 0.09].map((x) => (
            <mesh key={x} position={[x, 0, -0.01]} rotation={[0, Math.PI / 2, 0]}>
              <torusGeometry args={[Math.sqrt(Math.max(0.001, (R + 0.008) ** 2 - x * x)), 0.011, 6, 28, Math.PI * 0.95]} />
              <HairMat map={map} gloss={gloss} />
            </mesh>
          ))}
        </group>
      )
      break
    case 'bob':
      body = (
        <group>
          <Cap map={map} gloss={gloss} />
          <mesh position={[0, -0.06 + (0.5 - length) * 0.04, 0]}>
            <cylinderGeometry args={[R + 0.016, R + 0.03 + volume * 0.02, 0.2 + length * 0.06, 32, 1, true, sideArc.start, sideArc.length]} />
            <HairMat map={map} gloss={gloss} />
          </mesh>
        </group>
      )
      break
    case 'lace-front':
    case 'sew-in':
    case 'silk-press': {
      const flare = style === 'sew-in' ? 0.06 + volume * 0.06 : style === 'lace-front' ? 0.04 + volume * 0.04 : 0.02
      body = (
        <group>
          <Cap map={map} gloss={gloss} />
          <mesh position={[0, -sheetLen / 2 + 0.05, -0.01]}>
            <cylinderGeometry args={[R + 0.016, R + flare, sheetLen, 32, 1, true, sideArc.start, sideArc.length]} />
            <HairMat map={map} gloss={gloss} />
          </mesh>
        </group>
      )
      break
    }
    case 'pixie':
      body = (
        <group>
          <Cap map={map} gloss={gloss} extra={0.018 + volume * 0.01} thetaLength={Math.PI * 0.5} />
          <mesh position={[0.03, 0.095, 0.105]} rotation={[0.6, 0, -0.5]} scale={[1.4, 0.45, 0.8]}>
            <sphereGeometry args={[0.05, 16, 10]} />
            <HairMat map={map} gloss={gloss} />
          </mesh>
        </group>
      )
      break
    case 'ponytail':
      body = (
        <group>
          <Cap map={map} gloss={gloss} extra={0.008} thetaLength={Math.PI * 0.6} />
          <mesh position={[0, 0.1, -0.15]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.022, 0.008, 8, 20]} />
            <meshStandardMaterial color={look.accessoryColor} roughness={0.5} />
          </mesh>
          <mesh position={[0, 0.1 - (0.1 + length * 0.4) / 2, -0.175]} rotation={[0.12, 0, 0]}>
            <cylinderGeometry args={[0.032 + volume * 0.02, 0.012, 0.1 + length * 0.4, 14]} />
            <HairMat map={map} gloss={gloss} />
          </mesh>
        </group>
      )
      break
    case 'long-straight':
    case 'long-curly': {
      const len = 0.3 + length * 0.4
      const curly = style === 'long-curly'
      body = (
        <group>
          <Cap map={map} gloss={gloss} />
          <mesh position={[0, -len / 2 + 0.05, -0.01]}>
            <cylinderGeometry args={[R + 0.016, R + (curly ? 0.08 + volume * 0.08 : 0.02), len, 32, 1, true, sideArc.start, sideArc.length]} />
            <HairMat map={map} gloss={gloss} />
          </mesh>
          {curly && <Bumps center={[0, -len * 0.55, -0.04]} radius={R + 0.05 + volume * 0.05} count={120} size={0.026} map={map} gloss={gloss} seed={51} />}
        </group>
      )
      break
    }
    case 'fringe-bob':
      body = (
        <group>
          <Cap map={map} gloss={gloss} />
          <mesh position={[0, -0.05, 0]}>
            <cylinderGeometry args={[R + 0.016, R + 0.03 + volume * 0.02, 0.2, 32, 1, true, sideArc.start, sideArc.length]} />
            <HairMat map={map} gloss={gloss} />
          </mesh>
          <mesh position={[0, 0.07, 0.125]} rotation={[-0.35, 0, 0]}>
            <boxGeometry args={[0.2, 0.06, 0.03]} />
            <HairMat map={map} gloss={gloss} />
          </mesh>
        </group>
      )
      break
    case 'mohawk':
    case 'shaved-sides':
      body = (
        <group>
          <mesh position={[0, 0.005, -0.008]} rotation={[-0.3, 0, 0]}>
            <sphereGeometry args={[R + 0.003, 32, 16, 0, TAU, 0, Math.PI * 0.58]} />
            <meshStandardMaterial color={look.color} transparent opacity={0.3} roughness={1} />
          </mesh>
          {style === 'mohawk' ? (
            <mesh position={[0, R + 0.02, -0.01]} rotation={[Math.PI / 2, 0, 0]} scale={[0.35, 1.2, 0.5 + volume * 0.8]}>
              <cylinderGeometry args={[0.06, 0.06, 0.24, 16]} />
              <HairMat map={map} gloss={gloss} />
            </mesh>
          ) : (
            <mesh position={[0.03, R - 0.005, 0.02]} rotation={[-0.2, 0, -0.35]} scale={[1.2, 0.5 + volume * 0.3, 1.25]}>
              <sphereGeometry args={[0.1, 20, 12, 0, TAU, 0, Math.PI * 0.5]} />
              <HairMat map={map} gloss={gloss} />
            </mesh>
          )}
        </group>
      )
      break
    case 'fulani-braids':
      body = (
        <group>
          <Cap map={map} gloss={gloss} extra={0.004} />
          {[-0.05, 0, 0.05].map((x) => (
            <mesh key={x} position={[x, 0, -0.01]} rotation={[0, Math.PI / 2, 0]}>
              <torusGeometry args={[Math.sqrt((R + 0.008) ** 2 - x * x), 0.01, 6, 28, Math.PI * 0.95]} />
              <HairMat map={map} gloss={gloss} />
            </mesh>
          ))}
          <Strands strands={strands} map={map} gloss={gloss} />
        </group>
      )
      break
    default:
      // locs, sisterlocs, freeform, faux locs, braids, twists
      body = (
        <group>
          <Cap map={map} gloss={gloss} extra={0.01} />
          <Strands strands={strands} map={map} gloss={gloss} />
        </group>
      )
  }

  return (
    <group>
      {!hideTop && body}
      {!hideTop && style !== 'bald' && style !== 'buzz' && <Parting parting={look.parting} />}
      {style !== 'bald' && <Edges style={look.edges.style} density={look.edges.density} swirl={look.edges.swirl} color={look.color} />}
      <Accessories look={look} strands={strands} />
    </group>
  )
}
