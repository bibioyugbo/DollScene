import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber'
import { useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'
import { CanvasTexture, Color, ExtrudeGeometry, Shape, SRGBColorSpace, type Group, type Mesh, type MeshStandardMaterial, type PointLight } from 'three'

export type WorldStoreKind = 'streetwear' | 'classy' | 'basics' | 'thrift' | 'edgy' | 'baddie' | 'lingerie' | 'luxury' | 'sport' | 'football'| "makeup" | "clinic";

export interface WorldStore {
  id: string
  name: string
  kind: WorldStoreKind
  accent: string
  /** Colours from the store's real stock, used on mannequins, rails and piles. */
  stock: string[]
}

export const SPACING = 6.4

/* ------------------------------------------------------------------ glow */

/**
 * Each store fades its lights in and out. Materials tagged `userData.glow` get
 * their emissive raised, lights tagged `userData.max` brighten, when lit.
 */
function useGlow(group: RefObject<Group | null>, on: boolean, still: boolean) {
  const g = useRef(0)
  useFrame(({ clock }, dt) => {
    const root = group.current
    if (!root) return
    g.current += ((on ? 1 : 0) - g.current) * Math.min(1, dt * (still ? 60 : 5))
    const flicker = on && !still ? 0.94 + Math.sin(clock.elapsedTime * 9) * 0.03 + Math.sin(clock.elapsedTime * 23) * 0.03 : 1
    root.traverse((o) => {
      const m = (o as Mesh).material as MeshStandardMaterial | undefined
      if (m && m.userData.glow !== undefined) m.emissiveIntensity = m.userData.glow[0] + (m.userData.glow[1] - m.userData.glow[0]) * g.current * flicker
      const l = o as PointLight
      if (l.isPointLight && l.userData.max !== undefined) l.intensity = l.userData.max * (0.12 + 0.88 * g.current)
      if (o.userData.sparkle && !still) o.rotation.z = clock.elapsedTime * (1 + o.userData.sparkle) * (on ? 2 : 0.3)
    })
  })
}

/** A standard material that glows from `off` to `on` emissive intensity when the store is lit. */
function GlowMat({ color, emissive, off = 0, on = 1.6, ...rest }: { color: string; emissive?: string; off?: number; on?: number; transparent?: boolean; opacity?: number; roughness?: number; metalness?: number; map?: CanvasTexture }) {
  return <meshStandardMaterial color={color} emissive={emissive ?? color} emissiveIntensity={off} userData={{ glow: [off, on] }} toneMapped={false} {...rest} />
}

function signTexture(label: string, color: string, style: 'neon' | 'serif' | 'clean' | 'hand'): CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 1024
  c.height = 256
  const g = c.getContext('2d')!
  g.clearRect(0, 0, 1024, 256)
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  const font =
    style === 'serif' ? 'italic 700 %spx Georgia, "Times New Roman", serif' : style === 'clean' ? '800 %spx "DM Sans", system-ui, sans-serif' : style === 'hand' ? '700 %spx "Comic Sans MS", "Bagel Fat One", cursive' : '400 %spx "Bagel Fat One", "Outfit", sans-serif'
  let size = 150
  const text = style === 'clean' ? label.toUpperCase() : label
  g.font = font.replace('%s', String(size))
  while (g.measureText(text).width > 940 && size > 50) g.font = font.replace('%s', String((size -= 6)))
  g.shadowColor = color
  g.shadowBlur = style === 'neon' ? 28 : 0
  g.fillStyle = style === 'clean' ? '#111111' : '#FFFFFF'
  if (style === 'neon') {
    g.lineWidth = 10
    g.strokeStyle = color
    g.strokeText(text, 512, 132)
  }
  g.fillText(text, 512, 132)
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  t.anisotropy = 8
  return t
}

function Sign({ label, color, style, y, w = 3.8, h = 0.95, z = 0.02 }: { label: string; color: string; style: 'neon' | 'serif' | 'clean' | 'hand'; y: number; w?: number; h?: number; z?: number }) {
  const map = useMemo(() => signTexture(label, color, style), [label, color, style])
  return (
    <mesh position={[0, y, z]}>
      <planeGeometry args={[w, h]} />
      <meshStandardMaterial map={map} transparent color="#FFFFFF" emissive={style === 'clean' ? '#000000' : '#FFFFFF'} emissiveMap={map} emissiveIntensity={0.25} userData={{ glow: [0.25, style === 'clean' ? 0.25 : 1.4] }} toneMapped={false} />
    </mesh>
  )
}

/* -------------------------------------------------------------- pieces */

function Box({ p, s, c, r, children }: { p: [number, number, number]; s: [number, number, number]; c: string; r?: [number, number, number]; children?: ReactNode }) {
  return (
    <mesh position={p} rotation={r} castShadow>
      <boxGeometry args={s} />
      {children ?? <meshStandardMaterial color={c} roughness={0.8} />}
    </mesh>
  )
}

