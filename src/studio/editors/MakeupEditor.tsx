import { useState } from 'react'
import type { Layer, Makeup } from '../../shared/studio/look'
import { MAKEUP_PRESETS } from '../../shared/studio/presets'
import { PREMIUM_SWATCHES } from '../../shared/studio/products'
import { useStudio } from '../state/store'
import { Chips, Section, Slider, Swatches } from '../ui/controls'
import { PALETTES, SKIN_TONES } from './palettes'

type LayerKey = Exclude<keyof Makeup, 'gloss'>
type Group = 'base' | 'sculpt' | 'eyes' | 'lips' | 'nails'

const GROUPS: { id: Group; name: string; layers: { key: LayerKey; name: string; palette: readonly string[] }[] }[] = [
  {
    id: 'base',
    name: 'Base',
    layers: [
      { key: 'foundation', name: 'Foundation', palette: SKIN_TONES },
      { key: 'concealer', name: 'Concealer', palette: SKIN_TONES },
    ],
  },
  {
    id: 'sculpt',
    name: 'Sculpt',
    layers: [
      { key: 'contour', name: 'Contour', palette: PALETTES.contour },
      { key: 'blush', name: 'Blush', palette: PALETTES.blush },
      { key: 'highlight', name: 'Highlight', palette: PALETTES.highlight },
    ],
  },
  {
    id: 'eyes',
    name: 'Eyes',
    layers: [
      { key: 'eyeshadow', name: 'Eyeshadow', palette: PALETTES.eyeshadow },
      { key: 'liner', name: 'Liner', palette: PALETTES.liner },
      { key: 'lowerLiner', name: 'Lower liner', palette: PALETTES.liner },
    ],
  },
  {
    id: 'lips',
    name: 'Lips',
    layers: [
      { key: 'lipLiner', name: 'Lip liner', palette: PALETTES.lipLiner },
      { key: 'lipstick', name: 'Lipstick', palette: PALETTES.lip },
    ],
  },
  { id: 'nails', name: 'Nails', layers: [] },
]

/** Premium shades join the colour-led layers; locked until the server grants the palette. */
const PREMIUM_LAYERS: LayerKey[] = ['eyeshadow', 'highlight', 'blush', 'lipstick', 'liner']

export function MakeupEditor() {
  const [group, setGroup] = useState<Group>('base')
  const [layerKey, setLayerKey] = useState<LayerKey>('foundation')
  const look = useStudio((s) => s.look)
  const entitlements = useStudio((s) => s.entitlements)
  const preview = useStudio((s) => s.preview)
  const apply = useStudio((s) => s.apply)
  const setTab = useStudio((s) => s.setTab)
  const notify = useStudio((s) => s.notify)

  const g = GROUPS.find((x) => x.id === group)!
  const layerDef = g.layers.find((l) => l.key === layerKey) ?? g.layers[0]
  const presetId = MAKEUP_PRESETS.find((p) => JSON.stringify(p.build(look.skin.tone)) === JSON.stringify(look.makeup))?.id ?? null

  const palette = (key: LayerKey, base: readonly string[]) => {
    if (!PREMIUM_LAYERS.includes(key)) return { colors: [...base], locked: [] as string[] }
    const extra = Object.entries(PREMIUM_SWATCHES)
    const colors = [...base, ...extra.flatMap(([, c]) => c)]
    const locked = extra.filter(([id]) => !entitlements.includes(id)).flatMap(([, c]) => c)
    return { colors, locked }
  }
  const onLocked = () => {
    notify('That shade is in a premium palette. See it in Play → Shop.')
    setTab('play')
  }

  return (
    <div className="flex flex-col gap-4">
      <Section title="Looks">
        <Chips
          label="Makeup look"
          value={presetId}
          onPick={(id) => {
            const p = MAKEUP_PRESETS.find((x) => x.id === id)!
            apply((l) => void (l.makeup = p.build(l.skin.tone)))
          }}
          options={MAKEUP_PRESETS.map((p) => ({ id: p.id, name: p.name }))}
        />
      </Section>
      <div className="h-px bg-line" />
      <div className="flex items-center gap-4 overflow-x-auto" role="tablist" aria-label="Makeup area">
        {GROUPS.map((x) => (
          <button
            key={x.id}
            type="button"
            role="tab"
            aria-selected={x.id === group}
            onClick={() => {
              setGroup(x.id)
              if (x.layers[0]) setLayerKey(x.layers[0].key)
            }}
            className={`min-h-9 shrink-0 font-display text-[17px] italic ${x.id === group ? 'text-text' : 'text-muted/70'}`}
          >
            {x.name}
          </button>
        ))}
      </div>

      {group === 'nails' ? (
        <>
          <Swatches label="Nail polish" colors={[...PALETTES.nails]} value={look.nails.color} onPick={(c) => apply((l) => void ((l.nails.color = c), (l.nails.amount = Math.max(l.nails.amount, 0.9))))} />
          <Slider label="Coverage" value={look.nails.amount} onChange={(v) => preview((l) => void (l.nails.amount = v))} left="Bare" right="Full" />
        </>
      ) : (
        <>
          {g.layers.length > 1 && (
            <Chips label="Layer" value={layerDef.key} onPick={setLayerKey} options={g.layers.map((l) => ({ id: l.key, name: l.name }))} />
          )}
          <LayerControls
            key={layerDef.key}
            name={layerDef.name}
            layer={look.makeup[layerDef.key]}
            {...palette(layerDef.key, layerDef.palette)}
            onLocked={onLocked}
            onColor={(c) =>
              apply((l) => {
                const ly = l.makeup[layerDef.key] as Layer
                ly.color = c
                if (ly.amount < 0.05) ly.amount = 0.5
              })
            }
            onAmount={(v) => preview((l) => void ((l.makeup[layerDef.key] as Layer).amount = v))}
          />
          {layerDef.key === 'eyeshadow' && <Slider label="Shimmer" value={look.makeup.eyeshadow.shimmer} onChange={(v) => preview((l) => void (l.makeup.eyeshadow.shimmer = v))} left="Matte" right="Glitter" />}
          {group === 'lips' && <Slider label="Gloss" value={look.makeup.gloss} onChange={(v) => preview((l) => void (l.makeup.gloss = v))} left="Matte" right="Wet" />}
        </>
      )}
    </div>
  )
}

function LayerControls({ name, layer, colors, locked, onColor, onAmount, onLocked }: { name: string; layer: Layer; colors: string[]; locked: string[]; onColor: (c: string) => void; onAmount: (v: number) => void; onLocked: () => void }) {
  return (
    <div className="ds-enter flex flex-col gap-3">
      <Swatches label={`${name} shade`} colors={colors} value={layer.color} onPick={onColor} locked={locked} onLocked={onLocked} />
      <Slider label="Intensity" value={layer.amount} onChange={onAmount} left="Off" right="Full" />
    </div>
  )
}
