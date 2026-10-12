import { useState } from 'react'
import { CHARACTER_PRESETS } from '../../shared/studio/presets'
import { deleteLook, saveLook } from '../session'
import { useStudio } from '../state/store'
import { Section, TextButton } from '../ui/controls'

export function LooksPanel() {
  const saved = useStudio((s) => s.saved)
  const replace = useStudio((s) => s.replace)
  const connection = useStudio((s) => s.connection)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)

  return (
    <div className="flex flex-col gap-5">
      <Section title="Save this look">
        <form
          className="flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault()
            setBusy(true)
            await saveLook(name)
            setBusy(false)
            setName('')
          }}
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 40))}
            placeholder="Name it: Owambe gold…"
            aria-label="Look name"
            className="min-h-11 min-w-0 flex-1 rounded-full border border-line bg-transparent px-4 text-[14px] placeholder:text-muted/60"
          />
          <button type="submit" disabled={busy} className="min-h-11 rounded-full bg-accent px-5 text-[13px] font-semibold text-accent-ink disabled:opacity-50">
            Save
          </button>
        </form>
        {connection === 'preview' && <p className="text-[12px] text-muted">Preview mode: looks stay on this device. Open DollScene in Lagos Life to keep them with your account.</p>}
      </Section>

      <Section title="Lookbook" aside={<span className="text-[11px] text-muted">{saved.length} saved</span>}>
        {saved.length === 0 ? (
          <p className="text-[13px] text-muted">Looks you save appear here, ready to wear again.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {saved.map((l) => (
              <li key={l.id} className="flex items-center gap-3 py-2">
                <span className="h-8 w-8 shrink-0 rounded-full" style={{ background: `conic-gradient(${l.look.skin.tone} 0 40%, ${l.look.makeup.lipstick.color} 0 60%, ${l.look.makeup.eyeshadow.color} 0 80%, ${l.look.hair.color} 0)` }} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-[16px] leading-tight">{l.name}</p>
                  <p className="text-[11px] text-muted">{l.savedAt ? new Date(l.savedAt).toLocaleDateString() : ''}</p>
                </div>
                <TextButton onClick={() => replace(l.look)}>Wear</TextButton>
                <button type="button" onClick={() => deleteLook(l.id)} aria-label={`Delete ${l.name}`} className="grid h-11 w-11 place-items-center rounded-full text-muted active:bg-raised">
                  <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden>
                    <path fill="currentColor" d="M6 2h4l.5 1H13v1.5H3V3h2.5L6 2Zm-2 3.5h8l-.6 8a1 1 0 0 1-1 .9H5.6a1 1 0 0 1-1-.9l-.6-8Z" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Start from a character">
        <div className="ds-scroll-x -mx-4 flex gap-2 px-4">
          {CHARACTER_PRESETS.map((c) => (
            <button key={c.id} type="button" onClick={() => replace(c.look)} className="flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-line py-1 pl-1 pr-4 active:bg-raised">
              <span className="h-9 w-9 rounded-full" style={{ background: `radial-gradient(circle at 40% 35%, ${c.look.skin.tone}, ${c.look.hair.color})` }} aria-hidden />
              <span className="font-display text-[15px] italic">{c.name}</span>
            </button>
          ))}
        </div>
      </Section>
    </div>
  )
}
