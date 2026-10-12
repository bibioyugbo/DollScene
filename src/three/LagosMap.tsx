import { CameraControls, RoundedBox } from '@react-three/drei'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { Color, Object3D, Vector3, type BufferGeometry, type Group, type InstancedMesh, type Mesh, type MeshStandardMaterial } from 'three'
import type { Place } from '../shared/places'
import type { Appearance } from '../shared/types'
import { Doll } from './doll/Doll'

/** Stylised land masses: rectangles [x0, z0, x1, z1] with a colour. Not to scale, tuned for play. */
const LAND: {
  name: string
  r: [number, number, number, number]
  color: string
}[] = [
  { name: 'Mainland', r: [-7, -6, -2.9, -1.7], color: '#E9DCC8' },
  { name: 'Lagos Island', r: [-3.3, -3.4, 0, 1.2], color: '#F0E2CF' },
  { name: 'Ikoyi', r: [0.8, -3.4, 3, -1.1], color: '#E6EEDB' },
  { name: 'Victoria Island', r: [-4.7, 1.9, 0.6, 4.5], color: '#F3E6D6' },
  { name: 'Lekki', r: [1.5, -1.3, 7, 3.6], color: '#E3EDD8' },
]

const rand = (seed: number) => {
  let s = seed
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646
}

function Water() {
  const ref = useRef<Mesh<BufferGeometry, MeshStandardMaterial>>(null)
  useFrame(({ clock }) => {
    const m = ref.current
    if (m) m.material.emissiveIntensity = 0.12 + Math.sin(clock.elapsedTime * 0.8) * 0.03
  })
  return (
    <>
      <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.06, 0]} receiveShadow>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color="#4FB3D9" emissive="#1E88B8" emissiveIntensity={0.12} roughness={0.15} metalness={0.2} />
      </mesh>
      {/* Atlantic: deeper blue south of VI */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.055, 12]}>
        <planeGeometry args={[40, 15]} />
        <meshStandardMaterial color="#1F6FB2" roughness={0.2} transparent opacity={0.8} />
      </mesh>
    </>
  )
}

function Land() {
  return (
    <group>
      {LAND.map(({ name, r: [x0, z0, x1, z1], color }) => (
        <RoundedBox key={name} args={[x1 - x0, 0.14, z1 - z0]} radius={0.06} smoothness={2} position={[(x0 + x1) / 2, 0, (z0 + z1) / 2]} receiveShadow>
          <meshStandardMaterial color={color} roughness={0.95} />
        </RoundedBox>
      ))}
      {/* Third Mainland Bridge and Carter Bridge so the islands connect */}
      <mesh position={[-3.1, 0.08, -1.2]} rotation={[0, 0.5, 0]}>
        <boxGeometry args={[0.18, 0.04, 2]} />
        <meshStandardMaterial color="#B9B9C2" />
      </mesh>
      <mesh position={[-1.5, 0.08, 1.6]}>
        <boxGeometry args={[0.18, 0.04, 1]} />
        <meshStandardMaterial color="#B9B9C2" />
      </mesh>
    </group>
  )
}

/** Generic city blocks, scattered on land, kept clear of the landmarks. */
function Blocks({ places }: { places: Place[] }) {
  const ref = useRef<InstancedMesh>(null)
  const blocks = useMemo(() => {
    const r = rand(7)
    const out: { x: number; z: number; h: number; w: number; c: string }[] = []
    const palette = ['#FFFFFF', '#F7E8F0', '#E7E9F2', '#FFF4DE', '#DDEFF5', '#F3D9E5']
    for (const {
      r: [x0, z0, x1, z1],
      name,
    } of LAND) {
      const n = Math.round((x1 - x0) * (z1 - z0) * 2.2)
      for (let i = 0; i < n; i++) {
        const x = x0 + 0.3 + r() * (x1 - x0 - 0.6)
        const z = z0 + 0.3 + r() * (z1 - z0 - 0.6)
        if (places.some((p) => Math.hypot(p.pos[0] - x, p.pos[1] - z) < 0.75)) continue
        const tall = name === 'Victoria Island' || name === 'Ikoyi' ? 1.4 : name === 'Lagos Island' ? 1 : 0.6
        out.push({
          x,
          z,
          h: 0.15 + r() * r() * tall,
          w: 0.14 + r() * 0.18,
          c: palette[Math.floor(r() * palette.length)],
        })
      }
    }
    return out
  }, [places])
  useLayoutEffect(() => {
    const m = ref.current
    if (!m) return
    const o = new Object3D()
    const c = new Color()
    blocks.forEach((b, i) => {
      o.position.set(b.x, 0.07 + b.h / 2, b.z)
      o.scale.set(b.w, b.h, b.w)
      o.updateMatrix()
      m.setMatrixAt(i, o.matrix)
      m.setColorAt(i, c.set(b.c))
    })
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
  }, [blocks])
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, blocks.length]} castShadow>
      <boxGeometry />
      <meshStandardMaterial roughness={0.6} />
    </instancedMesh>
  )
}

