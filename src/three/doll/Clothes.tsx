import { RoundedBox } from '@react-three/drei'
import type { ReactNode } from 'react'
import { DoubleSide } from 'three'
import { getItem } from '../../shared/catalog'
import type { CatalogItem, Outfit, OutfitSlot } from '../../shared/types'
import { patternTexture } from '../textures'
import { headSocket, type Dims } from './dims'
import { Gele } from './Hair'
import { ClothMat } from './materials'

type Items = Partial<Record<OutfitSlot, CatalogItem>>

export function resolveOutfit(outfit: Outfit): Items {
  const items: Items = {}
  for (const [slot, id] of Object.entries(outfit)) {
    const it = getItem(id)
    if (it) items[slot as OutfitSlot] = it
  }
  return items
}

function Mat({ item, double, rough }: { item: CatalogItem; double?: boolean; rough?: number }) {
  const map = patternTexture(item.pattern, item.colors[0], item.colors[1])
  const shiny = item.pattern === 'sequin' || item.template === 'corset'
  return <ClothMat color={item.colors[0]} map={map} double={double} rough={rough ?? (shiny ? 0.35 : 0.72)} sheen={item.pattern === 'aso-oke' ? 0.9 : 0.35} />
}

function Metal({ color }: { color: string }) {
  return <meshStandardMaterial color={color} metalness={0.95} roughness={0.25} />
}

const UNDER = { id: 'under', name: '', brandId: '', category: 'fashion', slot: 'top', template: 'tank', colors: ['#E9D8E8', '#E9D8E8'], pattern: 'solid', rarity: 'common', price: 0, tags: [] } as CatalogItem

/** Torso shell: chest + waist (+ hips) slightly larger than the body. */
function Torso({ item, d, waist = true, hips = false, out = 1.04, cropWaist = false }: { item: CatalogItem; d: Dims; waist?: boolean; hips?: boolean; out?: number; cropWaist?: boolean }) {
  return (
    <group>
      <mesh position={[0, d.chestY, 0]} scale={[d.chestX * out, 0.86 * out, 0.74 * out]}>
        <sphereGeometry args={[0.165, 28, 18]} />
        <Mat item={item} />
      </mesh>
      {d.bust > 0.01 &&
        [-1, 1].map((s) => (
          <mesh key={s} position={[s * 0.058, d.chestY - 0.03, 0.075]}>
            <sphereGeometry args={[d.bust * 1.08, 18, 14]} />
            <Mat item={item} />
          </mesh>
        ))}
      {waist && (
        <mesh position={[0, cropWaist ? d.waistY + 0.06 : d.waistY, 0]} scale={[d.waistX * out, 1, 0.8 * out]}>
          <cylinderGeometry args={[0.137, 0.152, cropWaist ? 0.1 : 0.225, 28]} />
          <Mat item={item} />
        </mesh>
      )}
      {hips && (
        <mesh position={[0, d.hipY, 0]} scale={[d.hipsX * out, 0.72, 0.87 * out]}>
          <sphereGeometry args={[0.162, 28, 18]} />
          <Mat item={item} />
        </mesh>
      )}
    </group>
  )
}

function Skirt({ item, d, length, flare = 1, top }: { item: CatalogItem; d: Dims; length: number; flare?: number; top?: number }) {
  const y0 = top ?? d.hipY + 0.06
  return (
    <mesh position={[0, y0 - length / 2, 0]}>
      <cylinderGeometry args={[0.155 * d.hipsX, (0.2 + length * 0.18) * d.hipsX * flare, length, 32, 1, true]} />
      <Mat item={item} double />
    </mesh>
  )
}

function Trousers({ item, d, length, wide = 1 }: { item: CatalogItem; d: Dims; length: number; wide?: number }) {
  return (
    <group>
      <mesh position={[0, d.hipY, 0]} scale={[d.hipsX * 1.05, 0.73, 0.9]}>
        <sphereGeometry args={[0.162, 28, 18]} />
        <Mat item={item} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * d.legX, d.legY + d.legLen / 2 - length / 2 + 0.06, 0]}>
          <cylinderGeometry args={[d.legR * 1.3, d.legR * 1.18 * wide, length, 16, 1, true]} />
          <Mat item={item} double />
        </mesh>
      ))}
      {item.template === 'cargo' &&
        [-1, 1].map((s) => (
          <mesh key={`pk${s}`} position={[s * (d.legX + d.legR * 1.2), d.legY + 0.08, 0]}>
            <boxGeometry args={[0.02, 0.09, 0.08]} />
            <Mat item={item} />
          </mesh>
        ))}
    </group>
  )
}

