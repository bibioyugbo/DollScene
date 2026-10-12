import { Decal } from '@react-three/drei'
import { useMemo, type ReactNode } from 'react'
import type { Appearance, Tattoo, TattooRegion } from '../../shared/types'
import { tattooTexture } from '../textures'
import type { Dims } from './dims'
import { shade } from './Head'
import { Jewellery } from './Jewellery'
import { SkinMat } from './materials'

type V3 = [number, number, number]
interface Spot {
  pos: V3
  rot: V3
  base: number
}

const HALF = Math.PI / 2

/** Where each tattoo region sits on its body part, in that part's local space. */
function regionSpot(region: TattooRegion, d: Dims): Spot | null {
  switch (region) {
    case 'neck':
      return { pos: [0.02, 0, 0.045], rot: [0, 0.4, 0], base: 0.06 }
    case 'chest':
      return { pos: [0, 0.03, 0.16], rot: [0, 0, 0], base: 0.14 }
    case 'back':
      return { pos: [0, 0.02, -0.16], rot: [0, Math.PI, 0], base: 0.18 }
    case 'stomach':
      return { pos: [0, 0, 0.14], rot: [0, 0, 0], base: 0.12 }
    case 'ribs':
      return { pos: [0.14, 0.03, 0], rot: [0, HALF, 0], base: 0.12 }
    case 'hip-l':
    case 'hip-r':
      return { pos: [region === 'hip-l' ? 0.15 : -0.15, 0, 0.03], rot: [0, region === 'hip-l' ? HALF : -HALF, 0], base: 0.1 }
    case 'shoulder-l':
    case 'shoulder-r':
      return { pos: [0, 0.12, 0], rot: [-HALF, 0, 0], base: 0.08 }
    case 'arm-l':
    case 'arm-r':
      return { pos: [0, 0, d.armR], rot: [0, 0, 0], base: 0.07 }
    case 'forearm-l':
    case 'forearm-r':
      return { pos: [0, 0, d.armR * 0.92], rot: [0, 0, 0], base: 0.07 }
    case 'hand-l':
    case 'hand-r':
      return { pos: [0, 0, 0.042], rot: [0, 0, 0], base: 0.045 }
    case 'fingers':
      return { pos: [0, -0.03, 0.03], rot: [0.6, 0, 0], base: 0.03 }
    case 'thigh-l':
    case 'thigh-r':
      return { pos: [0, d.legLen * 0.25, d.legR], rot: [0, 0, 0], base: 0.1 }
    case 'calf-l':
    case 'calf-r':
      return { pos: [0, -d.legLen * 0.15, -d.legR], rot: [0, Math.PI, 0], base: 0.08 }
    case 'ankle-l':
    case 'ankle-r':
      return { pos: [region === 'ankle-l' ? d.legR : -d.legR, -d.legLen * 0.42, 0], rot: [0, region === 'ankle-l' ? HALF : -HALF, 0], base: 0.045 }
    case 'foot-l':
    case 'foot-r':
      return { pos: [0, 0.02, 0.02], rot: [-HALF, 0, 0], base: 0.06 }
    default:
      return null
  }
}

const MIRROR: Partial<Record<TattooRegion, TattooRegion>> = {
  'shoulder-l': 'shoulder-r',
  'shoulder-r': 'shoulder-l',
  'arm-l': 'arm-r',
  'arm-r': 'arm-l',
  'forearm-l': 'forearm-r',
  'forearm-r': 'forearm-l',
  'hand-l': 'hand-r',
  'hand-r': 'hand-l',
  'hip-l': 'hip-r',
  'hip-r': 'hip-l',
  'thigh-l': 'thigh-r',
  'thigh-r': 'thigh-l',
  'calf-l': 'calf-r',
  'calf-r': 'calf-l',
  'ankle-l': 'ankle-r',
  'ankle-r': 'ankle-l',
  'foot-l': 'foot-r',
  'foot-r': 'foot-l',
}

/** Expand mirrored tattoos onto their opposite region. */
export function expandTattoos(tattoos: Tattoo[]): Tattoo[] {
  const out: Tattoo[] = []
  for (const t of tattoos) {
    out.push(t)
    const m = MIRROR[t.region]
    if (t.mirror && m) out.push({ ...t, id: `${t.id}-m`, region: m, rotation: -t.rotation })
  }
  return out
}

