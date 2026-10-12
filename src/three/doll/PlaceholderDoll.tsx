import { useMemo } from 'react'
import type { Appearance } from '../../shared/types'
import { hairKind } from '../../components/art/DollAvatar'
import { Body } from './Body'
import { armWear, Clothes, resolveOutfit } from './Clothes'
import { bodyDims } from './dims'
import { Head } from './Head'

/**
 * Procedural stand-in built from primitives. Every customization option is
 * visible on it, so the whole game works before real GLBs exist.
 */
export function PlaceholderDoll({ appearance, undress = false }: { appearance: Appearance; undress?: boolean }) {
  const d = useMemo(() => bodyDims(appearance), [appearance])
  const items = useMemo(() => resolveOutfit(appearance.outfit), [appearance.outfit])
  const shoes = !undress ? items.shoes : undefined
  const bareFeet = !shoes || shoes.template === 'sandals'
  const hatOverHair = !undress && !!items.headwear && ['round', 'bun', 'puffs', 'knots'].includes(hairKind(appearance.hair.style))

  return (
    <group>
      <Body a={appearance} d={d} bareFeet={bareFeet} armExtras={(side) => armWear(items, d, side, undress)} />
      <Clothes items={items} d={d} undress={undress} />
      <group position={[0, d.headY, 0]}>
        <Head a={appearance} hideHairTop={hatOverHair} />
      </group>
    </group>
  )
}
