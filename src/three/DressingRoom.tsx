import { RoundedBox } from '@react-three/drei'
import { useMemo, type ReactNode } from 'react'
import { CanvasTexture, SRGBColorSpace, type Texture } from 'three'
import type { Appearance, Pattern } from '../shared/types'
import { Doll } from './doll/Doll'
import { patternTexture } from './textures'

/** Every store's fitting room, plus the Beauty Doctor's clinic. */
export type RoomKind = 'streetwear' | 'classy' | 'basics' | 'thrift' | 'edgy' | 'baddie' | 'lingerie' | 'luxury' | 'sport' | 'football' | 'clinic'

interface Look {
  wall: string
  pattern?: [Pattern, string, string]
  floor: string
  trim: string
  light: string
}

const LOOKS: Record<RoomKind, Look> = {
  streetwear: { wall: '#7A7E86', floor: '#3B3A42', trim: '#111111', light: '#E6DAFF' },
  classy: { wall: '#F3E6D3', pattern: ['floral', '#F3E6D3', '#E6D2B0'], floor: '#E9DCCB', trim: '#C9A227', light: '#FFF1DC' },
  basics: { wall: '#F7F5F2', floor: '#E8DCCB', trim: '#C49A6C', light: '#FFFFFF' },
  thrift: { wall: '#A85A3A', pattern: ['check', '#A85A3A', '#8E4A2E'], floor: '#8C6A4A', trim: '#5C4033', light: '#FFE2B8' },
  edgy: { wall: '#17151B', floor: '#1E1C22', trim: '#C62828', light: '#FFD0D0' },
  baddie: { wall: '#FFB3D1', pattern: ['sequin', '#FF8CC0', '#FFD1E6'], floor: '#FFE3EF', trim: '#D4AF37', light: '#FFE3F1' },
  lingerie: { wall: '#5A0F24', pattern: ['lace', '#5A0F24', '#7A1E3A'], floor: '#3B0A18', trim: '#D4AF37', light: '#FFC9D8' },
  luxury: { wall: '#F5F0E6', pattern: ['check', '#F5F0E6', '#E6DDCB'], floor: '#111111', trim: '#D4AF37', light: '#FFF4DD' },
  sport: { wall: '#1E1E22', pattern: ['stripe', '#1E1E22', '#26262B'], floor: '#2A2A2E', trim: '#FF5A1F', light: '#FFE6D6' },
  football: { wall: '#0B5D3B', pattern: ['stripe', '#0B5D3B', '#0E6B44'], floor: '#E8F5EE', trim: '#FFFFFF', light: '#F0FFF5' },
  clinic: { wall: '#F2F8F9', floor: '#E4EEF0', trim: '#2BA6A0', light: '#F4FFFF' },
}

function Box({ p, s, c, r, rough = 0.7, metal = 0, emissive }: { p: [number, number, number]; s: [number, number, number]; c: string; r?: [number, number, number]; rough?: number; metal?: number; emissive?: string }) {
  return (
    <mesh position={p} rotation={r}>
      <boxGeometry args={s} />
      <meshStandardMaterial color={c} roughness={rough} metalness={metal} emissive={emissive ?? '#000'} emissiveIntensity={emissive ? 1.8 : 0} toneMapped={!emissive} />
    </mesh>
  )
}
const Gold = () => <meshStandardMaterial color="#D4AF37" metalness={0.95} roughness={0.22} />

function skylineTexture(): CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 256
  const g = c.getContext('2d')!
  const sky = g.createLinearGradient(0, 0, 0, 256)
  sky.addColorStop(0, '#CFE3F2')
  sky.addColorStop(1, '#F6EEE6')
  g.fillStyle = sky
  g.fillRect(0, 0, 512, 256)
  for (let i = 0; i < 26; i++) {
    const w = 14 + ((i * 37) % 22)
    const h = 50 + ((i * 53) % 150)
    g.fillStyle = ['#7C8794', '#5E6A78', '#93A0AE'][i % 3]
    g.fillRect(i * 20, 256 - h, w, h)
  }
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  return t
}

