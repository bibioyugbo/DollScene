import type { ReactNode } from 'react'
import { PROCEDURES } from '../../../shared/studio/clinic'
import { HAIR_COLOR_PRESETS } from '../../../shared/studio/hairColors'
import { HEELS, LOCS, needsHeels, TATTOO_DESIGNS, TATTOO_SPOTS, type ClinicId, type Extras, type HairId, type Jewellery, type MorphId, type PieceSlot, type SpotId, type StudioLook, type TattooDesign, type TattooSpot } from '../../../shared/studio/look'
import { MAKEUP_PRESETS, mixHex, SKIN_TONES } from '../../../shared/studio/presets'
import { dressStep, hairColourStep, hairStyleStep, tattooRemoveStep, tattooStep, wearStep } from '../../actions/dress'
import { BONNET_ON, BRUSH, DRY, HAIR_PRODUCTS, hairKind, RETWIST, RETWIST_TO, TAKEDOWN, TAKEDOWN_TO, WASH } from '../../actions/haircare'
import { amountOf, BROW_STEP, lookStep, makeupStep, REMOVE_ALL, shadeProduct, type MakeupKey } from '../../actions/makeup'
import { MANICURE } from '../../actions/nailcare'
import { BONNET_OFF, BRIGHTEN, CLEANSE, COMPRESS, EXFOLIATE, EYE_CREAM, EYE_PATCHES, FACE_WASH, LIP_BALM, MOISTURISER, PATCH_ON, PATCHES, POP, PRODUCTS, SERUM, SOOTHE, SPOT, SUNSCREEN, TONER, WAKE, skinCheckIn } from '../../actions/skincare'
import { runStep, type Product, type StepDef } from '../../actions/steps'
import { url, wearables, type CharacterCatalog, type Wearable } from '../../character/catalog'
import { pickSpot } from '../spotPick'
import { tattooPreview } from '../../character/tattoos'
import { PALETTES } from '../../editors/palettes'
import type { RoomId } from '../../rooms'
import { useStudio, type Category } from '../../state/store'
import { Art, type ArtKind } from '../art'
import type { Sfx } from '../sound'

/**
 * Everything a medium icon tile can be. The icon says what it is; tapping runs it (one animated
 * step, played once). Tiles that can't run right now stay visible, dimmed, and say why when tapped.
 */
export interface Tile {
  id: string
  label: string
  art: ReactNode
  run: () => unknown
  /** Applied / worn right now. */
  on?: boolean
  /** Small corner note: a count, a percentage. */
  badge?: string
  /** Why it can't run (dimmed; tapping shows this). */
  blocked?: string | null
  /** A colour dropdown next to the icon (hairstyles). */
  palette?: { label: string; colors: { color: string; name: string }[]; value: string | null; onPick: (c: string) => void }
  /** Colourways and per-slot colours for a recolourable piece (primary, secondary, accent). */
  colours?: { label: string; ways: { name: string; colors: [string, string, string] }[]; value: [string, string, string] | null; slots: 1 | 3; onPick: (c: [string, string, string]) => void }
  sfx?: Sfx
  /** A heading the tile sits under (piercings: Ears, Nose, Lips, Brow, Navel). */
  section?: string
}

export const CATEGORY_NAMES: Record<Category, string> = {
  wake: 'Wake up',
  cleanse: 'Cleanse',
  treat: 'Treat',
  tone: 'Tone & serum',
  moisturise: 'Moisturise & protect',
  base: 'Base',
  sculpt: 'Sculpt',
  eyes: 'Eyes',
  browsLashes: 'Brows & lashes',
  lips: 'Lips',
  looks: 'Full looks',
  nails: 'Nails',
  jewellery: 'Jewellery counter',
  hairstyles: 'Hairstyles',
  haircolour: 'Hair colour',
  haircare: 'Haircare',
  tops: 'Tops',
  bottoms: 'Bottoms',
  dresses: 'Dresses & sets',
  shoes: 'Shoes',
  accessories: 'Accessories',
  tattoos: 'Tattoo studio',
  piercings: 'Piercing counter',
  clinicFace: 'Face',
  clinicBody: 'Body',
}

const P = (id: string, name: string, color: string): Product => ({ id, name, blurb: '', color })
const play = (step: StepDef, product: Product, target: string | null = null, option: string | null = null, extra?: Record<string, string | number>) => () => runStep(step, { product, target, option, extra })
const blockedOf = (step: StepDef, look: StudioLook, targets?: { id: string }[] | null) => step.blocked?.(look) ?? (targets && !targets.length ? 'Nothing to do here right now.' : null)

function stepTile(id: string, label: string, art: ReactNode, step: StepDef, look: StudioLook, product: Product, opts: { option?: string; extra?: Record<string, string | number>; badge?: string; on?: boolean; sfx?: Sfx } = {}): Tile {
  const targets = step.targets?.(look) ?? null
  return {
    id,
    label,
    art,
    run: play(step, product, targets?.[0]?.id ?? null, opts.option ?? step.options?.list[0]?.id ?? null, opts.extra),
    blocked: blockedOf(step, look, targets),
    badge: opts.badge ?? (targets && targets.length > 1 ? `×${targets.length}` : undefined),
    on: opts.on,
    sfx: opts.sfx,
  }
}

/* ------------------------------------------------------------------ Skincare Bay */

