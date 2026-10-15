import {lazy, Suspense, useEffect, useMemo, useRef, useState, type CSSProperties, type ComponentProps} from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { AppShell } from '../components/AppShell'
import { ItemThumb } from '../components/art/ItemThumb'
import { Icon } from '../components/Icon'
import { Modal } from '../components/Modal'
import { SceneFallback } from '../components/SceneFallback'
import { runAction, useAction } from '../hooks/useAction'
import { useReducedMotion } from '../hooks/useMediaQuery'
import { useOwned } from '../hooks/useOwned'
import { brandName, COLOUR_FAMILIES, colourFamily, type ColourFamily } from '../lib/brands'
import { buttonClass, cx, formatGlam } from '../lib/ui'
import { wearItem } from '../shared/appearance'
import { BRAND_BY_ID, BRANDS, CATALOG } from '../shared/catalog'
import { RENT_MIN_PRICE, RENT_RATES, rentPrice, type RentDays } from '../shared/economy'
import type { Brand, CatalogItem, DripVibe, Outfit, OutfitSlot } from '../shared/types'
import { ErrorBoundary } from '../three/ErrorBoundary'
import type { WorldStore, WorldStoreKind } from '../three/DripWorld'
import { useSession } from '../store/useSession'
import { toast } from '../store/useToasts'

const DollStage = lazy(() => import('../three/DollStage'))
type RoomKindProp = NonNullable<ComponentProps<typeof DollStage>['room']>['kind']

/* ------------------------------------------------------------------ stores */

interface Store {
  id: string
  name: string
  tagline: string
  accent: string
  vibe: DripVibe | 'rent'
  nigerian: boolean
  items: () => CatalogItem[]
}

const byBrand = (ids: string[]) => () => CATALOG.filter((i) => ids.includes(i.brandId))

const brandStore = (b: Brand): Store => ({
  id: b.id,
  name: brandName(b),
  tagline: b.tagline,
  accent: b.accent,
  vibe: b.vibe ?? 'basic',
  nigerian: b.region === 'nigeria',
  items: byBrand([b.id]),
})

/** Stores that aren't a single label. */
const SPECIAL: Store[] = [
  { id: 'rent-a-fit', name: 'Rent a Fit', tagline: 'Big looks for a day, three or a week.', accent: '#C8FF3D', vibe: 'rent', nigerian: true, items: () => CATALOG.filter((i) => i.slot && i.price >= RENT_MIN_PRICE) },
  { id: 'thrift', name: 'Thrift', tagline: 'Pre-loved and archive finds.', accent: '#8DA35B', vibe: 'thrift', nigerian: true, items: byBrand(['second-life', 'vintage-vault']) },
]
const HIDDEN = new Set(['second-life', 'vintage-vault', 'dollcare-basics'])
const BRAND_STORES = BRANDS.filter((b) => !HIDDEN.has(b.id) && CATALOG.some((i) => i.brandId === b.id)).map(brandStore)
const STORES: Store[] = [...SPECIAL, ...BRAND_STORES]
const STORE_BY_ID = new Map(STORES.map((s) => [s.id, s]))
const MALL: Store = { id: 'mall', name: 'The Mall', tagline: 'Every rail in the Drip.', accent: '#FF2E88', vibe: 'basic', nigerian: false, items: () => CATALOG }

/** The Drip: a 3D street of six stores. Walk into one for its dressing station. */
export default function Shop() {
  const [params, setParams] = useSearchParams()
  const storeId = params.get('store') ?? params.get('brand')
  const deepItem = params.get('item')
  const store = storeId ? (STORE_BY_ID.get(storeId) ?? null) : deepItem ? MALL : null
  const world = store && WORLD_STORES.find((w) => w.id === store.id)
  if (world) return <FittingRoom key={world.id} store={world.store} kind={world.kind} label={world.label} onLeave={() => setParams({})} />
  if (store) return <StoreInterior key={store.id} store={store} initialItem={deepItem} onLeave={() => setParams({})} />
  return <DripWorldPage onEnter={(id) => setParams({ store: id })} />
}

/* ---------------------------------------------------------------- world */

const DripWorld = lazy(() => import('../three/DripWorld'))

/** The six stores of the Drip world, one per vibe. */
const WORLD: { id: string; kind: WorldStoreKind; label: string }[] = [
  { id: 'bolapsd', kind: 'streetwear', label: 'Streetwear' },
  { id: 'that-collective', kind: 'classy', label: 'Classy dresses' },
  { id: 'sheeen', kind: 'basics', label: 'Basic tops' },
  { id: 'bend-down-select', kind: 'thrift', label: 'Thrift & bend down' },
  { id: 'meji-meji', kind: 'edgy', label: 'Edgy fashion' },
  { id: 'dope-by-fabby', kind: 'baddie', label: 'Baddie & owambe' },
  { id: 'booty', kind: 'lingerie', label: 'Lingerie & lounge' },
  { id: 'meirre-chen', kind: 'luxury', label: 'Luxury' },
  { id: 'nova-sport', kind: 'sport', label: 'Gym & sport' },
  { id: 'go-bonkers', kind: 'football', label: 'Naija streetwear' },
]
const WORLD_STORES = WORLD.map((w) => ({ ...w, store: STORE_BY_ID.get(w.id) })).filter((w): w is (typeof WORLD)[number] & { store: Store } => !!w.store)

/** The beauty side of the street: makeup at the Glow Bar, cosmetic surgery at the Beauty Doctor. */
const BEAUTY: { id: string; name: string; kind: WorldStoreKind; label: string; accent: string; to: string }[] = [
  { id: 'glow-bar', name: 'Glow Bar', kind: 'makeup', label: 'Makeup', accent: '#FF8CC4', to: '/makeover?tab=Makeup' },
  { id: 'beauty-doctor', name: 'Beauty Doctor', kind: 'clinic', label: 'Cosmetic surgery', accent: '#2BA6A0', to: '/beauty-doctor' },
]
interface StreetStop {
  id: string
  name: string
  kind: WorldStoreKind
  label: string
  accent: string
  to?: string
}
const STREET: StreetStop[] = [
  ...WORLD_STORES.slice(0, 5).map((w) => ({ id: w.id, name: w.store.name, kind: w.kind, label: w.label, accent: w.store.accent })),
  BEAUTY[0],
  ...WORLD_STORES.slice(5).map((w) => ({ id: w.id, name: w.store.name, kind: w.kind, label: w.label, accent: w.store.accent })),
  BEAUTY[1],
]