/** A dress-form mannequin. `cut` decides the silhouette. */
function Mannequin({ x, z = -0.6, color, cut, scale = 1 }: { x: number; z?: number; color: string; cut: 'gown' | 'mini' | 'hoodie' | 'tee' | 'leather'; scale?: number }) {
  const skin = '#EADBCB'
  return (
    <group position={[x, 0.15, z]} scale={scale}>
      <mesh position={[0, 0.05, 0]}>
        <cylinderGeometry args={[0.22, 0.26, 0.06, 20]} />
        <meshStandardMaterial color="#2A2730" metalness={0.6} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.9, 8]} />
        <meshStandardMaterial color="#C7CAD1" metalness={0.9} roughness={0.2} />
      </mesh>
      {cut === 'gown' && (
        <mesh position={[0, 0.9, 0]}>
          <coneGeometry args={[0.42, 1.5, 24, 1, true]} />
          <meshStandardMaterial color={color} roughness={0.35} metalness={0.15} side={2} />
        </mesh>
      )}
      {cut === 'mini' && (
        <mesh position={[0, 1.22, 0]}>
          <coneGeometry args={[0.3, 0.7, 20, 1, true]} />
          <meshStandardMaterial color={color} roughness={0.25} metalness={0.5} side={2} />
        </mesh>
      )}
      {(cut === 'hoodie' || cut === 'tee' || cut === 'leather') && (
        <>
          <Box p={[0, 1.32, 0]} s={[cut === 'hoodie' ? 0.62 : 0.52, 0.55, 0.3]} c={color}>
            <meshStandardMaterial color={color} roughness={cut === 'leather' ? 0.25 : 0.9} metalness={cut === 'leather' ? 0.3 : 0} />
          </Box>
          <Box p={[0, 0.82, 0]} s={[0.4, 0.5, 0.24]} c={cut === 'leather' ? '#111111' : '#2B3A55'} />
        </>
      )}
      <mesh position={[0, 1.45, 0]}>
        <cylinderGeometry args={[0.15, 0.13, 0.42, 16]} />
        <meshStandardMaterial color={skin} roughness={0.5} />
      </mesh>
      <mesh position={[0, 1.78, 0]}>
        <sphereGeometry args={[0.12, 16, 16]} />
        <meshStandardMaterial color={skin} roughness={0.5} />
      </mesh>
      {cut === 'hoodie' && (
        <mesh position={[0, 1.78, -0.04]}>
          <sphereGeometry args={[0.16, 16, 16, 0, Math.PI * 2, 0, Math.PI / 1.6]} />
          <meshStandardMaterial color={color} roughness={0.9} />
        </mesh>
      )}
    </group>
  )
}

/** A hanging rail of garments. */
function Rail({ x, z, w, colors, h = 1.5 }: { x: number; z: number; w: number; colors: string[]; h?: number }) {
  const n = Math.max(3, Math.floor(w / 0.18))
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, h, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.018, 0.018, w, 8]} />
        <meshStandardMaterial color="#C7CAD1" metalness={0.9} roughness={0.2} />
      </mesh>
      {[-w / 2, w / 2].map((px) => (
        <mesh key={px} position={[px, h / 2, 0]}>
          <cylinderGeometry args={[0.02, 0.02, h, 8]} />
          <meshStandardMaterial color="#C7CAD1" metalness={0.9} roughness={0.2} />
        </mesh>
      ))}
      {Array.from({ length: n }, (_, i) => (
        <Box key={i} p={[-w / 2 + 0.12 + (i * (w - 0.24)) / (n - 1), h - 0.36, (i % 2) * 0.03]} s={[0.05, 0.62, 0.42]} c={colors[i % colors.length]} />
      ))}
    </group>
  )
}

/** The shared building: walls, a lit interior, a glass front and a door. */
function Shell({ wall, trim, interior, accent, children, height = 3.8 }: { wall: string; trim: string; interior: string; accent: string; children?: ReactNode; height?: number }) {
  const W = 4.8
  return (
    <group>
      <Box p={[0, 0.07, 0.2]} s={[W + 0.4, 0.14, 3.4]} c="#D9CFC6" />
      {/* back wall + floor + ceiling glow */}
      <Box p={[0, height / 2, -1.45]} s={[W, height, 0.1]} c={interior} />
      <Box p={[0, 0.16, -0.5]} s={[W - 0.2, 0.04, 1.9]} c="#F4EEE8" />
      <mesh position={[0, 2.35, -0.5]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[W - 0.4, 1.7]} />
        <GlowMat color="#FFF4DD" off={0.15} on={1.1} />
      </mesh>
      {/* side walls and facade */}
      <Box p={[-W / 2 + 0.15, height / 2, -0.55]} s={[0.3, height, 1.9]} c={wall} />
      <Box p={[W / 2 - 0.15, height / 2, -0.55]} s={[0.3, height, 1.9]} c={wall} />
      <Box p={[0, height - 0.65, 0.35]} s={[W, 1.3, 0.12]} c={wall} />
      {/* window frame */}
      <Box p={[0, 2.43, 0.38]} s={[W - 0.4, 0.07, 0.08]} c={trim} />
      <Box p={[-0.95, 1.3, 0.38]} s={[0.07, 2.25, 0.08]} c={trim} />
      {/* glass */}
      <mesh position={[0.6, 1.3, 0.36]}>
        <planeGeometry args={[3.0, 2.2]} />
        <meshStandardMaterial color="#DDEEFF" transparent opacity={0.16} roughness={0.05} metalness={0.4} />
      </mesh>
      {/* door */}
      <mesh position={[-1.55, 1.15, 0.37]}>
        <planeGeometry args={[1.05, 2.0]} />
        <GlowMat color="#2A2230" emissive={accent} off={0} on={0.25} />
      </mesh>
      <mesh position={[-1.2, 1.15, 0.4]}>
        <sphereGeometry args={[0.04, 10, 10]} />
        <meshStandardMaterial color="#E9C46A" metalness={0.9} roughness={0.2} />
      </mesh>
      <pointLight position={[0.4, 2.1, -0.3]} color="#FFE7C2" distance={5} decay={1.6} userData={{ max: 6 }} />
      <pointLight position={[0, 3.2, 1.6]} color={accent} distance={5} decay={1.8} userData={{ max: 5 }} />
      {children}
    </group>
  )
}

/* ----------------------------------------------------------- the stores */

