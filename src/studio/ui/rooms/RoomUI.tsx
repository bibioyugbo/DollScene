import { useEffect, useMemo, useRef, useState } from 'react'
import type { CharacterCatalog } from '../../character/catalog'
import { ROOMS, type RoomId } from '../../rooms'
import { saveLook } from '../../session'
import { useStudio, type Angle, type Category } from '../../state/store'
import { CATEGORY_ICON, Icon } from '../icons'
import { click, haptic, sfx } from '../sound'
import { CATEGORY_NAMES, tilesFor, type Tile } from './tiles'

/**
 * A room behind a Hub door. No side panel: categories on a floating rail at the left, and the
 * category's products and actions as a grid of medium icon tiles (right on wide screens, along
 * the bottom on phones). Tap a tile: the step runs once, start to finish, with its animation and
 * sound; taps while it plays are held off so nothing restarts half-way.
 */

export const TILE_GRID_W = 4 * 100 + 3 * 10 + 24
export const RAIL_W = 64

const TURN: Angle[] = ['front', 'three-quarter', 'side', 'back']

function Rail({ room }: { room: RoomId }) {
  const category = useStudio((s) => s.category)
  const setCategory = useStudio((s) => s.setCategory)
  const cats = ROOMS[room].categories
  return (
    <nav aria-label={`${ROOMS[room].name} categories`} className="pointer-events-auto absolute bottom-3 left-2 top-[calc(max(env(safe-area-inset-top),8px)+60px)] z-20 flex w-[52px] flex-col">
      <ul className="ds-scroll-y flex flex-1 flex-col items-center gap-2 py-1" role="tablist" aria-orientation="vertical">
        {cats.map((c) => {
          const on = c === category
          return (
            <li key={c} className="group relative">
              <button
                type="button"
                role="tab"
                aria-selected={on}
                aria-label={CATEGORY_NAMES[c]}
                onClick={() => {
                  click('select')
                  setCategory(c)
                }}
                className={`ds-fab grid h-11 w-11 place-items-center rounded-full ${on ? 'ring-2 ring-accent' : ''}`}
              >
                <Icon name={CATEGORY_ICON[c]} className="h-[21px] w-[21px]" />
              </button>
              <span className="pointer-events-none absolute left-[52px] top-1/2 z-30 -translate-y-1/2 whitespace-nowrap rounded-full bg-text px-2.5 py-1 text-[12px] font-bold text-ink opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-has-[:focus-visible]:opacity-100">
                {CATEGORY_NAMES[c]}
              </span>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

function Palette({ tile, open, onClose }: { tile: Tile; open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const off = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && onClose()
    window.addEventListener('pointerdown', off)
    return () => window.removeEventListener('pointerdown', off)
  }, [open, onClose])
  if (!open || !tile.palette) return null
  return (
    <div ref={ref} role="listbox" aria-label={tile.palette.label} className="ds-pop absolute right-0 top-full z-40 mt-1 grid w-[148px] grid-cols-4 gap-1.5 rounded-2xl bg-black/80 p-2 shadow-2xl backdrop-blur">
      {tile.palette.colors.map((c) => (
        <button
          key={c.color}
          type="button"
          role="option"
          aria-selected={tile.palette!.value?.toUpperCase() === c.color.toUpperCase()}
          aria-label={c.name}
          title={c.name}
          onClick={() => {
            click('select')
            onClose()
            tile.palette!.onPick(c.color)
          }}
          className="aspect-square rounded-full ring-1 ring-white/20 transition-transform active:scale-90 aria-selected:ring-2 aria-selected:ring-white"
          style={{ background: c.color }}
        />
      ))}
    </div>
  )
}

function TileButton({ tile, busy, compact }: { tile: Tile; busy: boolean; compact: boolean }) {
  const [open, setOpen] = useState(false)
  const notify = useStudio((s) => s.notify)
  const tap = () => {
    if (busy) return notify('One moment: finishing this step first.', 'info')
    if (tile.blocked) return notify(tile.blocked, 'info')
    click('tap')
    haptic(8)
    if (tile.sfx) sfx(tile.sfx)
    void tile.run()
  }
  const size = compact ? 'h-[78px] w-[78px]' : 'h-[92px] w-[92px]'
  return (
    <div className={`relative flex flex-col items-center gap-1 ${compact ? 'w-[82px]' : 'w-[100px]'}`}>
      <button
        type="button"
        onClick={tap}
        aria-pressed={tile.on}
        aria-label={tile.label + (tile.blocked ? ` (${tile.blocked})` : '')}
        className={`ds-tile relative ${size} rounded-[22px] p-2 transition-transform active:scale-95 ${tile.on ? 'ds-tile-on' : ''} ${tile.blocked ? 'opacity-45' : ''}`}
      >
        {tile.art}
        {tile.badge && <span className="absolute -left-1 -top-1 rounded-full bg-accent px-1.5 py-px text-[10px] font-extrabold text-accent-ink shadow">{tile.badge}</span>}
      </button>
      {tile.palette && (
        <>
          <button
            type="button"
            aria-label={`Choose a colour for ${tile.label}`}
            aria-expanded={open}
            onClick={() => (click('tap'), setOpen((o) => !o))}
            className="absolute right-0 top-[60px] grid h-7 w-7 place-items-center rounded-full shadow-lg ring-2 ring-white"
            style={{ background: tile.palette.value ?? 'conic-gradient(#0A0A0C, #B9854A, #E07AA6, #1E7A7A, #6A3FB0, #0A0A0C)' }}
          >
            <svg viewBox="0 0 12 12" className="h-3 w-3 text-white drop-shadow" aria-hidden>
              <path d="M3 4.5 6 7.5 9 4.5" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" />
            </svg>
          </button>
          <Palette tile={tile} open={open} onClose={() => setOpen(false)} />
        </>
      )}
      <span className={`line-clamp-2 text-center font-bold leading-tight text-white drop-shadow-[0_1px_4px_rgb(0_0_0/0.7)] ${compact ? 'text-[10.5px]' : 'text-[11.5px]'}`}>{tile.label}</span>
    </div>
  )
}

export function RoomUI({ catalog, wide, onHub, onScene }: { catalog: CharacterCatalog; wide: boolean; onHub: () => void; onScene: () => void }) {
  const room = useStudio((s) => s.room)!
  const category = useStudio((s) => s.category)
  const look = useStudio((s) => s.look)
  const action = useStudio((s) => s.action)
  const tiles = useMemo(() => tilesFor(room, category, look, catalog), [room, category, look, catalog])
  const busy = !!action
  const def = ROOMS[room]
  return (
    <>
      <TopBar room={room} onHub={onHub} onScene={onScene} />
      <Rail room={room} />
      <section aria-label={CATEGORY_NAMES[category]} className={`pointer-events-none absolute z-20 flex flex-col ${wide ? 'bottom-4 right-3 top-[calc(max(env(safe-area-inset-top),8px)+64px)]' : 'inset-x-0 bottom-[max(env(safe-area-inset-bottom),8px)] pl-[60px]'}`} style={wide ? { width: TILE_GRID_W } : undefined}>
        <h2 className={`px-3 pb-2 font-black tracking-tight text-white drop-shadow-[0_2px_10px_rgb(0_0_0/0.6)] ${wide ? 'text-[26px]' : 'text-[18px]'}`}>
          {CATEGORY_NAMES[category]}
          <span className="ml-2 align-middle text-[12px] font-bold text-white/70">{def.name}</span>
        </h2>
        {wide ? (
          <div key={category} className="ds-scroll-y ds-enter pointer-events-auto grid flex-1 auto-rows-min grid-cols-4 content-start gap-x-2.5 gap-y-3 px-3 pb-24">
            {tiles.map((t) => (
              <TileButton key={t.id} tile={t} busy={busy} compact={false} />
            ))}
          </div>
        ) : (
          <div key={category} className="ds-scroll-x ds-enter pointer-events-auto grid grid-flow-col grid-rows-2 gap-x-2 gap-y-2 px-3 pb-1" style={{ gridAutoColumns: '82px' }}>
            {tiles.map((t) => (
              <TileButton key={t.id} tile={t} busy={busy} compact />
            ))}
          </div>
        )}
        {!tiles.length && <p className="px-3 text-[13px] font-semibold text-white/80">Nothing here yet.</p>}
      </section>
    </>
  )
}

function TopBar({ room, onHub, onScene }: { room: RoomId; onHub: () => void; onScene: () => void }) {
  const look = useStudio((s) => s.look)
  const canUndo = useStudio((s) => s.past.length > 0)
  const undo = useStudio((s) => s.undo)
  const angle = useStudio((s) => s.angle)
  const setAngle = useStudio((s) => s.setAngle)
  const comparing = useStudio((s) => s.comparing)
  const setComparing = useStudio((s) => s.setComparing)
  const enterRoom = useStudio((s) => s.enterRoom)
  const action = useStudio((s) => s.action)
  const door = ROOMS[room].door
  const btn = 'ds-fab grid h-10 w-10 shrink-0 place-items-center rounded-full disabled:opacity-35'
  return (
    <header className="pointer-events-auto absolute inset-x-0 top-0 z-20 flex items-center gap-1.5 px-2.5 pt-[max(env(safe-area-inset-top),8px)]">
      <button type="button" onClick={() => (click('tap'), onHub())} aria-label="Back to the Hub" className="ds-fab flex min-h-10 items-center gap-1 rounded-full pl-2 pr-3 text-[13px] font-bold">
        <Icon name="back" className="h-4 w-4" />
        <span className="hidden sm:inline">Hub</span>
        <Icon name="hub" className="h-4 w-4 sm:hidden" />
      </button>
      {door === 'glam' && (
        <div role="tablist" aria-label="Glam Studio" className="flex rounded-full bg-black/40 p-1 backdrop-blur">
          {(['makeup', 'hair'] as const).map((r) => (
            <button key={r} type="button" role="tab" aria-selected={room === r} onClick={() => (click('select'), enterRoom(r))} className={`min-h-8 rounded-full px-3 text-[12px] font-extrabold ${room === r ? 'bg-white text-[#1c1220]' : 'text-white/85'}`}>
              <span className="sm:hidden">{r === 'makeup' ? 'Makeup' : 'Hair'}</span>
              <span className="hidden sm:inline">{r === 'makeup' ? 'Makeup Studio' : 'Hair Studio'}</span>
            </button>
          ))}
        </div>
      )}
      <span className="flex-1" />
      <button type="button" aria-label="Undo" title="Undo" disabled={!canUndo || !!action} onClick={undo} className={btn}>
        <Icon name="undo" className="h-[18px] w-[18px]" />
      </button>
      <button type="button" aria-label={`Turn (now ${angle})`} title="Turn" onClick={() => setAngle(TURN[(TURN.indexOf(angle) + 1) % TURN.length])} className={`${btn} hidden sm:grid`}>
        <Icon name="turn" className="h-[18px] w-[18px]" />
      </button>
      <button
        type="button"
        aria-label="Hold to see before"
        title="Hold to see before"
        aria-pressed={comparing}
        className={btn}
        onPointerDown={(e) => {
          ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
          setComparing(true)
        }}
        onPointerUp={() => setComparing(false)}
        onPointerCancel={() => setComparing(false)}
        onContextMenu={(e) => e.preventDefault()}
      >
        <Icon name="compare" className="h-[18px] w-[18px]" />
      </button>
      <button type="button" aria-label="Save look" title="Save look" onClick={() => saveLook(`${look.profile.name || 'My'} look`)} className={`${btn} hidden sm:grid`}>
        <Icon name="save" className="h-[18px] w-[18px]" />
      </button>
      <button type="button" onClick={() => (click('go'), onScene())} aria-label="Make a Scene" className="ds-cta flex min-h-10 shrink-0 items-center gap-1.5 rounded-full px-3 text-[14px] font-black sm:px-4">
        <Icon name="photo" className="h-[18px] w-[18px] sm:hidden" />
        <span className="hidden sm:inline">Make a Scene</span>
      </button>
    </header>
  )
}

export type { Category }
