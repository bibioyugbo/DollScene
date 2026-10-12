import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { Customizer, type CustomizerTab } from '../components/customizer/Customizer'
import { AESTHETICS } from '../shared/aesthetics'
import type { Aesthetic } from '../shared/types'
import { Icon } from '../components/Icon'
import { Logo } from '../components/Logo'
import { SceneFallback } from '../components/SceneFallback'
import { ChoiceChips, MultiChips, Select, Toggle } from '../components/Swatches'
import { ThemeToggle } from '../components/ThemeToggle'
import { STYLE_TAGS } from '../data/customization'
import { runAction } from '../hooks/useAction'
import { useHistory } from '../hooks/useHistory'
import { useReducedMotion } from '../hooks/useMediaQuery'
import { randomizeAppearance, uploadPortrait } from '../lib/dollTools'
import { track } from '../lib/analytics'
import { buttonClass, cx, inputClass } from '../lib/ui'
import { sanitizeAppearance } from '../shared/appearance'
import { STARTER_ITEMS } from '../shared/catalog'
import { CITIES, COUNTRIES } from '../shared/cities'
import { STARTERS, starterAppearance, type StarterGroup } from '../shared/starters'
import { useAppStore } from '../store/useAppStore'
import { useSession } from '../store/useSession'
import { toast } from '../store/useToasts'
import type { DollStageHandle } from '../three/DollStage'

const DollStage = lazy(() => import('../three/DollStage'))

const GROUPS: { id: StarterGroup | 'all'; label: string }[] = [
  { id: 'all', label: `All ${STARTERS.length}` },
  { id: 'women', label: 'Women' },
  { id: 'men', label: 'Men' },
  { id: 'androgynous', label: 'Androgynous' },
]

const starterOwned = Object.fromEntries(STARTER_ITEMS.map((i) => [i.id, 1]))