function Tree({ x, z, s = 1 }: { x: number; z: number; s?: number }) {
  return (
    <group position={[x, 0.07, z]} scale={s}>
      <mesh position={[0, 0.08, 0]}>
        <cylinderGeometry args={[0.015, 0.02, 0.16, 6]} />
        <meshStandardMaterial color="#7A5230" />
      </mesh>
      <mesh position={[0, 0.22, 0]}>
        <coneGeometry args={[0.09, 0.22, 7]} />
        <meshStandardMaterial color="#2FA36B" />
      </mesh>
    </group>
  )
}

function DiscoBall({ color, y = 0.85 }: { color: string; y?: number }) {
  const ref = useRef<Mesh>(null)
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 1.5
  })
  return (
    <group position={[0, y, 0]}>
      <mesh ref={ref}>
        <icosahedronGeometry args={[0.1, 1]} />
        <meshStandardMaterial color="#E9E9F2" metalness={0.9} roughness={0.15} flatShading emissive={color} emissiveIntensity={0.35} />
      </mesh>
      <pointLight color={color} intensity={2} distance={1.6} />
    </group>
  )
}

/** One stylised landmark per place, drawn from primitives so it loads instantly. */
function Landmark({ place }: { place: Place }) {
  const c = place.color
  switch (place.model) {
    case 'runway':
      return (
        <group>
          {[
            [-0.45, -0.35, 1.2],
            [0.4, -0.4, 0.9],
            [-0.1, -0.55, 1.5],
          ].map(([x, z, h], i) => (
            <mesh key={i} position={[x, h / 2, z]}>
              <boxGeometry args={[0.22, h, 0.22]} />
              <meshStandardMaterial color="#9FD4F2" metalness={0.7} roughness={0.1} />
            </mesh>
          ))}
          <mesh position={[0, 0.05, 0.25]}>
            <boxGeometry args={[0.18, 0.06, 1]} />
            <meshStandardMaterial color={c} emissive={c} emissiveIntensity={0.5} />
          </mesh>
        </group>
      )
    case 'beach':
      return (
        <group>
          <mesh position={[0, 0.02, 0.2]}>
            <boxGeometry args={[1.4, 0.04, 0.5]} />
            <meshStandardMaterial color="#F5D9A8" />
          </mesh>
          {[-0.45, 0, 0.45].map((x, i) => (
            <group key={x} position={[x, 0, 0.2]}>
              <mesh position={[0, 0.15, 0]}>
                <cylinderGeometry args={[0.01, 0.01, 0.3]} />
                <meshStandardMaterial color="#fff" />
              </mesh>
              <mesh position={[0, 0.3, 0]}>
                <coneGeometry args={[0.16, 0.08, 10]} />
                <meshStandardMaterial color={['#FF2E88', '#F5C518', '#00A88F'][i]} />
              </mesh>
            </group>
          ))}
        </group>
      )
    case 'bridge-link':
      return (
        <group>
          <mesh position={[0, 0.12, 0]}>
            <boxGeometry args={[2, 0.05, 0.16]} />
            <meshStandardMaterial color="#D8D8E0" />
          </mesh>
          <mesh position={[0.35, 0.5, 0]}>
            <boxGeometry args={[0.06, 0.8, 0.06]} />
            <meshStandardMaterial color="#F2F2F7" />
          </mesh>
          {[-0.7, -0.35, 0.05, 0.7].map((x) => (
            <mesh key={x} position={[(x + 0.35) / 2, 0.5, 0]} rotation={[0, 0, Math.atan2(0.75, 0.35 - x)]}>
              <boxGeometry args={[Math.hypot(0.35 - x, 0.75), 0.008, 0.008]} />
              <meshStandardMaterial color={c} emissive={c} emissiveIntensity={0.6} />
            </mesh>
          ))}
        </group>
      )
    case 'canopy':
      return (
        <group>
          {[
            [-0.4, -0.2],
            [0.3, 0.3],
            [-0.1, 0.4],
            [0.4, -0.3],
            [0, -0.1],
            [-0.4, 0.3],
          ].map(([x, z], i) => (
            <Tree key={i} x={x} z={z} s={1.6} />
          ))}
          <mesh position={[0, 0.3, 0]} rotation={[0, 0.6, 0]}>
            <boxGeometry args={[1.1, 0.02, 0.05]} />
            <meshStandardMaterial color="#C49A6C" />
          </mesh>
        </group>
      )
    case 'gallery':
      return (
        <group>
          {[0, 1, 2, 3, 4].map((f) => (
            <mesh key={f} position={[0, 0.08 + f * 0.12, 0]} rotation={[0, f * 0.2, 0]}>
              <boxGeometry args={[0.45 - f * 0.04, 0.11, 0.45 - f * 0.04]} />
              <meshStandardMaterial color={['#E8505B', '#F5C518', '#00A88F', '#3D7BFF', '#A86BFF'][f]} />
            </mesh>
          ))}
        </group>
      )
    case 'theatre':
      return (
        <group>
          <mesh position={[0, 0.15, 0]}>
            <cylinderGeometry args={[0.45, 0.5, 0.3, 24]} />
            <meshStandardMaterial color="#EDEAF2" />
          </mesh>
          <mesh position={[0, 0.38, 0]}>
            <cylinderGeometry args={[0.28, 0.62, 0.16, 24]} />
            <meshStandardMaterial color={c} metalness={0.3} roughness={0.4} />
          </mesh>
          <mesh position={[0, 0.5, 0]}>
            <cylinderGeometry args={[0.16, 0.28, 0.12, 24]} />
            <meshStandardMaterial color="#EDEAF2" />
          </mesh>
        </group>
      )
    case 'market':
      return (
        <group>
          {Array.from({ length: 12 }, (_, i) => (
            <mesh key={i} position={[((i % 4) - 1.5) * 0.22, 0.12, (Math.floor(i / 4) - 1) * 0.22]} rotation={[0, i, 0]}>
              <coneGeometry args={[0.11, 0.08, 4]} />
              <meshStandardMaterial color={['#FF6B2C', '#F5C518', '#00A88F', '#FF2E88', '#3D7BFF'][i % 5]} />
            </mesh>
          ))}
        </group>
      )
    case 'park':
      return (
        <group>
          <mesh position={[0, 0.075, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.6, 24]} />
            <meshStandardMaterial color="#8BD17C" />
          </mesh>
          {[
            [-0.3, -0.2],
            [0.3, 0.1],
            [0, 0.35],
            [-0.2, 0.25],
          ].map(([x, z], i) => (
            <Tree key={i} x={x} z={z} />
          ))}
          <mesh position={[0.1, 0.15, -0.2]}>
            <boxGeometry args={[0.35, 0.15, 0.2]} />
            <meshStandardMaterial color={c} />
          </mesh>
        </group>
      )
    case 'square':
      return (
        <group>
          <mesh position={[0, 0.08, 0]}>
            <boxGeometry args={[1, 0.02, 0.7]} />
            <meshStandardMaterial color="#E4E1EA" />
          </mesh>
          {[-0.3, 0, 0.3].map((x, i) => (
            <group key={x} position={[x, 0, -0.3]}>
              <mesh position={[0, 0.3, 0]}>
                <cylinderGeometry args={[0.008, 0.008, 0.45]} />
                <meshStandardMaterial color="#fff" />
              </mesh>
              <mesh position={[0.06, 0.48, 0]}>
                <boxGeometry args={[0.12, 0.07, 0.005]} />
                <meshStandardMaterial color={i === 1 ? '#FFFFFF' : '#008751'} />
              </mesh>
            </group>
          ))}
        </group>
      )
    case 'rooftop':
      return (
        <group>
          <mesh position={[0, 0.6, 0]}>
            <boxGeometry args={[0.32, 1.2, 0.32]} />
            <meshStandardMaterial color="#2A2A38" metalness={0.5} roughness={0.2} />
          </mesh>
          <mesh position={[0, 1.22, 0]}>
            <boxGeometry args={[0.36, 0.04, 0.36]} />
            <meshStandardMaterial color={c} emissive={c} emissiveIntensity={0.8} />
          </mesh>
        </group>
      )
    case 'club':
      return (
        <group>
          <mesh position={[0, 0.3, 0]}>
            <boxGeometry args={[0.7, 0.6, 0.55]} />
            <meshStandardMaterial color="#1B1222" roughness={0.4} />
          </mesh>
          <mesh position={[0, 0.45, 0.28]}>
            <boxGeometry args={[0.6, 0.06, 0.01]} />
            <meshBasicMaterial color={c} toneMapped={false} />
          </mesh>
          <DiscoBall color={c} />
        </group>
      )
    case 'boat':
      return (
        <group position={[0, -0.05, 0]}>
          <mesh position={[0, 0.06, 0]} scale={[1, 0.5, 0.42]}>
            <sphereGeometry args={[0.45, 20, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
            <meshStandardMaterial color="#FFFFFF" side={2} />
          </mesh>
          <mesh position={[0, 0.12, 0]}>
            <boxGeometry args={[0.5, 0.12, 0.26]} />
            <meshStandardMaterial color="#EDEAF2" />
          </mesh>
          <mesh position={[0, 0.2, 0]}>
            <boxGeometry args={[0.52, 0.015, 0.28]} />
            <meshBasicMaterial color={c} toneMapped={false} />
          </mesh>
          <DiscoBall color={c} y={0.45} />
        </group>
      )
    default:
      return (
        <mesh position={[0, 0.3, 0]}>
          <boxGeometry args={[0.4, 0.6, 0.4]} />
          <meshStandardMaterial color={c} />
        </mesh>
      )
  }
}

function Spot({ place, selected, onSelect, reducedMotion }: { place: Place; selected: boolean; onSelect: (id: string) => void; reducedMotion: boolean }) {
  const pin = useRef<Group>(null)
  useFrame(({ clock }) => {
    if (pin.current && !reducedMotion) {
      pin.current.position.y = 1.7 + Math.sin(clock.elapsedTime * 2 + place.pos[0]) * 0.06
      pin.current.rotation.y = clock.elapsedTime
    }
  })
  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    if (e.delta < 6) onSelect(place.id)
  }
  return (
    <group position={[place.pos[0], 0.07, place.pos[1]]} onClick={click} onPointerOver={() => (document.body.style.cursor = 'pointer')} onPointerOut={() => (document.body.style.cursor = '')}>
      <Landmark place={place} />
      <group ref={pin} position={[0, 1.7, 0]} scale={selected ? 1.4 : 1}>
        <mesh>
          <octahedronGeometry args={[0.13, 0]} />
          <meshStandardMaterial color={place.color} emissive={place.color} emissiveIntensity={selected ? 0.9 : 0.4} />
        </mesh>
      </group>
    </group>
  )
}

const tmp = new Vector3()

/** Projects every spot's label point to screen pixels each frame (DOM labels stay crisp and clickable). */
function LabelProjector({ places, onProject }: { places: Place[]; onProject: (id: string, x: number, y: number, depth: number, visible: boolean) => void }) {
  const { camera, size } = useThree()
  useFrame(() => {
    for (const p of places) {
      tmp.set(p.pos[0], 2.15, p.pos[1]).project(camera)
      const dist = camera.position.distanceTo(new Vector3(p.pos[0], 2.15, p.pos[1]))
      onProject(p.id, ((tmp.x + 1) / 2) * size.width, ((1 - tmp.y) / 2) * size.height, dist, tmp.z < 1 && Math.abs(tmp.x) < 1.2 && Math.abs(tmp.y) < 1.2)
    }
  })
  return null
}

function CameraRig({ target, reducedMotion }: { target: Place | null; reducedMotion: boolean }) {
  const ref = useRef<CameraControls>(null)
  useEffect(() => {
    const c = ref.current
    if (!c) return
    if (target) void c.setLookAt(target.pos[0] + 2.4, 3.2, target.pos[1] + 3.6, target.pos[0], 0.3, target.pos[1], !reducedMotion)
    else void c.setLookAt(0, 11, 11, 0, 0, 0.5, !reducedMotion)
  }, [target, reducedMotion])
  return <CameraControls ref={ref} makeDefault minDistance={2.5} maxDistance={22} maxPolarAngle={1.2} smoothTime={0.6} />
}

export interface LagosMapProps {
  places: Place[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  /** Your doll, standing at the selected spot. */
  appearance: Appearance | null
  reducedMotion: boolean
}

/** DollScene's Lagos: a toy-map of real spots. Drag to look around, tap a spot to fly there. */
export default function LagosMap({ places, selectedId, onSelect, appearance, reducedMotion }: LagosMapProps) {
  const selected = places.find((p) => p.id === selectedId) ?? null
  const labels = useRef(new Map<string, HTMLButtonElement>())
  const project = (id: string, x: number, y: number, dist: number, visible: boolean) => {
    const el = labels.current.get(id)
    if (!el) return
    el.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px) scale(${Math.max(0.7, Math.min(1.35, 11 / dist))})`
    el.style.visibility = visible ? 'visible' : 'hidden'
    el.style.zIndex = String(100 - Math.round(dist * 2))
  }
  return (
    <div className="relative isolate h-full w-full">
      <Canvas
        dpr={[1, 1.75]}
        shadows={false}
        camera={{ fov: 42, position: [0, 11, 11], near: 0.1, far: 80 }}
        style={{ touchAction: 'none' }}
        onPointerMissed={() => onSelect(null)}
        aria-label="Map of Lagos. Tap a spot."
        role="img"
      >
        <color attach="background" args={['#BFE6F7']} />
        <fog attach="fog" args={['#BFE6F7', 18, 34]} />
        <hemisphereLight args={['#FFFFFF', '#C9E9F5', 1.3]} />
        <directionalLight position={[6, 10, 4]} intensity={1.8} color="#FFF1DC" />
        <Water />
        <Land />
        <Blocks places={places} />
        {places.map((p) => (
          <Spot key={p.id} place={p} selected={p.id === selectedId} onSelect={onSelect} reducedMotion={reducedMotion} />
        ))}
        {selected && appearance && (
          <group position={[selected.pos[0] + 0.55, 0.07, selected.pos[1] + 0.55]} scale={0.32} rotation={[0, -0.6, 0]}>
            <Doll appearance={appearance} animate={!reducedMotion} />
          </group>
        )}
        <CameraRig target={selected} reducedMotion={reducedMotion} />
        <LabelProjector places={places} onProject={project} />
      </Canvas>
      <div className="pointer-events-none absolute inset-0 isolate overflow-hidden">
        {places.map((p) => (
          <button
            key={p.id}
            ref={(el) => {
              if (el) labels.current.set(p.id, el)
              else labels.current.delete(p.id)
            }}
            type="button"
            onClick={() => onSelect(p.id)}
            className="pointer-events-auto absolute top-0 left-0 rounded-full px-2.5 py-1 text-[13px] font-bold whitespace-nowrap shadow-lg"
            style={{
              background: p.id === selectedId ? p.color : 'rgba(255,255,255,0.92)',
              color: '#0B0B12',
              visibility: 'hidden',
            }}
          >
            {p.name}
          </button>
        ))}
      </div>
    </div>
  )
}
