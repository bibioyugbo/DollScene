import { useMemo, useState } from 'react'
import type { StudioLook } from '../../shared/studio/look'
import { CHARACTER_PRESETS, randomDoll } from '../../shared/studio/presets'
import { flushSave } from '../session'
import { AuthFailure, loadAccountLook, register, signIn } from '../net/auth'
import { url, wearables, type CharacterCatalog } from '../character/catalog'
import { useStudio } from '../state/store'
import { NAME_TAKEN, validateDob, validateName } from './onboardRules'
import { click, haptic, sfx } from './sound'

/**
 * Landing: "Pick a doll" and sign up. The 3D doll fills the screen; every face is visible at a
 * glance (7 across, no paging, no scrolling) and her witty one-liner sits on the left. "Random doll"
 * builds a whole new one. Sign up: username (the doll's name, unique), password, date of birth (18+
 * only; only the yes/no is kept), Enter. "Already have a doll? Sign in" opens the sign-in form.
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
      style={{
        width: size,
        height: size,
        background: 'linear-gradient(180deg, #6a7da6 0%, #4a5b84 100%)',
      }}
    >
      {t.thumb && !failed ? (
        <img src={t.thumb} alt="" decoding="async" onError={() => setFailed(true)} className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <span
          className="absolute inset-0"
          style={{
            background: `radial-gradient(circle at 50% 44%, ${t.look.skin.tone} 0 26%, ${t.look.hair.style === 'none' ? t.look.skin.tone : t.look.hair.color} 27% 40%, transparent 41%)`,
          }}
        />
      )}
      <span
        className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#141c38]/85 to-transparent px-1 pb-1 pt-4 text-center font-extrabold text-white transition-opacity ${size < 70 ? 'text-[9px]' : 'text-[12px]'} ${on ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100'}`}
      >
        {t.name}
      </span>
    </button>
  )
}

const field =
  'h-11 w-full min-w-0 rounded-full bg-white/95 px-5 text-[15px] font-bold text-[#1c2547] shadow-[0_5px_0_#8f9cc4,0_9px_20px_rgb(5_10_30/0.35)] placeholder:font-medium placeholder:text-[#1c2547]/45'

/** Sign in: username + password; then straight back to the street with her own doll. */
function SignIn({ wide, onDone, onRegister }: { wide: boolean; onDone: () => void; onRegister: () => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const go = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!username.trim()) return setError('Enter your username.')
    if (!password) return setError('Enter your password.')
    setBusy(true)
    setError(null)
    try {
      await signIn(username.trim(), password)
      const look = await loadAccountLook().catch(() => null)
      const s = useStudio.getState()
      if (look) s.replace({ ...look, profile: { ...look.profile, onboarded: true } })
      else s.apply((l) => void ((l.profile.name = username.trim()), (l.profile.onboarded = true)))
      click('go')
      onDone()
    } catch (err) {
      setError(err instanceof AuthFailure ? err.message : 'Couldn’t sign you in. Try again.')
      sfx('pop')
    } finally {
      setBusy(false)
    }
  }
  return (
    <form
      onSubmit={go}
      aria-label="Sign in"
      className={`pointer-events-auto absolute flex flex-col gap-3 ${wide ? 'right-[6vw] top-1/2 w-[min(420px,40vw)] -translate-y-1/2' : 'inset-x-4 bottom-[max(env(safe-area-inset-bottom),16px)]'}`}
    >
      <h1 className={`font-black tracking-tight text-white drop-shadow-[0_3px_12px_rgb(5_10_30/0.5)] ${wide ? 'text-[44px] leading-none' : 'text-[30px]'}`}>Sign in</h1>
      <p className="text-[14px] font-semibold text-white/85">Welcome back. Your doll is waiting.</p>
      <label className="flex flex-col gap-1">
        <span className="sr-only">Username</span>
        <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username" autoComplete="username" maxLength={24} className={field} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="sr-only">Password</span>
        <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" type="password" autoComplete="current-password" className={field} />
      </label>
      <button type="submit" disabled={busy} aria-label="Sign in" className="ds-cta mt-12 flex h-14 w-[62%] min-w-[200px] items-center justify-center gap-2 self-center rounded-2xl text-[18px] font-black tracking-tight disabled:opacity-60">
        {busy ? 'Signing in…' : 'Enter'}
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M9 5l7 7-7 7" />
        </svg>
      </button>
      <p className="min-h-[1.2em] text-center text-[13px] font-bold text-[#ffd0dc]" role="alert" aria-live="polite">
        {error}
      </p>
      <button type="button" onClick={() => (click('tap'), onRegister())} className="self-center text-[14px] font-bold text-white underline underline-offset-4">
        New here? Create your doll
      </button>
    </form>
  )
}

