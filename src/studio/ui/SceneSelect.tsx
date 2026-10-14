import { useEffect, useState } from 'react'
import { preloadScenes, SCENE_BY_ID, SCENES, type SceneDef, type SceneId, type TimeOfDay, type Weather } from '../scenes'
import { useRealtime } from '../net/realtime'
import { useStudio } from '../state/store'
import { Arrow3D } from './Arrow3D'
import { validChoice } from './ScenePicker'
import { click } from './sound'

const TIME_NAMES: Record<TimeOfDay, string> = { morning: 'Morning', golden: 'Golden hour', night: 'Night' }
const WEATHER_NAMES: Record<Weather, string> = { clear: 'Clear', breeze: 'Breezy', rain: 'Rain', snow: 'Snow', fog: 'Misty', leaves: 'Falling leaves' }
/** Each light and weather as a little painted swatch (sky gradient + a glyph). */
const SWATCH: Record<TimeOfDay | Weather, { bg: string; glyph: string }> = {
  morning: { bg: 'linear-gradient(160deg,#bfe3ff,#ffe9c7)', glyph: 'M12 4v2M4 12h2M18 12h2M6.3 6.3l1.4 1.4M17.7 6.3l-1.4 1.4M8 15a4 4 0 0 1 8 0M4 18h16' },
  golden: { bg: 'linear-gradient(160deg,#ffb36b,#ff7a8a 60%,#7a5ab8)', glyph: 'M7 16a5 5 0 0 1 10 0M3 19h18M12 6v2M5.6 9.6 7 11M18.4 9.6 17 11' },
  night: { bg: 'linear-gradient(160deg,#1a2350,#3b2a6b)', glyph: 'M16.5 14.5A6 6 0 0 1 9.5 7.5a6 6 0 1 0 7 7Z M17 5l.5 1 1 .5-1 .5-.5 1-.5-1-1-.5 1-.5Z' },
  clear: { bg: 'linear-gradient(160deg,#7fc3ff,#d8efff)', glyph: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z M12 3v2M12 19v2M3 12h2M19 12h2' },
  breeze: { bg: 'linear-gradient(160deg,#a8e0d8,#e6f6f2)', glyph: 'M3 9h11a2.5 2.5 0 1 0-2.5-2.5M3 13h15a2.5 2.5 0 1 1-2.5 2.5M3 17h8' },
  rain: { bg: 'linear-gradient(160deg,#6d7c99,#aab6cc)', glyph: 'M7 13a4 4 0 0 1 .6-8 5 5 0 0 1 9.4 2A3.5 3.5 0 0 1 17 13Z M9 16l-1 3M13 16l-1 3M17 16l-1 3' },
  snow: { bg: 'linear-gradient(160deg,#dfe9f7,#ffffff)', glyph: 'M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9' },
  fog: { bg: 'linear-gradient(160deg,#c9cdd6,#eef0f4)', glyph: 'M4 9h16M6 13h12M4 17h16' },
  leaves: { bg: 'linear-gradient(160deg,#e9a35a,#f6d6a8)', glyph: 'M6 18c0-7 5-12 12-12 0 7-5 12-12 12Z M6 18l7-7' },
}

/** Real players inside this scene right now (yourself excluded). */
function useHere(id: SceneId) {
  return useRealtime((s) => (s.status === 'live' ? (s.counts[`scene:${id}`] ?? 0) : 0))
}

function Card({ def, on, onPick }: { def: SceneDef; on: boolean; onPick: () => void }) {
  const [failed, setFailed] = useState(false)
  const here = useHere(def.id as SceneId)
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      aria-label={`${def.name}: ${here ? `${here} ${here === 1 ? 'person' : 'people'} online` : 'be the first to enter'}`}
      onClick={onPick}
      className={`pointer-events-auto relative aspect-[4/3] w-full overflow-hidden rounded-[18px] text-left transition-transform active:scale-[0.96] ${on ? 'shadow-[0_0_0_3px_#ffffff,0_0_24px_6px_rgb(255_255_255/0.4)]' : 'shadow-[0_8px_20px_rgb(5_10_30/0.45)] hover:-translate-y-0.5'}`}
      style={{ background: `linear-gradient(140deg, ${def.accent2}, ${def.accent})` }}
    >
      {!failed && <img src={def.thumbnail} alt="" loading="lazy" onError={() => setFailed(true)} className="absolute inset-0 h-full w-full object-cover" />}
      <span className={`absolute left-2 top-2 flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-extrabold backdrop-blur ${here ? 'bg-[#1fd17a]/90 text-[#062a16]' : 'bg-black/55 text-white'}`}>
        {here ? (
          <>
            <span className="h-1.5 w-1.5 rounded-full bg-[#062a16]" aria-hidden />
            {here} online
          </>
        ) : (
          'Be the first to enter'
        )}
      </span>
      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-2.5 pb-2 pt-7">
        <span className="block text-[15px] font-extrabold leading-tight text-white">{def.name}</span>
      </span>
    </button>
  )
}