function skincareTiles(cat: Category, look: StudioLook): Tile[] {
  const skin = look.skin.tone
  const c = look.care
  const done = (s: string) => c.done.includes(s as never)
  switch (cat) {
    case 'wake':
      return [
        {
          id: 'wake',
          label: 'Wake up',
          art: <Art kind="wake" />,
          run: async () => {
            const s = useStudio.getState()
            s.apply((l) => {
              skinCheckIn(l, Date.now())
              l.care.morning = true
              l.makeup = structuredClone(l.makeup)
              l.hair.care.bonnet = true
              // she slept in her overnight things: a patch on a pimple and hydrogel eye patches
              const pimple = (Object.entries(l.care.spots) as [SpotId, string][]).find(([, st]) => st === 'pimple')
              if (pimple) l.care.patches = [pimple[0]]
              else {
                l.care.spots.cheekL = 'pimple'
                l.care.patches = ['cheekL']
              }
              l.care.eyePatches = true
            })
            s.markBefore()
            await runStep(WAKE, { product: WAKE.products[0], target: null, option: null })
          },
        },
        stepTile('bonnetOff', 'Bonnet off', <Art kind="bonnetOff" />, BONNET_OFF, look, BONNET_OFF.products[0], { sfx: 'whoosh' }),
        stepTile('patchOff', 'Pull pimple patch', <Art kind="patchOff" skin={skin} />, PATCHES, look, PRODUCTS.fingers[0], { badge: c.patches.length ? `×${c.patches.length}` : undefined, sfx: 'peel' }),
        stepTile('eyePatches', 'Eye patches off', <Art kind="patch" skin={skin} color="#F5B3C3" />, EYE_PATCHES, look, PRODUCTS.fingers[0], { sfx: 'peel' }),
        stepTile('wash', 'Wash face (foamy)', <Art kind="wash" skin={skin} />, FACE_WASH, look, PRODUCTS.cleanser[0], { on: done('wash'), sfx: 'bubbles' }),
      ]
    case 'cleanse':
      return [
        stepTile('wash', 'Wash face (foamy)', <Art kind="wash" skin={skin} />, FACE_WASH, look, PRODUCTS.cleanser[0], { on: done('wash'), sfx: 'bubbles' }),
        stepTile('foam', 'Foam cleanser', <Art kind="foamCleanser" color="#9FD8C4" color2="#2B6B5A" />, CLEANSE, look, PRODUCTS.cleanser[0], { option: 'cloth', sfx: 'squish' }),
        stepTile('balm', 'Melt balm', <Art kind="balmCleanser" color="#F4D9A8" color2="#C9A06A" />, CLEANSE, look, PRODUCTS.cleanser[1], { option: 'cloth', sfx: 'squish' }),
        stepTile('micellar', 'Micellar + pad', <Art kind="micellar" color="#D8E8F6" color2="#7FA8C8" />, CLEANSE, look, PRODUCTS.cleanser[2], { sfx: 'swipe' }),
      ]
    case 'treat': {
      const count = (states: string[]) => Object.values(c.spots).filter((s) => states.includes(s as string)).length
      const pimples = count(['pimple'])
      return [
        {
          // tap the pimple first: the face zooms in with a ring on each one; the squeeze starts on
          // the one she taps
          ...stepTile('pop', 'Pop a pimple', <Art kind="pop" skin={skin} />, POP, look, PRODUCTS.fingers[0], { option: 'squeeze', badge: pimples ? `×${pimples}` : undefined, sfx: 'squelch' }),
          run: async () => {
            const ids = (POP.targets?.(look) ?? []).map((t) => t.id as SpotId)
            if (!ids.length) return
            const id = await pickSpot(ids, 'Tap a pimple to squeeze it')
            if (id) await runStep(POP, { product: PRODUCTS.fingers[0], target: id, option: 'squeeze' })
          },
        },
        stepTile('patchOn', 'Pimple patch', <Art kind="patch" skin={skin} />, PATCH_ON, look, PRODUCTS.fingers[0], { sfx: 'dab' }),
        stepTile('spot', 'Spot gel', <Art kind="spotGel" skin={skin} color="#CFE8D0" color2="#5FAE6A" />, SPOT, look, PRODUCTS.spot[0], { sfx: 'dab' }),
        stepTile('compress', 'Warm compress', <Art kind="compress" color="#F4C3A1" />, COMPRESS, look, PRODUCTS.compress[0], { badge: count(['boil']) ? `×${count(['boil'])}` : undefined, sfx: 'pat' }),
        stepTile('soothe', 'Aloe calm gel', <Art kind="soothe" />, SOOTHE, look, PRODUCTS.soothe[0], { badge: c.rash > 0.05 ? 'rash' : undefined, sfx: 'pat' }),
        stepTile('brighten', 'Vitamin C serum', <Art kind="brighten" color="#F2A33A" color2="#7A4A10" />, BRIGHTEN, look, PRODUCTS.brighten[0], { badge: c.pigment > 0.05 ? 'marks' : undefined, sfx: 'drip' }),
        stepTile('scrub', 'Sugar scrub', <Art kind="scrub" color="#C99A6A" color2="#7A5A3A" />, EXFOLIATE, look, PRODUCTS.scrub[0], { badge: c.dry > 0.05 ? 'flakes' : undefined, sfx: 'brush' }),
        stepTile('eyeCream', 'Eye cream', <Art kind="eyeCream" skin={skin} color="#F4EDE6" />, EYE_CREAM, look, PRODUCTS.eyeCream[0], { sfx: 'pat' }),
      ]
    }
    case 'tone':
      return [
        ...PRODUCTS.toner.map((p) => stepTile(`toner:${p.id}`, p.name.replace(' Toner', ''), <Art kind="toner" color={p.color} color2="#8A6A7A" />, TONER, look, p, { on: done('toner'), sfx: 'swipe' })),
        ...PRODUCTS.serum.map((p) => stepTile(`serum:${p.id}`, p.name, <Art kind="serum" color={p.color} color2="#4A3A4A" />, SERUM, look, p, { sfx: 'drip' })),
      ]
    case 'moisturise':
      return [
        ...PRODUCTS.moisturiser.map((p) => stepTile(`moist:${p.id}`, p.name, <Art kind="moisturiser" color={p.color} color2="#C9B4A0" />, MOISTURISER, look, p, { sfx: 'dab' })),
        ...PRODUCTS.sunscreen.map((p) => stepTile(`spf:${p.id}`, p.name, <Art kind="sunscreen" color={p.color} color2="#E07B00" />, SUNSCREEN, look, p, { on: c.spf, sfx: 'dab' })),
        ...PRODUCTS.balm.map((p) => stepTile(`balm:${p.id}`, p.name, <Art kind="lipBalm" color={p.color} />, LIP_BALM, look, p, { sfx: 'swipe' })),
      ]
    default:
      return []
  }
}

/* ------------------------------------------------------------------ Makeup Studio */

const lift = (tone: string, t: number) => mixHex(tone, '#FFE2C4', t)

const MAKEUP_ART: Record<MakeupKey, ArtKind> = {
  primer: 'primer',
  corrector: 'corrector',
  foundation: 'foundation',
  concealer: 'concealer',
  powder: 'powder',
  contour: 'contour',
  bronzer: 'bronzer',
  blush: 'blush',
  highlight: 'highlight',
  setting: 'setting',
  eyeshadow: 'eyeshadow',
  innerCorner: 'innerCorner',
  liner: 'liner',
  lowerLiner: 'lowerLiner',
  mascara: 'mascara',
  lipLiner: 'lipLiner',
  lipstick: 'lipstick',
  lipCentre: 'lipCentre',
  gloss: 'gloss',
}

