import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { AppShell } from '../components/AppShell'
import { ItemThumb } from '../components/art/ItemThumb'
import { Icon, type IconName } from '../components/Icon'
import { Modal } from '../components/Modal'
import { SceneFallback } from '../components/SceneFallback'
import { ChoiceChips, Swatches } from '../components/Swatches'
import { runAction, useAction } from '../hooks/useAction'
import { useDoc } from '../hooks/useData'
import { useHistory } from '../hooks/useHistory'
import { useReducedMotion } from '../hooks/useMediaQuery'
import { buttonClass, cx, formatGlam, inputClass } from '../lib/ui'
import { backend } from '../services/backend'
import { placedCounts } from '../shared/apartment'
import { DECOR_ITEMS, getItem, isStarterItem } from '../shared/catalog'
import { BALCONY_LEVEL } from '../shared/levels'
import { useLevel } from '../hooks/useLevel'
import { APARTMENT_TIERS, SELL_BACK_RATE } from '../shared/economy'
import { DAILY_MISSIONS, missionState, OBJECTIVES, WEEKLY_MISSIONS } from '../shared/missions'
import { LUGGAGE } from '../shared/movein'
import { MissionPicker } from '../components/Missions'
import { P } from '../shared/paths'
import type { ApartmentDoc, CatalogItem, DollDoc, FurnitureRoom, PlacedItem, PublicDoll } from '../shared/types'
import { useSession } from '../store/useSession'
import { toast } from '../store/useToasts'
import type { ApartmentHandle, RoomMode } from '../three/apartment/ApartmentScene'

/** A tile in the crib dock. The wardrobe tile is the big one. */
function CribButton({ to, onClick, label, sub, icon, big, badge }: { to?: string; onClick?: () => void; label: string; sub?: string; icon: IconName; big?: boolean; badge?: number }) {
  const body = (
    <>
      <span className={cx('relative grid place-items-center rounded-2xl', big ? 'size-14 bg-primary text-ink shadow-[var(--shadow-glow)]' : 'size-11 bg-muted text-foreground')}>
        <Icon name={icon} className={big ? 'size-7' : 'size-5'} />
        {!!badge && <span className="absolute -top-1 -right-1 grid h-5 min-w-5 place-items-center rounded-full bg-acid px-1 text-[11px] font-black text-ink">{badge}</span>}
      </span>
      <span className={cx('font-semibold', big ? 'text-sm' : 'text-[11px]')}>{label}</span>
      {sub && <span className="-mt-1 text-[10px] text-muted-foreground">{sub}</span>}
    </>
  )
  const cls = cx('flex flex-col items-center gap-1 rounded-2xl px-2 py-1.5 transition-transform hover:-translate-y-0.5', big ? 'min-w-24' : 'min-w-16')
  return to ? (
    <Link to={to} className={cls}>
      {body}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={cls}>
      {body}
    </button>
  )
}

const ApartmentScene = lazy(() => import('../three/apartment/ApartmentScene'))

type Decor = Pick<ApartmentDoc, 'wallColor' | 'wallpaper' | 'floor' | 'lighting' | 'windowView' | 'windowStyle' | 'windowSpot' | 'balcony'>

const ROOMS: { id: FurnitureRoom | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'living', label: 'Living' },
  { id: 'bedroom', label: 'Bedroom' },
  { id: 'vanity-closet', label: 'Vanity & closet' },
  { id: 'kitchen', label: 'Kitchen' },
  { id: 'bathroom', label: 'Bathroom' },
  { id: 'decor', label: 'Decor' },
  { id: 'lighting', label: 'Lighting' },
  { id: 'plants', label: 'Plants' },
  { id: 'art', label: 'Art' },
]

/** Your crib, or a friend's when visiting /home/:uid. */
export default function Home() {
  const { uid: visitUid } = useParams()
  const me = useSession((s) => s.user!.uid)
  const visiting = !!visitUid && visitUid !== me
  return visiting ? <Visit host={visitUid!} /> : <MyCrib />
}

