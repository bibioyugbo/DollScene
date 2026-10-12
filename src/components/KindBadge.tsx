import { cx } from '../lib/ui'
import type { PublicDoll } from '../shared/types'

/** Player or Resident: residents are always labelled so nobody mistakes them for real people. */
export function KindBadge({ kind, className }: { kind: PublicDoll['kind'] | undefined; className?: string }) {
  const npc = kind === 'npc'
  return (
    <span
      title={npc ? 'A curated in-world resident. Not a real person.' : 'A real player'}
      className={cx(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold tracking-wide uppercase',
        npc ? 'bg-chrome/40 text-foreground ring-1 ring-chrome' : 'bg-primary/15 text-primary',
        className,
      )}
    >
      <span aria-hidden className={cx('size-1.5 rounded-full', npc ? 'bg-foreground/60' : 'bg-primary')} />
      {npc ? 'Resident · NPC' : 'Player'}
    </span>
  )
}
