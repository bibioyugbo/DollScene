import { useCallback, useRef, useState } from 'react'

interface History<T> {
  past: T[]
  present: T
  future: T[]
}

/**
 * Undo/redo with coalescing: rapid changes that share a key (e.g. dragging one
 * slider) become a single undo step.
 */
export function useHistory<T>(initial: T) {
  const [h, setH] = useState<History<T>>({ past: [], present: initial, future: [] })
  const last = useRef<{ key: string; at: number } | null>(null)

  const set = useCallback((next: T, key?: string) => {
    const now = Date.now()
    const coalesce = !!key && last.current?.key === key && now - last.current.at < 700
    last.current = key ? { key, at: now } : null
    setH((cur) => (coalesce ? { ...cur, present: next } : { past: [...cur.past.slice(-60), cur.present], present: next, future: [] }))
  }, [])

  const undo = useCallback(() => {
    last.current = null
    setH((cur) => (cur.past.length ? { past: cur.past.slice(0, -1), present: cur.past[cur.past.length - 1], future: [cur.present, ...cur.future] } : cur))
  }, [])

  const redo = useCallback(() => {
    last.current = null
    setH((cur) => (cur.future.length ? { past: [...cur.past, cur.present], present: cur.future[0], future: cur.future.slice(1) } : cur))
  }, [])

  const reset = useCallback((value: T) => {
    last.current = null
    setH({ past: [], present: value, future: [] })
  }, [])

  return { value: h.present, set, undo, redo, reset, canUndo: h.past.length > 0, canRedo: h.future.length > 0 }
}