function makeupTile(look: StudioLook, key: MakeupKey, label: string, color: string, extra: Record<string, string | number> = {}, art?: ReactNode): Tile {
  const cur = look.makeup[key as keyof StudioLook['makeup']]
  const on = typeof cur === 'number' ? cur > 0.01 : typeof cur === 'object' && cur !== null && 'color' in cur ? cur.amount > 0.01 && cur.color.toUpperCase() === color.toUpperCase() : false
  return {
    id: `${key}:${color}`,
    label,
    art: art ?? <Art kind={MAKEUP_ART[key]} color={color} color2={key === 'eyeshadow' ? mixHex(color, '#000000', 0.35) : '#26232A'} skin={look.skin.tone} />,
    run: () => runStep(makeupStep(key), { product: shadeProduct(color, label), target: null, option: null, extra: { amount: 0.75, ...extra } }),
    on,
    sfx: key === 'setting' ? 'spray' : key === 'lipstick' || key === 'liner' || key === 'lipLiner' ? 'swipe' : key === 'foundation' || key === 'concealer' ? 'dab' : 'brush',
  }
}

const BLUSH = [
  ['Rose', '#B0505A'],
  ['Peach', '#D07A6A'],
  ['Berry', '#8E2E5A'],
  ['Coral', '#C24E2E'],
  ['Brick', '#9E4A44'],
] as const
const SHADOW = [
  ['Bronze', '#B8862F'],
  ['Cocoa', '#5A3A2A'],
  ['Plum', '#6A2E6A'],
  ['Cobalt', '#1F3FB0'],
  ['Emerald', '#1E5A4A'],
  ['Rose gold', '#D4A0A0'],
  ['Smoky', '#1A1A1A'],
  ['Champagne', '#E8D8C8'],
] as const
const LIPS = [
  ['Nude', '#9A5A48'],
  ['Brown nude', '#7A3A34'],
  ['Classic red', '#C0283A'],
  ['Berry', '#6A1E3E'],
  ['Wine', '#3A0E1E'],
  ['Orange red', '#D2452F'],
  ['Pink', '#C24E7A'],
  ['Mauve', '#B07060'],
  ['Espresso', '#3A2420'],
] as const

function makeupTiles(cat: Category, look: StudioLook): Tile[] {
  const tone = look.skin.tone
  switch (cat) {
    case 'base':
      return [
        makeupTile(look, 'primer', 'Primer', '#F4E6DE'),
        makeupTile(look, 'corrector', 'Peach corrector', '#E59A6A', {}, <Art kind="corrector" color="#E59A6A" color2="#B7D6A0" />),
        makeupTile(look, 'foundation', 'Foundation', tone, { finish: look.makeup.foundationFinish }),
        makeupTile(look, 'concealer', 'Concealer', lift(tone, 0.14)),
        makeupTile(look, 'powder', 'Setting powder', lift(tone, 0.06)),
        makeupTile(look, 'setting', 'Setting spray', '#BFE6FF'),
        { id: 'removeAll', label: 'Take it all off', art: <Art kind="remove" />, run: play(REMOVE_ALL, shadeProduct('#ffffff')), sfx: 'swipe' },
      ]
    case 'sculpt':
      return [
        makeupTile(look, 'contour', 'Contour', '#3E2418'),
        makeupTile(look, 'contour', 'Soft contour', '#6E4632'),
        makeupTile(look, 'bronzer', 'Bronzer', '#8A4A2A'),
        ...BLUSH.map(([n, c]) => makeupTile(look, 'blush', `${n} blush`, c)),
        makeupTile(look, 'highlight', 'Gold highlight', '#F0CF95'),
        makeupTile(look, 'highlight', 'Pearl highlight', '#F4E4CC'),
        makeupTile(look, 'highlight', 'Bronze glow', '#D9A066'),
      ]
    case 'eyes':
      return [
        ...SHADOW.map(([n, c]) => makeupTile(look, 'eyeshadow', n, c, { shimmer: n === 'Rose gold' || n === 'Champagne' || n === 'Bronze' ? 0.7 : 0.2 })),
        makeupTile(look, 'innerCorner', 'Inner glow', '#F6E2B0', {}, <Art kind="innerCorner" color="#F6E2B0" color2="#E8D8C8" />),
        makeupTile(look, 'liner', 'Black liner', '#050505'),
        makeupTile(look, 'liner', 'Brown liner', '#4A2D20'),
        makeupTile(look, 'lowerLiner', 'Kohl', '#0C0808'),
        makeupTile(look, 'mascara', 'Mascara', '#000000'),
      ]
    case 'browsLashes':
      return [
        ...(['#0C0808', '#3A2418', '#7A5A3A'] as const).map((c, i) => ({
          id: `brow:${c}`,
          label: ['Black brows', 'Brown brows', 'Soft brows'][i],
          art: <Art kind="browPencil" color={c} />,
          run: play(BROW_STEP, shadeProduct(c), null, null, { style: 'pencil' }),
          on: look.brows.color === c,
          sfx: 'brush' as const,
        })),
        ...(['eyebrow001', 'eyebrow006', 'eyebrow010', 'eyebrow003', 'eyebrow008'] as const).map((b, i) => ({
          id: `browShape:${b}`,
          label: ['Soft arch', 'Straight', 'Full natural', 'Bold', 'Thin'][i],
          art: <Art kind="browShape" color={look.brows.color} />,
          run: () => runStep(wearStep(['Soft arch', 'Straight', 'Full natural', 'Bold', 'Thin'][i] + ' brows', (l) => void (l.brows.shape = b), 'eyes'), { product: shadeProduct('#fff'), target: null, option: null }),
          on: look.brows.shape === b,
        })),
        ...(['eyelashes01', 'eyelashes02', 'eyelashes03'] as const).map((s, i) => ({
          id: `lash:${s}`,
          label: ['Natural lashes', 'Wispy lashes', 'Volume lashes'][i],
          art: <Art kind="lashes" />,
          run: () => runStep(wearStep(['Natural lashes', 'Wispy lashes', 'Volume lashes'][i], (l) => void (l.lashes.style = s), 'eyes'), { product: shadeProduct('#fff'), target: null, option: null }),
          on: look.lashes.style === s,
        })),
      ]
    case 'lips':
      return [
        makeupTile(look, 'lipLiner', 'Lip liner', '#4A2220'),
        makeupTile(look, 'lipLiner', 'Berry liner', '#5A1E26'),
        ...LIPS.map(([n, c]) => makeupTile(look, 'lipstick', n, c, { finish: 'satin' })),
        makeupTile(look, 'lipCentre', 'Ombre centre', '#C24E7A', {}, <Art kind="lipCentre" color="#C24E7A" color2="#7A3A34" />),
        makeupTile(look, 'gloss', 'Gloss', '#F0B8C8'),
      ]
    case 'looks':
      return MAKEUP_PRESETS.filter((p) => p.id !== 'bare' && p.id !== 'no-makeup').map((p) => {
        const m = p.build(tone)
        return {
          id: `look:${p.id}`,
          label: p.name,
          art: <Art kind="look" skin={tone} color={m.lipstick.amount > 0.05 ? m.lipstick.color : m.blush.color} color2={m.eyeshadow.amount > 0.05 ? m.eyeshadow.color : '#2A1A14'} />,
          run: async () => {
            const has = (['foundation', 'blush', 'eyeshadow', 'liner', 'lipstick'] as MakeupKey[]).some((k) => amountOf(useStudio.getState().look.makeup, k) > 0.02)
            if (has && (await runStep(REMOVE_ALL, { product: shadeProduct('#ffffff'), target: null, option: null })) === 'cancelled') return
            await runStep(lookStep(p.id), { product: shadeProduct('#ffffff'), target: null, option: null })
          },
          sfx: 'brush' as const,
        }
      })
    case 'nails':
      return [
        ...PALETTES.nails.map((c) => ({
          id: `nails:${c}`,
          label: 'Polish',
          art: <Art kind="polish" color={c} />,
          run: play(MANICURE, P('set', 'Manicure', c), null, null, { nails: JSON.stringify({ ...look.nails, color: c, amount: 1, shape: look.nails.shape === 'natural' ? 'almond' : look.nails.shape, length: Math.max(look.nails.length, 0.3) }) }),
          on: look.nails.amount > 0.5 && look.nails.color.toUpperCase() === c.toUpperCase(),
          sfx: 'brush' as const,
        })),
        {
          id: 'nails:off',
          label: 'Polish off',
          art: <Art kind="remove" />,
          run: () => {
            useStudio.getState().apply((l) => void (l.nails = { ...l.nails, amount: 0, art: 'none', gems: false, length: 0, shape: 'natural' }))
          },
          blocked: look.nails.amount < 0.01 && look.nails.length < 0.01 ? 'No polish on right now.' : null,
        },
      ]
    default:
      return []
  }
}

