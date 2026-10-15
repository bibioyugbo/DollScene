import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { CharacterCatalog } from '../../character/catalog'
import { isStore, ROOMS, type RoomId } from '../../rooms'
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

function Rail({ room, cats }: { room: RoomId; cats: Category[] }) {
  const category = useStudio((s) => s.category)
  const setCategory = useStudio((s) => s.setCategory)
  // the item's name on hover/focus, drawn outside the scrolling rail (which would clip it)
  const [tip, setTip] = useState<{ text: string; x: number; y: number } | null>(null)
  const show = (e: { currentTarget: HTMLElement }, text: string) => {
    const r = e.currentTarget.getBoundingClientRect()
    setTip({ text, x: r.right + 8, y: r.top + r.height / 2 })
  }
  return (
    <>
      {tip &&
        createPortal(
          <span
            role="tooltip"
            className="pointer-events-none fixed z-[60] -translate-y-1/2 whitespace-nowrap rounded-full bg-text px-2.5 py-1 text-[12px] font-bold text-ink shadow-lg"
            style={{ left: tip.x, top: tip.y }}
          >
            {tip.text}
          </span>,
          document.body,
        )}
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
                    setTip(null)
                  }}
                  onPointerEnter={(e) => e.pointerType === 'mouse' && show(e, CATEGORY_NAMES[c])}
                  onPointerLeave={() => setTip(null)}
                  onFocus={(e) => show(e, CATEGORY_NAMES[c])}
                  onBlur={() => setTip(null)}
                  className={`ds-fab grid h-11 w-11 place-items-center rounded-full ${on ? 'ring-2 ring-accent' : ''}`}
                >
                  <Icon name={CATEGORY_ICON[c]} className="h-[21px] w-[21px]" />
                </button>
              </li>
            )
          })}
        </ul>
      </nav>
    </>
  )
}

function Palette({ tile, open, onClose, anchor }: { tile: Tile; open: boolean; onClose: () => void; anchor: HTMLElement | null }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const off = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && onClose()
    window.addEventListener('pointerdown', off)
    return () => window.removeEventListener('pointerdown', off)
  }, [open, onClose])
  if (!open || !tile.palette) return null
  return createPortal(
    <div
      ref={ref}
      role="listbox"
      aria-label={tile.palette.label}
      className="ds-pop pointer-events-auto fixed z-50 grid w-[148px] grid-cols-4 gap-1.5 rounded-2xl bg-black/80 p-2 shadow-2xl backdrop-blur"
      style={popoverAt(anchor, 148)}
    >
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
    </div>,
    document.body,
  )
}

const SWATCHES = [
  '#111111',
  '#F4EFE6',
  '#FFFFFF',
  '#C8102E',
  '#E4572E',
  '#F28C28',
  '#FFC72C',
  '#D9B35B',
  '#1E7A3A',
  '#6FA36B',
  '#2DE1C2',
  '#1F4FA8',
  '#7FA3C9',
  '#6A3FB0',
  '#B9A2D8',
  '#E07AA6',
  '#F2A7BF',
  '#B0124A',
  '#5A3A22',
  '#8A8A8A',
]
const SLOT_NAMES = ['Main', 'Second', 'Accent'] as const

/** A three-colour chip (primary, secondary, accent) for colourways. */
function Chip({ colors, size = 28 }: { colors: readonly string[]; size?: number }) {
  return (
    <svg viewBox="0 0 20 20" width={size} height={size} aria-hidden className="drop-shadow">
      <path d="M10 10 L10 0 A10 10 0 0 1 18.66 15 Z" fill={colors[1]} />
      <path d="M10 10 L18.66 15 A10 10 0 0 1 1.34 15 Z" fill={colors[2]} />
      <path d="M10 10 L1.34 15 A10 10 0 0 1 10 0 Z" fill={colors[0]} />
      <circle cx="10" cy="10" r="9.4" fill="none" stroke="#fff" strokeWidth="1.2" />
    </svg>
  )
}