function Streetwear({ s }: { s: WorldStore }) {
  return (
    <Shell wall="#6B6F76" trim="#111111" interior="#3A3D44" accent={s.accent}>
      {/* graffiti drips on the concrete */}
      {['#C8FF3D', s.accent, '#FF5C2B', '#2FBF71'].map((c, i) => (
        <Box key={c} p={[-2.25 + i * 0.07, 2.2 + i * 0.25, 0.46]} s={[0.06, 1.2, 0.02]} c={c} r={[0, 0, 0.4]}>
          <GlowMat color={c} off={0.05} on={0.6} />
        </Box>
      ))}
      {/* half-up roller shutter */}
      {Array.from({ length: 5 }, (_, i) => (
        <Box key={i} p={[0.6, 2.32 - i * 0.075, 0.43]} s={[3.0, 0.06, 0.05]} c="#9AA0A8" />
      ))}
      <Sign label={s.name} color={s.accent} style="neon" y={3.2} z={0.43} />
      {/* sneaker wall */}
      {Array.from({ length: 12 }, (_, i) => (
        <Box key={i} p={[1.05 + (i % 4) * 0.38, 0.75 + Math.floor(i / 4) * 0.42, -1.33]} s={[0.3, 0.13, 0.16]} c={s.stock[i % s.stock.length]} />
      ))}
      <Rail x={-0.2} z={-0.75} w={1.4} colors={s.stock} />
      <Mannequin x={1.4} z={-0.25} color={s.stock[0]} cut="hoodie" />
      {/* boombox on the kerb */}
      <group position={[2.0, 0.3, 1.2]}>
        <Box p={[0, 0, 0]} s={[0.7, 0.34, 0.2]} c="#1B1B22" />
        {[-0.2, 0.2].map((x) => (
          <mesh key={x} position={[x, 0, 0.11]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.11, 0.11, 0.02, 20]} />
            <GlowMat color="#3A3D44" emissive={s.accent} off={0} on={0.8} />
          </mesh>
        ))}
      </group>
    </Shell>
  )
}

function Classy({ s }: { s: WorldStore }) {
  return (
    <Shell wall="#F3E6D3" trim="#C9A227" interior="#F7EFE4" accent={s.accent}>
      {/* gold columns */}
      {[-2.45, 2.45].map((x) => (
        <group key={x}>
          <mesh position={[x, 1.9, 0.5]}>
            <cylinderGeometry args={[0.13, 0.15, 3.6, 20]} />
            <meshStandardMaterial color="#E9D8B4" roughness={0.4} />
          </mesh>
          <Box p={[x, 3.75, 0.5]} s={[0.42, 0.14, 0.42]} c="#C9A227">
            <meshStandardMaterial color="#C9A227" metalness={0.8} roughness={0.25} />
          </Box>
        </group>
      ))}
      {/* arch over the window */}
      <mesh position={[0.6, 2.43, 0.4]}>
        <torusGeometry args={[1.5, 0.05, 10, 40, Math.PI]} />
        <meshStandardMaterial color="#C9A227" metalness={0.85} roughness={0.2} />
      </mesh>
      {/* scalloped awning */}
      <mesh position={[0, 2.62, 0.7]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.32, 0.32, 4.4, 24, 1, true, 0, Math.PI]} />
        <meshStandardMaterial color={s.accent} roughness={0.6} side={2} />
      </mesh>
      <Sign label={s.name} color="#C9A227" style="serif" y={3.3} z={0.43} />
      {/* gowns on forms + chandelier */}
      <Mannequin x={-0.15} color={s.stock[0]} cut="gown" />
      <Mannequin x={0.85} z={-0.9} color={s.stock[1 % s.stock.length]} cut="gown" />
      <Mannequin x={1.75} color={s.stock[2 % s.stock.length]} cut="gown" />
      <group position={[0.8, 2.15, -0.5]}>
        <mesh>
          <sphereGeometry args={[0.12, 16, 16]} />
          <GlowMat color="#FFF4DD" off={0.2} on={2.2} />
        </mesh>
        {Array.from({ length: 8 }, (_, i) => (
          <mesh key={i} position={[Math.cos((i / 8) * Math.PI * 2) * 0.3, -0.12, Math.sin((i / 8) * Math.PI * 2) * 0.3]}>
            <sphereGeometry args={[0.045, 10, 10]} />
            <GlowMat color="#FFE9B0" off={0.2} on={2.6} />
          </mesh>
        ))}
      </group>
      {/* marble steps */}
      <Box p={[-1.55, 0.2, 0.95]} s={[1.3, 0.12, 0.5]} c="#F4F1EC" />
    </Shell>
  )
}

function Basics({ s }: { s: WorldStore }) {
  return (
    <Shell wall="#FAFAFA" trim="#111111" interior="#FFFFFF" accent={s.accent}>
      <Sign label={s.name} color="#111111" style="clean" y={3.2} z={0.43} />
      <Box p={[0, 2.72, 0.42]} s={[4.4, 0.04, 0.02]} c="#111111" />
      {/* tables of folded tees */}
      {[-0.1, 1.4].map((x, t) => (
        <group key={x} position={[x, 0, -0.35]}>
          <Box p={[0, 0.55, 0]} s={[1.1, 0.06, 0.7]} c="#E9E2DC" />
          {[-0.4, 0.4].map((lx) => (
            <Box key={lx} p={[lx, 0.36, 0]} s={[0.05, 0.4, 0.6]} c="#C7CAD1" />
          ))}
          {Array.from({ length: 6 }, (_, i) => (
            <group key={i} position={[-0.32 + (i % 3) * 0.32, 0.6, (Math.floor(i / 3) - 0.5) * 0.3]}>
              {Array.from({ length: 4 }, (_, k) => (
                <Box key={k} p={[0, k * 0.055, 0]} s={[0.26, 0.05, 0.22]} c={s.stock[(i + k + t) % s.stock.length]} />
              ))}
            </group>
          ))}
        </group>
      ))}
      <Rail x={0.6} z={-1.2} w={2.6} colors={s.stock} h={1.7} />
    </Shell>
  )
}

