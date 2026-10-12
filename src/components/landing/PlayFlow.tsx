import { lazy, Suspense, useId, useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { runAction } from '../../hooks/useAction'
import { track } from '../../lib/analytics'
import { backend, friendlyError } from '../../services/backend'
import { wearItem } from '../../shared/appearance'
import { CITIES, COUNTRIES } from '../../shared/cities'
import { STARTERS, starterAppearance } from '../../shared/starters'
import type { Appearance, HairStyleId, Outfit } from '../../shared/types'
import { useAppStore } from '../../store/useAppStore'
import { useSession } from '../../store/useSession'
import { toast } from '../../store/useToasts'
import { AuthModal, DobField, dobError } from '../AuthModal'

const DollStage = lazy(() => import('../../three/DollStage'))

/**
 * The toy-console button: a pink keycap sitting in a white socket, on a thick
 * raspberry slab, with a soft pink floor shadow. It breathes gently so it reads as "press me",
 * lifts on hover and sinks all the way into the socket when pressed.
 * Flat colours only: no highlights, no tinted undertones.
 */
export function RaisedButton({ children, onClick, className = '', size = 'md', disabled, icon, type = 'button' }: { children: ReactNode; onClick?: () => void; className?: string; size?: 'md' | 'xl'; disabled?: boolean; icon?: boolean; type?: 'button' | 'submit' }) {
  const big = size === 'xl'
  const depth = big ? 'pb-[16px]' : 'pb-[7px]'
  const r = big ? 'rounded-[40px]' : 'rounded-[22px]'
  const button = (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`group relative block w-full select-none outline-none disabled:opacity-50 ${r} ${depth} ${big ? 'motion-safe:animate-[btn-breathe_2.6s_ease-in-out_infinite] hover:animate-none' : ''}`}
    >
      {/* the slab: the keycap's thickness, with two notches so it reads as a solid block */}
      <span aria-hidden className={`absolute inset-x-0 bottom-0 bg-[#C21767] ${r} ${big ? 'top-[16px]' : 'top-[7px]'}`}>
        {big && (
          <>
            <span className="absolute bottom-[5px] left-[22%] h-[6px] w-[3px] rounded-full bg-white/25" />
            <span className="absolute right-[22%] bottom-[5px] h-[6px] w-[3px] rounded-full bg-white/25" />
          </>
        )}
      </span>
      {/* the face */}
      <span
        className={`font-spicy relative flex items-center justify-center gap-4 border-[#C21767] bg-primary leading-none text-white transition-transform duration-[90ms] ease-out group-focus-visible:outline-4 group-focus-visible:outline-offset-4 group-focus-visible:outline-[#C21767]/40 group-disabled:translate-y-0 ${r} ${
          big
            ? 'border-[4px] px-14 pt-5 pb-6 text-7xl group-hover:-translate-y-[4px] group-active:translate-y-[13px] md:px-20 md:text-8xl'
            : 'border-[3px] px-6 pt-2.5 pb-3 text-2xl group-hover:-translate-y-[2px] group-active:translate-y-[5px]'
        }`}
      >
        {icon && (
          <span aria-hidden className={`grid shrink-0 place-items-center rounded-full border-[3px] border-[#C21767] bg-white text-[#C21767] ${big ? 'size-16 md:size-20' : 'size-8'}`}>
            <svg viewBox="0 0 24 24" className={big ? 'ml-1 size-8 md:size-10' : 'ml-0.5 size-4'} fill="currentColor">
              <path d="M7 4.8c0-.9 1-1.5 1.8-1l11 6.9c.7.5.7 1.6 0 2l-11 6.9c-.8.5-1.8-.1-1.8-1z" />
            </svg>
          </span>
        )}
        {children}
      </span>
    </button>
  )
  if (!big) return <span className={`inline-block ${className}`}>{button}</span>
  // Big one sits in a white socket with a soft shadow on the floor.
  return (
    <span className={`inline-block rounded-[52px] border-[3px] border-[#FFB8D6] bg-white p-2.5 pb-3 shadow-[0_24px_30px_-14px_rgb(194_23_103/0.35)] ${className}`}>{button}</span>
  )
}