/** Colourways and per-slot colours for one piece. */
/** Where a popover opens: fixed to the viewport (tile grids scroll and would clip it), under its button. */
function popoverAt(anchor: HTMLElement | null, width: number) {
  const r = anchor?.getBoundingClientRect()
  if (!r) return { left: 8, top: 80 }
  const left = Math.min(Math.max(8, r.right - width), window.innerWidth - width - 8)
  const below = r.bottom + 6
  const top = below + 330 > window.innerHeight ? Math.max(8, r.top - 336) : below
  return { left, top }
}

function Colours({ tile, open, onClose, anchor }: { tile: Tile; open: boolean; onClose: () => void; anchor: HTMLElement | null }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const off = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && onClose()
    window.addEventListener('pointerdown', off)
    return () => window.removeEventListener('pointerdown', off)
  }, [open, onClose])
  if (!open || !tile.colours) return null
  const c = tile.colours
  const cur = c.value ?? c.ways[0].colors
  const pick = (colors: [string, string, string]) => {
    click('select')
    c.onPick(colors)
  }
  return (
    // portalled to <body>: the tile grid animates with a transform, which would trap a fixed popover
    createPortal(
      <div ref={ref} role="dialog" aria-label={c.label} className="ds-pop pointer-events-auto fixed z-50 w-[232px] rounded-2xl bg-black/85 p-2.5 shadow-2xl backdrop-blur" style={popoverAt(anchor, 232)}>
        <p className="pb-1.5 text-[11px] font-extrabold uppercase tracking-[0.12em] text-white/70">{c.slots === 3 ? 'Colourways' : 'Colour'}</p>
        <div role="listbox" aria-label="Colourways" className="grid grid-cols-6 gap-1.5">
          {c.ways.map((w) => (
            <button
              key={w.name + w.colors.join()}
              type="button"
              role="option"
              aria-selected={c.value?.join() === w.colors.join()}
              aria-label={w.name}
              title={w.name}
              onClick={() => pick(w.colors)}
              className="grid aspect-square place-items-center rounded-full transition-transform active:scale-90 aria-selected:ring-2 aria-selected:ring-white"
            >
              {c.slots === 3 ? (
                <Chip colors={w.colors} />
              ) : (
                <span
                  className="block h-7 w-7 rounded-full ring-1 ring-white/40"
                  style={{
                    background: w.colors[0] === '#FFFFFF' ? 'conic-gradient(#ddd, #fff, #ddd)' : w.colors[0],
                  }}
                />
              )}
            </button>
          ))}
        </div>
        {c.slots === 3 &&
          SLOT_NAMES.map((name, slot) => (
            <div key={name} className="mt-2">
              <p className="pb-1 text-[11px] font-extrabold uppercase tracking-[0.12em] text-white/70">{name}</p>
              <div role="listbox" aria-label={`${name} colour`} className="grid grid-cols-10 gap-1">
                {SWATCHES.map((sw) => (
                  <button
                    key={sw}
                    type="button"
                    role="option"
                    aria-selected={cur[slot].toUpperCase() === sw}
                    aria-label={`${name} ${sw}`}
                    onClick={() => {
                      const next = [...cur] as [string, string, string]
                      next[slot] = sw
                      pick(next)
                    }}
                    className="aspect-square rounded-full ring-1 ring-white/25 transition-transform active:scale-90 aria-selected:ring-2 aria-selected:ring-white"
                    style={{ background: sw }}
                  />
                ))}
              </div>
            </div>
          ))}
      </div>,
      document.body,
    )
  )
}

