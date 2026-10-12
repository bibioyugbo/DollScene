import type { ReactNode } from 'react'
import { Link, NavLink, useLocation } from 'react-router'
import { useLevel } from '../hooks/useLevel'
import { formatGlam, cx } from '../lib/ui'
import { useSession } from '../store/useSession'
import { DollAvatar } from './art/DollAvatar'
import { Icon, type IconName } from './Icon'
import { Icon3D, type PlaceIcon } from './NavIcons3D'

/** The four places, each with its own little 3D icon. */
export const NAV: { to: string; label: string; icon: PlaceIcon; badge?: 'social'; match: string[] }[] = [
  { to: '/crib', label: 'Crib', icon: 'crib', match: ['crib', 'wardrobe', 'makeover', 'beauty-doctor', 'work'] },
  { to: '/shop', label: 'Drip', icon: 'drip', match: ['shop'] },
  { to: '/friends', label: 'Chat', icon: 'chat', badge: 'social', match: ['friends', 'u', 'feed'] },
  { to: '/dollscene', label: 'DollScene', icon: 'dollscene', match: ['dollscene'] },
]

function Count({ n }: { n: number }) {
  if (!n) return null
  return (
    <span className="absolute -top-1 -right-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[11px] font-bold text-primary-foreground ring-2 ring-card">
      {n > 99 ? '99+' : n}
    </span>
  )
}

export function WalletChip() {
  const dollies = useSession((s) => s.progress?.dollies ?? 0)
  const gems = useSession((s) => s.progress?.gems ?? 0)
  return (
    <Link to="/wallet" className="flex min-h-10 items-center gap-2 rounded-full border border-border bg-card/90 px-3 text-sm font-bold tabular-nums" aria-label={`${dollies} Glam, ${gems} Gems. Open wallet`}>
      <span className="flex items-center gap-1">
        <Coin />
        {formatGlam(dollies)}
      </span>
      <span className="hidden items-center gap-1 sm:flex">
        <Icon name="gem" className="size-4 text-secondary" />
        {gems}
      </span>
    </Link>
  )
}

function Coin({ big }: { big?: boolean }) {
  return (
    <span aria-hidden className={cx('grid place-items-center rounded-full bg-[radial-gradient(circle_at_35%_30%,#FFF1B8,#F5C842_45%,#B8860B)] font-black text-[#5A3A00] shadow-[inset_0_-2px_0_rgb(0_0_0/0.2),0_2px_4px_rgb(0_0_0/0.2)]', big ? 'size-8 text-sm' : 'size-5 text-[11px]')}>
      G
    </span>
  )
}

/** Level and coins, top right of every place. */
function Hud({ actions }: { actions?: ReactNode }) {
  const dollies = useSession((s) => s.progress?.dollies ?? 0)
  const gems = useSession((s) => s.progress?.gems ?? 0)
  const unreadN = useSession((s) => s.unreadNotifications)
  const lvl = useLevel()
  return (
    <div className="pointer-events-none fixed top-3 right-3 z-40 flex items-start gap-2 pt-safe">
      {actions && <div className="pointer-events-auto">{actions}</div>}
      <Link
        to="/wallet"
        aria-label={`Level ${lvl.level}. ${dollies} Glam, ${gems} Gems`}
        className="pointer-events-auto flex items-center gap-2.5 rounded-2xl border border-white/15 bg-black/30 py-1.5 pr-3 pl-1.5 text-white shadow-[0_6px_18px_rgb(0_0_0/0.18)] backdrop-blur-md"
      >
        <span className="grid size-9 place-items-center rounded-xl bg-white/90 font-spicy text-base leading-none text-ink shadow-[inset_0_-3px_0_rgb(0_0_0/0.18)]">{lvl.level}</span>
        <span className="flex flex-col gap-1">
          <span className="text-[10px] font-black tracking-wider text-white/70 uppercase">Level {lvl.level}</span>
          <span className="block h-1.5 w-16 overflow-hidden rounded-full bg-white/20">
            <span className="block h-full rounded-full bg-primary" style={{ width: `${Math.round(lvl.progress * 100)}%` }} />
          </span>
        </span>
        <span className="h-8 w-px bg-white/20" />
        <Coin big />
        <span className="font-display text-lg leading-none font-black tabular-nums">{formatGlam(dollies)}</span>
        <span className="hidden items-center gap-1 text-sm font-bold sm:flex">
          <Icon name="gem" className="size-4 text-[#F5A3C7]" />
          {gems}
        </span>
      </Link>
      <Link
        to="/notifications"
        aria-label={`Notifications${unreadN ? `, ${unreadN} unread` : ''}`}
        className="pointer-events-auto relative grid size-12 place-items-center rounded-2xl border border-white/15 bg-black/30 text-white shadow-[0_6px_18px_rgb(0_0_0/0.18)] backdrop-blur-md"
      >
        <Icon name="bell" />
        <Count n={unreadN} />
      </Link>
    </div>
  )
}

