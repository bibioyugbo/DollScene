import type { ReactNode } from 'react'
import { PROCEDURES } from '../../../shared/studio/clinic'
import { HAIR_COLOR_PRESETS } from '../../../shared/studio/hairColors'
import { LOCS, type ClinicId, type HairId, type Jewellery, type MorphId, type SpotId, type StudioLook } from '../../../shared/studio/look'
import { MAKEUP_PRESETS, mixHex } from '../../../shared/studio/presets'
import { dressStep, hairColourStep, hairStyleStep, wearStep } from '../../actions/dress'
import { BONNET_ON, BRUSH, DRY, HAIR_PRODUCTS, hairKind, RETWIST, RETWIST_TO, TAKEDOWN, TAKEDOWN_TO, WASH } from '../../actions/haircare'
import { amountOf, BROW_STEP, lookStep, makeupStep, REMOVE_ALL, shadeProduct, type MakeupKey } from '../../actions/makeup'
import { MANICURE } from '../../actions/nailcare'
import { BONNET_OFF, BRIGHTEN, CLEANSE, COMPRESS, EXFOLIATE, EYE_CREAM, FACE_WASH, LIP_BALM, MOISTURISER, PATCH_ON, PATCHES, POP, PRODUCTS, SERUM, SOOTHE, SPOT, SUNSCREEN, TONER, WAKE, skinCheckIn } from '../../actions/skincare'
import { runStep, type Product, type StepDef } from '../../actions/steps'
import { url, type CharacterCatalog } from '../../character/catalog'
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
  sfx?: Sfx
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
  jewellery: 'Jewellery',
  hairstyles: 'Hairstyles',
  haircolour: 'Hair colour',
  haircare: 'Haircare',
  outfits: 'Outfits',
  shoes: 'Shoes',
  clinicFace: 'Face',
  clinicBody: 'Body & hair',
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
            })
            s.markBefore()
            await runStep(WAKE, { product: WAKE.products[0], target: null, option: null })
          },
        },
        stepTile('bonnetOff', 'Bonnet off', <Art kind="bonnetOff" />, BONNET_OFF, look, BONNET_OFF.products[0]),
      ]
    case 'cleanse':
      return [
        stepTile('wash', 'Face wash', <Art kind="wash" skin={skin} />, FACE_WASH, look, PRODUCTS.cleanser[0], { on: done('wash'), sfx: 'squish' }),
        stepTile('foam', 'Foam cleanser', <Art kind="foamCleanser" color="#9FD8C4" color2="#2B6B5A" />, CLEANSE, look, PRODUCTS.cleanser[0], { option: 'cloth', sfx: 'squish' }),
        stepTile('balm', 'Melt balm', <Art kind="balmCleanser" color="#F4D9A8" color2="#C9A06A" />, CLEANSE, look, PRODUCTS.cleanser[1], { option: 'cloth', sfx: 'squish' }),
        stepTile('micellar', 'Micellar + pad', <Art kind="micellar" color="#D8E8F6" color2="#7FA8C8" />, CLEANSE, look, PRODUCTS.cleanser[2], { sfx: 'swipe' }),
      ]
    case 'treat': {
      const count = (states: string[]) => Object.values(c.spots).filter((s) => states.includes(s as string)).length
      const pimples = count(['pimple'])
      return [
        stepTile('pop', 'Pop a pimple', <Art kind="pop" skin={skin} />, POP, look, PRODUCTS.fingers[0], { option: 'squeeze', badge: pimples ? `×${pimples}` : undefined, sfx: 'squish' }),
        stepTile('patchOn', 'Pimple patch', <Art kind="patch" skin={skin} />, PATCH_ON, look, PRODUCTS.fingers[0], { sfx: 'dab' }),
        stepTile('patchOff', 'Peel a patch', <Art kind="patchOff" skin={skin} />, PATCHES, look, PRODUCTS.fingers[0], { badge: c.patches.length ? `×${c.patches.length}` : undefined, sfx: 'peel' }),
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
            useStudio.getState().notify('Polish off, nails back to natural.', 'success')
          },
          blocked: look.nails.amount < 0.01 && look.nails.length < 0.01 ? 'No polish on right now.' : null,
        },
      ]
    case 'jewellery': {
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
        wear('ears:hoops', 'Hoops', 'earrings', { ears: 'hoops' }, j.ears === 'hoops', 'face', { ears: 'none' }),
        wear('ears:studs', 'Studs', 'earrings', { ears: 'studs' }, j.ears === 'studs', 'face', { ears: 'none' }),
        wear('ears:drops', 'Drops', 'earrings', { ears: 'drops' }, j.ears === 'drops', 'face', { ears: 'none' }),
        wear('ears:huggies', 'Huggies', 'earrings', { ears: 'huggies' }, j.ears === 'huggies', 'face', { ears: 'none' }),
        wear('nose:stud', 'Nose stud', 'noseRing', { nose: 'stud' }, j.nose === 'stud', 'face', { nose: 'none' }),
        wear('nose:ring', 'Nose ring', 'noseRing', { nose: 'ring' }, j.nose === 'ring', 'face', { nose: 'none' }),
        wear('septum', 'Septum', 'piercing', { septum: true }, j.septum, 'face', { septum: false }),
        wear('neck:chain', 'Chain', 'necklace', { necklace: 'chain' }, j.necklace === 'chain', 'bust', { necklace: 'none' }),
        wear('neck:pendant', 'Pendant', 'necklace', { necklace: 'pendant' }, j.necklace === 'pendant', 'bust', { necklace: 'none' }),
        wear('neck:pearls', 'Pearls', 'necklace', { necklace: 'pearls' }, j.necklace === 'pearls', 'bust', { necklace: 'none' }),
        wear('wrist:bangle', 'Bangle', 'bracelet', { wrist: 'bangle' }, j.wrist === 'bangle', 'hands', { wrist: 'none' }),
        wear('wrist:stack', 'Stack', 'bracelet', { wrist: 'stack' }, j.wrist === 'stack', 'hands', { wrist: 'none' }),
        wear('rings', 'Rings', 'rings', { rings: true }, j.rings, 'hands', { rings: false }),
        wear('glasses:round', 'Round frames', 'glasses', { glasses: 'round', frame: '#2A1A14' }, j.glasses === 'round', 'face', { glasses: 'none' }),
        wear('glasses:cateye', 'Cat-eye', 'glasses', { glasses: 'cateye', frame: '#7A1F2B' }, j.glasses === 'cateye', 'face', { glasses: 'none' }),
        wear('glasses:sunnies', 'Sunnies', 'glasses', { glasses: 'sunnies', frame: '#0C0808' }, j.glasses === 'sunnies', 'face', { glasses: 'none' }),
        {
          id: 'metal',
          label: { gold: 'Gold → silver', silver: 'Silver → rose', rose: 'Rose → gold' }[j.metal],
          art: <Art kind="rings" color={metal} />,
          run: () => useStudio.getState().apply((l) => void (l.jewellery.metal = ({ gold: 'silver', silver: 'rose', rose: 'gold' } as const)[l.jewellery.metal])),
        },
      ]
    }
    default:
      return []
  }
}

