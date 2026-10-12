import { useResolvedTheme } from '../hooks/useApplyTheme'
import { useAppStore } from '../store/useAppStore'

export function ThemeToggle() {
  const resolved = useResolvedTheme()
  const setTheme = useAppStore((s) => s.setTheme)
  const next = resolved === 'dark' ? 'light' : 'dark'

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      className="grid size-11 place-items-center rounded-full border border-border bg-card/80 text-foreground hover:bg-muted"
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
    >
      {resolved === 'dark' ? (
        <svg aria-hidden viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="4.5" />
          <path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" />
        </svg>
      ) : (
        <svg aria-hidden viewBox="0 0 24 24" className="size-5" fill="currentColor">
          <path d="M20.5 14.6A8.5 8.5 0 0 1 9.4 3.5a8.5 8.5 0 1 0 11.1 11.1Z" />
        </svg>
      )}
    </button>
  )
}
