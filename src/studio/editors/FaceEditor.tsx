import { useState } from 'react'
import { BROW_IDS, EYE_IDS, LASH_IDS, UNDERTONES, type FaceMorph } from '../../shared/studio/look'
import { useStudio } from '../state/store'
import { Chips, Section, Segmented, Slider, Swatches } from '../ui/controls'
import { PALETTES, SKIN_TONES } from './palettes'

type Group = 'skin' | 'eyes' | 'nose' | 'lips' | 'shape'

const FEATURES: Record<Exclude<Group, 'skin'>, { id: FaceMorph; name: string; left: string; right: string }[]> = {
  eyes: [
    { id: 'EyeSize', name: 'Size', left: 'Smaller', right: 'Larger' },
    { id: 'EyeOpen', name: 'Openness', left: 'Hooded', right: 'Open' },
    { id: 'EyeSpacing', name: 'Spacing', left: 'Closer', right: 'Wider' },
    { id: 'Brows', name: 'Brow height', left: 'Lower', right: 'Higher' },
    { id: 'BrowAngle', name: 'Brow arch', left: 'Flat', right: 'Arched' },
  ],
  nose: [
    { id: 'NoseWidth', name: 'Width', left: 'Narrow', right: 'Wide' },
    { id: 'NoseBridge', name: 'Bridge', left: 'Slim', right: 'Broad' },
    { id: 'NoseTip', name: 'Tip', left: 'Down', right: 'Up' },
    { id: 'NoseLength', name: 'Length', left: 'Short', right: 'Long' },
  ],
  lips: [
    { id: 'Lips', name: 'Volume', left: 'Thin', right: 'Full' },
    { id: 'LipWidth', name: 'Width', left: 'Narrow', right: 'Wide' },
    { id: 'CupidsBow', name: 'Cupid’s bow', left: 'Soft', right: 'Defined' },
  ],
  shape: [
    { id: 'Cheekbones', name: 'Cheekbones', left: 'Soft', right: 'High' },
    { id: 'Cheeks', name: 'Cheeks', left: 'Hollow', right: 'Full' },
    { id: 'Jaw', name: 'Jaw', left: 'Soft', right: 'Angular' },
    { id: 'Chin', name: 'Chin', left: 'Recessed', right: 'Forward' },
    { id: 'ChinWidth', name: 'Chin width', left: 'Narrow', right: 'Wide' },
    { id: 'Forehead', name: 'Forehead', left: 'Short', right: 'Tall' },
    { id: 'FaceFull', name: 'Fullness', left: 'Lean', right: 'Round' },
    { id: 'FaceLength', name: 'Length', left: 'Short', right: 'Long' },
  ],
}

const EYE_NAMES: Record<(typeof EYE_IDS)[number], string> = { brown: 'Dark brown', brownlight: 'Hazel', green: 'Green', grey: 'Grey', bluegreen: 'Blue-green' }

export function FaceEditor() {
  const [group, setGroup] = useState<Group>('skin')
  const look = useStudio((s) => s.look)
  const preview = useStudio((s) => s.preview)
  const apply = useStudio((s) => s.apply)

  return (
    <div className="flex flex-col gap-4">
      <Chips
        label="Face area"
        value={group}
        onPick={setGroup}
        options={[
          { id: 'skin', name: 'Skin' },
          { id: 'eyes', name: 'Eyes & brows' },
          { id: 'nose', name: 'Nose' },
          { id: 'lips', name: 'Lips' },
          { id: 'shape', name: 'Face shape' },
        ]}
      />
      {group === 'skin' && (
        <>
          <Section title="Tone">
            <div className="grid grid-cols-8 gap-2" role="radiogroup" aria-label="Skin tone">
              {SKIN_TONES.map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={look.skin.tone === c}
                  aria-label={`Skin tone ${c}`}
                  onClick={() => apply((l) => void (l.skin.tone = c))}
                  className="aspect-square rounded-full active:scale-90"
                  style={{ background: c, boxShadow: look.skin.tone === c ? '0 0 0 2px var(--ink), 0 0 0 3.5px var(--accent)' : 'inset 0 0 0 1px rgb(255 255 255 / .12)' }}
                />
              ))}
            </div>
          </Section>
          <Section title="Undertone">
            <Segmented label="Undertone" value={look.skin.undertone} onPick={(u) => apply((l) => void (l.skin.undertone = u))} options={UNDERTONES.map((u) => ({ id: u, name: u[0].toUpperCase() + u.slice(1) }))} />
          </Section>
          <Slider label="Natural glow" value={look.skin.glow} onChange={(v) => preview((l) => void (l.skin.glow = v))} left="Matte" right="Dewy" />
        </>
      )}
      {group !== 'skin' && (
        <div className="flex flex-col gap-1">
          {FEATURES[group].map((f) => (
            <Slider key={f.id} bipolar label={f.name} value={look.morphs[f.id]} left={f.left} right={f.right} onChange={(v) => preview((l) => void (l.morphs[f.id] = v))} />
          ))}
        </div>
      )}
      {group === 'eyes' && (
        <>
          <Section title="Iris">
            <Chips label="Iris colour" value={look.eyes.iris} onPick={(id) => apply((l) => void (l.eyes.iris = id))} options={EYE_IDS.map((id) => ({ id, name: EYE_NAMES[id] }))} />
          </Section>
          <Section title="Brows">
            <Chips label="Brow shape" value={look.brows.shape} onPick={(id) => apply((l) => void (l.brows.shape = id))} options={BROW_IDS.map((id, i) => ({ id, name: ['Soft arch', 'Straight', 'Full natural'][i] }))} />
            <Swatches label="Brow colour" colors={[...PALETTES.brow]} value={look.brows.color} onPick={(c) => apply((l) => void (l.brows.color = c))} />
          </Section>
          <Section title="Lashes">
            <Chips label="Lash style" value={look.lashes.style} onPick={(id) => apply((l) => void (l.lashes.style = id))} options={LASH_IDS.map((id, i) => ({ id, name: ['Natural', 'Wispy', 'Volume'][i] }))} />
          </Section>
        </>
      )}
    </div>
  )
}
