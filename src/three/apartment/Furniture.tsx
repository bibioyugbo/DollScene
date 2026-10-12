import { RoundedBox, useGLTF } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { Suspense, useMemo, type ReactNode } from 'react'
import { CanvasTexture, DoubleSide, SRGBColorSpace } from 'three'
import { WALL_HEIGHT } from '../../shared/apartment'
import type { CatalogItem } from '../../shared/types'
import { ErrorBoundary } from '../ErrorBoundary'
import { DRACO_PATH, extendLoader, useModelManifest } from '../models'
import { patternTexture } from '../textures'

type V3 = [number, number, number]

function Fabric({ item, tone = 0 }: { item: CatalogItem; tone?: 0 | 1 }) {
  const map = tone === 0 ? patternTexture(item.pattern, item.colors[0], item.colors[1]) : null
  return <meshPhysicalMaterial color={map ? '#fff' : item.colors[tone]} map={map} roughness={0.8} sheen={0.6} sheenColor="#fff" />
}
function Solid({ color, rough = 0.5, metal = 0, emissive }: { color: string; rough?: number; metal?: number; emissive?: string }) {
  return <meshStandardMaterial color={color} roughness={rough} metalness={metal} emissive={emissive ?? '#000'} emissiveIntensity={emissive ? 1.6 : 0} />
}
const B = ({ args, pos, children, r = 0.02 }: { args: V3; pos: V3; children: ReactNode; r?: number }) => (
  <RoundedBox args={args} radius={Math.min(r, ...args.map((a) => a / 2 - 0.001))} position={pos} smoothness={2}>
    {children}
  </RoundedBox>
)
const Leg = ({ pos, h, c = '#3B2219', r = 0.025 }: { pos: [number, number]; h: number; c?: string; r?: number }) => (
  <mesh position={[pos[0], h / 2, pos[1]]}>
    <cylinderGeometry args={[r, r * 0.8, h, 8]} />
    <Solid color={c} />
  </mesh>
)