/** The Drip: fashion and beauty stores on one 3D street that fills the screen. */
function DripWorldPage({ onEnter }: { onEnter: (id: string) => void }) {
  const navigate = useNavigate()
  const reduced = useReducedMotion()
  const [focus, setFocus] = useState(0)
  const [lit, setLit] = useState<string | null>(null)
  const pos = useRef(0)
  const snap = useRef<number | undefined>(undefined)
  const drag = useRef<number | null>(null)
  const n = STREET.length
  const stores: WorldStore[] = useMemo(
    () =>
      STREET.map((w) => {
        const store = STORE_BY_ID.get(w.id)
        const colours = store ? [...new Set(store.items().filter((i) => i.slot).map((i) => i.colors[0]))] : ['#FF8CC4', '#E8505B', '#C9A7FF', '#FFD95A', '#7CF0CF']
        return { id: w.id, name: w.name, kind: w.kind, accent: w.accent, stock: colours.length ? colours.slice(0, 10) : [w.accent] }
      }),
    [],
  )
  const current = STREET[focus]

  const go = (to: number) => {
    pos.current = Math.max(0, Math.min(n - 1, to))
  }
  const settle = () => {
    window.clearTimeout(snap.current)
    snap.current = window.setTimeout(() => go(Math.round(pos.current)), 160)
  }
  const enter = (id: string) => {
    setLit(id)
    const stop = STREET.find((x) => x.id === id)
    window.setTimeout(() => (stop?.to ? navigate(stop.to) : onEnter(id)), reduced ? 0 : 380)
  }

  return (
    <AppShell title="Drip" full>
      <div
        tabIndex={0}
        aria-label="The Drip street. Use the arrow keys to walk, Enter to go in."
        className="absolute inset-0 touch-pan-y bg-[#FFD3E4] outline-none"
        onWheel={(e) => {
          go(pos.current + (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) / 320)
          settle()
        }}
        onPointerDown={(e) => {
          drag.current = e.clientX
        }}
        onPointerMove={(e) => {
          if (drag.current === null) return
          go(pos.current - (e.clientX - drag.current) / 240)
          drag.current = e.clientX
        }}
        onPointerUp={() => {
          drag.current = null
          settle()
        }}
        onPointerLeave={() => {
          if (drag.current !== null) settle()
          drag.current = null
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') go(Math.round(pos.current) + 1)
          else if (e.key === 'ArrowLeft') go(Math.round(pos.current) - 1)
          else if (e.key === 'Enter' && current) enter(current.id)
        }}
      >
        <ErrorBoundary fallback={<p className="grid h-full place-items-center text-sm">3D isn’t available on this device.</p>}>
          <Suspense fallback={<SceneFallback label="Opening the Drip…" />}>
            <DripWorld stores={stores} pos={pos} focus={focus} onFocus={setFocus} onEnter={enter} reducedMotion={reduced} />
          </Suspense>
        </ErrorBoundary>
      </div>

      <div className="pointer-events-none absolute top-4 left-[84px] md:left-[104px]">
        <h1 className="font-spicy text-5xl leading-none text-white [text-shadow:0_3px_0_#C21767,0_6px_18px_rgb(0_0_0/0.25)]">Drip</h1>
        <button type="button" onClick={() => enter('mall')} className="pointer-events-auto mt-1 text-xs font-bold text-white underline [text-shadow:0_1px_3px_rgb(0_0_0/0.5)]">
          Browse every rail
        </button>
      </div>

      {(['prev', 'next'] as const).map((d) => (
        <button
          key={d}
          type="button"
          aria-label={d === 'prev' ? 'Previous store' : 'Next store'}
          disabled={d === 'prev' ? focus === 0 : focus === n - 1}
          onClick={() => go(Math.round(pos.current) + (d === 'prev' ? -1 : 1))}
          className={cx('absolute top-1/2 grid size-12 -translate-y-1/2 place-items-center rounded-full border border-white/40 bg-black/25 text-2xl font-black text-white backdrop-blur-md transition-opacity disabled:opacity-0', d === 'prev' ? 'left-[84px] md:left-[104px]' : 'right-3')}
        >
          {d === 'prev' ? '‹' : '›'}
        </button>
      ))}

      <div className="pointer-events-none absolute inset-x-0 bottom-3 flex flex-col items-center gap-2 pl-[76px] md:pl-24">
        {current && (
          <div key={current.id} className="pointer-events-auto flex items-center gap-3 rounded-[22px] border border-white/30 bg-black/35 py-2 pr-2 pl-4 text-white backdrop-blur-md motion-safe:animate-[cloud-pop_.25s_ease-out_both]">
            <span className="min-w-0">
              <span className="block text-[10px] font-black tracking-wider uppercase" style={{ color: current.accent, filter: 'brightness(1.4)' }}>
                {current.label}
              </span>
              <span className="block truncate font-spicy text-xl leading-tight">{current.name}</span>
            </span>
            <button type="button" onClick={() => enter(current.id)} className={buttonClass('primary', 'md', 'shrink-0')}>
              {lit === current.id ? 'Walking in…' : current.to ? 'Go in' : 'Walk in'}
            </button>
          </div>
        )}
        <div role="tablist" aria-label="Stores" className="no-scrollbar pointer-events-auto flex max-w-full gap-1.5 overflow-x-auto px-3 pb-1">
          {STREET.map((w, i) => (
            <button
              key={w.id}
              role="tab"
              type="button"
              aria-selected={focus === i}
              onClick={() => go(i)}
              className={cx('shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold whitespace-nowrap backdrop-blur-md transition-transform active:scale-95', focus === i ? 'border-white bg-white text-ink' : 'border-white/30 bg-black/25 text-white')}
            >
              {w.name}
            </button>
          ))}
        </div>
      </div>
    </AppShell>
  )
}

