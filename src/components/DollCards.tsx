import { Link } from 'react-router'
import { isOnline } from '../app/SessionProvider'
import { careerTitle } from '../shared/careers'
import type { PublicDoll } from '../shared/types'
import { DollAvatar } from './art/DollAvatar'
import { KindBadge } from './KindBadge'

/** Compact tile for grids (Explore, region sheets, friends). */
export function DollTile({ doll, onClick, href }: { doll: PublicDoll; onClick?: () => void; href?: string }) {
  const body = (
    <>
      <DollAvatar avatar={doll.avatar} portrait={doll.portrait} size="lg" online={isOnline(doll)} />
      <span className="mt-2 w-full truncate text-center font-semibold">{doll.name}</span>
      {doll.username && <span className="w-full truncate text-center text-xs text-muted-foreground">@{doll.username}</span>}
      <KindBadge kind={doll.kind} className="mt-1" />
      <span className="w-full truncate text-center text-xs text-muted-foreground">{doll.city || 'Location hidden'}</span>
      <span className="mt-1 w-full truncate text-center text-xs font-semibold text-secondary">{careerTitle(doll.career, doll.careerLevel)}</span>
    </>
  )
  const cls = 'flex flex-col items-center rounded-[var(--radius-sheet)] border border-border bg-card p-3 transition-colors hover:border-primary'
  return href ? (
    <Link to={href} className={cls}>
      {body}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={cls}>
      {body}
    </button>
  )
}
