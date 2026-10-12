import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { Customizer, tabFromParam, type CustomizerTab } from '../components/customizer/Customizer'
import { Icon } from '../components/Icon'
import { Modal } from '../components/Modal'
import { SceneFallback } from '../components/SceneFallback'
import { ThemeToggle } from '../components/ThemeToggle'
import { WalletChip } from '../components/AppShell'
import { runAction } from '../hooks/useAction'
import { useHistory } from '../hooks/useHistory'
import { useReducedMotion } from '../hooks/useMediaQuery'
import { useOwned } from '../hooks/useOwned'
import { randomizeAppearance, uploadPortrait } from '../lib/dollTools'
import { buttonClass, cx, formatGlam } from '../lib/ui'
import { appearanceBill, billTotal, sanitizeAppearance } from '../shared/appearance'
import { STARTER_CHANGE_COST } from '../shared/economy'
import { STARTERS, starterAppearance } from '../shared/starters'
import type { Appearance, DollDoc, FacePreset } from '../shared/types'
import { useSession } from '../store/useSession'
import { toast } from '../store/useToasts'
import type { DollStageHandle, LightingPreset } from '../three/DollStage'

const DollStage = lazy(() => import('../three/DollStage'))

/** The customizer for an existing doll. Studio and clinic work is billed on save, with a before/after reveal. */
export default function Create() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const doll = useSession((s) => s.doll)!
  const uid = useSession((s) => s.user!.uid)
  const owned = useOwned()
  const dollies = useSession((s) => s.progress?.dollies ?? 0)
  const starterChanges = useSession((s) => s.profile?.starterChanges ?? 0)
  const reducedMotion = useReducedMotion()
  const stage = useRef<DollStageHandle>(null)

  const initialTab = tabFromParam(params.get('tab')) ?? 'Hair'
  const [tab, setTab] = useState<CustomizerTab>(initialTab)
  // Older saves predate newer fields (facial hair, lip liner); fill defaults.
  const savedLook = useMemo(() => sanitizeAppearance(doll.appearance), [doll.appearance])
  const history = useHistory<Appearance>(savedLook)
  const [hairLooks, setHairLooks] = useState(doll.hairLooks)
  const [complexions, setComplexions] = useState<DollDoc['complexionPresets']>(doll.complexionPresets)
  const [facePresets, setFacePresets] = useState<FacePreset[]>(doll.facePresets ?? [])
  const [lighting, setLighting] = useState<LightingPreset>('studio')
  const [starterOpen, setStarterOpen] = useState(false)
  const [reveal, setReveal] = useState<{ before: string | null; after: string | null } | null>(null)
  const [busy, setBusy] = useState(false)
  const before = useRef<string | null>(null)

  // Capture the "before" portrait once the stage has rendered.
  useEffect(() => {
    const t = window.setTimeout(() => (before.current = stage.current?.capturePortrait() ?? null), 1200)
    return () => window.clearTimeout(t)
  }, [])

  const lines = useMemo(() => appearanceBill(savedLook, history.value, starterChanges), [savedLook, history.value, starterChanges])
  const total = billTotal(lines)
  const dirty = JSON.stringify(history.value) !== JSON.stringify(savedLook) || JSON.stringify(hairLooks) !== JSON.stringify(doll.hairLooks) || JSON.stringify(complexions) !== JSON.stringify(doll.complexionPresets) || JSON.stringify(facePresets) !== JSON.stringify(doll.facePresets ?? [])

  const focus = (['Face', 'Eyes & brows', 'Makeup', 'Facial hair', 'Piercings', 'Hair', 'Beauty Studio'] as CustomizerTab[]).includes(tab) ? 'face' : tab === 'Nails' ? 'body' : 'full'

  const commit = async () => {
    setBusy(true)
    const after = stage.current?.capturePortrait() ?? null
    const portrait = await uploadPortrait(uid, after)
    const res = await runAction('saveAppearance', { appearance: history.value, portrait, hairLooks, complexionPresets: complexions, facePresets })
    setBusy(false)
    if (!res) return false
    toast.success(res.charged ? `Looking good. ${formatGlam(res.charged)} Glam paid.` : 'Saved')
    before.current = after
    return true
  }

  const save = async () => {
    if (total > 0) {
      if (total > dollies) {
        toast.error(`This visit costs ${formatGlam(total)} Glam. You have ${formatGlam(dollies)}.`)
        return
      }
      setReveal({ before: before.current, after: stage.current?.capturePortrait() ?? null })
      return
    }
    await commit()
  }

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-background text-foreground split:flex-row">
      <div className="relative h-[44dvh] shrink-0 md:h-[52dvh] split:h-full split:flex-1">
        <div aria-hidden className={cx('absolute inset-0', lighting === 'club' ? 'bg-[#12061A]' : 'bg-[radial-gradient(ellipse_at_50%_40%,rgb(255_46_136/0.16),transparent_60%)]')} />
        <Suspense fallback={<SceneFallback label="Opening the studio" />}>
          <DollStage ref={stage} appearance={history.value} lighting={lighting} focus={focus} undress={tab === 'Tattoos' || tab === 'Body'} reducedMotion={reducedMotion} />
        </Suspense>
        <header className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between gap-2 px-4 pt-safe md:px-6 md:pt-5">
          <button
            type="button"
            className={buttonClass('secondary', 'md', 'pointer-events-auto')}
            onClick={() => (dirty && !window.confirm('Leave without saving?') ? undefined : navigate(-1))}
          >
            <Icon name="back" className="size-4" /> Back
          </button>
          <div className="pointer-events-auto flex items-center gap-2">
            <WalletChip />
            <ThemeToggle />
          </div>
        </header>
        <div className="absolute inset-x-0 bottom-3 flex flex-wrap justify-center gap-2 px-3">
          <div role="group" aria-label="Lighting" className="flex rounded-full border border-border bg-card/90 p-1">
            {(['studio', 'daylight', 'club'] as const).map((l) => (
              <button key={l} type="button" aria-pressed={lighting === l} onClick={() => setLighting(l)} className={cx('min-h-9 rounded-full px-3 text-xs font-semibold capitalize', lighting === l ? 'bg-foreground text-background' : 'text-muted-foreground')}>
                {l}
              </button>
            ))}
          </div>
          <button type="button" aria-label="Undo" className={buttonClass('secondary', 'sm')} disabled={!history.canUndo} onClick={history.undo}>
            <Icon name="undo" className="size-4" />
          </button>
          <button type="button" aria-label="Redo" className={buttonClass('secondary', 'sm')} disabled={!history.canRedo} onClick={history.redo}>
            <Icon name="redo" className="size-4" />
          </button>
          <button type="button" className={buttonClass('secondary', 'sm')} onClick={() => history.set(randomizeAppearance(history.value))}>
            <Icon name="dice" className="size-4" /> Random
          </button>
          <button type="button" className={buttonClass('secondary', 'sm')} onClick={() => history.set(savedLook)}>
            <Icon name="reset" className="size-4" /> Reset
          </button>
        </div>
      </div>

      <section className="relative flex min-h-0 flex-1 flex-col rounded-t-[28px] border-t-2 border-primary/40 bg-card shadow-[0_-12px_40px_-20px_rgb(255_46_136/0.5)] split:m-3 split:w-[380px] split:flex-none split:rounded-[28px] split:border-2">
        <div className="flex items-center gap-2 px-4 pt-3 pb-2">
          <span aria-hidden className="text-lg">🎀</span>
          <p className="font-display text-sm font-black tracking-wide">
            Makeover <span className="text-primary">Studio</span>
          </p>
          <span className="ml-auto rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary uppercase">{dirty ? 'unsaved ✨' : 'all saved'}</span>
        </div>
        <Customizer
          value={history.value}
          onChange={(v, key) => history.set(v, key)}
          tab={tab}
          onTab={setTab}
          mode="edit"
          owned={owned}
          hairLooks={hairLooks}
          onHairLooks={setHairLooks}
          complexions={complexions}
          onComplexions={setComplexions}
          facePresets={facePresets}
          onFacePresets={setFacePresets}
          initial={savedLook}
        />
        <div className="flex items-center gap-2 border-t border-border px-4 py-3 pb-safe md:px-6">
          <button type="button" className={buttonClass('secondary', 'md')} onClick={() => setStarterOpen(true)}>
            Change doll
          </button>
          <button type="button" className={buttonClass('primary', 'lg', 'flex-1')} disabled={!dirty || busy} onClick={save}>
            {busy ? 'Saving…' : total ? `Save · ${formatGlam(total)} G` : 'Save'}
          </button>
        </div>
      </section>

      <Modal open={starterOpen} onClose={() => setStarterOpen(false)} title="Change your base doll" wide>
        <p className="text-sm text-muted-foreground">
          Keeps your outfit, piercings, tattoos and identity. {starterChanges === 0 ? 'Your first change is free.' : `Costs ${STARTER_CHANGE_COST} Glam.`}
        </p>
        <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {STARTERS.map((s) => (
            <button
              key={s.id}
              type="button"
              aria-pressed={history.value.starterId === s.id}
              onClick={() => {
                const base = starterAppearance(s.id)
                const cur = history.value
                history.set({ ...base, outfit: cur.outfit, piercings: cur.piercings, tattoos: cur.tattoos, identity: cur.identity, clinic: cur.clinic })
                setStarterOpen(false)
              }}
              className={cx('flex flex-col items-center gap-1 rounded-2xl border-2 p-2 text-sm font-semibold', history.value.starterId === s.id ? 'border-primary' : 'border-border')}
            >
              <span className="size-10 rounded-full" style={{ background: `linear-gradient(160deg, ${s.appearance.hair.color} 38%, ${s.appearance.skin.tone} 38%)` }} />
              {s.name}
            </button>
          ))}
        </div>
      </Modal>

      <Modal open={!!reveal} onClose={() => setReveal(null)} title="Studio reveal" wide>
        <div className="grid grid-cols-2 gap-3">
          {(['before', 'after'] as const).map((k) => (
            <figure key={k} className="overflow-hidden rounded-2xl border border-border bg-muted">
              {reveal?.[k] ? <img src={reveal[k]!} alt={k} className={cx('aspect-square w-full object-cover', k === 'after' && 'motion-safe:animate-[reveal_.8s_ease-out]')} /> : <div className="aspect-square" />}
              <figcaption className="py-2 text-center text-sm font-semibold capitalize">{k}</figcaption>
            </figure>
          ))}
        </div>
        <ul className="mt-4 flex flex-col gap-1 text-sm">
          {lines.map((l) => (
            <li key={l.label} className="flex justify-between">
              <span>{l.label}</span>
              <span className="font-semibold tabular-nums">{formatGlam(l.amount)} G</span>
            </li>
          ))}
          <li className="mt-1 flex justify-between border-t border-border pt-2 font-bold">
            <span>Total</span>
            <span className="tabular-nums">{formatGlam(total)} G</span>
          </li>
        </ul>
        <div className="mt-5 flex gap-3">
          <button type="button" className={buttonClass('secondary', 'lg', 'flex-1')} onClick={() => setReveal(null)}>
            Keep editing
          </button>
          <button
            type="button"
            className={buttonClass('primary', 'lg', 'flex-1')}
            disabled={busy}
            onClick={async () => {
              if (await commit()) setReveal(null)
            }}
          >
            Pay & save
          </button>
        </div>
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Earn more Glam at <Link to="/work" className="font-semibold underline">work</Link>.
        </p>
      </Modal>
    </div>
  )
}
