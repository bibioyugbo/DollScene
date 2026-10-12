import { Environment, Lightformer, OrbitControls } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import { CanvasTexture, Color, PerspectiveCamera, SRGBColorSpace, Vector3, WebGLRenderTarget, type Group, type SpotLight } from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import type { Appearance } from '../shared/types'
import { bodyDims } from './doll/dims'
import { Doll } from './doll/Doll'
import { DressingRoomSet, type RoomKind } from './DressingRoom'

export type LightingPreset = 'studio' | 'daylight' | 'club'
export type StageFocus = 'full' | 'face' | 'body'

export interface DollStageHandle {
  /** Square JPEG portrait of the head and shoulders, as a data URL. */
  capturePortrait: (size?: number) => string | null
  /** Full-length JPEG of the current view. */
  captureFull: () => string | null
}

export interface DollStageProps {
  appearance: Appearance
  lighting?: LightingPreset
  focus?: StageFocus
  turntable?: boolean
  undress?: boolean
  reducedMotion?: boolean
  label?: string
  /** Allow drag-to-orbit (off while swiping between starter dolls). */
  interactive?: boolean
  /** Put the doll in your walk-in closet; garment colours come from what you own. */
  closet?: string[]
  /** Put the doll in a store's fitting room (with a mirror) or the clinic. */
  room?: { kind: RoomKind; accent: string; stock?: string[]; mirror?: boolean }
}

function Lights({ preset, reducedMotion }: { preset: LightingPreset; reducedMotion: boolean }) {
  const pink = useRef<SpotLight>(null)
  const cyan = useRef<SpotLight>(null)
  useFrame(({ clock }) => {
    if (preset !== 'club' || reducedMotion) return
    const t = clock.elapsedTime
    if (pink.current) pink.current.position.set(Math.sin(t * 0.8) * 3, 3.5, Math.cos(t * 0.8) * 3)
    if (cyan.current) cyan.current.position.set(Math.cos(t * 0.6) * 3, 3, Math.sin(t * 0.6) * 3)
  })
  if (preset === 'club') {
    return (
      <>
        <ambientLight intensity={0.25} color="#5B2A86" />
        <spotLight ref={pink} position={[2, 3.5, 2]} angle={0.5} penumbra={0.6} intensity={45} color="#FF3D8B" />
        <spotLight ref={cyan} position={[-2, 3, 2]} angle={0.5} penumbra={0.6} intensity={35} color="#3DE0FF" />
        <directionalLight position={[0, 2, 4]} intensity={0.6} color="#C9A7FF" />
        <Environment resolution={64}>
          <Lightformer form="ring" intensity={3} color="#FF3D8B" position={[2, 2, 2]} scale={2} />
          <Lightformer form="rect" intensity={2} color="#3DE0FF" position={[-3, 1, 1]} scale={[2, 4, 1]} />
        </Environment>
      </>
    )
  }
  if (preset === 'daylight') {
    return (
      <>
        <hemisphereLight args={['#DDEBFF', '#E8C9A8', 1.2]} />
        <directionalLight position={[4, 6, 3]} intensity={2.4} color="#FFF1D6" />
        <Environment resolution={64}>
          <Lightformer form="rect" intensity={2.5} color="#FFF6E8" position={[0, 5, 0]} rotation-x={Math.PI / 2} scale={[8, 8, 1]} />
          <Lightformer form="rect" intensity={1} color="#BFD8FF" position={[-4, 2, 2]} scale={[4, 4, 1]} />
        </Environment>
      </>
    )
  }
  return (
    <>
      <hemisphereLight args={['#FFF3F8', '#C9A7FF', 1.1]} />
      <directionalLight position={[3, 5, 4]} intensity={1.9} />
      <directionalLight position={[-4, 2, -3]} intensity={0.8} color="#FFB3D1" />
      <Environment resolution={64}>
        <Lightformer form="rect" intensity={2} color="#FFFFFF" position={[0, 3, 3]} scale={[4, 2, 1]} />
        <Lightformer form="rect" intensity={1.2} color="#FFB3D1" position={[-3, 1, -2]} scale={[2, 4, 1]} />
        <Lightformer form="ring" intensity={1} color="#C9A7FF" position={[3, 1, 0]} scale={2} />
      </Environment>
    </>
  )
}

