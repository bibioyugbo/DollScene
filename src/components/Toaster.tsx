import { cx } from '../lib/ui'
import { useToasts } from '../store/useToasts'

export function Toaster() {
  const toasts = useToasts((s) => s.toasts)
  const dismiss = useToasts((s) => s.dismiss)
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-0 z-[100] flex flex-col items-center gap-2 px-4 pt-safe">
      {toasts.map((t) => (
        <div
          key={t.id}
          role={t.tone === 'error' ? 'alert' : 'status'}
          className={cx(
            'pointer-events-auto mt-2 flex max-w-md items-center gap-3 rounded-full px-5 py-3 text-sm font-semibold shadow-[0_6px_20px_rgb(14_11_16/0.18)] motion-safe:animate-[toast-in_.2s_ease-out]',
            t.tone === 'error' ? 'bg-[#B3123F] text-white' : t.tone === 'success' ? 'bg-accent text-accent-foreground' : 'bg-foreground text-background',
          )}
        >
          <span>{t.text}</span>
          {t.action && (
            <button
              type="button"
              className="rounded-full bg-white/20 px-3 py-1 underline-offset-2 hover:underline"
              onClick={() => {
                t.action!.onClick()
                dismiss(t.id)
              }}
            >
              {t.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