/* ------------------------------------------------------------------ Hair Studio */

function HairThumb({ id }: { id: string }) {
  return (
    <span className="relative block h-full w-full overflow-hidden rounded-[14px] bg-white/10">
      <img src={url.hairThumb(id)} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = 'none')} />
    </span>
  )
}

function hairTiles(cat: Category, look: StudioLook, catalog: CharacterCatalog): Tile[] {
  switch (cat) {
    case 'hairstyles': {
      const tiles: Tile[] = catalog.hair
        .filter((h) => h.id !== 'bonnet')
        .map((h) => ({
          id: `style:${h.id}`,
          label: h.name,
          art: <HairThumb id={h.id} />,
          on: look.hair.style === h.id,
          run: () => runStep(hairStyleStep(h.id as HairId, h.name), { product: shadeProduct(look.hair.color), target: null, option: null }),
          sfx: 'whoosh' as const,
        }))
      tiles.push({
        id: 'style:none',
        label: 'Close crop',
        art: <Art kind="hairline" skin={look.skin.tone} />,
        on: look.hair.style === 'none',
        run: () => runStep(hairStyleStep('none', 'Close crop'), { product: shadeProduct(look.hair.color), target: null, option: null }),
      })
      return tiles
    }
    case 'haircolour':
      return [
        ...HAIR_COLOR_PRESETS.map((p) => ({
          id: `dye:${p.id}`,
          label: p.name,
          art: <Art kind="dye" color={p.color} />,
          on: look.hair.color.toUpperCase() === p.color.toUpperCase() && look.hair.blend === 0,
          run: () => runStep(hairColourStep(p.name, p.color, undefined, p.shine), { product: shadeProduct(p.color), target: null, option: null }),
          blocked: look.hair.style === 'none' ? 'Pick a hairstyle first.' : null,
          sfx: 'brush' as const,
        })),
        ...[
          ['Honey tips', '#2A1A12', '#B9854A'],
          ['Pink tips', '#141010', '#E07AA6'],
          ['Teal tips', '#141010', '#1E7A7A'],
          ['Platinum ends', '#3A2418', '#E6DCC8'],
          ['Copper ombre', '#2A1A12', '#C24E2A'],
        ].map(([n, base, tip]) => ({
          id: `ombre:${n}`,
          label: n,
          art: <Art kind="ombre" color={base} color2={tip} />,
          run: () => runStep(hairColourStep(n, base, tip), { product: shadeProduct(base), target: null, option: null }),
          blocked: look.hair.style === 'none' ? 'Pick a hairstyle first.' : null,
          sfx: 'brush' as const,
        })),
      ]
    case 'haircare': {
      const kind = hairKind(look.hair.style)
      const change = look.hair.care.change
      const tiles: Tile[] = [
        stepTile('brush', 'Brush & shape', <Art kind="hairBrush" color="#C9A7D8" />, BRUSH, look, HAIR_PRODUCTS.tools[kind][0], { sfx: 'brush' }),
        stepTile('wash', 'Wash', <Art kind="hairWash" />, WASH, look, HAIR_PRODUCTS.shampoo[0], { sfx: 'splash' }),
        stepTile('dry', 'Blow-dry', <Art kind="hairDry" color="#E07AA6" />, DRY, look, P('dryer', 'Dryer', '#E07AA6'), { sfx: 'whoosh' }),
      ]
      if (TAKEDOWN_TO[look.hair.style] || change?.kind === 'takedown') tiles.push(stepTile('takedown', 'Take down', <Art kind="takedown" color={look.hair.color} />, TAKEDOWN, look, P('fingers', 'Fingers', '#E8C4B8'), { sfx: 'snip' }))
      if (RETWIST_TO[look.hair.style] || change?.kind === 'retwist' || LOCS.includes(look.hair.style)) tiles.push(stepTile('retwist', 'Retwist', <Art kind="retwist" color={look.hair.color} />, RETWIST, look, HAIR_PRODUCTS.gel[0], { sfx: 'swipe' }))
      tiles.push(look.hair.care.bonnet ? stepTile('bonnetOff', 'Bonnet off', <Art kind="bonnetOff" />, BONNET_OFF, look, BONNET_OFF.products[0]) : stepTile('bonnetOn', 'Bonnet on', <Art kind="bonnet" color="#C9A7D8" />, BONNET_ON, look, P('satin', 'Satin bonnet', '#C9A7D8')))
      return tiles
    }
    default:
      return []
  }
}

/* ------------------------------------------------------------------ stores */

function GarmentThumb({ src, fallback }: { src: string; fallback: ReactNode }) {
  return (
    <span className="relative block h-full w-full overflow-hidden rounded-[14px] bg-white/10">
      <span className="absolute inset-0 grid place-items-center p-3 opacity-80">{fallback}</span>
      <img src={src} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = 'none')} />
    </span>
  )
}

