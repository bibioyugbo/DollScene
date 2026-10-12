import { getItem, isStarterItem, SLOT_CONFLICTS } from './catalog'
import { CLINIC_BY_ID, type ClinicProcedure, PIERCING_PRICE, STARTER_CHANGE_COST, TATTOO_PRICE, TEMP_TATTOO_PRICE } from './economy'
import { sanitizeLook } from './look2d'
import type { Appearance, AvatarSummary, HairLook, Outfit, OutfitSlot } from './types'

export const APPEARANCE_VERSION = 2 as const

export const DEFAULT_HAIR: HairLook = {
  style: 'afro',
  length: 0.5,
  volume: 0.6,
  parting: 'none',
  curl: '4b',
  color: '#1B1214',
  dye: { mode: 'solid', color2: '#C9A227', gloss: 0.3 },
  edges: { style: 'sleek', density: 0.5, swirl: 0.5 },
  accessories: [],
  accessoryColor: '#FFC24D',
}

export function defaultAppearance(): Appearance {
  return {
    version: APPEARANCE_VERSION,
    starterId: 'ada',
    base: 'feminine',
    skin: { tone: '#7A4A2E', undertone: 'warm', faceTone: null, marks: {}, glow: 0.35 },
    face: {
      preset: 'oval',
      nose: 0.5,
      lips: 0.6,
      jaw: 0.4,
      cheekbones: 0.6,
      chin: 0.5,
      forehead: 0.5,
      eyeSize: 0.55,
      eyeSpacing: 0.5,
      eyeShape: 0.5,
      brows: 0.5,
      asymmetry: 0.1,
      eyeColor: '#3B2219',
    },
    body: { preset: 'hourglass', height: 1, shoulders: 0.45, waist: 0.35, hips: 0.6, bust: 0.5, legs: 0.5, muscle: 0.3, softness: 0.5 },
    hair: structuredClone(DEFAULT_HAIR),
    makeup: {
      foundation: 0.4,
      blush: '#D2577A',
      blushAmount: 0.3,
      contour: 0.3,
      highlight: 0.4,
      eyeshadow: null,
      eyeliner: 'thin',
      lashes: 'natural',
      brows: 'natural',
      lipstick: '#8E3B46',
      lipLiner: null,
      gloss: 0.4,
      look: 'none',
      preset: null,
    },
    facialHair: { style: 'none', color: '#1B1214', density: 0.7 },
    nails: { shape: 'almond', length: 0.4, color: '#FF3D8B', pattern: 'solid', charms: false },
    piercings: [],
    tattoos: [],
    outfit: { top: 'starter-tee-white', bottom: 'starter-jeans', shoes: 'starter-sneakers-white' },
    clinic: [],
    identity: { pronouns: '', genderExpression: '', orientation: '', datingPreference: '' },
  }
}

