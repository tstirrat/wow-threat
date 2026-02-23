/**
 * Firebase app/auth bootstrap for browser runtime.
 */
import { type FirebaseApp, initializeApp } from 'firebase/app'
import { type Auth, getAuth } from 'firebase/auth'
import { type Firestore, getFirestore } from 'firebase/firestore'

interface FirebaseRuntimeConfig {
  apiKey: string
  appId?: string
  authDomain: string
  measurementId?: string
  messagingSenderId?: string
  projectId: string
  storageBucket?: string
}

function readBooleanEnv(value: string | undefined): boolean {
  if (!value) {
    return false
  }

  const normalized = value.trim().toLowerCase()
  return (
    normalized === '1' ||
    normalized === 'true' ||
    normalized === 'yes' ||
    normalized === 'on'
  )
}

function readRequiredEnv(value: string | undefined): string | null {
  if (!value || value.trim().length === 0) {
    return null
  }

  return value
}

const isFirebaseAuthForceDisabled = readBooleanEnv(
  import.meta.env.VITE_DISABLE_AUTH,
)

function getFirebaseRuntimeConfig(): FirebaseRuntimeConfig | null {
  if (isFirebaseAuthForceDisabled) {
    return null
  }

  const apiKey = readRequiredEnv(import.meta.env.VITE_FIREBASE_API_KEY)
  const projectId = readRequiredEnv(import.meta.env.VITE_FIREBASE_PROJECT_ID)
  const authDomainEnv = readRequiredEnv(
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  )

  if (!apiKey || !projectId) {
    return null
  }

  return {
    apiKey,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    authDomain: authDomainEnv ?? `${projectId}.firebaseapp.com`,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    projectId,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  }
}

let firebaseApp: FirebaseApp | null = null
let firebaseAuth: Auth | null = null
let firebaseFirestore: Firestore | null = null

export const isFirebaseAuthEnabled: boolean = getFirebaseRuntimeConfig() != null

/** Get the singleton Firebase app instance when configured. */
export function getFirebaseApp(): FirebaseApp | null {
  const config = getFirebaseRuntimeConfig()
  if (!config) {
    return null
  }

  if (!firebaseApp) {
    firebaseApp = initializeApp(config)
  }

  return firebaseApp
}

/** Get the singleton Firebase Auth instance when configured. */
export function getFirebaseAuth(): Auth | null {
  const app = getFirebaseApp()
  if (!app) {
    return null
  }

  if (!firebaseAuth) {
    firebaseAuth = getAuth(app)
  }

  return firebaseAuth
}

/** Get the singleton Firestore instance when configured. */
export function getFirebaseFirestore(): Firestore | null {
  const app = getFirebaseApp()
  if (!app) {
    return null
  }

  if (!firebaseFirestore) {
    firebaseFirestore = getFirestore(app)
  }

  return firebaseFirestore
}
