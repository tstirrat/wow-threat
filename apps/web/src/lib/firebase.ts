/**
 * Firebase app/auth bootstrap for browser runtime.
 */
import { type FirebaseApp, initializeApp } from 'firebase/app'
import { type Auth, getAuth } from 'firebase/auth'

interface FirebaseRuntimeConfig {
  apiKey: string
  appId?: string
  authDomain: string
  measurementId?: string
  messagingSenderId?: string
  projectId: string
  storageBucket?: string
}

function readRequiredEnv(value: string | undefined): string | null {
  if (!value || value.trim().length === 0) {
    return null
  }

  return value
}

function getFirebaseRuntimeConfig(): FirebaseRuntimeConfig | null {
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

export const isFirebaseAuthEnabled: boolean = getFirebaseRuntimeConfig() != null

/** Get the singleton Firebase Auth instance when configured. */
export function getFirebaseAuth(): Auth | null {
  const config = getFirebaseRuntimeConfig()
  if (!config) {
    return null
  }

  if (!firebaseApp) {
    firebaseApp = initializeApp(config)
  }

  if (!firebaseAuth) {
    firebaseAuth = getAuth(firebaseApp)
  }

  return firebaseAuth
}