export function PickDoll({ wide, size: vp, catalog, onNext }: { wide: boolean; size: { w: number; h: number }; catalog: CharacterCatalog; onNext: () => void }) {
  const look = useStudio((s) => s.look)
  const replace = useStudio((s) => s.replace)
  const apply = useStudio((s) => s.apply)
  const [mode, setMode] = useState<'register' | 'signin'>('register')
  const [random, setRandom] = useState<Tile | null>(null)
  const cast = useMemo<Tile[]>(() => CHARACTER_PRESETS.map((c) => ({ id: c.id, name: c.name, blurb: c.blurb, look: c.look, thumb: url.starterThumb(c.id) })), [])
  const selected = random && look.profile.starter === 'random' ? 'random' : look.profile.starter
  const cur = selected === 'random' ? random : (cast.find((t) => t.id === selected) ?? null)
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [dob, setDob] = useState('')
  const [touched, setTouched] = useState(false)
  const [serverError, setServerError] = useState<{ text: string; for: string } | null>(null)
  const [checking, setChecking] = useState(false)
  const nameError = validateName(name)
  const passError = password.length < 8 ? (password ? 'Passwords need at least 8 characters.' : 'Choose a password (8+ characters).') : null
  const dobError = validateDob(dob)
  const localError = nameError ?? passError ?? dobError
  const shownError = touched ? (serverError && serverError.for === `${name}|${password}|${dob}` ? serverError.text : localError) : null

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
    const p = randomDoll(seed, { hair: catalog.hair.map((h) => h.id), pieces: [...wearables(catalog).values()].map((w) => ({ id: w.id, slot: w.slot, colors: w.colors })) })
    const t: Tile = { id: 'random', name: p.name, blurb: p.blurb, look: p.look, thumb: null }
    setRandom(t)
    replace({ ...p.look, profile: { ...p.look.profile, name: name.trim() || p.name, onboarded: false }, scene: look.scene })
    useStudio.getState().setFraming('full')
  }

  const enter = async () => {
    setTouched(true)
    if (!cur || localError || checking) return
    setChecking(true)
    try {
      await register(name.trim(), password, dob)
      apply((l) => void ((l.profile.name = name.trim()), (l.profile.onboarded = true)))
      void flushSave()
      onNext()
    } catch (e) {
      setServerError({ text: e instanceof AuthFailure ? (e.code === 'username_taken' ? NAME_TAKEN : e.message) : 'Couldn’t create your doll. Try again.', for: `${name}|${password}|${dob}` })
      sfx('pop')
    } finally {
      setChecking(false)
    }
  }

  // every face at a glance: the grid is sized to fit, never paged or scrolled
  const n = cast.length
  const cols = 7
  const rows = Math.ceil(n / cols)
  const gap = wide ? 8 : 5
  const tile = wide ? Math.floor(Math.min(88, (vp.h - 360) / rows, (Math.min(vp.w * 0.5, 680) - (cols - 1) * gap) / cols)) : Math.floor(Math.min(60, (vp.w - 24 - (cols - 1) * gap) / cols, (vp.h * 0.26 - (rows - 1) * gap) / rows))
  const today = new Date().toISOString().slice(0, 10)

  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      {/* top left: Random doll; her name and witty one-liner down at the bottom left, in a column
          the doll never enters */}
      <div className={`absolute flex flex-col items-start ${wide ? 'left-8 top-8' : 'left-4 top-[max(env(safe-area-inset-top),14px)]'}`}>
        {mode === 'register' && (
          <button
            type="button"
            onClick={rollRandom}
            className={`ds-cta pointer-events-auto whitespace-nowrap rounded-full font-black ${wide ? 'min-h-11 px-5 text-[15px]' : 'min-h-9 px-4 text-[13px]'} ${selected === 'random' ? 'ring-2 ring-white' : ''}`}
          >
            Random doll
          </button>
        )}
      </div>
      {cur && (
        <div
          key={cur.id + cur.name}
          className={`ds-enter absolute text-white ${wide ? 'bottom-10 left-8 w-[min(26vw,340px)]' : 'inset-x-4 top-[calc(max(env(safe-area-inset-top),14px)+48px)]'}`}
        >
          <p className={`${wide ? 'text-[clamp(30px,3.4vw,44px)]' : 'text-[24px]'} font-black leading-none tracking-tight drop-shadow-[0_2px_10px_rgb(5_10_30/0.75)]`}>{cur.name}</p>
          <p className={`mt-2 ${wide ? 'text-[16px]' : 'text-[13px]'} font-semibold leading-snug text-white drop-shadow-[0_1px_6px_rgb(5_10_30/0.85)]`}>{cur.blurb}</p>
        </div>
      )}

      {mode === 'signin' ? (
        <SignIn wide={wide} onDone={onNext} onRegister={() => setMode('register')} />
      ) : (
        <div className={`absolute flex flex-col ${wide ? 'bottom-6 right-[3vw] top-6 justify-center gap-3' : 'inset-x-3 bottom-[max(env(safe-area-inset-bottom),8px)] gap-2'}`}>
          <h1 className={`font-black tracking-tight text-white drop-shadow-[0_3px_12px_rgb(5_10_30/0.5)] ${wide ? 'text-[44px] leading-none' : 'sr-only'}`}>Pick a doll</h1>

          <div role="radiogroup" aria-label="Dolls" className="grid self-start" style={{ gridTemplateColumns: `repeat(${cols}, ${tile}px)`, gap }}>
            {cast.map((t) => (
              <Portrait key={t.id} t={t} on={selected === t.id} onPick={() => pick(t)} size={tile} />
            ))}
          </div>


          <form
            className="pointer-events-auto flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              void enter()
            }}
          >
            <div className={`grid gap-2 ${wide ? 'grid-cols-2' : 'grid-cols-1'}`}>
              <label className="flex flex-col">
                <span className="sr-only">Username (your doll's name)</span>
                <input value={name} maxLength={24} autoComplete="username" placeholder="Username (your doll's name)" onChange={(e) => setName(e.target.value)} aria-invalid={touched && !!nameError} className={field} />
              </label>
              <label className="flex flex-col">
                <span className="sr-only">Password</span>
                <input value={password} type="password" autoComplete="new-password" placeholder="Password (8+ characters)" onChange={(e) => setPassword(e.target.value)} aria-invalid={touched && !!passError} className={field} />
              </label>
            </div>
            <label className="flex flex-col gap-1">
              <span className="pl-4 text-[11px] font-extrabold uppercase tracking-[0.14em] text-white/85">Date of birth</span>
              <input type="date" required value={dob} max={today} min="1900-01-01" onChange={(e) => setDob(e.target.value)} aria-invalid={touched && !!dobError} aria-label="Date of birth" className={field} />
            </label>
            {/* Enter, full width under the date of birth */}
            <button
              type="submit"
              disabled={checking}
              aria-label={localError ? `Enter (${localError})` : 'Enter DollScene'}
              className="ds-cta pointer-events-auto mt-12 flex h-14 w-[62%] min-w-[200px] items-center justify-center gap-2 self-center rounded-2xl text-[18px] font-black tracking-tight disabled:opacity-60"
            >
              {checking ? 'Creating…' : 'Enter'}
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <p className="min-h-[1.2em] text-center text-[13px] font-bold text-[#ffd0dc]" role="alert" aria-live="polite">
              {shownError}
            </p>
            <button type="button" onClick={() => (click('tap'), setMode('signin'))} className="self-center text-[14px] font-bold text-white underline underline-offset-4">
              Sign in
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
