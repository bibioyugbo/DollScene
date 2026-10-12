import { useCallback, useState } from 'react'
import { backend, friendlyError } from '../services/backend'
import type { HandlerInput, HandlerName, HandlerResult } from '../shared/server/handlers'
import { toast } from '../store/useToasts'
import { track } from '../lib/analytics'

/** Call a server action; errors become toasts. Resolves to null on failure. */
export async function runAction<K extends HandlerName>(name: K, input: HandlerInput<K>, opts: { silent?: boolean } = {}): Promise<HandlerResult<K> | null> {
  try {
    const result = await backend().call(name, input)
    track(`action_${name}`)
    return result
  } catch (e) {
    if (!opts.silent) toast.error(friendlyError(e))
    return null
  }
}

export function useAction<K extends HandlerName>(name: K) {
  const [pending, setPending] = useState(false)
  const run = useCallback(
    async (input: HandlerInput<K>) => {
      setPending(true)
      try {
        return await runAction(name, input)
      } finally {
        setPending(false)
      }
    },
    [name],
  )
  return { run, pending }
}
