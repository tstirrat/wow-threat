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
import type {
  StarredEntityEntry,
  StarredEntityType,
  StarredReportEntry,
  WarcraftLogsHost,
} from '../types/app'

export interface UserSettings {
  showPets: boolean
  showEnergizeEvents: boolean
  inferThreatReduction: boolean
  starredReports: StarredReportEntry[]
  starredEntities: StarredEntityEntry[]
}

const defaultUserSettings: UserSettings = {
  showPets: false,
  showEnergizeEvents: false,
  inferThreatReduction: false,
  starredReports: [],
  starredEntities: [],
}

interface StoredUserSettings {
  showPets?: boolean
  showEnergizeEvents?: boolean
  inferThreatReduction?: boolean
  starredReports?: unknown
  starredEntities?: unknown
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

function parseStarredEntityType(value: unknown): StarredEntityType | null {
  if (value !== 'guild' && value !== 'character') {
    return null
  }

  return value
}

function parseStarredEntityEntry(value: unknown): StarredEntityEntry | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const raw = value as Record<string, unknown>
  const entityType = parseStarredEntityType(raw.entityType)
  const entityId =
    typeof raw.entityId === 'string' ? raw.entityId.trim() : undefined
  const name = typeof raw.name === 'string' ? raw.name : undefined
  const sourceHost = normalizeWarcraftLogsHost(raw.sourceHost)
  const starredAt =
    typeof raw.starredAt === 'number' && Number.isFinite(raw.starredAt)
      ? raw.starredAt
      : undefined

  if (
    !entityType ||
    !entityId ||
    !name ||
    !sourceHost ||
    starredAt === undefined
  ) {
    return null
  }

  return {
    entityType,
    entityId,
    name,
    sourceHost,
    starredAt,
    faction: parseOptionalString(raw.faction),
    serverSlug: parseOptionalString(raw.serverSlug),
    serverRegion: parseOptionalString(raw.serverRegion),
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

function normalizeStarredEntities(value: unknown): StarredEntityEntry[] {
  if (!Array.isArray(value)) {
    return []
  }

  const dedupedByEntityKey = new Map<string, StarredEntityEntry>()
  value
    .map((entry) => parseStarredEntityEntry(entry))
    .filter((entry): entry is StarredEntityEntry => entry !== null)
    .sort((left, right) => right.starredAt - left.starredAt)
    .forEach((entry) => {
      const key = `${entry.entityType}:${entry.entityId}`
      if (!dedupedByEntityKey.has(key)) {
        dedupedByEntityKey.set(key, entry)
      }
    })

  return Array.from(dedupedByEntityKey.values())
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

function upsertStarredEntity({
  current,
  entity,
}: {
  current: StarredEntityEntry[]
  entity: Omit<StarredEntityEntry, 'starredAt'> & { starredAt?: number }
}): StarredEntityEntry[] {
  const nextEntry: StarredEntityEntry = {
    ...entity,
    starredAt:
      typeof entity.starredAt === 'number' && Number.isFinite(entity.starredAt)
        ? entity.starredAt
        : Date.now(),
  }

  return [
    nextEntry,
    ...current.filter(
      (entry) =>
        !(
          entry.entityType === nextEntry.entityType &&
          entry.entityId === nextEntry.entityId
        ),
    ),
  ].sort((left, right) => right.starredAt - left.starredAt)
}

const userSettingsConverter: FirestoreDataConverter<UserSettings> = {
  toFirestore(settings: UserSettings): StoredUserSettings {
    return {
      showPets: settings.showPets,
      showEnergizeEvents: settings.showEnergizeEvents,
      inferThreatReduction: settings.inferThreatReduction,
      starredReports: settings.starredReports,
      starredEntities: settings.starredEntities,
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
      starredEntities: normalizeStarredEntities(data.starredEntities),
    }
  },
}

export interface UpdateUserSettingsRequest {
  showPets?: boolean
  showEnergizeEvents?: boolean
  inferThreatReduction?: boolean
  starredReports?: StarredReportEntry[]
  starredEntities?: StarredEntityEntry[]
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
  isEntityStarred: (entityType: StarredEntityType, entityId: string) => boolean
  starEntity: (
    entity: Omit<StarredEntityEntry, 'starredAt'> & { starredAt?: number },
  ) => Promise<void>
  unstarEntity: (
    entityType: StarredEntityType,
    entityId: string,
  ) => Promise<void>
  toggleStarredEntity: (
    entity: Omit<StarredEntityEntry, 'starredAt'> & { starredAt?: number },
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
  const nextStarredEntities =
    patch.starredEntities === undefined
      ? current.starredEntities
      : normalizeStarredEntities(patch.starredEntities)

  return {
    ...current,
    ...patch,
    starredReports: nextStarredReports,
    starredEntities: nextStarredEntities,
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
      isEntityStarred: (entityType: StarredEntityType, entityId: string) =>
        settings.starredEntities.some(
          (entry) =>
            entry.entityType === entityType && entry.entityId === entityId,
        ),
      starEntity: async (entity) => {
        await updateSettings({
          starredEntities: upsertStarredEntity({
            current: settings.starredEntities,
            entity,
          }),
        })
      },
      unstarEntity: async (entityType, entityId) => {
        await updateSettings({
          starredEntities: settings.starredEntities.filter(
            (entry) =>
              !(entry.entityType === entityType && entry.entityId === entityId),
          ),
        })
      },
      toggleStarredEntity: async (entity) => {
        const isStarred = settings.starredEntities.some(
          (entry) =>
            entry.entityType === entity.entityType &&
            entry.entityId === entity.entityId,
        )
        await updateSettings({
          starredEntities: isStarred
            ? settings.starredEntities.filter(
                (entry) =>
                  !(
                    entry.entityType === entity.entityType &&
                    entry.entityId === entity.entityId
                  ),
              )
            : upsertStarredEntity({
                current: settings.starredEntities,
                entity,
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