/** Bend down select: a market stall, not a shop. Striped tarp, piles, a washing line and crates. */
function Thrift({ s }: { s: WorldStore }) {
  const piles = useMemo(() => Array.from({ length: 22 }, (_, i) => ({ x: ((i * 37) % 100) / 100, z: ((i * 61) % 100) / 100, c: s.stock[i % s.stock.length] })), [s.stock])
  return (
    <group>
      <Box p={[0, 0.07, 0.2]} s={[5.2, 0.14, 3.4]} c="#C9B79A" />
      {/* poles */}
      {[
        [-2.2, -1.2],
        [2.2, -1.2],
        [-2.2, 1.2],
        [2.2, 1.2],
      ].map(([x, z]) => (
        <mesh key={`${x}${z}`} position={[x, 1.5, z]}>
          <cylinderGeometry args={[0.06, 0.07, 3, 8]} />
          <meshStandardMaterial color="#8C5A3C" roughness={0.9} />
        </mesh>
      ))}
      {/* striped tarp roof */}
      {Array.from({ length: 9 }, (_, i) => (
        <Box key={i} p={[-2.2 + i * 0.55 + 0.27, 3.05, 0]} s={[0.55, 0.04, 2.9]} c={i % 2 ? '#FFFFFF' : s.accent} r={[0.12, 0, 0]} />
      ))}
      {/* string lights */}
      {Array.from({ length: 12 }, (_, i) => (
        <mesh key={i} position={[-2.1 + i * 0.38, 2.75 - Math.sin((i / 11) * Math.PI) * 0.18, 1.25]}>
          <sphereGeometry args={[0.05, 10, 10]} />
          <GlowMat color={['#FFD95A', '#FF7AB6', '#7CF0CF'][i % 3]} off={0.1} on={3} />
        </mesh>
      ))}
      <Sign label={s.name} color="#FFD95A" style="hand" y={3.55} w={4.2} h={1.05} z={1.2} />
      {/* table with heaps of clothes */}
      <Box p={[0, 0.65, -0.1]} s={[3.6, 0.08, 1.4]} c="#A67C52" />
      {[-1.6, 1.6].map((x) => (
        <Box key={x} p={[x, 0.33, -0.1]} s={[0.08, 0.6, 1.2]} c="#8C5A3C" />
      ))}
      {piles.map((p, i) => (
        <mesh key={i} position={[-1.5 + p.x * 3, 0.78 + (i % 3) * 0.06, -0.65 + p.z * 1.1]} scale={[1, 0.45, 1]} rotation={[0, i, 0]}>
          <sphereGeometry args={[0.2, 10, 8]} />
          <meshStandardMaterial color={p.c} roughness={1} />
        </mesh>
      ))}
      {/* washing line of shirts */}
      <mesh position={[0, 2.35, -1.2]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.01, 0.01, 4.4, 6]} />
        <meshStandardMaterial color="#F4EEE8" />
      </mesh>
      {Array.from({ length: 8 }, (_, i) => (
        <Box key={i} p={[-1.9 + i * 0.54, 2.0, -1.2]} s={[0.42, 0.62, 0.03]} c={s.stock[(i + 2) % s.stock.length]} r={[0, 0, (i % 2 ? 1 : -1) * 0.05]} />
      ))}
      {/* crates */}
      {[
        [1.9, 0.3, 1.0],
        [2.3, 0.3, 0.6],
        [2.1, 0.72, 0.8],
      ].map(([x, y, z], i) => (
        <Box key={i} p={[x, y, z]} s={[0.5, 0.42, 0.5]} c="#C49A6C" />
      ))}
      <pointLight position={[0, 2.5, 0.6]} color="#FFE7C2" distance={6} decay={1.5} userData={{ max: 7 }} />
    </group>
  )
}

function Edgy({ s }: { s: WorldStore }) {
  return (
    <Shell wall="#141217" trim="#C62828" interior="#1E1A22" accent={s.accent}>
      {/* red neon frame */}
      {[
        [0.6, 2.45, 3.1, 0.05],
        [0.6, 0.18, 3.1, 0.05],
        [-0.92, 1.3, 0.05, 2.3],
        [2.13, 1.3, 0.05, 2.3],
      ].map(([x, y, w, h], i) => (
        <Box key={i} p={[x, y, 0.42]} s={[w, h, 0.04]} c="#C62828">
          <GlowMat color="#FF1F3D" off={0.2} on={3.2} />
        </Box>
      ))}
      {/* spikes along the roof */}
      {Array.from({ length: 12 }, (_, i) => (
        <mesh key={i} position={[-2.2 + i * 0.4, 3.95, 0.35]}>
          <coneGeometry args={[0.09, 0.32, 8]} />
          <meshStandardMaterial color="#C7CAD1" metalness={0.95} roughness={0.15} />
        </mesh>
      ))}
      <Sign label={s.name} color="#FF1F3D" style="neon" y={3.2} z={0.43} />
      {/* hanging chains */}
      {[-2.0, 2.3].map((x) => (
        <group key={x} position={[x, 2.8, 0.55]}>
          {Array.from({ length: 6 }, (_, i) => (
            <mesh key={i} position={[0, -i * 0.13, 0]} rotation={[0, i % 2 ? Math.PI / 2 : 0, 0]}>
              <torusGeometry args={[0.05, 0.014, 6, 12]} />
              <meshStandardMaterial color="#C7CAD1" metalness={0.95} roughness={0.2} />
            </mesh>
          ))}
        </group>
      ))}
      <Mannequin x={-0.2} color="#111111" cut="leather" />
      <Mannequin x={0.8} z={-0.9} color={s.stock[0]} cut="leather" />
      <Mannequin x={1.75} color="#2A2235" cut="hoodie" />
      {/* cage rack */}
      {Array.from({ length: 7 }, (_, i) => (
        <mesh key={i} position={[-0.4 + i * 0.4, 1.4, -1.35]}>
          <cylinderGeometry args={[0.012, 0.012, 2.4, 6]} />
          <meshStandardMaterial color="#4A4650" metalness={0.8} />
        </mesh>
      ))}
    </Shell>
  )
}

