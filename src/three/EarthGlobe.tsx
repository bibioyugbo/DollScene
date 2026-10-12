import { OrbitControls } from '@react-three/drei'
import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { CanvasTexture, SRGBColorSpace, Vector3, type Texture } from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { dollDataUrl } from '../art2d/renderDoll'
import { lookFromSummary } from '../shared/look2d'
import type { PublicDoll } from '../shared/types'
import { drawAvatarBubble, drawCandyEarth, type EarthPalette } from './globeArt'

export interface EarthGlobeProps {
  dolls: PublicDoll[]
  selectedId: string | null
  onSelect: (uid: string) => void
  onClear: () => void
  paused: boolean
  reducedMotion: boolean
  /** Screen position of the selected doll, every frame (for the thought-cloud card). */
  onAnchor?: (x: number, y: number, visible: boolean) => void
  /** Stop rendering while a panel covers the globe. */
  frozen?: boolean
  /** Sea and land colours for the current landing scene (pink by default). */
  palette?: EarthPalette
}

const DEG = Math.PI / 180

/** lat/lng → point on the unit sphere, matching three's equirectangular UVs. */
export function latLng(lat: number, lng: number, r = 1): Vector3 {
  const p = lat * DEG
  const l = lng * DEG
  return new Vector3(r * Math.cos(p) * Math.cos(l), r * Math.sin(p), -r * Math.cos(p) * Math.sin(l))
}

/** The toy earth. Flat colour (unlit), so there is no shine or highlight anywhere. */
function Earth({ palette }: { palette?: EarthPalette }) {
  const map = useMemo(() => {
    const t = new CanvasTexture(drawCandyEarth(palette))
    t.colorSpace = SRGBColorSpace
    t.anisotropy = 8
    return t
  }, [palette])
  useEffect(() => () => map.dispose(), [map])
  return (
    <mesh>
      <sphereGeometry args={[1, 96, 64]} />
      <meshBasicMaterial map={map} />
    </mesh>
  )
}

const bubbles = new Map<string, Texture>()
function bubble(d: PublicDoll): Texture {
  const ring = d.kind === 'npc' ? '#FFFFFF' : '#FF2E88'
  const key = `${d.uid}|${d.portrait ?? ''}|${d.avatar.look ? JSON.stringify(d.avatar.look) : ''}`
  let t = bubbles.get(key)
  if (!t) {
    const canvas = drawAvatarBubble(d.avatar, 128, null, ring)
    const tex = new CanvasTexture(canvas)
    tex.colorSpace = SRGBColorSpace
    t = tex
    bubbles.set(key, t)
    // Every doll draws its painted 2D face once the SVG has loaded.
    const img = new Image()
    img.onload = () => {
      const g = canvas.getContext('2d')!
      const r = 64
      g.clearRect(0, 0, 128, 128)
      g.save()
      g.beginPath()
      g.arc(r, r, r - 2, 0, Math.PI * 2)
      g.clip()
      g.drawImage(img, 0, 0, 128, 128)
      g.restore()
      g.lineWidth = 9
      g.strokeStyle = ring
      g.beginPath()
      g.arc(r, r, r - 5, 0, Math.PI * 2)
      g.stroke()
      tex.needsUpdate = true
    }
    img.src = dollDataUrl(d.avatar.look ?? lookFromSummary(d.avatar), { crop: 'head', px: 128, bg: '#FFE7D6' })
  }
  return t
}

function Dolls({ dolls, selectedId, onSelect }: Pick<EarthGlobeProps, 'dolls' | 'selectedId' | 'onSelect'>) {
  const [hover, setHover] = useState<string | null>(null)
  return (
    <group>
      {dolls.map((d) => {
        const active = d.uid === selectedId || d.uid === hover
        const s = active ? 0.11 : 0.075
        return (
          <sprite
            key={d.uid}
            // Bottom of the bubble sits exactly on the doll's spot, like a pin.
            position={latLng(d.lat, d.lng, 1.004)}
            center={[0.5, 0]}
            scale={[s, s, 1]}
            renderOrder={active ? 3 : 2}
            onClick={(e: ThreeEvent<MouseEvent>) => {
              e.stopPropagation()
              if (e.delta < 6) onSelect(d.uid)
            }}
            onPointerOver={(e) => {
              e.stopPropagation()
              setHover(d.uid)
              document.body.style.cursor = 'pointer'
            }}
            onPointerOut={() => {
              setHover(null)
              document.body.style.cursor = ''
            }}
          >
            <spriteMaterial map={bubble(d)} transparent depthWrite={false} />
          </sprite>
        )
      })}
    </group>
  )
}

const anchorTmp = new Vector3()
function Anchor({ target, onAnchor }: { target: Vector3 | null; onAnchor?: EarthGlobeProps['onAnchor'] }) {
  useFrame(({ camera, size }) => {
    if (!onAnchor || !target) return
    const facing = target.clone().normalize().dot(camera.position.clone().normalize()) > 0.15
    anchorTmp.copy(target).multiplyScalar(1.06).project(camera)
    onAnchor(((anchorTmp.x + 1) / 2) * size.width, ((1 - anchorTmp.y) / 2) * size.height, facing)
  })
  return null
}

/** Turns the camera to face a doll when it is selected from outside the globe. */
function FocusRig({ target, controls }: { target: Vector3 | null; controls: RefObject<OrbitControlsImpl | null> }) {
  const done = useRef<Vector3 | null>(null)
  useFrame(({ camera }, dt) => {
    // Glide once per new target, then hand control back to the player.
    if (!target || !controls.current || done.current === target) return
    const goal = target.clone().normalize().multiplyScalar(Math.min(camera.position.length(), 2.6))
    camera.position.lerp(goal, Math.min(1, dt * 3))
    controls.current.update()
    if (camera.position.distanceTo(goal) < 0.01) done.current = target
  })
  return null
}

/** The whole-screen landing globe. Drag to slide, scroll or pinch to zoom. */
export default function EarthGlobe(props: EarthGlobeProps) {
  const controls = useRef<OrbitControlsImpl>(null)
  const selected = props.dolls.find((d) => d.uid === props.selectedId)
  const focus = useMemo(() => (selected ? latLng(selected.lat, selected.lng) : null), [selected])
  const start = useMemo(() => latLng(18, 3.4, 3.6).toArray(), [])
  return (
    <Canvas
      flat
      frameloop={props.frozen ? 'never' : 'always'}
      dpr={[1, 1.75]}
      camera={{ fov: 40, position: start, near: 0.1, far: 200 }}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      style={{ touchAction: 'none' }}
      onPointerMissed={props.onClear}
      aria-label="3D globe of DollScene. Drag to spin, pinch to zoom, tap a doll to meet them."
      role="img"
    >
      <Earth palette={props.palette} />
      <Dolls dolls={props.dolls} selectedId={props.selectedId} onSelect={props.onSelect} />
      <OrbitControls
        ref={controls}
        enablePan={false}
        enableDamping
        dampingFactor={0.06}
        rotateSpeed={0.45}
        zoomSpeed={0.6}
        minDistance={1.55}
        maxDistance={5}
        autoRotate={!props.paused && !props.reducedMotion}
        autoRotateSpeed={0.35}
      />
      <FocusRig target={focus} controls={controls} />
      <Anchor target={focus} onAnchor={props.onAnchor} />
    </Canvas>
  )
}
