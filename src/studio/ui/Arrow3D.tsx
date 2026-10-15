import type { ReactNode } from 'react'
import { Icon } from './icons'
import { click } from './sound'

/**
 * A chunky 3D button: a glossy face sitting on a visible base (depth), that presses down on tap
 * and clicks. Used for paging arrows and the big "next" action. Never a flat panel.
 */
export function Arrow3D({ dir, label, onClick, disabled, size = 'md', children, tone = 'light' }: { dir: 'left' | 'right'; label: string; onClick: () => void; disabled?: boolean; size?: 'md' | 'lg'; children?: ReactNode; tone?: 'light' | 'accent' }) {
  const big = size === 'lg'
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={() => {
        click(big ? 'go' : 'tap')
        onClick()
      }}
      className={`ds-arrow3d ${tone === 'accent' ? 'ds-arrow3d--accent' : ''} pointer-events-auto ${children ? `inline-flex shrink-0 items-start ${big ? 'h-16' : 'h-14'}` : big ? 'h-16 w-16' : 'h-14 w-14'} disabled:pointer-events-none disabled:opacity-35`}
    >
      <span className={`ds-arrow3d__face ${children ? 'ds-arrow3d__face--flow' : ''} flex items-center justify-center gap-2`}>
        {children && dir === 'right' && <span className="text-[clamp(16px,2.2vw,19px)] font-extrabold leading-none">{children}</span>}
        <Icon name={dir === 'left' ? 'back' : 'next'} className={big ? 'h-7 w-7' : 'h-6 w-6'} />
        {children && dir === 'left' && <span className="text-[clamp(16px,2.2vw,19px)] font-extrabold leading-none">{children}</span>}
      </span>
    </button>
  )
}
