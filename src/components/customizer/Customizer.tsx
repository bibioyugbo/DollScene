import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { ENABLE_CLINIC } from '../../config/env'
import {
  BLUSH_SHADES,
  CONTACT_COLORS,
  FACIAL_HAIR,
  LINER_SHADES,
  MAKEUP_PRESETS,
  BODY_PRESETS,
  BODY_SLIDERS,
  BROWS,
  CURLS,
  DATING_PREFS,
  DYE_MODES,
  EDGE_STYLES,
  EYE_COLORS,
  EYELINERS,
  FACE_PRESETS,
  FACE_SLIDERS,
  GEMS,
  GENDER_EXPRESSIONS,
  HAIR_ACCESSORIES,
  HAIR_COLORS,
  HAIR_GROUPS,
  JEWELLERY,
  LASHES,
  LIP_SHADES,
  METALS,
  NAIL_PATTERNS,
  NAIL_SHADES,
  NAIL_SHAPES,
  ORIENTATIONS,
  PARTINGS,
  PIERCING_GROUPS,
  PRONOUNS,
  SHADOW_SHADES,
  SKIN_GROUPS,
  SKIN_MARKS,
  SPECIAL_LOOKS,
  TATTOO_REGIONS,
  UNDERTONES,
} from '../../data/customization'
import { TATTOO_STYLE_LABEL, TATTOOS, tattooCanvas } from '../../data/tattoos'
import { applyProcedure, wearItem } from '../../shared/appearance'
import { getItem, isStarterItem } from '../../shared/catalog'
import { CLINIC_PROCEDURES, PIERCING_PRICE, TATTOO_PRICE, TEMP_TATTOO_PRICE } from '../../shared/economy'
import type {
  Appearance,
  CatalogItem,
  DollDoc,
  FacePreset,
  HairStyleId,
  OutfitSlot,
  Piercing,
  PiercingSide,
  SavedHairLook,
  Tattoo,
  TattooRegion,
  TattooStyle,
} from '../../shared/types'
import { buttonClass, cx, inputClass } from '../../lib/ui'
import { useAppStore } from '../../store/useAppStore'
import { AvatarArt } from '../art/DollAvatar'
import { ItemThumb } from '../art/ItemThumb'
import { Icon } from '../Icon'
import { ChoiceChips, MultiChips, Section, Select, Slider, Swatches, Toggle } from '../Swatches'
import { BodyMap } from './BodyMap'

export const CUSTOMIZER_TABS = [
  'Skin',
  'Face',
  'Eyes & brows',
  'Hair',
  'Makeup',
  'Facial hair',
  'Nails',
  'Piercings',
  'Tattoos',
  'Body',
  'Outfit',
  'Identity',
  'Beauty Studio',
] as const
export type CustomizerTab = (typeof CUSTOMIZER_TABS)[number]

/** Rail glyphs, short labels and a little personality per category. */
const TAB_META: Record<CustomizerTab, { emoji: string; short: string; tagline: string }> = {
  Skin: { emoji: '🤎', short: 'Skin', tagline: 'Every shade, every glow.' },
  Face: { emoji: '🙂', short: 'Face', tagline: 'Cheekbones for days.' },
  'Eyes & brows': { emoji: '👁️', short: 'Eyes', tagline: 'The stare that ends arguments.' },
  Hair: { emoji: '💇🏾‍♀️', short: 'Hair', tagline: 'Braids, wigs, edges: your crown.' },
  Makeup: { emoji: '💄', short: 'Makeup', tagline: 'Beat it to the gods.' },
  'Facial hair': { emoji: '🧔🏾', short: 'Beard', tagline: 'Shape-up or full fluff.' },
  Nails: { emoji: '💅🏾', short: 'Nails', tagline: 'Long, short, chrome, choose.' },
  Piercings: { emoji: '💎', short: 'Pierce', tagline: 'A little bling never hurt.' },
  Tattoos: { emoji: '🖋️', short: 'Ink', tagline: 'Tell your story in ink.' },
  Body: { emoji: '🍑', short: 'Body', tagline: 'Every body is a doll body.' },
  Outfit: { emoji: '👗', short: 'Outfit', tagline: 'Fit check, please.' },
  Identity: { emoji: '🪪', short: 'You', tagline: 'Who your doll is, inside.' },
  'Beauty Studio': { emoji: '💉', short: 'Clinic', tagline: 'Optional tweaks, previewed first.' },
}

/** Accept old deep links (e.g. ?tab=Clinic). */
export function tabFromParam(v: string | null): CustomizerTab | null {
  if (v === 'Clinic') return 'Beauty Studio'
  return (CUSTOMIZER_TABS as readonly string[]).includes(v ?? '') ? (v as CustomizerTab) : null
}

export interface CustomizerProps {
  value: Appearance
  onChange: (next: Appearance, key?: string) => void
  tab: CustomizerTab
  onTab: (t: CustomizerTab) => void
  mode: 'onboarding' | 'edit'
  owned: Record<string, number>
  hairLooks: SavedHairLook[]
  onHairLooks: (looks: SavedHairLook[]) => void
  complexions: DollDoc['complexionPresets']
  onComplexions: (p: DollDoc['complexionPresets']) => void
  facePresets: FacePreset[]
  onFacePresets: (p: FacePreset[]) => void
  /** The look to go back to with "Reset category". */
  initial: Appearance
}

const uid = () => Math.random().toString(36).slice(2, 10)

