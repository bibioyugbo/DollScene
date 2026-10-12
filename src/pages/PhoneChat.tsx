import { RoundedBox } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Suspense, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { Vector3, type Group, type Mesh } from 'three'
import { ChatPanel } from '../components/chat/ChatPanel'
import { Icon } from '../components/Icon'
import { useReducedMotion } from '../hooks/useMediaQuery'
import { ErrorBoundary } from '../three/ErrorBoundary'

const W = 1
const H = 1.3
const T = 0.11
const SCREEN = { w: 0.86, h: 1.08, y: H / 2 + 0.02 }
const OPEN = -0.1
const CLOSED = Math.PI * 0.94

const corner = new Vector3()

/** Keeps the phone filling the view on tall phones and wide screens alike. */
function Rig() {
  const { camera, size } = useThree()
  useFrame(() => {
    const aspect = size.width / size.height
    const dist = Math.max(2.7, 1.25 / (0.728 * aspect))
    camera.position.lerp(new Vector3(0, 0.25, dist), 0.2)
    camera.lookAt(0, 0.42, 0)
  })
  return null
}

interface ScreenRect {
  x: number
  y: number
  w: number
  h: number
  opacity: number
}

function FlipPhone({ open, onScreen, onShut, reducedMotion }: { open: boolean; onScreen: (r: ScreenRect) => void; onShut: () => void; reducedMotion: boolean }) {
  const root = useRef<Group>(null)
  const lid = useRef<Group>(null)
  const screen = useRef<Mesh>(null)
  const charm = useRef<Group>(null)
  const k = useRef(reducedMotion ? 1 : 0)
  const shut = useRef(false)
  const { camera, size } = useThree()

  useFrame(({ clock }, dt) => {
    const target = open ? 1 : 0
    k.current += (target - k.current) * Math.min(1, dt * (reducedMotion ? 60 : 5.5))
    if (!open && k.current < 0.03 && !shut.current) {
      shut.current = true
      onShut()
    }
    const e = k.current
    if (lid.current) lid.current.rotation.x = CLOSED + (OPEN - CLOSED) * e
    if (root.current) {
      root.current.rotation.y = (1 - e) * 0.7 + (reducedMotion ? 0 : Math.sin(clock.elapsedTime * 0.6) * 0.02 * e)
      root.current.position.y = reducedMotion ? 0 : Math.sin(clock.elapsedTime * 1.1) * 0.015
    }
    if (charm.current && !reducedMotion) charm.current.rotation.z = Math.sin(clock.elapsedTime * 2.2) * 0.25

    // Project the screen rectangle for the DOM chat.
    const m = screen.current
    if (!m) return
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const [x, y] of [
      [-SCREEN.w / 2, -SCREEN.h / 2],
      [SCREEN.w / 2, -SCREEN.h / 2],
      [-SCREEN.w / 2, SCREEN.h / 2],
      [SCREEN.w / 2, SCREEN.h / 2],
    ]) {
      corner.set(x, y, 0)
      m.localToWorld(corner)
      corner.project(camera)
      const px = ((corner.x + 1) / 2) * size.width
      const py = ((1 - corner.y) / 2) * size.height
      minX = Math.min(minX, px)
      maxX = Math.max(maxX, px)
      minY = Math.min(minY, py)
      maxY = Math.max(maxY, py)
    }
    onScreen({ x: minX, y: minY, w: maxX - minX, h: maxY - minY, opacity: e > 0.93 ? Math.min(1, (e - 0.93) / 0.06) : 0 })
  })

  const body = '#FF5FA2'
  const keys: [number, number][] = []
  for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) keys.push([(c - 1) * 0.26, -0.62 - r * 0.15])

  return (
    <group ref={root}>
      {/* base: keypad half */}
      <RoundedBox args={[W, H, T]} radius={0.08} smoothness={4} position={[0, -H / 2, 0]}>
        <meshPhysicalMaterial color={body} metalness={0.35} roughness={0.28} clearcoat={1} clearcoatRoughness={0.15} />
      </RoundedBox>
      <mesh position={[0, -H / 2 - 0.02, T / 2 + 0.001]}>
        <planeGeometry args={[W - 0.14, H - 0.16]} />
        <meshStandardMaterial color="#FFD1E6" metalness={0.5} roughness={0.25} />
      </mesh>
      {/* nav pad and soft keys */}
      <mesh position={[0, -0.28, T / 2 + 0.012]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.13, 0.13, 0.02, 32]} />
        <meshStandardMaterial color="#F2F2F7" metalness={0.8} roughness={0.15} />
      </mesh>
      <mesh position={[0, -0.28, T / 2 + 0.024]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 0.02, 24]} />
        <meshStandardMaterial color="#FF2E88" />
      </mesh>
      {[-0.33, 0.33].map((x) => (
        <RoundedBox key={x} args={[0.2, 0.08, 0.02]} radius={0.03} position={[x, -0.28, T / 2 + 0.01]}>
          <meshStandardMaterial color={x < 0 ? '#C8FF3D' : '#FF2E88'} />
        </RoundedBox>
      ))}
      {keys.map(([x, y], i) => (
        <RoundedBox key={i} args={[0.22, 0.11, 0.02]} radius={0.035} position={[x, y, T / 2 + 0.01]}>
          <meshStandardMaterial color="#FFF5FA" roughness={0.4} />
        </RoundedBox>
      ))}
      {/* hinge */}
      <mesh position={[0, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.07, 0.07, W - 0.1, 24]} />
        <meshStandardMaterial color="#E9E9EF" metalness={0.9} roughness={0.2} />
      </mesh>
      {/* phone charm: a little pink star on a string */}
      <group ref={charm} position={[W / 2 - 0.05, -H + 0.05, 0]}>
        <mesh position={[0.02, -0.12, 0]}>
          <cylinderGeometry args={[0.004, 0.004, 0.24, 6]} />
          <meshStandardMaterial color="#222" />
        </mesh>
        <mesh position={[0.02, -0.27, 0]}>
          <octahedronGeometry args={[0.06, 0]} />
          <meshStandardMaterial color="#C8FF3D" emissive="#C8FF3D" emissiveIntensity={0.3} />
        </mesh>
        <mesh position={[0.02, -0.18, 0]}>
          <sphereGeometry args={[0.03, 12, 12]} />
          <meshStandardMaterial color="#FFFFFF" metalness={0.3} roughness={0.1} />
        </mesh>
      </group>

      {/* lid: screen half, hinged at y = 0 */}
      <group ref={lid} rotation={[CLOSED, 0, 0]}>
        <RoundedBox args={[W, H, T]} radius={0.08} smoothness={4} position={[0, H / 2, 0]}>
          <meshPhysicalMaterial color={body} metalness={0.35} roughness={0.28} clearcoat={1} clearcoatRoughness={0.15} />
        </RoundedBox>
        {/* inner bezel + screen */}
        <mesh position={[0, SCREEN.y, T / 2 + 0.001]}>
          <planeGeometry args={[SCREEN.w + 0.06, SCREEN.h + 0.06]} />
          <meshStandardMaterial color="#14101A" roughness={0.3} />
        </mesh>
        <mesh ref={screen} position={[0, SCREEN.y, T / 2 + 0.003]}>
          <planeGeometry args={[SCREEN.w, SCREEN.h]} />
          <meshBasicMaterial color="#FFF0F6" />
        </mesh>
        {/* earpiece */}
        <mesh position={[0, H - 0.07, T / 2 + 0.002]}>
          <planeGeometry args={[0.2, 0.025]} />
          <meshStandardMaterial color="#2A2230" />
        </mesh>
        {/* outside: little round screen with a heart */}
        <mesh position={[0, H * 0.62, -T / 2 - 0.002]} rotation={[0, Math.PI, 0]}>
          <circleGeometry args={[0.18, 32]} />
          <meshStandardMaterial color="#1B1020" emissive="#FF2E88" emissiveIntensity={0.25} />
        </mesh>
        <mesh position={[0, H * 0.62, -T / 2 - 0.004]} rotation={[0, Math.PI, Math.PI / 4]}>
          <planeGeometry args={[0.08, 0.08]} />
          <meshBasicMaterial color="#FF5FA2" />
        </mesh>
      </group>
    </group>
  )
}

