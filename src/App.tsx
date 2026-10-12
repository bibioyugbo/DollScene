import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation, useParams } from 'react-router'
import { RequireAuth, RequireOnboarded } from './app/guards'
import { AgeGate } from './components/AuthModal'
import { LevelUpCelebration } from './components/LevelUp'
import { SceneLoader } from './components/SceneLoader'
import { Toaster } from './components/Toaster'
import { useApplyTheme } from './hooks/useApplyTheme'
import { useReducedMotion } from './hooks/useMediaQuery'
import Landing from './pages/Landing'

const Start = lazy(() => import('./pages/Start'))
const Create = lazy(() => import('./pages/Create'))
const Home = lazy(() => import('./pages/Home'))
const BeautyDoctor = lazy(() => import('./pages/BeautyDoctor'))
const Shop = lazy(() => import('./pages/Shop'))
const Wardrobe = lazy(() => import('./pages/Wardrobe'))
const Work = lazy(() => import('./pages/Work'))
const Friends = lazy(() => import('./pages/Friends'))
const PhoneChat = lazy(() => import('./pages/PhoneChat'))
const Profile = lazy(() => import('./pages/Profile'))
const Feed = lazy(() => import('./pages/Feed'))
const Notifications = lazy(() => import('./pages/Notifications'))
const Settings = lazy(() => import('./pages/Settings'))
const DollSceneWorld = lazy(() => import('./pages/DollSceneWorld'))
const Challenges = lazy(() => import('./pages/Challenges'))
const Wallet = lazy(() => import('./pages/Wallet'))
const Rules = lazy(() => import('./pages/Rules'))
const Terms = lazy(() => import('./pages/Legal').then((m) => ({ default: m.Terms })))
const Privacy = lazy(() => import('./pages/Legal').then((m) => ({ default: m.Privacy })))

const game = (el: ReactNode) => <RequireOnboarded>{el}</RequireOnboarded>

/** Which of the four modules a path belongs to. Switching module plays the globe loader. */
function moduleOf(path: string): string {
  const seg = path.split('/')[1] ?? ''
  if (['crib', 'wardrobe', 'makeover', 'work'].includes(seg)) return 'crib'
  if (seg === 'friends') return 'chat'
  if (['shop', 'beauty-doctor'].includes(seg)) return 'drip'
  if (seg === 'dollscene') return 'dollscene'
  // Settings, wallet, profiles, the landing… are not modules: no full-screen loader.
  return ''
}

/** Soft, short, whole-screen "Spinning up the next scene" between modules. */
function ModuleTransition() {
  const { pathname } = useLocation()
  const reduced = useReducedMotion()
  const prev = useRef(moduleOf(pathname))
  const [phase, setPhase] = useState<'hidden' | 'in' | 'out'>('hidden')
  useEffect(() => {
    const next = moduleOf(pathname)
    if (next === prev.current) return
    const from = prev.current
    if (!next) return
    prev.current = next
    if (!from) return
    setPhase('in')
    const out = window.setTimeout(() => setPhase('out'), reduced ? 250 : 750)
    const hide = window.setTimeout(() => setPhase('hidden'), reduced ? 400 : 1050)
    return () => {
      window.clearTimeout(out)
      window.clearTimeout(hide)
    }
  }, [pathname, reduced])
  if (phase === 'hidden') return null
  return (
    <div className={phase === 'out' ? 'pointer-events-none fixed inset-0 z-[90] motion-safe:animate-[loader-out_.3s_ease-in_forwards]' : 'fixed inset-0 z-[90]'}>
      <SceneLoader overlay />
    </div>
  )
}

function Redirect({ to }: { to: (p: Record<string, string | undefined>) => string }) {
  const params = useParams()
  return <Navigate to={to(params)} replace />
}

export default function App() {
  useApplyTheme()
  return (
    <>
      <Suspense fallback={<div className="h-dvh w-full bg-background" />}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/start" element={<RequireAuth><Start /></RequireAuth>} />

          {/* Crib: home base */}
          <Route path="/crib" element={game(<Home />)} />
          <Route path="/crib/visit/:uid" element={game(<Home />)} />
          <Route path="/wardrobe" element={game(<Wardrobe />)} />
          <Route path="/makeover" element={game(<Create />)} />
          <Route path="/beauty-doctor" element={game(<BeautyDoctor />)} />
          <Route path="/work" element={game(<Work />)} />
          <Route path="/wallet" element={game(<Wallet />)} />

          {/* Shop */}
          <Route path="/shop" element={game(<Shop />)} />

          {/* Friends */}
          <Route path="/friends" element={game(<Friends />)} />
          <Route path="/friends/chat/:cid" element={game(<PhoneChat />)} />
          <Route path="/u/:uid" element={game(<Profile />)} />
          <Route path="/feed" element={game(<Feed />)} />
          <Route path="/notifications" element={game(<Notifications />)} />

          {/* DollScene: the Lagos world */}
          <Route path="/dollscene" element={game(<DollSceneWorld />)} />
          <Route path="/dollscene/runway" element={game(<Challenges />)} />

          <Route path="/settings" element={game(<Settings />)} />
          <Route path="/rules" element={<Rules />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />

          {/* Older paths */}
          <Route path="/home" element={<Navigate to="/crib" replace />} />
          <Route path="/home/:uid" element={<Redirect to={(p) => `/crib/visit/${p.uid}`} />} />
          <Route path="/dashboard" element={<Navigate to="/crib" replace />} />
          <Route path="/create" element={<Navigate to="/makeover" replace />} />
          <Route path="/people" element={<Navigate to="/friends" replace />} />
          <Route path="/messages" element={<Navigate to="/friends?tab=chats" replace />} />
          <Route path="/messages/:cid" element={<Redirect to={(p) => `/friends/chat/${p.cid}`} />} />
          <Route path="/challenges" element={<Navigate to="/dollscene/runway" replace />} />
          <Route path="/city" element={<Navigate to="/dollscene" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      <ModuleTransition />
      <AgeGate />
      <LevelUpCelebration />
      <Toaster />
    </>
  )
}
