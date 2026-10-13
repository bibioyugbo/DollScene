import { useMemo, useState } from 'react'
import type { StudioLook } from '../../shared/studio/look'
import { CHARACTER_PRESETS, randomDoll } from '../../shared/studio/presets'
import { url, type CharacterCatalog } from '../character/catalog'
import { useStudio } from '../state/store'
import { Arrow3D } from './Arrow3D'
import { Icon } from './icons'
import { MIN_AGE, validateName } from './onboardRules'
import { click, haptic, sfx } from './sound'

/**
 * Landing: "Pick a doll". The 3D doll fills the screen (full body, in what she's wearing); all
 * sixteen faces are visible at a glance (4 x 4, no paging, no scrolling). Picking a face puts that
 * doll on the stage in the same frame: every module is preloaded, so it's a swap, not a load.
 * "Random doll" builds a whole new one. Then a name, the 18+ confirmation, and Next to the Hub.
 */

interface Tile {
  id: string
  name: string
  blurb: string
  look: StudioLook
  thumb: string | null
}

function Portrait({ t, on, onPick, size }: { t: Tile; on: boolean; onPick: () => void; size: number }) {
  const [failed, setFailed] = useState(false)
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      aria-label={`${t.name}: ${t.blurb}`}
      title={t.name}
      onClick={onPick}
      className={`group pointer-events-auto relative overflow-hidden rounded-[18px] transition-transform duration-150 active:scale-[0.95] ${on ? 'shadow-[0_0_0_3px_#ffffff,0_0_24px_6px_rgb(255_255_255/0.45)]' : 'shadow-[0_6px_16px_rgb(5_10_30/0.35)] hover:-translate-y-0.5'}`}
      style={{ width: size, height: size, background: 'linear-gradient(180deg, #6a7da6 0%, #4a5b84 100%)' }}
    >
      {t.thumb && !failed ? (
        <img src={t.thumb} alt="" decoding="async" onError={() => setFailed(true)} className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <span className="absolute inset-0" style={{ background: `radial-gradient(circle at 50% 44%, ${t.look.skin.tone} 0 26%, ${t.look.hair.style === 'none' ? t.look.skin.tone : t.look.hair.color} 27% 40%, transparent 41%)` }} />
      )}
      <span className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#141c38]/85 to-transparent px-1 pb-1 pt-4 text-center font-extrabold text-white transition-opacity ${size < 70 ? 'text-[9px]' : 'text-[12px]'} ${on ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100'}`}>{t.name}</span>
    </button>
  )
}

