import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { APP_NAME } from '../config/env'
import { runAction } from '../hooks/useAction'
import { track } from '../lib/analytics'
import { buttonClass, cx, inputClass } from '../lib/ui'
import { backend, friendlyError } from '../services/backend'
import { ageFromDob, latestEligibleDob, MIN_AGE } from '../shared/age'
import { useSession } from '../store/useSession'
import { toast } from '../store/useToasts'

interface AuthModalProps {
  open: boolean
  onClose: () => void
  /** Runs after sign-in for players who already finished onboarding, instead of going to the dashboard. */
  onAuthed?: () => void
  title?: string
  initialMode?: 'signin' | 'signup'
}

function GoogleG() {
  return (
    <svg viewBox="0 0 48 48" className="size-5" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  )
}

/** Returns an error message, or null when the DOB is valid and 18+. */
export function dobError(dob: string): string | null {
  if (!dob) return 'Enter your date of birth.'
  const age = ageFromDob(dob, Date.now())
  if (age === null) return 'That date doesn’t look right.'
  if (age < MIN_AGE) return `${APP_NAME} is ${MIN_AGE}+ only. Come back when you’re ${MIN_AGE}.`
  return null
}

export function DobField({ value, onChange, id }: { value: string; onChange: (v: string) => void; id: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold">
        Date of birth <span className="font-normal text-muted-foreground">(you must be {MIN_AGE}+)</span>
      </label>
      <input id={id} type="date" required value={value} max={latestEligibleDob(Date.now())} min="1900-01-01" onChange={(e) => onChange(e.target.value)} className={inputClass} autoComplete="bday" />
      <p className="text-xs text-muted-foreground">Kept private. We use it only to confirm you’re an adult.</p>
    </div>
  )
}

