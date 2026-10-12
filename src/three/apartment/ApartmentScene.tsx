import { OrbitControls } from '@react-three/drei'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { CanvasTexture, SRGBColorSpace, Vector3, type Group } from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { collides, GRID, inBounds, tierSize, WALL_HEIGHT } from '../../shared/apartment'
import { getItem } from '../../shared/catalog'
import type { ApartmentDoc, Appearance, FurnitureTemplate, PlacedItem, WindowView } from '../../shared/types'
import { Doll } from '../doll/Doll'
import { floorTexture, wallpaperTexture } from '../textures'
import { FurnitureModel } from './Furniture'
import { MoveIn } from './MoveIn'

export type RoomMode = 'walk' | 'build' | 'view'

export interface ApartmentSceneProps {
  apartment: ApartmentDoc
  items: PlacedItem[]
  appearance: Appearance | null
  mode: RoomMode
  selectedId: string | null
  onSelect: (id: string | null) => void
  onMove: (id: string, next: PlacedItem) => void
  /** Item being placed from the tray. */
  placing: string | null
  onPlace: (next: PlacedItem) => void
  onInteract?: (template: FurnitureTemplate) => void
  reducedMotion: boolean
  /** Move-in day: luggage still packed, and whether the truck should drive in. */
  luggage?: string[]
  truck?: boolean
  onUnpack?: (id: string) => void
  onTruckDone?: () => void
}

export interface ApartmentHandle {
  capture: () => string | null
}

const snap = (v: number) => Math.round(v / GRID) * GRID

function windowCanvas(view: WindowView): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 256
  const g = c.getContext('2d')!
  const sky = g.createLinearGradient(0, 0, 0, 256)
  const night = view === 'stars'
  sky.addColorStop(0, night ? '#0B0420' : view === 'beach' ? '#7EC8FF' : '#FFB38A')
  sky.addColorStop(1, night ? '#3B1A5E' : view === 'beach' ? '#E9F7FF' : '#FFE3EF')
  g.fillStyle = sky
  g.fillRect(0, 0, 256, 256)
  if (night) {
    g.fillStyle = '#fff'
    for (let i = 0; i < 80; i++) g.fillRect(Math.random() * 256, Math.random() * 180, 1.5, 1.5)
    g.beginPath()
    g.arc(190, 60, 18, 0, 7)
    g.fill()
  }
  if (view === 'beach') {
    g.fillStyle = '#2E9BD6'
    g.fillRect(0, 150, 256, 50)
    g.fillStyle = '#F5D9A8'
    g.fillRect(0, 200, 256, 56)
  }
  if (view === 'garden') {
    g.fillStyle = '#3CB371'
    for (let i = 0; i < 12; i++) {
      g.beginPath()
      g.arc(i * 24, 200, 40, 0, 7)
      g.fill()
    }
  }
  if (view === 'lagos' || view === 'city') {
    g.fillStyle = view === 'lagos' ? '#5B2A86' : '#2B2B44'
    let x = 0
    let i = 0
    while (x < 256) {
      const w = 18 + ((i * 37) % 22)
      const h = 60 + ((i * 53) % 110)
      g.fillRect(x, 256 - h, w, h)
      g.fillStyle = '#FFE08A'
      for (let wy = 256 - h + 8; wy < 250; wy += 12) for (let wx = x + 4; wx < x + w - 4; wx += 7) if ((wx + wy + i) % 3) g.fillRect(wx, wy, 3, 4)
      g.fillStyle = view === 'lagos' ? '#5B2A86' : '#2B2B44'
      x += w + 2
      i++
    }
    if (view === 'lagos') {
      g.strokeStyle = '#FFFFFF'
      g.lineWidth = 2
      g.beginPath()
      g.moveTo(0, 230)
      g.quadraticCurveTo(128, 200, 256, 230)
      g.stroke()
    }
  }
  return c
}