export function PickDoll({ wide, size: vp, catalog, onNext }: { wide: boolean; size: { w: number; h: number }; catalog: CharacterCatalog; onNext: () => void }) {
  const look = useStudio((s) => s.look)
  const player = useStudio((s) => s.player)
  const replace = useStudio((s) => s.replace)
  const apply = useStudio((s) => s.apply)
  // a returning player's own doll keeps her place, ahead of the cast
  const [mine] = useState<StudioLook | null>(() => (look.profile.onboarded && look.profile.starter && !CHARACTER_PRESETS.some((c) => c.id === look.profile.starter && c.look.profile.name === look.profile.name) ? structuredClone(look) : null))
  const [random, setRandom] = useState<Tile | null>(null)
  const cast = useMemo<Tile[]>(() => CHARACTER_PRESETS.map((c) => ({ id: c.id, name: c.name, blurb: c.blurb, look: c.look, thumb: url.starterThumb(c.id) })), [])
  const selected = random && look.profile.starter === 'random' ? 'random' : look.profile.starter
  const cur = selected === 'random' ? random : (cast.find((t) => t.id === selected) ?? (mine ? { id: 'mine', name: mine.profile.name, blurb: 'Your doll, just as you left them.', look: mine, thumb: null } : null))
  const [name, setName] = useState((look.profile.onboarded && look.profile.name) || player?.name?.split(' ')[0] || '')
  const [adult, setAdult] = useState(false)
  const [touched, setTouched] = useState(false)
  const nameError = validateName(name)
  const ready = !!cur && !nameError && adult

  const pick = (t: Tile) => {
    click('select')
    haptic(8)
    replace({ ...t.look, profile: { ...t.look.profile, name: name.trim() || t.name, onboarded: false }, scene: look.scene })
    useStudio.getState().setFraming('full')
  }

  const rollRandom = () => {
    sfx('sparkle')
    haptic(14)
    const seed = (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0
    const p = randomDoll(seed, { hair: catalog.hair.map((h) => h.id), outfits: catalog.outfits.map((o) => o.id), shoes: catalog.shoes.map((s) => s.id) })
    const t: Tile = { id: 'random', name: p.name, blurb: p.blurb, look: p.look, thumb: null }
    setRandom(t)
    replace({ ...p.look, profile: { ...p.look.profile, name: name.trim() || p.name, onboarded: false }, scene: look.scene })
    useStudio.getState().setFraming('full')
  }

  const next = () => {
    setTouched(true)
    if (!ready) return
    apply((l) => void ((l.profile.name = name.trim()), (l.profile.onboarded = true)))
    onNext()
  }

  // sixteen faces at a glance: the grid is sized to fit, never paged or scrolled
  const cols = 4
  const gap = wide ? 10 : 6
  const tile = wide ? Math.floor(Math.min(118, (vp.h - 300) / 4, (Math.min(vp.w * 0.5, 640) - 3 * gap) / 4)) : Math.floor(Math.min(80, (vp.w - 24 - 3 * gap) / 4, (vp.h * 0.42 - 3 * gap) / 4))

  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      {cur && (
        <div key={cur.id + cur.name} className={`ds-enter absolute ${wide ? 'bottom-8 left-8 max-w-[34%]' : 'inset-x-4 top-[64px] text-center'} text-white drop-shadow-[0_2px_8px_rgb(5_10_30/0.6)]`}>
          <p className={`${wide ? 'text-[clamp(28px,4vw,44px)]' : 'text-[24px]'} font-black leading-none tracking-tight`}>{cur.name}</p>
          <p className={`mt-1 ${wide ? 'text-[15px]' : 'text-[12px]'} font-medium text-white/85`}>{cur.blurb}</p>
        </div>
      )}

      <div className={`absolute flex flex-col ${wide ? 'bottom-6 right-[3vw] top-6 justify-center gap-4' : 'inset-x-3 bottom-[max(env(safe-area-inset-bottom),8px)] gap-2.5'}`}>
        <div className={`flex items-center gap-3 ${wide ? '' : 'fixed inset-x-0 top-[max(env(safe-area-inset-top),12px)] justify-center'}`}>
          <h1 className={`font-black tracking-tight text-white drop-shadow-[0_3px_12px_rgb(5_10_30/0.5)] ${wide ? 'text-[44px] leading-none' : 'text-[30px]'}`}>Pick a doll</h1>
        </div>

        <div className="flex items-start gap-3">
          <div role="radiogroup" aria-label="Dolls" className="grid" style={{ gridTemplateColumns: `repeat(${cols}, ${tile}px)`, gap }}>
            {cast.map((t) => (
              <Portrait key={t.id} t={t} on={selected === t.id} onPick={() => pick(t)} size={tile} />
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={rollRandom}
          className={`ds-cta pointer-events-auto flex items-center justify-center gap-2 self-start rounded-full font-black ${wide ? 'min-h-12 px-5 text-[16px]' : 'min-h-10 px-4 text-[14px]'} ${selected === 'random' ? 'ring-2 ring-white' : ''}`}
        >
          <Icon name="dice" className="h-5 w-5" />
          Random doll
        </button>

        <div className="flex items-end gap-3">
          <label className="pointer-events-auto flex min-w-0 flex-1 flex-col gap-1">
            <span className="sr-only">Name your doll</span>
            <input
              value={name}
              maxLength={24}
              autoComplete="off"
              placeholder="Name your doll"
              onChange={(e) => setName(e.target.value)}
              onBlur={() => setTouched(true)}
              aria-invalid={touched && !!nameError}
              className={`${wide ? 'h-14 text-[17px]' : 'h-12 text-[15px]'} min-w-0 rounded-full bg-white/95 px-5 font-bold text-[#1c2547] shadow-[0_6px_0_#8f9cc4,0_10px_22px_rgb(5_10_30/0.4)] placeholder:font-medium placeholder:text-[#1c2547]/45 ${touched && nameError ? 'ring-2 ring-rose' : ''}`}
            />
            {touched && nameError && <span className="pl-4 text-[12px] font-bold text-[#ffd0dc]">{nameError}</span>}
          </label>
          <Arrow3D dir="right" size="lg" tone="accent" label={ready ? 'Next: to the Hub' : `Next (enter a name and confirm you are ${MIN_AGE} or older)`} disabled={!ready} onClick={next}>
            Next
          </Arrow3D>
        </div>
        <label className="pointer-events-auto flex items-center gap-2.5 text-[14px] font-bold text-white">
          <input type="checkbox" checked={adult} onChange={(e) => setAdult(e.target.checked)} className="h-5 w-5 accent-white" />I confirm I am {MIN_AGE} or older
        </label>
      </div>
    </div>
  )
}