/** A framed print, like the skyline in a showroom. */
function Frame({ p, w, h, gold }: { p: [number, number, number]; w: number; h: number; gold?: boolean }) {
  const map = useMemo(() => skylineTexture(), [])
  return (
    <group position={p}>
      <Box p={[0, 0, 0]} s={[w + 0.08, h + 0.08, 0.04]} c={gold ? '#D4AF37' : '#FFFFFF'} metal={gold ? 0.9 : 0} rough={gold ? 0.25 : 0.5} />
      <mesh position={[0, 0, 0.022]}>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial map={map} roughness={0.6} />
      </mesh>
    </group>
  )
}

/** The tall dressing mirror: you see your doll's back in it. */
function Mirror({ appearance, trim, wall, animate }: { appearance: Appearance; trim: string; wall: string; animate: boolean }) {
  return (
    <group position={[0.95, 0, -0.55]} rotation={[0, -0.42, 0]}>
      {/* the alcove behind the glass holds the reflection */}
      <Box p={[0, 1.08, -0.46]} s={[0.96, 2.16, 0.02]} c={wall} rough={0.9} />
      <Box p={[-0.47, 1.08, -0.23]} s={[0.02, 2.16, 0.46]} c={wall} rough={0.9} />
      <Box p={[0.47, 1.08, -0.23]} s={[0.02, 2.16, 0.46]} c={wall} rough={0.9} />
      <Box p={[0, 0.005, -0.23]} s={[0.96, 0.01, 0.46]} c="#E9E2DC" />
      <group position={[0, 0.02, -0.3]} rotation={[0, Math.PI, 0]} scale={[-0.82, 0.82, 0.82]}>
        <Doll appearance={appearance} animate={animate} shadow={false} />
      </group>
      {/* glass + frame */}
      <mesh position={[0, 1.08, 0]}>
        <planeGeometry args={[0.94, 2.14]} />
        <meshPhysicalMaterial color="#EAF4FF" transparent opacity={0.16} roughness={0.02} metalness={0.4} clearcoat={1} />
      </mesh>
      <mesh position={[-0.2, 1.5, 0.002]} rotation={[0, 0, -0.5]}>
        <planeGeometry args={[0.06, 1.2]} />
        <meshBasicMaterial color="#FFFFFF" transparent opacity={0.18} />
      </mesh>
      <RoundedBox args={[1.08, 2.28, 0.06]} radius={0.04} position={[0, 1.08, -0.04]}>
        <meshStandardMaterial color={trim} roughness={0.35} metalness={trim === '#D4AF37' || trim === '#C9A227' ? 0.9 : 0.1} />
      </RoundedBox>
    </group>
  )
}

