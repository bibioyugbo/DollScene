import type { BodyMorph } from '../../shared/studio/look'
import { useStudio } from '../state/store'
import { Section, Slider } from '../ui/controls'

/** Plain, neutral wording: every shape is a valid shape. */
const SLIDERS: { id: BodyMorph; name: string; left: string; right: string }[] = [
  { id: 'Shoulders', name: 'Shoulders', left: 'Narrow', right: 'Broad' },
  { id: 'Bust', name: 'Bust', left: 'Smaller', right: 'Fuller' },
  { id: 'BustLift', name: 'Bust height', left: 'Lower', right: 'Higher' },
  { id: 'Waist', name: 'Waist', left: 'Narrow', right: 'Wide' },
  { id: 'Belly', name: 'Belly', left: 'Flat', right: 'Round' },
  { id: 'Hips', name: 'Hips', left: 'Narrow', right: 'Wide' },
  { id: 'Glutes', name: 'Glutes', left: 'Flatter', right: 'Fuller' },
  { id: 'Thighs', name: 'Thighs', left: 'Slimmer', right: 'Fuller' },
  { id: 'Arms', name: 'Arms', left: 'Slimmer', right: 'Fuller' },
  { id: 'Softness', name: 'Body softness', left: 'Lean', right: 'Soft' },
  { id: 'Muscle', name: 'Muscle tone', left: 'Low', right: 'Defined' },
]

export function BodyEditor() {
  const look = useStudio((s) => s.look)
  const preview = useStudio((s) => s.preview)
  return (
    <div className="flex flex-col gap-1">
      <Slider label="Height" min={0.94} max={1.06} step={0.002} bipolar value={look.height} onChange={(v) => preview((l) => void (l.height = v))} left="Petite" right="Tall" />
      <Section title="Shape">
        <div className="flex flex-col gap-1">
          {SLIDERS.map((s) => (
            <Slider key={s.id} bipolar label={s.name} value={look.morphs[s.id]} left={s.left} right={s.right} onChange={(v) => preview((l) => void (l.morphs[s.id] = v))} />
          ))}
        </div>
      </Section>
    </div>
  )
}
