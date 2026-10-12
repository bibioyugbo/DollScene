import { useState } from 'react'
import { applyTransform, TRANSFORM_PRESETS, type TransformPreset } from '../../shared/studio/presets'
import { useStudio } from '../state/store'
import { Chips, TextButton } from '../ui/controls'

/**
 * Virtual transformation studio: fictional, reversible appearance presets. Each one nudges
 * the same morph sliders the Face and Body editors use, so everything stays editable,
 * undoable and comparable against the look from before.
 */
export function TransformStudio() {
  const [area, setArea] = useState<TransformPreset['area']>('face')
  const apply = useStudio((s) => s.apply)
  const replace = useStudio((s) => s.replace)
  const before = useStudio((s) => s.before)
  const look = useStudio((s) => s.look)
  const setFraming = useStudio((s) => s.setFraming)
  const changed = JSON.stringify(before) !== JSON.stringify(look)

  return (
    <div className="flex flex-col gap-4">
      <p className="rounded-xl border border-line px-3 py-2 text-[12px] leading-relaxed text-muted">
        Fictional styling previews for your character. Not medical advice, and not a prediction of what any procedure would do.
      </p>
      <Chips
        label="Area"
        value={area}
        onPick={(a) => {
          setArea(a)
          setFraming(a === 'face' ? 'face' : 'full')
        }}
        options={[
          { id: 'face', name: 'Face' },
          { id: 'body', name: 'Body' },
          { id: 'non-surgical', name: 'Non-surgical' },
        ]}
      />
      <ul className="flex flex-col divide-y divide-line">
        {TRANSFORM_PRESETS.filter((p) => p.area === area).map((p) => (
          <li key={p.id} className="flex items-center gap-3 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="font-display text-[16px] leading-tight">{p.name}</p>
              <p className="text-[12px] text-muted">{p.blurb}</p>
            </div>
            <TextButton onClick={() => apply((l) => Object.assign(l, applyTransform(l, p)))}>Try</TextButton>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-2">
        <TextButton disabled={!changed} onClick={() => replace(before)}>
          Back to before
        </TextButton>
        <p className="text-[12px] text-muted">Hold “Before” on the preview to compare.</p>
      </div>
    </div>
  )
}