/**
 * Play → the globe slides left and the "Pick your doll" panel opens: pick one of
 * the default dolls, dress her a little, and join right beside her (username,
 * email, password) → age check → privacy choices → straight to the crib.
 */
export function usePlayFlow() {
  const [picking, setPicking] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)
  const status = useSession((s) => s.status)
  const onboarded = useSession((s) => !!s.profile?.onboarded)
  const navigate = useNavigate()

  const [launching, setLaunching] = useState(false)
  const play = () => {
    // Signed in already: the globe still slides away, then you land in your crib.
    if (status === 'signed-in' && onboarded) {
      if (launching) return
      setLaunching(true)
      window.setTimeout(() => navigate('/crib'), window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 700)
      return
    }
    setPicking(true)
  }
  /** Returning players: straight to the sign-in form. */
  const signIn = () => setAuthOpen(true)

  const ui = (
    <>
      {picking && <PickYourDoll onClose={() => setPicking(false)} onSignIn={signIn} />}
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} initialMode="signin" />
    </>
  )
  return { play, pick: play, needAuth: play, signIn, ui, picking, launching, covering: authOpen }
}

/* ------------------------------------------------------------ pick your doll */

const SKIN = ['#F1C9A5', '#C98B63', '#A86A46', '#7A4A2E', '#5A3420', '#3B2219', '#2E1A12']
const HAIR: { id: HairStyleId; label: string }[] = [
  { id: 'knotless-braids', label: 'Braids' },
  { id: 'silk-press', label: 'Silk press' },
  { id: 'afro', label: 'Afro' },
  { id: 'locs', label: 'Locs' },
  { id: 'bantu-knots', label: 'Bantu knots' },
  { id: 'puffs', label: 'Puffs' },
  { id: 'long-curly', label: 'Curls' },
  { id: 'ponytail', label: 'Pony' },
  { id: 'bob', label: 'Bob' },
  { id: 'cornrows', label: 'Cornrows' },
  { id: 'fade', label: 'Fade' },
  { id: 'buzz', label: 'Buzz' },
]
const HAIR_COLOR = ['#1B1214', '#4A2C21', '#7B4A2E', '#C9A227', '#E8D3A2', '#FF5FA2', '#A86BFF']

type Fit = 'yoruba' | 'igbo' | 'hausa' | 'street' | 'classy' | 'basic' | 'thrift' | 'edgy' | 'baddie' | 'gym' | 'soft'
const FITS: { id: Fit; label: string; emoji: string }[] = [
  { id: 'yoruba', label: 'Gele & oleku', emoji: '👑' },
  { id: 'igbo', label: 'Igbo drip', emoji: '📿' },
  { id: 'hausa', label: 'Hausa fit', emoji: '🌙' },
  { id: 'street', label: 'Streetwear', emoji: '🧢' },
  { id: 'classy', label: 'Classy', emoji: '🥂' },
  { id: 'basic', label: 'Basic', emoji: '👕' },
  { id: 'thrift', label: 'Thrift', emoji: '♻️' },
  { id: 'edgy', label: 'Edgy', emoji: '⛓️' },
  { id: 'baddie', label: 'Baddie', emoji: '💋' },
  { id: 'gym', label: 'Gym', emoji: '🏋🏾' },
  { id: 'soft', label: 'Soft girl', emoji: '🎀' },
]

