import { useEffect } from 'react'
import { useAppStore } from '../store/useAppStore'
import { useMediaQuery } from './useMediaQuery'

/** Resolved theme: the explicit choice, or the system preference. */
export function useResolvedTheme(): 'light' | 'dark' {
  const theme = useAppStore((s) => s.theme)
  const systemDark = useMediaQuery('(prefers-color-scheme: dark)')
  if (theme === 'system') return systemDark ? 'dark' : 'light'
  return theme
}

export function useApplyTheme() {
  const theme = useAppStore((s) => s.theme)
  useEffect(() => {
    const root = document.documentElement
    if (theme === 'system') delete root.dataset.theme
    else root.dataset.theme = theme
  }, [theme])
}
