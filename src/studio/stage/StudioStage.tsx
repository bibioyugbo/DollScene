import { Environment, Lightformer } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Component, Suspense, useEffect, useMemo, useRef, type ReactNode } from 'react'
import { Color, MathUtils, Vector3, type Group, type PerspectiveCamera, type ShaderMaterial } from 'three'
import type { CharacterCatalog } from '../character/catalog'
import { StudioCharacter } from '../character/StudioCharacter'
import { useShownLook, useStudio, type Angle, type Framing } from '../state/store'

/** Catches a failed model load inside the canvas and reports it to the DOM overlay. */
class CharacterBoundary extends Component<{ children: ReactNode; onError: (e: Error) => void; resetKey: number }, { failed: boolean; key: number }> {
  state = { failed: false, key: this.props.resetKey }
  static getDerivedStateFromProps(p: { resetKey: number }, s: { key: number }) {
    return p.resetKey !== s.key ? { failed: false, key: p.resetKey } : null
  }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(e: Error) {
    this.props.onError(e)
  }
  render() {
    return this.state.failed ? null : this.props.children
  }
}

/** Centre height and the vertical extent (metres) each framing must show above the sheet. */
const FRAMES: Record<Framing, { y: number; extent: number }> = {
  face: { y: 1.535, extent: 0.36 },
  bust: { y: 1.36, extent: 0.82 },
  full: { y: 0.86, extent: 1.92 },
}
const ANGLES: Record<Angle, number> = { front: 0, 'three-quarter': -0.62, side: -Math.PI / 2, back: Math.PI }

/** Smoothly frames the character above the editor sheet. */
function CameraRig({ zoom, sheet }: { zoom: React.RefObject<number>; sheet: number }) {
  const framing = useStudio((s) => s.framing)
  const camera = useThree((s) => s.camera) as PerspectiveCamera
  const size = useThree((s) => s.size)
  const target = useRef(new Vector3(0, FRAMES[framing].y, 0))
  const dist = useRef(3)

  useEffect(() => {
    // Lift the subject so it sits in the visible space above the sheet.
    const h = size.height
    camera.setViewOffset(size.width, h, 0, (h * sheet) / 2, size.width, h)
    camera.updateProjectionMatrix()
    return () => camera.clearViewOffset()
  }, [camera, size, sheet])

  useFrame((_, dt) => {
    const f = FRAMES[framing]
    const k = 1 - Math.exp(-dt * 5)
    // Fit the extent into the part of the screen the sheet leaves visible (and the width, in portrait).
    const tan = Math.tan(MathUtils.degToRad(camera.fov / 2))
    const visible = Math.max(0.3, 1 - sheet)
    const aspect = size.width / size.height
    const byHeight = f.extent / 2 / tan / visible
    const byWidth = (f.extent * 0.55) / 2 / (tan * aspect)
    const want = Math.max(byHeight, byWidth) * (zoom.current ?? 1)
    target.current.y = MathUtils.lerp(target.current.y, f.y, k)
    dist.current = MathUtils.lerp(dist.current, want, k)
    camera.position.set(0, target.current.y + dist.current * 0.04, dist.current)
    camera.lookAt(target.current)
  })
  return null
}

/** Turntable: the character turns, the studio lights stay put (like a real shoot). */
function Turntable({ children }: { children: ReactNode }) {
  const ref = useRef<Group>(null)
  const angle = useStudio((s) => s.angle)
  const spin = useStudio((s) => s.spin)
  useFrame((_, dt) => {
    if (!ref.current) return
    const want = ANGLES[angle] + spin
    ref.current.rotation.y = MathUtils.lerp(ref.current.rotation.y, want, 1 - Math.exp(-dt * 7))
  })
  return <group ref={ref}>{children}</group>
}

/** Soft graded backdrop: a large inverted sphere with a vertical gradient and a warm pool of light. */
function Backdrop({ top, bottom, glow }: { top: string; bottom: string; glow: string }) {
  const mat = useRef<ShaderMaterial>(null)
  const uniforms = useMemo(() => ({ uTop: { value: new Color(top) }, uBottom: { value: new Color(bottom) }, uGlow: { value: new Color(glow) } }), [top, bottom, glow])
  return (
    <mesh scale={30} position={[0, 1.2, 0]}>
      <sphereGeometry args={[1, 48, 24]} />
      <shaderMaterial
        ref={mat}
        side={1}
        depthWrite={false}
        uniforms={uniforms}
        vertexShader={'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }'}
        fragmentShader={
          'uniform vec3 uTop, uBottom, uGlow; varying vec3 vP; void main(){ float t = smoothstep(-0.25, 0.6, vP.y); vec3 c = mix(uBottom, uTop, t); float g = exp(-pow(length(vec2(vP.x * 1.6, vP.y - 0.05)) * 2.4, 2.0)); c += uGlow * g * 0.55; gl_FragColor = vec4(c, 1.0); }'
        }
      />
    </mesh>
  )
}