function heartGeometry() {
  const h = new Shape()
  h.moveTo(0, -0.35)
  h.bezierCurveTo(-0.5, 0, -0.45, 0.4, -0.22, 0.42)
  h.bezierCurveTo(-0.08, 0.43, 0, 0.32, 0, 0.24)
  h.bezierCurveTo(0, 0.32, 0.08, 0.43, 0.22, 0.42)
  h.bezierCurveTo(0.45, 0.4, 0.5, 0, 0, -0.35)
  return new ExtrudeGeometry(h, { depth: 0.08, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 2 })
}

function Baddie({ s }: { s: WorldStore }) {
  const heart = useMemo(() => heartGeometry(), [])
  const sequins = useMemo(() => Array.from({ length: 60 }, (_, i) => ({ x: -2.3 + (i % 15) * 0.33, y: 2.75 + Math.floor(i / 15) * 0.27, k: (i * 7) % 5 })), [])
  return (
    <Shell wall="#FF8CC0" trim="#D4AF37" interior="#FFE3EF" accent={s.accent}>
      {/* sequin facade */}
      {sequins.map((q, i) => (
        <mesh key={i} position={[q.x, q.y, 0.43]} userData={{ sparkle: q.k }}>
          <circleGeometry args={[0.07, 6]} />
          <GlowMat color={q.k % 2 ? '#FFD1E6' : '#FFFFFF'} emissive="#FFFFFF" off={0.05} on={q.k % 3 ? 0.9 : 2} metalness={0.9} roughness={0.15} />
        </mesh>
      ))}
      <Sign label={s.name} color="#FF2E88" style="neon" y={3.25} z={0.46} h={0.8} />
      <mesh geometry={heart} position={[2.2, 2.0, 0.42]} scale={0.9}>
        <GlowMat color="#FF2E88" off={0.3} on={3} />
      </mesh>
      <Mannequin x={-0.1} color={s.stock[0]} cut="mini" />
      <Mannequin x={0.8} z={-0.9} color="#D4AF37" cut="gown" />
      <Mannequin x={1.7} color={s.stock[1 % s.stock.length]} cut="mini" />
      {/* pink carpet */}
      <Box p={[-1.55, 0.15, 1.2]} s={[1.1, 0.02, 1.6]} c="#FF2E88" />
    </Shell>
  )
}