function Room({ apartment, onFloor }: { apartment: ApartmentDoc; onFloor: (e: ThreeEvent<MouseEvent>) => void }) {
  const { w, d } = tierSize(apartment.tier)
  const floorTex = useMemo(() => {
    const t = floorTexture(apartment.floor).clone()
    t.needsUpdate = true
    t.repeat.set(w / 2, d / 2)
    return t
  }, [apartment.floor, w, d])
  const wallTex = useMemo(() => wallpaperTexture(apartment.wallpaper, apartment.wallColor), [apartment.wallpaper, apartment.wallColor])
  const viewTex = useMemo(() => {
    const t = new CanvasTexture(windowCanvas(apartment.windowView))
    t.colorSpace = SRGBColorSpace
    return t
  }, [apartment.windowView])
  const wallMat = <meshStandardMaterial color={wallTex ? '#fff' : apartment.wallColor} map={wallTex} roughness={0.9} />
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} onClick={onFloor} receiveShadow>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial map={floorTex} roughness={apartment.floor === 'marble' || apartment.floor === 'tile' ? 0.25 : 0.7} />
      </mesh>
      {/* back wall */}
      <mesh position={[0, WALL_HEIGHT / 2, -d / 2]}>
        <planeGeometry args={[w, WALL_HEIGHT]} />
        {wallMat}
      </mesh>
      {/* left wall */}
      <mesh position={[-w / 2, WALL_HEIGHT / 2, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[d, WALL_HEIGHT]} />
        {wallMat}
      </mesh>
      {/* baseboards */}
      <mesh position={[0, 0.05, -d / 2 + 0.01]}>
        <boxGeometry args={[w, 0.1, 0.02]} />
        <meshStandardMaterial color="#FFFFFF" />
      </mesh>
      <mesh position={[-w / 2 + 0.01, 0.05, 0]}>
        <boxGeometry args={[0.02, 0.1, d]} />
        <meshStandardMaterial color="#FFFFFF" />
      </mesh>
      <Window apartment={apartment} viewTex={viewTex} w={w} d={d} />
    </group>
  )
}

/** The window on the back wall: classic, tall, arched or round, left/centre/right, or glass balcony doors. */
function Window({ apartment, viewTex, w, d }: { apartment: ApartmentDoc; viewTex: CanvasTexture; w: number; d: number }) {
  const x = { left: -w * 0.25, center: 0, right: w * 0.22 }[apartment.windowSpot ?? 'right']
  const style = apartment.windowStyle ?? 'classic'
  const frame = <meshStandardMaterial color="#FFFFFF" roughness={0.4} />
  const view = <meshBasicMaterial map={viewTex} toneMapped={false} />
  const bar = (px: number, py: number, bw: number, bh: number, k: number) => (
    <mesh key={k} position={[px, py, 0.01]}>
      <boxGeometry args={[bw, bh, 0.04]} />
      {frame}
    </mesh>
  )
  if (apartment.balcony) {
    return (
      <group position={[x, 1.12, -d / 2 + 0.012]}>
        <mesh>
          <planeGeometry args={[1.7, 2.2]} />
          {view}
        </mesh>
        {/* the balcony beyond the doors: railing and potted plants */}
        <group position={[0, -0.75, 0.004]}>
          <mesh position={[0, 0.32, 0]}>
            <boxGeometry args={[1.66, 0.03, 0.01]} />
            <meshStandardMaterial color="#2A2730" metalness={0.7} roughness={0.3} />
          </mesh>
          {Array.from({ length: 12 }, (_, i) => (
            <mesh key={i} position={[-0.78 + i * 0.142, 0.15, 0]}>
              <boxGeometry args={[0.012, 0.34, 0.01]} />
              <meshStandardMaterial color="#2A2730" metalness={0.7} roughness={0.3} />
            </mesh>
          ))}
          {[-0.6, 0.55].map((px) => (
            <mesh key={px} position={[px, 0.12, 0.002]}>
              <circleGeometry args={[0.16, 16]} />
              <meshBasicMaterial color="#3E7D4A" />
            </mesh>
          ))}
        </group>
        {bar(0, 1.11, 1.8, 0.06, 0)}
        {bar(-0.87, 0, 0.06, 2.2, 1)}
        {bar(0.87, 0, 0.06, 2.2, 2)}
        {bar(0, 0, 0.04, 2.2, 3)}
        <mesh position={[-0.08, 0, 0.03]}>
          <boxGeometry args={[0.03, 0.18, 0.03]} />
          <meshStandardMaterial color="#D4AF37" metalness={0.9} roughness={0.2} />
        </mesh>
      </group>
    )
  }
  if (style === 'round')
    return (
      <group position={[x, 1.6, -d / 2 + 0.012]}>
        <mesh>
          <circleGeometry args={[0.58, 40]} />
          {view}
        </mesh>
        <mesh position={[0, 0, 0.01]}>
          <torusGeometry args={[0.6, 0.04, 10, 48]} />
          {frame}
        </mesh>
        {bar(0, 0, 1.16, 0.03, 0)}
        {bar(0, 0, 0.03, 1.16, 1)}
      </group>
    )
  if (style === 'arched')
    return (
      <group position={[x, 1.35, -d / 2 + 0.012]}>
        <mesh>
          <planeGeometry args={[1.2, 1.1]} />
          {view}
        </mesh>
        <mesh position={[0, 0.55, 0]}>
          <circleGeometry args={[0.6, 32, 0, Math.PI]} />
          {view}
        </mesh>
        <mesh position={[0, 0.55, 0.01]}>
          <torusGeometry args={[0.62, 0.035, 8, 32, Math.PI]} />
          {frame}
        </mesh>
        {bar(0, -0.57, 1.3, 0.06, 0)}
        {bar(-0.62, 0, 0.06, 1.1, 1)}
        {bar(0.62, 0, 0.06, 1.1, 2)}
        {bar(0, 0.2, 0.03, 1.8, 3)}
      </group>
    )
  const tall = style === 'tall'
  const ww = tall ? 1.0 : 1.3
  const wh = tall ? 2.0 : 1.1
  return (
    <group position={[x, tall ? 1.3 : 1.55, -d / 2 + 0.012]}>
      <mesh>
        <planeGeometry args={[ww, wh]} />
        {view}
      </mesh>
      {bar(0, wh / 2 + 0.02, ww + 0.1, 0.06, 0)}
      {bar(0, -wh / 2 - 0.02, ww + 0.1, 0.06, 1)}
      {bar(ww / 2 + 0.02, 0, 0.06, wh + 0.1, 2)}
      {bar(-ww / 2 - 0.02, 0, 0.06, wh + 0.1, 3)}
      {bar(0, 0, 0.04, wh, 4)}
      {tall && bar(0, 0, ww, 0.03, 5)}
    </group>
  )
}