/** Moves the orbit target and camera between full-body, body and face framing. */
function Framing({ appearance, focus, turntable, reducedMotion, interactive }: { appearance: Appearance; focus: StageFocus; turntable: boolean; reducedMotion: boolean; interactive: boolean }) {
  const controls = useRef<OrbitControlsImpl>(null)
  const { camera, size } = useThree()
  const goal = useRef<{ pos: Vector3; target: Vector3; t: number } | null>(null)
  const d = bodyDims(appearance)
  const h = appearance.body.height
  const narrow = size.width / Math.max(1, size.height) < 0.75

  useEffect(() => {
    const headY = d.headY * h
    const target = focus === 'face' ? new Vector3(0, headY - 0.01, 0) : focus === 'body' ? new Vector3(0, d.chestY * h - 0.1, 0) : new Vector3(0, 0.85 * h, 0)
    const dist = focus === 'face' ? (narrow ? 0.85 : 0.7) : focus === 'body' ? (narrow ? 2.4 : 2) : narrow ? 4.2 : 3.6
    const dir = camera.position.clone().sub(controls.current?.target ?? target).setY(0).normalize()
    if (dir.lengthSq() < 0.1) dir.set(0.15, 0, 1).normalize()
    const pos = target.clone().add(dir.multiplyScalar(dist)).add(new Vector3(0, focus === 'face' ? 0.02 : 0.25, 0))
    goal.current = { pos, target, t: 0 }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus, h, narrow])

  useFrame((_, dt) => {
    const g = goal.current
    const c = controls.current
    if (!g || !c) return
    g.t = reducedMotion ? 1 : Math.min(1, g.t + dt * 2.5)
    const k = 1 - Math.pow(1 - g.t, 3)
    camera.position.lerp(g.pos, k)
    c.target.lerp(g.target, k)
    c.update()
    if (g.t >= 1) goal.current = null
  })

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enablePan={false}
      enableRotate={interactive}
      enableZoom={interactive}
      enableDamping
      autoRotate={turntable && !reducedMotion}
      autoRotateSpeed={1.2}
      minDistance={0.4}
      maxDistance={6}
      minPolarAngle={0.4}
      maxPolarAngle={1.7}
    />
  )
}

const Capture = forwardRef<DollStageHandle, { appearance: Appearance }>(function Capture({ appearance }, ref) {
  const { gl, scene, camera } = useThree()
  useImperativeHandle(
    ref,
    () => ({
      capturePortrait(size = 256) {
        try {
          const d = bodyDims(appearance)
          const h = appearance.body.height
          const cam = new PerspectiveCamera(26, 1, 0.05, 20)
          const headY = d.headY * h
          cam.position.set(0.12, headY + 0.02, 1.05)
          cam.lookAt(0, headY - 0.06, 0)
          const rt = new WebGLRenderTarget(size, size, { samples: 4 })
          rt.texture.colorSpace = SRGBColorSpace
          const prevBg = scene.background
          scene.background = new Color('#FFE3EF')
          gl.setRenderTarget(rt)
          gl.render(scene, cam)
          const px = new Uint8Array(size * size * 4)
          gl.readRenderTargetPixels(rt, 0, 0, size, size, px)
          gl.setRenderTarget(null)
          scene.background = prevBg
          rt.dispose()
          const c = document.createElement('canvas')
          c.width = c.height = size
          const g = c.getContext('2d')!
          const img = g.createImageData(size, size)
          for (let y = 0; y < size; y++) img.data.set(px.subarray((size - 1 - y) * size * 4, (size - y) * size * 4), y * size * 4)
          g.putImageData(img, 0, 0)
          return c.toDataURL('image/jpeg', 0.86)
        } catch {
          return null
        }
      },
      captureFull() {
        try {
          gl.render(scene, camera)
          return gl.domElement.toDataURL('image/jpeg', 0.82)
        } catch {
          return null
        }
      },
    }),
    [gl, scene, camera, appearance],
  )
  return null
})