/** Starter pieces for each fit. Masculine dolls get the men's version where it differs. */
function fitOutfit(fit: Fit, masc: boolean): Outfit {
  const o: Record<Fit, Outfit> = {
    yoruba: masc
      ? { headwear: 'starter-fila', top: 'starter-tee-white', outerwear: 'starter-agbada-white', bottom: 'starter-trousers-camel', shoes: 'starter-sandals' }
      : { headwear: 'starter-gele-gold', top: 'starter-buba-oleku', bottom: 'starter-iro-ankara', shoes: 'starter-sandals', earrings: 'starter-studs' },
    igbo: masc
      ? { headwear: 'starter-okpu-red', top: 'starter-isiagu', necklace: 'starter-coral-beads', bottom: 'starter-trousers-black', shoes: 'starter-sandals' }
      : { headwear: 'starter-gele-fuchsia', top: 'starter-igbo-blouse', bottom: 'starter-george-wrapper', necklace: 'starter-coral-beads', shoes: 'starter-sandals' },
    hausa: masc ? { dress: 'starter-kaftan-hausa', shoes: 'starter-sandals' } : { headwear: 'starter-dankwali', top: 'starter-hausa-crop', bottom: 'starter-zani-wrapper', shoes: 'starter-sandals' },
    street: { headwear: 'starter-bucket-hat', top: 'starter-graphic-tee', bottom: 'starter-cargo-black', shoes: masc ? 'starter-chunky-sneakers' : 'starter-sneakers-white', necklace: 'starter-chain-silver' },
    classy: masc
      ? { outerwear: 'starter-blazer-cream', top: 'starter-tee-black', bottom: 'starter-trousers-black', shoes: 'starter-loafers' }
      : { dress: 'starter-gown-emerald', shoes: 'starter-heels-nude', bag: 'starter-clutch-gold', earrings: 'starter-studs' },
    basic: { top: 'starter-tee-white', bottom: 'starter-jeans', shoes: masc ? 'starter-chunky-sneakers' : 'starter-sneakers-white' },
    thrift: { headwear: 'starter-bucket-hat', top: 'starter-check-shirt', bottom: 'starter-thrift-jeans', shoes: 'starter-boots', bag: 'starter-tote-canvas' },
    edgy: masc
      ? { outerwear: 'starter-leather-jacket', top: 'starter-tee-black', bottom: 'starter-cargo-black', shoes: 'starter-chunky-sneakers-black', necklace: 'starter-chain-silver' }
      : { outerwear: 'starter-leather-jacket', top: 'starter-corset-black', bottom: 'starter-mini-skirt-leather', shoes: 'starter-boots', necklace: 'starter-chain-silver' },
    baddie: masc
      ? { top: 'starter-tee-black', bottom: 'starter-jeans', shoes: 'starter-boots', necklace: 'starter-chain-silver', eyewear: 'starter-sunglasses' }
      : { top: 'starter-corset-black', bottom: 'starter-mini-skirt-leather', shoes: 'starter-heels-black', earrings: 'starter-hoops-gold', bag: 'starter-clutch-gold' },
    gym: masc
      ? { headwear: 'starter-cap-black', top: 'starter-tee-black', bottom: 'starter-shorts-denim', shoes: 'starter-chunky-sneakers' }
      : { headwear: 'starter-cap-black', top: 'starter-sports-bra', bottom: 'starter-leggings', shoes: 'starter-sneakers-black' },
    soft: { dress: 'starter-midi-dress-mint', shoes: 'starter-sandals', earrings: 'starter-studs' },
  }
  return o[fit]
}

const field = 'h-11 w-full rounded-2xl border-2 border-[#FFD3E5] bg-white px-4 text-base font-semibold text-ink outline-none placeholder:text-ink/35 focus:border-ink'
const label = 'mb-1.5 block text-xs font-bold tracking-wider text-ink/50 uppercase'

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`shrink-0 rounded-full border-2 px-3 py-1.5 text-xs font-bold whitespace-nowrap transition-transform active:scale-95 ${on ? 'border-ink bg-ink text-white' : 'border-[#FFD3E5] bg-white text-ink hover:border-ink'}`}
    >
      {children}
    </button>
  )
}

const cleanUsername = (u: string) => u.trim().replace(/^@/, '').toLowerCase()
const USERNAME_OK = /^[a-z0-9._]{3,20}$/

/**
 * The panel that slides in beside the globe. The doll takes the most room: flip
 * through the default dolls with the arrows or "New doll", tweak a few things, and
 * sign up on the right. Then an 18+ check before the
 * account is made, and privacy choices after, before moving into the crib.
 */
