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
import type { StarredReportEntry, WarcraftLogsHost } from '../types/app'

export interface UserSettings {
  showPets: boolean
  showEnergizeEvents: boolean
  inferThreatReduction: boolean
  starredReports: StarredReportEntry[]
}

const defaultUserSettings: UserSettings = {
  showPets: false,
  showEnergizeEvents: false,
  inferThreatReduction: false,
  starredReports: [],
}

interface StoredUserSettings {
  showPets?: boolean
  showEnergizeEvents?: boolean
  inferThreatReduction?: boolean
  starredReports?: unknown
}

const supportedWarcraftLogsHosts: WarcraftLogsHost[] = [
  'fresh.warcraftlogs.com',
  'sod.warcraftlogs.com',
  'vanilla.warcraftlogs.com',
]

function normalizeWarcraftLogsHost(value: unknown): WarcraftLogsHost | null {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = value.trim().toLowerCase()
  return supportedWarcraftLogsHosts.includes(normalized as WarcraftLogsHost)
    ? (normalized as WarcraftLogsHost)
    : null
}

function parseOptionalString(value: unknown): string | null | undefined {
  if (value === undefined) {
    return undefined
  }
  if (value === null) {
    return null
  }
  return typeof value === 'string' ? value : undefined
}

function parseOptionalNumber(value: unknown): number | null | undefined {
  if (value === undefined) {
    return undefined
  }
  if (value === null) {
    return null
  }
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function parseStarredReportEntry(value: unknown): StarredReportEntry | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const raw = value as Record<string, unknown>
  const reportId =
    typeof raw.reportId === 'string' ? raw.reportId.trim() : undefined
  const title = typeof raw.title === 'string' ? raw.title : undefined
  const sourceHost = normalizeWarcraftLogsHost(raw.sourceHost)
  const starredAt =
    typeof raw.starredAt === 'number' && Number.isFinite(raw.starredAt)
      ? raw.starredAt
      : undefined

  if (!reportId || !title || !sourceHost || starredAt === undefined) {
    return null
  }

  return {
    reportId,
    title,
    sourceHost,
    starredAt,
    zoneName: parseOptionalString(raw.zoneName),
    startTime: parseOptionalNumber(raw.startTime),
    bossKillCount: parseOptionalNumber(raw.bossKillCount),
    guildName: parseOptionalString(raw.guildName),
    guildFaction: parseOptionalString(raw.guildFaction),
  }
}

function normalizeStarredReports(value: unknown): StarredReportEntry[] {
  if (!Array.isArray(value)) {
    return []
  }

  const dedupedByReportId = new Map<string, StarredReportEntry>()
  value
    .map((entry) => parseStarredReportEntry(entry))
    .filter((entry): entry is StarredReportEntry => entry !== null)
    .sort((left, right) => right.starredAt - left.starredAt)
    .forEach((entry) => {
      if (!dedupedByReportId.has(entry.reportId)) {
        dedupedByReportId.set(entry.reportId, entry)
      }
    })

  return Array.from(dedupedByReportId.values())
}

function upsertStarredReport({
  current,
  report,
}: {
  current: StarredReportEntry[]
  report: Omit<StarredReportEntry, 'starredAt'> & { starredAt?: number }
}): StarredReportEntry[] {
  const nextEntry: StarredReportEntry = {
    ...report,
    starredAt:
      typeof report.starredAt === 'number' && Number.isFinite(report.starredAt)
        ? report.starredAt
        : Date.now(),
  }

  return [
    nextEntry,
    ...current.filter((entry) => entry.reportId !== nextEntry.reportId),
  ].sort((left, right) => right.starredAt - left.starredAt)
}

const userSettingsConverter: FirestoreDataConverter<UserSettings> = {
  toFirestore(settings: UserSettings): StoredUserSettings {
    return {
      showPets: settings.showPets,
      showEnergizeEvents: settings.showEnergizeEvents,
      inferThreatReduction: settings.inferThreatReduction,
      starredReports: settings.starredReports,
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
      starredReports: normalizeStarredReports(data.starredReports),
    }
  },
}

export interface UpdateUserSettingsRequest {
  showPets?: boolean
  showEnergizeEvents?: boolean
  inferThreatReduction?: boolean
  starredReports?: StarredReportEntry[]
}

export interface UseUserSettingsResult {
  settings: UserSettings
  isLoading: boolean
  isSaving: boolean
  error: Error | null
  updateSettings: (patch: UpdateUserSettingsRequest) => Promise<void>
  isReportStarred: (reportId: string) => boolean
  starReport: (
    report: Omit<StarredReportEntry, 'starredAt'> & { starredAt?: number },
  ) => Promise<void>
  unstarReport: (reportId: string) => Promise<void>
  toggleStarredReport: (
    report: Omit<StarredReportEntry, 'starredAt'> & { starredAt?: number },
  ) => Promise<void>
}

function buildNextSettings({
  current,
  patch,
}: {
  current: UserSettings
  patch: UpdateUserSettingsRequest
}): UserSettings {
  const nextStarredReports =
    patch.starredReports === undefined
      ? current.starredReports
      : normalizeStarredReports(patch.starredReports)

  return {
    ...current,
    ...patch,
    starredReports: nextStarredReports,
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

  const value = useMemo<UseUserSettingsResult>(() => {
    const updateSettings = async (patch: UpdateUserSettingsRequest) => {
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
    }

    return {
      settings,
      isLoading,
      isSaving,
      error,
      updateSettings,
      isReportStarred: (reportId: string) =>
        settings.starredReports.some((entry) => entry.reportId === reportId),
      starReport: async (report) => {
        await updateSettings({
          starredReports: upsertStarredReport({
            current: settings.starredReports,
            report,
          }),
        })
      },
      unstarReport: async (reportId: string) => {
        await updateSettings({
          starredReports: settings.starredReports.filter(
            (entry) => entry.reportId !== reportId,
          ),
        })
      },
      toggleStarredReport: async (report) => {
        const isStarred = settings.starredReports.some(
          (entry) => entry.reportId === report.reportId,
        )
        await updateSettings({
          starredReports: isStarred
            ? settings.starredReports.filter(
                (entry) => entry.reportId !== report.reportId,
              )
            : upsertStarredReport({
                current: settings.starredReports,
                report,
              }),
        })
      },
    }
  }, [documentRef, error, isLoading, isSaving, settings])

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