/** Fills the space around the room so the crib takes the whole screen: no empty margins. */
const SURROUND: Record<ApartmentDoc['lighting'], [string, string]> = {
  day: ['#F6EEE6', '#E6DACD'],
  golden: ['#F4D9BC', '#DDBB98'],
  night: ['#1A1430', '#2A2238'],
  club: ['#140A1F', '#21122E'],
}
function Surround({ apartment }: { apartment: ApartmentDoc }) {
  const [sky, ground] = SURROUND[apartment.lighting] ?? SURROUND.day
  return (
    <>
      <color attach="background" args={[sky]} />
      <fog attach="fog" args={[sky, 14, 34]} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[80, 80]} />
        <meshStandardMaterial color={ground} roughness={1} />
      </mesh>
    </>
  )
}

function Mood({ apartment }: { apartment: ApartmentDoc }) {
  switch (apartment.lighting) {
    case 'golden':
      return (
        <>
          <hemisphereLight args={['#FFD6A8', '#8C5A3C', 0.9]} />
          <directionalLight position={[2, 3, 4]} intensity={1.8} color="#FFB060" />
        </>
      )
    case 'night':
      return (
        <>
          <hemisphereLight args={['#4A3A7A', '#1E0B26', 0.45]} />
          <directionalLight position={[2, 4, 3]} intensity={0.35} color="#9AA8FF" />
        </>
      )
    case 'club':
      return (
        <>
          <ambientLight intensity={0.25} color="#5B2A86" />
          <pointLight position={[-1, 2.4, 0]} intensity={6} distance={7} color="#FF3D8B" />
          <pointLight position={[1.5, 2.2, 1]} intensity={5} distance={7} color="#3DE0FF" />
        </>
      )
    default:
      return (
        <>
          <hemisphereLight args={['#FFFFFF', '#E9D8E8', 1.2]} />
          <directionalLight position={[2, 5, 4]} intensity={1.6} />
        </>
      )
  }
}

interface DragState {
  id: string
  start: PlacedItem
}

