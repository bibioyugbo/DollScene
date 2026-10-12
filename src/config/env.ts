/** Product name. Swap here (or with VITE_APP_NAME) if you rename the game. */
export const APP_NAME = import.meta.env.VITE_APP_NAME || 'DollScene'

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID ?? '',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID ?? '',
}

/**
 * Firebase is used when it is configured. Without keys the game runs on the
 * local backend (localStorage + IndexedDB, synced across tabs) so every
 * feature works offline for development and demos.
 */
export const USE_FIREBASE = !!firebaseConfig.apiKey && import.meta.env.VITE_BACKEND !== 'local'
export const USE_EMULATORS = import.meta.env.VITE_USE_EMULATORS === 'true'
export const FUNCTIONS_REGION = import.meta.env.VITE_FUNCTIONS_REGION || 'europe-west1'
export const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY ?? ''

/**
 * Real Nigerian label names (Meji Meji, Bolapsd, J Bottoms…) are shown by
 * default, marked "licence pending". Set VITE_USE_FICTIONAL_BRANDS=true to swap
 * in fictional labels until written permission is signed.
 */
export const USE_FICTIONAL_BRANDS = import.meta.env.VITE_USE_FICTIONAL_BRANDS === 'true'

/** Show the optional 18+ cosmetic clinic. */
export const ENABLE_CLINIC = import.meta.env.VITE_ENABLE_CLINIC !== 'false'
