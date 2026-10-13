import { Html } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import { AdditiveBlending, BufferAttribute, BufferGeometry, CanvasTexture, Color, MathUtils, SRGBColorSpace, type Group, type Mesh, type MeshStandardMaterial, type PerspectiveCamera, type PointLight } from 'three'
import { create } from 'zustand'
import { useRealtime } from '../net/realtime'
import { DOORS, type DoorDef, type DoorId } from '../rooms'
import { click, haptic, sfx } from '../ui/sound'

/**
 * The Hub: a first-person view of a round, lamplit atrium lined with tall doors. Drag (or the 3D
 * arrows) to look around; a door glows when you point at it or tap it; tapping walks you through it.
 * A live count of the real people inside floats over every door.
 */

const R = 6.2 // atrium radius (m)
const EYE = 1.62
const STEP = MathUtils.degToRad(24)

/** Where each door stands: an arc in front of the player. */
export const doorAngle = (i: number) => (i - (DOORS.length - 1) / 2) * STEP

interface HubState {
  /** Where the player is looking (radians, 0 = the middle door). */
  yaw: number
  hovered: DoorId | null
  /** Walking through a door: 0..1. */
  entering: { id: DoorId; t: number } | null
  look: (d: number) => void
  setHovered: (d: DoorId | null) => void
}

export const useHub = create<HubState>((set, get) => ({
  yaw: 0,
  hovered: null,
  entering: null,
  look: (d) => set({ yaw: MathUtils.clamp(get().yaw + d, doorAngle(0) - 0.15, doorAngle(DOORS.length - 1) + 0.15) }),
  setHovered: (hovered) => set({ hovered }),
}))

/** Turn to look straight at the next/previous door. */
export function lookToDoor(dir: 1 | -1) {
  const s = useHub.getState()
  const i = Math.round(s.yaw / STEP + (DOORS.length - 1) / 2)
  const j = MathUtils.clamp(i + dir, 0, DOORS.length - 1)
  useHub.setState({ yaw: doorAngle(j), hovered: DOORS[j].id })
}

/* ------------------------------------------------------------------ painted textures */

function signTexture(d: DoorDef) {
  const c = document.createElement('canvas')
  c.width = 1024
  c.height = 256
  const g = c.getContext('2d')!
  g.fillStyle = '#0c0a10'
  g.fillRect(0, 0, 1024, 256)
  g.strokeStyle = d.frame
  g.lineWidth = 10
  g.strokeRect(14, 14, 996, 228)
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.shadowColor = d.glow
  g.shadowBlur = 28
  g.fillStyle = '#ffffff'
  g.font = '900 104px "Red Hat Display", system-ui, sans-serif'
  g.fillText(d.name, 512, 112, 940)
  g.shadowBlur = 10
  g.fillStyle = d.frame
  g.font = '700 42px "Red Hat Display", system-ui, sans-serif'
  g.fillText(d.sub, 512, 196, 940)
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  t.anisotropy = 4
  return t
}

