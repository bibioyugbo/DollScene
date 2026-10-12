import type { HairId } from '../../shared/studio/look'
import type { CharacterCatalog } from '../character/catalog'
import { useStudio } from '../state/store'
import { Chips, Section, Slider, Swatches } from '../ui/controls'
import { PALETTES } from './palettes'

/** Styles come from the catalog, so a new hair GLB shows up here without code changes. */
export function HairEditor({ catalog }: { catalog: CharacterCatalog }) {
  const look = useStudio((s) => s.look)
  const apply = useStudio((s) => s.apply)
  const preview = useStudio((s) => s.preview)
  const options: { id: HairId; name: string }[] = [...catalog.hair.map((h) => ({ id: h.id, name: h.name })), { id: 'none', name: 'Close crop' }]
  return (
    <div className="flex flex-col gap-4">
      <Section title="Style">
        <Chips label="Hairstyle" value={look.hair.style} onPick={(id) => apply((l) => void (l.hair.style = id))} options={options} />
      </Section>
      {look.hair.style === 'none' && <Slider label="Crop density" value={look.hair.crop} onChange={(v) => preview((l) => void (l.hair.crop = v))} left="Bald" right="Dense" />}
      <Section title="Colour">
        <Swatches label="Hair colour" colors={[...PALETTES.hair]} value={look.hair.color} onPick={(c) => apply((l) => void (l.hair.color = c))} />
      </Section>
      <p className="text-[12px] leading-relaxed text-muted">Braids, cornrows, locs, twists and more wigs arrive as new hair assets.</p>
    </div>
  )
}
