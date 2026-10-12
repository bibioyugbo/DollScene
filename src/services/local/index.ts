import { GameError } from '../../shared/server/db'
import { handlers, isHandlerName } from '../../shared/server/handlers'
import { BackendError, type Backend } from '../types'
import { createLocalAuth, deleteLocalAccount } from './localAuth'
import { createLocalDb, randomId } from './localDb'
import { createLocalServerDb } from './localServer'
import { createLocalStorage } from './blobStore'

export function createLocalBackend(): Backend {
  const auth = createLocalAuth()
  const db = createLocalDb()
  const serverDb = createLocalServerDb()

  return {
    mode: 'local',
    auth,
    db,
    storage: createLocalStorage(),
    push: {
      supported: () => typeof Notification !== 'undefined',
      async enable() {
        if (typeof Notification === 'undefined') return false
        return (await Notification.requestPermission()) === 'granted'
      },
    },
    async call(name, input) {
      if (!isHandlerName(name)) throw new BackendError('not-found', `Unknown action ${name}`)
      const user = auth.current()
      // seedDemo runs for guests too, so the globe is alive before sign-in.
      const uid = user?.uid ?? (name === 'seedDemo' ? 'system' : null)
      if (!uid) throw new BackendError('unauthenticated', 'Sign in first.')
      try {
        const fn = handlers[name] as (ctx: Parameters<typeof handlers.seedDemo>[0], i: unknown) => Promise<unknown>
        const result = await fn({ db: serverDb, uid, now: Date.now(), newId: () => randomId() }, input ?? {})
        if (name === 'deleteAccount') {
          deleteLocalAccount(uid)
          await auth.signOut()
        }
        return result as never
      } catch (e) {
        if (e instanceof GameError) throw new BackendError(e.code, e.message)
        throw e
      }
    },
  }
}