function Visit({ host }: { host: string }) {
  const apt = useDoc<ApartmentDoc>(P.apartment(host))
  const doll = useDoc<DollDoc>(P.doll(host))
  const pub = useDoc<PublicDoll>(P.publicDoll(host))
  const reducedMotion = useReducedMotion()
  useEffect(() => {
    void runAction('notifyVisit', { host }, { silent: true })
  }, [host])
  return (
    <AppShell title={pub.data ? `${pub.data.name}’s crib` : 'Visiting'} full>
      {apt.data ? (
        <Suspense fallback={<SceneFallback label="Knocking on the door" />}>
          <ApartmentScene
            apartment={apt.data}
            items={apt.data.items}
            appearance={doll.data?.appearance ?? null}
            mode="view"
            selectedId={null}
            onSelect={() => undefined}
            onMove={() => undefined}
            placing={null}
            onPlace={() => undefined}
            reducedMotion={reducedMotion}
          />
        </Suspense>
      ) : (
        <SceneFallback label={apt.loading ? 'Knocking on the door' : 'This crib is still empty.'} />
      )}
      <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center">
        <Link to={`/u/${host}`} className={buttonClass('secondary', 'md', 'pointer-events-auto')}>
          Back to profile
        </Link>
      </div>
    </AppShell>
  )
}