/** Soft static floor shadow. Much cheaper than a per-frame contact-shadow pass on phones. */
function BlobShadow() {
  const tex = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = c.height = 128
    const g = c.getContext('2d')!
    const grad = g.createRadialGradient(64, 64, 4, 64, 64, 64)
    grad.addColorStop(0, 'rgba(30,11,38,0.45)')
    grad.addColorStop(1, 'rgba(30,11,38,0)')
    g.fillStyle = grad
    g.fillRect(0, 0, 128, 128)
    return new CanvasTexture(c)
  }, [])
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]}>
      <planeGeometry args={[0.9, 0.9]} />
      <meshBasicMaterial map={tex} transparent depthWrite={false} />
    </mesh>
  )
}

function Platform({ preset }: { preset: LightingPreset }) {
  const ref = useRef<Group>(null)
  return (
    <group ref={ref}>
      <mesh position={[0, -0.08, 0]}>
        <cylinderGeometry args={[0.7, 0.74, 0.16, 64]} />
        <meshPhysicalMaterial color={preset === 'club' ? '#2A0F35' : '#FF8FBF'} roughness={0.25} clearcoat={1} clearcoatRoughness={0.08} />
      </mesh>
      <mesh position={[0, 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.6, 0.66, 64]} />
        <meshBasicMaterial color={preset === 'club' ? '#FF3D8B' : '#FFFFFF'} transparent opacity={0.7} />
      </mesh>
    </group>
  )
}

