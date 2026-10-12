import { useSyncExternalStore } from 'react'

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query)
      mql.addEventListener('change', onChange)
      return () => mql.removeEventListener('change', onChange)
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}

/** Matches the `split` Tailwind variant in index.css. */
export const SPLIT_QUERY = '(min-width: 64rem), (orientation: landscape) and (max-height: 31.2rem)'
export const TABLET_QUERY = '(min-width: 46.5rem)'
export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

export function useLayout() {
  const split = useMediaQuery(SPLIT_QUERY)
  const tablet = useMediaQuery(TABLET_QUERY)
  return { split, tablet, layout: split ? ('split' as const) : ('stack' as const) }
}

export function useReducedMotion(): boolean {
  return useMediaQuery(REDUCED_MOTION_QUERY)
}