function PickYourDoll({ onClose, onSignIn }: { onClose: () => void; onSignIn: () => void }) {
  const [id, setId] = useState(STARTERS[0].id)
  const [dir, setDir] = useState<1 | -1>(1)
  const [look, setLook] = useState<Appearance>(() => starterAppearance(STARTERS[0].id))
  const [fit, setFit] = useState<Fit | null>(null)
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [phase, setPhase] = useState<'form' | 'age' | 'privacy'>('form')
  const [error, setError] = useState<string | null>(null)
  const status = useSession((s) => s.status)
  const hasProfile = useSession((s) => !!s.profile)
  const setOnboarding = useAppStore((s) => s.setOnboarding)
  const starter = STARTERS.find((s) => s.id === id)!
  const masc = look.base === 'masculine'
  const signedIn = status === 'signed-in' && hasProfile

  const index = STARTERS.findIndex((s) => s.id === id)
  const choose = (sid: string, d: 1 | -1 = 1) => {
    setDir(d)
    setId(sid)
    setLook(starterAppearance(sid))
    setFit(null)
  }
  const step = (d: 1 | -1) => choose(STARTERS[(index + d + STARTERS.length) % STARTERS.length].id, d)
  const shuffle = () => {
    let next = index
    while (next === index) next = Math.floor(Math.random() * STARTERS.length)
    choose(STARTERS[next].id)
  }
  const dress = (f: Fit) => {
    setFit(f)
    const outfit = Object.entries(fitOutfit(f, masc)).reduce<Outfit>((o, [slot, item]) => wearItem(o, slot as keyof Outfit, item as string), {})
    setLook({ ...look, outfit })
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (name.trim().length < 2) return setError('Name your doll first (2+ characters).')
    if (!USERNAME_OK.test(cleanUsername(username))) return setError('Usernames are 3–20 letters, numbers, dots or underscores.')
    if (signedIn) return setPhase('privacy')
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('That email doesn’t look right.')
    if (password.length < 6) return setError('Passwords need at least 6 characters.')
    // Keep the draft in case the tab reloads mid sign-up.
    setOnboarding({ starterId: id, appearance: look, step: 'customize', quickName: name.trim() })
    setPhase('age')
  }

  return (
    <aside
      aria-label="Pick your doll"
      className="fixed inset-x-0 bottom-0 z-40 flex max-h-[80dvh] flex-col overflow-hidden rounded-t-[32px] border-[3px] border-b-0 border-ink bg-white text-ink md:inset-x-auto md:top-4 md:right-4 md:bottom-4 md:max-h-none md:w-[min(1120px,76vw)] md:rounded-[32px] md:border-b-[3px] motion-safe:animate-[panel-in_.45s_cubic-bezier(.2,.9,.3,1.15)_both]"
    >
      <div className="flex items-center justify-between px-5 pt-4">
        <h2 className="font-spicy text-3xl">Pick your doll</h2>
        <button type="button" onClick={onClose} aria-label="Close" className="grid size-9 place-items-center rounded-full hover:bg-[#FFE3EF]">
          ✕
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto md:grid md:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)_280px] md:overflow-hidden">
        {/* ---- the doll: the star of the panel */}
        <div className="relative flex h-[52dvh] flex-col px-4 pb-3 md:h-auto md:min-h-0">
          <div className="relative min-h-0 flex-1 overflow-hidden rounded-[28px] bg-[radial-gradient(ellipse_at_50%_35%,#FFFFFF_0%,#FFE3EF_60%,#FFC9E0_100%)] shadow-[inset_0_-30px_60px_-30px_rgb(232_24_122/0.25)]">
            <div key={id} className={`absolute inset-0 ${dir === 1 ? 'motion-safe:animate-[doll-in-right_.35s_ease-out_both]' : 'motion-safe:animate-[doll-in-left_.35s_ease-out_both]'}`}>
              <Suspense fallback={<div className="grid h-full place-items-center text-sm text-ink/50">Dressing up…</div>}>
                <DollStage appearance={look} turntable focus="full" label={`${starter.name}, your doll`} />
              </Suspense>
            </div>
            {/* flip through the dolls */}
            {([-1, 1] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => step(d)}
                aria-label={d === -1 ? 'Previous doll' : 'Next doll'}
                className={`absolute top-1/2 grid size-12 -translate-y-1/2 place-items-center rounded-full border-[3px] border-[#C21767] bg-white text-2xl font-black text-[#C21767] shadow-[0_5px_0_#C21767] active:shadow-[0_1px_0_#C21767] ${d === -1 ? 'left-3' : 'right-3'}`}
              >
                {d === -1 ? '‹' : '›'}
              </button>
            ))}
            <div className="absolute inset-x-3 bottom-3 flex items-end justify-between gap-2">
              <div className="min-w-0 rounded-2xl bg-white/85 px-3 py-2 backdrop-blur">
                <p className="font-spicy text-2xl leading-none">{starter.name}</p>
                <p className="mt-0.5 line-clamp-2 text-[11px] font-semibold text-ink/65">{starter.blurb}</p>
              </div>
              <button type="button" onClick={shuffle} className="shrink-0 rounded-2xl border-[3px] border-[#C21767] bg-primary px-3 py-2 font-spicy text-base leading-none text-white shadow-[0_4px_0_#C21767] active:translate-y-[3px] active:shadow-[0_1px_0_#C21767]">
                ✨ New doll
              </button>
            </div>
          </div>
        </div>

        {/* ---- a few quick tweaks (smaller than the doll view) */}
        <div className="px-4 pb-4 md:min-h-0 md:overflow-y-auto md:pl-0">
          <p className={label}>Fit</p>
          <div className="flex flex-wrap gap-1.5">
            {FITS.map((f) => (
              <Chip key={f.id} on={fit === f.id} onClick={() => dress(f.id)}>
                {f.emoji} {f.label}
              </Chip>
            ))}
          </div>
          <p className={`${label} mt-3`}>Skin</p>
          <div className="flex flex-wrap gap-1.5">
            {SKIN.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Skin ${c}`}
                aria-pressed={look.skin.tone === c}
                onClick={() => setLook({ ...look, skin: { ...look.skin, tone: c, faceTone: null } })}
                className={`size-8 rounded-full border-[3px] transition-transform active:scale-90 ${look.skin.tone === c ? 'border-ink' : 'border-white ring-1 ring-[#FFD3E5]'}`}
                style={{ background: c }}
              />
            ))}
          </div>
          <p className={`${label} mt-3`}>Hair</p>
          <div className="flex flex-wrap gap-1.5">
            {HAIR.map((h) => (
              <Chip key={h.id} on={look.hair.style === h.id} onClick={() => setLook({ ...look, hair: { ...look.hair, style: h.id } })}>
                {h.label}
              </Chip>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {HAIR_COLOR.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Hair colour ${c}`}
                aria-pressed={look.hair.color === c}
                onClick={() => setLook({ ...look, hair: { ...look.hair, color: c, dye: { ...look.hair.dye, mode: 'solid', color2: c } } })}
                className={`size-7 rounded-full border-[3px] transition-transform active:scale-90 ${look.hair.color === c ? 'border-ink' : 'border-white ring-1 ring-[#FFD3E5]'}`}
                style={{ background: c }}
              />
            ))}
          </div>
          <p className="mt-3 text-xs text-ink/50">Everything else waits for you in the Makeover studio.</p>
        </div>

        {/* ---- sign up, right beside the doll */}
        <form onSubmit={submit} noValidate className="flex flex-col gap-3 border-t-2 border-[#FFE3EF] bg-[#FFF6FA] px-5 pt-4 pb-6 md:min-h-0 md:overflow-y-auto md:border-t-0 md:border-l-2">
          <div>
            <p className="text-[11px] font-black tracking-[0.18em] text-primary uppercase">18+ only</p>
            <h3 className="font-spicy text-2xl leading-tight">{signedIn ? 'Almost home' : 'Join the scene'}</h3>
          </div>
          <label>
            <span className={label}>Name your doll</span>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={24} placeholder={masc ? 'e.g. Tobi' : 'e.g. Tiwa'} className={field} />
          </label>
          <label>
            <span className={label}>Username</span>
            <input value={username} onChange={(e) => setUsername(e.target.value)} maxLength={21} autoCapitalize="none" autoComplete="username" placeholder="@yourname" className={field} />
          </label>
          {!signedIn && (
            <>
              <label>
                <span className={label}>Email</span>
                <input type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className={field} />
              </label>
              <label>
                <span className={label}>Password</span>
                <input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" className={field} />
              </label>
            </>
          )}
          {error && phase === 'form' && (
            <p role="alert" className="rounded-2xl bg-[#B3123F]/10 px-3 py-2 text-sm font-semibold text-[#B3123F]">
              {error}
            </p>
          )}
          <RaisedButton type="submit" className="mt-1 w-full">{signedIn ? 'Move in' : 'Sign up'}</RaisedButton>
          {!signedIn && (
            <p className="text-center text-sm">
              Got a doll already?{' '}
              <button type="button" onClick={onSignIn} className="font-bold underline">
                Sign in
              </button>
            </p>
          )}
          <p className="text-center text-[11px] text-ink/50">We’ll check your age before we make your account, then ask how visible you want to be.</p>
        </form>
      </div>

      {phase === 'age' && <AgeStep email={email} password={password} onBack={() => setPhase('form')} onDone={() => setPhase('privacy')} />}
      {phase === 'privacy' && <PrivacyStep name={name.trim()} username={cleanUsername(username)} starterId={id} appearance={look} onBack={signedIn ? () => setPhase('form') : undefined} />}
    </aside>
  )
}