/** A walk-in closet behind the doll: rails of your clothes, shoe walls, a neon mirror. */
function WalkInCloset({ colors }: { colors: string[] }) {
  const garments = colors.length ? colors : ['#FF8FBF', '#1B1B22', '#F4E9E1', '#3D7BFF', '#C8A27A', '#A86BFF']
  const rail = (side: -1 | 1) => {
    const n = 11
    return (
      <group position={[side * 1.55, 0, -0.6]} rotation={[0, -side * 0.55, 0]}>
        <mesh position={[0, 1.95, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.012, 0.012, 1.7, 8]} />
          <meshStandardMaterial color="#E9C46A" metalness={0.9} roughness={0.2} />
        </mesh>
        {Array.from({ length: n }, (_, i) => {
          const c = garments[(i * 3 + (side > 0 ? 1 : 0)) % garments.length]
          const long = (i + (side > 0 ? 1 : 0)) % 3 === 0
          return (
            <group key={i} position={[-0.78 + (i * 1.56) / (n - 1), 1.92, 0]} rotation={[0, Math.PI / 2 + Math.sin(i * 1.7) * 0.15, 0]}>
              <mesh position={[0, 0.05, 0]} rotation={[0, 0, Math.PI / 2]}>
                <torusGeometry args={[0.03, 0.004, 4, 8, Math.PI]} />
                <meshStandardMaterial color="#C7C7CF" metalness={0.8} />
              </mesh>
              <mesh position={[0, long ? -0.42 : -0.26, 0]}>
                <boxGeometry args={[0.3, long ? 0.8 : 0.48, 0.035]} />
                <meshStandardMaterial color={c} roughness={0.75} />
              </mesh>
            </group>
          )
        })}
        {/* shoe shelves under the rail */}
        {[0.12, 0.42].map((y) => (
          <group key={y}>
            <mesh position={[0, y, 0]}>
              <boxGeometry args={[1.7, 0.03, 0.32]} />
              <meshStandardMaterial color="#FFFFFF" roughness={0.4} />
            </mesh>
            {Array.from({ length: 6 }, (_, i) => (
              <mesh key={i} position={[-0.7 + i * 0.28, y + 0.06, 0]}>
                <boxGeometry args={[0.1, 0.08, 0.22]} />
                <meshStandardMaterial color={garments[(i + 2) % garments.length]} roughness={0.35} metalness={0.1} />
              </mesh>
            ))}
          </group>
        ))}
      </group>
    )
  }
  return (
    <group>
      {/* back wall with lit cubbies of bags */}
      <mesh position={[0, 1.6, -1.6]}>
        <planeGeometry args={[6, 3.6]} />
        <meshStandardMaterial color="#FBE6EE" roughness={0.95} />
      </mesh>
      {[0.95, 1.45, 1.95].map((y, r) =>
        [-1.1, -0.55, 0.55, 1.1].map((x, i) => (
          <group key={`${r}-${i}`} position={[x, y, -1.5]}>
            <mesh>
              <boxGeometry args={[0.46, 0.42, 0.2]} />
              <meshStandardMaterial color="#FFFFFF" emissive="#FFE7C2" emissiveIntensity={0.25} />
            </mesh>
            <mesh position={[0, -0.08, 0.05]}>
              <boxGeometry args={[0.2, 0.16, 0.08]} />
              <meshStandardMaterial color={garments[(r * 4 + i) % garments.length]} roughness={0.3} />
            </mesh>
          </group>
        )),
      )}
      {/* neon mirror */}
      <mesh position={[0, 1.55, -1.52]}>
        <circleGeometry args={[0.42, 48]} />
        <meshStandardMaterial color="#F6EEF3" emissive="#FFD6E8" emissiveIntensity={0.35} metalness={0.2} roughness={0.12} />
      </mesh>
      <mesh position={[0, 1.55, -1.51]}>
        <torusGeometry args={[0.44, 0.015, 8, 64]} />
        <meshBasicMaterial color="#FF3D8B" toneMapped={false} />
      </mesh>
      {rail(-1)}
      {rail(1)}
      {/* marble floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.161, -0.4]}>
        <circleGeometry args={[3.2, 48]} />
        <meshStandardMaterial color="#F7F2F4" roughness={0.18} metalness={0.05} />
      </mesh>
      <pointLight position={[0, 2.6, 0.4]} intensity={3} distance={5} color="#FFE7C2" />
    </group>
  )
}

/** The doll renderer: PBR doll, lighting presets, turntable and orbit camera, portrait capture. */
const DollStage = forwardRef<DollStageHandle, DollStageProps>(function DollStage(
  { appearance, lighting = 'studio', focus = 'full', turntable = false, undress = false, reducedMotion = false, label, interactive = true, closet, room },
  ref,
) {
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ fov: 35, position: [0.6, 1.4, 3.6], near: 0.05, far: 50 }}
      gl={{ antialias: true, alpha: true }}
      style={{ touchAction: 'none' }}
      aria-label={label ?? 'Your doll. Drag to turn, pinch to zoom.'}
      role="img"
    >
      <Lights preset={lighting} reducedMotion={reducedMotion} />
      {/* In a fitting room she stands left of the mirror, turned a little towards it. */}
      <group position={room?.mirror !== false && room ? [-0.35, 0, 0] : [0, 0, 0]} rotation={[0, room?.mirror !== false && room ? 0.25 : 0, 0]}>
        <Doll appearance={appearance} animate={!reducedMotion} undress={undress} shadow={false} />
      </group>
      {closet && <WalkInCloset colors={closet} />}
      {room ? <DressingRoomSet kind={room.kind} accent={room.accent} stock={room.stock} appearance={appearance} mirror={room.mirror !== false} animate={!reducedMotion} /> : <Platform preset={lighting} />}
      <BlobShadow />
      <Framing appearance={appearance} focus={focus} turntable={turntable} reducedMotion={reducedMotion} interactive={interactive} />
      <Capture ref={ref} appearance={appearance} />
    </Canvas>
  )
})

export default DollStage