function Floor({ color }: { color: string }) {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <circleGeometry args={[1.6, 64]} />
        <meshStandardMaterial color={color} roughness={0.35} metalness={0.1} transparent opacity={0.85} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]}>
        <circleGeometry args={[0.38, 48]} />
        <meshBasicMaterial color="#000" transparent opacity={0.22} depthWrite={false} />
      </mesh>
    </group>
  )
}

function Lights() {
  return (
    <>
      <ambientLight intensity={0.15} />
      {/* key: big soft box, front left and above */}
      <directionalLight position={[-1.6, 2.6, 2.4]} intensity={1.6} color="#fff1e6" />
      {/* fill: front right, lower */}
      <directionalLight position={[1.8, 1.4, 2.2]} intensity={0.55} color="#ffe9e0" />
      {/* rims: separate the silhouette from the backdrop */}
      <directionalLight position={[1.5, 2.2, -2.2]} intensity={1.1} color="#ffd6c2" />
      <directionalLight position={[-1.5, 2.0, -2.0]} intensity={0.7} color="#cfd8ff" />
      <Environment resolution={256} frames={1}>
        <Lightformer form="rect" intensity={3} position={[-2.2, 2.4, 2.6]} scale={[2.4, 3.2, 1]} color="#fff4ea" />
        <Lightformer form="rect" intensity={1.4} position={[2.4, 1.6, 2.2]} scale={[2, 2.6, 1]} color="#ffeae2" />
        <Lightformer form="ring" intensity={2} position={[0, 1.6, 3]} scale={0.7} color="#ffffff" />
        <Lightformer form="rect" intensity={1.2} position={[0, 4, -1]} scale={[4, 1, 1]} color="#ffe2d0" />
        <Lightformer form="rect" intensity={0.6} position={[0, 0.4, -3]} scale={[6, 2, 1]} color="#b9a3c9" />
      </Environment>
    </>
  )
}

export interface StageTheme {
  top: string
  bottom: string
  glow: string
  floor: string
}

export function StudioStage({ catalog, theme, sheet, reducedMotion, attempt, onError, children }: { catalog: CharacterCatalog; theme: StageTheme; sheet: number; reducedMotion: boolean; attempt: number; onError: (e: Error) => void; children?: ReactNode }) {
  const look = useShownLook()
  const paused = useStudio((s) => s.paused)
  const zoom = useRef(1)
  const drag = useRef<{ x: number; spin: number; pinch: number | null; zoom: number } | null>(null)
  const pointers = useRef(new Map<number, { x: number; y: number }>())

  const pinchDist = () => {
    const [a, b] = [...pointers.current.values()]
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : null
  }

  return (
    <div
      className="absolute inset-0 touch-none select-none"
      aria-label="3D character preview. Drag to turn, pinch to zoom."
      role="img"
      onPointerDown={(e) => {
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
        ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
        drag.current = { x: e.clientX, spin: useStudio.getState().spin, pinch: pinchDist(), zoom: zoom.current }
      }}
      onPointerMove={(e) => {
        if (!drag.current || !pointers.current.has(e.pointerId)) return
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
        const pd = pinchDist()
        if (pd && drag.current.pinch) {
          zoom.current = MathUtils.clamp(drag.current.zoom * (drag.current.pinch / pd), 0.6, 1.5)
        } else if (pointers.current.size === 1) {
          useStudio.getState().setSpin(drag.current.spin + (e.clientX - drag.current.x) * 0.012)
        }
      }}
      onPointerUp={(e) => {
        pointers.current.delete(e.pointerId)
        drag.current = pointers.current.size ? { ...drag.current!, pinch: pinchDist(), zoom: zoom.current } : null
      }}
      onPointerCancel={(e) => {
        pointers.current.delete(e.pointerId)
        drag.current = null
      }}
      onWheel={(e) => {
        zoom.current = MathUtils.clamp(zoom.current * (1 + e.deltaY * 0.001), 0.6, 1.5)
      }}
    >
      <Canvas
        frameloop={paused ? 'never' : 'always'}
        dpr={[1, 2]}
        gl={{ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: false }}
        camera={{ fov: 30, near: 0.05, far: 80, position: [0, 1.5, 1] }}
      >
        <color attach="background" args={[theme.bottom]} />
        <Backdrop top={theme.top} bottom={theme.bottom} glow={theme.glow} />
        <Lights />
        <CameraRig zoom={zoom} sheet={sheet} />
        <Floor color={theme.floor} />
        <CharacterBoundary onError={onError} resetKey={attempt}>
          <Suspense fallback={null}>
            <Turntable>
              <StudioCharacter look={look} catalog={catalog} animate={!reducedMotion} />
            </Turntable>
          </Suspense>
        </CharacterBoundary>
      </Canvas>
      {children}
    </div>
  )
}