/** Colourways every recolourable piece offers (primary, secondary, accent). */
export const COLOURWAYS: { name: string; colors: [string, string, string] }[] = [
  { name: 'Red & yellow', colors: ['#C8102E', '#FFC72C', '#2A1200'] },
  { name: 'Green & yellow', colors: ['#1E7A3A', '#FFC72C', '#0E2A16'] },
  { name: 'Blue & orange', colors: ['#1F4FA8', '#F28C28', '#0E1A33'] },
  { name: 'Pink & purple', colors: ['#E07AA6', '#6A3FB0', '#2A1030'] },
  { name: 'Red & green', colors: ['#C8102E', '#1E7A3A', '#F4EFE6'] },
  { name: 'Black & gold', colors: ['#111111', '#D9B35B', '#FFFFFF'] },
  { name: 'Cream & black', colors: ['#F4EFE6', '#141414', '#C9A04A'] },
  { name: 'Lilac & white', colors: ['#B9A2D8', '#FFFFFF', '#6A3FB0'] },
]
/** One-colour tints for the classic sets. */
const TINTS: { name: string; colors: [string, string, string] }[] = [
  { name: 'As made', colors: ['#FFFFFF', '#FFFFFF', '#FFFFFF'] },
  ...['#C8102E', '#1E7A3A', '#1F4FA8', '#E07AA6', '#111111', '#D9B35B', '#6A3FB0'].map((c) => ({ name: c, colors: [c, c, c] as [string, string, string] })),
]

const CAT_SLOT: Partial<Record<Category, PieceSlot>> = { tops: 'top', bottoms: 'bottom', dresses: 'dress', shoes: 'shoes' }

function PieceThumb({ item }: { item: Wearable }) {
  const src = item.slots === 3 ? url.pieceThumb(item.id) : item.slot === 'shoes' ? url.shoeThumb(item.id) : url.outfitThumb(item.id)
  return <GarmentThumb src={src} fallback={<Art kind="none" />} />
}

/** Put a piece on (a dress replaces the top and bottom; a top or bottom takes the dress off). Heels with skirts and dresses. */
export function wearPiece(l: StudioLook, item: Wearable, colors: [string, string, string], items: Map<string, Wearable>) {
  const slot = item.slot
  l.wear[slot] = { id: item.id, colors }
  if (slot === 'dress') l.wear.top = l.wear.bottom = null
  if (slot === 'top' || slot === 'bottom') {
    if (l.wear.dress) {
      l.wear.dress = null
      // never half-dressed: the other half comes back as a basic
      if (!l.wear.top) l.wear.top = { id: 'top_tank', colors: ['#F4EFE6', '#2A2A2A', '#2A2A2A'] }
      if (!l.wear.bottom) l.wear.bottom = { id: 'bottom_skinny_jeans', colors: ['#2E3D5C', '#D8A04A', '#B8B8B8'] }
    }
  }
  if (needsHeels(l.wear) && !HEELS.includes(l.wear.shoes?.id ?? '')) {
    // the store's own heels if it sells any, in the outfit's main colour
    const heel = [...items.values()].find((w) => w.slot === 'shoes' && HEELS.includes(w.id) && w.store === item.store) ?? items.get('shoes_pumps')
    if (heel) {
      l.wear.shoes = { id: heel.id, colors: heel.colors }
    }
  }
}

/**
 * What each store also stocks from the shared wardrobe (every piece is one reusable, recolourable
 * asset), chosen to suit its vibe, so every department has at least four options. Its own pieces
 * come first. (Dresses include the classic full outfits.)
 */
const ALSO_STOCKS: Partial<Record<RoomId, Partial<Record<PieceSlot, string[]>>>> = {
  tolaptsd: { top: ['top_flame_tee'], bottom: ['bottom_skinny_jeans', 'bottom_cargo', 'bottom_leggings'], dress: ['dress_lace_bodysuit', 'dress_velvet_mini'], shoes: ['shoes_platforms', 'shoes04', 'shoes06'] },
  thai: { top: ['top_cami'], bottom: ['bottom_flare_pants'], dress: ['dress_slip', 'dress_maxi', 'dress_sequin_mini', 'female_casualsuit02'], shoes: ['shoes_mules', 'shoes_block_heels', 'shoes05'] },
  moncherie: { top: ['top_lace_bralette', 'top_square_crop'], bottom: ['bottom_pencil_skirt', 'bottom_midi_skirt', 'bottom_flare_pants'], dress: ['dress_sequin_mini'], shoes: ['shoes_strappy', 'shoes_ankle_strap'] },
  novasport: { top: ['top_tank', 'top_everyday_tee'], bottom: ['bottom_cargo', 'bottom_baggy_jeans'], dress: ['dress_lace_bodysuit', 'male_casualsuit01'] },
  dopebyfabby: { top: ['top_corset', 'top_square_crop'], bottom: ['bottom_satin_mini'], dress: ['dress_slip', 'dress_maxi'], shoes: ['shoes_pumps', 'shoes_strappy'] },
  dejideji: { top: ['top_bandeau', 'top_cami'], bottom: ['bottom_midi_skirt', 'bottom_wide_trousers'], dress: ['dress_maxi', 'dress_slip', 'female_elegantsuit01'], shoes: ['shoes_block_heels', 'shoes_mules', 'shoes_kitten'] },
  okrika: { top: ['top_oversized_tee', 'top_crop_tee'], bottom: ['bottom_ripped_jeans'] },
  booty: { top: ['top_corset', 'top_cami'], bottom: ['bottom_satin_mini', 'bottom_pleated_mini'], dress: ['dress_slip', 'dress_sequin_mini', 'dress_velvet_mini'], shoes: ['shoes_pumps', 'shoes_platforms', 'shoes_ankle_strap'] },
}

/** A store's department: its own pieces, then what it also stocks. */
export function storeStock(items: Map<string, Wearable>, room: RoomId, slot: PieceSlot): Wearable[] {
  const list = [...items.values()].filter((w) => w.slot === slot && w.store === room)
  for (const id of ALSO_STOCKS[room]?.[slot] ?? []) {
    const w = items.get(id)
    if (w && w.slot === slot && !list.includes(w)) list.push(w)
  }
  return list
}