/** One projected tattoo. Props are memoised so the decal geometry is only rebuilt when the tattoo changes. */
function TattooDecal({ t, spot, flip }: { t: Tattoo; spot: Spot; flip: number }) {
  const s = spot.base * (0.45 + t.size * 1.1)
  const [px, py, pz] = spot.pos
  const [rx, ry, rz] = spot.rot
  const position = useMemo<V3>(() => [px, py, pz], [px, py, pz])
  const rotation = useMemo<V3>(() => [rx, ry, rz + (t.rotation * Math.PI) / 180], [rx, ry, rz, t.rotation])
  const scale = useMemo<V3>(() => [s * flip, s, 0.05], [s, flip])
  return (
    <Decal position={position} rotation={rotation} scale={scale}>
      <meshBasicMaterial
        map={tattooTexture(t.design, t.color)}
        transparent
        opacity={t.opacity * (t.temporary ? 0.72 : 0.92)}
        polygonOffset
        polygonOffsetFactor={-4 - t.layer}
        depthWrite={false}
      />
    </Decal>
  )
}

function Decals({ tattoos, regions, d }: { tattoos: Tattoo[]; regions: TattooRegion[]; d: Dims }) {
  return (
    <>
      {tattoos
        .filter((t) => regions.includes(t.region))
        .map((t) => {
          const spot = regionSpot(t.region, d)
          if (!spot) return null
          return <TattooDecal key={t.id} t={t} spot={spot} flip={t.mirror && !MIRROR[t.region] ? -1 : 1} />
        })}
    </>
  )
}

export interface BodyProps {
  a: Appearance
  d: Dims
  bareFeet: boolean
  /** Rendered inside each arm group (sleeves, bracelets, bags). side +1 = doll's left. */
  armExtras?: (side: 1 | -1) => ReactNode
}

