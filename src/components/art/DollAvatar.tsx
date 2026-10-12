import { Doll2D } from '../../art2d/Doll2D'
import { useResolvedUrl } from '../../hooks/useData'
import { cx } from '../../lib/ui'
import { lookFromSummary } from '../../shared/look2d'
import type { AvatarSummary, HairStyleId } from '../../shared/types'

type HairKind = 'round' | 'long' | 'short' | 'bob' | 'bun' | 'knots' | 'puffs' | 'none' | 'locs'

export function hairKind(style: HairStyleId): HairKind {
  switch (style) {
    case 'afro':
      return 'round'
    case 'puffs':
      return 'puffs'
    case 'high-puff':
    case 'bun':
    case 'natural-updo':
      return 'bun'
    case 'bantu-knots':
      return 'knots'
    case 'locs':
    case 'sisterlocs':
    case 'freeform-locs':
    case 'faux-locs':
    case 'knotless-braids':
    case 'box-braids':
    case 'fulani-braids':
    case 'twists':
      return 'locs'
    case 'lace-front':
    case 'sew-in':
    case 'silk-press':
      return 'long'
    case 'bob':
    case 'fringe-bob':
      return 'bob'
    case 'long-straight':
    case 'long-curly':
      return 'long'
    case 'ponytail':
      return 'bun'
    case 'bald':
      return 'none'
    default:
      return 'short'
  }
}

/** Head-and-shoulders drawing used for bubbles, chips and cards when no portrait render exists. */
export function AvatarArt({ avatar, className }: { avatar: AvatarSummary; className?: string }) {
  // Every doll draws in the painted 2D style; 3D-only dolls get a matching 2D look.
  return <Doll2D look={avatar.look ?? lookFromSummary(avatar)} crop="head" className={className} bg="#F5D4DA" />
}

interface DollAvatarProps {
  avatar: AvatarSummary | null | undefined
  portrait?: string | null
  name?: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  online?: boolean
  className?: string
}

const SIZES = { xs: 'size-8', sm: 'size-10', md: 'size-12', lg: 'size-16', xl: 'size-28' }

/** Round avatar: the rendered portrait when there is one, otherwise the drawing. */
export function DollAvatar({ avatar, portrait, name, size = 'md', online, className }: DollAvatarProps) {
  const src = useResolvedUrl(portrait)
  return (
    <span className={cx('relative inline-block shrink-0', SIZES[size], className)} role={name ? 'img' : undefined} aria-label={name}>
      <span className="block size-full overflow-hidden rounded-full bg-muted ring-2 ring-card">
        {src ? <img src={src} alt="" className="size-full object-cover" draggable={false} /> : avatar ? <AvatarArt avatar={avatar} className="size-full" /> : null}
      </span>
      {online !== undefined && (
        <span
          aria-label={online ? 'online' : undefined}
          className={cx('absolute right-0 bottom-0 size-[28%] min-h-2.5 min-w-2.5 rounded-full ring-2 ring-card', online ? 'bg-[#22C55E]' : 'bg-transparent ring-0')}
        />
      )}
    </span>
  )
}