/** The glyph on each door panel (original drawings: no logos). */
function glyphTexture(d: DoorDef) {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 1024
  const g = c.getContext('2d')!
  const grad = g.createLinearGradient(0, 0, 0, 1024)
  grad.addColorStop(0, d.door)
  grad.addColorStop(1, '#050407')
  g.fillStyle = grad
  g.fillRect(0, 0, 512, 1024)
  // panels
  g.strokeStyle = 'rgba(255,255,255,0.08)'
  g.lineWidth = 6
  g.strokeRect(50, 60, 412, 400)
  g.strokeRect(50, 520, 412, 440)
  g.save()
  g.translate(256, 260)
  g.strokeStyle = d.frame
  g.fillStyle = d.frame
  g.lineWidth = 14
  g.lineCap = 'round'
  g.lineJoin = 'round'
  g.shadowColor = d.glow
  g.shadowBlur = 30
  const p = new Path2D()
  switch (d.glyph) {
    case 'mirror':
      g.beginPath()
      g.ellipse(0, -10, 90, 120, 0, 0, Math.PI * 2)
      g.stroke()
      g.beginPath()
      g.moveTo(-60, 150)
      g.lineTo(60, 150)
      g.moveTo(0, 110)
      g.lineTo(0, 150)
      g.stroke()
      g.beginPath()
      g.moveTo(-30, -60)
      g.quadraticCurveTo(-50, -10, -30, 30)
      g.stroke()
      break
    case 'butterfly':
      for (const s of [1, -1]) {
        g.beginPath()
        g.ellipse(s * 60, -45, 62, 46, s * -0.6, 0, Math.PI * 2)
        g.fill()
        g.beginPath()
        g.ellipse(s * 44, 45, 42, 36, s * 0.5, 0, Math.PI * 2)
        g.fill()
      }
      g.fillStyle = '#111'
      g.fillRect(-7, -70, 14, 140)
      break
    case 'heart':
      p.moveTo(0, 90)
      p.bezierCurveTo(-140, -10, -80, -120, 0, -50)
      p.bezierCurveTo(80, -120, 140, -10, 0, 90)
      g.fill(p)
      break
    case 'sparkle':
      for (const [x, y, r] of [
        [0, 0, 110],
        [90, -90, 40],
        [-85, 80, 34],
      ]) {
        g.beginPath()
        g.moveTo(x, y - r)
        g.quadraticCurveTo(x, y, x + r, y)
        g.quadraticCurveTo(x, y, x, y + r)
        g.quadraticCurveTo(x, y, x - r, y)
        g.quadraticCurveTo(x, y, x, y - r)
        g.fill()
      }
      break
    case 'gele':
      g.beginPath()
      g.ellipse(0, 20, 120, 80, 0, Math.PI, 0)
      g.stroke()
      for (let i = -2; i <= 2; i++) {
        g.beginPath()
        g.moveTo(i * 40, 20)
        g.quadraticCurveTo(i * 60, -110, i * 30 + 10, -130)
        g.stroke()
      }
      break
    case 'bolt':
      p.moveTo(30, -150)
      p.lineTo(-60, 10)
      p.lineTo(5, 10)
      p.lineTo(-30, 150)
      p.lineTo(70, -20)
      p.lineTo(5, -20)
      p.closePath()
      g.fill(p)
      break
    case 'drop':
      p.moveTo(0, -140)
      p.bezierCurveTo(90, -20, 100, 60, 0, 110)
      p.bezierCurveTo(-100, 60, -90, -20, 0, -140)
      g.fill(p)
      g.fillStyle = 'rgba(255,255,255,0.6)'
      g.beginPath()
      g.ellipse(-30, 20, 14, 30, 0.3, 0, Math.PI * 2)
      g.fill()
      break
    case 'drip':
      // an IV drip: bag, line, a drop
      g.strokeRect(-60, -150, 120, 140)
      g.beginPath()
      g.moveTo(0, -10)
      g.lineTo(0, 60)
      g.stroke()
      p.moveTo(0, 70)
      p.bezierCurveTo(40, 120, 30, 150, 0, 150)
      p.bezierCurveTo(-30, 150, -40, 120, 0, 70)
      g.fill(p)
      g.fillRect(-60, -90, 120, 80)
      break
    case 'camera':
      g.strokeRect(-120, -60, 240, 150)
      g.beginPath()
      g.arc(0, 15, 50, 0, Math.PI * 2)
      g.stroke()
      g.fillRect(-50, -90, 70, 30)
      break
    case 'hanger':
      g.beginPath()
      g.moveTo(0, -60)
      g.lineTo(-130, 60)
      g.lineTo(130, 60)
      g.closePath()
      g.stroke()
      break
  }
  g.restore()
  // handle
  g.fillStyle = d.frame
  g.fillRect(420, 560, 18, 90)
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  t.anisotropy = 4
  return t
}

/* ------------------------------------------------------------------ one door */

