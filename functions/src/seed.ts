/**
 * Seed the 60 demo dolls into Firestore.
 *   Emulator: FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 GCLOUD_PROJECT=demo-dollscene npm run seed
 *   Real project: GOOGLE_APPLICATION_CREDENTIALS=key.json npm run seed
 * The app also seeds automatically (callable `seedDemo`) when the world is empty.
 */
import { initializeApp } from 'firebase-admin/app'
import { createAdminDb, newId } from './adminDb'
import { handlers } from './shared/server/handlers'

initializeApp()

handlers
  .seedDemo({ db: createAdminDb(), uid: 'system', now: Date.now(), newId })
  .then((r) => {
    console.log(r.seeded ? `Seeded ${r.seeded} demo dolls.` : 'Demo dolls already exist, nothing to do.')
    process.exit(0)
  })
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