/** Skin body parts with tattoo decals and body piercings. Clothes are separate shells. */
export function Body({ a, d, bareFeet, armExtras }: BodyProps) {
  const skin = <SkinMat color={a.skin.tone} undertone={a.skin.undertone} glow={a.skin.glow} />
  const tattoos = expandTattoos(a.tattoos)
  const stretch = a.skin.marks['stretch-marks']
  const vit = a.skin.marks.vitiligo

  return (
    <group>
      {/* legs */}
      {([1, -1] as const).map((s) => (
        <mesh key={`leg${s}`} position={[s * d.legX, d.legY, 0]}>
          <capsuleGeometry args={[d.legR, d.legLen, 6, 16]} />
          {skin}
          <Decals tattoos={tattoos} regions={s === 1 ? ['thigh-l', 'calf-l', 'ankle-l'] : ['thigh-r', 'calf-r', 'ankle-r']} d={d} />
        </mesh>
      ))}
      {bareFeet &&
        ([1, -1] as const).map((s) => (
          <mesh key={`foot${s}`} position={[s * d.legX, 0.03, 0.035]} scale={[0.85, 0.45, 1.6]}>
            <sphereGeometry args={[0.055, 16, 12]} />
            {skin}
            <Decals tattoos={tattoos} regions={s === 1 ? ['foot-l'] : ['foot-r']} d={d} />
          </mesh>
        ))}
      {/* hips */}
      <mesh position={[0, d.hipY, 0]} scale={[d.hipsX, 0.7, 0.85]}>
        <sphereGeometry args={[0.16, 28, 18]} />
        {skin}
        <Decals tattoos={tattoos} regions={['hip-l', 'hip-r']} d={d} />
      </mesh>
      {stretch &&
        [1, -1].map((s) =>
          [0, 1, 2].map((k) => (
            <mesh key={`sm${s}${k}`} position={[s * 0.155 * d.hipsX, d.hipY - 0.01 + k * 0.018, 0.02 + k * 0.01]} rotation={[0, 0, s * 0.5]}>
              <capsuleGeometry args={[0.0012, 0.028 * (0.5 + stretch), 3, 5]} />
              <meshStandardMaterial color={shade(a.skin.tone, 0.18)} transparent opacity={0.7} />
            </mesh>
          )),
        )}
      {/* waist */}
      <mesh position={[0, d.waistY, 0]} scale={[d.waistX, 1, 0.8]}>
        <cylinderGeometry args={[0.135, 0.15, 0.22, 28]} />
        {skin}
        <Decals tattoos={tattoos} regions={['stomach', 'ribs']} d={d} />
      </mesh>
      {/* chest */}
      <mesh position={[0, d.chestY, 0]} scale={[d.chestX, 0.85, 0.72]}>
        <sphereGeometry args={[0.165, 28, 18]} />
        {skin}
        <Decals tattoos={tattoos} regions={['chest', 'back']} d={d} />
      </mesh>
      {d.bust > 0.01 &&
        [-1, 1].map((s) => (
          <mesh key={`bust${s}`} position={[s * 0.058, d.chestY - 0.03, 0.075]}>
            <sphereGeometry args={[d.bust, 18, 14]} />
            {skin}
          </mesh>
        ))}
      {/* neck */}
      <mesh position={[0, d.neckY, 0]}>
        <cylinderGeometry args={[0.045, 0.05, 0.1, 16]} />
        {skin}
        <Decals tattoos={tattoos} regions={['neck']} d={d} />
      </mesh>
      {/* arms */}
      {([1, -1] as const).map((s) => (
        <group key={`arm${s}`} position={[s * d.shoulderX, d.shoulderY, 0]} rotation={[0, 0, s * 0.14]}>
          <mesh position={[0, -0.1, 0]}>
            <capsuleGeometry args={[d.armR, 0.17, 6, 12]} />
            {skin}
            <Decals tattoos={tattoos} regions={s === 1 ? ['shoulder-l', 'arm-l'] : ['shoulder-r', 'arm-r']} d={d} />
          </mesh>
          <mesh position={[0, -0.3, 0]}>
            <capsuleGeometry args={[d.armR * 0.92, 0.17, 6, 12]} />
            {skin}
            <Decals tattoos={tattoos} regions={s === 1 ? ['forearm-l'] : ['forearm-r']} d={d} />
          </mesh>
          <mesh position={[0, -0.44, 0]} scale={[0.9, 1.1, 0.75]}>
            <sphereGeometry args={[0.045, 16, 12]} />
            {skin}
            <Decals tattoos={tattoos} regions={s === 1 ? ['hand-l', 'fingers'] : ['hand-r']} d={d} />
          </mesh>
          {vit && (
            <mesh position={[0, -0.44, 0.02]} scale={[1, 0.9, 0.35]}>
              <sphereGeometry args={[0.03 * (0.6 + vit * 0.6), 12, 10]} />
              <meshStandardMaterial color={shade(a.skin.tone, 0.55)} transparent opacity={0.9} depthWrite={false} />
            </mesh>
          )}
          {/* nails */}
          {[-0.022, -0.008, 0.008, 0.022].map((x) => (
            <mesh key={x} position={[x, -0.485 - a.nails.length * 0.012, 0.012]} rotation={[0.2, 0, 0]}>
              {a.nails.shape === 'stiletto' || a.nails.shape === 'almond' ? (
                <coneGeometry args={[0.0045, 0.01 + a.nails.length * 0.02, 8]} />
              ) : (
                <boxGeometry args={[0.008, 0.008 + a.nails.length * 0.02, 0.003]} />
              )}
              <meshPhysicalMaterial
                color={a.nails.color}
                metalness={a.nails.pattern === 'chrome' ? 1 : 0}
                roughness={a.nails.pattern === 'chrome' ? 0.1 : 0.25}
                clearcoat={1}
                emissive={a.nails.pattern === 'glitter' ? a.nails.color : '#000'}
                emissiveIntensity={a.nails.pattern === 'glitter' ? 0.25 : 0}
              />
            </mesh>
          ))}
          {armExtras?.(s)}
        </group>
      ))}

      {/* body piercings */}
      {a.piercings
        .filter((p) => p.site === 'navel' || p.site === 'dermal' || p.site === 'surface')
        .map((p) => {
          const pos: V3 =
            p.site === 'navel'
              ? [0, d.waistY - 0.05, 0.145 * 0.8 + 0.004]
              : p.site === 'dermal'
                ? [p.side === 'right' ? -0.06 : 0.06, d.chestY + 0.1, 0.09]
                : [0, d.neckY, -0.05]
          return (
            <group key={p.id} position={pos} rotation={[0, p.site === 'surface' ? Math.PI : 0, 0]}>
              <Jewellery p={p} plane="face" />
            </group>
          )
        })}
    </group>
  )
}