/** Procedural furniture by template. Origin at floor centre (wall items: centre of the back face). */
export function ProceduralFurniture({ item }: { item: CatalogItem }) {
  const f = item.furniture!
  const { w, d, h } = f
  const [c1, c2] = item.colors
  const wood = '#8C5A3C'
  switch (f.template) {
    case 'sleeping-mat':
      return (
        <B args={[w, h, d]} pos={[0, h / 2, 0]} r={0.03}>
          <Fabric item={item} />
        </B>
      )
    case 'bed-single':
    case 'bed-double':
      return (
        <group>
          <B args={[w, 0.3, d]} pos={[0, 0.15, 0]}>
            <Solid color={wood} />
          </B>
          <B args={[w - 0.06, 0.22, d - 0.1]} pos={[0, 0.4, 0.03]} r={0.06}>
            <Solid color="#FBF7F4" rough={0.9} />
          </B>
          <B args={[w - 0.04, 0.1, d * 0.62]} pos={[0, 0.53, d * 0.18]} r={0.04}>
            <Fabric item={item} />
          </B>
          <B args={[w, 0.9, 0.08]} pos={[0, 0.45, -d / 2 + 0.04]}>
            <Fabric item={item} tone={1} />
          </B>
          {(f.template === 'bed-double' ? [-w / 4, w / 4] : [0]).map((x) => (
            <B key={x} args={[f.template === 'bed-double' ? w / 2.6 : w * 0.7, 0.12, 0.3]} pos={[x, 0.58, -d / 2 + 0.28]} r={0.05}>
              <Solid color="#FFFFFF" rough={0.9} />
            </B>
          ))}
        </group>
      )
    case 'sofa':
    case 'loveseat':
    case 'armchair':
      return (
        <group>
          <B args={[w, 0.4, d]} pos={[0, 0.2, 0]} r={0.06}>
            <Fabric item={item} />
          </B>
          <B args={[w, 0.5, 0.2]} pos={[0, 0.62, -d / 2 + 0.1]} r={0.08}>
            <Fabric item={item} />
          </B>
          {[-1, 1].map((s) => (
            <B key={s} args={[0.16, 0.55, d]} pos={[s * (w / 2 - 0.08), 0.3, 0]} r={0.06}>
              <Fabric item={item} />
            </B>
          ))}
          {f.template !== 'armchair' &&
            [-0.25, 0.25].map((x) => (
              <B key={x} args={[0.32, 0.3, 0.1]} pos={[x * w, 0.6, -d / 2 + 0.24]} r={0.05}>
                <Solid color={c2} rough={0.9} />
              </B>
            ))}
        </group>
      )
    case 'beanbag':
      return (
        <mesh position={[0, 0.25, 0]} scale={[1, 0.65, 1]}>
          <sphereGeometry args={[w / 2, 24, 16]} />
          <Fabric item={item} />
        </mesh>
      )
    case 'coffee-table':
    case 'side-table':
    case 'dining-table':
    case 'desk':
      return (
        <group>
          <B args={[w, 0.05, d]} pos={[0, h - 0.025, 0]} r={0.015}>
            <Solid color={c1} rough={0.3} />
          </B>
          {[
            [-1, -1],
            [1, -1],
            [-1, 1],
            [1, 1],
          ].map(([x, z]) => (
            <Leg key={`${x}${z}`} pos={[x * (w / 2 - 0.06), z * (d / 2 - 0.06)]} h={h - 0.05} c={c2} />
          ))}
          {f.template === 'desk' && (
            <group>
              <B args={[0.5, 0.32, 0.03]} pos={[0, h + 0.2, -d / 4]}>
                <Solid color="#1E1B22" rough={0.2} />
              </B>
              <mesh position={[0, h + 0.2, -d / 4 + 0.017]}>
                <planeGeometry args={[0.46, 0.28]} />
                <Solid color="#5B8CFF" emissive="#3A5BD0" />
              </mesh>
            </group>
          )}
        </group>
      )
    case 'chair':
    case 'stool':
      return (
        <group>
          <B args={[w, 0.05, d]} pos={[0, f.template === 'stool' ? h : 0.46, 0]}>
            <Fabric item={item} />
          </B>
          {[
            [-1, -1],
            [1, -1],
            [-1, 1],
            [1, 1],
          ].map(([x, z]) => (
            <Leg key={`${x}${z}`} pos={[x * (w / 2 - 0.05), z * (d / 2 - 0.05)]} h={f.template === 'stool' ? h : 0.46} c={c2} r={0.018} />
          ))}
          {f.template === 'chair' && (
            <B args={[w, 0.45, 0.04]} pos={[0, 0.7, -d / 2 + 0.02]}>
              <Fabric item={item} />
            </B>
          )}
        </group>
      )
    case 'bookshelf':
      return (
        <group>
          <B args={[w, h, d]} pos={[0, h / 2, 0]} r={0.01}>
            <Solid color={c1} />
          </B>
          {[0.3, 0.75, 1.2].map((y, i) => (
            <group key={y}>
              {Array.from({ length: 6 }, (_, k) => (
                <mesh key={k} position={[-w / 2 + 0.1 + k * 0.12, y + 0.14, 0.03]}>
                  <boxGeometry args={[0.07, 0.24 + ((k + i) % 3) * 0.03, d * 0.7]} />
                  <Solid color={['#FF3D8B', '#A86BFF', '#FFC24D', '#00A88F', '#3D7BFF', '#E8505B'][(k + i) % 6]} />
                </mesh>
              ))}
            </group>
          ))}
        </group>
      )
    case 'tv-stand':
      return (
        <group>
          <B args={[w, 0.45, d]} pos={[0, 0.225, 0]}>
            <Solid color={c1} />
          </B>
          <B args={[w * 0.75, 0.62, 0.05]} pos={[0, 0.8, -0.05]} r={0.01}>
            <Solid color="#141218" rough={0.15} />
          </B>
          <mesh position={[0, 0.8, -0.022]}>
            <planeGeometry args={[w * 0.72, 0.58]} />
            <Solid color="#FF8FBF" emissive="#A86BFF" />
          </mesh>
        </group>
      )
    case 'wardrobe':
    case 'dresser':
      return (
        <group>
          <B args={[w, h, d]} pos={[0, h / 2, 0]} r={0.02}>
            <Solid color={c1} />
          </B>
          {(f.template === 'wardrobe' ? [-0.04, 0.04] : [-w / 4, w / 4]).map((x) => (
            <mesh key={x} position={[x, f.template === 'wardrobe' ? h / 2 : h * 0.6, d / 2 + 0.01]}>
              <cylinderGeometry args={[0.012, 0.012, 0.12, 8]} />
              <Solid color="#D9B24C" metal={1} rough={0.2} />
            </mesh>
          ))}
          {f.template === 'wardrobe' && (
            <mesh position={[0, h / 2, d / 2 + 0.002]}>
              <planeGeometry args={[0.01, h - 0.08]} />
              <Solid color="#00000033" />
            </mesh>
          )}
        </group>
      )
    case 'clothes-rack':
      return (
        <group>
          {[-1, 1].map((s) => (
            <Leg key={s} pos={[s * (w / 2 - 0.03), 0]} h={h} c="#D9B24C" r={0.015} />
          ))}
          <mesh position={[0, h - 0.02, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.015, 0.015, w, 8]} />
            <Solid color="#D9B24C" metal={1} rough={0.2} />
          </mesh>
          {Array.from({ length: 6 }, (_, i) => (
            <B key={i} args={[0.04, 0.7, 0.36]} pos={[-w / 2 + 0.15 + i * 0.17, h - 0.42, 0]} r={0.015}>
              <Solid color={['#FF3D8B', '#FFFFFF', '#A86BFF', '#FFC24D', '#2B2B2B', '#7CF0CF'][i]} rough={0.8} />
            </B>
          ))}
        </group>
      )
    case 'vanity':
      return (
        <group>
          <B args={[w, 0.75, d]} pos={[0, 0.375, 0]}>
            <Solid color={c1} />
          </B>
          <B args={[w * 0.8, 0.7, 0.04]} pos={[0, 1.15, -d / 2 + 0.05]} r={0.01}>
            <Solid color={c2} metal={0.6} rough={0.2} />
          </B>
          <mesh position={[0, 1.15, -d / 2 + 0.072]}>
            <planeGeometry args={[w * 0.72, 0.62]} />
            <meshStandardMaterial color="#DDE6F0" metalness={0.25} roughness={0.12} emissive="#8EA4BF" emissiveIntensity={0.25} />
          </mesh>
          {Array.from({ length: 8 }, (_, i) => {
            const a = (i / 7) * Math.PI
            return (
              <mesh key={i} position={[Math.cos(a) * w * 0.42, 1.15 + Math.sin(a) * 0.38 - 0.05, -d / 2 + 0.08]}>
                <sphereGeometry args={[0.025, 10, 8]} />
                <Solid color="#FFF6E0" emissive="#FFF0C8" />
              </mesh>
            )
          })}
        </group>
      )
    case 'mirror-floor':
    case 'wall-mirror':
      return (
        <group position={f.mount === 'wall' ? [0, 0, d / 2] : [0, h / 2, 0]}>
          <B args={[w, h, 0.04]} pos={[0, 0, 0]} r={0.02}>
            <Solid color={c1} metal={0.8} rough={0.25} />
          </B>
          <mesh position={[0, 0, 0.022]}>
            <planeGeometry args={[w - 0.08, h - 0.08]} />
            <meshStandardMaterial color="#DDE6F0" metalness={0.25} roughness={0.12} emissive="#8EA4BF" emissiveIntensity={0.25} />
          </mesh>
        </group>
      )
    case 'floor-lamp':
    case 'table-lamp':
      return (
        <group>
          <mesh position={[0, 0.02, 0]}>
            <cylinderGeometry args={[w * 0.4, w * 0.45, 0.04, 20]} />
            <Solid color={c2} metal={0.5} />
          </mesh>
          <mesh position={[0, h * 0.45, 0]}>
            <cylinderGeometry args={[0.012, 0.012, h * 0.85, 8]} />
            <Solid color={c2} metal={0.5} />
          </mesh>
          <mesh position={[0, h * 0.9, 0]}>
            <cylinderGeometry args={[w * 0.3, w * 0.48, h * 0.22, 20, 1, true]} />
            <meshStandardMaterial color={c1} emissive={c1} emissiveIntensity={0.6} side={DoubleSide} />
          </mesh>
          <pointLight position={[0, h * 0.85, 0]} intensity={1.6} distance={3.5} color="#FFE2B8" />
        </group>
      )
    case 'neon-sign':
      return (
        <group position={[0, 0, d / 2]}>
          <B args={[w, h, 0.03]} pos={[0, 0, 0]} r={0.02}>
            <meshStandardMaterial color="#1E0B26" transparent opacity={0.5} />
          </B>
          <mesh position={[0, 0, 0.02]}>
            <torusGeometry args={[h * 0.32, 0.018, 8, 40]} />
            <Solid color={c1} emissive={c1} />
          </mesh>
          <mesh position={[0, 0, 0.02]} rotation={[0, 0, Math.PI / 2]}>
            <torusGeometry args={[h * 0.18, 0.014, 8, 40, Math.PI]} />
            <Solid color={c2} emissive={c2} />
          </mesh>
          <pointLight position={[0, 0, 0.3]} intensity={1.4} distance={2.5} color={c1} />
        </group>
      )
    case 'plant-tall':
    case 'plant-small':
      return (
        <group>
          <mesh position={[0, h * 0.14, 0]}>
            <cylinderGeometry args={[w * 0.32, w * 0.26, h * 0.28, 16]} />
            <Solid color={c2 === '#FFFFFF' ? '#E9E2DC' : c2} rough={0.6} />
          </mesh>
          {Array.from({ length: f.template === 'plant-tall' ? 9 : 6 }, (_, i) => {
            const a = i * 2.4
            const y = h * (0.35 + (i / 9) * 0.6)
            return (
              <mesh key={i} position={[Math.cos(a) * w * 0.18, y, Math.sin(a) * w * 0.18]} rotation={[Math.cos(a) * 0.6, a, Math.sin(a) * 0.6]} scale={[1, 0.25, 1.8]}>
                <sphereGeometry args={[w * 0.18, 10, 8]} />
                <Solid color={i % 2 ? '#2E8B57' : '#3CB371'} rough={0.7} />
              </mesh>
            )
          })}
        </group>
      )
    case 'rug-round':
      return (
        <mesh position={[0, 0.006, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[w / 2, 48]} />
          <Fabric item={item} />
        </mesh>
      )
    case 'rug-rect':
      return (
        <mesh position={[0, 0.006, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[w, d]} />
          <Fabric item={item} />
        </mesh>
      )
    case 'art-frame':
      return (
        <group position={[0, 0, d / 2]}>
          <B args={[w, h, 0.04]} pos={[0, 0, 0]} r={0.01}>
            <Solid color="#D9B24C" metal={0.7} rough={0.3} />
          </B>
          <mesh position={[0, 0, 0.022]}>
            <planeGeometry args={[w - 0.1, h - 0.1]} />
            <Fabric item={item} />
          </mesh>
        </group>
      )
    case 'wall-shelf':
      return (
        <group position={[0, 0, d / 2]}>
          <B args={[w, 0.04, d]} pos={[0, -h / 2 + 0.02, 0]}>
            <Solid color={c1} />
          </B>
          <mesh position={[-w / 3, -h / 2 + 0.12, 0]}>
            <cylinderGeometry args={[0.04, 0.05, 0.16, 12]} />
            <Solid color="#FF8FBF" />
          </mesh>
          <mesh position={[w / 4, -h / 2 + 0.1, 0]}>
            <boxGeometry args={[0.18, 0.14, 0.12]} />
            <Solid color="#A86BFF" />
          </mesh>
        </group>
      )
    case 'kitchen-counter':
      return (
        <group>
          <B args={[w, h - 0.04, d]} pos={[0, (h - 0.04) / 2, 0]}>
            <Solid color={c2} />
          </B>
          <B args={[w + 0.02, 0.04, d + 0.02]} pos={[0, h - 0.02, 0]} r={0.01}>
            <Solid color={c1} rough={0.15} />
          </B>
        </group>
      )
    case 'fridge':
      return (
        <group>
          <B args={[w, h, d]} pos={[0, h / 2, 0]} r={0.05}>
            <Solid color={c1} rough={0.25} metal={0.3} />
          </B>
          {[h * 0.75, h * 0.35].map((y) => (
            <mesh key={y} position={[w / 2 - 0.08, y, d / 2 + 0.02]}>
              <boxGeometry args={[0.03, 0.25, 0.03]} />
              <Solid color="#C0C0C0" metal={1} rough={0.2} />
            </mesh>
          ))}
        </group>
      )
    case 'stove':
      return (
        <group>
          <B args={[w, h, d]} pos={[0, h / 2, 0]}>
            <Solid color={c1} rough={0.3} />
          </B>
          {[
            [-1, -1],
            [1, -1],
            [-1, 1],
            [1, 1],
          ].map(([x, z]) => (
            <mesh key={`${x}${z}`} position={[x * w * 0.22, h + 0.005, z * d * 0.22]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.04, 0.08, 20]} />
              <Solid color="#222" />
            </mesh>
          ))}
          <mesh position={[0, h + 0.07, 0]}>
            <cylinderGeometry args={[0.12, 0.11, 0.14, 20]} />
            <Solid color="#E8505B" rough={0.3} />
          </mesh>
        </group>
      )
    case 'bathtub':
      return (
        <group>
          <B args={[w, h, d]} pos={[0, h / 2, 0]} r={0.15}>
            <Solid color={c1 === '#111111' ? '#FFFFFF' : c1} rough={0.15} />
          </B>
          <mesh position={[0, h - 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[w - 0.16, d - 0.16]} />
            <meshPhysicalMaterial color="#9ED8FF" transparent opacity={0.7} roughness={0} transmission={0.4} />
          </mesh>
        </group>
      )
    case 'sink':
      return (
        <group>
          <mesh position={[0, h * 0.4, 0]}>
            <cylinderGeometry args={[0.08, 0.12, h * 0.8, 16]} />
            <Solid color="#FFFFFF" rough={0.2} />
          </mesh>
          <B args={[w, 0.16, d]} pos={[0, h - 0.08, 0]} r={0.06}>
            <Solid color="#FFFFFF" rough={0.2} />
          </B>
        </group>
      )
    case 'speaker':
      return (
        <group>
          <B args={[w, h, d]} pos={[0, h / 2, 0]} r={0.03}>
            <Solid color={c1} rough={0.6} />
          </B>
          {[h * 0.68, h * 0.3].map((y, i) => (
            <mesh key={y} position={[0, y, d / 2 + 0.005]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[i ? 0.12 : 0.07, i ? 0.12 : 0.07, 0.02, 24]} />
              <Solid color="#141218" rough={0.4} />
            </mesh>
          ))}
        </group>
      )
    case 'poster':
      return (
        <group position={[0, 0, 0.012]}>
          <mesh>
            <planeGeometry args={[w, h]} />
            <meshStandardMaterial map={posterTexture(item)} roughness={0.6} />
          </mesh>
          {[-1, 1].map((k) => (
            <mesh key={k} position={[k * (w / 2 - 0.04), h / 2 - 0.04, 0.004]}>
              <sphereGeometry args={[0.012, 8, 8]} />
              <Solid color="#C7CAD1" metal={0.9} />
            </mesh>
          ))}
        </group>
      )
    case 'chandelier': {
      // Hangs from the ceiling above the spot it's placed on.
      const top = WALL_HEIGHT - 0.02
      return (
        <group position={[0, top, 0]}>
          <mesh position={[0, -0.18, 0]}>
            <cylinderGeometry args={[0.008, 0.008, 0.36, 6]} />
            <Solid color={c1} metal={0.9} rough={0.25} />
          </mesh>
          <mesh position={[0, -0.42, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[w * 0.32, 0.018, 8, 40]} />
            <Solid color={c1} metal={0.95} rough={0.2} />
          </mesh>
          {Array.from({ length: 10 }, (_, i) => {
            const a = (i / 10) * Math.PI * 2
            return (
              <group key={i} position={[Math.cos(a) * w * 0.32, -0.42, Math.sin(a) * w * 0.32]}>
                <mesh position={[0, -0.09, 0]}>
                  <octahedronGeometry args={[0.035]} />
                  <meshPhysicalMaterial color={c2} roughness={0.02} transmission={0.6} thickness={0.2} clearcoat={1} />
                </mesh>
                <mesh position={[0, 0.05, 0]}>
                  <sphereGeometry args={[0.025, 10, 10]} />
                  <Solid color="#FFF4DD" emissive="#FFE7B0" />
                </mesh>
              </group>
            )
          })}
          <pointLight position={[0, -0.5, 0]} intensity={2.4} distance={4} color="#FFE7C2" />
        </group>
      )
    }
    case 'plant-hanging': {
      const top = WALL_HEIGHT - 0.02
      return (
        <group position={[0, top, 0]}>
          {[-1, 1, 0].map((k, i) => (
            <mesh key={i} position={[k * 0.06, -0.25, i === 2 ? 0.06 : -0.03]} rotation={[0, 0, k * 0.1]}>
              <cylinderGeometry args={[0.004, 0.004, 0.5, 4]} />
              <Solid color="#C49A6C" />
            </mesh>
          ))}
          <mesh position={[0, -0.55, 0]}>
            <sphereGeometry args={[0.13, 16, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
            <Solid color={c2} rough={0.6} />
          </mesh>
          {Array.from({ length: 14 }, (_, i) => {
            const a = i * 2.1
            const drop = 0.1 + (i % 5) * 0.12
            return (
              <mesh key={i} position={[Math.cos(a) * 0.14, -0.55 - drop, Math.sin(a) * 0.14]} scale={[1, 1.4, 0.4]}>
                <sphereGeometry args={[0.045, 8, 6]} />
                <Solid color={i % 2 ? c1 : '#2E8B57'} rough={0.7} />
              </mesh>
            )
          })}
        </group>
      )
    }
    case 'bouquet':
      return (
        <group>
          <mesh position={[0, h * 0.22, 0]}>
            <cylinderGeometry args={[w * 0.22, w * 0.3, h * 0.44, 16]} />
            <meshPhysicalMaterial color="#E8F4FF" roughness={0.05} transmission={0.7} thickness={0.1} />
          </mesh>
          {Array.from({ length: 9 }, (_, i) => {
            const a = i * 2.4
            const r = i === 0 ? 0 : w * 0.18
            return (
              <group key={i} position={[Math.cos(a) * r, h * 0.72 + (i % 3) * 0.04, Math.sin(a) * r]}>
                <mesh position={[0, -h * 0.2, 0]}>
                  <cylinderGeometry args={[0.005, 0.005, h * 0.4, 4]} />
                  <Solid color="#2E8B57" />
                </mesh>
                <mesh>
                  <sphereGeometry args={[0.05, 12, 10]} />
                  <Solid color={c1} rough={0.6} />
                </mesh>
                <mesh position={[0, 0.02, 0]} scale={[0.6, 0.5, 0.6]}>
                  <sphereGeometry args={[0.05, 10, 8]} />
                  <Solid color={c2} rough={0.6} />
                </mesh>
              </group>
            )
          })}
        </group>
      )
    case 'wine-rack':
      return (
        <group>
          <B args={[w, h, d]} pos={[0, h / 2, 0]} r={0.015}>
            <Solid color={c1} rough={0.7} />
          </B>
          {Array.from({ length: 12 }, (_, i) => (
            <mesh key={i} position={[-w / 2 + 0.1 + (i % 4) * ((w - 0.2) / 3), 0.2 + Math.floor(i / 4) * (h * 0.3), d / 2 - 0.02]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.035, 0.035, 0.08, 12]} />
              <meshPhysicalMaterial color={i % 3 ? c2 : '#1B3B1B'} roughness={0.1} clearcoat={1} />
            </mesh>
          ))}
        </group>
      )
    case 'aquarium':
      return (
        <group>
          <B args={[w, 0.5, d]} pos={[0, 0.25, 0]} r={0.02}>
            <Solid color="#1C1C1C" rough={0.5} />
          </B>
          <mesh position={[0, 0.5 + (h - 0.5) / 2, 0]}>
            <boxGeometry args={[w, h - 0.5, d]} />
            <meshPhysicalMaterial color={c1} roughness={0.05} transmission={0.5} thickness={0.3} transparent opacity={0.55} />
          </mesh>
          {[0, 1, 2, 3].map((i) => (
            <mesh key={i} position={[-w * 0.3 + i * w * 0.2, 0.62 + (i % 2) * 0.16, (i % 2 ? 0.05 : -0.05)]} scale={[1.6, 1, 0.5]}>
              <sphereGeometry args={[0.035, 10, 8]} />
              <Solid color={i % 2 ? c2 : '#FFD95A'} emissive={i % 2 ? c2 : '#FFD95A'} />
            </mesh>
          ))}
          <mesh position={[w * 0.3, 0.6, 0]} scale={[1, 2.4, 1]}>
            <coneGeometry args={[0.04, 0.12, 6]} />
            <Solid color="#2E8B57" />
          </mesh>
          <pointLight position={[0, h, 0]} intensity={0.8} distance={2} color={c1} />
        </group>
      )
    case 'palm':
      return (
        <group>
          <mesh position={[0, 0.15, 0]}>
            <cylinderGeometry args={[w * 0.28, w * 0.22, 0.3, 16]} />
            <Solid color={c2} rough={0.6} />
          </mesh>
          {Array.from({ length: 3 }, (_, i) => (
            <mesh key={i} position={[(i - 1) * 0.05, h * 0.45, 0]} rotation={[0, 0, (i - 1) * 0.1]}>
              <cylinderGeometry args={[0.012, 0.016, h * 0.7, 6]} />
              <Solid color="#6B7F4F" />
            </mesh>
          ))}
          {Array.from({ length: 12 }, (_, i) => {
            const a = (i / 12) * Math.PI * 2
            return (
              <mesh key={i} position={[Math.cos(a) * 0.22, h * 0.82, Math.sin(a) * 0.22]} rotation={[Math.sin(a) * 0.9, -a, Math.cos(a) * 0.9]} scale={[0.25, 0.04, 1]}>
                <sphereGeometry args={[0.28, 8, 6]} />
                <Solid color={c1} rough={0.7} />
              </mesh>
            )
          })}
        </group>
      )
    case 'cactus':
      return (
        <group>
          {[-1, 0, 1].map((k) => (
            <group key={k} position={[k * w * 0.3, 0, 0]}>
              <mesh position={[0, 0.06, 0]}>
                <cylinderGeometry args={[0.07, 0.06, 0.12, 12]} />
                <Solid color={k === 0 ? c2 : '#E9E2DC'} rough={0.6} />
              </mesh>
              <mesh position={[0, 0.12 + (k === 0 ? 0.2 : 0.12), 0]}>
                <capsuleGeometry args={[0.045, k === 0 ? 0.3 : 0.15, 4, 10]} />
                <Solid color={c1} rough={0.8} />
              </mesh>
            </group>
          ))}
        </group>
      )
    case 'pet-cat':
    case 'pet-dog': {
      const dog = f.template === 'pet-dog'
      const fur = <meshStandardMaterial color={c1} roughness={0.9} />
      const s = dog ? 1.15 : 1
      return (
        <group scale={s}>
          {/* curled up on a little cushion */}
          <mesh position={[0, 0.02, 0]} scale={[1, 0.25, 1.25]}>
            <sphereGeometry args={[0.2, 20, 12]} />
            <Solid color={c2 === '#FFFFFF' ? '#FF8CC0' : '#8C5A3C'} rough={0.9} />
          </mesh>
          <mesh position={[0, 0.11, -0.02]} scale={[1, 0.75, 1.35]}>
            <sphereGeometry args={[0.11, 18, 14]} />
            {fur}
          </mesh>
          <mesh position={[0, 0.17, 0.13]}>
            <sphereGeometry args={[dog ? 0.075 : 0.07, 18, 14]} />
            {fur}
          </mesh>
          {dog ? (
            <>
              <mesh position={[0, 0.155, 0.2]} scale={[0.8, 0.7, 1]}>
                <sphereGeometry args={[0.04, 12, 10]} />
                {fur}
              </mesh>
              <mesh position={[0, 0.16, 0.24]}>
                <sphereGeometry args={[0.012, 8, 8]} />
                <Solid color="#1A1012" />
              </mesh>
              {[-1, 1].map((k) => (
                <mesh key={k} position={[k * 0.065, 0.18, 0.11]} rotation={[0, 0, k * 0.3]} scale={[0.5, 1.2, 0.8]}>
                  <sphereGeometry args={[0.04, 10, 8]} />
                  <Solid color={c2} rough={0.9} />
                </mesh>
              ))}
            </>
          ) : (
            [-1, 1].map((k) => (
              <mesh key={k} position={[k * 0.04, 0.24, 0.12]} rotation={[0, 0, -k * 0.25]}>
                <coneGeometry args={[0.022, 0.05, 8]} />
                {fur}
              </mesh>
            ))
          )}
          {[-1, 1].map((k) => (
            <mesh key={`e${k}`} position={[k * 0.028, 0.185, dog ? 0.195 : 0.19]}>
              <sphereGeometry args={[0.009, 8, 8]} />
              <Solid color="#1A1012" />
            </mesh>
          ))}
          {/* tail */}
          <mesh position={[0.08, 0.07, -0.16]} rotation={[0.4, 0.6, 1.2]}>
            <torusGeometry args={[0.06, dog ? 0.016 : 0.013, 8, 16, Math.PI]} />
            {fur}
          </mesh>
        </group>
      )
    }
    default:
      return (
        <B args={[w, h, d]} pos={[0, h / 2, 0]}>
          <Fabric item={item} />
        </B>
      )
  }
}

function GlbFurniture({ url }: { url: string }) {
  const gl = useThree((s) => s.gl)
  const { scene } = useGLTF(url, DRACO_PATH, true, extendLoader(gl))
  const clone = useMemo(() => scene.clone(true), [scene])
  return <primitive object={clone} />
}

/** Real GLB from public/models/furniture/<itemId|template>.glb when present, else procedural. */
export function FurnitureModel({ item }: { item: CatalogItem }) {
  const manifest = useModelManifest()
  const url = manifest?.furniture[item.id] ?? (item.furniture ? manifest?.furniture[item.furniture.template] : undefined)
  const fallback = <ProceduralFurniture item={item} />
  if (!url) return fallback
  return (
    <ErrorBoundary fallback={fallback} resetKey={url}>
      <Suspense fallback={fallback}>
        <GlbFurniture url={url} />
      </Suspense>
    </ErrorBoundary>
  )
}

const posters = new Map<string, CanvasTexture>()
/** Hard-metal posters (black, jagged red) and boyband posters (pastel, five heartthrob silhouettes). */
function posterTexture(item: CatalogItem): CanvasTexture {
  let t = posters.get(item.id)
  if (t) return t
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 360
  const g = c.getContext('2d')!
  const [c1, c2] = item.colors
  if (item.tags.includes('metal')) {
    g.fillStyle = c1
    g.fillRect(0, 0, 256, 360)
    g.fillStyle = c2
    for (let i = 0; i < 9; i++) {
      g.beginPath()
      g.moveTo(i * 30, 360)
      g.lineTo(i * 30 + 15, 250 - (i % 3) * 30)
      g.lineTo(i * 30 + 30, 360)
      g.fill()
    }
    g.fillStyle = '#E9E2DC'
    g.beginPath()
    g.arc(128, 150, 52, 0, Math.PI * 2)
    g.fill()
    g.fillRect(96, 180, 64, 40)
    g.fillStyle = c1
    g.beginPath()
    g.arc(108, 150, 14, 0, Math.PI * 2)
    g.arc(148, 150, 14, 0, Math.PI * 2)
    g.fill()
    g.font = 'italic 900 52px Impact, "Arial Black", sans-serif'
    g.textAlign = 'center'
    g.fillStyle = c2
    g.strokeStyle = '#FFFFFF'
    g.lineWidth = 2
    g.fillText('METAL', 128, 62)
    g.strokeText('METAL', 128, 62)
  } else {
    const grad = g.createLinearGradient(0, 0, 0, 360)
    grad.addColorStop(0, c1)
    grad.addColorStop(1, c2)
    g.fillStyle = grad
    g.fillRect(0, 0, 256, 360)
    for (let i = 0; i < 5; i++) {
      const x = 32 + i * 48
      const y = 190 + (i % 2) * 14
      g.fillStyle = ['#3B2219', '#1B1214', '#7B4A2E', '#2B1B17', '#C9A227'][i]
      g.beginPath()
      g.arc(x, y - 52, 20, 0, Math.PI * 2)
      g.fill()
      g.fillStyle = '#FFFFFF'
      g.fillRect(x - 22, y - 30, 44, 110)
    }
    g.font = '900 54px "Bagel Fat One", "Arial Black", sans-serif'
    g.textAlign = 'center'
    g.fillStyle = '#FFFFFF'
    g.fillText('BOYS ♥', 128, 70)
  }
  t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  posters.set(item.id, t)
  return t
}