/** A light or weather choice: a small painted sky with its glyph and name. */
function Mood<T extends TimeOfDay | Weather>({ value, on, label, onPick }: { value: T; on: boolean; label: string; onPick: (v: T) => void }) {
  const sw = SWATCH[value]
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={() => {
        click('tap')
        onPick(value)
      }}
      className={`pointer-events-auto flex min-h-11 items-center gap-2 rounded-2xl py-1 pl-1 pr-3.5 text-[13px] font-bold backdrop-blur transition-all active:scale-95 ${on ? 'bg-white text-[#1c2547] shadow-[0_6px_18px_rgb(0_0_0/0.35)]' : 'bg-white/15 text-white ring-1 ring-white/25 hover:bg-white/25'}`}
    >
      <span className="grid h-9 w-9 place-items-center rounded-xl shadow-inner" style={{ background: sw.bg }}>
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke={value === 'night' ? '#fff6d6' : '#2a2a40'} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d={sw.glyph} />
        </svg>
      </span>
      {label}
    </button>
  )
}

/**
 * Choose a scene: only the selections. The scene's name and dress code sit top left; the light and
 * weather are your own view (no one else sees them); every card shows who's really there right now
 * ("Be the first to enter" when no one is). The environment switches the moment a card is tapped.
 */
export function SceneSelect({ wide, loading, onBack, onGo }: { wide: boolean; loading: boolean; onBack: () => void; onGo: () => void }) {
  const scene = useStudio((s) => s.look.scene)
  const apply = useStudio((s) => s.apply)
  const sel = SCENE_BY_ID[scene.id as SceneId] ?? SCENES[0]
  const per = wide ? 5 : 3
  const pages = Math.ceil(SCENES.length / per)
  const [page, setPage] = useState(() => Math.floor(Math.max(0, SCENES.findIndex((s) => s.id === sel.id)) / per))
  useEffect(() => void preloadScenes().catch(() => {}), [])
  const set = (patch: Partial<typeof scene>) => apply((l) => void (l.scene = validChoice({ ...l.scene, ...patch })))
  const moods = (sel.times.length > 1 ? sel.times.length : 0) + (sel.weathers.length > 1 ? sel.weathers.length : 0)

  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      <div key={sel.id} className={`ds-enter absolute left-4 top-[max(env(safe-area-inset-top),14px)] max-w-[min(80vw,420px)] text-white drop-shadow-[0_3px_12px_rgb(0_0_0/0.6)] ${wide ? 'left-8 top-6' : ''}`}>
        <h1 className={`font-black tracking-tight ${wide ? 'text-[40px] leading-none' : 'text-[28px] leading-tight'}`}>{sel.name}</h1>
        <p className="mt-1.5 text-[14px] font-bold text-white/90">
          <span className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-white/70">Dress code</span> {sel.dressCode}
        </p>
      </div>

      {loading && (
        <p role="status" className="absolute inset-x-0 top-1/2 text-center text-[16px] font-extrabold text-white drop-shadow-[0_2px_8px_rgb(0_0_0/0.6)]">
          Setting the scene…
        </p>
      )}
      <div className={`absolute flex flex-col gap-3 ${wide ? 'inset-x-8 bottom-6' : 'inset-x-3 bottom-[max(env(safe-area-inset-bottom),10px)]'}`}>
        {moods > 0 && (
          <div role="radiogroup" aria-label="Your view: light and weather (only you see this)" className="flex flex-col gap-1.5">
            <span className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-white/80 drop-shadow">Your view · only you see this</span>
            <div className="ds-scroll-x flex gap-2 pb-1">
              {sel.times.length > 1 && sel.times.map((t) => <Mood key={t} value={t} on={scene.time === t} label={TIME_NAMES[t]} onPick={(time) => set({ time })} />)}
              {sel.weathers.length > 1 && sel.weathers.map((w) => <Mood key={w} value={w} on={scene.weather === w} label={WEATHER_NAMES[w]} onPick={(weather) => set({ weather })} />)}
            </div>
          </div>
        )}
        <div role="radiogroup" aria-label="Scenes" className={`grid gap-3 ${wide ? 'grid-cols-5' : 'grid-cols-3'}`}>
          {SCENES.slice(page * per, page * per + per).map((def) => (
            <Card
              key={def.id}
              def={def}
              on={def.id === sel.id}
              onPick={() => {
                click('select')
                set({ id: def.id, time: scene.time, weather: scene.weather, spot: '' })
              }}
            />
          ))}
        </div>
        <div className="flex items-center gap-3">
          <Arrow3D dir="left" label="Back to the dolls" onClick={onBack} />
          <span className="mx-1 h-8 w-px bg-white/30" aria-hidden />
          <Arrow3D dir="left" label="Previous scenes" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))} />
          <Arrow3D dir="right" label="More scenes" disabled={page >= pages - 1} onClick={() => setPage((p) => Math.min(pages - 1, p + 1))} />
          <span className="flex-1" />
          <Arrow3D dir="right" size="lg" tone="accent" label={`Go to ${sel.name}`} onClick={onGo}>
            Go
          </Arrow3D>
        </div>
      </div>
    </div>
  )
}