function MyCrib() {
  const navigate = useNavigate()
  const uid = useSession((s) => s.user!.uid)
  const apartment = useSession((s) => s.apartment)
  const doll = useSession((s) => s.doll)
  const inventory = useSession((s) => s.inventory?.items ?? {})
  const progress = useSession((s) => s.progress)
  const reducedMotion = useReducedMotion()
  const scene = useRef<ApartmentHandle>(null)

  const [mode, setMode] = useState<RoomMode>('walk')
  const history = useHistory<PlacedItem[]>(apartment?.items ?? [])
  const [decor, setDecor] = useState<Decor | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [placing, setPlacing] = useState<string | null>(null)
  const [room, setRoom] = useState<FurnitureRoom | 'all'>('all')
  const [panel, setPanel] = useState<'items' | 'shop' | 'decor' | 'layouts'>('shop')
  const [layoutName, setLayoutName] = useState('')
  const [upgradeOpen, setUpgradeOpen] = useState(false)
  const [missionsOpen, setMissionsOpen] = useState(false)
  const unpack = useAction('unpackLuggage')
  const buy = useAction('purchase')
  const lvl = useLevel()
  const save = useAction('saveApartment')
  const upgrade = useAction('upgradeApartment')

  // Players from before the furnished starter home get it once.
  const furnished = useRef(false)
  useEffect(() => {
    if (!apartment || apartment.starterHome || furnished.current) return
    furnished.current = true
    void runAction('furnishStarterHome', undefined, { silent: true })
  }, [apartment])

  // Re-sync when the server copy changes and we have no local edits.
  const serverJson = JSON.stringify(apartment?.items ?? [])
  const lastServer = useRef(serverJson)
  useEffect(() => {
    if (serverJson !== lastServer.current && JSON.stringify(history.value) === lastServer.current) history.reset(apartment?.items ?? [])
    lastServer.current = serverJson
  }, [serverJson, apartment, history])

  if (!apartment) return <AppShell title="Crib" full><SceneFallback label="Unlocking your door" /></AppShell>

  const view: ApartmentDoc = { ...apartment, ...(decor ?? {}) }
  const items = history.value
  const counts = placedCounts(items)
  const dirty = JSON.stringify(items) !== serverJson || !!decor
  const luggage = apartment.luggage ?? []
  const now = Date.now()
  const readyMissions = progress ? [...OBJECTIVES, ...DAILY_MISSIONS, ...WEEKLY_MISSIONS].filter((m) => missionState(progress, m, now).status === 'ready').length : 0

  const tray: { item: CatalogItem; free: number }[] = Object.entries(inventory)
    .map(([id, n]) => ({ item: getItem(id)!, free: n - (counts[id] ?? 0) }))
    .filter((x) => x.item?.furniture && (room === 'all' || x.item.furniture.room === room))
    .sort((a, b) => b.free - a.free)

  const selected = items.find((i) => i.id === selectedId) ?? null

  const persist = async () => {
    const res = await save.run({ items, ...(decor ?? {}) })
    if (res) {
      setDecor(null)
      lastServer.current = JSON.stringify(items)
      toast.success('Crib saved')
    }
    return !!res
  }

  const shareTour = async () => {
    const img = scene.current?.capture()
    if (!img) return
    const url = await backend().storage.uploadDataUrl(`posts/${uid}/${Date.now()}.jpg`, img)
    const res = await runAction('createPost', { kind: 'apartment', image: url, caption: 'Welcome to my crib ✨' })
    if (res) toast.success('Apartment tour posted', { label: 'View', onClick: () => navigate('/feed') })
  }

  return (
    <AppShell title="Crib" full
    >
      <div className="absolute inset-0">
        <Suspense fallback={<SceneFallback label="Unlocking your door" />}>
          <ApartmentScene
            ref={scene}
            apartment={view}
            items={items}
            appearance={doll?.appearance ?? null}
            mode={mode}
            selectedId={selectedId}
            onSelect={(id) => {
              setSelectedId(id)
              setPlacing(null)
            }}
            onMove={(id, next) => history.set(items.map((i) => (i.id === id ? next : i)), `move-${id}`)}
            placing={placing}
            onPlace={(next) => {
              history.set([...items, next])
              setSelectedId(next.id)
              setPlacing(null)
            }}
            onInteract={(t) => {
              if (t === 'wardrobe' || t === 'clothes-rack') navigate('/wardrobe')
              else if (t === 'vanity' || t === 'mirror-floor' || t === 'wall-mirror') navigate('/makeover?tab=Makeup')
              else if (t.startsWith('bed') || t === 'sleeping-mat') toast.info('A quick nap. Feeling fresh.')
              else if (t === 'speaker') toast.info('🎶 Afrobeats on.')
            }}
            reducedMotion={reducedMotion}
            luggage={luggage}
            truck={!apartment.movedIn && luggage.length > 0}
            onTruckDone={() => void runAction('finishMoveIn', undefined, { silent: true })}
            onUnpack={async (id) => {
              const r = await unpack.run({ id })
              if (r) toast.success(r.placed.length ? `Unpacked and arranged ${r.label.split(': ')[1] ?? r.label} in your crib · +${r.reward} Glam` : `Unpacked ${r.label.split(': ')[1] ?? r.label} into your wardrobe · +${r.reward} Glam`, { label: 'Open wardrobe', onClick: () => navigate('/wardrobe') })
            }}
          />
        </Suspense>
      </div>

      {/* Crib HUD: coins, move-in day, and the crib's own rooms (wardrobe, makeover, beauty doctor) */}
      <div className="pointer-events-none absolute inset-x-0 top-3 flex flex-col items-center gap-2 px-3">
        {luggage.length > 0 && (
          <p className="pointer-events-auto rounded-full bg-primary px-4 py-2 text-sm font-bold text-ink shadow-[var(--shadow-glow)]">
            🚚 Your load just arrived. Tap the bags and boxes to unpack ({LUGGAGE.length - luggage.length}/{LUGGAGE.length})
            <button
              type="button"
              className="ml-2 rounded-full bg-ink px-2.5 py-0.5 text-xs text-bone"
              disabled={unpack.pending}
              onClick={async () => {
                let glam = 0
                for (const id of luggage) glam += (await unpack.run({ id }))?.reward ?? 0
                if (glam) toast.success(`All unpacked · +${glam} Glam`, { label: 'Open wardrobe', onClick: () => navigate('/wardrobe') })
              }}
            >
              Unpack all
            </button>
          </p>
        )}
        {mode === 'build' && <p className="rounded-full bg-card/85 px-3 py-1 text-xs text-muted-foreground">Decorating: drag pieces, tap a wall or the floor to place.</p>}
      </div>

      {mode === 'walk' && (
        <>
          <div className="absolute inset-x-0 bottom-3 flex justify-center pr-3 pl-20">
            <div className="flex items-end gap-2 rounded-[28px] border border-border bg-card/90 p-2 shadow-[var(--shadow-lift)] backdrop-blur">
              <CribButton onClick={() => setMode('build')} big label="Decor" sub="Move, add, arrange" icon="crib" />
              <CribButton to="/makeover" label="Makeover" icon="sparkle" />
              <CribButton to="/beauty-doctor" label="Beauty Doctor" icon="heart" />
              <CribButton onClick={() => setMissionsOpen(true)} label="Missions" icon="star" badge={readyMissions} />
            </div>
          </div>

          <div className="absolute top-20 right-3 flex flex-col items-end gap-2">
            <button type="button" className={buttonClass('secondary', 'sm')} onClick={shareTour}>
              <Icon name="camera" className="size-4" /> Share tour
            </button>
            <button type="button" className={buttonClass('secondary', 'sm')} onClick={() => setUpgradeOpen(true)}>
              <Icon name="sparkle" className="size-4" /> Upgrade
            </button>
          </div>
        </>
      )}
      {mode === 'build' && (
        <button type="button" className={buttonClass('primary', 'md', 'absolute top-3 left-24')} onClick={() => setMode('walk')}>
          <Icon name="check" className="size-4" /> Done decorating
        </button>
      )}

      <Modal open={missionsOpen} onClose={() => setMissionsOpen(false)} title="Missions">
        {progress && <MissionPicker progress={progress} />}
      </Modal>

      {/* build panel */}
      {mode === 'build' && (
        <div className="absolute inset-x-0 bottom-0 flex max-h-[48%] flex-col rounded-t-[var(--radius-sheet)] border-t border-border bg-card/97 backdrop-blur md:inset-x-auto md:top-20 md:right-3 md:bottom-3 md:max-h-none md:w-[360px] md:rounded-[var(--radius-sheet)] md:border">
          <div className="flex items-center gap-1 px-3 pt-3">
            {(['shop', 'items', 'decor', 'layouts'] as const).map((p) => (
              <button key={p} type="button" aria-pressed={panel === p} onClick={() => setPanel(p)} className={cx('min-h-9 rounded-full px-2.5 text-xs font-bold capitalize', panel === p ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-muted')}>
                {p === 'shop' ? 'Shop decor' : p === 'items' ? 'Mine' : p === 'decor' ? 'Walls & windows' : 'Layouts'}
              </button>
            ))}
            <span className="flex-1" />
            <button type="button" aria-label="Undo" className={buttonClass('ghost', 'sm')} disabled={!history.canUndo} onClick={history.undo}>
              <Icon name="undo" className="size-4" />
            </button>
            <button type="button" aria-label="Redo" className={buttonClass('ghost', 'sm')} disabled={!history.canRedo} onClick={history.redo}>
              <Icon name="redo" className="size-4" />
            </button>
            <button type="button" className={buttonClass('primary', 'sm')} disabled={!dirty || save.pending} onClick={persist}>
              Save
            </button>
          </div>

          {selected && panel === 'items' && (
            <div className="mx-3 mt-3 flex flex-wrap items-center gap-2 rounded-2xl bg-muted p-2">
              <span className="min-w-0 flex-1 truncate pl-1 text-sm font-semibold">{getItem(selected.itemId)?.name}</span>
              {!selected.wall && (
                <>
                  <button type="button" aria-label="Rotate 90 degrees" className={buttonClass('secondary', 'sm')} onClick={() => history.set(items.map((i) => (i.id === selected.id ? { ...i, rot: (i.rot + Math.PI / 2) % (Math.PI * 2) } : i)))}>
                    <Icon name="rotate" className="size-4" /> 90°
                  </button>
                  <button type="button" aria-label="Rotate 15 degrees" className={buttonClass('secondary', 'sm')} onClick={() => history.set(items.map((i) => (i.id === selected.id ? { ...i, rot: i.rot + Math.PI / 12 } : i)), `rot-${selected.id}`)}>
                    15°
                  </button>
                </>
              )}
              <button
                type="button"
                className={buttonClass('secondary', 'sm')}
                onClick={() => {
                  history.set(items.filter((i) => i.id !== selected.id))
                  setSelectedId(null)
                }}
              >
                <Icon name="box" className="size-4" /> Store
              </button>
              {!isStarterItem(selected.itemId) && (
                <button
                  type="button"
                  className={buttonClass('secondary', 'sm', 'text-[#B3123F]')}
                  onClick={async () => {
                    const it = getItem(selected.itemId)!
                    if (!window.confirm(`Sell ${it.name} for ${Math.floor(it.price * SELL_BACK_RATE)} Glam?`)) return
                    const next = items.filter((i) => i.id !== selected.id)
                    history.set(next)
                    setSelectedId(null)
                    const ok = await save.run({ items: next, ...(decor ?? {}) })
                    if (ok) {
                      lastServer.current = JSON.stringify(next)
                      const r = await runAction('sellItem', { itemId: it.id })
                      if (r) toast.success(`Sold for ${r.refund} Glam`)
                    }
                  }}
                >
                  Sell
                </button>
              )}
            </div>
          )}

          {panel === 'shop' ? (
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              <p className="mb-2 text-xs text-muted-foreground">Buy a piece and it goes straight into your hand: tap the floor or a wall to place it.</p>
              <div className="grid grid-cols-3 gap-2">
                {DECOR_ITEMS.map((item) => {
                  const locked = (item.unlockLevel ?? 0) > lvl.level
                  const have = (inventory[item.id] ?? 0) - (counts[item.id] ?? 0)
                  return (
                    <button
                      key={item.id}
                      type="button"
                      disabled={locked || buy.pending}
                      onClick={async () => {
                        if (have < 1) {
                          if ((progress?.dollies ?? 0) < item.price) return toast.error(`${item.name} is ${formatGlam(item.price)} Glam.`)
                          if (!(await buy.run({ itemIds: [item.id] }))) return
                        }
                        setPlacing(item.id)
                        setSelectedId(null)
                        setPanel('items')
                      }}
                      className={cx('relative overflow-hidden rounded-2xl border-2 border-border bg-background text-left', locked && 'opacity-50')}
                    >
                      <span className="block aspect-square">
                        <ItemThumb item={item} />
                      </span>
                      <span className="line-clamp-1 px-2 pt-1 text-[11px] font-semibold">{item.name}</span>
                      <span className="block px-2 pb-1 text-[11px] font-bold text-primary">{locked ? `🔒 Level ${item.unlockLevel}` : have > 0 ? 'Owned · place' : `${formatGlam(item.price)} Glam`}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          ) : panel === 'layouts' ? (
            <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
              <p className="text-sm text-muted-foreground">Save this arrangement and switch between looks: party mode, cosy mode, content-day mode.</p>
              <div className="flex gap-2">
                <input value={layoutName} onChange={(e) => setLayoutName(e.target.value)} maxLength={24} placeholder="e.g. Party mode" className={inputClass} />
                <button
                  type="button"
                  className={buttonClass('primary', 'md')}
                  disabled={!layoutName.trim() || save.pending}
                  onClick={async () => {
                    if (dirty && !(await persist())) return
                    const r = await runAction('saveLayout', { name: layoutName.trim() })
                    if (r) {
                      setLayoutName('')
                      toast.success('Layout saved')
                    }
                  }}
                >
                  Save
                </button>
              </div>
              <ul className="flex flex-col gap-2">
                {(apartment.layouts ?? []).map((l) => (
                  <li key={l.id} className="flex items-center gap-2 rounded-2xl border border-border p-2 pl-3">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{l.name}</span>
                      <span className="block text-xs text-muted-foreground">{l.items.length} pieces</span>
                    </span>
                    <button
                      type="button"
                      className={buttonClass('secondary', 'sm')}
                      onClick={() => {
                        const ownedNow = l.items.filter((i) => (inventory[i.itemId] ?? 0) > 0)
                        history.set(ownedNow)
                        setDecor({ wallColor: l.wallColor, wallpaper: l.wallpaper, floor: l.floor, lighting: l.lighting, windowView: view.windowView })
                        toast.info(ownedNow.length < l.items.length ? 'Some pieces were sold, so they were left out. Tap Save to keep it.' : 'Layout loaded. Tap Save to keep it.')
                      }}
                    >
                      Use
                    </button>
                    <button type="button" aria-label={`Delete ${l.name}`} className="grid size-9 place-items-center rounded-full hover:bg-muted" onClick={() => runAction('deleteLayout', { id: l.id })}>
                      <Icon name="trash" className="size-4" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : panel === 'items' ? (
            <>
              <div className="no-scrollbar flex gap-1.5 overflow-x-auto px-3 pt-3">
                {ROOMS.map((r) => (
                  <button key={r.id} type="button" aria-pressed={room === r.id} onClick={() => setRoom(r.id)} className={cx('min-h-9 shrink-0 rounded-full border px-3 text-xs font-semibold', room === r.id ? 'border-primary bg-primary text-primary-foreground' : 'border-border')}>
                    {r.label}
                  </button>
                ))}
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-3">
                {placing && <p className="mb-2 rounded-2xl bg-primary/15 px-3 py-2 text-sm font-semibold text-primary">Tap the floor or a wall to place it. Red means it doesn’t fit.</p>}
                {tray.length ? (
                  <div className="grid grid-cols-3 gap-2">
                    {tray.map(({ item, free }) => (
                      <button
                        key={item.id}
                        type="button"
                        disabled={free < 1}
                        aria-pressed={placing === item.id}
                        onClick={() => {
                          setPlacing(placing === item.id ? null : item.id)
                          setSelectedId(null)
                        }}
                        className={cx('relative overflow-hidden rounded-2xl border-2 bg-background text-left disabled:opacity-40', placing === item.id ? 'border-primary' : 'border-border')}
                      >
                        <span className="block aspect-square">
                          <ItemThumb item={item} />
                        </span>
                        <span className="line-clamp-1 px-2 py-1 text-[11px] font-semibold">{item.name}</span>
                        <span className="absolute top-1 right-1 rounded-full bg-card px-1.5 text-[11px] font-bold">×{free}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Nothing here yet.{' '}
                    <Link to="/shop?cat=home" className="font-semibold text-secondary">
                      Shop furniture
                    </Link>
                  </p>
                )}
              </div>
            </>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4">
              <Swatches label="Wall paint" colors={['#F4E9E1', '#FFE3EF', '#E8F6F1', '#EDE4FF', '#FFF4D6', '#DDEBFF', '#2B2B44', '#3B1A5E', '#1E0B26']} value={view.wallColor} onChange={(wallColor) => setDecor({ ...(decor ?? view), wallColor })} custom />
              <ChoiceChips
                label="Wallpaper"
                options={(['none', 'cheetah', 'girly', 'black', 'ankara', 'adire', 'stripe', 'floral', 'check'] as const).map((w) => ({ id: w, label: w === 'none' ? 'None' : w === 'girly' ? 'Girly core' : w === 'cheetah' ? 'Cheetah print' : w[0].toUpperCase() + w.slice(1) }))}
                value={view.wallpaper}
                onChange={(wallpaper) => setDecor({ ...(decor ?? view), wallpaper })}
              />
              <ChoiceChips
                label="Floor"
                options={(['concrete', 'oak', 'walnut', 'marble', 'tile', 'carpet'] as const).map((f) => ({ id: f, label: f[0].toUpperCase() + f.slice(1) }))}
                value={view.floor}
                onChange={(floor) => setDecor({ ...(decor ?? view), floor })}
              />
              <ChoiceChips
                label="Lighting mood"
                options={[
                  { id: 'day', label: 'Daylight' },
                  { id: 'golden', label: 'Golden hour' },
                  { id: 'night', label: 'Night' },
                  { id: 'club', label: 'Club' },
                ]}
                value={view.lighting}
                onChange={(lighting) => setDecor({ ...(decor ?? view), lighting })}
              />
              <ChoiceChips
                label="Window shape"
                options={[
                  { id: 'classic', label: 'Classic' },
                  { id: 'tall', label: 'Floor-to-ceiling' },
                  { id: 'arched', label: 'Arched' },
                  { id: 'round', label: 'Round' },
                ]}
                value={view.windowStyle ?? 'classic'}
                onChange={(windowStyle) => setDecor({ ...(decor ?? view), windowStyle, balcony: false })}
              />
              <ChoiceChips
                label="Window position"
                options={[
                  { id: 'left', label: 'Left' },
                  { id: 'center', label: 'Centre' },
                  { id: 'right', label: 'Right' },
                ]}
                value={view.windowSpot ?? 'right'}
                onChange={(windowSpot) => setDecor({ ...(decor ?? view), windowSpot })}
              />
              <label className={cx('flex items-center justify-between gap-3 rounded-2xl border border-border px-4 py-3 text-sm', lvl.level < BALCONY_LEVEL && 'opacity-60')}>
                <span>
                  <b className="block">Balcony</b>
                  <span className="text-xs text-muted-foreground">{lvl.level < BALCONY_LEVEL ? `🔒 Unlocks at level ${BALCONY_LEVEL}` : 'Swap the window for glass doors onto a balcony.'}</span>
                </span>
                <input type="checkbox" disabled={lvl.level < BALCONY_LEVEL} checked={!!view.balcony} onChange={(e) => setDecor({ ...(decor ?? view), balcony: e.target.checked })} className="size-5 accent-[var(--primary)]" />
              </label>
              <ChoiceChips
                label="Window view"
                options={[
                  { id: 'lagos', label: 'Lagos skyline' },
                  { id: 'city', label: 'City' },
                  { id: 'beach', label: 'Beach' },
                  { id: 'stars', label: 'Stars' },
                  { id: 'garden', label: 'Garden' },
                ]}
                value={view.windowView}
                onChange={(windowView) => setDecor({ ...(decor ?? view), windowView })}
              />
            </div>
          )}
        </div>
      )}

      <Modal open={upgradeOpen} onClose={() => setUpgradeOpen(false)} title="Move up">
        <ul className="flex flex-col gap-2">
          {APARTMENT_TIERS.map((t, i) => {
            const cur = APARTMENT_TIERS.findIndex((x) => x.id === apartment.tier)
            return (
              <li key={t.id} className="flex items-center gap-3 rounded-2xl border border-border p-3">
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{t.name}</span>
                  <span className="block text-sm text-muted-foreground">
                    {t.w} × {t.d} m{t.price ? ` · ${formatGlam(t.price)} Glam` : ''}
                  </span>
                </span>
                {i <= cur ? (
                  <span className="text-sm font-semibold text-muted-foreground">{i === cur ? 'Home' : 'Done'}</span>
                ) : (
                  <button
                    type="button"
                    className={buttonClass('primary', 'sm')}
                    disabled={upgrade.pending || (progress?.dollies ?? 0) < t.price}
                    onClick={async () => {
                      const r = await upgrade.run({ tier: t.id })
                      if (r) {
                        toast.success(`Welcome to your ${t.name}!`)
                        setUpgradeOpen(false)
                      }
                    }}
                  >
                    Move
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      </Modal>
    </AppShell>
  )
}