/* ------------------------------------------------------------------ Hair Studio */

export const HAIR_PALETTE = [
  { color: '#0A0A0C', name: 'Jet black' },
  { color: '#2A1A12', name: 'Dark brown' },
  { color: '#6B3A22', name: 'Chestnut' },
  { color: '#B9854A', name: 'Honey blonde' },
  { color: '#E6DCC8', name: 'Platinum' },
  { color: '#B5552A', name: 'Ginger' },
  { color: '#5E1A26', name: 'Burgundy' },
  { color: '#E07AA6', name: 'Pink' },
  { color: '#1E7A7A', name: 'Teal' },
  { color: '#2D5BD0', name: 'Blue' },
  { color: '#6A3FB0', name: 'Violet' },
  { color: '#C0C0C8', name: 'Silver' },
]

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
          palette: {
            label: `${h.name} colours`,
            colors: HAIR_PALETTE,
            value: look.hair.style === h.id ? look.hair.color : null,
            onPick: (c: string) => void runStep(hairStyleStep(h.id as HairId, h.name, c), { product: shadeProduct(c), target: null, option: null }),
          },
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

function storeTiles(cat: Category, room: RoomId, look: StudioLook, catalog: CharacterCatalog): Tile[] {
  if (cat === 'outfits') {
    return catalog.outfits
      .filter((o) => o.store === room)
      .map((o) => ({
        id: `outfit:${o.id}`,
        label: o.name,
        art: <GarmentThumb src={url.outfitThumb(o.id)} fallback={<Art kind="none" />} />,
        on: look.outfit.id === o.id,
        run: () => runStep(dressStep(o.name, (l) => void (l.outfit = { id: o.id, dye: '#FFFFFF', dyeAmount: 0 })), { product: shadeProduct('#fff'), target: null, option: null }),
        sfx: 'zip' as const,
      }))
  }
  if (cat === 'shoes') {
    return catalog.shoes.map((s) => ({
      id: `shoes:${s.id}`,
      label: s.name,
      art: <GarmentThumb src={url.shoeThumb(s.id)} fallback={<Art kind="none" />} />,
      on: look.shoes.id === s.id,
      run: () => runStep(dressStep(s.name, (l) => void (l.shoes = { id: s.id })), { product: shadeProduct('#fff'), target: null, option: null }),
      sfx: 'zip' as const,
    }))
  }
  return []
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
  hairline: 'hairline',
  transplant: 'hairline',
  bbl: 'body',
  lipo: 'body',
}

