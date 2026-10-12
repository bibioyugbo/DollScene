/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_NAME?: string
  readonly VITE_BACKEND?: 'local' | 'firebase'
  readonly VITE_FIREBASE_API_KEY?: string
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string
  readonly VITE_FIREBASE_PROJECT_ID?: string
  readonly VITE_FIREBASE_STORAGE_BUCKET?: string
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID?: string
  readonly VITE_FIREBASE_APP_ID?: string
  readonly VITE_FIREBASE_MEASUREMENT_ID?: string
  readonly VITE_FIREBASE_VAPID_KEY?: string
  readonly VITE_FUNCTIONS_REGION?: string
  readonly VITE_USE_EMULATORS?: string
  readonly VITE_USE_FICTIONAL_BRANDS?: string
  readonly VITE_ENABLE_CLINIC?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
