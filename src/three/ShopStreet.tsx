import { OrbitControls } from '@react-three/drei'
import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber'
import { useMemo, useRef, useState } from 'react'
import { CanvasTexture, SRGBColorSpace, type Group } from 'three'

export interface Storefront {
  id: string
  label: string
  tagline: string
  color: string
}

function signTexture(label: string, color: string, tagline: string): CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 160
  const g = c.getContext('2d')!
  g.fillStyle = '#0E0A12'
  g.fillRect(0, 0, 512, 160)
  g.strokeStyle = color
  g.lineWidth = 8
  g.strokeRect(8, 8, 496, 144)
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.shadowColor = color
  g.shadowBlur = 18
  g.fillStyle = '#FFFFFF'
  let size = 64
  g.font = `900 ${size}px "Bricolage Grotesque", system-ui, sans-serif`
  while (g.measureText(label.toUpperCase()).width > 460 && size > 28) g.font = `900 ${(size -= 4)}px "Bricolage Grotesque", system-ui, sans-serif`
  g.fillText(label.toUpperCase(), 256, 66)
  g.shadowBlur = 0
  g.fillStyle = color
  g.font = '600 22px system-ui, sans-serif'
  g.fillText(tagline.slice(0, 40), 256, 124)
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  t.anisotropy = 4
  return t
}

function Mannequin({ x, color }: { x: number; color: string }) {
  return (
    <group position={[x, 0.15, -0.2]}>
      <mesh position={[0, 0.55, 0]}>
        <cylinderGeometry args={[0.12, 0.2, 0.7, 12]} />
        <meshStandardMaterial color={color} roughness={0.6} />
      </mesh>
      <mesh position={[0, 1, 0]}>
        <sphereGeometry args={[0.09, 12, 12]} />
        <meshStandardMaterial color="#EADBCB" />
      </mesh>
      <mesh position={[0, 0.1, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.3, 6]} />
        <meshStandardMaterial color="#C7C7CF" metalness={0.8} />
      </mesh>
    </group>
  )
}

function Shopfront({ store, angle, radius, onOpen, reducedMotion }: { store: Storefront; angle: number; radius: number; onOpen: (id: string) => void; reducedMotion: boolean }) {
  const sign = useMemo(() => signTexture(store.label, store.color, store.tagline), [store])
  const glow = useRef<Group>(null)
  const [hover, setHover] = useState(false)
  useFrame(({ clock }) => {
    if (glow.current) glow.current.position.z = 0.35 + (hover && !reducedMotion ? Math.sin(clock.elapsedTime * 6) * 0.02 : 0)
  })
  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    if (e.delta < 6) onOpen(store.id)
  }
  const x = Math.sin(angle) * radius
  const z = -Math.cos(angle) * radius
  return (
    <group
      position={[x, 0, z]}
      rotation={[0, -angle, 0]}
      onClick={click}
      onPointerOver={(e) => {
        e.stopPropagation()
        setHover(true)
        document.body.style.cursor = 'pointer'
      }}
      onPointerOut={() => {
        setHover(false)
        document.body.style.cursor = ''
      }}
    >
      {/* building */}
      <mesh position={[0, 2.2, -0.6]}>
        <boxGeometry args={[2.6, 4.4, 1]} />
        <meshStandardMaterial color="#F4EDE6" roughness={0.9} />
      </mesh>
      {/* shop window */}
      <mesh position={[0, 1.05, -0.09]}>
        <boxGeometry args={[2.2, 1.7, 0.04]} />
        <meshStandardMaterial color="#FFF8F0" emissive={store.color} emissiveIntensity={hover ? 0.35 : 0.15} transparent opacity={0.9} />
      </mesh>
      <Mannequin x={-0.6} color={store.color} />
      <Mannequin x={0.6} color="#1B1B22" />
      {/* door */}
      <mesh position={[0, 0.95, -0.06]}>
        <boxGeometry args={[0.6, 1.5, 0.02]} />
        <meshStandardMaterial color="#1B1420" />
      </mesh>
      {/* striped awning */}
      <group ref={glow} position={[0, 2.15, 0.35]}>
        {Array.from({ length: 7 }, (_, i) => (
          <mesh key={i} position={[-1.2 + i * 0.4, 0, 0]} rotation={[0.45, 0, 0]}>
            <boxGeometry args={[0.4, 0.04, 1]} />
            <meshStandardMaterial color={i % 2 ? '#FFFFFF' : store.color} />
          </mesh>
        ))}
      </group>
      {/* neon sign */}
      <mesh position={[0, 3.25, -0.08]}>
        <planeGeometry args={[2.4, 0.75]} />
        <meshBasicMaterial map={sign} toneMapped={false} />
      </mesh>
      <pointLight position={[0, 2.8, 1]} intensity={hover ? 4 : 1.5} distance={4} color={store.color} />
    </group>
  )
}

/** The Strip: Lagos shops in a ring around you. Drag to look along the street, tap a door to walk in. */
export default function ShopStreet({ stores, onOpen, reducedMotion }: { stores: Storefront[]; onOpen: (id: string) => void; reducedMotion: boolean }) {
  const radius = 7
  const spread = 0.48
  const start = -((stores.length - 1) * spread) / 2
  return (
    <Canvas dpr={[1, 1.75]} camera={{ fov: 60, position: [0, 1.7, 0.01], near: 0.1, far: 60 }} style={{ touchAction: 'none' }} aria-label="Shopping street. Tap a shop." role="img">
      <color attach="background" args={['#FFC7A1']} />
      <fog attach="fog" args={['#FFC7A1', 9, 22]} />
      <hemisphereLight args={['#FFE7D6', '#5B3B4A', 1.1]} />
      <directionalLight position={[-4, 8, 3]} intensity={1.6} color="#FFE1C2" />
      {/* road and pavement */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <circleGeometry args={[radius - 1.2, 48]} />
        <meshStandardMaterial color="#3B3A42" roughness={0.95} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
        <ringGeometry args={[radius - 1.2, radius + 2, 64]} />
        <meshStandardMaterial color="#D9CFC6" roughness={0.9} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <ringGeometry args={[radius - 3.05, radius - 2.95, 64]} />
        <meshBasicMaterial color="#F5C518" />
      </mesh>
      {stores.map((s, i) => (
        <Shopfront key={s.id} store={s} angle={start + i * spread} radius={radius} onOpen={onOpen} reducedMotion={reducedMotion} />
      ))}
      <OrbitControls
        target={[0, 1.7, 0]}
        enableZoom={false}
        enablePan={false}
        rotateSpeed={-0.35}
        enableDamping
        dampingFactor={0.08}
        minPolarAngle={Math.PI / 2 - 0.15}
        maxPolarAngle={Math.PI / 2 + 0.05}
        // Looking at the shop at angle a means the camera sits at azimuth -a.
        minAzimuthAngle={start - 0.35}
        maxAzimuthAngle={-start + 0.35}
      />
    </Canvas>
  )
}
