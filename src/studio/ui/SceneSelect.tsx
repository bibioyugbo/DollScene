import { useEffect, useState } from 'react'
import { preloadScenes, SCENE_BY_ID, SCENES, type SceneDef, type SceneId, type TimeOfDay, type Weather } from '../scenes'
import { useStudio } from '../state/store'
import { Arrow3D } from './Arrow3D'
import { validChoice } from './ScenePicker'
import { click } from './sound'

const TIME_NAMES: Record<TimeOfDay, string> = { morning: 'Morning', golden: 'Golden hour', night: 'Night' }
const WEATHER_NAMES: Record<Weather, string> = { clear: 'Clear', breeze: 'Breezy', rain: 'Rain', snow: 'Snow', fog: 'Misty', leaves: 'Falling leaves' }

function Card({ def, on, onPick }: { def: SceneDef; on: boolean; onPick: () => void }) {
  const [failed, setFailed] = useState(false)
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={onPick}
      className={`pointer-events-auto relative aspect-[4/3] w-full overflow-hidden rounded-[18px] text-left transition-transform active:scale-[0.96] ${on ? 'shadow-[0_0_0_3px_#ffffff,0_0_24px_6px_rgb(255_255_255/0.4)]' : 'shadow-[0_8px_20px_rgb(5_10_30/0.45)] hover:-translate-y-0.5'}`}
      style={{ background: `linear-gradient(140deg, ${def.accent2}, ${def.accent})` }}
    >
      {!failed && <img src={def.thumbnail} alt="" loading="lazy" onError={() => setFailed(true)} className="absolute inset-0 h-full w-full object-cover" />}
      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-2.5 pb-2 pt-7">
        <span className="block text-[15px] font-extrabold leading-tight text-white">{def.name}</span>
      </span>
    </button>
  )
}

function Pill<T extends string>({ value, on, label, onPick }: { value: T; on: boolean; label: string; onPick: (v: T) => void }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={() => {
        click('tap')
        onPick(value)
      }}
      className={`pointer-events-auto min-h-10 rounded-full px-4 text-[13px] font-bold shadow-[0_4px_0_rgb(0_0_0/0.25)] transition-transform active:translate-y-0.5 ${on ? 'bg-white text-[#1c2547]' : 'bg-black/45 text-white backdrop-blur'}`}
    >
      {label}
    </button>
  )
}

/**
 * Choose a scene: the environment behind the doll switches the moment a card is tapped; the
 * cards, pills and arrows float over the 3D scene (no panel). "Go" takes the doll there.
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

  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      <div className={`absolute ${wide ? 'left-8 top-6' : 'inset-x-0 top-[max(env(safe-area-inset-top),16px)] px-4 text-center'} text-white drop-shadow-[0_3px_12px_rgb(0_0_0/0.6)]`}>
        <h1 className={`font-black tracking-tight ${wide ? 'text-[44px] leading-none' : 'text-[32px]'}`}>Choose a scene</h1>
        <p key={sel.id} className="ds-enter mt-2 max-w-md text-[15px] font-semibold text-white/90">
          <span className="font-extrabold">{sel.name}.</span> {sel.blurb}
          <span className="mt-1 block text-[13px] font-medium text-white/75">Dress code: {sel.dressCode}</span>
        </p>
      </div>

      {loading && (
        <p role="status" className="absolute inset-x-0 top-1/2 text-center text-[16px] font-extrabold text-white drop-shadow-[0_2px_8px_rgb(0_0_0/0.6)]">
          Setting the scene…
        </p>
      )}
      <div className={`absolute flex flex-col gap-3 ${wide ? 'inset-x-8 bottom-6' : 'inset-x-3 bottom-[max(env(safe-area-inset-bottom),10px)]'}`}>
        <div role="radiogroup" aria-label="Time of day and weather" className="flex flex-wrap gap-2">
          {sel.times.length > 1 && sel.times.map((t) => <Pill key={t} value={t} on={scene.time === t} label={TIME_NAMES[t]} onPick={(time) => set({ time })} />)}
          {sel.weathers.length > 1 && sel.weathers.map((w) => <Pill key={w} value={w} on={scene.weather === w} label={WEATHER_NAMES[w]} onPick={(weather) => set({ weather })} />)}
        </div>
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
