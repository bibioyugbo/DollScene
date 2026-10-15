import { useEffect, useState } from 'react'
import type { SceneChoice } from '../../shared/studio/look'
import { preloadScenes, SCENE_BY_ID, SCENES, type SceneDef, type SceneId, type TimeOfDay, type Weather } from '../scenes'
import { Chips } from './controls'
import { Icon } from './icons'

const TIME_NAMES: Record<TimeOfDay, string> = { morning: 'Morning', golden: 'Golden hour', night: 'Night' }
const WEATHER_NAMES: Record<Weather, string> = { clear: 'Clear', breeze: 'Breezy', rain: 'Rain', snow: 'Snow', fog: 'Misty', leaves: 'Falling leaves' }

function Thumb({ def, className = '' }: { def: SceneDef; className?: string }) {
  const [failed, setFailed] = useState(false)
  return (
    <div className={`relative overflow-hidden ${className}`} style={{ background: `linear-gradient(140deg, ${def.accent2}, ${def.accent})` }}>
      {!failed && <img src={def.thumbnail} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} className="absolute inset-0 h-full w-full object-cover" />}
      {failed && (
        <span className="absolute inset-0 grid place-items-center text-white/80">
          <Icon name="scene" className="h-8 w-8" />
        </span>
      )}
    </div>
  )
}

export function sceneLabel(s: SceneChoice) {
  const def = SCENE_BY_ID[s.id as SceneId]
  if (!def) return 'Somewhere fabulous'
  return `${def.name} · ${TIME_NAMES[s.time as TimeOfDay] ?? ''}`
}

/** Normalise a choice to what the scene supports. */
export function validChoice(c: Partial<SceneChoice> & { id: string }): SceneChoice {
  const def = SCENE_BY_ID[c.id as SceneId] ?? SCENES[0]
  return {
    id: def.id,
    time: def.times.includes(c.time as TimeOfDay) ? (c.time as string) : def.defaultTime,
    weather: def.weathers.includes(c.weather as Weather) ? (c.weather as string) : def.defaultWeather,
    spot: def.photoSpots.some((p) => p.id === c.spot) ? (c.spot as string) : def.photoSpots[0]?.id ?? '',
  }
}

/**
 * Scene cards with thumbnail, story, dress code and atmosphere; the selected one opens its time
 * of day and weather. Used full-screen at the start and inside the studio (Change Scene).
 */
export function ScenePicker({ value, onPick, compact = false, cta, onConfirm, prev, onBack }: { value: SceneChoice; onPick: (c: SceneChoice) => void; compact?: boolean; cta: string; onConfirm: () => void; prev?: SceneChoice | null; onBack?: () => void }) {
  useEffect(() => {
    // fetch every scene's code while the player browses, so the switch is instant
    void preloadScenes().catch(() => {})
  }, [])
  const sel = SCENE_BY_ID[value.id as SceneId] ?? SCENES[0]
  return (
    <div className="flex flex-col gap-4">
      <ul className={`grid gap-2.5 ${compact ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3'}`} role="radiogroup" aria-label="Scenes">
        {SCENES.map((def) => {
          const on = def.id === sel.id
          return (
            <li key={def.id}>
              <button
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => onPick(validChoice({ id: def.id, time: value.time, weather: value.weather }))}
                className={`group relative block w-full overflow-hidden rounded-2xl text-left transition-transform active:scale-[0.98] ${on ? 'ring-2 ring-accent ring-offset-2 ring-offset-ink' : 'ring-1 ring-line'}`}
              >
                <Thumb def={def} className="aspect-[4/3] w-full" />
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-2.5 pb-2 pt-6">
                  <span className="block font-display text-[16px] leading-tight text-white">{def.name}</span>
                  {!compact && <span className="block truncate text-[11px] text-white/75">{def.atmosphere}</span>}
                </span>
                {on && (
                  <span className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-accent text-accent-ink">
                    <Icon name="check" className="h-4 w-4" />
                  </span>
                )}
              </button>
            </li>
          )
        })}
      </ul>
      <div key={sel.id} className="ds-enter flex flex-col gap-3 rounded-2xl border border-line p-3.5">
        <div>
          <h3 className="font-display text-[22px] leading-tight">{sel.name}</h3>
          <p className="mt-1 text-[13px] leading-relaxed text-muted">{sel.blurb}</p>
        </div>
        <dl className="grid grid-cols-2 gap-2 text-[12px]">
          <div>
            <dt className="uppercase tracking-[0.14em] text-muted">Dress code</dt>
            <dd className="mt-0.5">{sel.dressCode}</dd>
          </div>
          <div>
            <dt className="uppercase tracking-[0.14em] text-muted">Atmosphere</dt>
            <dd className="mt-0.5">{sel.atmosphere}</dd>
          </div>
        </dl>
        {sel.times.length > 1 && <Chips label="Time of day" value={value.time as TimeOfDay} onPick={(t) => onPick({ ...value, time: t })} options={sel.times.map((t) => ({ id: t, name: TIME_NAMES[t] }))} />}
        {sel.weathers.length > 1 && <Chips label="Weather" value={value.weather as Weather} onPick={(w) => onPick({ ...value, weather: w })} options={sel.weathers.map((w) => ({ id: w, name: WEATHER_NAMES[w] }))} />}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={onConfirm} className="min-h-12 flex-1 rounded-full bg-accent px-6 font-display text-[18px] text-accent-ink active:opacity-85">
          {cta}
        </button>
        {prev && onBack && prev.id !== value.id && (
          <button type="button" onClick={onBack} className="min-h-12 rounded-full border border-line px-4 text-[13px]">
            Back to {SCENE_BY_ID[prev.id as SceneId]?.name ?? 'last scene'}
          </button>
        )}
      </div>
    </div>
  )
}
