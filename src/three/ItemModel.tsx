import { RoundedBox } from '@react-three/drei'
import { useMemo, type ReactNode } from 'react'
import { DoubleSide } from 'three'
import type { CatalogItem } from '../shared/types'
import { isChunky } from './doll/Clothes'
import { patternTexture } from './textures'

/**
 * Small standalone 3D models of shop pieces, for the fitting-room carousel.
 * Each sits roughly in a 1×1×1 box centred on the origin. Subtle, slightly
 * realistic: soft fabric, glossy leather, real metal on buckles and chains.
 */

function Fabric({ item, rough = 0.82, tone = 0 }: { item: CatalogItem; rough?: number; tone?: 0 | 1 }) {
  const map = tone === 0 ? patternTexture(item.pattern, item.colors[0], item.colors[1]) : null
  const satin = item.pattern === 'sequin' || ['corset', 'bralette', 'robe', 'mini-dress'].includes(item.template)
  return <meshPhysicalMaterial color={map ? '#FFFFFF' : item.colors[tone]} map={map} roughness={satin ? 0.38 : rough} sheen={0.6} sheenColor="#FFFFFF" side={DoubleSide} />
}
function Leather({ color, gloss = 0.3 }: { color: string; gloss?: number }) {
  return <meshPhysicalMaterial color={color} roughness={gloss} clearcoat={0.7} clearcoatRoughness={0.3} />
}
function Metal({ color = '#D4AF37' }: { color?: string }) {
  return <meshStandardMaterial color={color} metalness={1} roughness={0.22} />
}
const metalOf = (item: CatalogItem) => (['#FFFFFF', '#F5F0E6', '#E9E2DC'].includes(item.colors[1]) ? '#D4AF37' : item.colors[0] === '#C7CAD1' ? '#C7CAD1' : '#D4AF37')

