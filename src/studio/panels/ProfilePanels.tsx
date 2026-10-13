import { useState } from 'react'
import { levelFor } from '../../shared/studio/challenges'
import { CHARACTER_PRESETS } from '../../shared/studio/presets'
import { LooksPanel as Lookbook } from '../editors/LooksPanel'
import { PlayPanel } from '../editors/PlayPanel'
import { deletePhoto, usePhotos } from '../photos'
import { useStudio } from '../state/store'
import { Chips, Section } from '../ui/controls'
import { validateName } from '../ui/onboardRules'
import { ScenePicker, validChoice } from '../ui/ScenePicker'

export function ProfilePanel() {
  const look = useStudio((s) => s.look)
  const apply = useStudio((s) => s.apply)
  const xp = useStudio((s) => s.xp)
  const connection = useStudio((s) => s.connection)
  const photos = usePhotos()
  const [view, setView] = useState<'doll' | 'looks' | 'photos' | 'play'>('doll')
  const [name, setName] = useState(look.profile.name)
  const err = validateName(name)
  const lvl = levelFor(xp)
  const starter = CHARACTER_PRESETS.find((c) => c.id === look.profile.starter)
  return (
    <div className="flex flex-col gap-4">
      <Chips
        label="Profile"
        value={view}
        onPick={setView}
        options={[
          { id: 'doll', name: 'My doll' },
          { id: 'looks', name: 'Lookbook' },
          { id: 'photos', name: `Photos${photos.length ? ` (${photos.length})` : ''}` },
          { id: 'play', name: 'Challenges & shop' },
        ]}
      />
      {view === 'doll' && (
        <div className="flex flex-col gap-4">
          <form
            className="flex flex-col gap-1.5"
            onSubmit={(e) => {
              e.preventDefault()
              if (err) return
              apply((l) => void (l.profile.name = name.trim()))
              useStudio.getState().notify('Name saved.', 'success')
            }}
          >
            <label htmlFor="ds-profile-name" className="text-[11px] uppercase tracking-[0.16em] text-muted">
              Doll name
            </label>
            <div className="flex gap-2">
              <input id="ds-profile-name" value={name} maxLength={24} onChange={(e) => setName(e.target.value)} aria-invalid={!!err} className="min-h-11 min-w-0 flex-1 rounded-full border border-line bg-transparent px-4 font-display text-[16px]" />
              <button type="submit" disabled={!!err || name.trim() === look.profile.name} className="min-h-11 rounded-full bg-accent px-4 text-[13px] font-semibold text-accent-ink disabled:opacity-40">
                Save
              </button>
            </div>
            {err && <p className="text-[12px] text-rose">{err}</p>}
          </form>
          <dl className="grid grid-cols-[7rem_1fr] gap-y-2 text-[13px]">
            <dt className="text-muted">Started as</dt>
            <dd>{starter?.name ?? '—'}</dd>
            <dt className="text-muted">Career</dt>
            <dd>
              {lvl.name} · {xp} XP
            </dd>
            <dt className="text-muted">Saved</dt>
            <dd>{connection === 'live' || connection === 'test' ? 'With your game profile' : connection === 'preview' ? 'On this device (preview)' : 'On this device until you reconnect'}</dd>
          </dl>
          <p className="text-[12px] text-muted">Her face and body were set when she joined; the Beauty Clinic is the only place to reshape them.</p>
        </div>
      )}
      {view === 'looks' && <Lookbook />}
      {view === 'photos' &&
        (photos.length ? (
          <ul className="grid grid-cols-2 gap-2">
            {photos.map((p) => (
              <li key={p.id} className="relative overflow-hidden rounded-xl border border-line">
                <img src={p.thumb} alt={`Photo at ${p.scene}`} className="aspect-[3/4] w-full object-cover" />
                <span className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/70 to-transparent px-2 pb-1.5 pt-5 text-[11px] text-white">
                  {p.scene}
                  <button type="button" onClick={() => deletePhoto(p.id)} className="rounded-full bg-black/40 px-2 py-0.5" aria-label="Delete photo">
                    Delete
                  </button>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <Section title="Photos">
            <p className="text-[13px] text-muted">Photos you take in Make a Scene land here.</p>
          </Section>
        ))}
      {view === 'play' && <PlayPanel />}
    </div>
  )
}

export function ScenePanel({ onGo }: { onGo: () => void }) {
  const look = useStudio((s) => s.look)
  const prev = useStudio((s) => s.prevScene)
  const changeScene = useStudio((s) => s.changeScene)
  const notify = useStudio((s) => s.notify)
  return (
    <ScenePicker
      compact
      value={validChoice(look.scene)}
      onPick={(c) => changeScene(c)}
      prev={prev}
      onBack={() => {
        if (!prev) return
        changeScene(validChoice(prev))
        notify('Back to your last scene. Your look came with you.', 'success')
      }}
      cta="Go to the scene"
      onConfirm={onGo}
    />
  )
}