/** Big-soled runners: the starter chunky pair and the Balensheega-style ones. */
export const isChunky = (item: CatalogItem) => item.template === 'sneakers' && (item.id.includes('chunky') || item.brandId === 'balensheega')

function Shoes({ item, d }: { item: CatalogItem; d: Dims }) {
  const c = item.colors[0]
  const chunky = isChunky(item)
  const mat = <meshPhysicalMaterial color={c} roughness={item.template === 'heels' || item.template === 'loafers' ? 0.25 : 0.6} clearcoat={item.template === 'heels' ? 1 : 0.2} />
  return (
    <group>
      {[-1, 1].map((s) => {
        const x = s * d.legX
        switch (item.template) {
          case 'boots':
            return (
              <group key={s}>
                <mesh position={[x, 0.17, 0]}>
                  <cylinderGeometry args={[d.legR * 1.22, d.legR * 1.18, 0.3, 16]} />
                  {mat}
                </mesh>
                <RoundedBox args={[0.11, 0.07, 0.19]} radius={0.03} position={[x, 0.035, 0.03]}>
                  {mat}
                </RoundedBox>
              </group>
            )
          case 'heels':
            return (
              <group key={s}>
                <RoundedBox args={[0.085, 0.05, 0.16]} radius={0.022} position={[x, 0.065, 0.035]} rotation={[0.25, 0, 0]}>
                  {mat}
                </RoundedBox>
                <mesh position={[x, 0.03, -0.035]}>
                  <cylinderGeometry args={[0.012, 0.008, 0.07, 8]} />
                  {mat}
                </mesh>
              </group>
            )
          case 'sandals':
            return (
              <group key={s}>
                <RoundedBox args={[0.1, 0.02, 0.2]} radius={0.008} position={[x, 0.01, 0.03]}>
                  {mat}
                </RoundedBox>
                <mesh position={[x, 0.04, 0.06]} rotation={[0, 0, Math.PI / 2]}>
                  <torusGeometry args={[0.035, 0.008, 6, 16, Math.PI]} />
                  {mat}
                </mesh>
              </group>
            )
          case 'loafers':
            return (
              <RoundedBox key={s} args={[0.1, 0.06, 0.2]} radius={0.028} position={[x, 0.03, 0.03]}>
                {mat}
              </RoundedBox>
            )
          default:
            // Chunky "dad" runners: a stacked, flared sole and a bulky upper.
            if (chunky)
              return (
                <group key={s}>
                  <RoundedBox args={[0.125, 0.085, 0.23]} radius={0.04} position={[x, 0.085, 0.03]}>
                    {mat}
                  </RoundedBox>
                  {[0, 1, 2].map((k) => (
                    <RoundedBox key={k} args={[0.14 - k * 0.006, 0.022, 0.25 - k * 0.008]} radius={0.01} position={[x, 0.012 + k * 0.022, 0.03 + k * 0.003]}>
                      <meshStandardMaterial color={k === 1 ? item.colors[1] : '#F4F0EA'} roughness={0.7} />
                    </RoundedBox>
                  ))}
                  <mesh position={[x, 0.11, 0.12]} rotation={[0.5, 0, 0]}>
                    <boxGeometry args={[0.09, 0.012, 0.06]} />
                    <meshStandardMaterial color={item.colors[1]} roughness={0.6} />
                  </mesh>
                </group>
              )
            return (
              <group key={s}>
                <RoundedBox args={[0.11, 0.08, 0.21]} radius={0.035} position={[x, 0.04, 0.03]}>
                  {mat}
                </RoundedBox>
                <mesh position={[x, 0.006, 0.03]}>
                  <boxGeometry args={[0.112, 0.012, 0.212]} />
                  <meshStandardMaterial color={item.colors[1]} />
                </mesh>
              </group>
            )
        }
      })}
    </group>
  )
}

