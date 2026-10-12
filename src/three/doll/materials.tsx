import { DoubleSide, type Texture } from 'three'
import type { Metal, Undertone } from '../../shared/types'

export const UNDERTONE_SHEEN: Record<Undertone, string> = {
  warm: '#FF9A6A',
  cool: '#C98BD6',
  neutral: '#E5B9A0',
  golden: '#F5C04A',
  red: '#E0605A',
}

/** Skin with sheen and soft clearcoat: reads well in daylight, indoor and club lighting. */
export function SkinMat({ color, undertone, glow }: { color: string; undertone: Undertone; glow: number }) {
  return (
    <meshPhysicalMaterial
      color={color}
      roughness={0.58 - glow * 0.22}
      sheen={0.55}
      sheenColor={UNDERTONE_SHEEN[undertone]}
      sheenRoughness={0.45}
      clearcoat={glow * 0.35}
      clearcoatRoughness={0.55}
    />
  )
}

export function ClothMat({ color, map, double, sheen = 0.3, rough = 0.7 }: { color: string; map?: Texture | null; double?: boolean; sheen?: number; rough?: number }) {
  return (
    <meshPhysicalMaterial
      color={map ? '#ffffff' : color}
      map={map ?? null}
      roughness={rough}
      sheen={sheen}
      sheenColor="#ffffff"
      side={double ? DoubleSide : undefined}
    />
  )
}

export const METAL_COLOR: Record<Metal, string> = {
  gold: '#D9B24C',
  silver: '#D0D4DA',
  'rose-gold': '#E7B3A0',
  black: '#26232A',
  titanium: '#8E949D',
}

export function MetalMat({ metal }: { metal: Metal }) {
  return <meshStandardMaterial color={METAL_COLOR[metal]} metalness={1} roughness={0.22} />
}

export const GEM_COLOR = {
  diamond: '#EAF8FF',
  ruby: '#C3143D',
  emerald: '#0F9D58',
  sapphire: '#1E50C8',
  opal: '#EADFF7',
  pearl: '#F5F0E6',
} as const

export function GemMat({ gem }: { gem: keyof typeof GEM_COLOR }) {
  return <meshPhysicalMaterial color={GEM_COLOR[gem]} roughness={gem === 'pearl' ? 0.35 : 0.05} metalness={0} clearcoat={1} ior={2.2} />
}