function unsupported(p: (typeof PROCEDURES)[number], catalog: CharacterCatalog): string | null {
  if (!p.morphs) return null
  for (const [m, d] of Object.entries(p.morphs) as [MorphId, number][]) {
    const entry = catalog.morphs.find((x) => x.id === m)
    if (!entry || (d > 0 && !entry.pos) || (d < 0 && !entry.neg)) return `This doll's model has no ${m} shape yet.`
  }
  return null
}

function clinicTiles(cat: Category, look: StudioLook, catalog: CharacterCatalog): Tile[] {
  const area = cat === 'clinicFace' ? ['face'] : ['body', 'hair']
  return [
    {
      id: 'drip',
      label: 'Glow drip',
      art: <Art kind="drip" color="#F2A33A" />,
      on: look.care.glow > 0.7,
      run: async () => {
        const s = useStudio.getState()
        const ok = await s.ask({ title: 'Glow drip?', body: 'A relaxing drip session: her skin comes out glowing and hydrated. Fictional styling only.', confirm: 'Start the drip' })
        if (!ok) return
        await runStep(
          wearStep('Glow drip', (l) => {
            l.care.glow = Math.min(1, l.care.glow + 0.4)
            l.care.hydration = Math.min(1, l.care.hydration + 0.3)
          }),
          { product: shadeProduct('#fff'), target: null, option: null },
        )
      },
    },
    ...PROCEDURES.filter((p) => area.includes(p.area)).map((p) => {
      const applied = look.clinic[p.id] ?? 0
      const why = unsupported(p, catalog)
      return {
        id: `clinic:${p.id}`,
        label: p.name,
        art: <Art kind={CLINIC_ART[p.id]} color="#F2B8C6" skin={look.skin.tone} />,
        on: applied > 0,
        badge: applied > 0 ? `${Math.round(applied * 100)}%` : undefined,
        blocked: why,
        run: async () => {
          const s = useStudio.getState()
          s.setFraming(p.framing)
          if (applied > 0) {
            const ok = await s.ask({ title: `Reverse ${p.name}?`, body: 'Her shape goes back to how it was before this procedure.', confirm: 'Reverse it' })
            if (ok) {
              s.apply((l) => void delete l.clinic[p.id])
              s.notify(`${p.name} reversed.`, 'success')
            }
            return
          }
          useStudio.setState({ clinicPreview: { ...look.clinic, [p.id]: 0.6 } })
          const ok = await s.ask({ title: `${p.name}?`, body: `${p.blurb} You're seeing the preview now. Confirm to keep it (reversible here any time). Fictional styling only, not advice about real procedures.`, confirm: 'Confirm', cancel: 'No thanks' })
          useStudio.setState({ clinicPreview: null })
          if (!ok) return
          await runStep(wearStep(p.name, (l) => void (l.clinic[p.id] = 0.6), p.framing), { product: shadeProduct('#fff'), target: null, option: null })
        },
      }
    }),
  ]
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