function Headwear({ item, d }: { item: CatalogItem; d: Dims }) {
  const y = d.headY
  switch (item.template) {
    case 'gele':
      return (
        <group position={[0, y, 0]}>
          <Gele color={item.colors[0]} map={patternTexture(item.pattern, item.colors[0], item.colors[1])} />
        </group>
      )
    case 'cap':
      return (
        <group position={[0, y + 0.02, 0]}>
          <mesh rotation={[-0.25, 0, 0]}>
            <sphereGeometry args={[0.175, 28, 14, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
            <Mat item={item} />
          </mesh>
          <mesh position={[0, 0.0, 0.16]} rotation={[0.15, 0, 0]} scale={[1, 0.08, 1]}>
            <cylinderGeometry args={[0.1, 0.1, 0.1, 24, 1, false, -Math.PI / 2, Math.PI]} />
            <Mat item={item} />
          </mesh>
        </group>
      )
    case 'beret':
      return (
        <mesh position={[0.02, y + 0.12, -0.01]} rotation={[0, 0, 0.25]} scale={[1.15, 0.38, 1.1]}>
          <sphereGeometry args={[0.17, 24, 14]} />
          <Mat item={item} />
        </mesh>
      )
    case 'bucket-hat':
      return (
        <group position={[0, y + 0.1, 0]}>
          <mesh>
            <cylinderGeometry args={[0.14, 0.17, 0.12, 24]} />
            <Mat item={item} />
          </mesh>
          <mesh position={[0, -0.06, 0]}>
            <cylinderGeometry args={[0.17, 0.26, 0.04, 28, 1, true]} />
            <Mat item={item} double />
          </mesh>
        </group>
      )
    case 'headwrap':
    default:
      return (
        <group position={[0, y + 0.04, -0.02]}>
          <mesh rotation={[-0.35, 0, 0]} scale={[1.08, 1.2, 1.12]}>
            <sphereGeometry args={[0.17, 28, 16, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
            <Mat item={item} />
          </mesh>
          <mesh position={[0, 0.16, 0.08]}>
            <torusKnotGeometry args={[0.028, 0.013, 40, 6]} />
            <Mat item={item} />
          </mesh>
        </group>
      )
  }
}

function Eyewear({ item, d }: { item: CatalogItem; d: Dims }) {
  const sun = item.template === 'sunglasses'
  return (
    <group position={[0, d.headY + 0.006, 0.15]}>
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 0.052, 0, 0]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.026, 0.0035, 8, 24]} />
            <meshStandardMaterial color={item.colors[0]} metalness={0.4} roughness={0.3} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.025, 0.025, 0.002, 24]} />
            <meshPhysicalMaterial color={sun ? '#1A1020' : '#DDEEFF'} transparent opacity={sun ? 0.85 : 0.18} roughness={0.05} clearcoat={1} />
          </mesh>
        </group>
      ))}
      <mesh>
        <boxGeometry args={[0.03, 0.004, 0.004]} />
        <meshStandardMaterial color={item.colors[0]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={`t${s}`} position={[s * 0.15, 0, -0.07]} rotation={[0, s * -0.5, 0]}>
          <boxGeometry args={[0.004, 0.004, 0.14]} />
          <meshStandardMaterial color={item.colors[0]} />
        </mesh>
      ))}
    </group>
  )
}

function Earrings({ item, d }: { item: CatalogItem; d: Dims }) {
  const color = item.colors[0]
  return (
    <group position={[0, d.headY, 0]}>
      {([1, -1] as const).map((s) => {
        const p = headSocket('lobe', s)!
        return (
          <group key={s} position={[p[0] + s * 0.006, p[1], p[2]]}>
            {item.template === 'hoops' && (
              <mesh position={[0, -0.03, 0]} rotation={[0, Math.PI / 2, 0]}>
                <torusGeometry args={[0.03, 0.003, 8, 32]} />
                <Metal color={color} />
              </mesh>
            )}
            {item.template === 'studs' && (
              <mesh>
                <sphereGeometry args={[0.007, 12, 10]} />
                <Metal color={color} />
              </mesh>
            )}
            {item.template === 'drops' && (
              <group>
                <mesh position={[0, -0.018, 0]}>
                  <cylinderGeometry args={[0.0012, 0.0012, 0.036, 6]} />
                  <Metal color={color} />
                </mesh>
                <mesh position={[0, -0.045, 0]}>
                  <octahedronGeometry args={[0.013]} />
                  <meshPhysicalMaterial color={item.colors[1]} roughness={0.05} clearcoat={1} />
                </mesh>
              </group>
            )}
          </group>
        )
      })}
    </group>
  )
}