function Top({ item }: { item: CatalogItem }) {
  const t = item.template
  const sleeveless = t === 'tank' || t === 'corset'
  const crop = t === 'crop'
  const outer = ['jacket', 'blazer', 'puffer', 'hoodie', 'robe'].includes(t)
  const h = crop ? 0.55 : t === 'robe' ? 1.15 : 0.92
  const w = t === 'puffer' ? 0.92 : outer ? 0.84 : 0.76
  if (t === 'bralette') {
    return (
      <group position={[0, 0.05, 0]}>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 0.19, 0, 0]} rotation={[0, 0, s * -0.15]} scale={[1, 1, 0.75]}>
            <sphereGeometry args={[0.2, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <Fabric item={item} />
          </mesh>
        ))}
        <mesh position={[0, -0.03, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[1.4, 0.55, 1]}>
          <torusGeometry args={[0.3, 0.025, 8, 40]} />
          <Fabric item={item} tone={1} />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={`st${s}`} position={[s * 0.2, 0.25, -0.02]} rotation={[0, 0, s * 0.2]}>
            <cylinderGeometry args={[0.008, 0.008, 0.4, 6]} />
            <Fabric item={item} tone={1} />
          </mesh>
        ))}
      </group>
    )
  }
  if (t === 'corset') {
    return (
      <group>
        <mesh position={[0, 0.18, 0]}>
          <cylinderGeometry args={[0.36, 0.26, 0.42, 28, 1, true]} />
          <Fabric item={item} />
        </mesh>
        <mesh position={[0, -0.2, 0]}>
          <cylinderGeometry args={[0.26, 0.34, 0.36, 28, 1, true]} />
          <Fabric item={item} />
        </mesh>
        {[-0.12, 0, 0.12].map((x) => (
          <mesh key={x} position={[x, 0, 0.3]}>
            <boxGeometry args={[0.01, 0.76, 0.01]} />
            <meshStandardMaterial color={item.colors[1]} />
          </mesh>
        ))}
      </group>
    )
  }
  return (
    <group position={[0, crop ? 0.15 : 0, 0]}>
      <RoundedBox args={[w, h, 0.26]} radius={0.08} smoothness={3}>
        <Fabric item={item} />
      </RoundedBox>
      {!sleeveless &&
        [-1, 1].map((s) => (
          <RoundedBox key={s} args={[0.42, 0.24, 0.22]} radius={0.08} position={[s * (w / 2 + 0.12), h / 2 - 0.16, 0]} rotation={[0, 0, s * -0.55]}>
            <Fabric item={item} />
          </RoundedBox>
        ))}
      {/* neckline */}
      <mesh position={[0, h / 2 - 0.01, 0.02]} rotation={[Math.PI / 2, 0, 0]} scale={[1.2, 1, 0.7]}>
        <torusGeometry args={[0.11, 0.025, 8, 24, Math.PI]} />
        <Fabric item={item} tone={1} />
      </mesh>
      {(t === 'shirt' || t === 'blazer' || t === 'jacket') &&
        [-1, 1].map((s) => (
          <mesh key={`c${s}`} position={[s * 0.08, h / 2 - 0.08, 0.14]} rotation={[0.2, 0, s * 0.5]}>
            <boxGeometry args={[0.1, 0.18, 0.02]} />
            <Fabric item={item} tone={t === 'blazer' ? 1 : 0} />
          </mesh>
        ))}
      {(t === 'shirt' || t === 'jacket' || t === 'blazer') &&
        [0.18, 0, -0.18].map((y) => (
          <mesh key={y} position={[0, y, 0.135]}>
            <sphereGeometry args={[0.018, 8, 8]} />
            <Metal color={t === 'shirt' ? '#F4F0EA' : '#D4AF37'} />
          </mesh>
        ))}
      {t === 'hoodie' && (
        <>
          <mesh position={[0, h / 2 + 0.05, -0.06]} rotation={[0.4, 0, 0]} scale={[1, 0.9, 0.8]}>
            <sphereGeometry args={[0.2, 20, 14, 0, Math.PI * 2, 0, Math.PI / 1.7]} />
            <Fabric item={item} />
          </mesh>
          <RoundedBox args={[0.44, 0.16, 0.04]} radius={0.04} position={[0, -h / 2 + 0.2, 0.13]}>
            <Fabric item={item} tone={1} />
          </RoundedBox>
        </>
      )}
      {t === 'puffer' &&
        [-0.25, 0, 0.25].map((y) => (
          <mesh key={y} position={[0, y, 0]} rotation={[0, 0, Math.PI / 2]} scale={[1, 1, 0.42]}>
            <capsuleGeometry args={[0.1, w - 0.15, 4, 12]} />
            <Fabric item={item} />
          </mesh>
        ))}
      {t === 'robe' && (
        <mesh position={[0, -0.05, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[1.55, 0.55, 1]}>
          <torusGeometry args={[0.28, 0.025, 8, 40]} />
          <Fabric item={item} tone={1} />
        </mesh>
      )}
      {(t === 'tee' || t === 'crop') && item.pattern === 'solid' && (
        <mesh position={[0, 0.06, 0.135]}>
          <circleGeometry args={[0.1, 24]} />
          <meshStandardMaterial color={item.colors[1]} roughness={0.8} />
        </mesh>
      )}
    </group>
  )
}

function Dress({ item }: { item: CatalogItem }) {
  const t = item.template
  const len = t === 'mini-dress' ? 0.45 : t === 'midi-dress' || t === 'jumpsuit' ? 0.75 : 1.05
  const flare = t === 'gown' ? 0.55 : t === 'kaftan' || t === 'boubou' ? 0.45 : 0.36
  if (t === 'one-piece') {
    return (
      <group>
        <RoundedBox args={[0.56, 0.7, 0.24]} radius={0.1} smoothness={3} position={[0, 0.12, 0]}>
          <Fabric item={item} />
        </RoundedBox>
        <mesh position={[0, -0.3, 0]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.28, 0.24, 3]} />
          <Fabric item={item} />
        </mesh>
      </group>
    )
  }
  return (
    <group position={[0, 0.25, 0]}>
      <RoundedBox args={[0.46, 0.4, 0.22]} radius={0.08} smoothness={3} position={[0, 0.05, 0]}>
        <Fabric item={item} />
      </RoundedBox>
      <mesh position={[0, -0.15 - len / 2, 0]}>
        <cylinderGeometry args={[0.22, flare, len, 32, 1, true]} />
        <Fabric item={item} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.13, 0.32, 0]}>
          <cylinderGeometry args={[0.012, 0.012, 0.16, 6]} />
          <Fabric item={item} />
        </mesh>
      ))}
    </group>
  )
}