/** Onboarding: pick one of 12 dolls, customize, name her and choose a city, then move in. */
export default function Start() {
  const navigate = useNavigate()
  const uid = useSession((s) => s.user?.uid)
  const onboarded = useSession((s) => !!s.profile?.onboarded)
  const saved = useAppStore((s) => s.onboarding)
  const setSaved = useAppStore((s) => s.setOnboarding)
  const reducedMotion = useReducedMotion()
  const stage = useRef<DollStageHandle>(null)

  const [step, setStep] = useState<'pick' | 'customize' | 'details'>(saved?.step ?? 'pick')
  const [group, setGroup] = useState<StarterGroup | 'all'>('all')
  const [starterId, setStarterId] = useState(saved?.starterId ?? STARTERS[0].id)
  const history = useHistory(saved?.appearance ? sanitizeAppearance(saved.appearance) : starterAppearance(starterId))
  const [tab, setTab] = useState<CustomizerTab>('Skin')
  const [name, setName] = useState('')
  const [country, setCountry] = useState('Nigeria')
  const [city, setCity] = useState('Lagos')
  const [styleTag, setStyleTag] = useState('New in town')
  const [username, setUsername] = useState('')
  const [bio, setBio] = useState('')
  const [aesthetics, setAesthetics] = useState<Aesthetic[]>([])
  const [showLocation, setShowLocation] = useState(true)
  const [busy, setBusy] = useState(false)
  const swipe = useRef<number | null>(null)

  useEffect(() => {
    if (onboarded) navigate('/crib', { replace: true })
  }, [onboarded, navigate])

  // Keep the draft across refreshes.
  useEffect(() => {
    setSaved({ starterId, appearance: history.value, step, quickName: useAppStore.getState().onboarding?.quickName })
  }, [starterId, history.value, step, setSaved])

  const visible = useMemo(() => STARTERS.filter((s) => group === 'all' || s.group === group), [group])
  const starter = STARTERS.find((s) => s.id === starterId)!
  const index = visible.findIndex((s) => s.id === starterId)

  const choose = (id: string) => {
    setStarterId(id)
    history.reset(starterAppearance(id))
  }
  const step1 = (dir: 1 | -1) => {
    const list = visible.length ? visible : STARTERS
    const i = (Math.max(0, index) + dir + list.length) % list.length
    choose(list[i].id)
  }

  const cities = CITIES.filter((c) => c.country === country)
  const focus = (['Face', 'Eyes & brows', 'Makeup', 'Facial hair', 'Piercings', 'Hair'] as CustomizerTab[]).includes(tab) ? 'face' : 'full'

  // Quick start from the landing: the doll was picked and dressed there, so move straight in.
  const quick = useRef(false)
  useEffect(() => {
    const qn = saved?.quickName?.trim()
    if (!uid || onboarded || !qn || quick.current) return
    quick.current = true
    void (async () => {
      setBusy(true)
      const base = qn.toLowerCase().normalize('NFD').replace(/[^a-z0-9]/g, '').slice(0, 12) || 'doll'
      let res = null
      for (let i = 0; i < 3 && !res; i++) {
        res = await runAction(
          'completeOnboarding',
          { name: qn, username: `${base}.${Math.floor(1000 + Math.random() * 9000)}`, bio: '', aesthetics: [], styleTag: 'New in town', appearance: history.value, city: 'Lagos', country: 'Nigeria', portrait: null, privacy: { showLocation: true } },
          { silent: i < 2 },
        )
      }
      setBusy(false)
      if (!res) {
        // Couldn't finish automatically: carry on with the normal details step.
        setSaved({ starterId, appearance: history.value, step: 'details' })
        setName(qn)
        setStep('details')
        return
      }
      track('onboarding_complete', { starter: starterId, quick: true })
      setSaved(null)
      toast.success(`Welcome home, ${qn}. Your load is on the way!`)
      navigate('/crib', { replace: true })
    })()
  }, [uid, onboarded, saved?.quickName, history.value, starterId, setSaved, navigate])

  const finish = async () => {
    if (!uid) return
    if (name.trim().length < 2) {
      toast.error('Give your alter ego a name (2+ characters).')
      return
    }
    if (!/^[a-z0-9][a-z0-9._]{1,18}[a-z0-9]$/.test(username)) {
      toast.error('Usernames are 3 to 20 letters, numbers, dots or underscores.')
      return
    }
    setBusy(true)
    const portrait = await uploadPortrait(uid, stage.current?.capturePortrait() ?? null)
    const res = await runAction('completeOnboarding', {
      name: name.trim(),
      username,
      bio,
      aesthetics,
      styleTag,
      appearance: history.value,
      city,
      country,
      portrait,
      privacy: { showLocation },
    })
    setBusy(false)
    if (!res) return
    track('onboarding_complete', { starter: starterId })
    setSaved(null)
    toast.success(`Welcome home, ${name.trim()}. Time to fill your space!`)
    navigate('/crib')
  }

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-background text-foreground split:flex-row">
      {/* stage */}
      <div
        className="relative h-[46dvh] shrink-0 md:h-[52dvh] split:h-full split:flex-1"
        onPointerDown={(e) => step === 'pick' && (swipe.current = e.clientX)}
        onPointerUp={(e) => {
          if (step !== 'pick' || swipe.current === null) return
          const dx = e.clientX - swipe.current
          swipe.current = null
          if (Math.abs(dx) > 60) step1(dx < 0 ? 1 : -1)
        }}
      >
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_40%,rgb(255_46_136/0.18),transparent_60%)]" />
        <Suspense fallback={<SceneFallback label="Bringing your doll to life" />}>
          <DollStage
            ref={stage}
            appearance={history.value}
            turntable={step === 'pick'}
            focus={step === 'customize' ? focus : 'full'}
            undress={step === 'customize' && tab === 'Tattoos'}
            reducedMotion={reducedMotion}
            interactive={step !== 'pick'}
            label={step === 'pick' ? `${starter.name}. Swipe for the next doll.` : `${starter.name}. Drag to turn.`}
          />
        </Suspense>
        <header className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between gap-2 px-4 pt-safe md:px-6 md:pt-5">
          <div className="pointer-events-auto">
            <Logo compact />
          </div>
          <div className="pointer-events-auto flex items-center gap-2">
            <ThemeToggle />
          </div>
        </header>
        {step === 'pick' && (
          <>
            <button type="button" aria-label="Previous doll" onClick={() => step1(-1)} className="absolute top-1/2 left-3 grid size-12 -translate-y-1/2 place-items-center rounded-full border border-border bg-card/90 shadow">
              <Icon name="back" />
            </button>
            <button type="button" aria-label="Next doll" onClick={() => step1(1)} className="absolute top-1/2 right-3 grid size-12 -translate-y-1/2 place-items-center rounded-full border border-border bg-card/90 shadow">
              <Icon name="forward" />
            </button>
          </>
        )}
        {step === 'customize' && (
          <div className="absolute inset-x-0 bottom-3 flex justify-center gap-2">
            <button type="button" aria-label="Undo" className={buttonClass('secondary', 'sm')} disabled={!history.canUndo} onClick={history.undo}>
              <Icon name="undo" className="size-4" />
            </button>
            <button type="button" aria-label="Redo" className={buttonClass('secondary', 'sm')} disabled={!history.canRedo} onClick={history.redo}>
              <Icon name="redo" className="size-4" />
            </button>
            <button type="button" className={buttonClass('secondary', 'sm')} onClick={() => history.set(randomizeAppearance(history.value))}>
              <Icon name="dice" className="size-4" /> Randomize
            </button>
            <button type="button" className={buttonClass('secondary', 'sm')} onClick={() => history.set(starterAppearance(starterId))}>
              <Icon name="reset" className="size-4" /> Reset
            </button>
          </div>
        )}
      </div>

      {/* panel */}
      <section className="flex min-h-0 flex-1 flex-col rounded-t-[var(--radius-sheet)] border-t border-border bg-card split:w-[440px] split:flex-none split:rounded-none split:border-t-0 split:border-l lg:w-[500px]">
        <ol className="flex items-center gap-2 px-4 pt-4 text-xs font-semibold text-muted-foreground md:px-6" aria-label="Steps">
          {(['pick', 'customize', 'details'] as const).map((s, i) => (
            <li key={s} className={cx('flex items-center gap-2', step === s && 'text-primary')} aria-current={step === s ? 'step' : undefined}>
              <span className={cx('grid size-6 place-items-center rounded-full', step === s ? 'bg-primary text-primary-foreground' : 'bg-muted')}>{i + 1}</span>
              {s === 'pick' ? 'Pick' : s === 'customize' ? 'Customize' : 'Move in'}
              {i < 2 && <span aria-hidden className="h-px w-5 bg-border" />}
            </li>
          ))}
        </ol>

        {step === 'pick' && (
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pt-4 pb-safe md:px-6">
            <div>
              <h1 className="font-display text-2xl font-extrabold">Create your alter ego</h1>
              <p className="text-muted-foreground">{starter.blurb}</p>
            </div>
            <ChoiceChips label="Show" hideLabel options={GROUPS} value={group} onChange={setGroup} />
            <div className="grid grid-cols-4 gap-2">
              {visible.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={s.id === starterId}
                  onClick={() => choose(s.id)}
                  className={cx('flex flex-col items-center gap-1 rounded-2xl border-2 p-2 text-sm font-semibold', s.id === starterId ? 'border-primary bg-primary/10' : 'border-border')}
                >
                  <span className="size-10 rounded-full ring-2 ring-card" style={{ background: `linear-gradient(160deg, ${s.appearance.hair.color} 38%, ${s.appearance.skin.tone} 38%)` }} />
                  {s.name}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Any hair, clothing or accessory works on any doll. You can change dolls later (first change is free).</p>
            <button type="button" className={buttonClass('primary', 'lg', 'mt-auto w-full')} onClick={() => setStep('customize')}>
              Customize {starter.name}
            </button>
          </div>
        )}

        {step === 'customize' && (
          <>
            <Customizer
              value={history.value}
              onChange={(v, key) => history.set(v, key)}
              tab={tab}
              onTab={setTab}
              mode="onboarding"
              owned={starterOwned}
              hairLooks={[]}
              onHairLooks={() => toast.info('Save hair looks after you move in.')}
              complexions={[]}
              onComplexions={() => toast.info('Save complexions after you move in.')}
              facePresets={[]}
              onFacePresets={() => toast.info('Save faces after you move in.')}
              initial={starterAppearance(starterId)}
            />
            <div className="flex items-center gap-2 border-t border-border px-4 py-3 pb-safe md:px-6">
              <button type="button" className={buttonClass('secondary', 'lg')} onClick={() => setStep('pick')}>
                Back
              </button>
              <button type="button" className={buttonClass('ghost', 'md')} onClick={() => setStep('details')} title="You can keep customising from your profile any time">
                Skip for now
              </button>
              <button type="button" className={buttonClass('primary', 'lg', 'flex-1')} onClick={() => setStep('details')}>
                Next
              </button>
            </div>
          </>
        )}

        {step === 'details' && (
          <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 pt-4 pb-safe md:px-6">
            <div>
              <h1 className="font-display text-2xl font-extrabold">Who are you here?</h1>
              <p className="text-muted-foreground">Name your alter ego, claim a username and write a little lore. You can change all of this later.</p>
            </div>
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold">Display name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={24} placeholder={starter.name} className={inputClass} autoFocus />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold">Username</span>
              <span className="relative block">
                <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-muted-foreground">@</span>
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._]/g, ''))}
                  maxLength={20}
                  placeholder="yourname"
                  className={cx(inputClass, 'pl-9')}
                  autoComplete="off"
                />
              </span>
            </label>
            <label className="block">
              <span className="mb-1.5 flex justify-between text-sm font-semibold">
                Bio <span className="font-normal text-muted-foreground">{bio.length}/160</span>
              </span>
              <textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={160} rows={2} placeholder="Lagos-born, Y2K-raised, allergic to beige." className={cx(inputClass, 'py-3')} />
            </label>
            <MultiChips label="Your aesthetics (up to 4)" options={AESTHETICS.map((x) => ({ id: x.id, label: x.label, locked: aesthetics.length >= 4 && !aesthetics.includes(x.id) }))} value={aesthetics} onChange={setAesthetics} />
            <Select
              label="Country"
              value={country}
              options={COUNTRIES.map((c) => ({ value: c, label: c }))}
              onChange={(c) => {
                setCountry(c)
                setCity(CITIES.find((x) => x.country === c)?.name ?? '')
              }}
            />
            <Select label="City" value={city} options={cities.map((c) => ({ value: c.name, label: c.name }))} onChange={setCity} />
            <Toggle label="Show my city on my profile and the globe" hint="Only your city is ever shown, with the pin placed at a random spot inside it." checked={showLocation} onChange={setShowLocation} />
            <ChoiceChips label="Your vibe" options={STYLE_TAGS.map((s) => ({ id: s, label: s }))} value={styleTag} onChange={setStyleTag} />
            <div className="mt-auto flex gap-2 pt-2">
              <button type="button" className={buttonClass('secondary', 'lg')} onClick={() => setStep('customize')}>
                Back
              </button>
              <button type="button" className={buttonClass('primary', 'lg', 'flex-1')} disabled={busy} onClick={finish}>
                {busy ? 'Moving in…' : 'Join the scene'}
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