/** Chat inside a 3D flip phone that flips open when you arrive and snaps shut when you leave. */
export default function PhoneChat() {
  const { cid = '' } = useParams()
  const navigate = useNavigate()
  const reducedMotion = useReducedMotion()
  const overlay = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(true)
  const close = () => setOpen(false)
  // Pin the DOM chat to the phone's projected screen, every frame, without re-rendering.
  const placeScreen = (r: ScreenRect) => {
    const el = overlay.current
    if (!el) return
    el.style.left = `${r.x}px`
    el.style.top = `${r.y}px`
    el.style.width = `${r.w}px`
    el.style.height = `${r.h}px`
    el.style.opacity = String(r.opacity)
    el.style.pointerEvents = r.opacity > 0.5 ? 'auto' : 'none'
  }
  return (
    <div className="force-dark fixed inset-0 overflow-hidden bg-[radial-gradient(ellipse_at_50%_35%,#3B1030_0%,#12081A_55%,#07050B_100%)]">
      <ErrorBoundary fallback={<div className="mx-auto h-full max-w-md">{<ChatPanel cid={cid} />}</div>}>
        <Suspense fallback={null}>
          <Canvas dpr={[1, 2]} camera={{ fov: 40, position: [0, 0.25, 2.8], near: 0.1, far: 30 }} style={{ position: 'absolute', inset: 0 }} aria-hidden>
            <ambientLight intensity={0.6} />
            <directionalLight position={[2, 3, 4]} intensity={2.2} />
            <pointLight position={[-2, 1, 2]} intensity={6} color="#FF5FA2" />
            <pointLight position={[2, -1, 1.5]} intensity={3} color="#C8FF3D" />
            <Rig />
            <FlipPhone open={open} onScreen={placeScreen} reducedMotion={reducedMotion} onShut={() => navigate('/friends?tab=chats')} />
          </Canvas>
          <div ref={overlay} className="absolute overflow-hidden rounded-[10px] opacity-0 shadow-[0_0_40px_rgba(255,46,136,0.25)]" style={{ left: 0, top: 0, width: 0, height: 0 }}>
            <ChatPanel cid={cid} compact />
          </div>
        </Suspense>
      </ErrorBoundary>
      <button type="button" onClick={close} className="absolute top-3 left-3 z-10 flex min-h-11 items-center gap-2 rounded-full bg-white/10 px-4 text-sm font-semibold text-white backdrop-blur hover:bg-white/20">
        <Icon name="back" className="size-4" /> Flip shut
      </button>
    </div>
  )
}