/** Store-specific furniture and props around the edges of the room. */
function Props({ kind, accent, stock }: { kind: RoomKind; accent: string; stock: string[] }) {
  const c = (i: number) => stock[i % Math.max(1, stock.length)] ?? accent
  const items: ReactNode[] = []
  switch (kind) {
    case 'streetwear':
      items.push(
        ...['#C8FF3D', accent, '#FF5C2B', '#2FBF71'].map((col, i) => <Box key={`g${i}`} p={[-2.1 + i * 0.12, 2.2 + i * 0.2, -1.58]} s={[0.07, 1.4, 0.01]} c={col} r={[0, 0, 0.5]} emissive={col} />),
        ...Array.from({ length: 12 }, (_, i) => <Box key={`s${i}`} p={[-1.85 + (i % 4) * 0.34, 0.6 + Math.floor(i / 4) * 0.38, -1.48]} s={[0.26, 0.11, 0.14]} c={c(i)} rough={0.5} />),
        ...[0.45, 0.83, 1.21].map((y) => <Box key={`sh${y}`} p={[-1.34, y, -1.5]} s={[1.5, 0.03, 0.22]} c="#111111" />),
        <Box key="neon" p={[0, 2.95, -1.57]} s={[1.6, 0.06, 0.02]} c={accent} emissive={accent} />,
      )
      break
    case 'classy':
      items.push(
        <Frame key="art" p={[-1.2, 1.9, -1.57]} w={1.5} h={0.75} gold />,
        <Box key="desk" p={[-1.2, 0.75, -1.35]} s={[1.3, 0.05, 0.45]} c="#F5ECE0" />,
        <Box key="dl" p={[-1.8, 0.37, -1.35]} s={[0.05, 0.74, 0.42]} c="#F5ECE0" />,
        <Box key="dr" p={[-0.6, 0.37, -1.35]} s={[0.05, 0.74, 0.42]} c="#F5ECE0" />,
        <group key="vase" position={[-0.8, 0.78, -1.35]}>
          <mesh position={[0, 0.12, 0]}>
            <cylinderGeometry args={[0.06, 0.08, 0.24, 16]} />
            <meshPhysicalMaterial color="#FFFFFF" roughness={0.1} clearcoat={1} />
          </mesh>
          {[0, 1, 2, 3, 4].map((i) => (
            <mesh key={i} position={[Math.cos(i * 1.3) * 0.06, 0.32 + (i % 2) * 0.04, Math.sin(i * 1.3) * 0.06]}>
              <sphereGeometry args={[0.045, 10, 8]} />
              <meshStandardMaterial color={i % 2 ? '#FFB3D1' : '#FFFFFF'} roughness={0.6} />
            </mesh>
          ))}
        </group>,
        <group key="chand" position={[0, 3.1, -0.5]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.32, 0.015, 8, 32]} />
            <Gold />
          </mesh>
          {Array.from({ length: 8 }, (_, i) => (
            <mesh key={i} position={[Math.cos((i / 8) * 6.28) * 0.32, -0.08, Math.sin((i / 8) * 6.28) * 0.32]}>
              <sphereGeometry args={[0.03, 10, 10]} />
              <meshStandardMaterial color="#FFF4DD" emissive="#FFE7B0" emissiveIntensity={2} toneMapped={false} />
            </mesh>
          ))}
        </group>,
      )
      break
    case 'basics':
      items.push(
        <Frame key="art" p={[-1.3, 2.0, -1.57]} w={1.2} h={0.6} />,
        ...[0.7, 1.1].map((y) => <Box key={`sh${y}`} p={[-1.3, y, -1.45]} s={[1.6, 0.04, 0.3]} c="#C49A6C" />),
        ...Array.from({ length: 10 }, (_, i) => <Box key={`t${i}`} p={[-1.95 + (i % 5) * 0.32, (i < 5 ? 0.76 : 1.16) + 0.04, -1.45]} s={[0.26, 0.08, 0.22]} c={c(i)} />),
        <group key="plant" position={[1.9, 0, -1.2]}>
          <mesh position={[0, 0.18, 0]}>
            <cylinderGeometry args={[0.16, 0.13, 0.36, 16]} />
            <meshStandardMaterial color="#F4F0EA" />
          </mesh>
          <mesh position={[0, 0.75, 0]} scale={[1, 1.3, 1]}>
            <sphereGeometry args={[0.32, 14, 12]} />
            <meshStandardMaterial color="#4F8A3C" roughness={0.8} />
          </mesh>
        </group>,
      )
      break
    case 'thrift':
      items.push(
        ...Array.from({ length: 14 }, (_, i) => (
          <mesh key={`b${i}`} position={[-2.2 + i * 0.34, 2.7 - Math.sin((i / 13) * Math.PI) * 0.25, -1.5]}>
            <sphereGeometry args={[0.04, 8, 8]} />
            <meshStandardMaterial color={['#FFD95A', '#FF7AB6', '#7CF0CF'][i % 3]} emissive={['#FFD95A', '#FF7AB6', '#7CF0CF'][i % 3]} emissiveIntensity={2} toneMapped={false} />
          </mesh>
        )),
        ...[[-1.9, 0.22], [-1.45, 0.22], [-1.68, 0.64]].map(([x, y], i) => <Box key={`cr${i}`} p={[x, y, -1.3]} s={[0.42, 0.42, 0.42]} c="#C49A6C" />),
        <Box key="rail" p={[-0.9, 1.65, -1.35]} s={[1.3, 0.03, 0.03]} c="#C7CAD1" metal={0.9} />,
        ...Array.from({ length: 7 }, (_, i) => <Box key={`h${i}`} p={[-1.45 + i * 0.18, 1.3, -1.35]} s={[0.06, 0.66, 0.4]} c={c(i + 2)} />),
      )
      break
    case 'edgy':
      items.push(
        ...[[0, 3.0, 4.2, 0.05], [-2.1, 1.6, 0.05, 2.8], [2.1, 1.6, 0.05, 2.8]].map(([x, y, w, h], i) => <Box key={`n${i}`} p={[x, y, -1.57]} s={[w, h, 0.02]} c="#FF1F3D" emissive="#FF1F3D" />),
        ...[-1.6, -1.2].map((x) => (
          <group key={x} position={[x, 2.6, -1.5]}>
            {Array.from({ length: 8 }, (_, i) => (
              <mesh key={i} position={[0, -i * 0.13, 0]} rotation={[0, i % 2 ? Math.PI / 2 : 0, 0]}>
                <torusGeometry args={[0.05, 0.014, 6, 12]} />
                <meshStandardMaterial color="#C7CAD1" metalness={0.95} roughness={0.2} />
              </mesh>
            ))}
          </group>
        )),
        <Box key="poster" p={[-1.4, 1.5, -1.57]} s={[0.6, 0.85, 0.01]} c="#111111" />,
      )
      break
    case 'baddie':
    case 'lingerie': {
      const heart = <HeartNeon key="heart" color={kind === 'lingerie' ? '#FF5C8A' : '#FF2E88'} />
      items.push(
        heart,
        <mesh key="rug" rotation={[-Math.PI / 2, 0, 0]} position={[-0.4, 0.005, 0.1]}>
          <circleGeometry args={[0.9, 40]} />
          <meshStandardMaterial color={kind === 'lingerie' ? '#8E1033' : '#FFFFFF'} roughness={1} />
        </mesh>,
        <mesh key="pouf" position={[-1.6, 0.25, -0.8]} scale={[1, 0.6, 1]}>
          <sphereGeometry args={[0.36, 20, 14]} />
          <meshPhysicalMaterial color={kind === 'lingerie' ? '#FFD1E6' : '#FF8CC0'} roughness={0.3} sheen={1} />
        </mesh>,
      )
      if (kind === 'lingerie')
        items.push(
          ...[-2.2, 2.2].map((x) => (
            <group key={`cur${x}`} position={[x, 1.6, -1.45]}>
              {Array.from({ length: 5 }, (_, i) => (
                <mesh key={i} position={[(x < 0 ? 1 : -1) * i * 0.08, 0, i * 0.01]}>
                  <cylinderGeometry args={[0.08, 0.14, 3.2, 10, 1, true]} />
                  <meshStandardMaterial color="#8E1033" roughness={0.95} side={2} />
                </mesh>
              ))}
            </group>
          )),
        )
      else items.push(...[0.9, 1.4].map((y) => <Box key={`sh${y}`} p={[-1.4, y, -1.5]} s={[1.2, 0.03, 0.2]} c="#D4AF37" metal={0.9} rough={0.25} />), ...Array.from({ length: 6 }, (_, i) => <Box key={`cl${i}`} p={[-1.85 + (i % 3) * 0.42, (i < 3 ? 0.98 : 1.48), -1.5]} s={[0.28, 0.16, 0.08]} c={c(i)} rough={0.25} />))
      break
    }
    case 'luxury':
      items.push(
        ...[-1.8, -1.0].map((x, i) => (
          <group key={x} position={[x, 0, -1.2]}>
            <mesh position={[0, 0.45, 0]}>
              <cylinderGeometry args={[0.22, 0.22, 0.9, 24]} />
              <Gold />
            </mesh>
            <Box p={[0, 1.05, 0]} s={[0.34, 0.24, 0.13]} c={c(i)} rough={0.25} />
            <mesh position={[0, 1.2, 0]}>
              <torusGeometry args={[0.09, 0.012, 8, 20, Math.PI]} />
              <Gold />
            </mesh>
          </group>
        )),
        ...Array.from({ length: 12 }, (_, i) => (
          <mesh key={`p${i}`} position={[-2.25, 2.6 - i * 0.12, -1.5]}>
            <sphereGeometry args={[0.04, 12, 12]} />
            <meshPhysicalMaterial color="#FFFDF5" roughness={0.15} clearcoat={1} />
          </mesh>
        )),
      )
      break
    case 'sport':
      items.push(
        <Box key="stripe" p={[0, 2.4, -1.57]} s={[5, 0.16, 0.01]} c="#FF5A1F" emissive="#FF5A1F" r={[0, 0, 0.08]} />,
        ...[0, 1, 2].flatMap((row) => Array.from({ length: 3 - row }, (_, i) => <Box key={`k${row}${i}`} p={[-1.4 + (i - (2 - row) / 2) * 0.42, 0.12 + row * 0.3, -1.25]} s={[0.32, 0.12, 0.2]} c={c(row + i)} rough={0.5} />)),
        <Box key="rack" p={[-2.0, 0.5, -1.2]} s={[0.1, 1, 0.1]} c="#2A2730" />,
        ...[0.3, 0.6, 0.9].map((y) => (
          <mesh key={`db${y}`} position={[-2.0, y, -1.08]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.06, 0.06, 0.3, 12]} />
            <meshStandardMaterial color="#111111" metalness={0.6} />
          </mesh>
        )),
      )
      break
    case 'football':
      items.push(
        ...[0, 1, 2].map((i) => <Box key={`j${i}`} p={[-1.8 + i * 0.6, 1.8, -1.56]} s={[0.46, 0.55, 0.02]} c={i === 1 ? '#FFFFFF' : '#008751'} />),
        <mesh key="ball" position={[-1.6, 0.18, -0.8]}>
          <icosahedronGeometry args={[0.18, 1]} />
          <meshStandardMaterial color="#FFFFFF" flatShading roughness={0.5} />
        </mesh>,
      )
      break
    case 'clinic':
      items.push(
        // treatment bed
        <group key="bed" position={[-1.4, 0, -0.9]} rotation={[0, 0.4, 0]}>
          <Box p={[0, 0.45, 0]} s={[0.7, 0.12, 1.7]} c="#FFFFFF" rough={0.3} />
          <Box p={[0, 0.62, -0.62]} s={[0.66, 0.3, 0.4]} c="#FFFFFF" r={[0.5, 0, 0]} rough={0.3} />
          <Box p={[0, 0.2, 0]} s={[0.2, 0.4, 0.2]} c="#C7CAD1" metal={0.8} />
          <Box p={[0, 0.52, 0.1]} s={[0.68, 0.02, 1.2]} c="#BFE8E4" />
        </group>,
        // heart-rate monitor
        <group key="mon" position={[-2.1, 1.5, -1.5]}>
          <Box p={[0, 0, 0]} s={[0.6, 0.42, 0.06]} c="#1C1C1C" />
          <Box p={[0, 0, 0.035]} s={[0.5, 0.012, 0.01]} c="#2BFF9E" emissive="#2BFF9E" />
          <Box p={[0.08, 0.05, 0.035]} s={[0.012, 0.14, 0.01]} c="#2BFF9E" emissive="#2BFF9E" r={[0, 0, 0.3]} />
        </group>,
        // surgical lamp
        <group key="lamp" position={[-1.2, 2.7, -0.6]}>
          <mesh rotation={[Math.PI, 0, 0]}>
            <cylinderGeometry args={[0.32, 0.18, 0.12, 24]} />
            <meshStandardMaterial color="#F4F4F4" roughness={0.3} />
          </mesh>
          <mesh position={[0, -0.07, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.28, 24]} />
            <meshStandardMaterial color="#FFFFFF" emissive="#FFFFFF" emissiveIntensity={1.4} toneMapped={false} />
          </mesh>
        </group>,
        // cabinet with a teal cross
        <Box key="cab" p={[1.9, 0.55, -1.35]} s={[0.8, 1.1, 0.4]} c="#FFFFFF" rough={0.3} />,
        <Box key="cx" p={[1.9, 0.75, -1.14]} s={[0.22, 0.06, 0.01]} c="#2BA6A0" emissive="#2BA6A0" />,
        <Box key="cy" p={[1.9, 0.75, -1.14]} s={[0.06, 0.22, 0.01]} c="#2BA6A0" emissive="#2BA6A0" />,
        <Frame key="cert" p={[1.2, 2.1, -1.57]} w={0.5} h={0.36} gold />,
      )
      break
  }
  return <group>{items}</group>
}