function storeTiles(cat: Category, room: RoomId, look: StudioLook, catalog: CharacterCatalog): Tile[] {
  const items = wearables(catalog)
  const slot = CAT_SLOT[cat]
  if (slot) {
    const list = storeStock(items, room, slot)
    // the trainers and sneakers live at Nova Sport and the thrift store
    if (slot === 'shoes' && (room === 'novasport' || room === 'okrika')) for (const w of items.values()) if (w.slot === 'shoes' && w.slots === 1 && !list.includes(w)) list.push(w)
    return list.map((w) => {
      const worn = look.wear[slot]?.id === w.id ? look.wear[slot]! : null
      const flat = slot === 'shoes' && !HEELS.includes(w.id) && needsHeels(look.wear)
      const ways = w.slots === 3 ? [{ name: 'Original', colors: w.colors }, ...COLOURWAYS] : TINTS
      const put = (colors: [string, string, string]) => runStep(dressStep(w.name, (l) => wearPiece(l, w, colors, items)), { product: shadeProduct(colors[0]), target: null, option: null })
      return {
        id: `wear:${w.id}`,
        label: w.name,
        art: <PieceThumb item={w} />,
        on: !!worn,
        blocked: flat ? 'Dresses and skirts are worn with heels here. Pick a heel.' : null,
        run: () => put(worn?.colors ?? w.colors),
        colours: { label: `${w.name} colours`, ways, value: worn?.colors ?? null, slots: w.slots, onPick: (c) => void put(c) },
        sfx: 'zip' as const,
      }
    })
  }
  if (cat === 'accessories') return accessoryTiles(room, look)
  return []
}

/* ------------------------------------------------------------------ accessories */

type ExtraDef = { id: string; label: string; art: ArtKind; color?: string; on: (e: Extras, j: Jewellery) => boolean; set: (l: StudioLook, on: boolean) => void; framing?: StepDef['framing'] }
const EXTRAS: Record<string, ExtraDef> = {
  coralBand: { id: 'coralBand', label: 'Coral headband', art: 'beads', color: '#D9452B', on: (e) => e.head === 'coralBand', set: (l, on) => void (l.extras.head = on ? 'coralBand' : 'none'), framing: 'hair' },
  satinBand: { id: 'satinBand', label: 'Satin headband', art: 'band', on: (e) => e.head === 'satinBand', set: (l, on) => void (l.extras.head = on ? 'satinBand' : 'none'), framing: 'hair' },
  headscarf: { id: 'headscarf', label: 'Head wrap', art: 'band', on: (e) => e.head === 'headscarf', set: (l, on) => void (l.extras.head = on ? 'headscarf' : 'none'), framing: 'hair' },
  coralBeads: { id: 'coralBeads', label: 'Coral necklaces', art: 'beads', color: '#D9452B', on: (e) => e.coralBeads, set: (l, on) => void (l.extras.coralBeads = on), framing: 'bust' },
  coralWrists: { id: 'coralWrists', label: 'Coral bracelets', art: 'beads', color: '#D9452B', on: (e) => e.coralWrists, set: (l, on) => void (l.extras.coralWrists = on), framing: 'hands' },
  anklets: { id: 'anklets', label: 'Coral anklets', art: 'beads', color: '#D9452B', on: (e) => e.anklets, set: (l, on) => void (l.extras.anklets = on), framing: 'full' },
  waistBeads: { id: 'waistBeads', label: 'Waist beads', art: 'beads', color: '#E4572E', on: (e) => e.waistBeads, set: (l, on) => void (l.extras.waistBeads = on), framing: 'full' },
  whip: { id: 'whip', label: 'Horsehair whisk', art: 'whisk', on: (e) => e.held === 'whip', set: (l, on) => void (l.extras.held = on ? 'whip' : 'none'), framing: 'full' },
  fan: { id: 'fan', label: 'Hand fan', art: 'fan', color: '#E4572E', on: (e) => e.held === 'fan', set: (l, on) => void (l.extras.held = on ? 'fan' : 'none'), framing: 'full' },
  clutch: { id: 'clutch', label: 'Clutch bag', art: 'clutch', on: (e) => e.held === 'clutch', set: (l, on) => void (l.extras.held = on ? 'clutch' : 'none'), framing: 'full' },
  joint: { id: 'joint', label: 'Lit joint', art: 'joint', on: (e) => e.held === 'joint', set: (l, on) => void (l.extras.held = on ? 'joint' : 'none'), framing: 'full' },
  chains: { id: 'chains', label: 'Layered chains', art: 'necklace', color: '#D4A64A', on: (e) => e.chains, set: (l, on) => void (l.extras.chains = on), framing: 'bust' },
  choker: { id: 'choker', label: 'Choker', art: 'necklace', color: '#141014', on: (_e, j) => j.necklace === 'choker', set: (l, on) => void (l.jewellery.necklace = on ? 'choker' : 'none'), framing: 'bust' },
  pins: { id: 'pins', label: 'Rainbow pins', art: 'pins', on: (e) => e.pins, set: (l, on) => void (l.extras.pins = on), framing: 'bust' },
  glassesChain: { id: 'glassesChain', label: 'Glasses chain', art: 'glasses', color: '#D4A64A', on: (e) => e.glassesChain, set: (l, on) => {
    l.extras.glassesChain = on
    if (on && l.jewellery.glasses === 'none') Object.assign(l.jewellery, { glasses: 'square', frame: '#E0457B' })
  }, framing: 'face' },
}
const STORE_EXTRAS: Partial<Record<RoomId, string[]>> = {
  dejideji: ['coralBand', 'coralBeads', 'coralWrists', 'anklets', 'waistBeads', 'whip', 'fan', 'headscarf'],
  tolaptsd: ['chains', 'choker', 'joint'],
  moncherie: ['satinBand', 'clutch', 'choker'],
  dopebyfabby: ['chains', 'clutch', 'satinBand'],
  okrika: ['glassesChain', 'pins', 'fan', 'headscarf'],
  booty: ['pins', 'choker', 'waistBeads', 'glassesChain'],
}

function accessoryTiles(room: RoomId, look: StudioLook): Tile[] {
  return (STORE_EXTRAS[room] ?? []).map((k) => {
    const x = EXTRAS[k]
    const on = x.on(look.extras, look.jewellery)
    return {
      id: `extra:${x.id}`,
      label: on ? `${x.label} (off)` : x.label,
      art: <Art kind={x.art} color={x.color ?? look.extras.color} />,
      on,
      run: () => runStep(wearStep(x.label, (l) => x.set(l, !on), x.framing ?? 'full'), { product: shadeProduct('#fff'), target: null, option: null }),
      sfx: 'sparkle' as const,
    }
  })
}

/* ------------------------------------------------------------------ Beauty Doctor */

const CLINIC_ART: Record<ClinicId, ArtKind> = {
  lipFiller: 'syringe',
  noseRefine: 'nose',
  noseLift: 'nose',
  cheekFiller: 'syringe',
  jawContour: 'chisel',
  chinFiller: 'syringe',
  underEye: 'syringe',
  bbl: 'body',
  lipo: 'body',
  breastAug: 'body',
  ribRemoval: 'body',
  glowDrip: 'drip',
}