/** Google or email/password. Sign-up requires a date of birth that proves 18+, checked again on the server. */
export function AuthModal({ open, onClose, onAuthed, title, initialMode = 'signup' }: AuthModalProps) {
  const dialog = useRef<HTMLDialogElement>(null)
  const navigate = useNavigate()
  const [mode, setMode] = useState(initialMode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [dob, setDob] = useState('')
  const [terms, setTerms] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [awaiting, setAwaiting] = useState(false)
  const titleId = useId()
  const emailId = useId()
  const pwId = useId()
  const dobId = useId()
  const profileLoaded = useSession((s) => s.profileLoaded)
  const profile = useSession((s) => s.profile)

  useEffect(() => {
    const d = dialog.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])

  useEffect(() => setMode(initialMode), [initialMode, open])

  // New players go straight into creating their alter ego; returning players to the dashboard.
  useEffect(() => {
    if (!awaiting || !profileLoaded || !profile) return
    setAwaiting(false)
    onClose()
    if (!profile.onboarded) navigate('/start')
    else if (onAuthed) onAuthed()
    else navigate('/crib')
  }, [awaiting, profileLoaded, profile, onClose, onAuthed, navigate])

  const checkSignup = (): boolean => {
    const err = dobError(dob)
    if (err) {
      setError(err)
      return false
    }
    if (!terms) {
      setError('Please accept the Terms and Community Rules.')
      return false
    }
    return true
  }

  const finish = async (signup: boolean, emailAddr: string | null) => {
    if (signup) {
      const ok = await runAction('bootstrapUser', { email: emailAddr, dob, acceptTerms: true })
      if (!ok) {
        useSession.getState().set({ bootstrapping: false })
        await backend().auth.signOut()
        return
      }
    }
    useSession.getState().set({ bootstrapping: false })
    setAwaiting(true)
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (mode === 'signup' && !checkSignup()) return
    setBusy(true)
    try {
      const auth = backend().auth
      if (mode === 'signup') {
        useSession.getState().set({ bootstrapping: true })
        const u = await auth.signUpWithEmail(email.trim(), password)
        track('sign_up', { method: 'password' })
        await finish(true, u.email)
      } else {
        await auth.signInWithEmail(email.trim(), password)
        track('login', { method: 'password' })
        await finish(false, null)
      }
    } catch (err) {
      useSession.getState().set({ bootstrapping: false })
      setError(friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  const google = async () => {
    setError(null)
    if (mode === 'signup' && !checkSignup()) return
    setBusy(true)
    try {
      if (mode === 'signup') useSession.getState().set({ bootstrapping: true })
      const u = await backend().auth.signInWithGoogle()
      track('login', { method: 'google' })
      const existing = await backend().db.get(`users/${u.uid}`)
      await finish(!existing && mode === 'signup', u.email)
    } catch (err) {
      useSession.getState().set({ bootstrapping: false })
      setError(friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  const reset = async () => {
    if (!email.trim()) {
      setError('Type your email first, then tap “Forgot password”.')
      return
    }
    try {
      await backend().auth.sendPasswordReset(email.trim())
      toast.success('Check your inbox for a reset link.')
    } catch (err) {
      setError(friendlyError(err))
    }
  }

  const heading = title ?? (mode === 'signup' ? 'Join the scene' : 'Welcome back')

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === dialog.current) onClose()
      }}
      className="m-0 mt-auto max-h-[94dvh] w-full max-w-none overflow-y-auto rounded-t-[var(--radius-sheet)] bg-card p-0 text-foreground backdrop:bg-[#0E0B10]/60 md:m-auto md:max-w-[440px] md:rounded-[var(--radius-sheet)]"
    >
      <form onSubmit={submit} className="flex flex-col gap-4 px-5 pt-6 pb-safe md:p-7" noValidate>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold tracking-[0.18em] text-primary uppercase">18+ only · Create your alter ego</p>
            <h2 id={titleId} className="font-display text-2xl font-extrabold tracking-tight">
              {heading}
            </h2>
          </div>
          <button type="button" onClick={onClose} className={buttonClass('ghost', 'md', 'px-3 -mr-2 -mt-1')}>
            Close
          </button>
        </div>

        {mode === 'signup' && (
          <>
            <DobField id={dobId} value={dob} onChange={setDob} />
            <label className="flex items-start gap-3 rounded-2xl border border-border bg-background px-4 py-3 text-sm">
              <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} className="mt-0.5 size-5 accent-[var(--primary)]" />
              <span>
                I agree to the{' '}
                <a href="/terms" target="_blank" className="font-semibold underline">
                  Terms
                </a>
                ,{' '}
                <a href="/rules" target="_blank" className="font-semibold underline">
                  Community Rules
                </a>{' '}
                and{' '}
                <a href="/privacy" target="_blank" className="font-semibold underline">
                  Privacy Policy
                </a>
                .
              </span>
            </label>
          </>
        )}

        <button type="button" onClick={google} disabled={busy} className={buttonClass('secondary', 'lg', 'w-full')}>
          <GoogleG /> {mode === 'signup' ? 'Join with Google' : 'Continue with Google'}
        </button>

        <div className="flex items-center gap-3 text-xs text-muted-foreground" aria-hidden>
          <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
        </div>

        <label htmlFor={emailId} className="-mb-2 text-sm font-semibold">
          Email
        </label>
        <input id={emailId} type="email" inputMode="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className={inputClass} />
        <label htmlFor={pwId} className="-mb-2 text-sm font-semibold">
          Password
        </label>
        <input
          id={pwId}
          type="password"
          autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 6 characters"
          className={inputClass}
        />
        {error && (
          <p role="alert" className="rounded-2xl bg-[#B3123F]/10 px-4 py-2 text-sm font-semibold text-[#B3123F] dark:text-[#FF8FAF]">
            {error}
          </p>
        )}
        <button type="submit" className={buttonClass('primary', 'lg', 'w-full')} disabled={busy || !email.trim() || password.length < 6}>
          {busy ? 'One sec…' : mode === 'signup' ? 'Join the scene' : 'Sign in'}
        </button>
        <div className={cx('flex items-center text-sm', mode === 'signin' ? 'justify-between' : 'justify-center')}>
          <button
            type="button"
            className="min-h-11 font-semibold text-secondary"
            onClick={() => {
              setError(null)
              setMode(mode === 'signup' ? 'signin' : 'signup')
            }}
          >
            {mode === 'signup' ? 'I already have an account' : 'New here? Join the scene'}
          </button>
          {mode === 'signin' && (
            <button type="button" className="min-h-11 text-muted-foreground" onClick={reset}>
              Forgot password
            </button>
          )}
        </div>
      </form>
    </dialog>
  )
}

/** Shown to signed-in players with no account record yet (e.g. a first Google sign-in). */
export function AgeGate() {
  const status = useSession((s) => s.status)
  const profileLoaded = useSession((s) => s.profileLoaded)
  const profile = useSession((s) => s.profile)
  const bootstrapping = useSession((s) => s.bootstrapping)
  const user = useSession((s) => s.user)
  const navigate = useNavigate()
  const [dob, setDob] = useState('')
  const [terms, setTerms] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ref = useRef<HTMLDialogElement>(null)
  const dobId = useId()
  const open = status === 'signed-in' && profileLoaded && !profile && !bootstrapping

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])

  const confirm = async () => {
    const err = dobError(dob) ?? (terms ? null : 'Please accept the Terms and Community Rules.')
    setError(err)
    if (err) return
    setBusy(true)
    const ok = await runAction('bootstrapUser', { email: user?.email ?? null, dob, acceptTerms: true })
    setBusy(false)
    if (ok) navigate('/start')
  }

  return (
    <dialog
      ref={ref}
      onCancel={(e) => e.preventDefault()}
      aria-labelledby="age-gate-title"
      className="m-0 mt-auto w-full max-w-none rounded-t-[var(--radius-sheet)] bg-card p-0 text-foreground backdrop:bg-[#0E0B10]/70 md:m-auto md:max-w-[420px] md:rounded-[var(--radius-sheet)]"
    >
      <div className="flex flex-col gap-4 px-5 pt-6 pb-safe md:p-7">
        <p className="text-[11px] font-bold tracking-[0.18em] text-primary uppercase">18+ only</p>
        <h2 id="age-gate-title" className="font-display text-2xl font-extrabold">
          Before you join the scene
        </h2>
        <p className="text-sm text-muted-foreground">{APP_NAME} has nightlife, dating and a Beauty Studio, so it’s for adults only.</p>
        <DobField id={dobId} value={dob} onChange={setDob} />
        <label className="flex items-start gap-3 rounded-2xl border border-border bg-background px-4 py-3 text-sm">
          <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} className="mt-0.5 size-5 accent-[var(--primary)]" />
          <span>I agree to the Terms, Community Rules and Privacy Policy.</span>
        </label>
        {error && (
          <p role="alert" className="rounded-2xl bg-[#B3123F]/10 px-4 py-2 text-sm font-semibold text-[#B3123F] dark:text-[#FF8FAF]">
            {error}
          </p>
        )}
        <button type="button" className={buttonClass('primary', 'lg', 'w-full')} disabled={busy} onClick={confirm}>
          Join the scene
        </button>
        <button type="button" className={buttonClass('ghost', 'md', 'w-full')} onClick={() => backend().auth.signOut()}>
          Sign out
        </button>
      </div>
    </dialog>
  )
}