function Bottom({ item }: { item: CatalogItem }) {
  const short = item.template === 'shorts'
  const len = short ? 0.28 : 0.95
  return (
    <group position={[0, short ? 0.1 : 0.4, 0]}>
      <RoundedBox args={[0.62, 0.14, 0.26]} radius={0.06}>
        <Fabric item={item} />
      </RoundedBox>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.16, -len / 2 - 0.05, 0]} rotation={[0, 0, s * 0.05]}>
          <cylinderGeometry args={[0.15, short ? 0.17 : 0.12, len, 20]} />
          <Fabric item={item} />
        </mesh>
      ))}
    </group>
  )
}

function Shoe({ item }: { item: CatalogItem }) {
  const t = item.template
  const [c1, c2] = item.colors
  const one = (x: number, k: number) => {
    if (t === 'heels')
      return (
        <group key={k} position={[x, 0, 0]}>
          <mesh position={[0, 0.12, 0.12]} rotation={[0.55, 0, 0]} scale={[1, 0.35, 1]}>
            <sphereGeometry args={[0.15, 20, 12]} />
            <Leather color={c1} gloss={0.15} />
          </mesh>
          <mesh position={[0, 0.15, -0.16]}>
            <cylinderGeometry args={[0.02, 0.012, 0.3, 10]} />
            <Leather color={c1} gloss={0.15} />
          </mesh>
          <mesh position={[0, 0.3, -0.14]} rotation={[-0.4, 0, 0]} scale={[1, 0.5, 1]}>
            <sphereGeometry args={[0.1, 16, 10]} />
            <Leather color={c1} gloss={0.15} />
          </mesh>
        </group>
      )
    if (t === 'boots')
      return (
        <group key={k} position={[x, 0, 0]}>
          <RoundedBox args={[0.2, 0.12, 0.42]} radius={0.05} position={[0, 0.06, 0.05]}>
            <Leather color={c1} />
          </RoundedBox>
          <mesh position={[0, 0.32, -0.06]}>
            <cylinderGeometry args={[0.1, 0.11, 0.48, 16]} />
            <Leather color={c1} />
          </mesh>
        </group>
      )
    const chunky = isChunky(item)
    const sole = chunky ? 0.13 : t === 'sandals' ? 0.04 : 0.05
    return (
      <group key={k} position={[x, 0, 0]}>
        {chunky ? (
          [0, 1, 2].map((j) => (
            <RoundedBox key={j} args={[0.24 - j * 0.01, 0.045, 0.48 - j * 0.015]} radius={0.02} position={[0, 0.022 + j * 0.043, 0]}>
              <meshStandardMaterial color={j === 1 ? c2 : '#F4F0EA'} roughness={0.7} />
            </RoundedBox>
          ))
        ) : (
          <RoundedBox args={[0.21, sole, 0.44]} radius={0.02} position={[0, sole / 2, 0]}>
            <meshStandardMaterial color={t === 'loafers' ? '#3B2219' : '#F4F0EA'} roughness={0.7} />
          </RoundedBox>
        )}
        {t === 'sandals' ? (
          [0.08, -0.05].map((z) => (
            <mesh key={z} position={[0, sole + 0.03, z]} rotation={[0, 0, Math.PI / 2]}>
              <torusGeometry args={[0.09, 0.02, 8, 16, Math.PI]} />
              <Leather color={c1} />
            </mesh>
          ))
        ) : (
          <>
            <mesh position={[0, sole + 0.07, -0.02]} scale={[1, 0.62, 1.7]}>
              <sphereGeometry args={[0.12, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2]} />
              {t === 'loafers' ? <Leather color={c1} gloss={0.2} /> : <meshPhysicalMaterial color={c1} roughness={0.6} sheen={0.3} />}
            </mesh>
            {t === 'sneakers' && (
              <mesh position={[0.11, sole + 0.05, -0.02]} rotation={[0, Math.PI / 2, 0.15]}>
                <planeGeometry args={[0.22, 0.05]} />
                <meshStandardMaterial color={c2} side={DoubleSide} />
              </mesh>
            )}
          </>
        )}
      </group>
    )
  }
  return (
    <group position={[0, -0.55, 0]} rotation={[0.15, -0.5, 0]} scale={1.5}>
      {one(-0.14, 0)}
      {one(0.14, 1)}
    </group>
  )
}

