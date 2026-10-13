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
      className={`ds-arrow3d ${tone === 'accent' ? 'ds-arrow3d--accent' : ''} pointer-events-auto ${big ? 'h-16 min-w-16 px-6' : 'h-14 w-14'} disabled:pointer-events-none disabled:opacity-35`}
    >
      <span className="ds-arrow3d__face flex items-center justify-center gap-2">
        {children && dir === 'right' && <span className="text-[18px] font-extrabold">{children}</span>}
        <Icon name={dir === 'left' ? 'back' : 'next'} className={big ? 'h-7 w-7' : 'h-6 w-6'} />
        {children && dir === 'left' && <span className="text-[18px] font-extrabold">{children}</span>}
      </span>
    </button>
  )
}
