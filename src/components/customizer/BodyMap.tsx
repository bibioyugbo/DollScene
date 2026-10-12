import type { TattooRegion } from '../../shared/types'
import { cx } from '../../lib/ui'

/** Front-view body map. The viewer's left is the doll's right. */
const SPOTS: { region: TattooRegion; x: number; y: number; r?: number; label: string }[] = [
  { region: 'face', x: 50, y: 13, label: 'Face' },
  { region: 'neck', x: 50, y: 24, r: 4, label: 'Neck' },
  { region: 'shoulder-r', x: 33, y: 29, label: 'Right shoulder' },
  { region: 'shoulder-l', x: 67, y: 29, label: 'Left shoulder' },
  { region: 'chest', x: 50, y: 33, label: 'Chest' },
  { region: 'back', x: 88, y: 8, r: 6, label: 'Back' },
  { region: 'arm-r', x: 28, y: 40, label: 'Right upper arm' },
  { region: 'arm-l', x: 72, y: 40, label: 'Left upper arm' },
  { region: 'ribs', x: 61, y: 43, r: 4, label: 'Ribs' },
  { region: 'stomach', x: 50, y: 47, label: 'Stomach' },
  { region: 'forearm-r', x: 24, y: 54, label: 'Right forearm' },
  { region: 'forearm-l', x: 76, y: 54, label: 'Left forearm' },
  { region: 'hip-r', x: 40, y: 58, r: 4, label: 'Right hip' },
  { region: 'hip-l', x: 60, y: 58, r: 4, label: 'Left hip' },
  { region: 'hand-r', x: 21, y: 66, r: 4, label: 'Right hand' },
  { region: 'hand-l', x: 79, y: 66, r: 4, label: 'Left hand' },
  { region: 'fingers', x: 84, y: 72, r: 3.5, label: 'Fingers' },
  { region: 'thigh-r', x: 43, y: 70, label: 'Right thigh' },
  { region: 'thigh-l', x: 57, y: 70, label: 'Left thigh' },
  { region: 'calf-r', x: 43, y: 84, label: 'Right calf' },
  { region: 'calf-l', x: 57, y: 84, label: 'Left calf' },
  { region: 'ankle-r', x: 43, y: 93, r: 3.5, label: 'Right ankle' },
  { region: 'ankle-l', x: 57, y: 93, r: 3.5, label: 'Left ankle' },
  { region: 'foot-r', x: 38, y: 98, r: 3.5, label: 'Right foot' },
  { region: 'foot-l', x: 62, y: 98, r: 3.5, label: 'Left foot' },
]

export function BodyMap({ value, used, onPick }: { value: TattooRegion; used: TattooRegion[]; onPick: (r: TattooRegion) => void }) {
  return (
    <div className="relative mx-auto w-full max-w-[260px]">
      <svg viewBox="0 0 100 104" className="w-full" aria-hidden>
        <g fill="var(--muted)" stroke="var(--border)" strokeWidth="0.6">
          <ellipse cx="50" cy="12" rx="8" ry="9.5" />
          <rect x="46" y="20" width="8" height="6" rx="2" />
          <path d="M34 27 Q50 24 66 27 L64 56 Q50 60 36 56 Z" />
          <path d="M34 27 L24 52 L20 66 L25 67 L30 54 L36 36 Z" />
          <path d="M66 27 L76 52 L80 66 L75 67 L70 54 L64 36 Z" />
          <path d="M36 56 L64 56 L60 96 L53 96 L50 64 L47 96 L40 96 Z" />
          <ellipse cx="88" cy="8" rx="8" ry="6" />
        </g>
        <text x="88" y="17.5" fontSize="3.4" textAnchor="middle" fill="var(--muted-foreground)">
          back
        </text>
      </svg>
      {SPOTS.map((s) => (
        <button
          key={s.region}
          type="button"
          aria-label={s.label}
          aria-pressed={value === s.region}
          onClick={() => onPick(s.region)}
          className={cx(
            'absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 transition-transform hover:scale-110',
            value === s.region ? 'border-primary bg-primary' : used.includes(s.region) ? 'border-secondary bg-secondary/60' : 'border-card bg-foreground/25',
          )}
          style={{ left: `${s.x}%`, top: `${(s.y / 104) * 100}%`, width: `${(s.r ?? 5) * 2.4}px`, height: `${(s.r ?? 5) * 2.4}px`, minWidth: 18, minHeight: 18 }}
        />
      ))}
    </div>
  )
}
