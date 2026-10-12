import { useEffect, useState } from 'react'
import { backend } from '../services/backend'
import type { Query } from '../shared/query'

/** Live document. Pass null to skip. */
export function useDoc<T>(path: string | null): { data: T | null; loading: boolean; error: Error | null } {
  const [state, setState] = useState<{ path: string | null; data: T | null; loading: boolean; error: Error | null }>({
    path,
    data: null,
    loading: !!path,
    error: null,
  })
  useEffect(() => {
    if (!path) return
    return backend().db.watch<T>(
      path,
      (data) => setState({ path, data, loading: false, error: null }),
      (error) => setState({ path, data: null, loading: false, error }),
    )
  }, [path])
  // Ignore results from a previous path while the new one loads.
  if (state.path !== path) return { data: null, loading: !!path, error: null }
  return state
}

/** Live query. Pass null as collection to skip. `q` is compared by value. */
export function useQueryDocs<T>(collection: string | null, q: Query = {}): { data: T[]; loading: boolean; error: Error | null } {
  const key = collection ? `${collection}|${JSON.stringify(q)}` : null
  const [state, setState] = useState<{ key: string | null; data: T[]; loading: boolean; error: Error | null }>({
    key,
    data: [],
    loading: !!key,
    error: null,
  })
  useEffect(() => {
    if (!key || !collection) return
    const query = JSON.parse(key.slice(collection.length + 1)) as Query
    return backend().db.watchQuery<T>(
      collection,
      query,
      (data) => setState({ key, data, loading: false, error: null }),
      (error) => setState({ key, data: [], loading: false, error }),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  if (state.key !== key) return { data: [], loading: !!key, error: null }
  return state
}

/** Resolve a stored file URL (idb:// in offline mode) to something playable. */
export function useResolvedUrl(url: string | null | undefined): string | null {
  const [resolved, setResolved] = useState<{ url: string; out: string } | null>(null)
  useEffect(() => {
    if (!url) return
    if (!url.startsWith('idb://')) return
    let alive = true
    backend()
      .storage.resolve(url)
      .then((out) => alive && setResolved({ url, out }))
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [url])
  if (!url) return null
  if (!url.startsWith('idb://')) return url
  return resolved?.url === url ? resolved.out : null
}
