import { lazy, Suspense, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { AppShell } from '../components/AppShell'
import { ItemThumb } from '../components/art/ItemThumb'
import { Icon } from '../components/Icon'
import { SceneFallback } from '../components/SceneFallback'
import { runAction, useAction } from '../hooks/useAction'
import { useReducedMotion } from '../hooks/useMediaQuery'
import { useOwned } from '../hooks/useOwned'
import { brandName, COLOUR_FAMILIES, colourFamily, type ColourFamily } from '../lib/brands'
import { uploadPortrait } from '../lib/dollTools'
import { buttonClass, chipClass, cx, formatGlam, inputClass } from '../lib/ui'
import { outfitSummary, wearItem } from '../shared/appearance'
import { BRANDS, CATALOG, getItem, STARTER_ITEMS } from '../shared/catalog'
import { AESTHETICS } from '../shared/aesthetics'
import type { Aesthetic, CatalogItem, Outfit, OutfitSlot, Rarity } from '../shared/types'
import { useSession } from '../store/useSession'
import { toast } from '../store/useToasts'
import type { DollStageHandle } from '../three/DollStage'

const DollStage = lazy(() => import('../three/DollStage'))

const SLOTS: { id: OutfitSlot | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'top', label: 'Tops' },
  { id: 'bottom', label: 'Bottoms' },
  { id: 'dress', label: 'Dresses' },
  { id: 'outerwear', label: 'Outerwear' },
  { id: 'shoes', label: 'Shoes' },
  { id: 'bag', label: 'Bags' },
  { id: 'headwear', label: 'Headwear' },
  { id: 'eyewear', label: 'Eyewear' },
  { id: 'earrings', label: 'Earrings' },
  { id: 'necklace', label: 'Necklaces' },
  { id: 'bracelet', label: 'Bracelets' },
  { id: 'belt', label: 'Belts' },
  { id: 'swimwear', label: 'Swim' },
]

