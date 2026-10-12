import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { useSession } from '../store/useSession'

function Waiting() {
  return (
    <div className="grid h-dvh place-items-center bg-background" role="status" aria-label="Loading">
      <span aria-hidden className="size-14 rounded-full bg-primary/25 motion-safe:animate-pulse" />
    </div>
  )
}

/** Signed in with an account record. Sends guests to the landing page with the auth modal open. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const status = useSession((s) => s.status)
  const profileLoaded = useSession((s) => s.profileLoaded)
  const profile = useSession((s) => s.profile)
  const loc = useLocation()
  if (status === 'loading') return <Waiting />
  if (status === 'signed-out') return <Navigate to="/" replace state={{ auth: true, from: loc.pathname }} />
  if (!profileLoaded || !profile) return <Waiting />
  return <>{children}</>
}

/** Signed in and finished onboarding. */
export function RequireOnboarded({ children }: { children: ReactNode }) {
  const profile = useSession((s) => s.profile)
  const doll = useSession((s) => s.doll)
  const progress = useSession((s) => s.progress)
  return (
    <RequireAuth>
      {profile && !profile.onboarded ? <Navigate to="/start" replace /> : !doll || !progress ? <Waiting /> : children}
    </RequireAuth>
  )
}