function Door({ d, i, count, onEnter }: { d: DoorDef; i: number; count: number | null; onEnter: (id: DoorId) => void }) {
  const a = doorAngle(i)
  const hovered = useHub((s) => s.hovered === d.id)
  const entering = useHub((s) => s.entering?.id === d.id)
  const [fonts, setFonts] = useState(0)
  useEffect(() => {
    let live = true
    document.fonts?.ready.then(() => live && setFonts((n) => n + 1))
    return () => {
      live = false
    }
  }, [])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const sign = useMemo(() => signTexture(d), [d, fonts])
  const glyph = useMemo(() => glyphTexture(d), [d])
  const frame = useRef<MeshStandardMaterial>(null)
  const light = useRef<PointLight>(null)
  const panel = useRef<Group>(null)
  const glow = useMemo(() => new Color(d.glow), [d.glow])
  useFrame((_, dt) => {
    const on = hovered || entering ? 1 : 0
    if (frame.current) frame.current.emissiveIntensity = MathUtils.lerp(frame.current.emissiveIntensity, 0.25 + on * 2.2, 1 - Math.exp(-dt * 8))
    if (light.current) light.current.intensity = MathUtils.lerp(light.current.intensity, 0.6 + on * 7, 1 - Math.exp(-dt * 8))
    if (panel.current) {
      const t = useHub.getState().entering
      const open = entering && t ? Math.min(1, t.t * 1.6) : 0
      panel.current.rotation.y = MathUtils.lerp(panel.current.rotation.y, -open * 1.4, 1 - Math.exp(-dt * 10))
    }
  })
  const enter = () => {
    if (useHub.getState().entering) return
    click('go')
    sfx('door')
    haptic(20)
    useHub.setState({ hovered: d.id, entering: { id: d.id, t: 0 } })
    onEnter(d.id)
  }
  return (
    <group rotation={[0, -a, 0]}>
      <group position={[0, 0, -R]}>
        {/* frame */}
        <mesh position={[0, 1.55, -0.02]}>
          <boxGeometry args={[1.62, 3.2, 0.18]} />
          <meshStandardMaterial ref={frame} color={d.frame} emissive={glow} emissiveIntensity={0.25} roughness={0.35} metalness={0.6} />
        </mesh>
        {/* the opening, dark behind the door */}
        <mesh position={[0, 1.45, 0.075]}>
          <planeGeometry args={[1.3, 2.9]} />
          <meshBasicMaterial color={d.glow} transparent opacity={0.85} />
        </mesh>
        {/* door panel on its hinge (left edge) */}
        <group ref={panel} position={[-0.65, 0, 0.1]}>
          <mesh
            position={[0.65, 1.45, 0]}
            onPointerOver={(e) => (e.stopPropagation(), useHub.getState().setHovered(d.id), (document.body.style.cursor = 'pointer'))}
            onPointerOut={() => (useHub.getState().setHovered(null), (document.body.style.cursor = ''))}
            onClick={(e) => (e.stopPropagation(), enter())}
          >
            <boxGeometry args={[1.3, 2.9, 0.06]} />
            <meshStandardMaterial map={glyph} roughness={0.45} metalness={0.15} emissive={glow} emissiveIntensity={hovered ? 0.18 : 0.04} />
          </mesh>
        </group>
        {/* sign */}
        <mesh position={[0, 3.55, 0.06]}>
          <planeGeometry args={[2.1, 0.52]} />
          <meshBasicMaterial map={sign} toneMapped={false} />
        </mesh>
        <pointLight ref={light} position={[0, 2.2, 1.2]} color={d.glow} intensity={0.6} distance={5} decay={2} />
        {/* the floor pool of light */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0.9]}>
          <circleGeometry args={[0.9, 40]} />
          <meshBasicMaterial color={d.glow} transparent opacity={hovered ? 0.32 : 0.12} blending={AdditiveBlending} depthWrite={false} />
        </mesh>
        {/* the live headcount over the door */}
        <Html position={[0, 4.05, 0.1]} center distanceFactor={7} zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
          <div className={`whitespace-nowrap rounded-full px-3 py-1 text-[15px] font-extrabold text-white shadow-lg ${hovered ? 'bg-black/80' : 'bg-black/55'}`} aria-label={count === null ? 'Live count unavailable' : `${count} people in ${d.name}`}>
            <span aria-hidden>👥</span> {count === null ? '–' : count} in here
          </div>
        </Html>
      </group>
    </group>
  )
}

/* ------------------------------------------------------------------ the atrium */

function Sparkles() {
  const ref = useRef<Mesh>(null)
  const geo = useMemo(() => {
    const n = 220
    const p = new Float32Array(n * 3)
    const rnd = (k: number) => (Math.sin(k * 127.1) * 43758.5453) % 1 + (Math.sin(k * 127.1) < 0 ? 1 : 0)
    for (let i = 0; i < n; i++) {
      const a = rnd(i + 1) * Math.PI * 2
      const r = 1.5 + rnd(i + 301) * (R - 2)
      p.set([Math.sin(a) * r, 0.4 + rnd(i + 601) * 4, -Math.cos(a) * r], i * 3)
    }
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(p, 3))
    return g
  }, [])
  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.y = clock.elapsedTime * 0.02
  })
  return (
    <points ref={ref as never} geometry={geo}>
      <pointsMaterial size={0.05} color="#ffe2b8" transparent opacity={0.75} blending={AdditiveBlending} depthWrite={false} sizeAttenuation />
    </points>
  )
}