const clamp01 = (n: unknown, fallback: number) => (typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : fallback)
const hex = (s: unknown, fallback: string) => (typeof s === 'string' && /^#[0-9a-fA-F]{6}$/.test(s) ? s : fallback)
const str = (s: unknown, max: number, fallback = '') => (typeof s === 'string' ? s.slice(0, max) : fallback)

/**
 * Server-side validation. Merges untrusted input over defaults, clamps every
 * slider and drops anything unknown, so a bad client cannot store junk.
 */
export function sanitizeAppearance(input: unknown): Appearance {
  const d = defaultAppearance()
  if (!input || typeof input !== 'object') return d
  const a = input as Partial<Appearance>
  const out: Appearance = structuredClone(d)
  out.starterId = str(a.starterId, 32, d.starterId)
  out.base = a.base === 'masculine' || a.base === 'androgynous' ? a.base : 'feminine'
  if (a.skin) {
    out.skin.tone = hex(a.skin.tone, d.skin.tone)
    out.skin.undertone = (['warm', 'cool', 'neutral', 'golden', 'red'] as const).includes(a.skin.undertone) ? a.skin.undertone : 'warm'
    out.skin.faceTone = a.skin.faceTone ? hex(a.skin.faceTone, d.skin.tone) : null
    out.skin.glow = clamp01(a.skin.glow, d.skin.glow)
    out.skin.marks = {}
    for (const [k, v] of Object.entries(a.skin.marks ?? {})) {
      if (['freckles', 'beauty-marks', 'birthmark', 'vitiligo', 'scars', 'stretch-marks'].includes(k)) {
        const n = clamp01(v, 0)
        if (n > 0) out.skin.marks[k as keyof typeof out.skin.marks] = n
      }
    }
  }
  if (a.face) {
    for (const k of Object.keys(d.face) as (keyof typeof d.face)[]) {
      if (k === 'preset') out.face.preset = str(a.face.preset, 24, d.face.preset)
      else if (k === 'eyeColor') out.face.eyeColor = hex(a.face.eyeColor, d.face.eyeColor)
      else (out.face[k] as number) = clamp01(a.face[k], d.face[k] as number)
    }
  }
  if (a.body) {
    for (const k of Object.keys(d.body) as (keyof typeof d.body)[]) {
      if (k === 'preset') out.body.preset = str(a.body.preset, 24, d.body.preset)
      else if (k === 'height') {
        const h = typeof a.body.height === 'number' ? a.body.height : 1
        out.body.height = Math.max(0.85, Math.min(1.15, h))
      } else (out.body[k] as number) = clamp01(a.body[k], d.body[k] as number)
    }
  }
  if (a.hair) out.hair = sanitizeHair(a.hair)
  if (a.makeup) {
    const m = a.makeup
    out.makeup = {
      foundation: clamp01(m.foundation, d.makeup.foundation),
      blush: m.blush ? hex(m.blush, '#D2577A') : null,
      blushAmount: clamp01(m.blushAmount, 0.3),
      contour: clamp01(m.contour, 0.3),
      highlight: clamp01(m.highlight, 0.4),
      eyeshadow: m.eyeshadow ? hex(m.eyeshadow, '#A86BFF') : null,
      eyeliner: (['none', 'thin', 'wing', 'graphic'] as const).includes(m.eyeliner) ? m.eyeliner : 'thin',
      lashes: (['none', 'natural', 'volume', 'drama'] as const).includes(m.lashes) ? m.lashes : 'natural',
      brows: (['natural', 'laminated', 'thin', 'bold', 'skinny', 'thick', '2016', 'shaped', 'slit'] as const).includes(m.brows) ? m.brows : 'natural',
      lipstick: m.lipstick ? hex(m.lipstick, '#8E3B46') : null,
      lipLiner: m.lipLiner ? hex(m.lipLiner, '#5E2A2A') : null,
      gloss: clamp01(m.gloss, 0.4),
      look: (['none', 'glitter', 'face-gems', 'freckle-art', 'tribal-dots', 'chrome'] as const).includes(m.look) ? m.look : 'none',
      preset: typeof m.preset === 'string' ? m.preset.slice(0, 24) : null,
    }
  }
  if (a.facialHair) {
    const styles = ['none', 'stubble', 'moustache', 'goatee', 'short-beard', 'full-beard', 'sideburns', 'chin-strap'] as const
    out.facialHair = {
      style: styles.includes(a.facialHair.style) ? a.facialHair.style : 'none',
      color: hex(a.facialHair.color, '#1B1214'),
      density: clamp01(a.facialHair.density, 0.7),
    }
  }
  if (a.nails) {
    out.nails = {
      shape: (['round', 'square', 'almond', 'coffin', 'stiletto'] as const).includes(a.nails.shape) ? a.nails.shape : 'almond',
      length: clamp01(a.nails.length, 0.4),
      color: hex(a.nails.color, '#FF3D8B'),
      pattern: (['solid', 'french', 'chrome', 'ombre', 'marble', 'ankara', 'glitter'] as const).includes(a.nails.pattern) ? a.nails.pattern : 'solid',
      charms: !!a.nails.charms,
    }
  }
  out.piercings = (Array.isArray(a.piercings) ? a.piercings : []).slice(0, 40).map((p, i) => ({
    id: str(p.id, 40, `p${i}`),
    site: p.site,
    side: p.side,
    jewellery: p.jewellery,
    metal: p.metal,
    gem: p.gem,
    size: clamp01(p.size, 0.4),
  }))
  out.tattoos = (Array.isArray(a.tattoos) ? a.tattoos : []).slice(0, 40).map((t, i) => ({
    id: str(t.id, 40, `t${i}`),
    region: t.region,
    design: str(t.design, 40, 'rose'),
    size: clamp01(t.size, 0.5),
    rotation: typeof t.rotation === 'number' ? Math.max(-180, Math.min(180, t.rotation)) : 0,
    opacity: clamp01(t.opacity, 0.9),
    mirror: !!t.mirror,
    color: t.color ? hex(t.color, '#1E0B26') : null,
    layer: typeof t.layer === 'number' ? Math.round(t.layer) : i,
    temporary: !!t.temporary,
  }))
  out.outfit = {}
  for (const [slot, id] of Object.entries(a.outfit ?? {})) {
    const item = getItem(id)
    if (item && item.slot === slot) out.outfit[slot as OutfitSlot] = id
  }
  out.clinic = (Array.isArray(a.clinic) ? a.clinic : []).filter((id) => CLINIC_BY_ID.has(id)).slice(0, 50)
  if (a.identity) {
    out.identity = {
      pronouns: str(a.identity.pronouns, 24),
      genderExpression: str(a.identity.genderExpression, 32),
      orientation: str(a.identity.orientation, 32),
      datingPreference: str(a.identity.datingPreference, 32),
    }
  }
  if (a.look) out.look = sanitizeLook(a.look)
  return out
}

export const HAIR_STYLE_IDS: HairLook['style'][] = [
  'afro', 'twa', 'locs', 'sisterlocs', 'freeform-locs', 'knotless-braids', 'box-braids', 'fulani-braids', 'cornrows', 'bantu-knots',
  'twists', 'faux-locs', 'lace-front', 'sew-in', 'silk-press', 'puffs', 'high-puff', 'natural-updo', 'bob', 'bun', 'fade', 'taper',
  'short-cut', 'buzz', 'bald', 'pixie', 'ponytail', 'long-straight', 'long-curly', 'fringe-bob', 'mohawk', 'shaved-sides',
]

export function sanitizeHair(h: Partial<HairLook>): HairLook {
  const d = DEFAULT_HAIR
  return {
    style: h.style && HAIR_STYLE_IDS.includes(h.style) ? h.style : d.style,
    length: clamp01(h.length, d.length),
    volume: clamp01(h.volume, d.volume),
    parting: h.parting ?? d.parting,
    curl: h.curl ?? d.curl,
    color: hex(h.color, d.color),
    dye: {
      mode: h.dye?.mode ?? 'solid',
      color2: hex(h.dye?.color2, d.dye.color2),
      gloss: clamp01(h.dye?.gloss, d.dye.gloss),
    },
    edges: {
      style: h.edges?.style ?? 'sleek',
      density: clamp01(h.edges?.density, 0.5),
      swirl: clamp01(h.edges?.swirl, 0.5),
    },
    accessories: Array.isArray(h.accessories) ? [...new Set(h.accessories)].slice(0, 6) : [],
    accessoryColor: hex(h.accessoryColor, d.accessoryColor),
  }
}

/** Remove slots hidden by the newly worn slot (a dress removes top and bottom). */
export function wearItem(outfit: Outfit, slot: OutfitSlot, itemId: string | null): Outfit {
  const next: Outfit = { ...outfit }
  if (!itemId) {
    delete next[slot]
    return next
  }
  for (const s of SLOT_CONFLICTS[slot] ?? []) delete next[s]
  next[slot] = itemId
  return next
}

export interface BillLine {
  label: string
  amount: number
}

/** What a studio visit costs: new piercings, tattoos, clinic procedures, starter changes. */
export function appearanceBill(prev: Appearance | null, next: Appearance, starterChanges: number): BillLine[] {
  if (!prev) return []
  const lines: BillLine[] = []
  const prevPiercings = new Set(prev.piercings.map((p) => p.id))
  const newPiercings = next.piercings.filter((p) => !prevPiercings.has(p.id)).length
  if (newPiercings) lines.push({ label: `${newPiercings} new piercing${newPiercings > 1 ? 's' : ''}`, amount: newPiercings * PIERCING_PRICE })
  const prevTattoos = new Set(prev.tattoos.map((t) => t.id))
  const added = next.tattoos.filter((t) => !prevTattoos.has(t.id))
  const perm = added.filter((t) => !t.temporary).length
  const temp = added.length - perm
  if (perm) lines.push({ label: `${perm} new tattoo${perm > 1 ? 's' : ''}`, amount: perm * TATTOO_PRICE })
  if (temp) lines.push({ label: `${temp} henna / body paint`, amount: temp * TEMP_TATTOO_PRICE })
  for (const id of next.clinic.slice(prev.clinic.length)) {
    const p = CLINIC_BY_ID.get(id)
    if (p) lines.push({ label: `Clinic: ${p.name}`, amount: p.price })
  }
  if (next.starterId !== prev.starterId && starterChanges >= 1) lines.push({ label: 'Change starter doll', amount: STARTER_CHANGE_COST })
  return lines
}

export function billTotal(lines: BillLine[]): number {
  return lines.reduce((s, l) => s + l.amount, 0)
}

/** Items in the outfit that the player has to own. */
export function outfitItemsToOwn(outfit: Outfit): string[] {
  return Object.values(outfit).filter((id): id is string => !!id && !isStarterItem(id))
}

export function avatarSummary(a: Appearance): AvatarSummary {
  const topId = a.outfit.dress ?? a.outfit.top ?? a.outfit.swimwear ?? a.outfit.outerwear
  const top = getItem(topId)
  return {
    base: a.base,
    skin: a.skin.faceTone ?? a.skin.tone,
    hairStyle: a.hair.style,
    hairColor: a.hair.color,
    hairColor2: a.hair.dye.mode === 'solid' ? a.hair.color : a.hair.dye.color2,
    topColor: top?.colors[0] ?? '#FFFFFF',
    eyeColor: a.face.eyeColor,
    lipColor: a.makeup.lipstick ?? '#8E3B46',
    accessory: a.outfit.headwear && getItem(a.outfit.headwear)?.template === 'gele' ? 'gele' : (a.hair.accessories[0] ?? null),
    ...(a.look ? { look: a.look } : {}),
  }
}

export function outfitSummary(outfit: Outfit): string {
  const order: OutfitSlot[] = ['dress', 'top', 'bottom', 'outerwear', 'swimwear', 'shoes', 'headwear']
  const names = order
    .map((s) => getItem(outfit[s]))
    .filter((i): i is NonNullable<typeof i> => !!i)
    .map((i) => i.name.split(' — ')[0])
  return names.slice(0, 3).join(', ') || 'Fresh basics'
}

/** Book a Beauty Doctor procedure: its deltas are added to the sliders and it joins the clinic list (billed on save). */
export function applyProcedure(a: Appearance, p: ClinicProcedure): Appearance {
  const bump = <T extends object>(src: T, deltas: Partial<Record<keyof T, number>> | undefined): T => {
    const out = { ...src } as Record<string, unknown>
    for (const [k, v] of Object.entries(deltas ?? {})) out[k] = Math.max(0, Math.min(1, (out[k] as number) + (v as number)))
    return out as T
  }
  const skin = p.skin?.glow ? { ...a.skin, glow: Math.min(1, a.skin.glow + p.skin.glow) } : a.skin
  return { ...a, face: bump(a.face, p.face), body: bump(a.body, p.body), skin, clinic: [...a.clinic, p.id] }
}
