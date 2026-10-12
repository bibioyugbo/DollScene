import { lazy, Suspense, useMemo, useRef, useState, type CSSProperties } from 'react'
import { ThoughtCloud } from '../components/landing/ThoughtCloud'
import { RaisedButton, usePlayFlow } from '../components/landing/PlayFlow'
import { SceneBackdrop } from '../components/landing/SceneBackdrop'
import { loadScene, saveScene, SCENES, type SceneId } from '../components/landing/scenes'
import { Logo } from '../components/Logo'
import { runAction } from '../hooks/useAction'
import { useQueryDocs } from '../hooks/useData'
import { useReducedMotion } from '../hooks/useMediaQuery'
import { C } from '../shared/paths'
import type { PublicDoll } from '../shared/types'
import { useSession } from '../store/useSession'
import { toast } from '../store/useToasts'
import { ErrorBoundary } from '../three/ErrorBoundary'

const EarthGlobe = lazy(() => import('../three/EarthGlobe'))

/** The landing: a toy earth full of dolls (pink by default, or another scene), and one big Play button. */
export default function Landing() {
  const reducedMotion = useReducedMotion()
  const signedIn = useSession((s) => s.status === 'signed-in' && !!s.profile?.onboarded)
  const me = useSession((s) => s.user?.uid)
  const hasAccount = useSession((s) => s.status === 'signed-in')
  const friends = useSession((s) => s.friendUids)
  const flow = usePlayFlow()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [flip, setFlip] = useState(false)
  const [sent, setSent] = useState<string[]>([])
  const [sceneId, setSceneId] = useState<SceneId>(loadScene)
  const scene = SCENES.find((x) => x.id === sceneId) ?? SCENES[0]
  const c = scene.chrome
  const nextScene = () => {
    const next = SCENES[(SCENES.indexOf(scene) + 1) % SCENES.length]
    setSceneId(next.id)
    saveScene(next.id)
  }
  const cloud = useRef<HTMLDivElement>(null)
  const { data } = useQueryDocs<PublicDoll>(C.publicDolls, { orderBy: ['lastActive', 'desc'], limit: 300 })
  const dolls = useMemo(() => data.filter((d) => d.uid !== me && d.privacy?.showLocation !== false && (d.lat !== 0 || d.lng !== 0)), [data, me])
  const selected = dolls.find((d) => d.uid === selectedId)

  // Keep the thought cloud pinned to the doll as the globe turns.
  const anchor = (x: number, y: number, visible: boolean) => {
    const el = cloud.current
    if (!el) return
    el.style.transform = `translate(${x}px, ${y}px)`
    el.style.visibility = visible ? 'visible' : 'hidden'
    const shouldFlip = x > window.innerWidth - 320
    if (shouldFlip !== flip) setFlip(shouldFlip)
  }

  const isFriend = !!selected && friends.includes(selected.uid)
  const befriend = async () => {
    if (!selected) return
    // New here: pick a default doll, dress her a little, then sign up.
    if (!signedIn) {
      setSelectedId(null)
      return flow.pick()
    }
    const r = await runAction('sendFriendRequest', { to: selected.uid })
    if (!r) return
    setSent((s) => [...s, selected.uid])
    toast.success(r.status === 'accepted' ? `You and ${selected.name.split(' ')[0]} are friends now` : `Friend request sent to ${selected.name.split(' ')[0]}`)
  }

  return (
    <div
      className={`relative h-dvh w-full overflow-hidden ${scene.dark ? 'text-white [--foreground:#FFFFFF]' : 'force-light text-ink'}`}
      style={{ '--logo-box': c.logoBox, '--chip-face': c.face, '--chip-edge': c.edge, '--chip-text': c.text } as CSSProperties}
    >
      <SceneBackdrop key={scene.id} scene={scene.id} reducedMotion={reducedMotion} />
      {/* When the doll panel opens, the world slides left (up on phones) to make room. */}
      <div
        className={`absolute inset-0 z-[1] transition-[transform,opacity] duration-700 ease-[cubic-bezier(.2,.9,.3,1.1)] ${flow.picking ? '-translate-y-[26%] scale-[.66] md:translate-y-0 md:-translate-x-[38%] md:scale-[.72]' : flow.launching ? '-translate-x-[60%] scale-[.6] opacity-0' : ''}`}
      >
        <ErrorBoundary fallback={<div className="grid h-full place-items-center text-sm text-ink/60">3D isn’t available on this device.</div>}>
          <Suspense fallback={null}>
            <EarthGlobe
              dolls={dolls}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onClear={() => setSelectedId(null)}
              paused={!!selected}
              reducedMotion={reducedMotion}
              onAnchor={anchor}
              frozen={flow.covering}
              palette={scene.earth}
            />
          </Suspense>
        </ErrorBoundary>
        {selected && !flow.picking && (
          <ThoughtCloud
            key={selected.uid}
            ref={cloud}
            doll={selected}
            flip={flip}
            befriendLabel={isFriend ? 'Friends ✓' : sent.includes(selected.uid) ? 'Request sent' : 'Befriend'}
            befriendDisabled={isFriend || sent.includes(selected.uid)}
            onBefriend={befriend}
            onClose={() => setSelectedId(null)}
          />
        )}
      </div>

      <header className="pointer-events-none absolute inset-x-0 top-0 z-[2] flex items-center justify-between gap-2 px-4 pt-safe md:px-8 md:pt-6">
        <div className="pointer-events-auto">
          <Logo />
        </div>
        <div className="pointer-events-auto flex items-center gap-2">
          <button
            type="button"
            onClick={nextScene}
            aria-label={`Change the scene (now ${scene.label})`}
            className="min-h-11 rounded-2xl border-2 border-[color:var(--chip-edge)] bg-[color:var(--chip-face)] px-4 text-sm font-black text-[color:var(--chip-text)] shadow-[0_3px_0_var(--chip-edge)] transition-[transform,box-shadow,background-color,color] duration-300 active:translate-y-[2px] active:shadow-[0_1px_0_var(--chip-edge)]"
          >
            {scene.emoji} Change the scene
          </button>
          <span
            title="Adults only"
            className="grid h-11 place-items-center rounded-2xl border-2 border-[color:var(--chip-edge)] bg-[color:var(--chip-face)] px-3 font-brand text-base font-black text-[color:var(--chip-text)] shadow-[0_3px_0_var(--chip-edge)] transition-colors duration-300"
          >
            18+
          </span>
        </div>
      </header>

      {!flow.picking && !flow.launching && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] flex flex-col items-center gap-3 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] md:pb-10">
          <RaisedButton size="xl" icon onClick={flow.play} className="pointer-events-auto">
            Play
          </RaisedButton>
          <p className={`text-xs font-semibold ${scene.dark ? 'text-white/60' : 'text-ink/50'}`}>
            Drag the world · tap a doll
            {!hasAccount && (
              <>
                {' · '}
                <button type="button" onClick={flow.signIn} className="pointer-events-auto font-bold underline">
                  Sign in
                </button>
              </>
            )}
          </p>
        </div>
      )}

      {flow.ui}
    </div>
  )
}
