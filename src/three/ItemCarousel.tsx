import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { RoundedBox } from '@react-three/drei'
import { useMemo, useRef, useState } from 'react'
import { CanvasTexture, ExtrudeGeometry, Shape, SRGBColorSpace, type Group } from 'three'
import type { CatalogItem } from '../shared/types'
import { ItemModel } from './ItemModel'

const WINDOW = 3

/** Spacing that keeps three pieces and both arrows inside the canvas, however narrow (or short, when vertical). */
function useLayout(vertical: boolean) {
  const vp = useThree((st) => st.viewport)
  const span = vertical ? vp.height : vp.width
  const gap = Math.min(vertical ? 1.5 : 1.55, (span - 1.1) / 2.2)
  return { gap, arrowAt: span / 2 - 0.3, scale: Math.min(1, gap / 0.9) }
}

/** A ribbon price tag, like a shop label hanging off the card. */
function priceTexture(text: string, color: string): CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 96
  const g = c.getContext('2d')!
  g.fillStyle = color
  g.beginPath()
  g.moveTo(0, 8)
  g.lineTo(230, 0)
  g.lineTo(256, 48)
  g.lineTo(230, 96)
  g.lineTo(0, 88)
  g.closePath()
  g.fill()
  g.fillStyle = '#FFFFFF'
  g.font = '900 52px "Outfit", "Arial Black", sans-serif'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText(text, 118, 50)
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  return t
}

/** A chunky 3D arrow: a rounded triangle with depth, the only way to scroll. */
function arrowGeometry() {
  const s = new Shape()
  s.moveTo(0.32, 0)
  s.lineTo(-0.18, 0.34)
  s.quadraticCurveTo(-0.26, 0.38, -0.26, 0.28)
  s.lineTo(-0.26, -0.28)
  s.quadraticCurveTo(-0.26, -0.38, -0.18, -0.34)
  s.lineTo(0.32, 0)
  return new ExtrudeGeometry(s, { depth: 0.14, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 3 })
}

function Arrow({ dir, disabled, color, onClick, vertical }: { dir: 1 | -1; disabled: boolean; color: string; onClick: () => void; vertical: boolean }) {
  const geo = useMemo(() => arrowGeometry(), [])
  const ref = useRef<Group>(null)
  const [hover, setHover] = useState(false)
  const { arrowAt } = useLayout(vertical)
  useFrame(({ clock }) => {
    if (!ref.current) return
    const pulse = disabled ? 0 : Math.sin(clock.elapsedTime * 3) * 0.04
    if (vertical) ref.current.position.y = -dir * (arrowAt + pulse)
    else ref.current.position.x = dir * (arrowAt + pulse)
    const s = hover && !disabled ? 0.78 : 0.62
    ref.current.scale.setScalar(ref.current.scale.x + (s - ref.current.scale.x) * 0.2)
  })
  return (
    <group
      ref={ref}
      rotation={vertical ? [0.25, 0, dir === 1 ? -Math.PI / 2 : Math.PI / 2] : [0, dir === 1 ? -0.25 : Math.PI + 0.25, 0]}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation()
        if (!disabled) onClick()
      }}
      onPointerOver={(e) => {
        e.stopPropagation()
        setHover(true)
        document.body.style.cursor = disabled ? '' : 'pointer'
      }}
      onPointerOut={() => {
        setHover(false)
        document.body.style.cursor = ''
      }}
    >
      <mesh geometry={geo} position={[0, 0, -0.07]}>
        <meshPhysicalMaterial color={disabled ? '#C7C2CB' : color} roughness={0.25} clearcoat={1} emissive={color} emissiveIntensity={hover && !disabled ? 0.35 : 0.05} />
      </mesh>
    </group>
  )
}

