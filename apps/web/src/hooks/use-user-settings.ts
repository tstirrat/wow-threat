/**
 * Firestore-backed context for persisted per-user chart preferences.
 */
import { useAuth } from '@/auth/auth-provider'
import {
  type FC,
  type FirestoreDataConverter,
  type PropsWithChildren,
  doc,
  onSnapshot,
  setDoc,
} from 'firebase/firestore'
import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'

import { getFirebaseFirestore } from '../lib/firebase'

export interface UserSettings {
  showPets: boolean
  showEnergizeEvents: boolean
  inferThreatReduction: boolean
}

const defaultUserSettings: UserSettings = {
  showPets: false,
  showEnergizeEvents: false,
  inferThreatReduction: false,
}

interface StoredUserSettings {
  showPets?: boolean
  showEnergizeEvents?: boolean
  inferThreatReduction?: boolean
}

const userSettingsConverter: FirestoreDataConverter<UserSettings> = {
  toFirestore(settings: UserSettings): StoredUserSettings {
    return {
      showPets: settings.showPets,
      showEnergizeEvents: settings.showEnergizeEvents,
      inferThreatReduction: settings.inferThreatReduction,
    }
  },
  fromFirestore(snapshot): UserSettings {
    const data = snapshot.data() as StoredUserSettings
    return {
      showPets:
        typeof data.showPets === 'boolean'
          ? data.showPets
          : defaultUserSettings.showPets,
      showEnergizeEvents:
        typeof data.showEnergizeEvents === 'boolean'
          ? data.showEnergizeEvents
          : defaultUserSettings.showEnergizeEvents,
      inferThreatReduction:
        typeof data.inferThreatReduction === 'boolean'
          ? data.inferThreatReduction
          : defaultUserSettings.inferThreatReduction,
    }
  },
}

export interface UpdateUserSettingsRequest {
  showPets?: boolean
  showEnergizeEvents?: boolean
  inferThreatReduction?: boolean
}

export interface UseUserSettingsResult {
  settings: UserSettings
  isLoading: boolean
  isSaving: boolean
  error: Error | null
  updateSettings: (patch: UpdateUserSettingsRequest) => Promise<void>
}

function buildNextSettings({
  current,
  patch,
}: {
  current: UserSettings
  patch: UpdateUserSettingsRequest
}): UserSettings {
  return {
    ...current,
    ...patch,
  }
}

const UserSettingsContext = createContext<UseUserSettingsResult | null>(null)

/** Provides user settings state for the application tree. */
export const UserSettingsProvider: FC<PropsWithChildren> = ({ children }) => {
  const { authEnabled, isInitializing, user } = useAuth()
  const uid = user?.uid ?? null
  const firestore = getFirebaseFirestore()
  const [settings, setSettings] = useState<UserSettings>(defaultUserSettings)
  const [isLoading, setIsLoading] = useState<boolean>(authEnabled)
  const [isSaving, setIsSaving] = useState<boolean>(false)
  const [error, setError] = useState<Error | null>(null)

  const documentRef = useMemo(() => {
    if (isInitializing || !authEnabled || !uid || !firestore) {
      return null
    }

    return doc(firestore, 'settings', uid).withConverter(userSettingsConverter)
  }, [authEnabled, firestore, isInitializing, uid])

  useEffect(() => {
    if (isInitializing) {
      setIsLoading(authEnabled)
      return
    }

    if (!authEnabled || !uid || !firestore || !documentRef) {
      setSettings(defaultUserSettings)
      setIsLoading(false)
      setError(null)
      return
    }

    setIsLoading(true)
    setError(null)

    const unsubscribe = onSnapshot(
      documentRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          setSettings(defaultUserSettings)
          setIsLoading(false)
          return
        }

        setSettings(snapshot.data())
        setIsLoading(false)
      },
      (snapshotError) => {
        setError(snapshotError)
        setIsLoading(false)
      },
    )

    return () => {
      unsubscribe()
    }
  }, [authEnabled, documentRef, firestore, isInitializing, uid])

  const value = useMemo<UseUserSettingsResult>(
    () => ({
      settings,
      isLoading,
      isSaving,
      error,
      updateSettings: async (patch: UpdateUserSettingsRequest) => {
        setError(null)
        const optimisticSettings = buildNextSettings({
          current: settings,
          patch,
        })
        const previousSettings = settings
        setSettings(optimisticSettings)

        if (!documentRef) {
          return
        }

        setIsSaving(true)

        try {
          await setDoc(documentRef, optimisticSettings, {
            merge: true,
          })
        } catch (writeError) {
          setSettings(previousSettings)
          setError(
            writeError instanceof Error
              ? writeError
              : new Error('Failed to update user settings'),
          )
        } finally {
          setIsSaving(false)
        }
      },
    }),
    [documentRef, error, isLoading, isSaving, settings],
  )

  return createElement(UserSettingsContext.Provider, { value }, children)
}

/** Reads the shared user settings state from context. */
export function useUserSettings(): UseUserSettingsResult {
  const context = useContext(UserSettingsContext)
  if (!context) {
    throw new Error('useUserSettings must be used within UserSettingsProvider')
  }

  return context
}