const VIBE_LABEL: Record<Store['vibe'], string> = {
  streetwear: 'Streetwear', elegant: 'Elegant', luxury: 'Luxury', gym: 'Gym & sport', baddie: 'Baddie', basic: 'Basics', trad: 'Trad', thrift: 'Thrift', home: 'Home & beauty', rent: 'Rentals',
}

/**
 * A 2D shopfront: striped awning, neon sign, a lit window with three pieces on
 * show, a door. The sign and window light up on hover, focus and when you walk in.
 */
export function Storefront({ store, lit, onEnter }: { store: Store; lit: boolean; onEnter: () => void }) {  const show = useMemo(() => {
    const all = store.items().filter((i) => i.slot)
    const pick: CatalogItem[] = []
    for (const slot of ['dress', 'top', 'outerwear', 'shoes', 'bag', 'bottom', 'eyewear'] as OutfitSlot[]) {
      const it = all.find((i) => i.slot === slot && !pick.includes(i))
      if (it) pick.push(it)
      if (pick.length === 3) break
    }
    return pick.length ? pick : store.items().slice(0, 3)
  }, [store])
  const a = store.accent
  return (
    <button
      type="button"
      onClick={onEnter}
      aria-label={`Enter ${store.name}`}
      data-lit={lit || undefined}
      className="group relative block w-full text-left outline-none"
      style={{ '--a': a } as CSSProperties}
    >
      {/* building */}
      <span className="relative block overflow-hidden rounded-t-[28px] rounded-b-xl border-[3px] border-ink bg-[#FFF7FA] shadow-[0_8px_0_#0E0B10] transition-transform duration-150 group-hover:-translate-y-1 group-active:translate-y-1 dark:bg-[#1A1320]">
        {/* neon sign */}
        <span className="flex h-14 items-center justify-center bg-ink px-2">
          <span
            className="truncate text-center font-spicy text-lg leading-none text-[color:var(--a)] opacity-45 transition-[opacity,text-shadow] duration-200 group-hover:opacity-100 group-hover:[text-shadow:0_0_6px_var(--a),0_0_16px_var(--a)] group-focus-visible:opacity-100 group-data-[lit]:opacity-100 group-data-[lit]:[text-shadow:0_0_6px_var(--a),0_0_18px_var(--a),0_0_32px_var(--a)] motion-safe:group-data-[lit]:animate-[sign-on_.5s_steps(1)_both]"
            style={{ filter: 'saturate(1.2) brightness(1.15)' }}
          >
            {store.name}
          </span>
        </span>
        {/* scalloped awning */}
        <span
          aria-hidden
          className="block h-7"
          style={{
            background: `radial-gradient(circle at 10px 0, transparent 9px, ${a} 10px) 0 100%/20px 10px repeat-x, repeating-linear-gradient(90deg, ${a} 0 20px, #FFFFFF 20px 40px)`,
            backgroundBlendMode: 'normal',
          }}
        />
        {/* window + door */}
        <span className="flex gap-2 p-2.5">
          <span className="relative grid flex-1 grid-cols-3 items-end gap-1 overflow-hidden rounded-lg border-2 border-ink bg-[#FFEAF3] p-1.5 transition-colors duration-200 group-hover:bg-[#FFF6D8] group-data-[lit]:bg-[#FFF6D8] dark:bg-[#2A1F2E]">
            {show.map((i) => (
              <span key={i.id} className="block aspect-[3/4] overflow-hidden rounded-md bg-white/70">
                <ItemThumb item={i} />
              </span>
            ))}
            {/* warm light spill when lit */}
            <span aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgb(255_214_120/0.55),transparent_70%)] opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-data-[lit]:opacity-100" />
          </span>
          <span aria-hidden className="relative w-7 shrink-0 rounded-t-full border-2 border-ink bg-ink/85">
            <span className="absolute top-1/2 right-1 size-1.5 rounded-full bg-[#E9C46A]" />
          </span>
        </span>
        <span className="block border-t-2 border-dashed border-ink/15 px-2.5 pt-1.5 pb-2">
          <span className="block text-[10px] font-black tracking-wider uppercase" style={{ color: a }}>
            {VIBE_LABEL[store.vibe]}
            {store.nigerian && store.vibe !== 'rent' ? ' · Naija' : ''}
          </span>
          <span className="line-clamp-1 text-xs text-muted-foreground">{store.tagline}</span>
        </span>
      </span>
    </button>
  )
}

/* ------------------------------------------------------------ fitting room */

const ItemCarousel = lazy(() => import('../three/ItemCarousel'))

type FitCat = 'shirts' | 'dresses' | 'lingerie' | 'shoes' | 'belts' | 'caps' | 'bags' | 'chains'
const FIT_CATS: { id: FitCat; label: string; emoji: string; match: (i: CatalogItem) => boolean }[] = [
  { id: 'lingerie', label: 'Lingerie', emoji: '🎀', match: (i) => ['top', 'bottom', 'dress', 'swimwear', 'outerwear'].includes(i.slot ?? '') },
  { id: 'shirts', label: 'Shirts', emoji: '👕', match: (i) => i.slot === 'top' || i.slot === 'outerwear' },
  { id: 'dresses', label: 'Dresses', emoji: '👗', match: (i) => i.slot === 'dress' },
  { id: 'shoes', label: 'Shoes', emoji: '👟', match: (i) => i.slot === 'shoes' },
  { id: 'belts', label: 'Belts', emoji: '🪢', match: (i) => i.slot === 'belt' },
  { id: 'caps', label: 'Caps', emoji: '🧢', match: (i) => i.slot === 'headwear' && ['cap', 'bucket-hat', 'beret'].includes(i.template) },
  { id: 'bags', label: 'Bags', emoji: '👜', match: (i) => i.slot === 'bag' },
  { id: 'chains', label: 'Chains', emoji: '⛓️', match: (i) => i.slot === 'necklace' && ['chain', 'pendant'].includes(i.template) },
]
/** Which rails each kind of store has. */
const STORE_CATS = (kind: WorldStoreKind): FitCat[] =>
  kind === 'lingerie' ? ['lingerie', 'shoes', 'belts', 'bags'] : ['classy', 'baddie', 'luxury'].includes(kind) ? ['dresses', 'shirts', 'shoes', 'belts', 'caps', 'bags', 'chains'] : ['shirts', 'shoes', 'belts', 'caps', 'bags', 'chains']