/** Booty: a boudoir. Wine velvet, drawn curtains, a heart mirror, bralettes on forms. */
function Lingerie({ s }: { s: WorldStore }) {
  const heart = useMemo(() => heartGeometry(), [])
  return (
    <Shell wall="#5A0F24" trim="#D4AF37" interior="#3B0A18" accent={s.accent}>
      {/* velvet curtains, tied back */}
      {[-1, 1].map((k) => (
        <group key={k} position={[0.6 + k * 1.35, 1.3, 0.3]}>
          {Array.from({ length: 4 }, (_, i) => (
            <mesh key={i} position={[k * i * 0.06, 0, i * 0.01]}>
              <cylinderGeometry args={[0.07, 0.12, 2.3, 10, 1, true]} />
              <meshStandardMaterial color="#8E1033" roughness={0.95} side={2} />
            </mesh>
          ))}
        </group>
      ))}
      <Sign label={s.name} color="#FF5C8A" style="serif" y={3.25} z={0.43} />
      <mesh geometry={heart} position={[0.6, 1.7, -1.3]} scale={1.3}>
        <GlowMat color="#FF5C8A" off={0.25} on={2.6} />
      </mesh>
      {[-0.2, 1.4].map((x, i) => (
        <group key={x} position={[x, 0.15, -0.5]}>
          <mesh position={[0, 0.5, 0]}>
            <cylinderGeometry args={[0.02, 0.02, 0.9, 8]} />
            <Metal />
          </mesh>
          <mesh position={[0, 1.15, 0]} scale={[1, 1.15, 0.8]}>
            <cylinderGeometry args={[0.2, 0.17, 0.5, 20]} />
            <meshStandardMaterial color="#EADBCB" roughness={0.5} />
          </mesh>
          {[-1, 1].map((k) => (
            <mesh key={k} position={[k * 0.09, 1.28, 0.13]} scale={[1, 1, 0.7]}>
              <sphereGeometry args={[0.085, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
              <meshPhysicalMaterial color={s.stock[i % s.stock.length]} roughness={0.35} sheen={0.8} />
            </mesh>
          ))}
        </group>
      ))}
      {/* satin pouf */}
      <mesh position={[0.6, 0.35, 0.1]} scale={[1, 0.55, 1]}>
        <sphereGeometry args={[0.32, 20, 14]} />
        <meshPhysicalMaterial color="#FFD1E6" roughness={0.3} sheen={1} />
      </mesh>
    </Shell>
  )
}

function Metal({ color = '#D4AF37' }: { color?: string }) {
  return <meshStandardMaterial color={color} metalness={0.95} roughness={0.2} />
}

/** Meirre Chen: black-and-ivory quilting, pearls, gold plinths for the bags. */
function Luxury({ s }: { s: WorldStore }) {
  return (
    <Shell wall="#111111" trim="#D4AF37" interior="#F5F0E6" accent={s.accent}>
      {/* quilted facade */}
      {Array.from({ length: 24 }, (_, i) => (
        <mesh key={i} position={[-2.1 + (i % 12) * 0.38, 2.85 + Math.floor(i / 12) * 0.38, 0.43]} rotation={[0, 0, Math.PI / 4]}>
          <boxGeometry args={[0.26, 0.26, 0.03]} />
          <meshStandardMaterial color="#1C1C1C" roughness={0.6} />
        </mesh>
      ))}
      <Sign label={s.name} color="#D4AF37" style="serif" y={3.3} z={0.47} h={0.8} />
      {/* pearl strings */}
      {[-2.3, 2.3].map((x) => (
        <group key={x} position={[x, 2.6, 0.5]}>
          {Array.from({ length: 10 }, (_, i) => (
            <mesh key={i} position={[0, -i * 0.11, 0]}>
              <sphereGeometry args={[0.04, 12, 12]} />
              <meshPhysicalMaterial color="#FFFDF5" roughness={0.15} clearcoat={1} />
            </mesh>
          ))}
        </group>
      ))}
      {/* gold plinths with bags */}
      {[-0.1, 0.8, 1.7].map((x, i) => (
        <group key={x} position={[x, 0, -0.5]}>
          <mesh position={[0, 0.45, 0]}>
            <cylinderGeometry args={[0.24, 0.24, 0.6, 24]} />
            <Metal />
          </mesh>
          <Box p={[0, 0.9, 0]} s={[0.36, 0.26, 0.14]} c={s.stock[i % s.stock.length]}>
            <meshPhysicalMaterial color={s.stock[i % s.stock.length]} roughness={0.25} clearcoat={0.8} />
          </Box>
          <mesh position={[0, 1.06, 0]}>
            <torusGeometry args={[0.1, 0.012, 8, 20, Math.PI]} />
            <Metal />
          </mesh>
          <pointLight position={[0, 1.6, 0.3]} color="#FFF4DD" distance={1.4} userData={{ max: 3 }} />
        </group>
      ))}
    </Shell>
  )
}

/** Nova Sport: orange and black, a speed stripe, a pyramid of sneakers and a treadmill. */
function Sport({ s }: { s: WorldStore }) {
  return (
    <Shell wall="#1C1C1C" trim="#FF5A1F" interior="#2A2A2A" accent={s.accent}>
      {/* speed stripe across the facade */}
      <mesh position={[0, 3.0, 0.44]} rotation={[0, 0, 0.12]}>
        <boxGeometry args={[4.6, 0.14, 0.02]} />
        <GlowMat color="#FF5A1F" off={0.3} on={2.4} />
      </mesh>
      <Sign label={s.name} color="#FF5A1F" style="clean" y={3.35} z={0.45} h={0.7} />
      <Box p={[0, 3.35, 0.43]} s={[3.9, 0.62, 0.02]} c="#FFFFFF" />
      {/* sneaker pyramid */}
      {[0, 1, 2].map((row) =>
        Array.from({ length: 3 - row }, (_, i) => (
          <group key={`${row}-${i}`} position={[1.0 + (i - (2 - row) / 2) * 0.5, 0.35 + row * 0.42, -0.9]}>
            <Box p={[0, -0.12, 0]} s={[0.46, 0.06, 0.4]} c="#F4F0EA" />
            <mesh position={[0, 0, 0]} scale={[1.6, 0.6, 1]}>
              <sphereGeometry args={[0.12, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
              <meshStandardMaterial color={s.stock[(row + i) % s.stock.length]} roughness={0.5} />
            </mesh>
          </group>
        )),
      )}
      {/* treadmill */}
      <group position={[-0.4, 0.17, -0.4]}>
        <Box p={[0, 0.08, 0]} s={[0.6, 0.12, 1.2]} c="#2A2730" />
        <Box p={[0, 0.15, 0]} s={[0.5, 0.02, 1.1]} c="#111111" />
        {[-1, 1].map((k) => (
          <mesh key={k} position={[k * 0.28, 0.6, -0.5]}>
            <cylinderGeometry args={[0.02, 0.02, 0.9, 8]} />
            <Metal color="#C7CAD1" />
          </mesh>
        ))}
        <Box p={[0, 1.05, -0.5]} s={[0.6, 0.2, 0.1]} c="#111111">
          <GlowMat color="#111111" emissive="#FF5A1F" off={0.1} on={1.6} />
        </Box>
      </group>
      <Mannequin x={1.9} z={-0.2} color={s.stock[0]} cut="tee" />
    </Shell>
  )
}

/** GoBonkers: Super Eagles green, a football on a plinth, jerseys on the wall, graffiti. */
function Football({ s }: { s: WorldStore }) {
  return (
    <Shell wall="#0B5D3B" trim="#FFFFFF" interior="#E8F5EE" accent={s.accent}>
      {/* striped awning in green and white */}
      {Array.from({ length: 9 }, (_, i) => (
        <Box key={i} p={[-2.2 + i * 0.55 + 0.27, 2.68, 0.75]} s={[0.55, 0.04, 0.8]} c={i % 2 ? '#FFFFFF' : '#008751'} r={[0.35, 0, 0]} />
      ))}
      <Sign label={s.name} color="#C8FF3D" style="neon" y={3.3} z={0.43} />
      {/* jerseys on the back wall */}
      {[0, 1, 2].map((i) => (
        <group key={i} position={[-0.1 + i * 0.85, 1.55, -1.33]}>
          <Box p={[0, 0, 0]} s={[0.55, 0.62, 0.05]} c={i === 1 ? '#FFFFFF' : '#008751'} />
          {[-1, 1].map((k) => (
            <Box key={k} p={[k * 0.36, 0.18, 0]} s={[0.22, 0.2, 0.05]} c={i === 1 ? '#FFFFFF' : '#008751'} r={[0, 0, k * -0.5]} />
          ))}
          <Box p={[0, 0.02, 0.03]} s={[0.16, 0.2, 0.01]} c={i === 1 ? '#008751' : '#FFFFFF'} />
        </group>
      ))}
      {/* football on a plinth */}
      <group position={[0.3, 0, -0.2]}>
        <Box p={[0, 0.4, 0]} s={[0.5, 0.5, 0.5]} c="#111111" />
        <mesh position={[0, 0.85, 0]} userData={{ sparkle: 0.5 }}>
          <icosahedronGeometry args={[0.2, 1]} />
          <meshStandardMaterial color="#FFFFFF" roughness={0.5} flatShading />
        </mesh>
      </group>
      <Mannequin x={1.7} z={-0.3} color="#008751" cut="hoodie" />
      {/* graffiti tag */}
      {['#C8FF3D', '#FFFFFF', '#FFD95A'].map((c, i) => (
        <Box key={c} p={[2.25, 1.0 + i * 0.3, 0.46]} s={[0.04, 0.25, 0.02]} c={c} r={[0, 0, 0.6 - i * 0.3]}>
          <GlowMat color={c} off={0.05} on={0.7} />
        </Box>
      ))}
    </Shell>
  )
}

/** Glow Bar: pink vanity mirrors with bulbs, a counter of lipsticks and palettes. */
function Makeup({ s }: { s: WorldStore }) {
    return (
        <Shell wall="#FFB3D5" trim="#D4AF37" interior="#FFF0F7" accent={s.accent}>
            <Sign label={s.name} color="#FF2E88" style="neon" y={3.2} z={0.43} />
            {/* vanity mirrors with bulbs */}
            {[-1.2, 0.1, 1.4].map((x) => (
                <group key={x} position={[x, 1.55, -1.36]}>
                    <Box p={[0, 0, 0]} s={[0.9, 1.2, 0.03]} c="#EAF4FF">
                        <meshStandardMaterial color="#EAF4FF" metalness={0.9} roughness={0.08} />
                    </Box>
                    {Array.from({ length: 10 }, (_, i) => (
                        <mesh key={i} position={[i < 5 ? -0.5 : 0.5, 0.5 - (i % 5) * 0.25, 0.04]}>
                            <sphereGeometry args={[0.05, 10, 10]} />
                            <GlowMat color="#FFF3C4" off={0.2} on={2.6} />
                        </mesh>
                    ))}
                </group>
            ))}
            {/* counter */}
            <Box p={[0.5, 0.5, -0.5]} s={[3.4, 0.08, 0.7]} c="#FFFFFF" />
            <Box p={[0.5, 0.25, -0.5]} s={[3.3, 0.5, 0.6]} c="#FF8CC4" />
            {/* lipsticks and palettes on the counter */}
            {Array.from({ length: 12 }, (_, i) => (
                <mesh key={i} position={[-0.9 + i * 0.3, 0.64, -0.5]}>
                    <cylinderGeometry args={[0.035, 0.035, 0.2, 10]} />
                    <meshStandardMaterial color={s.stock[i % s.stock.length]} roughness={0.35} metalness={0.3} />
                </mesh>
            ))}
            {[0, 1].map((i) => (
                <Box key={i} p={[1.9 + i * 0.35, 0.57, -0.4]} s={[0.28, 0.04, 0.22]} c={s.stock[(i + 3) % s.stock.length]} />
            ))}
            {/* round pink pouf */}
            <mesh position={[-1.55, 0.3, 0.9]} scale={[1, 0.6, 1]}>
                <sphereGeometry args={[0.3, 20, 14]} />
                <meshPhysicalMaterial color="#FF8CC4" roughness={0.3} sheen={1} />
            </mesh>
        </Shell>
    )
}

/** Beauty Doctor: a clean teal-and-white clinic with a glowing cross, a treatment bed and a plant. */
function Clinic({ s }: { s: WorldStore }) {
    return (
        <Shell wall="#E8F6F5" trim="#2BA6A0" interior="#FFFFFF" accent={s.accent}>
            <Sign label={s.name} color="#2BA6A0" style="clean" y={3.25} z={0.43} h={0.8} />
            {/* glowing medical cross */}
            <group position={[2.05, 2.0, 0.44]}>
                <Box p={[0, 0, 0]} s={[0.55, 0.16, 0.04]} c="#2BA6A0">
                    <GlowMat color="#2BA6A0" off={0.3} on={2.2} />
                </Box>
                <Box p={[0, 0, 0]} s={[0.16, 0.55, 0.04]} c="#2BA6A0">
                    <GlowMat color="#2BA6A0" off={0.3} on={2.2} />
                </Box>
            </group>
            {/* treatment bed */}
            <Box p={[0.3, 0.5, -0.6]} s={[1.9, 0.18, 0.75]} c="#FFFFFF" />
            <Box p={[0.3, 0.28, -0.6]} s={[0.12, 0.4, 0.12]} c="#C7CAD1" />
            <Box p={[-0.45, 0.68, -0.6]} s={[0.5, 0.2, 0.7]} c="#BFE8E5" />
            {/* cabinet with bottles */}
            <Box p={[1.7, 0.9, -1.2]} s={[1.0, 1.8, 0.35]} c="#D5ECEA" />
            {Array.from({ length: 6 }, (_, i) => (
                <mesh key={i} position={[1.4 + (i % 3) * 0.3, 1.2 + Math.floor(i / 3) * 0.45, -1.0]}>
                    <cylinderGeometry args={[0.05, 0.05, 0.2, 10]} />
                    <meshStandardMaterial color={s.stock[i % s.stock.length]} roughness={0.2} />
                </mesh>
            ))}
            {/* plant */}
            <mesh position={[-1.8, 0.3, 0.9]}>
                <cylinderGeometry args={[0.18, 0.14, 0.4, 14]} />
                <meshStandardMaterial color="#FFFFFF" roughness={0.6} />
            </mesh>
            <mesh position={[-1.8, 0.75, 0.9]}>
                <sphereGeometry args={[0.28, 14, 12]} />
                <meshStandardMaterial color="#3FA66B" roughness={0.9} />
            </mesh>
        </Shell>
    )
}

// const BUILD: Record<WorldStoreKind, (p: { s: WorldStore }) => ReactNode> = { streetwear: Streetwear, makeup:Makeup, clinic:Clinic, classy: Classy, basics: Basics, thrift: Thrift, edgy: Edgy, baddie: Baddie, lingerie: Lingerie, luxury: Luxury, sport: Sport, football: Football }
const BUILD: Record<WorldStoreKind, (p: { s: WorldStore }) => ReactNode> = {
    streetwear: Streetwear,
    makeup: Makeup,
    clinic: Clinic,
    classy: Classy,
    basics: Basics,
    thrift: Thrift,
    edgy: Edgy,
    baddie: Baddie,
    lingerie: Lingerie,
    luxury: Luxury,
    sport: Sport,
    football: Football,
}
function StoreNode({ store, index, lit, still, onEnter, onHover }: { store: WorldStore; index: number; lit: boolean; still: boolean; onEnter: (id: string) => void; onHover: (i: number | null) => void }) {
  const group = useRef<Group>(null)
  useGlow(group, lit, still)
  const Build = BUILD[store.kind]
  return (
    <group
      ref={group}
      position={[index * SPACING, 0, 0]}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation()
        if (e.delta < 8) onEnter(store.id)
      }}
      onPointerOver={(e) => {
        e.stopPropagation()
        onHover(index)
        document.body.style.cursor = 'pointer'
      }}
      onPointerOut={() => {
        onHover(null)
        document.body.style.cursor = ''
      }}
    >
      <Build s={store} />
    </group>
  )
}

/* ------------------------------------------------------------ the street */

function Street({ count }: { count: number }) {
  const len = count * SPACING + 30
  const mid = ((count - 1) * SPACING) / 2
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[mid, 0, 1]}>
        <planeGeometry args={[len, 3.6]} />
        <meshStandardMaterial color="#E8DCD2" roughness={0.95} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[mid, -0.01, 7]}>
        <planeGeometry args={[len, 9]} />
        <meshStandardMaterial color="#3B3A42" roughness={0.95} />
      </mesh>
      {Array.from({ length: Math.ceil(len / 2) }, (_, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[mid - len / 2 + i * 2, 0.005, 6]}>
          <planeGeometry args={[1, 0.12]} />
          <meshStandardMaterial color="#F5C518" />
        </mesh>
      ))}
      {/* lamps between stores */}
      {Array.from({ length: count + 1 }, (_, i) => (
        <group key={i} position={[(i - 0.5) * SPACING, 0, 2.6]}>
          <mesh position={[0, 1.6, 0]}>
            <cylinderGeometry args={[0.04, 0.06, 3.2, 8]} />
            <meshStandardMaterial color="#2A2730" metalness={0.6} />
          </mesh>
          <mesh position={[0, 3.25, 0]}>
            <sphereGeometry args={[0.16, 16, 16]} />
            <meshStandardMaterial color="#FFF1C9" emissive="#FFE7A8" emissiveIntensity={1.4} toneMapped={false} />
          </mesh>
        </group>
      ))}
      {/* skyline behind */}
      {Array.from({ length: count * 3 }, (_, i) => (
        <mesh key={i} position={[-8 + i * 2.4, 3 + ((i * 53) % 7) * 0.6, -6 - (i % 3)]}>
          <boxGeometry args={[2, 6 + ((i * 53) % 7) * 1.2, 1]} />
          <meshStandardMaterial color={new Color('#C9A7D9').lerp(new Color('#FFC7DD'), (i % 4) / 4)} roughness={1} />
        </mesh>
      ))}
    </group>
  )
}

