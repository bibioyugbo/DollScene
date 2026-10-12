type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

const base =
  'inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-[filter,background-color,transform] duration-150 ' +
  'disabled:opacity-50 disabled:pointer-events-none select-none active:scale-[0.98]'

const variants: Record<Variant, string> = {
  primary:
    'bg-primary text-primary-foreground hover:brightness-105 active:brightness-95 shadow-[0_4px_14px_rgb(255_46_136/0.35),inset_0_1px_0_rgb(255_255_255/0.45)]',
  secondary: 'bg-card text-foreground border border-border hover:bg-muted active:bg-muted',
  ghost: 'text-foreground hover:bg-muted active:bg-muted',
  danger: 'bg-[#B3123F] text-white hover:brightness-110',
}

const sizes = {
  sm: 'min-h-9 px-3 text-sm',
  md: 'min-h-11 px-5 text-[15px]',
  lg: 'min-h-14 px-7 text-base md:text-lg',
}

export function buttonClass(variant: Variant = 'primary', size: keyof typeof sizes = 'md', extra = ''): string {
  return `${base} ${variants[variant]} ${sizes[size]} ${extra}`.trim()
}

export const inputClass = 'min-h-12 w-full rounded-2xl border border-border bg-background px-4 text-base outline-none focus:border-primary'

export const cardClass = 'rounded-[var(--radius-sheet)] border border-border bg-card'

export const chipClass = (active: boolean) =>
  cx(
    'inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold transition-colors',
    active ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background hover:bg-muted',
  )

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ')
}

export function formatGlam(n: number): string {
  return n.toLocaleString('en-GB')
}

export function timeAgo(ts: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - ts) / 1000))
  if (s < 45) return 'just now'
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h`
  const d = Math.round(h / 24)
  if (d < 7) return `${d}d`
  return new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

export function clockTime(ts: number): string {
  return new Date(ts).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}