function HeartNeon({ color }: { color: string }) {
  return (
    <group position={[-1.5, 2.2, -1.56]} scale={0.5}>
      {[-1, 1].map((k) => (
        <mesh key={k} position={[k * 0.22, 0.12, 0]}>
          <torusGeometry args={[0.24, 0.035, 8, 32]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2} toneMapped={false} />
        </mesh>
      ))}
      <mesh position={[0, -0.2, 0]} rotation={[0, 0, Math.PI / 4]}>
        <torusGeometry args={[0.3, 0.035, 8, 4, Math.PI / 2]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2} toneMapped={false} />
      </mesh>
    </group>
  )
}

/** The whole room: walls (with each store's wallpaper), floor, decor, a mirror, and lights. */
export function DressingRoomSet({ kind, accent, stock = [], appearance, mirror = true, animate = true }: { kind: RoomKind; accent: string; stock?: string[]; appearance: Appearance; mirror?: boolean; animate?: boolean }) {
  const look = LOOKS[kind]
  const wallTex: Texture | null = useMemo(() => {
    if (!look.pattern) return null
    const t = patternTexture(...look.pattern)
    if (!t) return null
    const c = t.clone()
    c.needsUpdate = true
    c.repeat.set(6, 3)
    return c
  }, [look])
  return (
    <group>
      <color attach="background" args={[look.wall]} />
      <mesh position={[0, 1.8, -1.6]}>
        <planeGeometry args={[9, 4.2]} />
        <meshStandardMaterial color={wallTex ? '#FFFFFF' : look.wall} map={wallTex} roughness={0.9} />
      </mesh>
      {[-1, 1].map((k) => (
        <mesh key={k} position={[k * 3.2, 1.8, 0.4]} rotation={[0, -k * Math.PI / 2, 0]}>
          <planeGeometry args={[4.2, 4.2]} />
          <meshStandardMaterial color={wallTex ? '#FFFFFF' : look.wall} map={wallTex} roughness={0.9} />
        </mesh>
      ))}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0.4]}>
        <planeGeometry args={[9, 5]} />
        <meshStandardMaterial color={look.floor} roughness={kind === 'luxury' || kind === 'clinic' ? 0.15 : 0.6} metalness={kind === 'luxury' ? 0.2 : 0} />
      </mesh>
      <Box p={[0, 0.05, -1.58]} s={[9, 0.1, 0.03]} c={look.trim} />
      <Props kind={kind} accent={accent} stock={stock} />
      {mirror && <Mirror appearance={appearance} trim={look.trim} wall={look.wall} animate={animate} />}
      <pointLight position={[0, 2.8, 0.8]} intensity={4} distance={7} color={look.light} />
      <pointLight position={[-2, 2.2, -0.6]} intensity={2} distance={4} color={accent} />
    </group>
  )
}