function Sheet({ title, kicker, children }: { title: string; kicker: string; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#FFE3EF]/70 p-4 backdrop-blur-sm">
      <div role="dialog" aria-modal aria-label={title} className="flex max-h-[92dvh] w-full max-w-sm flex-col gap-4 overflow-y-auto rounded-[32px] border-[3px] border-ink bg-white p-6 text-ink shadow-[0_10px_0_#C21767] motion-safe:animate-[cloud-pop_.3s_ease-out_both]">
        <div>
          <p className="text-[11px] font-black tracking-[0.18em] text-primary uppercase">{kicker}</p>
          <h3 className="font-spicy text-3xl leading-tight">{title}</h3>
        </div>
        {children}
      </div>
    </div>
  )
}

/** Before the account exists: date of birth (18+, checked again on the server) and the rules. */
function AgeStep({ email, password, onBack, onDone }: { email: string; password: string; onBack: () => void; onDone: () => void }) {
  const [dob, setDob] = useState('')
  const [terms, setTerms] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const dobId = useId()

  const confirm = async () => {
    const err = dobError(dob) ?? (terms ? null : 'Please accept the Terms, Community Rules and Privacy Policy.')
    setError(err)
    if (err) return
    setBusy(true)
    const session = useSession.getState()
    try {
      session.set({ bootstrapping: true })
      const u = await backend().auth.signUpWithEmail(email.trim(), password)
      track('sign_up', { method: 'password' })
      const ok = await runAction('bootstrapUser', { email: u.email, dob, acceptTerms: true })
      if (!ok) {
        await backend().auth.signOut()
        return
      }
      onDone()
    } catch (e) {
      setError(friendlyError(e))
    } finally {
      useSession.getState().set({ bootstrapping: false })
      setBusy(false)
    }
  }

  return (
    <Sheet kicker="Before we make your account" title="Are you 18+?">
      <p className="rounded-2xl bg-[#FFF0F6] px-4 py-3 text-sm text-ink/75">DollScene is a grown-up character game with dating, parties and mature themes. Your birthday stays private.</p>
      <DobField id={dobId} value={dob} onChange={setDob} />
      <label className="flex items-start gap-3 rounded-2xl border-2 border-[#FFD3E5] px-4 py-3 text-sm">
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
      {error && (
        <p role="alert" className="rounded-2xl bg-[#B3123F]/10 px-3 py-2 text-sm font-semibold text-[#B3123F]">
          {error}
        </p>
      )}
      <div className="flex items-start gap-3">
        <RaisedButton onClick={confirm} disabled={busy} className="flex-1">
          {busy ? 'One sec…' : 'I’m 18+'}
        </RaisedButton>
        <button type="button" onClick={onBack} disabled={busy} className="min-h-11 rounded-2xl px-3 font-bold text-ink/60 hover:text-ink">
          Back
        </button>
      </div>
    </Sheet>
  )
}