function Belt({ item }: { item: CatalogItem }) {
  return (
    <group rotation={[0.45, 0, 0]}>
      <mesh rotation={[Math.PI / 2, 0, 0]} scale={[1.25, 1, 1]}>
        <torusGeometry args={[0.36, 0.035, 10, 48]} />
        <Leather color={item.colors[0]} />
      </mesh>
      <mesh position={[0, 0, 0.37]} rotation={[0, 0, 0]}>
        <boxGeometry args={[0.16, 0.11, 0.025]} />
        <Metal color={metalOf(item)} />
      </mesh>
      <mesh position={[0, 0, 0.385]}>
        <boxGeometry args={[0.1, 0.06, 0.02]} />
        <Leather color={item.colors[0]} />
      </mesh>
    </group>
  )
}

function Hat({ item }: { item: CatalogItem }) {
  const t = item.template
  if (t === 'bucket-hat')
    return (
      <group>
        <mesh position={[0, 0.12, 0]}>
          <cylinderGeometry args={[0.28, 0.33, 0.3, 28]} />
          <Fabric item={item} />
        </mesh>
        <mesh position={[0, -0.04, 0]} rotation={[0.1, 0, 0]}>
          <cylinderGeometry args={[0.33, 0.5, 0.06, 32, 1, true]} />
          <Fabric item={item} />
        </mesh>
      </group>
    )
  if (t === 'beret')
    return (
      <mesh scale={[1, 0.4, 1]}>
        <sphereGeometry args={[0.42, 28, 18]} />
        <Fabric item={item} />
      </mesh>
    )
  if (t === 'headwrap' || t === 'gele')
    return (
      <group>
        {[0, 1, 2].map((k) => (
          <mesh key={k} position={[0, k * 0.1 - 0.1, 0]} rotation={[Math.PI / 2 + 0.2 * (k - 1), k * 0.6, 0]}>
            <torusGeometry args={[0.3 - k * 0.04, 0.08, 10, 28]} />
            <Fabric item={item} />
          </mesh>
        ))}
      </group>
    )
  // cap / beanie
  return (
    <group rotation={[0.2, -0.6, 0]}>
      <mesh>
        <sphereGeometry args={[0.36, 28, 18, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <Fabric item={item} />
      </mesh>
      <mesh position={[0, 0.005, 0.38]} rotation={[-0.15, 0, 0]} scale={[1, 1, 0.75]}>
        <cylinderGeometry args={[0.3, 0.3, 0.02, 28, 1, false, -Math.PI / 2, Math.PI]} />
        <Fabric item={item} tone={1} />
      </mesh>
      <mesh position={[0, 0.36, 0]}>
        <sphereGeometry args={[0.03, 10, 10]} />
        <Fabric item={item} tone={1} />
      </mesh>
    </group>
  )
}

function Bag({ item }: { item: CatalogItem }) {
  const t = item.template
  const [c1, c2] = item.colors
  if (t === 'clutch')
    return (
      <group rotation={[0.2, -0.4, 0]}>
        <RoundedBox args={[0.7, 0.38, 0.12]} radius={0.05} smoothness={3}>
          {item.pattern === 'solid' ? <Leather color={c1} gloss={0.2} /> : <Fabric item={item} rough={0.4} />}
        </RoundedBox>
        <mesh position={[0, 0.06, 0.065]} rotation={[0.3, 0, 0]}>
          <planeGeometry args={[0.7, 0.26]} />
          <Leather color={c1} gloss={0.2} />
        </mesh>
        <mesh position={[0, -0.02, 0.1]}>
          <boxGeometry args={[0.09, 0.05, 0.02]} />
          <Metal color={metalOf(item)} />
        </mesh>
      </group>
    )
  if (t === 'backpack')
    return (
      <group rotation={[0, -0.5, 0]}>
        <RoundedBox args={[0.6, 0.78, 0.3]} radius={0.14} smoothness={3}>
          <Fabric item={item} />
        </RoundedBox>
        <RoundedBox args={[0.42, 0.26, 0.1]} radius={0.06} position={[0, -0.16, 0.17]}>
          <Fabric item={item} tone={1} />
        </RoundedBox>
        <mesh position={[0, 0.42, 0]} rotation={[0, 0, 0]}>
          <torusGeometry args={[0.1, 0.02, 8, 16, Math.PI]} />
          <Leather color={c2} />
        </mesh>
      </group>
    )
  // tote
  return (
    <group rotation={[0.1, -0.45, 0]}>
      <mesh position={[0, -0.1, 0]}>
        <cylinderGeometry args={[0.36, 0.3, 0.62, 4, 1]} />
        {item.pattern === 'solid' ? <Leather color={c1} /> : <Fabric item={item} rough={0.5} />}
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[0, 0.22, s * 0.08]} rotation={[0, Math.PI / 4, 0]}>
          <torusGeometry args={[0.17, 0.018, 8, 20, Math.PI]} />
          <Leather color={c2 === '#FFFFFF' ? c1 : c2} />
        </mesh>
      ))}
    </group>
  )
}

