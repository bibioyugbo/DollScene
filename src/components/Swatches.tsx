import type { ReactNode } from 'react'
import { cx } from '../lib/ui'
import { Icon } from './Icon'

interface SwatchesProps {
  label: string
  colors: string[]
  value: string | null
  onChange: (color: string) => void
  /** Show a "none" swatch that sends null. */
  allowNone?: boolean
  onNone?: () => void
  /** Show a full colour picker. */
  custom?: boolean
  locked?: (c: string) => boolean
}

export function Swatches({ label, colors, value, onChange, allowNone, onNone, custom, locked }: SwatchesProps) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-semibold">{label}</legend>
      <div className="flex flex-wrap gap-1.5">
        {allowNone && (
          <button
            type="button"
            aria-label={`${label}: none`}
            aria-pressed={value === null}
            onClick={onNone}
            className={cx('grid size-11 place-items-center rounded-full border-2', value === null ? 'border-primary' : 'border-transparent')}
          >
            <span className="grid size-8 place-items-center rounded-full border border-border bg-background text-muted-foreground">
              <Icon name="block" className="size-4" />
            </span>
          </button>
        )}
        {colors.map((c) => {
          const active = !!value && c.toLowerCase() === value.toLowerCase()
          const isLocked = locked?.(c) ?? false
          return (
            <button
              key={c}
              type="button"
              aria-label={`${label} ${c}${isLocked ? ' (locked)' : ''}`}
              aria-pressed={active}
              disabled={isLocked}
              onClick={() => onChange(c)}
              className={cx('relative grid size-11 place-items-center rounded-full border-2 transition-colors', active ? 'border-primary' : 'border-transparent')}
            >
              <span className="size-8 rounded-full border border-border shadow-[inset_0_2px_4px_rgb(255_255_255/0.35)]" style={{ background: c }} />
              {isLocked && (
                <span className="absolute inset-0 grid place-items-center text-white">
                  <Icon name="lock" className="size-4 drop-shadow" />
                </span>
              )}
            </button>
          )
        })}
        {custom && (
          <label className="relative grid size-11 cursor-pointer place-items-center rounded-full border-2 border-transparent" aria-label={`${label}: custom colour`}>
            <span className="size-8 rounded-full border border-border bg-[conic-gradient(red,yellow,lime,cyan,blue,magenta,red)]" />
            <input type="color" value={value ?? '#000000'} onChange={(e) => onChange(e.target.value.toUpperCase())} className="absolute inset-0 cursor-pointer opacity-0" />
          </label>
        )}
      </div>
    </fieldset>
  )
}

interface ChoiceChipsProps<T extends string> {
  label: string
  options: { id: T; label: string; locked?: boolean }[]
  value: T
  onChange: (id: T) => void
  hideLabel?: boolean
}

export function ChoiceChips<T extends string>({ label, options, value, onChange, hideLabel }: ChoiceChipsProps<T>) {
  return (
    <fieldset>
      <legend className={cx('mb-2 text-sm font-semibold', hideLabel && 'sr-only')}>{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const active = o.id === value
          return (
            <button
              key={o.id}
              type="button"
              aria-pressed={active}
              disabled={o.locked}
              onClick={() => onChange(o.id)}
              className={cx(
                'inline-flex min-h-10 items-center gap-1 rounded-full border px-3.5 text-sm font-semibold transition-colors disabled:opacity-50',
                active ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background hover:bg-muted',
              )}
            >
              {o.locked && <Icon name="lock" className="size-3.5" />}
              {o.label}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}

interface MultiChipsProps<T extends string> {
  label: string
  options: { id: T; label: string; locked?: boolean }[]
  value: T[]
  onChange: (ids: T[]) => void
}

export function MultiChips<T extends string>({ label, options, value, onChange }: MultiChipsProps<T>) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-semibold">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const active = value.includes(o.id)
          return (
            <button
              key={o.id}
              type="button"
              aria-pressed={active}
              disabled={o.locked && !active}
              onClick={() => onChange(active ? value.filter((v) => v !== o.id) : [...value, o.id])}
              className={cx(
                'inline-flex min-h-10 items-center gap-1 rounded-full border px-3.5 text-sm font-semibold transition-colors disabled:opacity-50',
                active ? 'border-secondary bg-secondary text-secondary-foreground' : 'border-border bg-background hover:bg-muted',
              )}
            >
              {o.locked && !active && <Icon name="lock" className="size-3.5" />}
              {o.label}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}

interface SliderProps {
  label: string
  min?: number
  max?: number
  step?: number
  value: number
  onChange: (v: number) => void
  format?: (v: number) => string
}

export function Slider({ label, min = 0, max = 1, step = 0.01, value, onChange, format }: SliderProps) {
  return (
    <label className="block">
      <span className="flex items-center justify-between text-sm font-semibold">
        {label}
        <span className="font-normal text-muted-foreground tabular-nums">{format ? format(value) : `${Math.round(((value - min) / (max - min)) * 100)}%`}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  )
}

export function Toggle({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center justify-between gap-4">
      <span>
        <span className="block text-sm font-semibold">{label}</span>
        {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
      </span>
      <span className="relative inline-flex">
        <input type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="h-7 w-12 rounded-full bg-muted transition-colors peer-checked:bg-primary peer-focus-visible:outline peer-focus-visible:outline-3 peer-focus-visible:outline-secondary" />
        <span className="absolute top-1 left-1 size-5 rounded-full bg-card shadow transition-transform peer-checked:translate-x-5" />
      </span>
    </label>
  )
}

export function Section({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-display text-base font-bold">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  )
}

export function Select({ label, value, options, onChange }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-12 w-full appearance-none rounded-2xl border border-border bg-background bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22><path d=%22M6 9l6 6 6-6%22 stroke=%22%23888%22 stroke-width=%222%22 fill=%22none%22/></svg>')] bg-[length:20px] bg-[right_12px_center] bg-no-repeat px-4 pr-10 text-base outline-none focus:border-primary"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}