/** After sign-up: how visible you want to be, then move in. */
function PrivacyStep({ name, username: initialUsername, starterId, appearance, onBack }: { name: string; username: string; starterId: string; appearance: Appearance; onBack?: () => void }) {
  const [username, setUsername] = useState(initialUsername)
  const [country, setCountry] = useState('Nigeria')
  const [city, setCity] = useState('Lagos')
  const [showLocation, setShowLocation] = useState(true)
  const [showOnline, setShowOnline] = useState(true)
  const [busy, setBusy] = useState(false)
  const setOnboarding = useAppStore((s) => s.setOnboarding)
  const navigate = useNavigate()
  const cities = CITIES.filter((c) => c.country === country)

  const moveIn = async () => {
    setBusy(true)
    const res = await runAction('completeOnboarding', {
      name,
      username: cleanUsername(username),
      bio: '',
      aesthetics: [],
      styleTag: 'New in town',
      appearance,
      city,
      country,
      portrait: null,
      privacy: { showLocation, showOnline, dms: 'everyone' },
    })
    setBusy(false)
    if (!res) return
    track('onboarding_complete', { starter: starterId, quick: true })
    setOnboarding(null)
    toast.success(`Welcome home, ${name}. Your load is on the way!`)
    navigate('/crib', { replace: true })
  }

  const toggle = (on: boolean, set: (v: boolean) => void, text: string, hint: string) => (
    <label className="flex items-center justify-between gap-3 rounded-2xl border-2 border-[#FFD3E5] px-4 py-2.5 text-sm">
      <span>
        <b className="block">{text}</b>
        <span className="text-xs text-ink/55">{hint}</span>
      </span>
      <input type="checkbox" checked={on} onChange={(e) => set(e.target.checked)} className="size-5 shrink-0 accent-[var(--primary)]" />
    </label>
  )

  return (
    <Sheet kicker="You’re in. One last thing" title="Your privacy">
      <label>
        <span className={label}>Username</span>
        <input value={username} onChange={(e) => setUsername(e.target.value)} maxLength={21} autoCapitalize="none" className={field} />
      </label>
      <label>
        <span className={label}>Where are you?</span>
        <div className="flex gap-2">
          <select
            value={country}
            onChange={(e) => {
              setCountry(e.target.value)
              setCity(CITIES.find((c) => c.country === e.target.value)?.name ?? '')
            }}
            className={field}
          >
            {COUNTRIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <select value={city} onChange={(e) => setCity(e.target.value)} className={field}>
            {cities.map((c) => (
              <option key={c.name}>{c.name}</option>
            ))}
          </select>
        </div>
      </label>
      {toggle(showLocation, setShowLocation, 'Show me on the globe', 'Only your city, never your real address.')}
      {toggle(showOnline, setShowOnline, 'Show when I’m online', 'Friends see a green dot.')}
      <div className="flex items-start gap-3">
        <RaisedButton onClick={moveIn} disabled={busy || !USERNAME_OK.test(cleanUsername(username))} className="flex-1">
          {busy ? 'Moving in…' : 'Move in'}
        </RaisedButton>
        {onBack && (
          <button type="button" onClick={onBack} disabled={busy} className="min-h-11 rounded-2xl px-3 font-bold text-ink/60 hover:text-ink">
            Back
          </button>
        )}
      </div>
    </Sheet>
  )
}
