import { useEffect, useId, useRef, type ReactNode } from 'react'
import { buttonClass, cx } from '../lib/ui'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  /** Hide the visible title (still labels the dialog). */
  hideTitle?: boolean
  wide?: boolean
  dismissable?: boolean
}

/** Bottom sheet on phones, centred dialog on tablets and up. */
export function Modal({ open, onClose, title, children, hideTitle, wide, dismissable = true }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault()
        if (dismissable) onClose()
      }}
      onClick={(e) => {
        if (dismissable && e.target === ref.current) onClose()
      }}
      className={cx(
        'm-0 mt-auto max-h-[92dvh] w-full max-w-none overflow-hidden rounded-t-[var(--radius-sheet)] bg-card p-0 text-foreground backdrop:bg-[#0E0B10]/50 md:m-auto md:rounded-[var(--radius-sheet)]',
        wide ? 'md:max-w-[640px]' : 'md:max-w-[420px]',
      )}
    >
      {open && (
        <div className="flex max-h-[92dvh] flex-col">
          <div className={cx('flex items-start justify-between gap-4 px-5 pt-5 md:px-6', hideTitle && 'sr-only')}>
            <h2 id={titleId} className="font-display text-xl font-bold">
              {title}
            </h2>
            {dismissable && (
              <button type="button" onClick={onClose} className={buttonClass('ghost', 'md', '-mt-2 -mr-2 px-3')}>
                Close
              </button>
            )}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-3 pb-safe md:px-6 md:pb-6">{children}</div>
        </div>
      )}
    </dialog>
  )
}