export default function Wardrobe() {
  const uid = useSession((s) => s.user!.uid)
  const doll = useSession((s) => s.doll)!
  const owned = useOwned()
  const presets = useSession((s) => s.outfits?.presets ?? [])
  const reducedMotion = useReducedMotion()
  const stage = useRef<DollStageHandle>(null)
  const [outfit, setOutfit] = useState<Outfit>(doll.appearance.outfit)
  const [slot, setSlot] = useState<OutfitSlot | 'all'>('all')
  const [q, setQ] = useState('')
  const [brand, setBrand] = useState('all')
  const [colour, setColour] = useState<ColourFamily | null>(null)
  const [rarity, setRarity] = useState<Rarity | 'all'>('all')
  const [own, setOwn] = useState<'owned' | 'all' | 'locked' | 'favourites'>('owned')
  const [aesthetic, setAesthetic] = useState<Aesthetic | 'all'>('all')
  const [sort, setSort] = useState<'new' | 'price-asc' | 'price-desc'>('new')
  const [presetName, setPresetName] = useState('')
  const favourites = useSession((s) => s.outfits?.favourites ?? [])
  const navigate = useNavigate()
  const save = useAction('saveAppearance')
  const [limit, setLimit] = useState(60)
  const dirty = JSON.stringify(outfit) !== JSON.stringify(doll.appearance.outfit)

  const items = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const pool: CatalogItem[] =
      own === 'owned'
        ? Object.keys(owned).map((id) => getItem(id)!).filter(Boolean)
        : own === 'favourites'
          ? favourites.map((id) => getItem(id)!).filter(Boolean)
          : [...STARTER_ITEMS, ...CATALOG].filter((i) => own === 'all' || !owned[i.id])
    const out = pool
      .filter((i): i is CatalogItem => !!i?.slot)
      .filter((i) => (slot === 'all' || i.slot === slot) && (brand === 'all' || i.brandId === brand) && (rarity === 'all' || i.rarity === rarity) && (!colour || colourFamily(i.colors[0]) === colour))
      .filter((i) => aesthetic === 'all' || i.aesthetics?.includes(aesthetic))
      .filter((i) => !needle || `${i.name} ${brandName(i.brandId)} ${i.tags.join(' ')}`.toLowerCase().includes(needle))
    if (sort === 'price-asc') out.sort((a, b) => a.price - b.price)
    if (sort === 'price-desc') out.sort((a, b) => b.price - a.price)
    return out
  }, [owned, favourites, own, slot, brand, rarity, colour, aesthetic, sort, q])

  const ownedBrands = own === 'owned' ? BRANDS.filter((b) => Object.keys(owned).some((id) => getItem(id)?.brandId === b.id && getItem(id)?.slot)) : BRANDS

  const closetItems = useMemo(() => Object.keys(owned).map((id) => getItem(id)).filter((i): i is CatalogItem => !!i?.slot), [owned])
  const closetColors = useMemo(() => closetItems.slice(0, 30).map((i) => i.colors[0]).filter(Boolean), [closetItems])
  const closetWorth = closetItems.reduce((n, i) => n + i.price, 0)
  const lockedWorn = Object.values(outfit).filter((id) => id && !owned[id] && !id.startsWith('starter-'))
  const commit = async () => {
    if (lockedWorn.length) {
      toast.error('You’re previewing pieces you don’t own yet. Unlock them in the shop first.')
      return
    }
    const portrait = await uploadPortrait(uid, stage.current?.capturePortrait() ?? null)
    const r = await save.run({ appearance: { ...doll.appearance, outfit }, portrait })
    if (r) toast.success('Outfit on')
  }

  const postLook = async () => {
    if (dirty) await commit()
    const img = await uploadPortrait(uid, stage.current?.captureFull() ?? null)
    const r = await runAction('createPost', { kind: 'look', image: img, caption: outfitSummary(outfit) })
    if (r) toast.success('Look posted to the feed')
  }

  return (
    <AppShell title="Wardrobe" full>
      <div className="flex h-full flex-col split:flex-row">
        <div className="relative h-[42%] shrink-0 split:h-full split:flex-1">
          <Suspense fallback={<SceneFallback label="Opening the closet" />}>
            <DollStage ref={stage} appearance={{ ...doll.appearance, outfit }} reducedMotion={reducedMotion} closet={closetColors} label="Your doll in your walk-in closet" />
          </Suspense>
          <div className="pointer-events-none absolute top-3 left-3 rounded-3xl bg-card/90 px-4 py-2.5 shadow-[var(--shadow-soft)] backdrop-blur">
            <p className="text-[10px] font-bold tracking-[0.2em] text-primary uppercase">Walk-in closet</p>
            <p className="font-display text-xl leading-tight font-black tabular-nums">{closetItems.length} pieces</p>
            {closetWorth > 0 && <p className="text-xs text-muted-foreground">worth {formatGlam(closetWorth)} G</p>}
          </div>
          <div className="absolute inset-x-0 bottom-3 flex justify-center gap-2 px-3">
            <button type="button" className={buttonClass('secondary', 'sm')} onClick={() => setOutfit(doll.appearance.outfit)} disabled={!dirty}>
              <Icon name="reset" className="size-4" /> Reset
            </button>
            <button type="button" className={buttonClass('secondary', 'sm')} onClick={postLook}>
              <Icon name="camera" className="size-4" /> Post look
            </button>
            <button type="button" className={buttonClass('primary', 'sm')} onClick={commit} disabled={!dirty || save.pending}>
              Wear this
            </button>
          </div>
        </div>

        <section className="flex min-h-0 flex-1 flex-col border-t border-border bg-card split:w-[440px] split:flex-none split:border-t-0 split:border-l">
          <div className="flex flex-col gap-3 p-4">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search clothes, brands, colours" className={inputClass} aria-label="Search the wardrobe" />
            <div role="tablist" aria-label="Ownership" className="flex gap-1.5">
              {(
                [
                  ['owned', 'My closet'],
                  ['favourites', `Favourites${favourites.length ? ` · ${favourites.length}` : ''}`],
                  ['locked', 'Locked'],
                  ['all', 'Everything'],
                ] as const
              ).map(([id, label]) => (
                <button key={id} role="tab" type="button" aria-selected={own === id} onClick={() => setOwn(id)} className={chipClass(own === id)}>
                  {label}
                </button>
              ))}
            </div>
            <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
              {SLOTS.map((s) => (
                <button key={s.id} type="button" aria-pressed={slot === s.id} onClick={() => setSlot(s.id)} className={chipClass(slot === s.id)}>
                  {s.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select value={brand} onChange={(e) => setBrand(e.target.value)} className="min-h-10 rounded-full border border-border bg-background px-3 text-sm font-semibold" aria-label="Brand">
                <option value="all">All brands</option>
                {ownedBrands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {brandName(b)}
                  </option>
                ))}
              </select>
              <select value={rarity} onChange={(e) => setRarity(e.target.value as Rarity | 'all')} className="min-h-10 rounded-full border border-border bg-background px-3 text-sm font-semibold" aria-label="Rarity">
                <option value="all">Any rarity</option>
                {(['common', 'rare', 'epic', 'legendary', 'limited'] as const).map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <select value={aesthetic} onChange={(e) => setAesthetic(e.target.value as Aesthetic | 'all')} className="min-h-10 rounded-full border border-border bg-background px-3 text-sm font-semibold" aria-label="Aesthetic">
                <option value="all">Any aesthetic</option>
                {AESTHETICS.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.label}
                  </option>
                ))}
              </select>
              <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="min-h-10 rounded-full border border-border bg-background px-3 text-sm font-semibold" aria-label="Sort by price">
                <option value="new">Default order</option>
                <option value="price-asc">Price: low to high</option>
                <option value="price-desc">Price: high to low</option>
              </select>
              <div className="flex gap-0.5">
                {COLOUR_FAMILIES.map((c) => (
                  <button key={c.id} type="button" aria-label={c.id} aria-pressed={colour === c.id} onClick={() => setColour(colour === c.id ? null : c.id)} className={cx('grid size-8 place-items-center rounded-full border-2', colour === c.id ? 'border-primary' : 'border-transparent')}>
                    <span className="size-5 rounded-full border border-border" style={{ background: c.swatch }} />
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
            <div className="grid grid-cols-3 gap-2">
              {items.slice(0, limit).map((it) => {
                const worn = outfit[it.slot!] === it.id
                const has = !!owned[it.id]
                const fav = favourites.includes(it.id)
                return (
                  <div key={it.id} className={cx('relative overflow-hidden rounded-2xl border-2 bg-background', worn ? 'border-primary' : 'border-border')}>
                    <button
                      type="button"
                      aria-pressed={worn}
                      aria-label={`${has ? (worn ? 'Take off' : 'Wear') : 'Preview'} ${it.name}`}
                      onClick={() => setOutfit(wearItem(outfit, it.slot!, worn ? null : it.id))}
                      className="block w-full text-left"
                    >
                      <span className="relative block aspect-square">
                        <ItemThumb item={it} />
                        {!has && (
                          <span className="absolute inset-x-0 bottom-0 flex items-center gap-1 bg-ink/75 px-2 py-1 text-[10px] font-bold text-bone">
                            <Icon name="lock" className="size-3" /> {formatGlam(it.price)} Glam
                          </span>
                        )}
                      </span>
                      <span className="line-clamp-2 px-2 py-1 text-[11px] leading-tight font-semibold">{it.name}</span>
                    </button>
                    <button
                      type="button"
                      aria-label={fav ? `Unfavourite ${it.name}` : `Favourite ${it.name}`}
                      aria-pressed={fav}
                      onClick={() => runAction('setFavourite', { itemId: it.id, favourite: !fav }, { silent: true })}
                      className={cx('absolute top-1 right-1 grid size-8 place-items-center rounded-full bg-card/90', fav ? 'text-primary' : 'text-muted-foreground')}
                    >
                      <Icon name="heart" filled={fav} className="size-4" />
                    </button>
                    {!has && (
                      <button type="button" onClick={() => navigate(`/shop?item=${encodeURIComponent(it.id)}`)} className="w-full border-t border-border py-1.5 text-[11px] font-bold text-secondary">
                        Unlock in shop
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
            {items.length > limit && (
              <div className="flex justify-center py-3">
                <button type="button" className={buttonClass('secondary', 'md')} onClick={() => setLimit(limit + 60)}>
                  Show more ({items.length - limit} left)
                </button>
              </div>
            )}
            {!items.length && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Nothing here.{' '}
                <Link to="/shop" className="font-semibold text-secondary">
                  Go shopping
                </Link>
              </p>
            )}

            <h2 className="mt-6 mb-2 font-display text-base font-bold">Outfit presets</h2>
            <div className="flex gap-2">
              <input value={presetName} onChange={(e) => setPresetName(e.target.value)} maxLength={30} placeholder="e.g. Owambe Saturday" className={inputClass} />
              <button
                type="button"
                className={buttonClass('secondary', 'md')}
                disabled={!presetName.trim()}
                onClick={async () => {
                  const r = await runAction('saveOutfitPresets', { presets: [...presets, { id: crypto.randomUUID().slice(0, 10), name: presetName.trim(), outfit }] })
                  if (r) {
                    setPresetName('')
                    toast.success('Preset saved')
                  }
                }}
              >
                Save
              </button>
            </div>
            <ul className="mt-3 flex flex-col gap-2">
              {presets.map((p) => (
                <li key={p.id} className="flex items-center gap-2 rounded-2xl border border-border p-2 pl-3">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{p.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{outfitSummary(p.outfit)}</span>
                  </span>
                  <button type="button" className={buttonClass('primary', 'sm')} onClick={() => setOutfit(Object.fromEntries(Object.entries(p.outfit).filter(([, id]) => owned[id!] || id!.startsWith('starter-'))))}>
                    Wear
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete ${p.name}`}
                    className="grid size-9 place-items-center rounded-full hover:bg-muted"
                    onClick={() => runAction('saveOutfitPresets', { presets: presets.filter((x) => x.id !== p.id) })}
                  >
                    <Icon name="trash" className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </AppShell>
  )
}
