import { initializeApp, type FirebaseApp } from 'firebase/app'
import {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type User,
} from 'firebase/auth'
import {
  arrayRemove,
  arrayUnion,
  collection,
  connectFirestoreEmulator,
  deleteField,
  doc,
  getDoc,
  getDocs,
  increment,
  initializeFirestore,
  limit,
  onSnapshot,
  orderBy,
  persistentLocalCache,
  persistentMultipleTabManager,
  query,
  setDoc,
  startAfter,
  where,
  writeBatch,
  type Firestore,
  type QueryConstraint,
} from 'firebase/firestore'
import { connectFunctionsEmulator, getFunctions, httpsCallable } from 'firebase/functions'
import { getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging'
import { connectStorageEmulator, deleteObject, getDownloadURL, getStorage, ref, uploadBytesResumable, uploadString } from 'firebase/storage'
import { firebaseConfig, FUNCTIONS_REGION, USE_EMULATORS, VAPID_KEY } from '../../config/env'
import { isFieldOp } from '../../shared/fieldOps'
import type { Query } from '../../shared/query'
import { BackendError, type AuthUser, type Backend, type ClientDB } from '../types'

let app: FirebaseApp | null = null

function toAuthUser(u: User): AuthUser {
  const google = u.providerData.some((p) => p.providerId === 'google.com')
  return { uid: u.uid, email: u.email, displayName: u.displayName, provider: google ? 'google' : 'password' }
}

/** Map our FieldOps to Firestore sentinels, recursively. */
function toFirestore(data: unknown): unknown {
  if (isFieldOp(data)) {
    switch (data.__op) {
      case 'inc':
        return increment(data.n)
      case 'union':
        return arrayUnion(...data.values)
      case 'remove':
        return arrayRemove(...data.values)
      case 'delete':
        return deleteField()
    }
  }
  if (Array.isArray(data)) return data.map(toFirestore)
  if (data && typeof data === 'object') {
    return Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined).map(([k, v]) => [k, toFirestore(v)]))
  }
  return data
}

function constraints(q: Query = {}): QueryConstraint[] {
  const out: QueryConstraint[] = []
  for (const [f, op, v] of q.where ?? []) out.push(where(f, op, v))
  if (q.orderBy) out.push(orderBy(q.orderBy[0], q.orderBy[1]))
  if (q.startAfter !== undefined) out.push(startAfter(q.startAfter))
  if (q.limit !== undefined) out.push(limit(q.limit))
  return out
}