/** The small floating panel on the left: four 3D icons to move between places. */
function PlacePanel() {
  const { pathname } = useLocation()
  const seg = pathname.split('/')[1] ?? ''
  const pub = useSession((s) => s.publicDoll)
  const uid = useSession((s) => s.user?.uid)
  const counts = { social: useSession((s) => s.pendingRequests + s.unreadMessages) }
  return (
    <nav aria-label="Places" className="fixed top-1/2 left-2 z-40 flex -translate-y-1/2 flex-col items-center gap-1 rounded-[24px] border border-white/15 bg-black/25 p-1.5 shadow-[0_8px_24px_rgb(0_0_0/0.18)] backdrop-blur-md md:left-3">
      {NAV.map((n) => {
        const active = n.match.includes(seg)
        return (
          <NavLink
            key={n.to}
            to={n.to}
            aria-label={n.label}
            aria-current={active ? 'page' : undefined}
            className={cx(
              'group relative flex w-14 flex-col items-center rounded-[20px] pt-1 pb-0.5 transition-transform duration-150 hover:-translate-y-0.5 active:scale-95 md:w-16',
              active ? 'bg-white/20 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.35)]' : 'hover:bg-white/10',
            )}
          >
            <span className={cx('relative transition-transform duration-200', active ? 'scale-110 drop-shadow-[0_4px_8px_rgb(0_0_0/0.35)]' : 'opacity-85 group-hover:scale-105 group-hover:opacity-100')}>
              <Icon3D name={n.icon} className="size-10 md:size-12" />
              {n.badge && <Count n={counts[n.badge]} />}
            </span>
            <span className={cx('text-[10px] leading-tight font-bold text-white [text-shadow:0_1px_2px_rgb(0_0_0/0.5)]', active ? 'opacity-100' : 'opacity-75')}>{n.label}</span>
          </NavLink>
        )
      })}
      <span className="my-0.5 h-px w-8 bg-white/20" />
      {uid && (
        <Link to={`/u/${uid}`} aria-label="Your profile" className="rounded-full transition-transform hover:scale-105">
          <DollAvatar avatar={pub?.avatar} portrait={pub?.portrait} size="sm" />
        </Link>
      )}
      <Link to="/settings" aria-label="Settings" className="grid size-9 place-items-center rounded-full text-white/75 hover:bg-white/10 hover:text-white">
        <Icon name="settings" className="size-5" />
      </Link>
    </nav>
  )
}

/**
 * Signed-in frame: every place fills the whole screen. A small panel of 3D icons
 * floats on the left, level and coins float top right. No sidebar, no top bar.
 */
export function AppShell({ children, title, full = false, actions }: { children: ReactNode; title?: string; full?: boolean; actions?: ReactNode }) {
  return (
    <div className="relative h-dvh w-full overflow-hidden bg-background text-foreground">
      {title && <h1 className="sr-only">{title}</h1>}
      <main className={cx('absolute inset-0', full ? 'overflow-hidden' : 'overflow-y-auto overscroll-contain pt-20 pl-[76px] md:pl-24')}>{children}</main>
      <PlacePanel />
      <Hud actions={actions} />
    </div>
  )
}

export function PageBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('mx-auto w-full max-w-5xl px-4 py-5 md:px-6 md:py-8', className)}>{children}</div>
}

export function EmptyState({ icon, title, body, action }: { icon: IconName; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-[var(--radius-sheet)] border border-dashed border-border px-6 py-10 text-center">
      <span className="grid size-14 place-items-center rounded-full bg-primary/15 text-primary">
        <Icon name={icon} className="size-7" />
      </span>
      <p className="font-display text-lg font-bold">{title}</p>
      {body && <p className="max-w-sm text-sm text-muted-foreground">{body}</p>}
      {action}
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden className={cx('block animate-pulse rounded-2xl bg-muted', className)} />
}
