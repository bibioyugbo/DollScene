import { Environment, Html, Lightformer } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Component, Suspense, useEffect, useMemo, useRef, type ReactNode } from 'react'
import { Color, MathUtils, Vector3, type Group, type PerspectiveCamera } from 'three'
import type { CharacterCatalog } from '../character/catalog'
import { getCharacter } from '../actions/engine'
import { landmarkWorld } from '../character/rig'
import { StudioCharacter } from '../character/StudioCharacter'
import { SCENE_BY_ID, SceneEnvironment, type SceneId, type TimeOfDay, type Weather } from '../scenes'
import { useShownLook, useStudio, type Angle, type Framing } from '../state/store'
import { setCapture } from './capture'
import { Hub, useHub } from './Hub'
import { Bubble, Players } from './Players'
import { PreloadModules } from '../preload'
import { useRealtime, type Peer } from '../net/realtime'
import type { DoorId } from '../rooms'

/** Catches a failed load inside the canvas and reports it to the DOM overlay. */
class Boundary extends Component<{ children: ReactNode; onError: (e: Error) => void; resetKey: unknown }, { failed: boolean; key: unknown }> {
  state = { failed: false, key: this.props.resetKey }
  static getDerivedStateFromProps(p: { resetKey: unknown }, s: { key: unknown }) {
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

/** Centre height and the vertical extent (metres) each framing must show. */
const FRAMES: Record<Framing, { y: number; extent: number }> = {
  face: { y: 1.5, extent: 0.36 },
  eyes: { y: 1.52, extent: 0.18 },
  lips: { y: 1.44, extent: 0.16 },
  hair: { y: 1.5, extent: 0.5 },
  bust: { y: 1.36, extent: 0.82 },
  hands: { y: 1.12, extent: 0.5 },
  full: { y: 0.86, extent: 1.92 },
}
/** Nose-bridge height of the reference doll the framings were tuned on. */
const HEAD_Y = 1.486
const headPos = new Vector3()
const ANGLES: Record<Angle, number> = { front: 0, 'three-quarter': -0.62, side: -Math.PI / 2, back: Math.PI }

/** Screen space the UI covers (px), so the subject sits in what's left. */
export interface Insets {
  left: number
  right: number
  bottom: number
  top: number
}

/** Dev only: exposes the three.js scene for automated checks (window.__dsScene). */
function DevExpose() {
  const scene = useThree((s) => s.scene)
  const gl = useThree((s) => s.gl)
  useEffect(() => {
    if (!import.meta.env.DEV) return
    ;(window as unknown as { __dsScene?: unknown; __dsGl?: unknown }).__dsScene = scene
    ;(window as unknown as { __dsGl?: unknown }).__dsGl = gl
  }, [scene, gl])
  return null
}

/** Registers a capture function that renders one clean frame and returns it as a PNG blob. */
function Capture() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  useEffect(() => {
    setCapture(
      () =>
        new Promise<Blob>((resolve, reject) => {
          try {
            gl.render(scene, camera)
            gl.domElement.toBlob((b) => (b ? resolve(b) : reject(new Error('empty capture'))), 'image/png')
          } catch (e) {
            reject(e)
          }
        }),
    )
    return () => void setCapture(null)
  }, [gl, scene, camera])
  return null
}

const spotOf = (id: SceneId, spot: string) => {
  const def = SCENE_BY_ID[id] ?? SCENE_BY_ID.prom2016
  return def.photoSpots.find((p) => p.id === spot) ?? def.photoSpots[0]
}

/** Frames the character: studio framings, or the photo-mode orbit at an event. */
function CameraRig({ zoom, insets, event, spot }: { zoom: React.RefObject<number>; insets: Insets; event: boolean; spot: { position: [number, number, number]; rotationY: number } }) {
  const framing = useStudio((s) => s.framing)
  const camera = useThree((s) => s.camera) as PerspectiveCamera
  const size = useThree((s) => s.size)
  const target = useRef(new Vector3(0, FRAMES[framing].y, 0))
  const dist = useRef(3)
  const yaw = useRef(0)

  useEffect(() => {
    // Shift the view so the subject sits centred in the area the UI leaves free.
    const { width: w, height: h } = size
    camera.setViewOffset(w, h, (insets.right - insets.left) / 2, (insets.bottom - insets.top) / 2, w, h)
    camera.updateProjectionMatrix()
    return () => camera.clearViewOffset()
  }, [camera, size, insets])

  useFrame((_, dt) => {
    const photo = useStudio.getState().photo
    const base = event ? FRAMES[framing === 'face' || framing === 'eyes' || framing === 'lips' ? 'bust' : framing] : FRAMES[framing]
    // Frame the doll she actually is: taller or shorter dolls move the head, so close framings
    // follow the head bone and wide ones scale with her height.
    // the face on the live skin (shape changes such as presentation move the face, not the bone)
    const ch = getCharacter()
    const headY = (ch && landmarkWorld(ch.landmarks, 'noseBridge', headPos)?.y) || HEAD_Y
    const close = framing === 'face' || framing === 'eyes' || framing === 'lips' || framing === 'hair'
    const ratio = headY / HEAD_Y
    const f = close && !event ? { y: base.y + (headY - HEAD_Y), extent: base.extent } : { y: base.y * ratio, extent: base.extent * ratio }
    const k = 1 - Math.exp(-dt * 5)
    const tan = Math.tan(MathUtils.degToRad(camera.fov / 2))
    const visH = Math.max(0.3, 1 - (insets.bottom + insets.top) / size.height)
    const visW = Math.max(0.3, 1 - (insets.left + insets.right) / size.width)
    const aspect = size.width / size.height
    const byHeight = f.extent / 2 / tan / visH
    const byWidth = (f.extent * 0.55) / 2 / (tan * aspect * visW)
    const z = (zoom.current ?? 1) * (event ? photo.zoom : 1)
    const want = Math.max(byHeight, byWidth) * z
    const [sx, , sz] = event ? spot.position : [0, 0, 0]
    target.current.x = MathUtils.lerp(target.current.x, sx, k)
    target.current.z = MathUtils.lerp(target.current.z, sz, k)
    target.current.y = MathUtils.lerp(target.current.y, f.y + (event ? photo.lift : 0), k)
    dist.current = MathUtils.lerp(dist.current, want, k)
    const baseYaw = event ? spot.rotationY + photo.yaw : 0
    yaw.current = MathUtils.lerp(yaw.current, baseYaw, k)
    const pitch = event ? photo.pitch : 0.04
    const d = dist.current
    camera.position.set(target.current.x + Math.sin(yaw.current) * Math.cos(pitch) * d, target.current.y + Math.sin(pitch) * d, target.current.z + Math.cos(yaw.current) * Math.cos(pitch) * d)
    camera.lookAt(target.current)
  })
  return null
}

/** Turntable: the character turns, the studio lights stay put (like a real shoot). */
function Turntable({ children, event, spot, hidden = false }: { children: ReactNode; event: boolean; spot: { position: [number, number, number]; rotationY: number }; hidden?: boolean }) {
  const ref = useRef<Group>(null)
  const angle = useStudio((s) => s.angle)
  const spin = useStudio((s) => s.spin)
  useFrame((_, dt) => {
    if (!ref.current) return
    const want = event ? spot.rotationY : ANGLES[angle] + spin
    const k = 1 - Math.exp(-dt * 7)
    ref.current.rotation.y = MathUtils.lerp(ref.current.rotation.y, want, k)
    const p = event ? spot.position : ([0, 0, 0] as const)
    ref.current.position.x = MathUtils.lerp(ref.current.position.x, p[0], event ? 1 : k)
    ref.current.position.z = MathUtils.lerp(ref.current.position.z, p[2], event ? 1 : k)
  })
  // the doll stays mounted (and loaded) while hidden in the Hub: walking back out is instant
  return (
    <group ref={ref} visible={!hidden}>
      {children}
    </group>
  )
}

/** Soft graded backdrop: a large inverted sphere with a vertical gradient and a warm pool of light. */
function Backdrop({ top, bottom, glow }: { top: string; bottom: string; glow: string }) {
  const uniforms = useMemo(() => ({ uTop: { value: new Color(top) }, uBottom: { value: new Color(bottom) }, uGlow: { value: new Color(glow) } }), [top, bottom, glow])
  return (
    <mesh scale={30} position={[0, 1.2, 0]}>
      <sphereGeometry args={[1, 48, 24]} />
      <shaderMaterial
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

function StudioLights() {
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

export interface StudioStageProps {
  catalog: CharacterCatalog
  theme: StageTheme
  insets: Insets
  reducedMotion: boolean
  attempt: number
  onError: (e: Error) => void
  onSceneError: (e: Error) => void
  onSceneReady?: () => void
  /** Hub: a door was tapped (the walk starts) / the walk through it finished. */
  onDoor?: (id: DoorId) => void
  onDoorWalked?: (id: DoorId) => void
  /** A tap on another player's doll at a scene. */
  onPeer?: (p: Peer) => void
  children?: ReactNode
}

export function StudioStage({ catalog, theme, insets, reducedMotion, attempt, onError, onSceneError, onSceneReady, onDoor, onDoorWalked, onPeer, children }: StudioStageProps) {
  const look = useShownLook()
  const paused = useStudio((s) => s.paused)
  const phase = useStudio((s) => s.phase)
  const category = useStudio((s) => s.category)
  const action = useStudio((s) => s.action)
  const clinicPreview = useStudio((s) => s.clinicPreview)
  const photoPose = useStudio((s) => s.photo.pose)
  const photoExpr = useStudio((s) => s.photo.expression)
  // the scene chooser shows the chosen environment live, like the event itself
  const event = phase === 'event' || phase === 'scenes'
  const hub = phase === 'hub'
  const me = useRealtime((s) => s.me)
  const myBubble = useRealtime((s) => (me ? s.bubbles[me] : undefined))
  const sceneId = (SCENE_BY_ID[look.scene.id as SceneId] ? look.scene.id : 'rooftop') as SceneId
  const spot = spotOf(sceneId, look.scene.spot ?? '')
  const zoom = useRef(1)
  const drag = useRef<{ x: number; y: number; spin: number; yaw: number; pitch: number; pinch: number | null; zoom: number } | null>(null)
  const pointers = useRef(new Map<number, { x: number; y: number }>())

  const pinchDist = () => {
    const [a, b] = [...pointers.current.values()]
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : null
  }
  const pose = event ? photoPose : category === 'nails' && phase === 'studio' && !action ? 'present' : null

  return (
    <div
      className="absolute inset-0 touch-none select-none"
      aria-label={hub ? 'The Hub: drag to look around, tap a door to go in.' : event ? '3D scene. Drag to move the camera, pinch or scroll to zoom.' : '3D character preview. Drag to turn, pinch or scroll to zoom.'}
      role="img"
      onPointerDown={(e) => {
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
        // (not in the Hub: the doors are clicked in the 3D canvas, which capture would starve)
        if (!hub) (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
        const s = useStudio.getState()
        drag.current = { x: e.clientX, y: e.clientY, spin: s.spin, yaw: s.photo.yaw, pitch: s.photo.pitch, pinch: pinchDist(), zoom: event ? s.photo.zoom : zoom.current }
      }}
      onPointerMove={(e) => {
        if (!drag.current || !pointers.current.has(e.pointerId)) return
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
        const pd = pinchDist()
        const s = useStudio.getState()
        if (pd && drag.current.pinch) {
          const z = MathUtils.clamp(drag.current.zoom * (drag.current.pinch / pd), 0.45, 2.2)
          if (event) s.setPhoto({ zoom: z })
          else zoom.current = MathUtils.clamp(z, 0.6, 1.5)
        } else if (pointers.current.size === 1) {
          const dx = e.clientX - drag.current.x
          const dy = e.clientY - drag.current.y
          if (hub) {
            useHub.getState().look(-(e.movementX || 0) * 0.005)
            return
          }
          if (event) s.setPhoto({ yaw: drag.current.yaw - dx * 0.008, pitch: MathUtils.clamp(drag.current.pitch + dy * 0.005, -0.35, 0.9) })
          else s.setSpin(drag.current.spin + dx * 0.012)
        }
      }}
      onPointerUp={(e) => {
        pointers.current.delete(e.pointerId)
        drag.current = pointers.current.size ? { ...drag.current!, pinch: pinchDist(), zoom: event ? useStudio.getState().photo.zoom : zoom.current } : null
      }}
      onPointerCancel={(e) => {
        pointers.current.delete(e.pointerId)
        drag.current = null
      }}
      onWheel={(e) => {
        if (event) useStudio.getState().setPhoto({ zoom: MathUtils.clamp(useStudio.getState().photo.zoom * (1 + e.deltaY * 0.001), 0.45, 2.2) })
        else zoom.current = MathUtils.clamp(zoom.current * (1 + e.deltaY * 0.001), 0.6, 1.5)
      }}
    >
      <Canvas
        frameloop={paused ? 'never' : 'always'}
        dpr={[1, 2]}
        gl={{ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: false }}
        camera={{ fov: 30, near: 0.05, far: 120, position: [0, 1.5, 1] }}
      >
        {hub ? (
          <Hub onEnter={(id) => onDoor?.(id)} onWalked={(id) => onDoorWalked?.(id)} />
        ) : event ? (
          <Boundary onError={onSceneError} resetKey={`${sceneId}:${attempt}`}>
            <SceneEnvironment
              id={sceneId}
              time={look.scene.time as TimeOfDay}
              weather={look.scene.weather as Weather}
              animate={!reducedMotion}
              spot={spot.id}
              onReady={onSceneReady}
              fallback={
                <>
                  <color attach="background" args={['#1b2850']} />
                  <StudioLights />
                </>
              }
            />
          </Boundary>
        ) : (
          <>
            <color attach="background" args={[theme.bottom]} />
            <Backdrop top={theme.top} bottom={theme.bottom} glow={theme.glow} />
            <StudioLights />
            <Floor color={theme.floor} />
          </>
        )}
        {!hub && <CameraRig zoom={zoom} insets={insets} event={event} spot={spot} />}
        {phase === 'event' && <Players catalog={catalog} at={spot} onTap={(p) => onPeer?.(p)} />}
        <Suspense fallback={null}>
          <PreloadModules catalog={catalog} />
        </Suspense>
        <Capture />
        {import.meta.env.DEV && <DevExpose />}
        <Boundary onError={onError} resetKey={attempt}>
          <Suspense fallback={null}>
            <Turntable event={event} spot={spot} hidden={hub}>
              {phase === 'event' && (
                <Html position={[0, 1.78 * look.height + 0.2, 0]} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
                  <Bubble msg={myBubble} me />
                </Html>
              )}
              <StudioCharacter
                look={look}
                catalog={catalog}
                animate={!reducedMotion}
                clinicPreview={clinicPreview}
                pose={pose}
                expression={event ? photoExpr : null}
                onReady={() => useStudio.setState({ characterReady: true })}
              />
            </Turntable>
          </Suspense>
        </Boundary>
      </Canvas>
      {children}
    </div>
  )
}