function unsupported(p: (typeof PROCEDURES)[number], catalog: CharacterCatalog): string | null {
  if (!p.morphs) return null
  for (const [m, d] of Object.entries(p.morphs) as [MorphId, number][]) {
    const entry = catalog.morphs.find((x) => x.id === m)
    if (!entry || (d > 0 && !entry.pos) || (d < 0 && !entry.neg)) return `This doll's model has no ${m} shape yet.`
  }
  return null
}

/** Where each design goes first (then the next free spot). */
const TATTOO_HOME: Record<TattooDesign, TattooSpot[]> = {
  rose: ['forearmL', 'neckSideR', 'upperArmR'],
  butterfly: ['ankleL', 'neckSideL', 'wristR'],
  heart: ['faceR', 'wristR', 'ankleR'],
  star: ['faceL', 'wristL', 'ankleR'],
  moon: ['nape', 'wristR', 'faceR'],
  snake: ['forearmR', 'neckSideL', 'upperArmL'],
  script: ['wristR', 'neckSideR', 'forearmL'],
  vine: ['ankleL', 'forearmR', 'neckSideL'],
  dagger: ['forearmL', 'neckSideR', 'upperArmR'],
  sun: ['upperArmL', 'nape', 'ankleR'],
  swallow: ['neckSideL', 'upperArmR', 'wristL'],
  band: ['upperArmR', 'upperArmL', 'ankleL'],
}
const SPOT_NAME = (s: TattooSpot) =>
  s
    .replace(/([A-Z])/g, ' $1')
    .replace(/ L$/, ' (left)')
    .replace(/ R$/, ' (right)')
    .replace(/^./, (c) => c.toUpperCase())

function PreviewArt({ design, ink }: { design: TattooDesign; ink: string }) {
  return (
    <span className="grid h-full w-full place-items-center rounded-[14px] bg-[#f4e6dc]">
      <img src={tattooPreview(design, ink, 96)} alt="" className="h-[80%] w-[80%] object-contain" />
    </span>
  )
}

function doctorTiles(cat: Category, look: StudioLook): Tile[] {
  const j = look.jewellery
  const metal = { gold: '#D4A64A', silver: '#C8CBD2', rose: '#D9A0A0' }[j.metal]
  const pierce = (id: string, label: string, art: ArtKind, patch: Partial<Jewellery>, on: boolean, off: Partial<Jewellery>, framing: StepDef['framing'] = 'face', section?: string): Tile => ({
    id,
    section,
    label: on ? `${label} (out)` : label,
    art: <Art kind={art} color={metal} skin={look.skin.tone} />,
    on,
    run: () => runStep(wearStep(on ? `${label} out` : label, (l) => void Object.assign(l.jewellery, on ? off : patch), framing), { product: shadeProduct('#fff'), target: null, option: null }),
    sfx: 'snip' as const,
  })
  if (cat === 'tattoos') {
    const ink = '#1A1A22'
    const add: Tile[] = TATTOO_DESIGNS.map((d) => {
      const spot = [...TATTOO_HOME[d], ...TATTOO_SPOTS].find((s) => !look.tattoos.some((t) => t.at === s))
      return {
        id: `ink:${d}`,
        label: `${d[0].toUpperCase()}${d.slice(1)} tattoo`,
        art: <PreviewArt design={d} ink={ink} />,
        on: look.tattoos.some((t) => t.design === d),
        blocked: look.tattoos.length >= 8 ? 'Eight tattoos is the limit here. Remove one first.' : !spot ? 'No free spot for this one.' : null,
        run: () => spot && runStep(tattooStep(d, spot, ink), { product: shadeProduct(ink), target: null, option: null }),
        sfx: 'buzz' as const,
      }
    })
    const remove: Tile[] = look.tattoos.map((t) => ({
      id: `laser:${t.at}`,
      label: `Remove ${t.design} · ${SPOT_NAME(t.at)}`,
      art: (
        <span className="relative block h-full w-full">
          <PreviewArt design={t.design} ink={t.ink} />
          <span className="absolute inset-0 grid place-items-center text-[28px]" aria-hidden>
            ✕
          </span>
        </span>
      ),
      run: () => runStep(tattooRemoveStep(t.design, t.at), { product: shadeProduct('#ff3355'), target: null, option: null }),
      sfx: 'zap' as const,
    }))
    return [...remove, ...add]
  }
  if (cat === 'piercings') {
    const any = j.ears !== 'none' || j.helix || j.industrial || j.nose !== 'none' || j.septum || j.lip !== 'none' || j.brow || j.navel
    return [
      // grouped by where they go, each the real jewellery for that spot
      pierce('ears:studs', 'Lobe studs', 'earrings', { ears: 'studs' }, j.ears === 'studs', { ears: 'none' }, 'face', 'Ears'),
      pierce('ears:hoops', 'Lobe hoops', 'earrings', { ears: 'hoops' }, j.ears === 'hoops', { ears: 'none' }, 'face', 'Ears'),
      pierce('ears:huggies', 'Lobe huggies', 'earrings', { ears: 'huggies' }, j.ears === 'huggies', { ears: 'none' }, 'face', 'Ears'),
      pierce('ears:drops', 'Lobe drops', 'earrings', { ears: 'drops' }, j.ears === 'drops', { ears: 'none' }, 'face', 'Ears'),
      pierce('helix', 'Helix ring (upper ear)', 'piercing', { helix: true }, j.helix, { helix: false }, 'face', 'Ears'),
      pierce('industrial', 'Industrial (long ear bar)', 'piercing', { industrial: true }, j.industrial, { industrial: false }, 'face', 'Ears'),
      pierce('nose:stud', 'Nostril stud', 'noseRing', { nose: 'stud' }, j.nose === 'stud', { nose: 'none' }, 'face', 'Nose'),
      pierce('nose:ring', 'Nostril hoop', 'noseRing', { nose: 'ring' }, j.nose === 'ring', { nose: 'none' }, 'face', 'Nose'),
      pierce('septum', 'Septum horseshoe', 'piercing', { septum: true }, j.septum, { septum: false }, 'face', 'Nose'),
      pierce('lip:labret', 'Labret (under lip)', 'piercing', { lip: 'labret' }, j.lip === 'labret', { lip: 'none' }, 'face', 'Lips'),
      pierce('lip:monroe', 'Monroe (above lip)', 'piercing', { lip: 'monroe' }, j.lip === 'monroe', { lip: 'none' }, 'face', 'Lips'),
      pierce('lip:snakebites', 'Snake bites (rings)', 'piercing', { lip: 'snakebites' }, j.lip === 'snakebites', { lip: 'none' }, 'face', 'Lips'),
      pierce('brow', 'Eyebrow bar', 'piercing', { brow: true }, j.brow, { brow: false }, 'face', 'Brow'),
      pierce('navel', 'Belly bar', 'piercing', { navel: true }, j.navel, { navel: false }, 'full', 'Navel'),
      {
        id: 'pierce:out',
        label: 'Take all piercings out',
        art: <Art kind="remove" />,
        blocked: any ? null : 'No piercings in right now.',
        run: () => runStep(wearStep('All piercings out', (l) => void Object.assign(l.jewellery, { ears: 'none', helix: false, industrial: false, nose: 'none', septum: false, lip: 'none', brow: false, navel: false })), { product: shadeProduct('#fff'), target: null, option: null }),
      },
    ]
  }
  if (cat === 'jewellery') return jewelleryTiles(look)
  return []
}