/** One piece on the rail: glides to its slot, the centre one grows and turns on a glowing plinth. */
function Slot({ item, offset, color, still, onClick, vertical, label }: { item: CatalogItem; offset: number; color: string; still: boolean; onClick: () => void; vertical: boolean; label: string }) {
  const ref = useRef<Group>(null)
  const spin = useRef<Group>(null)
  const { gap, scale } = useLayout(vertical)
  const tag = useMemo(() => priceTexture(label, color), [label, color])
  useFrame((_, dt) => {
    const g = ref.current
    if (!g) return
    const k = Math.min(1, dt * 9)
    if (vertical) g.position.y += (-offset * gap - g.position.y) * k
    else g.position.x += (offset * gap - g.position.x) * k
    const target = (offset === 0 ? 1.3 : 0.62) * scale
    const s = g.scale.x + (target - g.scale.x) * k
    g.scale.setScalar(s)
    g.position.z += ((offset === 0 ? (vertical ? 0.2 : 0.6) : -0.2) - g.position.z) * k
    if (spin.current) spin.current.rotation.y += offset === 0 && !still ? dt * 0.8 : ((offset === 0 ? 0 : -0.4) - spin.current.rotation.y) * k
  })
  return (
    <group
      ref={ref}
      position={vertical ? [0, -offset * 1.4, 0] : [offset * 1.4, 0, 0]}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation()
        onClick()
      }}
      onPointerOver={() => (document.body.style.cursor = 'pointer')}
      onPointerOut={() => (document.body.style.cursor = '')}
    >
      <group ref={spin}>
        <ItemModel item={item} />
      </group>
      {vertical ? (
        <>
          {/* a white card behind each piece, with a ribbon price tag */}
          <RoundedBox args={[1.5, 1.4, 0.06]} radius={0.08} position={[0, 0, -0.7]}>
            <meshStandardMaterial color="#FFFFFF" emissive={color} emissiveIntensity={offset === 0 ? 0.12 : 0} roughness={0.5} />
          </RoundedBox>
          <mesh position={[-0.55, -0.5, -0.6]}>
            <planeGeometry args={[0.8, 0.3]} />
            <meshBasicMaterial map={tag} transparent toneMapped={false} />
          </mesh>
        </>
      ) : (
        <mesh position={[0, -0.62, 0]}>
          <cylinderGeometry args={[0.5, 0.56, 0.08, 40]} />
          <meshStandardMaterial color="#FFFFFF" emissive={color} emissiveIntensity={offset === 0 ? 0.55 : 0.08} roughness={0.4} />
        </mesh>
      )}
    </group>
  )
}

/**
 * The fitting-room rail: small 3D pieces in a row, the one in the middle is on
 * you. Scroll with the 3D arrows (or the keyboard); tap a piece to jump to it.
 */
export default function ItemCarousel({ items, index, onIndex, accent, reducedMotion, vertical = false, labelOf = (i) => String(i.price) }: { items: CatalogItem[]; index: number; onIndex: (i: number) => void; accent: string; reducedMotion: boolean; vertical?: boolean; labelOf?: (i: CatalogItem) => string }) {
  // The middle piece plus one each side are on show; the next ones wait just off-stage.
  const visible = items.slice(Math.max(0, index - WINDOW + 1), index + WINDOW).map((it) => ({ it, offset: items.indexOf(it) - index }))
  return (
    <Canvas dpr={[1, 1.75]} gl={{ alpha: true }} camera={{ fov: 32, position: [0, vertical ? 0 : 0.3, 5.4] }} aria-label="Pieces on the rail. Use the arrows to scroll." role="img">
      <hemisphereLight args={['#FFFFFF', '#E9D6E2', 1.1]} />
      <directionalLight position={[3, 5, 6]} intensity={1.8} />
      <directionalLight position={[-4, 2, -2]} intensity={0.6} color={accent} />
      {visible.map(({ it, offset }) => (
        <Slot key={it.id} item={it} offset={offset} color={accent} still={reducedMotion} vertical={vertical} label={labelOf(it)} onClick={() => onIndex(items.indexOf(it))} />
      ))}
      <Arrow dir={-1} vertical={vertical} disabled={index <= 0} color={accent} onClick={() => onIndex(index - 1)} />
      <Arrow dir={1} vertical={vertical} disabled={index >= items.length - 1} color={accent} onClick={() => onIndex(index + 1)} />
    </Canvas>
  )
}
