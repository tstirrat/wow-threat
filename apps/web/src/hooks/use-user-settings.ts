/**
 * Firestore realtime hook for persisted per-user chart preferences.
 */
import { useAuth } from '@/auth/auth-provider'
import {
  type FirestoreDataConverter,
  doc,
  onSnapshot,
  setDoc,
} from 'firebase/firestore'
import { useEffect, useMemo, useState } from 'react'

import { getFirebaseFirestore } from '../lib/firebase'

export interface UserSettings {
  showPets: boolean
  showEnergizeEvents: boolean
}

const defaultUserSettings: UserSettings = {
  showPets: false,
  showEnergizeEvents: false,
}

interface StoredUserSettings {
  showPets?: boolean
  showEnergizeEvents?: boolean
}

const userSettingsConverter: FirestoreDataConverter<UserSettings> = {
  toFirestore(settings: UserSettings): StoredUserSettings {
    return {
      showPets: settings.showPets,
      showEnergizeEvents: settings.showEnergizeEvents,
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
    }
  },
}

export interface UpdateUserSettingsRequest {
  showPets?: boolean
  showEnergizeEvents?: boolean
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

/** Subscribe and persist signed-in user settings via Firestore realtime SDK. */
export function useUserSettings(): UseUserSettingsResult {
  const { authEnabled, user } = useAuth()
  const uid = user?.uid ?? null
  const firestore = getFirebaseFirestore()
  const [settings, setSettings] = useState<UserSettings>(defaultUserSettings)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [isSaving, setIsSaving] = useState<boolean>(false)
  const [error, setError] = useState<Error | null>(null)

  const documentRef = useMemo(() => {
    if (!authEnabled || !uid || !firestore) {
      return null
    }

    return doc(firestore, 'settings', uid).withConverter(userSettingsConverter)
  }, [authEnabled, firestore, uid])

  useEffect(() => {
    if (!documentRef) {
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
  }, [documentRef])

  return {
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
  }
}