/** Which parts of the appearance each tab owns, for "Reset category". */
function resetCategory(tab: CustomizerTab, a: Appearance, init: Appearance): Appearance {
  switch (tab) {
    case 'Skin':
      return { ...a, skin: init.skin }
    case 'Face':
      return { ...a, face: { ...init.face, eyeColor: a.face.eyeColor } }
    case 'Eyes & brows':
      return { ...a, face: { ...a.face, eyeColor: init.face.eyeColor }, makeup: { ...a.makeup, brows: init.makeup.brows, lashes: init.makeup.lashes }, outfit: { ...a.outfit, eyewear: init.outfit.eyewear } }
    case 'Hair':
      return { ...a, hair: init.hair }
    case 'Makeup':
      return { ...a, makeup: { ...init.makeup, brows: a.makeup.brows } }
    case 'Facial hair':
      return { ...a, facialHair: init.facialHair }
    case 'Nails':
      return { ...a, nails: init.nails }
    case 'Piercings':
      return { ...a, piercings: init.piercings }
    case 'Tattoos':
      return { ...a, tattoos: init.tattoos }
    case 'Body':
      return { ...a, body: init.body, base: init.base }
    case 'Outfit':
      return { ...a, outfit: init.outfit }
    case 'Identity':
      return { ...a, identity: init.identity }
    case 'Beauty Studio':
      return { ...a, face: init.face, body: init.body, skin: { ...a.skin, glow: init.skin.glow }, clinic: init.clinic }
  }
}

/** Every customization panel. Pure: the parent owns state, history and saving. */
export function Customizer(props: CustomizerProps) {
  const { value: a, onChange, tab, onTab, mode } = props
  const showClinic = useAppStore((s) => s.showClinic)
  const tabs = CUSTOMIZER_TABS.filter((t) => t !== 'Beauty Studio' || (mode === 'edit' && ENABLE_CLINIC && showClinic))
  const set = (patch: Partial<Appearance>, key?: string) => onChange({ ...a, ...patch }, key)

  return (
    <div className="flex min-h-0 flex-1">
      {/* icon rail: every category one tap away */}
      <div role="tablist" aria-label="Customize" aria-orientation="vertical" className="no-scrollbar flex w-[62px] shrink-0 flex-col gap-1 overflow-y-auto border-r border-dashed border-primary/30 bg-[radial-gradient(circle_at_50%_0,rgb(255_46_136/0.12),transparent_70%)] px-1.5 py-2.5">
        {tabs.map((t) => (
          <button
            key={t}
            role="tab"
            type="button"
            aria-selected={tab === t}
            aria-label={t}
            title={t}
            onClick={() => onTab(t)}
            className={cx(
              'group flex shrink-0 flex-col items-center gap-0.5 rounded-2xl px-0.5 py-1.5 transition-all duration-200',
              tab === t ? 'bg-primary text-ink shadow-[0_6px_18px_-6px_rgb(255_46_136/0.8)]' : 'text-muted-foreground hover:bg-muted active:scale-90',
            )}
          >
            <span aria-hidden className={cx('text-xl leading-none transition-transform', tab === t ? 'scale-110 -rotate-6' : 'group-hover:scale-110')}>
              {TAB_META[t].emoji}
            </span>
            <span className="w-full truncate text-center text-[9.5px] leading-tight font-bold">{TAB_META[t].short}</span>
          </button>
        ))}
      </div>
      <div role="tabpanel" aria-label={tab} className="flex min-h-0 min-w-0 flex-1 flex-col gap-6 overflow-y-auto overscroll-contain px-3.5 pt-3 pb-8">
        <div key={tab} className="-mb-2 flex items-start justify-between gap-2 motion-safe:animate-[loader-in_.25s_ease-out]">
          <div className="min-w-0">
            <h2 className="flex items-center gap-1.5 font-display text-lg leading-tight font-black">
              <span aria-hidden>{TAB_META[tab].emoji}</span> {tab}
            </h2>
            <p className="text-xs text-muted-foreground italic">{TAB_META[tab].tagline}</p>
          </div>
          <button type="button" className="shrink-0 rounded-full border border-dashed border-border px-2.5 py-1 text-[11px] font-semibold text-muted-foreground hover:border-primary hover:text-primary" onClick={() => onChange(resetCategory(tab, a, props.initial))}>
            <Icon name="reset" className="mr-1 inline size-3" />
            Reset
          </button>
        </div>
        {tab === 'Skin' && <SkinPanel {...props} set={set} />}
        {tab === 'Face' && <FacePanel {...props} set={set} />}
        {tab === 'Eyes & brows' && <EyesPanel a={a} set={set} owned={props.owned} />}
        {tab === 'Body' && <BodyPanel a={a} set={set} />}
        {tab === 'Hair' && <HairPanel {...props} set={set} />}
        {tab === 'Makeup' && <MakeupPanel a={a} set={set} owned={props.owned} />}
        {tab === 'Facial hair' && <FacialHairPanel a={a} set={set} />}
        {tab === 'Nails' && <NailsPanel a={a} set={set} owned={props.owned} />}
        {tab === 'Piercings' && <PiercingsPanel a={a} set={set} mode={mode} />}
        {tab === 'Tattoos' && <TattoosPanel a={a} set={set} mode={mode} />}
        {tab === 'Outfit' && <OutfitPanel a={a} set={set} owned={props.owned} mode={mode} />}
        {tab === 'Identity' && <IdentityPanel a={a} set={set} />}
        {tab === 'Beauty Studio' && <ClinicPanel a={a} set={set} />}
      </div>
    </div>
  )
}

type SetFn = (patch: Partial<Appearance>, key?: string) => void