/** Glides the camera along the street to the scroll position. */
function CameraRig({ pos, count, onFocus }: { pos: RefObject<number>; count: number; onFocus: (i: number) => void }) {
  const last = useRef(-1)
  useFrame(({ camera }, dt) => {
    const x = pos.current * SPACING
    camera.position.x += (x - camera.position.x) * Math.min(1, dt * 6)
    camera.position.y = 2.3
    camera.position.z = 8.6
    camera.lookAt(camera.position.x, 1.85, 0)
    const i = Math.max(0, Math.min(count - 1, Math.round(camera.position.x / SPACING)))
    if (i !== last.current) {
      last.current = i
      onFocus(i)
    }
  })
  return null
}

/** The Drip: six stores on a pink-dusk street. Scroll or drag to stroll, the store in front lights up, tap to walk in. */
export default function DripWorld({ stores, pos, focus, onFocus, onEnter, reducedMotion }: { stores: WorldStore[]; pos: RefObject<number>; focus: number; onFocus: (i: number) => void; onEnter: (id: string) => void; reducedMotion: boolean }) {
  const [hover, setHover] = useState<number | null>(null)
  return (
    <Canvas dpr={[1, 1.75]} camera={{ fov: 48, position: [0, 2.3, 8.6], near: 0.1, far: 80 }} aria-label="The Drip: six stores on a street. Scroll to walk, tap a store to enter." role="img">
      <color attach="background" args={['#FFD3E4']} />
      <fog attach="fog" args={['#FFD3E4', 14, 34]} />
      <hemisphereLight args={['#FFF1F6', '#6B4A5E', 0.9]} />
      <directionalLight position={[-6, 9, 8]} intensity={1.3} color="#FFE1C2" />
      <Street count={stores.length} />
      {stores.map((s, i) => (
        <StoreNode key={s.id} store={s} index={i} lit={i === focus || i === hover} still={reducedMotion} onEnter={onEnter} onHover={setHover} />
      ))}
      <CameraRig pos={pos} count={stores.length} onFocus={onFocus} />
    </Canvas>
  )
}