function Atrium() {
  return (
    <group>
      <color attach="background" args={['#0b0810']} />
      <fog attach="fog" args={['#0b0810', 8, 20]} />
      <hemisphereLight args={['#ffd9c0', '#1a1022', 0.55]} />
      <directionalLight position={[2, 6, 3]} intensity={0.6} color="#ffe9d6" />
      {/* polished floor with an inlaid ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <circleGeometry args={[R + 1, 96]} />
        <meshStandardMaterial color="#2a1f2a" roughness={0.18} metalness={0.4} />
      </mesh>
      {[1.4, 2.6, 3.8].map((r) => (
        <mesh key={r} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
          <ringGeometry args={[r, r + 0.035, 96]} />
          <meshStandardMaterial color="#e8b48a" metalness={0.9} roughness={0.25} emissive="#5a3a20" emissiveIntensity={0.4} />
        </mesh>
      ))}
      {/* curved wall */}
      <mesh position={[0, 2.6, 0]}>
        <cylinderGeometry args={[R + 0.25, R + 0.25, 5.2, 96, 1, true]} />
        <meshStandardMaterial color="#1c1420" roughness={0.8} side={1} />
      </mesh>
      {/* ceiling lamps */}
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2
        return (
          <mesh key={i} position={[Math.sin(a) * 3.6, 4.6, -Math.cos(a) * 3.6]}>
            <sphereGeometry args={[0.12, 16, 12]} />
            <meshBasicMaterial color="#ffe6c4" toneMapped={false} />
          </mesh>
        )
      })}
      <mesh position={[0, 5.1, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <circleGeometry args={[R + 0.3, 64]} />
        <meshStandardMaterial color="#150f18" side={2} />
      </mesh>
      {/* a central planter */}
      <mesh position={[0, 0.25, 0]}>
        <cylinderGeometry args={[0.55, 0.6, 0.5, 40]} />
        <meshStandardMaterial color="#e8b48a" metalness={0.7} roughness={0.3} />
      </mesh>
      <Sparkles />
    </group>
  )
}

/** Drives the first-person camera: look-around yaw, a slight sway, and the walk through a door. */
function HubCamera({ onWalked }: { onWalked: (id: DoorId) => void }) {
  const get = useThree((s) => s.get)
  const yaw = useRef(0)
  const done = useRef<DoorId | null>(null)
  useEffect(() => {
    const cam = get().camera as PerspectiveCamera
    cam.fov = 62
    cam.updateProjectionMatrix()
    return () => {
      cam.fov = 30
      cam.updateProjectionMatrix()
    }
  }, [get])
  useFrame(({ clock, camera }, dt) => {
    const s = useHub.getState()
    yaw.current = MathUtils.lerp(yaw.current, s.yaw, 1 - Math.exp(-dt * 6))
    let fwd = 0
    if (s.entering) {
      const i = DOORS.findIndex((d) => d.id === s.entering!.id)
      const t = Math.min(1, s.entering.t + dt / 1.1)
      useHub.setState({ entering: { ...s.entering, t } })
      yaw.current = MathUtils.lerp(yaw.current, doorAngle(i), 1 - Math.exp(-dt * 10))
      fwd = (R - 0.4) * t * t * (3 - 2 * t)
      if (t >= 1 && done.current !== s.entering.id) {
        done.current = s.entering.id
        onWalked(s.entering.id)
      }
    } else done.current = null
    const sway = Math.sin(clock.elapsedTime * 0.6) * 0.01
    camera.position.set(Math.sin(yaw.current) * fwd, EYE + sway, -Math.cos(yaw.current) * fwd + 0.0)
    camera.lookAt(Math.sin(yaw.current) * (fwd + 3), EYE - 0.02, -Math.cos(yaw.current) * (fwd + 3))
  })
  return null
}

export function Hub({ onEnter, onWalked }: { onEnter: (id: DoorId) => void; onWalked: (id: DoorId) => void }) {
  const counts = useRealtime((s) => s.counts)
  const connected = useRealtime((s) => s.status === 'live')
  return (
    <group>
      <Atrium />
      {DOORS.map((d, i) => (
        <Door key={d.id} d={d} i={i} count={connected ? (counts[`door:${d.id}`] ?? 0) : null} onEnter={onEnter} />
      ))}
      <HubCamera onWalked={onWalked} />
    </group>
  )
}