function TileButton({ tile, busy, compact }: { tile: Tile; busy: boolean; compact: boolean }) {
  const [open, setOpen] = useState(false)
  const anchor = useRef<HTMLButtonElement>(null)
  const tap = () => {
    // no toasts: a blocked tile explains itself on hover; a new tap replaces the running step
    if (tile.blocked) return
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
        title={tile.blocked ?? tile.label}
        aria-busy={busy}
        aria-pressed={tile.on}
        aria-label={tile.label + (tile.blocked ? ` (${tile.blocked})` : '')}
        className={`ds-tile relative ${size} rounded-[22px] p-2 transition-transform active:scale-95 ${tile.on ? 'ds-tile-on' : ''} ${tile.blocked ? 'opacity-45' : ''}`}
      >
        {tile.art}
        {tile.badge && <span className="absolute -left-1 -top-1 rounded-full bg-accent px-1.5 py-px text-[10px] font-extrabold text-accent-ink shadow">{tile.badge}</span>}
      </button>
      {tile.colours && (
        <>
          <button
            ref={anchor}
            type="button"
            aria-label={`Colours for ${tile.label}`}
            aria-expanded={open}
            onClick={() => (click('tap'), setOpen((o) => !o))}
            className="absolute right-0 top-[60px] grid h-7 w-7 place-items-center rounded-full shadow-lg"
          >
            <Chip colors={tile.colours.value ?? tile.colours.ways[0].colors} size={28} />
          </button>
          <Colours tile={tile} open={open} onClose={() => setOpen(false)} anchor={anchor.current} />
        </>
      )}
      {tile.palette && (
        <>
          <button
            ref={anchor}
            type="button"
            aria-label={`Choose a colour for ${tile.label}`}
            aria-expanded={open}
            onClick={() => (click('tap'), setOpen((o) => !o))}
            className="absolute right-0 top-[60px] grid h-7 w-7 place-items-center rounded-full shadow-lg ring-2 ring-white"
            style={{
              background: tile.palette.value ?? 'conic-gradient(#0A0A0C, #B9854A, #E07AA6, #1E7A7A, #6A3FB0, #0A0A0C)',
            }}
          >
            <svg viewBox="0 0 12 12" className="h-3 w-3 text-white drop-shadow" aria-hidden>
              <path d="M3 4.5 6 7.5 9 4.5" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" />
            </svg>
          </button>
          <Palette tile={tile} open={open} onClose={() => setOpen(false)} anchor={anchor.current} />
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
  // a store only shows the departments it stocks (no empty "Dresses" at a shop without any)
  const cats = useMemo(() => ROOMS[room].categories.filter((c) => !isStore(room) || tilesFor(room, c, look, catalog).length > 0), [room, look, catalog])
  const busy = !!action
  const def = ROOMS[room]
  return (
    <>
      <TopBar room={room} onHub={onHub} onScene={onScene} />
      <Rail room={room} cats={cats} />
      <ZoomPills wide={wide} />
      <section
        aria-label={CATEGORY_NAMES[category]}
        className={`pointer-events-none absolute z-20 flex flex-col ${wide ? 'bottom-4 right-3 top-[calc(max(env(safe-area-inset-top),8px)+64px)]' : 'inset-x-0 bottom-[max(env(safe-area-inset-bottom),8px)] pl-[60px]'}`}
        style={wide ? { width: TILE_GRID_W } : undefined}
      >
        <h2 className={`px-3 pb-2 font-black tracking-tight text-white drop-shadow-[0_2px_10px_rgb(0_0_0/0.6)] ${wide ? 'text-[26px]' : 'text-[18px]'}`}>
          {CATEGORY_NAMES[category]}
          <span className="ml-2 align-middle text-[12px] font-bold text-white/70">{def.name}</span>
        </h2>
        {wide ? (
          <div key={category} className="ds-scroll-y ds-enter pointer-events-auto grid flex-1 auto-rows-min grid-cols-4 content-start gap-x-2.5 gap-y-3 px-3 pb-24">
            {tiles.map((t, i) => (
              <Fragment key={t.id}>
                {t.section && t.section !== tiles[i - 1]?.section && <h3 className="col-span-4 pt-1 text-[12px] font-extrabold uppercase tracking-[0.16em] text-white/80 drop-shadow">{t.section}</h3>}
                <TileButton tile={t} busy={busy} compact={false} />
              </Fragment>
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

/** Two obvious zoom buttons: the whole body, or in close on the face. */
function ZoomPills({ wide }: { wide: boolean }) {
  const framing = useStudio((s) => s.framing)
  const setFraming = useStudio((s) => s.setFraming)
  const face = framing !== 'full'
  const pill = (on: boolean) => `flex min-h-10 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-extrabold transition-colors ${on ? 'bg-white text-[#1c1220] shadow-lg' : 'text-white'}`
  return (
    <div
      role="group"
      aria-label="Zoom"
      className={`pointer-events-auto absolute z-20 flex rounded-full bg-black/45 p-1 backdrop-blur ${wide ? 'bottom-4 left-[70px]' : 'right-3 top-[calc(max(env(safe-area-inset-top),8px)+56px)]'}`}
    >
      <button type="button" aria-pressed={!face} title="Zoom out: whole body" onClick={() => (click('select'), setFraming('full'))} className={pill(!face)}>
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden>
          <circle cx="12" cy="4.5" r="2" />
          <path d="M12 7v7M8 10l4-2 4 2M9.5 21l2.5-7 2.5 7" />
        </svg>
        Body
      </button>
      <button type="button" aria-pressed={face} title="Zoom in: face" onClick={() => (click('select'), setFraming('face'))} className={pill(face)}>
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden>
          <circle cx="12" cy="12" r="8" />
          <path d="M9 10.5h.01M15 10.5h.01M9.5 15c1.4 1.2 3.6 1.2 5 0" />
        </svg>
        Face
      </button>
    </div>
  )
}

function TopBar({ room, onHub, onScene }: { room: RoomId; onHub: () => void; onScene: () => void }) {
  const canUndo = useStudio((s) => s.past.length > 0)
  const undo = useStudio((s) => s.undo)
  const angle = useStudio((s) => s.angle)
  const setAngle = useStudio((s) => s.setAngle)
  const enterRoom = useStudio((s) => s.enterRoom)
  const action = useStudio((s) => s.action)
  const door = ROOMS[room].door
  const btn = 'ds-fab grid h-10 w-10 shrink-0 place-items-center rounded-full disabled:opacity-35'
  return (
    <header className="pointer-events-auto absolute inset-x-0 top-0 z-20 flex items-center gap-1.5 px-2.5 pt-[max(env(safe-area-inset-top),8px)]">
      <button type="button" onClick={() => (click('tap'), onHub())} className="ds-fab flex min-h-10 shrink-0 items-center gap-1 rounded-full pl-2 pr-3 text-[13px] font-bold">
        <Icon name="back" className="h-4 w-4" />
        Back to Street
      </button>
      {door === 'glam' && (
        <div role="tablist" aria-label="Glam Studio" className="flex rounded-full bg-black/40 p-1 backdrop-blur">
          {(['makeup', 'hair'] as const).map((r) => (
            <button
              key={r}
              type="button"
              role="tab"
              aria-selected={room === r}
              onClick={() => (click('select'), enterRoom(r))}
              className={`min-h-8 rounded-full px-3 text-[12px] font-extrabold ${room === r ? 'bg-white text-[#1c1220]' : 'text-white/85'}`}
            >
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
      <button type="button" aria-label={`Turn (now ${angle})`} title="Turn" onClick={() => setAngle(TURN[(TURN.indexOf(angle) + 1) % TURN.length])} className={btn}>
        <Icon name="turn" className="h-[18px] w-[18px]" />
      </button>
      <button type="button" aria-label="Take a picture" title="Take a picture" onClick={() => (click('tap'), useStudio.setState({ booth: true }))} className={btn}>
        <Icon name="photo" className="h-[18px] w-[18px]" />
      </button>
      <button type="button" onClick={() => (click('go'), onScene())} aria-label="Make a Scene" className="ds-cta flex min-h-10 shrink-0 items-center gap-1.5 rounded-full px-3 text-[14px] font-black sm:px-4">
        <Icon name="photo" className="h-[18px] w-[18px] sm:hidden" />
        <span className="hidden sm:inline">Make a Scene</span>
      </button>
    </header>
  )
}

export type { Category }