function jewelleryTiles(look: StudioLook): Tile[] {
  const j = look.jewellery
  const metal = { gold: '#D4A64A', silver: '#C8CBD2', rose: '#D9A0A0' }[j.metal]
  const wear = (id: string, label: string, art: ArtKind, patch: Partial<Jewellery>, on: boolean, framing: StepDef['framing'] = 'face', off: Partial<Jewellery> = {}): Tile => ({
    id,
    label,
    art: <Art kind={art} color={id.startsWith('glasses') ? (patch.frame ?? j.frame) : metal} skin={look.skin.tone} />,
    on,
    run: () => runStep(wearStep(label, (l) => void Object.assign(l.jewellery, on ? off : patch), framing), { product: shadeProduct('#fff'), target: null, option: null }),
  })
  return [
    wear('neck:chain', 'Chain', 'necklace', { necklace: 'chain' }, j.necklace === 'chain', 'bust', { necklace: 'none' }),
    wear('neck:pendant', 'Pendant', 'necklace', { necklace: 'pendant' }, j.necklace === 'pendant', 'bust', { necklace: 'none' }),
    wear('neck:pearls', 'Pearls', 'necklace', { necklace: 'pearls' }, j.necklace === 'pearls', 'bust', { necklace: 'none' }),
    wear('neck:choker', 'Choker', 'necklace', { necklace: 'choker' }, j.necklace === 'choker', 'bust', { necklace: 'none' }),
    wear('wrist:bangle', 'Bangle', 'bracelet', { wrist: 'bangle' }, j.wrist === 'bangle', 'hands', { wrist: 'none' }),
    wear('wrist:chain', 'Chain bracelet', 'bracelet', { wrist: 'chain' }, j.wrist === 'chain', 'hands', { wrist: 'none' }),
    wear('wrist:stack', 'Stack', 'bracelet', { wrist: 'stack' }, j.wrist === 'stack', 'hands', { wrist: 'none' }),
    wear('rings', 'Rings', 'rings', { rings: true }, j.rings, 'hands', { rings: false }),
    wear('glasses:round', 'Round frames', 'glasses', { glasses: 'round', frame: '#2A1A14' }, j.glasses === 'round', 'face', { glasses: 'none' }),
    wear('glasses:square', 'Square frames', 'glasses', { glasses: 'square', frame: '#0C0808' }, j.glasses === 'square', 'face', { glasses: 'none' }),
    wear('glasses:sunnies', 'Sunnies', 'glasses', { glasses: 'sunnies', frame: '#0C0808' }, j.glasses === 'sunnies', 'face', { glasses: 'none' }),
    {
      id: 'metal',
      label: { gold: 'Gold → silver', silver: 'Silver → rose', rose: 'Rose → gold' }[j.metal],
      art: <Art kind="rings" color={metal} />,
      run: () => useStudio.getState().apply((l) => void (l.jewellery.metal = ({ gold: 'silver', silver: 'rose', rose: 'gold' } as const)[l.jewellery.metal])),
    },
  ]
}

/** One shade lighter on the cast's skin-tone ladder (deepest first), from the nearest step. */
export function lighterTone(tone: string, steps = 1): string {
  const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
  const t = rgb(tone)
  let best = 0
  let bd = Infinity
  SKIN_TONES.forEach((c, i) => {
    const d = rgb(c).reduce((s, v, k) => s + (v - t[k]) ** 2, 0)
    if (d < bd) (bd = d), (best = i)
  })
  return SKIN_TONES[Math.max(0, Math.min(SKIN_TONES.length - 1, best + steps))]
}

function clinicTiles(cat: Category, look: StudioLook, catalog: CharacterCatalog): Tile[] {
  if (cat === 'tattoos' || cat === 'piercings' || cat === 'jewellery') return doctorTiles(cat, look)
  const area = cat === 'clinicFace' ? 'face' : 'body'
  const tiles: Tile[] = PROCEDURES.filter((p) => p.area === area).map((p) => {
    const applied = look.clinic[p.id] ?? 0
    const why = unsupported(p, catalog)
    return {
      id: `clinic:${p.id}`,
      label: p.name,
      art: <Art kind={CLINIC_ART[p.id]} color="#F2B8C6" skin={look.skin.tone} />,
      on: applied > 0,
      blocked: why,
      run: async () => {
        const s = useStudio.getState()
        s.setFraming(p.framing)
        // no confirm dialogs: tap applies it (in full, so the change is obvious), tap again
        // reverses it (and Undo always works)
        if (applied > 0) return s.apply((l) => void delete l.clinic[p.id])
        await runStep(wearStep(p.name, (l) => void (l.clinic[p.id] = 1), p.framing), { product: shadeProduct('#fff'), target: null, option: null })
      },
    }
  })
  if (area === 'face') {
    // Glow drip: the skin one shade lighter (tap again: back to her own shade)
    const on = (look.clinic.glowDrip ?? 0) > 0
    tiles.unshift({
      id: 'clinic:glowDrip',
      label: 'Glow drip',
      art: <Art kind="drip" color="#F2A33A" />,
      on,
      run: async () => {
        const s = useStudio.getState()
        s.setFraming('face')
        if (on) return s.apply((l) => void ((l.skin.tone = lighterTone(l.skin.tone, -2)), delete l.clinic.glowDrip))
        await runStep(
          wearStep('Glow drip', (l) => {
            l.skin.tone = lighterTone(l.skin.tone, 2)
            l.clinic.glowDrip = 1
          }, 'face'),
          { product: shadeProduct('#fff'), target: null, option: null },
        )
      },
    })
  }
  return tiles
}

/* ------------------------------------------------------------------ dispatch */

export function tilesFor(room: RoomId, cat: Category, look: StudioLook, catalog: CharacterCatalog): Tile[] {
  if (room === 'skincare') return skincareTiles(cat, look)
  if (room === 'makeup') return makeupTiles(cat, look)
  if (room === 'hair') return hairTiles(cat, look, catalog)
  if (room === 'doctor') return clinicTiles(cat, look, catalog)
  return storeTiles(cat, room, look, catalog)
}

/** Treat tiles reference these spot ids (kept here so the import is used in typing). */
export type { SpotId }
