import { useId, type ReactNode } from 'react'
import { useStudio } from '../state/store'

/**
 * Touch-first controls. Sliders preview live while dragging and land in undo history
 * once, when the finger lifts.
 */

export function Slider({
  label,
  value,
  onChange,
  bipolar = false,
  min = 0,
  max = 1,
  step = 0.01,
  left,
  right,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  /** Fills from the middle (neutral 0.5) instead of from the left. */
  bipolar?: boolean
  min?: number
  max?: number
  step?: number
  left?: string
  right?: string
}) {
  const id = useId()
  const commit = useStudio((s) => s.commit)
  const t = ((value - min) / (max - min)) * 100
  const from = bipolar ? Math.min(50, t) : 0
  const to = bipolar ? Math.max(50, t) : t
  return (
    <div className="grid grid-cols-[6.2rem_1fr] items-center gap-x-3">
      <label htmlFor={id} className="truncate text-[13px] text-muted">
        {label}
      </label>
      <div>
        <input
          id={id}
          type="range"
          className="ds-range"
          min={min}
          max={max}
          step={step}
          value={value}
          style={{ '--fill-from': `${from}%`, '--fill-to': `${to}%` } as React.CSSProperties}
          onChange={(e) => onChange(Number(e.target.value))}
          onPointerUp={commit}
          onKeyUp={commit}
          onBlur={commit}
          onDoubleClick={() => {
            if (bipolar) {
              onChange((min + max) / 2)
              commit()
            }
          }}
          aria-valuetext={bipolar ? `${Math.round((t - 50) * 2)}` : `${Math.round(t)}%`}
        />
        {(left || right) && (
          <div className="-mt-1 flex justify-between text-[10px] uppercase tracking-[0.12em] text-muted/70">
            <span>{left}</span>
            <span>{right}</span>
          </div>
        )}
      </div>
    </div>
  )
}

export function Swatches({ colors, value, onPick, locked = [], onLocked, size = 30, label }: { colors: string[]; value: string; onPick: (c: string) => void; locked?: string[]; onLocked?: () => void; size?: number; label: string }) {
  const lockedSet = new Set(locked)
  return (
    <div role="radiogroup" aria-label={label} className="ds-scroll-x -mx-4 flex gap-2 px-4 py-1">
      {colors.map((c) => {
        const on = c.toUpperCase() === value.toUpperCase()
        const isLocked = lockedSet.has(c)
        return (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={isLocked ? `${c} (locked)` : c}
            onClick={() => (isLocked ? onLocked?.() : onPick(c))}
            className="relative shrink-0 rounded-full transition-transform active:scale-90"
            style={{ width: size, height: size, background: c, boxShadow: on ? `0 0 0 2px var(--ink), 0 0 0 3.5px var(--accent)` : 'inset 0 0 0 1px rgb(255 255 255 / 0.14)' }}
          >
            {isLocked && (
              <svg viewBox="0 0 16 16" className="absolute inset-0 m-auto h-3.5 w-3.5 text-white/90 drop-shadow" aria-hidden>
                <path fill="currentColor" d="M5 7V5a3 3 0 1 1 6 0v2h.5A1.5 1.5 0 0 1 13 8.5v4A1.5 1.5 0 0 1 11.5 14h-7A1.5 1.5 0 0 1 3 12.5v-4A1.5 1.5 0 0 1 4.5 7H5Zm1.5 0h3V5a1.5 1.5 0 0 0-3 0v2Z" />
              </svg>
            )}
          </button>
        )
      })}
    </div>
  )
}

export function Chips<T extends string>({ options, value, onPick, label }: { options: { id: T; name: string; hint?: string }[]; value: T | null; onPick: (id: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="ds-scroll-x -mx-4 flex gap-1.5 px-4 py-0.5">
      {options.map((o) => {
        const on = o.id === value
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onPick(o.id)}
            className={`min-h-10 shrink-0 rounded-full border px-3.5 text-[13px] transition-colors ${on ? 'border-accent bg-accent text-accent-ink' : 'border-line text-text active:bg-raised'}`}
          >
            {o.name}
          </button>
        )
      })}
    </div>
  )
}

export function Segmented<T extends string>({ options, value, onPick, label }: { options: { id: T; name: string }[]; value: T; onPick: (id: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-full border border-line p-0.5">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={o.id === value}
          onClick={() => onPick(o.id)}
          className={`min-h-9 flex-1 rounded-full px-2 text-[12px] tracking-wide transition-colors ${o.id === value ? 'bg-text text-ink' : 'text-muted'}`}
        >
          {o.name}
        </button>
      ))}
    </div>
  )
}

export function Section({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  )
}

export function TextButton({ children, onClick, tone = 'plain', disabled }: { children: ReactNode; onClick: () => void; tone?: 'plain' | 'accent' | 'rose'; disabled?: boolean }) {
  const cls = tone === 'accent' ? 'bg-accent text-accent-ink' : tone === 'rose' ? 'bg-rose text-white' : 'border border-line text-text'
  return (
    <button type="button" disabled={disabled} onClick={onClick} className={`min-h-11 rounded-full px-4 text-[13px] font-medium transition-opacity active:opacity-80 disabled:opacity-40 ${cls}`}>
      {children}
    </button>
  )
}