function Chain({ item }: { item: CatalogItem }) {
  const links = useMemo(() => {
    const out: { p: [number, number, number]; r: number }[] = []
    const n = 22
    for (let i = 0; i < n; i++) {
      const a = Math.PI * 0.15 + (i / (n - 1)) * Math.PI * 0.7
      out.push({ p: [Math.cos(a) * 0.42, -Math.sin(a) * 0.5 + 0.25, 0], r: a })
    }
    return out
  }, [])
  const color = item.colors[0] === '#C7CAD1' || item.colors[1] === '#C7CAD1' ? '#C7CAD1' : '#D4AF37'
  return (
    <group rotation={[0.3, 0, 0]}>
      {links.map((l, i) => (
        <mesh key={i} position={l.p} rotation={[i % 2 ? Math.PI / 2 : 0, 0, l.r + Math.PI / 2]}>
          <torusGeometry args={[0.035, 0.012, 8, 14]} />
          <Metal color={color} />
        </mesh>
      ))}
      {item.template === 'pendant' && (
        <mesh position={[0, -0.36, 0]}>
          <octahedronGeometry args={[0.08]} />
          <meshPhysicalMaterial color={item.colors[1]} roughness={0.05} clearcoat={1} metalness={0.2} />
        </mesh>
      )}
    </group>
  )
}

function Eyewear({ item }: { item: CatalogItem }) {
  return (
    <group rotation={[0.1, -0.35, 0]}>
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 0.22, 0, 0]}>
          <mesh>
            <torusGeometry args={[0.15, 0.022, 8, 28]} />
            <Leather color={item.colors[0]} gloss={0.15} />
          </mesh>
          <mesh>
            <circleGeometry args={[0.14, 28]} />
            <meshPhysicalMaterial color={item.template === 'sunglasses' ? '#1A1A1A' : '#DDEEFF'} transparent opacity={item.template === 'sunglasses' ? 0.85 : 0.25} roughness={0.05} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 0.03, 0]}>
        <boxGeometry args={[0.14, 0.025, 0.02]} />
        <Leather color={item.colors[0]} />
      </mesh>
    </group>
  )
}

/** Any wearable piece as a little 3D model. */
export function ItemModel({ item }: { item: CatalogItem }): ReactNode {
  switch (item.slot) {
    case 'top':
    case 'outerwear':
      return <Top item={item} />
    case 'dress':
    case 'swimwear':
      return <Dress item={item} />
    case 'bottom':
      return <Bottom item={item} />
    case 'shoes':
      return <Shoe item={item} />
    case 'belt':
      return <Belt item={item} />
    case 'headwear':
      return <Hat item={item} />
    case 'bag':
      return <Bag item={item} />
    case 'necklace':
      return <Chain item={item} />
    case 'eyewear':
      return <Eyewear item={item} />
    default:
      return (
        <mesh>
          <torusGeometry args={[0.25, 0.05, 10, 28]} />
          <Metal />
        </mesh>
      )
  }
}
