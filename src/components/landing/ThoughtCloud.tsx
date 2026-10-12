import { forwardRef, useEffect } from 'react'
import { AESTHETIC_LABEL } from '../../shared/aesthetics'
import { nearestCity } from '../../shared/cities'
import type { PublicDoll } from '../../shared/types'
import { DollAvatar } from '../art/DollAvatar'

/** "Soft glam core", "Y2K core"…: the one-line vibe of a doll. */
export function coreOf(d: PublicDoll): string {
  const a = d.aesthetics?.[0]
  return `${a ? AESTHETIC_LABEL[a] : d.styleTag || 'Main character'} core`
}

/** Where the doll actually sits on the globe: the city nearest its pin, so the card never disagrees with the map. */
function placeOf(d: PublicDoll): string {
  const c = nearestCity(d.lat, d.lng)
  return `${c.name}, ${c.country}`
}

const CLOUD = 'M62 176C26 176 8 148 22 122C2 104 16 62 54 66C58 28 106 14 132 38C152 8 208 10 218 46C258 38 294 70 276 104C300 124 286 172 246 172C226 186 92 188 62 176Z'

interface Props {
  doll: PublicDoll
  /** Cloud opens to the left of the doll when it is near the right edge. */
  flip: boolean
  befriendLabel: string
  befriendDisabled?: boolean
  onBefriend: () => void
  onClose: () => void
}

/**
 * A thinking cloud that rises from a tapped doll: two little puffs, then the big
 * cloud with their name, core, level and city. The parent positions the root at the doll.
 */
export const ThoughtCloud = forwardRef<HTMLDivElement, Props>(function ThoughtCloud({ doll, flip, befriendLabel, befriendDisabled, onBefriend, onClose }, ref) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])
  const side = flip ? -1 : 1
  const puff = 'absolute rounded-full bg-white shadow-[0_4px_14px_rgb(255_95_162/0.25)] ring-2 ring-[#FFD3E5] motion-safe:animate-[cloud-pop_.28s_ease-out_both]'
  return (
    <div ref={ref} className="pointer-events-none absolute top-0 left-0 z-20" style={{ visibility: 'hidden' }}>
      <span className={puff} style={{ width: 12, height: 12, left: side * 14 - 6, top: -26 }} />
      <span className={puff} style={{ width: 22, height: 20, left: side * 30 - 11, top: -58, animationDelay: '0.14s' }} />
      <div
        role="dialog"
        aria-label={doll.name}
        className="pointer-events-auto absolute w-[280px] motion-safe:animate-[cloud-pop_.34s_ease-out_both]"
        style={{ height: 210, top: -275, left: flip ? undefined : 18, right: flip ? 18 : undefined, animationDelay: '0.28s', transformOrigin: flip ? '90% 100%' : '10% 100%' }}
      >
        <div className="relative size-full motion-safe:animate-[cloud-float_3.2s_ease-in-out_0.7s_infinite]">
          <svg viewBox="0 0 300 192" className="absolute inset-0 size-full drop-shadow-[0_10px_24px_rgb(255_95_162/0.28)]" aria-hidden preserveAspectRatio="none">
            <path d={CLOUD} fill="#FFFFFF" stroke="#FFD3E5" strokeWidth="4" />
          </svg>
          <button type="button" onClick={onClose} aria-label="Close" className="absolute top-9 right-9 grid size-7 place-items-center rounded-full text-sm text-ink/50 hover:bg-[#FFE3EF]">
            ✕
          </button>
          <div className="relative flex h-full flex-col items-center justify-center gap-1 px-12 pt-6 pb-4 text-center text-ink">
            <div className="flex items-center gap-2">
              <DollAvatar avatar={doll.avatar} portrait={doll.portrait} size="sm" />
              <p className="max-w-[140px] truncate font-spicy text-xl leading-tight">{doll.name.split(' ')[0]}</p>
            </div>
            <p className="text-sm font-semibold text-[#E8418A]">{coreOf(doll)}</p>
            <div className="flex flex-wrap items-center justify-center gap-1.5 text-[11px] font-bold">
              <span className="rounded-full bg-[#FFE3EF] px-2 py-0.5">Level {doll.careerLevel || 1}</span>
              <span className="max-w-[170px] truncate rounded-full bg-[#FFE3EF] px-2 py-0.5">📍 {placeOf(doll)}</span>
            </div>
            <button
              type="button"
              onClick={onBefriend}
              disabled={befriendDisabled}
              className="mt-1 rounded-full border-2 border-[#C21767] bg-primary px-5 py-1.5 font-spicy text-base text-white shadow-[0_4px_0_#C21767] transition-[transform,box-shadow] duration-100 active:translate-y-[3px] active:shadow-[0_1px_0_#C21767] disabled:bg-white disabled:text-ink disabled:shadow-none"
            >
              {befriendLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
})
