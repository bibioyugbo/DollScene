import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { AppShell, PageBody } from '../components/AppShell'
import { DollAvatar } from '../components/art/DollAvatar'
import { Modal } from '../components/Modal'
import { ChoiceChips, MultiChips, Select, Toggle } from '../components/Swatches'
import { APP_NAME, ENABLE_CLINIC } from '../config/env'
import { STYLE_TAGS } from '../data/customization'
import { runAction, useAction } from '../hooks/useAction'
import { useDoc } from '../hooks/useData'
import { buttonClass, cx, inputClass } from '../lib/ui'
import { backend } from '../services/backend'
import { CITIES, COUNTRIES } from '../shared/cities'
import { P } from '../shared/paths'
import type { Aesthetic, PrivacySettings, PublicDoll } from '../shared/types'
import { AESTHETICS } from '../shared/aesthetics'
import { useAppStore, type ThemeChoice } from '../store/useAppStore'
import { useSession } from '../store/useSession'
import { toast } from '../store/useToasts'

function BlockedRow({ uid }: { uid: string }) {
  const { data } = useDoc<PublicDoll>(P.publicDoll(uid))
  return (
    <li className="flex items-center gap-3 py-2">
      <DollAvatar avatar={data?.avatar} portrait={data?.portrait} size="sm" />
      <span className="flex-1 font-semibold">{data?.name ?? 'Unknown doll'}</span>
      <button type="button" className={buttonClass('secondary', 'sm')} onClick={() => runAction('unblock', { uid })}>
        Unblock
      </button>
    </li>
  )
}