/** Same piece in another print: grouped so the rail shows one of each. */
const variantKey = (i: CatalogItem) => `${i.brandId}|${i.template}|${i.colors[0]}|${i.colors[1]}`

/**
 * Walk into a store: your doll strolls in and stands in the middle of the shop.
 * Pick a rail (shirts, shoes, belts, caps, bags, chains), scroll the little 3D
 * pieces with the 3D arrows, and the one in the middle goes straight on you.
 */
function FittingRoom({ store, kind, label, onLeave }: { store: Store; kind: WorldStoreKind; label: string; onLeave: () => void }) {
  const doll = useSession((s) => s.doll)!
  const dollies = useSession((s) => s.progress?.dollies ?? 0)
  const owned = useOwned()
  const reduced = useReducedMotion()
  const buy = useAction('purchase')
  const save = useAction('saveAppearance')
  const all = useMemo(() => store.items().filter((i) => i.slot), [store])
  const cats = STORE_CATS(kind)
    .map((id) => FIT_CATS.find((c) => c.id === id)!)
    .filter((c) => all.some(c.match))
  const [cat, setCat] = useState<FitCat>(cats[0]?.id ?? 'shirts')
  const [index, setIndex] = useState(0)
  // Walk in and the first piece on the first rail is already on you.
  const [tried, setTried] = useState<Partial<Record<OutfitSlot, string>>>(() => {
    const def = FIT_CATS.find((c) => c.id === cats[0]?.id)
    const first = def ? (all.find((i) => def.match(i) && i.pattern === 'solid') ?? all.find(def.match)) : undefined
    return first?.slot ? { [first.slot]: first.id } : {}
  })
  const [pattern, setPattern] = useState<Record<string, string>>({})

  const catDef = FIT_CATS.find((c) => c.id === cat)!
  const { rail, variants } = useMemo(() => {
    const groups = new Map<string, CatalogItem[]>()
    for (const i of all) if (catDef.match(i)) (groups.get(variantKey(i)) ?? groups.set(variantKey(i), []).get(variantKey(i))!).push(i)
    const list = [...groups.values()].map((g) => g.find((i) => i.pattern === 'solid') ?? g[0])
    return { rail: list, variants: groups }
  }, [all, catDef])
  const base = rail[Math.min(index, rail.length - 1)]
  const current = base ? (all.find((i) => i.id === pattern[variantKey(base)]) ?? base) : null

  const put = (it: CatalogItem | null) => it?.slot && setTried((t) => ({ ...t, [it.slot!]: it.id }))
  // The piece in the middle of the rail is on you.
  const go = (i: number) => {
    const next = Math.max(0, Math.min(rail.length - 1, i))
    setIndex(next)
    const b = rail[next]
    if (b) put(all.find((x) => x.id === pattern[variantKey(b)]) ?? b)
  }
  const pickCat = (c: FitCat) => {
    setCat(c)
    setIndex(0)
    const first = (() => {
      const def = FIT_CATS.find((x) => x.id === c)!
      return all.find(def.match) ?? null
    })()
    put(first?.pattern === 'solid' ? first : (all.find((x) => FIT_CATS.find((d) => d.id === c)!.match(x) && x.pattern === 'solid') ?? first))
  }
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest('input,textarea,select')) return
      if (e.key === 'ArrowRight') go(index + 1)
      if (e.key === 'ArrowLeft') go(index - 1)
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  })

  const outfit: Outfit = useMemo(() => Object.entries(tried).reduce<Outfit>((o, [slot, id]) => wearItem(o, slot as OutfitSlot, id ?? null), doll.appearance.outfit), [tried, doll.appearance.outfit])
  const triedItems = Object.values(tried)
    .map((id) => CATALOG.find((i) => i.id === id))
    .filter((i): i is CatalogItem => !!i && Object.values(outfit).includes(i.id))
  const toBuy = triedItems.filter((i) => !owned[i.id])
  const total = toBuy.reduce((n, i) => n + i.price, 0)
  const wearingCurrent = !!current && Object.values(outfit).includes(current.id)
  // Dark labels (Meirre Chen, Sheeen) get an ivory sign with a gold glow so it reads on the shop wall.
  const dark = parseInt(store.accent.slice(1, 3), 16) + parseInt(store.accent.slice(3, 5), 16) + parseInt(store.accent.slice(5, 7), 16) < 150
  const neon = dark ? '#F5F0E6' : store.accent
  const glow = dark ? '#D4AF37' : store.accent

  const buyAndWear = async () => {
    if (toBuy.length) {
      if (total > dollies) return toast.error(`This look is ${formatGlam(total)} Glam. You have ${formatGlam(dollies)}.`)
      if (!(await buy.run({ itemIds: toBuy.map((i) => i.id) }))) return
    }
    if (await save.run({ appearance: { ...doll.appearance, outfit } })) {
      setTried({})
      toast.success(toBuy.length ? `Bought ${toBuy.length} piece${toBuy.length > 1 ? 's' : ''} and wearing it ✨` : 'Wearing the look ✨')
    }
  }

  return (
    <AppShell title={store.name} full>
      {/* the store's own fitting room, full screen: decor, a mirror, and you */}
      <div className="absolute inset-0 motion-safe:animate-[walk-in_.9s_cubic-bezier(.2,.8,.3,1)_both]">
        <Suspense fallback={<SceneFallback label="Walking in…" />}>
          <DollStage appearance={{ ...doll.appearance, outfit }} focus="full" interactive={false} reducedMotion={reduced} room={{ kind: kind as RoomKindProp, accent: store.accent, stock: all.slice(0, 40).map((i) => i.colors[0]) }} label={`You in the ${store.name} fitting room`} />
        </Suspense>
      </div>

      <p className="pointer-events-none absolute inset-x-0 top-4 text-center font-spicy text-3xl md:text-4xl" style={{ color: neon, textShadow: `0 0 6px ${glow}, 0 0 20px ${glow}`, filter: 'saturate(1.2) brightness(1.15)' }}>
        {store.name}
      </p>

      {/* back + the rails as round 3D buttons, down the left */}
      <div className="absolute top-3 left-[84px] flex flex-col items-center gap-2.5 md:left-[100px]">
        <button type="button" onClick={onLeave} aria-label="Back to the Drip" className="grid size-11 place-items-center rounded-full border border-white/30 bg-black/30 text-white backdrop-blur-md hover:bg-black/40">
          <Icon name="back" className="size-5" />
        </button>
        {cats.map((c) => (
          <button
            key={c.id}
            type="button"
            aria-pressed={cat === c.id}
            aria-label={c.label}
            title={c.label}
            onClick={() => pickCat(c.id)}
            className={cx('grid size-14 place-items-center rounded-full text-2xl transition-transform duration-150 hover:scale-105 active:scale-95 md:size-16 md:text-3xl', cat === c.id ? 'scale-110' : '')}
            style={{
              background: `radial-gradient(circle at 35% 28%, #FFFFFFAA 0%, ${store.accent} 38%, ${store.accent} 62%, #00000066 100%)`,
              boxShadow: cat === c.id ? `0 0 0 3px #FFFFFF, 0 8px 18px ${store.accent}88` : '0 6px 14px rgb(0 0 0 / 0.28), inset 0 -4px 8px rgb(0 0 0 / 0.25)',
            }}
          >
            <span className="drop-shadow-[0_2px_2px_rgb(0_0_0/0.35)]">{c.emoji}</span>
          </button>
        ))}
      </div>

      {/* the rail of 3D cards with prices, down the right */}
      <section aria-label={`${store.name}: ${label}`} className="absolute top-20 right-2 bottom-[132px] w-[150px] md:right-3 md:w-[210px]">
        {rail.length ? (
          <Suspense fallback={<SceneFallback label="Setting out the rail" />}>
            <ItemCarousel vertical items={rail} index={Math.min(index, rail.length - 1)} onIndex={go} accent={store.accent} reducedMotion={reduced} labelOf={(i) => (owned[i.id] ? 'Owned' : formatGlam(i.price))} />
          </Suspense>
        ) : (
          <p className="grid h-full place-items-center rounded-3xl bg-black/20 text-sm text-white">Sold out. Try another rail.</p>
        )}
        <p className="pointer-events-none absolute -bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-black/30 px-2 text-[11px] font-bold text-white tabular-nums backdrop-blur">
          {rail.length ? Math.min(index, rail.length - 1) + 1 : 0} / {rail.length}
        </p>
      </section>

      {/* what you're trying on, and the till */}
      {current && (
        <div className="absolute inset-x-2 bottom-3 flex justify-center md:inset-x-auto md:right-[230px] md:left-[200px]">
          <div className="w-full max-w-xl rounded-[24px] border border-white/25 bg-black/35 p-3 text-white shadow-[0_10px_30px_rgb(0_0_0/0.25)] backdrop-blur-md">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-bold">{current.name}</p>
                <p className="text-sm text-white/70">
                  {owned[current.id] ? 'You own this' : `${formatGlam(current.price)} Glam`}
                  {wearingCurrent ? ' · on you' : ''}
                </p>
              </div>
              {wearingCurrent && (
                <button type="button" onClick={() => current.slot && setTried((t) => ({ ...t, [current.slot!]: undefined }))} className="shrink-0 text-xs font-bold underline">
                  Take it off
                </button>
              )}
            </div>
            {(variants.get(variantKey(current))?.length ?? 0) > 1 && (
              <div className="no-scrollbar mt-1.5 flex gap-1.5 overflow-x-auto">
                {variants.get(variantKey(current))!.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    aria-pressed={v.id === current.id}
                    onClick={() => {
                      setPattern((p) => ({ ...p, [variantKey(v)]: v.id }))
                      put(v)
                    }}
                    className={cx('shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-bold capitalize', v.id === current.id ? 'border-white bg-white text-ink' : 'border-white/40')}
                  >
                    {v.pattern === 'solid' ? 'Plain' : v.pattern}
                  </button>
                ))}
              </div>
            )}
            <div className="mt-2 flex gap-2">
              <button type="button" disabled={!triedItems.length || buy.pending || save.pending} onClick={buyAndWear} className={buttonClass('primary', 'md', 'flex-1')}>
                {toBuy.length ? `Buy & wear · ${formatGlam(total)} Glam` : 'Wear this look'}
              </button>
              {Object.keys(tried).length > 0 && (
                <button type="button" onClick={() => setTried({})} className="min-h-11 rounded-full border border-white/40 px-4 text-sm font-bold">
                  Reset
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </AppShell>
  )
}

/* -------------------------------------------------------- dressing station */

type Cat = 'all' | 'clothes' | 'shoes' | 'bags' | 'shades' | 'jewellery' | 'headwear' | 'swim' | 'beauty' | 'home'
const CATS: { id: Cat; label: string; emoji: string; match: (i: CatalogItem) => boolean }[] = [
  { id: 'all', label: 'All', emoji: '✨', match: () => true },
  { id: 'clothes', label: 'Clothes', emoji: '👗', match: (i) => ['top', 'bottom', 'dress', 'outerwear'].includes(i.slot ?? '') },
  { id: 'shoes', label: 'Shoes', emoji: '👠', match: (i) => i.slot === 'shoes' },
  { id: 'bags', label: 'Bags', emoji: '👜', match: (i) => i.slot === 'bag' },
  { id: 'shades', label: 'Shades', emoji: '🕶️', match: (i) => i.slot === 'eyewear' },
  { id: 'jewellery', label: 'Jewellery', emoji: '💍', match: (i) => ['earrings', 'necklace', 'bracelet'].includes(i.slot ?? '') },
  { id: 'headwear', label: 'Headwear', emoji: '👑', match: (i) => i.slot === 'headwear' },
  { id: 'swim', label: 'Swim', emoji: '👙', match: (i) => i.slot === 'swimwear' },
  { id: 'beauty', label: 'Hair & beauty', emoji: '💄', match: (i) => !i.slot && i.category !== 'home' },
  { id: 'home', label: 'Home', emoji: '🛋️', match: (i) => i.category === 'home' },
]
const CLOTHES_SUB: { id: OutfitSlot | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'top', label: 'Tops' },
  { id: 'bottom', label: 'Bottoms' },
  { id: 'dress', label: 'Dresses' },
  { id: 'outerwear', label: 'Outerwear' },
]
const PAGE = 48
const RENT_DAYS: RentDays[] = [1, 3, 7]

