import { useState } from 'react'
import { Link } from 'react-router'
import { buttonClass } from '../lib/ui'
import { useSession } from '../store/useSession'
import { DollAvatar } from './art/DollAvatar'
import { AuthModal } from './AuthModal'

export function AccountButton({ className = '' }: { className?: string }) {
  const status = useSession((s) => s.status)
  const pub = useSession((s) => s.publicDoll)
  const onboarded = useSession((s) => !!s.profile?.onboarded)
  const [open, setOpen] = useState(false)

  if (status === 'signed-in') {
    return (
      <Link to={onboarded ? '/crib' : '/start'} className={buttonClass('secondary', 'md', `pl-1.5 ${className}`)}>
        <DollAvatar avatar={pub?.avatar} portrait={pub?.portrait} size="xs" />
        {onboarded ? 'My scene' : 'Finish setup'}
      </Link>
    )
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={buttonClass('secondary', 'md', className)}>
        Sign in
      </button>
      <AuthModal open={open} onClose={() => setOpen(false)} initialMode="signin" />
    </>
  )
}