function Necklace({ item, d }: { item: CatalogItem; d: Dims }) {
  const color = item.colors[0]
  if (item.template === 'waist-beads') {
    return (
      <mesh position={[0, d.waistY - 0.07, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[d.waistX * 1.02, 0.82, 1]}>
        <torusGeometry args={[0.15, 0.007, 8, 48]} />
        <meshPhysicalMaterial color={color} roughness={0.25} clearcoat={1} />
      </mesh>
    )
  }
  const rows = item.template === 'coral-beads' ? 3 : 1
  return (
    <group position={[0, d.neckY - 0.045, 0.012]} rotation={[Math.PI / 2 + 0.25, 0, 0]}>
      {Array.from({ length: rows }, (_, i) => (
        <mesh key={i} position={[0, 0.012 + i * 0.012, i * 0.012]} scale={[1 + i * 0.12, 1 + i * 0.16, 1]}>
          <torusGeometry args={[0.06, item.template === 'coral-beads' ? 0.008 : 0.0032, 8, 48]} />
          {item.template === 'coral-beads' ? <meshPhysicalMaterial color={color} roughness={0.35} clearcoat={0.6} /> : <Metal color={color} />}
        </mesh>
      ))}
      {item.template === 'pendant' && (
        <mesh position={[0, 0.07, 0]}>
          <octahedronGeometry args={[0.014]} />
          <meshPhysicalMaterial color={item.colors[1]} roughness={0.05} clearcoat={1} />
        </mesh>
      )}
    </group>
  )
}

/** Garments on the torso, legs, feet and head. Arm pieces come from `armWear`. */
export function Clothes({ items, d, undress }: { items: Items; d: Dims; undress: boolean }) {
  const parts: ReactNode[] = []
  if (undress) {
    parts.push(<Torso key="ut" item={UNDER} d={d} waist={false} out={1.02} />, <Trousers key="ub" item={UNDER} d={d} length={0.1} />)
    return <group>{parts}</group>
  }
  const { top, bottom, dress, outerwear, swimwear, shoes, headwear, eyewear, earrings, necklace } = items

  if (dress) {
    const t = dress.template
    if (t === 'jumpsuit') {
      parts.push(<Torso key="d" item={dress} d={d} hips />, <Trousers key="dl" item={dress} d={d} length={d.legLen + 0.02} />)
    } else if (t === 'boubou' || t === 'kaftan') {
      parts.push(
        <mesh key="d" position={[0, (d.shoulderY + 0.06) / 2 + 0.02, 0]}>
          <cylinderGeometry args={[0.2 * d.chestX, 0.34 * d.hipsX, d.shoulderY + 0.02, 32, 1, true]} />
          <Mat item={dress} double />
        </mesh>,
        <Torso key="dt" item={dress} d={d} out={1.06} />,
      )
    } else {
      const len = t === 'mini-dress' ? 0.26 : t === 'midi-dress' ? 0.52 : 0.82
      parts.push(<Torso key="d" item={dress} d={d} hips />, <Skirt key="ds" item={dress} d={d} length={len} flare={t === 'gown' ? 1.6 : 1} />)
    }
  } else if (swimwear) {
    if (swimwear.template === 'bikini') {
      parts.push(
        ...[-1, 1].map((s) => (
          <mesh key={`bk${s}`} position={[s * 0.058, d.chestY - 0.03, 0.08]}>
            <sphereGeometry args={[Math.max(0.03, d.bust * 1.12), 16, 12]} />
            <Mat item={swimwear} />
          </mesh>
        )),
        <Trousers key="bb" item={swimwear} d={d} length={0.04} />,
      )
    } else {
      parts.push(<Torso key="sw" item={swimwear} d={d} hips out={1.02} />)
    }
  } else {
    if (top?.template === 'bralette') {
      parts.push(
        ...[-1, 1].map((sd) => (
          <mesh key={`br${sd}`} position={[sd * 0.058, d.chestY - 0.03, 0.08]}>
            <sphereGeometry args={[Math.max(0.03, d.bust * 1.12), 16, 12]} />
            <Mat item={top} />
          </mesh>
        )),
        <mesh key="brb" position={[0, d.chestY - 0.07, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[d.chestX * 1.05, 0.8, 1]}>
          <torusGeometry args={[0.135, 0.01, 8, 40]} />
          <Mat item={top} />
        </mesh>,
      )
    } else if (top) {
      const crop = top.template === 'crop'
      const long = top.template === 'buba' || top.template === 'shirt'
      parts.push(<Torso key="t" item={top} d={d} cropWaist={crop} hips={long} out={top.template === 'buba' ? 1.1 : 1.04} />)
      if (top.template === 'corset') {
        parts.push(
          <mesh key="lace" position={[0, d.waistY + 0.03, 0.125]}>
            <boxGeometry args={[0.006, 0.26, 0.004]} />
            <meshStandardMaterial color={top.colors[1]} />
          </mesh>,
        )
      }
    } else if (!bottom) {
      parts.push(<Torso key="ut" item={UNDER} d={d} waist={false} out={1.02} />)
    }
    if (bottom) {
      switch (bottom.template) {
        case 'trousers':
        case 'cargo':
          parts.push(<Trousers key="b" item={bottom} d={d} length={d.legLen + 0.02} wide={1.15} />)
          break
        case 'jeans':
          parts.push(<Trousers key="b" item={bottom} d={d} length={d.legLen + 0.02} />)
          break
        case 'shorts':
          parts.push(<Trousers key="b" item={bottom} d={d} length={0.17} />)
          break
        case 'mini-skirt':
          parts.push(<Skirt key="b" item={bottom} d={d} length={0.24} />)
          break
        case 'midi-skirt':
          parts.push(<Skirt key="b" item={bottom} d={d} length={0.48} />)
          break
        case 'maxi-skirt':
        case 'wrapper':
          parts.push(<Skirt key="b" item={bottom} d={d} length={0.74} flare={0.85} />)
          break
      }
    } else if (!top) {
      parts.push(<Trousers key="ub" item={UNDER} d={d} length={0.1} />)
    }
  }

  if (outerwear) {
    const t = outerwear.template
    if (t === 'agbada') {
      parts.push(
        <mesh key="ag" position={[0, d.shoulderY - 0.28, -0.01]} scale={[1, 1, 0.55]}>
          <cylinderGeometry args={[0.22 * d.chestX, 0.62, 0.62, 32, 1, true]} />
          <Mat item={outerwear} double />
        </mesh>,
        <Torso key="agt" item={outerwear} d={d} out={1.08} />,
      )
    } else {
      const out = t === 'puffer' ? 1.2 : 1.1
      parts.push(<Torso key="o" item={outerwear} d={d} hips={t !== 'jacket'} out={out} />)
      if (t === 'hoodie') {
        parts.push(
          <mesh key="hood" position={[0, d.neckY - 0.02, -0.07]} rotation={[Math.PI / 2 - 0.4, 0, 0]}>
            <torusGeometry args={[0.1, 0.045, 10, 24]} />
            <Mat item={outerwear} />
          </mesh>,
        )
      }
      if (t === 'blazer') {
        parts.push(
          ...[-1, 1].map((s) => (
            <mesh key={`lap${s}`} position={[s * 0.05, d.chestY + 0.02, 0.122 * out]} rotation={[0.1, 0, s * 0.35]}>
              <boxGeometry args={[0.035, 0.16, 0.006]} />
              <meshStandardMaterial color={outerwear.colors[1]} />
            </mesh>
          )),
        )
      }
      if (t === 'puffer') {
        parts.push(
          ...[0, 1, 2].map((k) => (
            <mesh key={`pr${k}`} position={[0, d.waistY - 0.08 + k * 0.1, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[d.chestX * 1.15, 0.85, 1]}>
              <torusGeometry args={[0.15, 0.018, 8, 32]} />
              <Mat item={outerwear} />
            </mesh>
          )),
        )
      }
    }
  }

  if (outerwear?.template === 'robe') {
    parts.push(
      <mesh key="sash" position={[0, d.waistY, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[d.waistX * 1.25, 0.9, 1]}>
        <torusGeometry args={[0.15, 0.012, 8, 40]} />
        <Mat item={outerwear} />
      </mesh>,
    )
  }
  if (items.belt) {
    const b = items.belt
    parts.push(
      <group key="belt" position={[0, d.waistY - 0.06, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]} scale={[d.hipsX * 1.18, 0.86, 1]}>
          <torusGeometry args={[0.15, 0.011, 8, 48]} />
          <meshPhysicalMaterial color={b.colors[0]} roughness={0.35} clearcoat={0.6} />
        </mesh>
        <mesh position={[0, 0, 0.142]}>
          <boxGeometry args={[0.045, 0.032, 0.008]} />
          <Metal color={b.colors[1] === '#FFFFFF' ? '#D4AF37' : b.colors[1]} />
        </mesh>
      </group>,
    )
  }
  if (shoes) parts.push(<Shoes key="sh" item={shoes} d={d} />)
  if (headwear) parts.push(<Headwear key="hw" item={headwear} d={d} />)
  if (eyewear) parts.push(<Eyewear key="ew" item={eyewear} d={d} />)
  if (earrings) parts.push(<Earrings key="er" item={earrings} d={d} />)
  if (necklace) parts.push(<Necklace key="nk" item={necklace} d={d} />)
  if (items.bag?.template === 'backpack') {
    parts.push(
      <RoundedBox key="bp" args={[0.22, 0.28, 0.1]} radius={0.03} position={[0, d.chestY - 0.05, -0.18]}>
        <Mat item={items.bag} />
      </RoundedBox>,
    )
  }
  return <group>{parts}</group>
}

/** Sleeves, bracelets and hand-held bags, rendered inside each arm group. */
export function armWear(items: Items, d: Dims, side: 1 | -1, undress: boolean): ReactNode {
  if (undress) return null
  const out: ReactNode[] = []
  const sleeveSource = items.outerwear ?? items.dress ?? items.top
  const t = sleeveSource?.template
  const longSleeve = t && ['blouse', 'shirt', 'buba', 'hoodie', 'blazer', 'jacket', 'puffer', 'agbada', 'kaftan', 'boubou'].includes(t)
  const shortSleeve = t && ['tee', 'midi-dress', 'mini-dress', 'jumpsuit'].includes(t)
  if (sleeveSource && (longSleeve || shortSleeve)) {
    const r = d.armR * (t === 'puffer' ? 1.6 : 1.25)
    out.push(
      <mesh key="up" position={[0, shortSleeve ? -0.05 : -0.1, 0]}>
        <capsuleGeometry args={[r, shortSleeve ? 0.06 : 0.17, 6, 12]} />
        <Mat item={sleeveSource} />
      </mesh>,
    )
    if (longSleeve) {
      const flare = t === 'agbada' || t === 'buba' || t === 'kaftan' || t === 'boubou'
      out.push(
        <mesh key="fo" position={[0, -0.3, 0]}>
          {flare ? <cylinderGeometry args={[r, r * 2.2, 0.22, 16, 1, true]} /> : <capsuleGeometry args={[r * 0.92, 0.17, 6, 12]} />}
          <Mat item={sleeveSource} double={flare} />
        </mesh>,
      )
    }
  }
  const bracelet = items.bracelet
  if (bracelet && (side === 1 || bracelet.template === 'bangle')) {
    out.push(
      <mesh key="br" position={[0, -0.39, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[d.armR * 1.05, bracelet.template === 'watch' ? 0.006 : 0.0045, 8, 24]} />
        <Metal color={bracelet.colors[0]} />
      </mesh>,
    )
    if (bracelet.template === 'watch') {
      out.push(
        <mesh key="wf" position={[0, -0.39, d.armR + 0.004]}>
          <cylinderGeometry args={[0.014, 0.014, 0.006, 20]} />
          <meshPhysicalMaterial color={bracelet.colors[1]} clearcoat={1} />
        </mesh>,
      )
    }
  }
  const bag = items.bag
  if (bag && bag.template !== 'backpack' && side === (bag.template === 'clutch' ? 1 : -1)) {
    out.push(
      bag.template === 'clutch' ? (
        <RoundedBox key="bag" args={[0.16, 0.08, 0.035]} radius={0.012} position={[0, -0.47, 0.03]}>
          <Mat item={bag} rough={0.4} />
        </RoundedBox>
      ) : (
        <group key="bag" position={[0.02, -0.18, 0.04]}>
          <RoundedBox args={[0.2, 0.18, 0.07]} radius={0.015} position={[0, -0.12, 0]}>
            <Mat item={bag} rough={0.5} />
          </RoundedBox>
          <mesh position={[0, 0, 0]} rotation={[0, 0, 0]}>
            <torusGeometry args={[0.06, 0.006, 6, 20, Math.PI]} />
            <meshStandardMaterial color={bag.colors[1]} side={DoubleSide} />
          </mesh>
        </group>
      ),
    )
  }
  return out.length ? <group>{out}</group> : null
}