function StoreInterior({ store, initialItem, onLeave }: { store: Store; initialItem: string | null; onLeave: () => void }) {
  const navigate = useNavigate()
  const doll = useSession((s) => s.doll)!
  const dollies = useSession((s) => s.progress?.dollies ?? 0)
  const rentals = useSession((s) => s.inventory?.rentals)
  const owned = useOwned()
  const reducedMotion = useReducedMotion()
  const buy = useAction('purchase')
  const rent = useAction('rentItem')
  const save = useAction('saveAppearance')
  const items = useMemo(() => store.items(), [store])
  const cats = CATS.filter((c) => c.id === 'all' || items.some(c.match))
  const [cat, setCat] = useState<Cat>('all')
  const [sub, setSub] = useState<OutfitSlot | 'all'>('all')
  const [colour, setColour] = useState<ColourFamily | null>(null)
  const [sort, setSort] = useState<'featured' | 'low' | 'high'>('featured')
  const [limit, setLimit] = useState(PAGE)
  const [tried, setTried] = useState<string[]>(() => (initialItem ? [initialItem] : []))
  const [bag, setBag] = useState<string[]>([])
  const [bagOpen, setBagOpen] = useState(false)
  const [renting, setRenting] = useState<CatalogItem | null>(null)
  const [now] = useState(() => Date.now())
  const [entered, setEntered] = useState(false)
  useEffect(() => {
    const t = window.setTimeout(() => setEntered(true), 60)
    return () => window.clearTimeout(t)
  }, [])

  const catDef = CATS.find((c) => c.id === cat)!
  const list = useMemo(() => {
    const out = items.filter((i) => catDef.match(i) && (cat !== 'clothes' || sub === 'all' || i.slot === sub) && (!colour || colourFamily(i.colors[0]) === colour))
    if (sort === 'low') out.sort((a, b) => a.price - b.price)
    if (sort === 'high') out.sort((a, b) => b.price - a.price)
    return out
  }, [items, catDef, cat, sub, colour, sort])

  // The look in the mirror: what you're wearing plus everything you've tried on here.
  const outfit: Outfit = useMemo(() => tried.map((id) => CATALOG.find((i) => i.id === id)).reduce<Outfit>((o, i) => (i?.slot ? wearItem(o, i.slot, i.id) : o), doll.appearance.outfit), [tried, doll.appearance.outfit])
  const triedItems = tried.map((id) => CATALOG.find((i) => i.id === id)).filter((i): i is CatalogItem => !!i && Object.values(outfit).includes(i.id))
  const toBuy = triedItems.filter((i) => !owned[i.id])
  const lookCost = toBuy.reduce((n, i) => n + i.price, 0)
  const bagItems = bag.map((id) => CATALOG.find((i) => i.id === id)!).filter(Boolean)
  const bagTotal = bagItems.reduce((n, i) => n + i.price, 0)

  const tryOn = (i: CatalogItem) => {
    if (!i.slot) return
    setTried((t) => (t.includes(i.id) ? t.filter((x) => x !== i.id) : [...t.filter((x) => CATALOG.find((c) => c.id === x)?.slot !== i.slot), i.id]))
  }

  const buyLook = async () => {
    if (toBuy.length) {
      if (lookCost > dollies) return toast.error(`This look is ${formatGlam(lookCost)} Glam. You have ${formatGlam(dollies)}.`)
      const r = await buy.run({ itemIds: toBuy.map((i) => i.id) })
      if (!r) return
    }
    const r = await save.run({ appearance: { ...doll.appearance, outfit } })
    if (r) {
      setTried([])
      toast.success(toBuy.length ? `Bought ${toBuy.length} piece${toBuy.length > 1 ? 's' : ''} and wearing the look ✨` : 'Wearing the look ✨')
    }
  }

  const checkout = async () => {
    if (!bag.length) return
    const r = await buy.run({ itemIds: bag })
    if (!r) return
    const furniture = bagItems.some((i) => i.furniture)
    setBag([])
    setBagOpen(false)
    toast.success(`Bought ${bagItems.length} item${bagItems.length > 1 ? 's' : ''}`, furniture ? { label: 'Place it', onClick: () => navigate('/crib') } : undefined)
  }

  return (
    <AppShell title="Drip" full>
      <div className="flex h-full flex-col split:flex-row">
        {/* mirror */}
        <div className="relative flex h-[44%] shrink-0 flex-col split:h-full split:w-[44%]" style={{ background: `radial-gradient(ellipse at 50% 30%, ${store.accent}33, transparent 70%)` }}>
          <div className="flex items-center gap-2 px-3 pt-3">
            <button type="button" onClick={onLeave} aria-label="Back to the Drip" className="grid size-10 shrink-0 place-items-center rounded-full border-2 border-ink bg-card shadow-[0_3px_0_#0E0B10] active:translate-y-[2px] active:shadow-none">
              <Icon name="back" className="size-4" />
            </button>
            <div className="min-w-0 flex-1 rounded-2xl bg-ink px-3 py-1.5">
              <p
                className={cx('truncate font-spicy text-xl leading-tight transition-[opacity,text-shadow] duration-500', entered ? 'opacity-100' : 'opacity-30')}
                style={{ color: store.accent, textShadow: entered ? `0 0 6px ${store.accent}, 0 0 18px ${store.accent}` : 'none', filter: 'saturate(1.2) brightness(1.15)' }}
              >
                {store.name}
              </p>
              <p className="truncate text-[11px] text-white/60">{store.tagline}</p>
            </div>
            <button type="button" onClick={() => setBagOpen(true)} className="relative grid size-10 shrink-0 place-items-center rounded-full border-2 border-ink bg-card shadow-[0_3px_0_#0E0B10]" aria-label={`Bag, ${bag.length} items`}>
              <Icon name="bag" className="size-4" />
              {bag.length > 0 && <span className="absolute -top-1 -right-1 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[11px] font-bold text-ink">{bag.length}</span>}
            </button>
          </div>
          {/* dressing-room mirror with vanity bulbs */}
          <div className="relative mx-auto my-2 min-h-0 w-[min(100%,420px)] flex-1 px-3">
            <div className="relative h-full overflow-hidden rounded-t-[999px] rounded-b-3xl border-[4px] border-ink bg-[#FFF7FA] dark:bg-[#1A1320]">
              <Suspense fallback={<SceneFallback label="Fitting room" />}>
                <DollStage appearance={{ ...doll.appearance, outfit }} focus="full" reducedMotion={reducedMotion} label="You in the fitting-room mirror" />
              </Suspense>
            </div>
            <span aria-hidden className="pointer-events-none absolute inset-y-6 left-0.5 flex flex-col justify-between">
              {Array.from({ length: 6 }, (_, i) => (
                <span key={i} className="size-3 rounded-full border-2 border-ink bg-[#FFF3C4]" />
              ))}
            </span>
            <span aria-hidden className="pointer-events-none absolute inset-y-6 right-0.5 flex flex-col justify-between">
              {Array.from({ length: 6 }, (_, i) => (
                <span key={i} className="size-3 rounded-full border-2 border-ink bg-[#FFF3C4]" />
              ))}
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-1.5 px-3 pb-3">
            {triedItems.map((i) => (
              <button key={i.id} type="button" onClick={() => tryOn(i)} className="max-w-36 truncate rounded-full border-2 border-ink bg-card px-2.5 py-1 text-[11px] font-bold" title="Take off">
                ✕ {i.name.split(' — ')[0]}
              </button>
            ))}
            {triedItems.length > 0 ? (
              <button type="button" className={buttonClass('primary', 'sm')} disabled={buy.pending || save.pending} onClick={buyLook}>
                {toBuy.length ? `Buy & wear · ${formatGlam(lookCost)} G` : 'Wear this look'}
              </button>
            ) : (
              <p className="text-xs text-muted-foreground">Tap any piece to try it on.</p>
            )}
          </div>
        </div>

        {/* racks */}
        <section className="flex min-h-0 flex-1 flex-col border-t-2 border-ink bg-card split:border-t-0 split:border-l-2">
          <div role="tablist" aria-label="Categories" className="no-scrollbar flex gap-1.5 overflow-x-auto px-3 pt-3">
            {cats.map((c) => (
              <button
                key={c.id}
                role="tab"
                type="button"
                aria-selected={cat === c.id}
                onClick={() => {
                  setCat(c.id)
                  setSub('all')
                  setLimit(PAGE)
                }}
                className={cx('flex shrink-0 flex-col items-center gap-0.5 rounded-2xl border-2 px-3 py-1.5 text-[11px] font-bold transition-transform active:scale-95', cat === c.id ? 'border-ink bg-ink text-white' : 'border-border hover:border-ink')}
              >
                <span aria-hidden className="text-lg leading-none">
                  {c.emoji}
                </span>
                {c.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1.5 px-3 pt-2">
            {cat === 'clothes' &&
              CLOTHES_SUB.map((s) => (
                <button key={s.id} type="button" aria-pressed={sub === s.id} onClick={() => setSub(s.id)} className={cx('rounded-full px-2.5 py-1 text-xs font-semibold', sub === s.id ? 'bg-primary text-ink' : 'bg-muted')}>
                  {s.label}
                </button>
              ))}
            <span className="flex gap-1">
              {COLOUR_FAMILIES.map((c) => (
                <button key={c.id} type="button" aria-label={c.id} aria-pressed={colour === c.id} onClick={() => setColour(colour === c.id ? null : c.id)} className={cx('grid size-7 place-items-center rounded-full border-2', colour === c.id ? 'border-ink' : 'border-transparent')}>
                  <span className="size-5 rounded-full border border-border" style={{ background: c.swatch }} />
                </button>
              ))}
            </span>
            <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="Sort" className="ml-auto h-8 rounded-full border border-border bg-background px-2 text-xs font-semibold">
              <option value="featured">Featured</option>
              <option value="low">Price ↑</option>
              <option value="high">Price ↓</option>
            </select>
          </div>
          {store.vibe === 'rent' && (
            <p className="mx-3 mt-2 rounded-2xl bg-muted px-3 py-2 text-xs">
              Rent for {Math.round(RENT_RATES[1] * 100)}% (1 day), {Math.round(RENT_RATES[3] * 100)}% (3 days) or {Math.round(RENT_RATES[7] * 100)}% (a week) of the price.
            </p>
          )}
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            <p className="mb-2 text-xs text-muted-foreground">{list.length} pieces</p>
            <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
              {list.slice(0, limit).map((i) => {
                const on = Object.values(outfit).includes(i.id) && tried.includes(i.id)
                const own = owned[i.id] ?? 0
                const left = Math.max(0, Math.ceil(((rentals?.[i.id] ?? 0) - now) / 3600000))
                return (
                  <li key={i.id} className={cx('flex flex-col overflow-hidden rounded-2xl border-2 bg-background transition-transform', on ? 'border-primary' : 'border-border')}>
                    <button type="button" onClick={() => tryOn(i)} disabled={!i.slot} className="relative block aspect-square" aria-label={i.slot ? `Try on ${i.name}` : i.name} aria-pressed={on}>
                      <ItemThumb item={i} />
                      {on && <span className="absolute top-1.5 left-1.5 rounded-full bg-primary px-2 py-0.5 text-[10px] font-black text-ink">ON</span>}
                      {own > 0 && !left && <span className="absolute top-1.5 right-1.5 rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-accent-foreground">Owned</span>}
                      {left > 0 && !own && <span className="absolute top-1.5 right-1.5 rounded-full bg-acid px-2 py-0.5 text-[10px] font-bold text-ink">Rented · {left > 24 ? `${Math.ceil(left / 24)}d` : `${left}h`}</span>}
                    </button>
                    <div className="flex flex-1 flex-col gap-0.5 p-2">
                      {store.id === 'mall' || store.vibe === 'rent' ? <span className="truncate text-[10px] font-semibold text-muted-foreground">{brandName(BRAND_BY_ID.get(i.brandId))}</span> : null}
                      <span className="line-clamp-2 text-xs leading-snug font-semibold">{i.name}</span>
                      <div className="mt-auto flex items-center justify-between gap-1 pt-1">
                        <span className="text-sm font-bold tabular-nums">{formatGlam(i.price)} G</span>
                        {store.vibe === 'rent' ? (
                          <button type="button" onClick={() => setRenting(i)} className={buttonClass('secondary', 'sm', 'px-2.5')}>
                            Rent
                          </button>
                        ) : (
                          <button type="button" aria-label={`Add ${i.name} to bag`} onClick={() => setBag((b) => (b.includes(i.id) ? b.filter((x) => x !== i.id) : [...b, i.id]))} className={buttonClass(bag.includes(i.id) ? 'secondary' : 'primary', 'sm', 'px-2.5')}>
                            <Icon name={bag.includes(i.id) ? 'check' : 'plus'} className="size-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
            {list.length > limit && (
              <div className="flex justify-center py-4">
                <button type="button" className={buttonClass('secondary', 'md')} onClick={() => setLimit(limit + PAGE)}>
                  Show more ({list.length - limit} left)
                </button>
              </div>
            )}
            {!list.length && <p className="py-10 text-center text-sm text-muted-foreground">Nothing on this rail in that colour.</p>}
          </div>
        </section>
      </div>

      <Modal open={!!renting} onClose={() => setRenting(null)} title={renting ? `Rent: ${renting.name}` : 'Rent'}>
        {renting && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              {brandName(BRAND_BY_ID.get(renting.brandId))} · buy it for {formatGlam(renting.price)} G, or wear it for a while:
            </p>
            <div className="grid grid-cols-3 gap-2">
              {RENT_DAYS.map((d) => (
                <button
                  key={d}
                  type="button"
                  disabled={rent.pending || rentPrice(renting.price, d) > dollies}
                  onClick={async () => {
                    const r = await rent.run({ itemId: renting.id, days: d })
                    if (!r) return
                    const it = renting
                    setRenting(null)
                    toast.success(`${it.name} is yours for ${d} day${d > 1 ? 's' : ''}`, {
                      label: 'Wear now',
                      onClick: async () => {
                        if (await runAction('saveAppearance', { appearance: { ...doll.appearance, outfit: wearItem(doll.appearance.outfit, it.slot!, it.id) } })) toast.success('New look on')
                      },
                    })
                  }}
                  className="flex flex-col items-center gap-0.5 rounded-2xl border-2 border-border p-3 hover:border-primary disabled:opacity-40"
                >
                  <span className="font-display text-lg font-black">{d === 7 ? '1 week' : `${d} day${d > 1 ? 's' : ''}`}</span>
                  <span className="text-sm font-semibold tabular-nums">{formatGlam(rentPrice(renting.price, d))} G</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </Modal>

      <Modal open={bagOpen} onClose={() => setBagOpen(false)} title="Your bag">
        {bagItems.length ? (
          <div className="flex flex-col gap-3">
            <ul className="flex max-h-80 flex-col gap-2 overflow-y-auto">
              {bagItems.map((i, idx) => (
                <li key={`${i.id}${idx}`} className="flex items-center gap-3 rounded-2xl border border-border p-2">
                  <span className="size-14 shrink-0 overflow-hidden rounded-xl">
                    <ItemThumb item={i} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{i.name}</span>
                    <span className="text-sm text-muted-foreground">{formatGlam(i.price)} G</span>
                  </span>
                  <button type="button" aria-label={`Remove ${i.name}`} className="grid size-10 place-items-center rounded-full hover:bg-muted" onClick={() => setBag(bag.filter((_, k) => k !== idx))}>
                    <Icon name="trash" className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex justify-between font-semibold">
              <span>Total</span>
              <span className="tabular-nums">{formatGlam(bagTotal)} Glam</span>
            </div>
            <button type="button" className={buttonClass('primary', 'lg', 'w-full')} disabled={buy.pending || bagTotal > dollies} onClick={checkout}>
              {bagTotal > dollies ? 'Not enough Glam' : 'Checkout'}
            </button>
            {bagTotal > dollies && (
              <button type="button" className={buttonClass('ghost', 'md')} onClick={() => navigate('/work')}>
                Earn Glam at work
              </button>
            )}
          </div>
        ) : (
          <p className="text-muted-foreground">Your bag is empty.</p>
        )}
      </Modal>
    </AppShell>
  )
}