function SkinPanel({ value: a, complexions, onComplexions, set }: CustomizerProps & { set: SetFn }) {
  const [name, setName] = useState('')
  return (
    <>
      {SKIN_GROUPS.map((g) => (
        <Swatches key={g.label} label={`${g.label} tones`} colors={g.tones} value={a.skin.tone} onChange={(tone) => set({ skin: { ...a.skin, tone } })} custom={g.label === 'Light'} />
      ))}
      <ChoiceChips label="Undertone" options={UNDERTONES} value={a.skin.undertone} onChange={(undertone) => set({ skin: { ...a.skin, undertone } })} />
      <Slider label="Glow" value={a.skin.glow} onChange={(glow) => set({ skin: { ...a.skin, glow } }, 'glow')} />
      <Toggle
        label="Separate face complexion"
        hint="Match foundation or show natural variation."
        checked={a.skin.faceTone !== null}
        onChange={(on) => set({ skin: { ...a.skin, faceTone: on ? a.skin.tone : null } })}
      />
      {a.skin.faceTone !== null && (
        <Swatches label="Face tone" colors={SKIN_GROUPS.flatMap((g) => g.tones)} value={a.skin.faceTone} onChange={(faceTone) => set({ skin: { ...a.skin, faceTone } })} custom />
      )}
      <Section title="Marks & texture">
        {SKIN_MARKS.map((m) => {
          const v = a.skin.marks[m.id] ?? 0
          return (
            <div key={m.id} className="flex flex-col gap-1">
              <Toggle label={m.label} checked={v > 0} onChange={(on) => set({ skin: { ...a.skin, marks: { ...a.skin.marks, [m.id]: on ? 0.5 : 0 } } })} />
              {v > 0 && <Slider label={`${m.label} intensity`} value={v} onChange={(n) => set({ skin: { ...a.skin, marks: { ...a.skin.marks, [m.id]: Math.max(0.05, n) } } }, `mark-${m.id}`)} />}
            </div>
          )
        })}
      </Section>
      <Section title="Complexion presets">
        <div className="flex gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name this complexion" maxLength={24} className={inputClass} />
          <button
            type="button"
            className={buttonClass('secondary', 'md')}
            disabled={!name.trim() || complexions.length >= 8}
            onClick={() => {
              onComplexions([...complexions, { id: uid(), name: name.trim(), tone: a.skin.tone, undertone: a.skin.undertone, faceTone: a.skin.faceTone }])
              setName('')
            }}
          >
            Save
          </button>
        </div>
        {complexions.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {complexions.map((c) => (
              <li key={c.id} className="flex items-center gap-1 rounded-full border border-border bg-background py-1 pr-1 pl-1.5">
                <button type="button" className="flex items-center gap-2 text-sm font-semibold" onClick={() => set({ skin: { ...a.skin, tone: c.tone, undertone: c.undertone, faceTone: c.faceTone } })}>
                  <span className="size-6 rounded-full" style={{ background: c.tone }} />
                  {c.name}
                </button>
                <button type="button" aria-label={`Delete ${c.name}`} className="grid size-8 place-items-center rounded-full hover:bg-muted" onClick={() => onComplexions(complexions.filter((x) => x.id !== c.id))}>
                  <Icon name="close" className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  )
}

function FacePanel({ value: a, set, facePresets, onFacePresets }: CustomizerProps & { set: SetFn }) {
  const [name, setName] = useState('')
  return (
    <>
      <ChoiceChips
        label="Face shape"
        options={FACE_PRESETS.map((p) => ({ id: p.id, label: p.label }))}
        value={a.face.preset}
        onChange={(id) => set({ face: { ...a.face, ...FACE_PRESETS.find((p) => p.id === id)!.face, preset: id } })}
      />
      {FACE_SLIDERS.map((s) => (
        <Slider key={s.key} label={s.label} value={a.face[s.key] as number} onChange={(v) => set({ face: { ...a.face, [s.key]: v } }, `face-${s.key}`)} />
      ))}
      <Section title="Saved faces">
        <p className="-mt-2 text-sm text-muted-foreground">Saves face shape, skin and makeup together, so you can switch between a bare face and a full beat.</p>
        <div className="flex gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sunday bare face" maxLength={24} className={inputClass} />
          <button
            type="button"
            className={buttonClass('secondary', 'md')}
            disabled={!name.trim() || facePresets.length >= 8}
            onClick={() => {
              onFacePresets([...facePresets, { id: uid(), name: name.trim(), face: a.face, skin: a.skin, makeup: a.makeup }])
              setName('')
            }}
          >
            Save
          </button>
        </div>
        {facePresets.length > 0 && (
          <ul className="flex flex-col gap-2">
            {facePresets.map((f) => (
              <li key={f.id} className="flex items-center gap-3 rounded-2xl border border-border bg-background p-2 pl-3">
                <span className="size-8 shrink-0 rounded-full" style={{ background: f.skin.faceTone ?? f.skin.tone }} />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{f.name}</span>
                <button type="button" className={buttonClass('primary', 'sm')} onClick={() => set({ face: f.face, skin: f.skin, makeup: f.makeup })}>
                  Apply
                </button>
                <button type="button" aria-label={`Delete ${f.name}`} className="grid size-9 place-items-center rounded-full hover:bg-muted" onClick={() => onFacePresets(facePresets.filter((x) => x.id !== f.id))}>
                  <Icon name="trash" className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  )
}

function EyesPanel({ a, set, owned }: { a: Appearance; set: SetFn; owned: Record<string, number> }) {
  const eyewear = Object.keys(owned)
    .map((id) => getItem(id))
    .filter((i): i is CatalogItem => i?.slot === 'eyewear')
  return (
    <>
      <Swatches label="Natural eye colour" colors={EYE_COLORS} value={a.face.eyeColor} onChange={(eyeColor) => set({ face: { ...a.face, eyeColor } })} />
      <Swatches label="Coloured contacts" colors={CONTACT_COLORS} value={a.face.eyeColor} onChange={(eyeColor) => set({ face: { ...a.face, eyeColor } })} custom />
      <ChoiceChips label="Brows" options={BROWS} value={a.makeup.brows} onChange={(brows) => set({ makeup: { ...a.makeup, brows } })} />
      <Slider label="Brow height" value={a.face.brows} onChange={(brows) => set({ face: { ...a.face, brows } }, 'brow-h')} />
      <ChoiceChips label="Lashes" options={LASHES} value={a.makeup.lashes} onChange={(lashes) => set({ makeup: { ...a.makeup, lashes } })} />
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Glasses & sunglasses</legend>
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 md:-mx-6 md:px-6">
          <button
            type="button"
            aria-pressed={!a.outfit.eyewear}
            onClick={() => set({ outfit: wearItem(a.outfit, 'eyewear', null) })}
            className={cx('grid w-24 shrink-0 place-items-center rounded-2xl border-2 bg-background text-sm font-semibold', !a.outfit.eyewear ? 'border-primary' : 'border-border')}
          >
            None
          </button>
          {eyewear.map((it) => (
            <button
              key={it.id}
              type="button"
              aria-pressed={a.outfit.eyewear === it.id}
              onClick={() => set({ outfit: wearItem(a.outfit, 'eyewear', it.id) })}
              className={cx('w-24 shrink-0 overflow-hidden rounded-2xl border-2 bg-background text-left', a.outfit.eyewear === it.id ? 'border-primary' : 'border-border')}
            >
              <span className="block aspect-square">
                <ItemThumb item={it} />
              </span>
              <span className="line-clamp-2 px-2 py-1 text-[11px] leading-tight font-semibold">{it.name}</span>
            </button>
          ))}
        </div>
      </fieldset>
    </>
  )
}

function FacialHairPanel({ a, set }: { a: Appearance; set: SetFn }) {
  const fh = a.facialHair
  return (
    <>
      <p className="text-sm text-muted-foreground">Available on every body and face. No gender lock.</p>
      <ChoiceChips label="Style" options={FACIAL_HAIR} value={fh.style} onChange={(style) => set({ facialHair: { ...fh, style } })} />
      {fh.style !== 'none' && (
        <>
          <Swatches label="Colour" colors={HAIR_COLORS.slice(0, 11)} value={fh.color} onChange={(color) => set({ facialHair: { ...fh, color } })} custom />
          <Slider label="Density" value={fh.density} onChange={(density) => set({ facialHair: { ...fh, density } }, 'fh-d')} />
        </>
      )}
    </>
  )
}

function BodyPanel({ a, set }: { a: Appearance; set: SetFn }) {
  return (
    <>
      <ChoiceChips
        label="Body type"
        options={BODY_PRESETS.map((p) => ({ id: p.id, label: p.label }))}
        value={a.body.preset}
        onChange={(id) => set({ body: { ...a.body, ...BODY_PRESETS.find((p) => p.id === id)!.body, preset: id } })}
      />
      <ChoiceChips
        label="Base frame"
        options={[
          { id: 'feminine', label: 'Feminine' },
          { id: 'androgynous', label: 'Androgynous' },
          { id: 'masculine', label: 'Masculine' },
        ]}
        value={a.base}
        onChange={(base) => set({ base })}
      />
      {BODY_SLIDERS.map((s) => (
        <Slider
          key={s.key}
          label={s.label}
          min={s.min}
          max={s.max}
          value={a.body[s.key] as number}
          onChange={(v) => set({ body: { ...a.body, [s.key]: v } }, `body-${s.key}`)}
        />
      ))}
    </>
  )
}

function ownedAccessories(owned: Record<string, number>): Set<string> {
  const s = new Set<string>()
  for (const id of Object.keys(owned)) {
    const u = getItem(id)?.unlock
    if (u?.kind === 'hair-accessory') s.add(u.id)
  }
  return s
}

function ownedShades(owned: Record<string, number>, kind: 'Lip' | 'Polish'): string[] {
  return Object.keys(owned)
    .map((id) => getItem(id))
    .filter((i): i is CatalogItem => !!i && i.unlock?.kind === 'shade' && i.name.startsWith(kind))
    .map((i) => (i.unlock as { color: string }).color)
}

/** Searchable hairstyle grid with drawn thumbnails in the player's own colours. */
function HairGrid({ look, skin, base, onPick }: { look: SavedHairLook | Appearance['hair']; skin: string; base: Appearance['base']; onPick: (s: HairStyleId) => void }) {
  const [q, setQ] = useState('')
  const [group, setGroup] = useState('All')
  const needle = q.trim().toLowerCase()
  const groups = HAIR_GROUPS.filter((g) => group === 'All' || g.label === group)
  return (
    <div className="flex flex-col gap-3">
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search hairstyles (locs, bob, pixie…)" className={inputClass} aria-label="Search hairstyles" />
      <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 md:-mx-6 md:px-6">
        {['All', ...HAIR_GROUPS.map((g) => g.label)].map((g) => (
          <button key={g} type="button" aria-pressed={group === g} onClick={() => setGroup(g)} className={cx('min-h-9 shrink-0 rounded-full border px-3 text-xs font-semibold', group === g ? 'border-primary bg-primary text-primary-foreground' : 'border-border')}>
            {g}
          </button>
        ))}
      </div>
      {groups.map((g) => {
        const styles = g.styles.filter((s) => !needle || s.label.toLowerCase().includes(needle) || s.id.includes(needle))
        if (!styles.length) return null
        return (
          <fieldset key={g.label}>
            <legend className="mb-2 text-sm font-semibold">{g.label}</legend>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
              {styles.map((st) => (
                <button
                  key={st.id}
                  type="button"
                  aria-pressed={look.style === st.id}
                  onClick={() => onPick(st.id)}
                  className={cx('overflow-hidden rounded-2xl border-2 bg-background text-center', look.style === st.id ? 'border-primary' : 'border-border hover:border-foreground/30')}
                >
                  <AvatarArt
                    avatar={{ base, skin, hairStyle: st.id, hairColor: look.color, hairColor2: look.dye.mode === 'solid' ? look.color : look.dye.color2, topColor: '#E0D4D0', eyeColor: '#3B2219', lipColor: '#8E3B46', accessory: null }}
                    className="aspect-square w-full"
                  />
                  <span className="block truncate px-1 py-1 text-[11px] font-semibold">{st.label}</span>
                </button>
              ))}
            </div>
          </fieldset>
        )
      })}
    </div>
  )
}

function HairPanel({ value: a, set, owned, hairLooks, onHairLooks, mode }: CustomizerProps & { set: SetFn }) {
  const h = a.hair
  const setHair = (patch: Partial<typeof h>, key?: string) => set({ hair: { ...h, ...patch } }, key)
  const accessoriesOwned = ownedAccessories(owned)
  const [lookName, setLookName] = useState('')
  return (
    <>
      <HairGrid look={h} skin={a.skin.faceTone ?? a.skin.tone} base={a.base} onPick={(style) => setHair({ style })} />
      <Slider label="Length" value={h.length} onChange={(length) => setHair({ length }, 'hair-length')} />
      <Slider label="Volume" value={h.volume} onChange={(volume) => setHair({ volume }, 'hair-volume')} />
      <ChoiceChips label="Parting" options={PARTINGS} value={h.parting} onChange={(parting) => setHair({ parting })} />
      <ChoiceChips label="Curl pattern" options={CURLS.map((c) => ({ id: c, label: c.toUpperCase() }))} value={h.curl} onChange={(curl) => setHair({ curl })} />
      <Section title="Colour & dye">
        <Swatches label="Base colour" colors={HAIR_COLORS} value={h.color} onChange={(color) => setHair({ color })} custom />
        <ChoiceChips label="Dye style" options={DYE_MODES} value={h.dye.mode} onChange={(mode) => setHair({ dye: { ...h.dye, mode } })} />
        {h.dye.mode !== 'solid' && <Swatches label="Second colour" colors={HAIR_COLORS} value={h.dye.color2} onChange={(color2) => setHair({ dye: { ...h.dye, color2 } })} custom />}
        <Slider label="Gloss / shine" value={h.dye.gloss} onChange={(gloss) => setHair({ dye: { ...h.dye, gloss } }, 'hair-gloss')} />
      </Section>
      <Section title="Edges & baby hairs">
        <ChoiceChips label="Edge style" options={EDGE_STYLES} value={h.edges.style} onChange={(style) => setHair({ edges: { ...h.edges, style } })} />
        {h.edges.style !== 'none' && (
          <>
            <Slider label="Density" value={h.edges.density} onChange={(density) => setHair({ edges: { ...h.edges, density } }, 'edge-d')} />
            <Slider label="Swirl" value={h.edges.swirl} onChange={(swirl) => setHair({ edges: { ...h.edges, swirl } }, 'edge-s')} />
          </>
        )}
      </Section>
      <Section title="Accessories" action={<Link to="/shop?cat=hair" className="text-sm font-semibold text-secondary">Get more</Link>}>
        <MultiChips
          label="Wear"
          options={HAIR_ACCESSORIES.map((x) => ({ id: x.id, label: x.label, locked: x.premium && !accessoriesOwned.has(x.id) && mode === 'edit' && !a.hair.accessories.includes(x.id) }))}
          value={h.accessories}
          onChange={(accessories) => setHair({ accessories })}
        />
        {h.accessories.length > 0 && (
          <Swatches label="Accessory colour" colors={['#FFC24D', '#D9B24C', '#FF3D8B', '#A86BFF', '#00A88F', '#E8505B', '#FFFFFF', '#1E0B26']} value={h.accessoryColor} onChange={(accessoryColor) => setHair({ accessoryColor })} custom />
        )}
      </Section>
      <Section title="Saved hair looks">
        <div className="flex gap-2">
          <input value={lookName} onChange={(e) => setLookName(e.target.value)} placeholder="e.g. Owambe braids" maxLength={24} className={inputClass} />
          <button
            type="button"
            className={buttonClass('secondary', 'md')}
            disabled={!lookName.trim() || hairLooks.length >= 12}
            onClick={() => {
              onHairLooks([...hairLooks, { ...structuredClone(h), id: uid(), name: lookName.trim() }])
              setLookName('')
            }}
          >
            Save look
          </button>
        </div>
        {hairLooks.length > 0 && (
          <ul className="flex flex-col gap-2">
            {hairLooks.map((l) => (
              <li key={l.id} className="flex items-center gap-3 rounded-2xl border border-border bg-background p-2 pl-3">
                <span className="size-8 shrink-0 rounded-full" style={{ background: `linear-gradient(${l.color}, ${l.dye.mode === 'solid' ? l.color : l.dye.color2})` }} />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{l.name}</span>
                <button type="button" className={buttonClass('primary', 'sm')} onClick={() => setHair({ ...l })}>
                  Wear
                </button>
                <button type="button" aria-label={`Delete ${l.name}`} className="grid size-9 place-items-center rounded-full hover:bg-muted" onClick={() => onHairLooks(hairLooks.filter((x) => x.id !== l.id))}>
                  <Icon name="trash" className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  )
}

function MakeupPanel({ a, set, owned }: { a: Appearance; set: SetFn; owned: Record<string, number> }) {
  const m = a.makeup
  const setM = (patch: Partial<typeof m>, key?: string) => set({ makeup: { ...m, ...patch } }, key)
  const lips = [...LIP_SHADES, ...ownedShades(owned, 'Lip')]
  return (
    <>
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Looks</legend>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {MAKEUP_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={m.preset === p.id}
              onClick={() => setM({ ...p.makeup, preset: p.id })}
              className={cx('flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl border-2 bg-background px-2 text-xs font-semibold', m.preset === p.id ? 'border-primary' : 'border-border')}
            >
              <span className="flex gap-0.5" aria-hidden>
                {[p.makeup.eyeshadow ?? '#E0D4D0', p.makeup.lipstick ?? '#C9A08A', p.makeup.blush ?? '#E0D4D0'].map((c, i) => (
                  <span key={i} className="size-3 rounded-full border border-border" style={{ background: c }} />
                ))}
              </span>
              {p.label}
            </button>
          ))}
        </div>
      </fieldset>
      <Slider label="Foundation coverage" value={m.foundation} onChange={(foundation) => setM({ foundation }, 'mk-f')} />
      <Swatches label="Lipstick" colors={lips} value={m.lipstick} onChange={(lipstick) => setM({ lipstick })} allowNone onNone={() => setM({ lipstick: null })} custom />
      <Swatches label="Lip liner" colors={LINER_SHADES} value={m.lipLiner} onChange={(lipLiner) => setM({ lipLiner })} allowNone onNone={() => setM({ lipLiner: null })} custom />
      <Slider label="Gloss" value={m.gloss} onChange={(gloss) => setM({ gloss }, 'mk-g')} />
      <Swatches label="Blush" colors={BLUSH_SHADES} value={m.blush} onChange={(blush) => setM({ blush })} allowNone onNone={() => setM({ blush: null })} />
      {m.blush && <Slider label="Blush amount" value={m.blushAmount} onChange={(blushAmount) => setM({ blushAmount }, 'mk-b')} />}
      <Slider label="Contour" value={m.contour} onChange={(contour) => setM({ contour }, 'mk-c')} />
      <Slider label="Highlight" value={m.highlight} onChange={(highlight) => setM({ highlight }, 'mk-h')} />
      <Swatches label="Eyeshadow" colors={SHADOW_SHADES} value={m.eyeshadow} onChange={(eyeshadow) => setM({ eyeshadow })} allowNone onNone={() => setM({ eyeshadow: null })} custom />
      <ChoiceChips label="Eyeliner" options={EYELINERS} value={m.eyeliner} onChange={(eyeliner) => setM({ eyeliner })} />
      <ChoiceChips label="Special look" options={SPECIAL_LOOKS} value={m.look} onChange={(look) => setM({ look })} />
    </>
  )
}

function NailsPanel({ a, set, owned }: { a: Appearance; set: SetFn; owned: Record<string, number> }) {
  const n = a.nails
  const setN = (patch: Partial<typeof n>, key?: string) => set({ nails: { ...n, ...patch } }, key)
  return (
    <>
      <ChoiceChips label="Shape" options={NAIL_SHAPES} value={n.shape} onChange={(shape) => setN({ shape })} />
      <Slider label="Length" value={n.length} onChange={(length) => setN({ length }, 'nail-len')} />
      <Swatches label="Colour" colors={[...NAIL_SHADES, ...ownedShades(owned, 'Polish')]} value={n.color} onChange={(color) => setN({ color })} custom />
      <ChoiceChips label="Pattern" options={NAIL_PATTERNS} value={n.pattern} onChange={(pattern) => setN({ pattern })} />
      <Toggle label="Charms" checked={n.charms} onChange={(charms) => setN({ charms })} />
    </>
  )
}

const ALL_SITES = PIERCING_GROUPS.flatMap((g) => g.sites)
const siteLabel = (id: string) => ALL_SITES.find((s) => s.id === id)?.label ?? id

function PiercingsPanel({ a, set, mode }: { a: Appearance; set: SetFn; mode: 'onboarding' | 'edit' }) {
  const [selected, setSelected] = useState<string | null>(a.piercings[0]?.id ?? null)
  const sel = a.piercings.find((p) => p.id === selected) ?? null
  const update = (p: Piercing) => set({ piercings: a.piercings.map((x) => (x.id === p.id ? p : x)) })
  const add = (site: Piercing['site']) => {
    const p: Piercing = { id: uid(), site, side: 'left', jewellery: site.startsWith('lobe') ? 'stud' : 'hoop', metal: 'gold', gem: 'none', size: 0.4 }
    set({ piercings: [...a.piercings, p] })
    setSelected(p.id)
  }
  const centred = sel && ['septum', 'bridge', 'labret', 'medusa', 'smiley', 'tongue', 'navel', 'surface', 'snake-bites'].includes(sel.site)
  return (
    <>
      {mode === 'edit' && <p className="rounded-2xl bg-muted px-4 py-3 text-sm">Studio price: {PIERCING_PRICE} Glam per new piercing. You pay when you save.</p>}
      {PIERCING_GROUPS.map((g) => (
        <fieldset key={g.label}>
          <legend className="mb-2 text-sm font-semibold">Add {g.label.toLowerCase()} piercing</legend>
          <div className="flex flex-wrap gap-2">
            {g.sites.map((s) => (
              <button key={s.id} type="button" onClick={() => add(s.id)} className="inline-flex min-h-10 items-center gap-1 rounded-full border border-border bg-background px-3 text-sm font-semibold hover:bg-muted">
                <Icon name="plus" className="size-3.5" /> {s.label}
              </button>
            ))}
          </div>
        </fieldset>
      ))}
      {a.piercings.length > 0 && (
        <Section title={`Your piercings (${a.piercings.length})`}>
          <ul className="flex flex-wrap gap-2">
            {a.piercings.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  aria-pressed={p.id === selected}
                  onClick={() => setSelected(p.id)}
                  className={cx('min-h-10 rounded-full border px-3 text-sm font-semibold', p.id === selected ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background')}
                >
                  {siteLabel(p.site)} · {p.side === 'both' ? 'both' : p.side[0].toUpperCase()}
                </button>
              </li>
            ))}
          </ul>
        </Section>
      )}
      {sel && (
        <Section
          title={`Edit ${siteLabel(sel.site)}`}
          action={
            <button
              type="button"
              className={buttonClass('ghost', 'sm', 'text-[#B3123F]')}
              onClick={() => {
                set({ piercings: a.piercings.filter((x) => x.id !== sel.id) })
                setSelected(null)
              }}
            >
              <Icon name="trash" className="size-4" /> Remove
            </button>
          }
        >
          {!centred && (
            <ChoiceChips<PiercingSide>
              label="Side"
              options={[
                { id: 'left', label: 'Left' },
                { id: 'right', label: 'Right' },
                { id: 'both', label: 'Both' },
              ]}
              value={sel.side}
              onChange={(side) => update({ ...sel, side })}
            />
          )}
          <ChoiceChips label="Jewellery" options={JEWELLERY} value={sel.jewellery} onChange={(jewellery) => update({ ...sel, jewellery })} />
          <ChoiceChips label="Metal" options={METALS} value={sel.metal} onChange={(metal) => update({ ...sel, metal })} />
          <ChoiceChips label="Gem" options={GEMS} value={sel.gem} onChange={(gem) => update({ ...sel, gem })} />
          <Slider label="Size" value={sel.size} onChange={(size) => update({ ...sel, size })} />
        </Section>
      )}
    </>
  )
}

const TATTOO_STYLES = Object.keys(TATTOO_STYLE_LABEL) as TattooStyle[]
const previewCache = new Map<string, string>()
function preview(id: string): string {
  let url = previewCache.get(id)
  if (!url) {
    url = tattooCanvas(id, '#1E0B26', 128).toDataURL()
    previewCache.set(id, url)
  }
  return url
}

function TattoosPanel({ a, set, mode }: { a: Appearance; set: SetFn; mode: 'onboarding' | 'edit' }) {
  const [region, setRegion] = useState<TattooRegion>(a.tattoos[0]?.region ?? 'forearm-l')
  const [style, setStyle] = useState<TattooStyle | 'all'>('all')
  const [selected, setSelected] = useState<string | null>(a.tattoos[0]?.id ?? null)
  const sel = a.tattoos.find((t) => t.id === selected) ?? null
  const update = (t: Tattoo) => set({ tattoos: a.tattoos.map((x) => (x.id === t.id ? t : x)) })
  const designs = TATTOOS.filter((t) => style === 'all' || t.style === style)
  const regionLabel = TATTOO_REGIONS.flatMap((g) => g.regions).find((r) => r.id === region)?.label ?? region
  const add = (design: string) => {
    const d = TATTOOS.find((t) => t.id === design)!
    const temporary = d.style === 'henna' || d.style === 'body-paint'
    const t: Tattoo = {
      id: uid(),
      region,
      design,
      size: 0.55,
      rotation: 0,
      opacity: 0.92,
      mirror: false,
      color: d.style === 'henna' ? '#8B3A1A' : d.style === 'body-paint' ? '#FFFFFF' : null,
      layer: a.tattoos.filter((x) => x.region === region).length,
      temporary,
    }
    set({ tattoos: [...a.tattoos, t] })
    setSelected(t.id)
  }
  return (
    <>
      {mode === 'edit' && (
        <p className="rounded-2xl bg-muted px-4 py-3 text-sm">
          Studio price: {TATTOO_PRICE} Glam per tattoo, {TEMP_TATTOO_PRICE} for henna or body paint.
        </p>
      )}
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div>
          <p className="mb-2 text-sm font-semibold">Placement: {regionLabel}</p>
          <BodyMap value={region} used={a.tattoos.map((t) => t.region)} onPick={setRegion} />
        </div>
        <div className="flex flex-col gap-3">
          <ChoiceChips label="Style" options={[{ id: 'all' as const, label: 'All' }, ...TATTOO_STYLES.map((s) => ({ id: s, label: TATTOO_STYLE_LABEL[s] }))]} value={style} onChange={setStyle} />
        </div>
      </div>
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Add to {regionLabel.toLowerCase()}</legend>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
          {designs.map((d) => (
            <button key={d.id} type="button" onClick={() => add(d.id)} className="flex flex-col items-center gap-1 rounded-2xl border border-border bg-background p-2 text-[11px] font-semibold hover:border-primary">
              <img src={preview(d.id)} alt="" className="size-12 dark:invert" />
              <span className="line-clamp-1">{d.name}</span>
            </button>
          ))}
        </div>
      </fieldset>
      {a.tattoos.length > 0 && (
        <Section title={`Your ink (${a.tattoos.length})`}>
          <ul className="flex flex-wrap gap-2">
            {a.tattoos.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  aria-pressed={t.id === selected}
                  onClick={() => {
                    setSelected(t.id)
                    setRegion(t.region)
                  }}
                  className={cx('flex min-h-10 items-center gap-2 rounded-full border px-2 pr-3 text-sm font-semibold', t.id === selected ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background')}
                >
                  <img src={preview(t.design)} alt="" className="size-7 rounded-full bg-white" />
                  {TATTOOS.find((x) => x.id === t.design)?.name}
                </button>
              </li>
            ))}
          </ul>
        </Section>
      )}
      {sel && (
        <Section
          title="Adjust"
          action={
            <button
              type="button"
              className={buttonClass('ghost', 'sm', 'text-[#B3123F]')}
              onClick={() => {
                set({ tattoos: a.tattoos.filter((x) => x.id !== sel.id) })
                setSelected(null)
              }}
            >
              <Icon name="trash" className="size-4" /> Remove
            </button>
          }
        >
          <Slider label="Size" value={sel.size} onChange={(size) => update({ ...sel, size })} />
          <Slider label="Rotation" min={-180} max={180} step={1} value={sel.rotation} onChange={(rotation) => update({ ...sel, rotation })} format={(v) => `${Math.round(v)}°`} />
          <Slider label="Opacity" value={sel.opacity} onChange={(opacity) => update({ ...sel, opacity })} />
          <Toggle label="Mirror" hint="Copy to the other side, or flip centred pieces." checked={sel.mirror} onChange={(mirror) => update({ ...sel, mirror })} />
          <Toggle label="Temporary (henna / paint)" checked={sel.temporary} onChange={(temporary) => update({ ...sel, temporary })} />
          <Swatches
            label="Ink"
            colors={['#1E0B26', '#8B3A1A', '#B00020', '#00A88F', '#3D7BFF', '#A86BFF', '#FFC24D', '#FFFFFF']}
            value={sel.color}
            onChange={(color) => update({ ...sel, color })}
            allowNone
            onNone={() => update({ ...sel, color: null })}
          />
          <p className="-mt-2 text-xs text-muted-foreground">“None” renders black and grey.</p>
          <div className="flex gap-2">
            <button type="button" className={buttonClass('secondary', 'sm')} onClick={() => update({ ...sel, layer: sel.layer - 1 })}>
              Send back
            </button>
            <button type="button" className={buttonClass('secondary', 'sm')} onClick={() => update({ ...sel, layer: sel.layer + 1 })}>
              Bring forward
            </button>
          </div>
        </Section>
      )}
    </>
  )
}

const SLOT_LABEL: Record<OutfitSlot, string> = {
  top: 'Tops',
  bottom: 'Bottoms',
  dress: 'Dresses & sets',
  outerwear: 'Outerwear',
  shoes: 'Shoes',
  bag: 'Bags',
  headwear: 'Headwear & gele',
  eyewear: 'Eyewear',
  earrings: 'Earrings',
  necklace: 'Necklaces & beads',
  bracelet: 'Bracelets & watches',
  swimwear: 'Swimwear',
  belt: 'Belts',
}

function OutfitPanel({ a, set, owned, mode }: { a: Appearance; set: SetFn; owned: Record<string, number>; mode: 'onboarding' | 'edit' }) {
  const bySlot = useMemo(() => {
    const m: Partial<Record<OutfitSlot, CatalogItem[]>> = {}
    for (const id of Object.keys(owned)) {
      const it = getItem(id)
      if (!it?.slot) continue
      if (mode === 'onboarding' && !isStarterItem(id)) continue
      ;(m[it.slot] ??= []).push(it)
    }
    return m
  }, [owned, mode])
  return (
    <>
      <p className="text-sm text-muted-foreground">
        {mode === 'onboarding' ? 'Start with free basics. The shop has the rest.' : 'Everything you own. Tap to wear, tap again to take off.'}{' '}
        <Link to="/shop" className="font-semibold text-secondary">
          Go shopping
        </Link>
      </p>
      {(Object.keys(SLOT_LABEL) as OutfitSlot[])
        .filter((s) => bySlot[s]?.length)
        .map((slot) => (
          <fieldset key={slot}>
            <legend className="mb-2 text-sm font-semibold">{SLOT_LABEL[slot]}</legend>
            <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 md:-mx-6 md:px-6">
              {bySlot[slot]!.map((it) => {
                const worn = a.outfit[slot] === it.id
                return (
                  <button
                    key={it.id}
                    type="button"
                    aria-pressed={worn}
                    onClick={() => set({ outfit: wearItem(a.outfit, slot, worn ? null : it.id) })}
                    className={cx('w-24 shrink-0 overflow-hidden rounded-2xl border-2 bg-background text-left', worn ? 'border-primary' : 'border-border')}
                  >
                    <span className="block aspect-square">
                      <ItemThumb item={it} />
                    </span>
                    <span className="line-clamp-2 px-2 py-1 text-[11px] leading-tight font-semibold">{it.name}</span>
                  </button>
                )
              })}
            </div>
          </fieldset>
        ))}
    </>
  )
}

function IdentityPanel({ a, set }: { a: Appearance; set: SetFn }) {
  const id = a.identity
  const opts = (xs: string[]) => xs.map((x) => ({ value: x, label: x || 'Not set' }))
  const setI = (patch: Partial<typeof id>) => set({ identity: { ...id, ...patch } })
  return (
    <>
      <p className="text-sm text-muted-foreground">All optional. Change any time. Only pronouns show on your public card.</p>
      <Select label="Pronouns" value={id.pronouns} options={opts(PRONOUNS)} onChange={(pronouns) => setI({ pronouns })} />
      <Select label="Gender expression" value={id.genderExpression} options={opts(GENDER_EXPRESSIONS)} onChange={(genderExpression) => setI({ genderExpression })} />
      <Select label="Sexual orientation" value={id.orientation} options={opts(ORIENTATIONS)} onChange={(orientation) => setI({ orientation })} />
      <Select label="Dating preference" value={id.datingPreference} options={opts(DATING_PREFS)} onChange={(datingPreference) => setI({ datingPreference })} />
    </>
  )
}

function ClinicPanel({ a, set }: { a: Appearance; set: SetFn }) {
  return (
    <>
      <p className="rounded-2xl bg-muted px-4 py-3 text-sm">
        The Beauty Studio is fictional, optional and for adult avatars only. You never need treatments to look good: natural looks are just as detailed and earn the same rewards. Every change previews live, costs are shown up front, you pay only when you save, and you can undo or reset before then.
      </p>
      <ul className="flex flex-col gap-3">
        {CLINIC_PROCEDURES.map((p) => {
          const booked = a.clinic.filter((c) => c === p.id).length
          return (
            <li key={p.id} className="flex items-center gap-3 rounded-2xl border border-border bg-background p-3">
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{p.name}</span>
                <span className="block text-sm text-muted-foreground">
                  {p.blurb} · {p.price} Glam{booked ? ` · booked ×${booked}` : ''}
                </span>
              </span>
              <button
                type="button"
                className={buttonClass('secondary', 'sm')}
                onClick={() => set(applyProcedure(a, p))}
              >
                Book
              </button>
            </li>
          )
        })}
      </ul>
    </>
  )
}