function Placed({
  p,
  selected,
  invalid,
  mode,
  onDown,
  onClick,
}: {
  p: PlacedItem
  selected: boolean
  invalid: boolean
  mode: RoomMode
  onDown: (e: ThreeEvent<PointerEvent>) => void
  onClick: (e: ThreeEvent<MouseEvent>) => void
}) {
  const item = getItem(p.itemId)
  if (!item?.furniture) return null
  const spec = item.furniture
  return (
    <group position={[p.x, spec.mount === 'wall' ? (p.y ?? 1.4) - 0 : 0, p.z]} rotation={[0, p.rot, 0]} onPointerDown={onDown} onClick={onClick}>
      <FurnitureModel item={item} />
      {mode === 'build' && (selected || invalid) && (
        <mesh position={[0, spec.mount === 'wall' ? 0 : 0.012, spec.mount === 'wall' ? spec.d + 0.01 : 0]} rotation={spec.mount === 'wall' ? [0, 0, 0] : [-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[spec.w + 0.1, (spec.mount === 'wall' ? spec.h : spec.d) + 0.1]} />
          <meshBasicMaterial color={invalid ? '#FF2D55' : '#FF3D8B'} transparent opacity={0.28} depthWrite={false} />
        </mesh>
      )}
    </group>
  )
}

function WalkingDoll({ appearance, target, reducedMotion, follow }: { appearance: Appearance; target: Vector3; reducedMotion: boolean; follow: boolean }) {
  const ref = useRef<Group>(null)
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null
  useFrame((_, dt) => {
    const g = ref.current
    if (!g) return
    const pos = g.position
    const to = target.clone().sub(pos)
    to.y = 0
    const dist = to.length()
    if (dist > 0.02) {
      const step = Math.min(dist, dt * 1.4)
      pos.add(to.normalize().multiplyScalar(reducedMotion ? dist : step))
      const yaw = Math.atan2(to.x, to.z)
      g.rotation.y += (((((yaw - g.rotation.y + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) - Math.PI) * Math.min(1, dt * 10)
      g.children[0].position.y = reducedMotion ? 0 : Math.abs(Math.sin(performance.now() / 120)) * 0.03
    } else if (g.children[0]) g.children[0].position.y = 0
    if (follow && controls) {
      controls.target.lerp(new Vector3(pos.x, 0.9, pos.z), Math.min(1, dt * 3))
      controls.update()
    }
  })
  return (
    <group ref={ref} position={[0, 0, 0.8]}>
      <group>
        <Doll appearance={appearance} animate={!reducedMotion} />
      </group>
    </group>
  )
}

function Scene(props: ApartmentSceneProps & { onReady: (cap: () => string | null) => void }) {
  const { apartment, items, appearance, mode, selectedId, onSelect, onMove, placing, onPlace, onInteract, reducedMotion } = props
  const { w, d } = tierSize(apartment.tier)
  const drag = useRef<DragState | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [ghost, setGhost] = useState<PlacedItem | null>(null)
  const [walkTarget, setWalkTarget] = useState(() => new Vector3(0, 0, 0.8))
  const { gl, scene, camera } = useThree()
  props.onReady(() => {
    try {
      gl.render(scene, camera)
      return gl.domElement.toDataURL('image/jpeg', 0.8)
    } catch {
      return null
    }
  })

  /** Pointer position on the floor or on a wall, snapped to the grid. */
  const positionFor = (itemId: string, point: Vector3, base: PlacedItem): PlacedItem => {
    const spec = getItem(itemId)!.furniture!
    if (spec.mount === 'wall') {
      // Choose the wall the pointer is nearer to.
      const distBack = Math.abs(point.z + d / 2)
      const distLeft = Math.abs(point.x + w / 2)
      const y = Math.max(spec.h / 2 + 0.3, Math.min(WALL_HEIGHT - spec.h / 2 - 0.05, snap(point.y || 1.4)))
      if (distBack <= distLeft)
        return {
          ...base,
          wall: 'back',
          x: snap(point.x),
          z: -d / 2,
          y,
          rot: 0,
        }
      return {
        ...base,
        wall: 'left',
        x: -w / 2,
        z: snap(point.z),
        y,
        rot: Math.PI / 2,
      }
    }
    return { ...base, x: snap(point.x), z: snap(point.z) }
  }

  const valid = (p: PlacedItem) => inBounds(p, apartment.tier) && !collides(items, p)

  const onFloorMove = (e: ThreeEvent<PointerEvent>) => {
    if (mode !== 'build') return
    if (drag.current) {
      const cur = items.find((i) => i.id === drag.current!.id)
      if (cur) onMove(cur.id, positionFor(cur.itemId, e.point, cur))
    } else if (placing) {
      setGhost(
        positionFor(placing, e.point, {
          id: 'ghost',
          itemId: placing,
          x: 0,
          z: 0,
          rot: 0,
        }),
      )
    }
  }

  const endDrag = () => {
    if (!drag.current) return
    const cur = items.find((i) => i.id === drag.current!.id)
    if (cur && !valid(cur)) onMove(cur.id, drag.current.start)
    drag.current = null
    setDragId(null)
  }

  const onFloorClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 6) return
    if (mode === 'build') {
      if (placing && ghost) {
        if (valid(ghost)) onPlace({ ...ghost, id: crypto.randomUUID().slice(0, 12) })
        return
      }
      onSelect(null)
      return
    }
    if (mode === 'walk') setWalkTarget(new Vector3(Math.max(-w / 2 + 0.3, Math.min(w / 2 - 0.3, e.point.x)), 0, Math.max(-d / 2 + 0.3, Math.min(d / 2 - 0.3, e.point.z))))
  }

  return (
    <>
      <Mood apartment={apartment} />
      <Surround apartment={apartment} />
      <Room apartment={apartment} onFloor={onFloorClick} />
      {/* Big invisible catcher for drag and placement over floor and walls */}
      {mode === 'build' && (
        <group>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]} onPointerMove={onFloorMove} onPointerUp={endDrag} visible={false}>
            <planeGeometry args={[w * 3, d * 3]} />
          </mesh>
          <mesh position={[0, WALL_HEIGHT / 2, -d / 2 + 0.002]} onPointerMove={onFloorMove} onPointerUp={endDrag} onClick={onFloorClick} visible={false}>
            <planeGeometry args={[w, WALL_HEIGHT]} />
          </mesh>
          <mesh position={[-w / 2 + 0.002, WALL_HEIGHT / 2, 0]} rotation={[0, Math.PI / 2, 0]} onPointerMove={onFloorMove} onPointerUp={endDrag} onClick={onFloorClick} visible={false}>
            <planeGeometry args={[d, WALL_HEIGHT]} />
          </mesh>
        </group>
      )}
      {items.map((p) => (
        <Placed
          key={p.id}
          p={p}
          mode={mode}
          selected={p.id === selectedId}
          invalid={mode === 'build' && p.id === dragId && !valid(p)}
          onDown={(e) => {
            if (mode !== 'build' || placing) return
            e.stopPropagation()
            onSelect(p.id)
            drag.current = { id: p.id, start: p }
            setDragId(p.id)
          }}
          onClick={(e) => {
            e.stopPropagation()
            if (e.delta > 6) return
            if (mode === 'walk') {
              const t = getItem(p.itemId)?.furniture?.template
              if (t) onInteract?.(t)
              setWalkTarget(new Vector3(p.x, 0, Math.min(d / 2 - 0.3, p.z + 0.9)))
            }
          }}
        />
      ))}
      {ghost && placing && mode === 'build' && <Placed p={ghost} mode={mode} selected={false} invalid={!valid(ghost)} onDown={() => undefined} onClick={onFloorClick} />}
      {!!props.luggage?.length && mode !== 'build' && (
        <MoveIn
          luggage={props.luggage}
          truck={!!props.truck}
          width={w}
          reducedMotion={reducedMotion}
          onUnpack={props.onUnpack ?? (() => undefined)}
          onTruckDone={props.onTruckDone ?? (() => undefined)}
        />
      )}
      {appearance && mode !== 'build' && <WalkingDoll appearance={appearance} target={walkTarget} reducedMotion={reducedMotion} follow={mode === 'walk'} />}
      <OrbitControls
        makeDefault
        enabled={!dragId}
        enablePan={mode === 'build'}
        target={[0, 0.8, 0]}
        minDistance={2}
        maxDistance={Math.max(w, d) * 1.25}
        minPolarAngle={0.3}
        maxPolarAngle={1.35}
        minAzimuthAngle={-0.15}
        maxAzimuthAngle={Math.PI / 2 + 0.15}
      />
    </>
  )
}

/** The crib: furnish in build mode, tap-to-walk in walk mode, read-only for visitors. */
const ApartmentScene = forwardRef<ApartmentHandle, ApartmentSceneProps>(function ApartmentScene(props, ref) {
  const cap = useRef<() => string | null>(() => null)
  useImperativeHandle(ref, () => ({ capture: () => cap.current() }), [])
  const { w, d } = tierSize(props.apartment.tier)
  return (
    <Canvas
      dpr={[1, 2]}
      // Move-in day starts wider and to the right so the truck parked beside the crib is in shot.
      camera={{
        fov: 46,
        // Close in so the room fills the screen; move-in day starts wider so the truck is in shot.
        position: props.truck ? [w * 1.05 + 1, Math.max(w, d) * 0.7, d * 0.8] : [w * 0.52, Math.max(w, d) * 0.46, d * 0.68],
        near: 0.1,
        far: 80,
      }}
      gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true }}
      style={{ touchAction: 'none' }}
      aria-label="Your apartment"
      role="img"
    >
      <Scene {...props} onReady={(c) => (cap.current = c)} />
    </Canvas>
  )
})

export default ApartmentScene
