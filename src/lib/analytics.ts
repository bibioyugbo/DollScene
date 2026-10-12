/**
 * Thin analytics wrapper. Events are buffered and sent to Firebase Analytics
 * when it is configured; in development they are logged.
 */
type Params = Record<string, string | number | boolean>

let sink: ((name: string, params?: Params) => void) | null = null

export function setAnalyticsSink(fn: (name: string, params?: Params) => void) {
  sink = fn
}

export function track(name: string, params?: Params) {
  if (sink) sink(name, params)
  else if (import.meta.env.DEV) console.debug('[analytics]', name, params ?? '')
}
