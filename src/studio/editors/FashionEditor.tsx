import type { CharacterCatalog } from '../character/catalog'
import { useStudio } from '../state/store'
import { Chips, Section, Slider, Swatches } from '../ui/controls'
import { PALETTES } from './palettes'

/** Garments and shoes come from the catalog: adding a GLB adds an option. */
export function FashionEditor({ catalog }: { catalog: CharacterCatalog }) {
  const look = useStudio((s) => s.look)
  const apply = useStudio((s) => s.apply)
  const preview = useStudio((s) => s.preview)
  return (
    <div className="flex flex-col gap-4">
      <Section title="Outfit">
        <Chips label="Outfit" value={look.outfit.id} onPick={(id) => apply((l) => void (l.outfit.id = id))} options={catalog.outfits.map((o) => ({ id: o.id, name: o.name }))} />
      </Section>
      <Section title="Dye">
        <Swatches label="Dye colour" colors={[...PALETTES.dye]} value={look.outfit.dye} onPick={(c) => apply((l) => void ((l.outfit.dye = c), (l.outfit.dyeAmount = Math.max(l.outfit.dyeAmount, 0.7))))} />
        <Slider label="Dye strength" value={look.outfit.dyeAmount} onChange={(v) => preview((l) => void (l.outfit.dyeAmount = v))} left="Original" right="Full" />
      </Section>
      <Section title="Shoes">
        <Chips label="Shoes" value={look.shoes.id} onPick={(id) => apply((l) => void (l.shoes.id = id))} options={catalog.shoes.map((o) => ({ id: o.id, name: o.name }))} />
      </Section>
      <p className="text-[12px] leading-relaxed text-muted">Jewellery, bags, gele and aso-oke pieces arrive as new fashion assets.</p>
    </div>
  )
}