function mapError(e: unknown): Error {
  const err = e as { code?: string; message?: string }
  const code = (err.code ?? 'unknown').replace(/^functions\//, '')
  return new BackendError(code, err.message ?? 'Something went wrong.')
}

function createDb(fs: Firestore): ClientDB {
  return {
    async get<T>(path: string) {
      const snap = await getDoc(doc(fs, path))
      return snap.exists() ? (snap.data() as T) : null
    },
    watch<T>(path: string, cb: (d: T | null) => void, onError?: (e: Error) => void) {
      return onSnapshot(
        doc(fs, path),
        (snap) => cb(snap.exists() ? (snap.data() as T) : null),
        (e) => onError?.(mapError(e)),
      )
    },
    async query<T>(col: string, q?: Query) {
      const snap = await getDocs(query(collection(fs, col), ...constraints(q)))
      return snap.docs.map((d) => d.data() as T)
    },
    watchQuery<T>(col: string, q: Query, cb: (docs: T[]) => void, onError?: (e: Error) => void) {
      return onSnapshot(
        query(collection(fs, col), ...constraints(q)),
        (snap) => cb(snap.docs.map((d) => d.data() as T)),
        (e) => onError?.(mapError(e)),
      )
    },
    async write(ops) {
      const batch = writeBatch(fs)
      for (const op of ops) {
        const r = doc(fs, op.path)
        if (op.type === 'set') batch.set(r, toFirestore(op.data) as object)
        else if (op.type === 'merge') batch.set(r, toFirestore(op.data) as object, { merge: true })
        else if (op.type === 'update') batch.update(r, toFirestore(op.data) as Record<string, unknown>)
        else batch.delete(r)
      }
      try {
        await batch.commit()
      } catch (e) {
        throw mapError(e)
      }
    },
    newId: () => doc(collection(fs, '_ids')).id,
  }
}

export function createFirebaseBackend(): Backend {
  app ??= initializeApp(firebaseConfig)
  const auth = getAuth(app)
  // Offline cache shared across tabs: chats and the world keep working on poor networks.
  const fs = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) })
  const storage = getStorage(app)
  const functions = getFunctions(app, FUNCTIONS_REGION)
  if (USE_EMULATORS) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
    connectFirestoreEmulator(fs, '127.0.0.1', 8080)
    connectStorageEmulator(storage, '127.0.0.1', 9199)
    connectFunctionsEmulator(functions, '127.0.0.1', 5001)
  }
  const db = createDb(fs)

  const wrapAuth = async <T>(p: Promise<T>) => {
    try {
      return await p
    } catch (e) {
      throw mapError(e)
    }
  }

  return {
    mode: 'firebase',
    db,
    auth: {
      current: () => (auth.currentUser ? toAuthUser(auth.currentUser) : null),
      onChange: (cb) => onAuthStateChanged(auth, (u) => cb(u ? toAuthUser(u) : null)),
      async signInWithGoogle() {
        const provider = new GoogleAuthProvider()
        try {
          const cred = await signInWithPopup(auth, provider)
          return toAuthUser(cred.user)
        } catch (e) {
          // Mobile browsers often block popups: fall back to a full-page redirect.
          if ((e as { code?: string }).code === 'auth/popup-blocked') {
            await signInWithRedirect(auth, provider)
          }
          throw mapError(e)
        }
      },
      signInWithEmail: async (email, password) => toAuthUser((await wrapAuth(signInWithEmailAndPassword(auth, email, password))).user),
      signUpWithEmail: async (email, password) => toAuthUser((await wrapAuth(createUserWithEmailAndPassword(auth, email, password))).user),
      sendPasswordReset: (email) => wrapAuth(sendPasswordResetEmail(auth, email)),
      signOut: () => signOut(auth),
    },
    storage: {
      upload(path, blob, onProgress) {
        return new Promise((resolve, reject) => {
          const task = uploadBytesResumable(ref(storage, path), blob, { contentType: blob.type })
          task.on(
            'state_changed',
            (s) => onProgress?.(s.totalBytes ? s.bytesTransferred / s.totalBytes : 0),
            (e) => reject(mapError(e)),
            async () => resolve(await getDownloadURL(task.snapshot.ref)),
          )
        })
      },
      async uploadDataUrl(path, dataUrl) {
        const r = ref(storage, path)
        await uploadString(r, dataUrl, 'data_url')
        return getDownloadURL(r)
      },
      resolve: async (url) => url,
      remove: (path) => deleteObject(ref(storage, path)),
    },
    push: {
      supported: () => 'serviceWorker' in navigator && 'Notification' in window && !!VAPID_KEY,
      async enable(uid) {
        if (!(await isSupported()) || !VAPID_KEY) return false
        if ((await Notification.requestPermission()) !== 'granted') return false
        const reg = await navigator.serviceWorker.register(`/firebase-messaging-sw.js?config=${encodeURIComponent(JSON.stringify(firebaseConfig))}`)
        const messaging = getMessaging(app!)
        const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: reg })
        if (!token) return false
        await setDoc(doc(fs, `users/${uid}`), { pushTokens: arrayUnion(token) }, { merge: true })
        onMessage(messaging, (payload) => {
          window.dispatchEvent(new CustomEvent('dollscene:push', { detail: payload.notification }))
        })
        return true
      },
    },
    async call(name, input) {
      try {
        const fn = httpsCallable(functions, name)
        const res = await fn(input ?? {})
        if (name === 'deleteAccount') await signOut(auth)
        return res.data as never
      } catch (e) {
        throw mapError(e)
      }
    },
  }
}