export default function Settings() {
  const navigate = useNavigate()
  const user = useSession((s) => s.user)!
  const doll = useSession((s) => s.doll)!
  const pub = useSession((s) => s.publicDoll)
  const blocked = useSession((s) => s.blockedUids)
  const theme = useAppStore((s) => s.theme)
  const setTheme = useAppStore((s) => s.setTheme)
  const showClinic = useAppStore((s) => s.showClinic)
  const setShowClinic = useAppStore((s) => s.setShowClinic)
  const [name, setName] = useState(doll.name)
  const [country, setCountry] = useState(pub?.country ?? 'Nigeria')
  const [city, setCity] = useState(pub?.city ?? 'Lagos')
  const [styleTag, setStyleTag] = useState(pub?.styleTag ?? 'New in town')
  const [username, setUsername] = useState(pub?.username ?? '')
  const [bio, setBio] = useState(pub?.bio ?? '')
  const [aesthetics, setAesthetics] = useState<Aesthetic[]>(pub?.aesthetics ?? [])
  const [privacy, setPrivacy] = useState<PrivacySettings>(pub?.privacy ?? { showLocation: true, showOnline: true, dms: 'everyone' })
  const [del, setDel] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const save = useAction('saveAppearance')
  const b = backend()

  const exportData = async () => {
    const data = await runAction('exportData', undefined)
    if (!data) return
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${APP_NAME.toLowerCase()}-data-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <AppShell title="Settings">
      <PageBody className="flex max-w-2xl flex-col gap-6">
        <section className="flex flex-col gap-4 rounded-[var(--radius-sheet)] border border-border bg-card p-5">
          <h2 className="font-display text-lg font-bold">Profile</h2>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold">Display name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={24} className={inputClass} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold">Username</span>
            <span className="relative block">
              <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-muted-foreground">@</span>
              <input value={username} onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._]/g, ''))} maxLength={20} className={cx(inputClass, 'pl-9')} />
            </span>
          </label>
          <label className="block">
            <span className="mb-1.5 flex justify-between text-sm font-semibold">
              Bio <span className="font-normal text-muted-foreground">{bio.length}/160</span>
            </span>
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={160} rows={2} className={cx(inputClass, 'py-3')} />
          </label>
          <MultiChips label="Aesthetics (up to 4)" options={AESTHETICS.map((x) => ({ id: x.id, label: x.label, locked: aesthetics.length >= 4 && !aesthetics.includes(x.id) }))} value={aesthetics} onChange={setAesthetics} />
          <Select
            label="Country"
            value={country}
            options={COUNTRIES.map((c) => ({ value: c, label: c }))}
            onChange={(c) => {
              setCountry(c)
              setCity(CITIES.find((x) => x.country === c)?.name ?? '')
            }}
          />
          <Select label="City" value={city} options={CITIES.filter((c) => c.country === country).map((c) => ({ value: c.name, label: c.name }))} onChange={setCity} />
          <p className="-mt-2 text-xs text-muted-foreground">We only ever store and show your city. Your pin is placed at a random spot within it.</p>
          <h3 className="mt-2 font-display text-base font-bold">Privacy</h3>
          <Toggle label="Show my city" hint="Off hides your city on your profile and removes your pin from the globe." checked={privacy.showLocation} onChange={(showLocation) => setPrivacy({ ...privacy, showLocation })} />
          <Toggle label="Show when I’m online" checked={privacy.showOnline} onChange={(showOnline) => setPrivacy({ ...privacy, showOnline })} />
          <ChoiceChips
            label="Who can start a chat with me"
            options={[
              { id: 'everyone', label: 'Everyone (non-friends land in requests)' },
              { id: 'friends', label: 'Friends only' },
            ]}
            value={privacy.dms}
            onChange={(dms) => setPrivacy({ ...privacy, dms })}
          />
          <ChoiceChips label="Style tag" options={STYLE_TAGS.map((s) => ({ id: s, label: s }))} value={styleTag} onChange={setStyleTag} />
          <button
            type="button"
            className={buttonClass('primary', 'md', 'self-start')}
            disabled={save.pending}
            onClick={async () => {
              const r = await save.run({ appearance: doll.appearance, name, username, bio, aesthetics, privacy, city, country, styleTag })
              if (r) toast.success('Profile updated')
            }}
          >
            Save profile
          </button>
        </section>

        <section className="flex flex-col gap-3 rounded-[var(--radius-sheet)] border border-border bg-card p-5">
          <h2 className="font-display text-lg font-bold">App</h2>
          <ChoiceChips<ThemeChoice>
            label="Theme"
            options={[
              { id: 'system', label: 'System' },
              { id: 'light', label: 'Light' },
              { id: 'dark', label: 'Dark' },
            ]}
            value={theme}
            onChange={setTheme}
          />
          {ENABLE_CLINIC && <Toggle label="Show the Beauty Studio" hint="Optional, fictional treatments for adult avatars, in the customizer." checked={showClinic} onChange={setShowClinic} />}
          {b.push.supported() && (
            <button
              type="button"
              className={buttonClass('secondary', 'md', 'self-start')}
              onClick={async () => {
                const ok = await b.push.enable(user.uid).catch(() => false)
                if (ok) toast.success('Notifications on')
                else toast.error('Notifications are blocked in this browser.')
              }}
            >
              Turn on notifications
            </button>
          )}
          <p className="text-xs text-muted-foreground">Backend: {b.mode === 'firebase' ? 'Firebase' : 'Offline demo (this device only)'}</p>
        </section>

        <section className="flex flex-col gap-2 rounded-[var(--radius-sheet)] border border-border bg-card p-5">
          <h2 className="font-display text-lg font-bold">Blocked</h2>
          {blocked.length ? (
            <ul className="divide-y divide-border">
              {blocked.map((u) => (
                <BlockedRow key={u} uid={u} />
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">You haven’t blocked anyone.</p>
          )}
        </section>

        <section className="flex flex-col gap-3 rounded-[var(--radius-sheet)] border border-border bg-card p-5">
          <h2 className="font-display text-lg font-bold">Your data</h2>
          <p className="text-sm text-muted-foreground">
            Signed in as {user.email ?? 'Google account'}. Read our <Link to="/privacy" className="font-semibold underline">Privacy Policy</Link> and <Link to="/terms" className="font-semibold underline">Terms</Link>.
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={buttonClass('secondary', 'md')} onClick={exportData}>
              Download my data
            </button>
            <button
              type="button"
              className={buttonClass('secondary', 'md')}
              onClick={async () => {
                await b.auth.signOut()
                navigate('/')
              }}
            >
              Sign out
            </button>
            <button type="button" className={buttonClass('danger', 'md')} onClick={() => setDel(true)}>
              Delete account
            </button>
          </div>
        </section>
      </PageBody>

      <Modal open={del} onClose={() => setDel(false)} title="Delete your account?">
        <div className="flex flex-col gap-4">
          <p className="text-muted-foreground">This permanently deletes {doll.name}, your crib, closet, chats, posts and progress. It can’t be undone.</p>
          <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="Type DELETE to confirm" className={inputClass} aria-label="Type DELETE to confirm" />
          <div className="flex gap-3">
            <button type="button" className={buttonClass('secondary', 'lg', 'flex-1')} onClick={() => setDel(false)}>
              Cancel
            </button>
            <button
              type="button"
              className={buttonClass('danger', 'lg', 'flex-1')}
              disabled={confirmText !== 'DELETE'}
              onClick={async () => {
                const r = await runAction('deleteAccount', undefined)
                if (r) {
                  toast.success('Account deleted. Take care.')
                  navigate('/')
                }
              }}
            >
              Delete forever
            </button>
          </div>
        </div>
      </Modal>
    </AppShell>
  )
}
