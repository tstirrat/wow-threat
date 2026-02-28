/**
 * Helpers for building and searching merged report-index documents.
 */
import Fuse from 'fuse.js'

import type { RecentReportSummary } from '../types/api'
import type {
  RecentReportEntry,
  StarredGuildReportEntry,
  StarredReportEntry,
  WarcraftLogsHost,
} from '../types/app'
import { defaultHost, exampleReports } from './constants'
import type {
  ReportSearchDocument,
  ReportSearchSourceTag,
} from './report-search-index-cache'

const sourcePriority: Record<ReportSearchSourceTag, number> = {
  starred: 5,
  recent: 4,
  guild: 3,
  personal: 2,
  example: 1,
}

const zoneBossAliasMap: Record<string, string[]> = {
  karazhan: [
    'Attumen',
    'Moroes',
    'Maiden',
    'Opera',
    'Curator',
    'Terestian',
    'Shade of Aran',
    'Netherspite',
    'Chess',
    'Prince Malchezaar',
    'Nightbane',
  ],
  naxxramas: [
    'AnubRekhan',
    'Faerlina',
    'Maexxna',
    'Noth',
    'Heigan',
    'Loatheb',
    'Razuvious',
    'Gothik',
    'Horsemen',
    'Patchwerk',
    'Grobbulus',
    'Gluth',
    'Thaddius',
    'Sapphiron',
    'KelThuzad',
  ],
  'gruul / magtheridon': ['Gruul', 'Magtheridon'],
}

interface MutableReportSearchDocument extends ReportSearchDocument {
  aliasSet: Set<string>
  sourceTagSet: Set<ReportSearchSourceTag>
}

export type ReportSearchMatchField =
  | 'guildName'
  | 'reportId'
  | 'title'
  | 'zoneName'

export type ReportSearchMatchRange = [number, number]

export interface ReportSearchSuggestion extends ReportSearchDocument {
  matchedAliases: string[]
  matchRanges: Partial<Record<ReportSearchMatchField, ReportSearchMatchRange[]>>
}

export interface BuildReportSearchDocumentsInput {
  starredReports: StarredReportEntry[]
  recentReports: RecentReportEntry[]
  personalReports: RecentReportSummary[]
  guildReports: StarredGuildReportEntry[]
  includeExamples: boolean
}

function normalizeAlias(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = value.trim()
  if (normalized.length === 0) {
    return null
  }

  return normalized
}

function normalizeLookupKey(value: string): string {
  return value.trim().toLowerCase()
}

function resolveZoneBossAliases(zoneName: string | null | undefined): string[] {
  if (!zoneName) {
    return []
  }

  return zoneBossAliasMap[normalizeLookupKey(zoneName)] ?? []
}

function resolveSourceLabel(host: WarcraftLogsHost): string {
  return host.split('.')[0]?.toLowerCase() ?? 'unknown'
}

function resolveSortTimestamp(document: ReportSearchDocument): number {
  return (
    document.startTime ??
    document.lastOpenedAt ??
    document.starredAt ??
    Number.MIN_SAFE_INTEGER
  )
}

function resolveBestSourcePriority(
  sourceTags: ReportSearchSourceTag[],
): number {
  return sourceTags.reduce(
    (best, sourceTag) => Math.max(best, sourcePriority[sourceTag]),
    0,
  )
}

function compareDocuments(
  left: ReportSearchDocument,
  right: ReportSearchDocument,
): number {
  const leftSourcePriority = resolveBestSourcePriority(left.sourceTags)
  const rightSourcePriority = resolveBestSourcePriority(right.sourceTags)
  if (leftSourcePriority !== rightSourcePriority) {
    return rightSourcePriority - leftSourcePriority
  }

  const leftTimestamp = resolveSortTimestamp(left)
  const rightTimestamp = resolveSortTimestamp(right)
  if (leftTimestamp !== rightTimestamp) {
    return rightTimestamp - leftTimestamp
  }

  return left.reportId.localeCompare(right.reportId)
}

const reportSearchFuseOptions: Fuse.IFuseOptions<ReportSearchDocument> = {
  includeMatches: true,
  includeScore: true,
  ignoreLocation: true,
  threshold: 0.38,
  keys: [
    {
      name: 'reportId',
      weight: 0.4,
    },
    {
      name: 'title',
      weight: 0.28,
    },
    {
      name: 'guildName',
      weight: 0.14,
    },
    {
      name: 'zoneName',
      weight: 0.1,
    },
    {
      name: 'aliases',
      weight: 0.08,
    },
  ],
}

function createBaseDocument(input: {
  reportId: string
  title: string
  sourceHost: WarcraftLogsHost
  guildName?: string | null
  guildFaction?: string | null
  zoneName?: string | null
  startTime?: number | null
  endTime?: number | null
  bossKillCount?: number | null
  lastOpenedAt?: number | null
  starredAt?: number | null
  sourceTag: ReportSearchSourceTag
}): MutableReportSearchDocument {
  const aliases = new Set<string>([
    input.reportId,
    input.title,
    resolveSourceLabel(input.sourceHost),
    input.sourceTag,
  ])
  const guildAlias = normalizeAlias(input.guildName)
  if (guildAlias) {
    aliases.add(guildAlias)
  }
  const zoneAlias = normalizeAlias(input.zoneName)
  if (zoneAlias) {
    aliases.add(zoneAlias)
  }
  resolveZoneBossAliases(input.zoneName).forEach((bossAlias) => {
    aliases.add(bossAlias)
  })

  if (
    typeof input.bossKillCount === 'number' &&
    Number.isFinite(input.bossKillCount)
  ) {
    aliases.add(String(input.bossKillCount))
    aliases.add(
      input.bossKillCount === 1 ? '1 boss' : `${input.bossKillCount} bosses`,
    )
  }

  return {
    reportId: input.reportId,
    title: input.title,
    sourceHost: input.sourceHost,
    guildName: input.guildName ?? null,
    guildFaction: input.guildFaction ?? null,
    zoneName: input.zoneName ?? null,
    startTime:
      typeof input.startTime === 'number' && Number.isFinite(input.startTime)
        ? input.startTime
        : null,
    endTime:
      typeof input.endTime === 'number' && Number.isFinite(input.endTime)
        ? input.endTime
        : null,
    bossKillCount:
      typeof input.bossKillCount === 'number' &&
      Number.isFinite(input.bossKillCount)
        ? input.bossKillCount
        : null,
    lastOpenedAt:
      typeof input.lastOpenedAt === 'number' &&
      Number.isFinite(input.lastOpenedAt)
        ? input.lastOpenedAt
        : null,
    starredAt:
      typeof input.starredAt === 'number' && Number.isFinite(input.starredAt)
        ? input.starredAt
        : null,
    sourceTags: [input.sourceTag],
    aliases: [],
    aliasSet: aliases,
    sourceTagSet: new Set([input.sourceTag]),
  }
}

function mergeDocument(
  current: MutableReportSearchDocument,
  next: MutableReportSearchDocument,
): MutableReportSearchDocument {
  const currentPriority = resolveBestSourcePriority([...current.sourceTagSet])
  const nextPriority = resolveBestSourcePriority([...next.sourceTagSet])

  next.aliasSet.forEach((alias) => {
    current.aliasSet.add(alias)
  })
  next.sourceTagSet.forEach((sourceTag) => {
    current.sourceTagSet.add(sourceTag)
  })

  if (!current.title && next.title) {
    current.title = next.title
  }
  if (!current.guildName && next.guildName) {
    current.guildName = next.guildName
  }
  if (!current.zoneName && next.zoneName) {
    current.zoneName = next.zoneName
  }
  if (!current.guildFaction && next.guildFaction) {
    current.guildFaction = next.guildFaction
  }
  if (current.startTime === null && next.startTime !== null) {
    current.startTime = next.startTime
  }
  if (current.endTime === null && next.endTime !== null) {
    current.endTime = next.endTime
  }
  if (current.bossKillCount === null && next.bossKillCount !== null) {
    current.bossKillCount = next.bossKillCount
  }
  if (current.lastOpenedAt === null && next.lastOpenedAt !== null) {
    current.lastOpenedAt = next.lastOpenedAt
  }
  if (current.starredAt === null && next.starredAt !== null) {
    current.starredAt = next.starredAt
  }

  if (nextPriority > currentPriority) {
    current.sourceHost = next.sourceHost
  }

  return current
}

function finalizeDocument(
  document: MutableReportSearchDocument,
): ReportSearchDocument {
  const sourceTags = [...document.sourceTagSet].sort(
    (left, right) => sourcePriority[right] - sourcePriority[left],
  )
  const aliases = [...document.aliasSet]
    .map((value) => value.trim())
    .filter((value) => value.length > 0)

  return {
    reportId: document.reportId,
    title: document.title,
    sourceHost: document.sourceHost,
    guildName: document.guildName,
    guildFaction: document.guildFaction,
    zoneName: document.zoneName,
    startTime: document.startTime,
    endTime: document.endTime,
    bossKillCount: document.bossKillCount,
    lastOpenedAt: document.lastOpenedAt,
    starredAt: document.starredAt,
    sourceTags,
    aliases,
  }
}

function upsertDocument(
  map: Map<string, MutableReportSearchDocument>,
  document: MutableReportSearchDocument,
): void {
  const current = map.get(document.reportId)
  if (!current) {
    map.set(document.reportId, document)
    return
  }

  map.set(document.reportId, mergeDocument(current, document))
}

/** Build merged report-search documents from all homepage data sources. */
export function buildReportSearchDocuments({
  starredReports,
  recentReports,
  personalReports,
  guildReports,
  includeExamples,
}: BuildReportSearchDocumentsInput): ReportSearchDocument[] {
  const byReportId = new Map<string, MutableReportSearchDocument>()

  starredReports.forEach((report) => {
    upsertDocument(
      byReportId,
      createBaseDocument({
        reportId: report.reportId,
        title: report.title || report.reportId,
        sourceHost: report.sourceHost,
        guildName: report.guildName ?? null,
        guildFaction: report.guildFaction ?? null,
        zoneName: report.zoneName ?? null,
        startTime: report.startTime ?? null,
        bossKillCount: report.bossKillCount ?? null,
        starredAt: report.starredAt,
        sourceTag: 'starred',
      }),
    )
  })

  recentReports
    .filter(
      (report) =>
        !(report.isArchived === true || report.isAccessible === false),
    )
    .forEach((report) => {
      upsertDocument(
        byReportId,
        createBaseDocument({
          reportId: report.reportId,
          title: report.title || report.reportId,
          sourceHost: report.sourceHost,
          guildName: report.guildName ?? null,
          guildFaction: report.guildFaction ?? null,
          zoneName: report.zoneName ?? null,
          startTime: report.startTime ?? null,
          bossKillCount: report.bossKillCount ?? null,
          lastOpenedAt: report.lastOpenedAt,
          sourceTag: 'recent',
        }),
      )
    })

  personalReports.forEach((report) => {
    upsertDocument(
      byReportId,
      createBaseDocument({
        reportId: report.code,
        title: report.title || report.code,
        sourceHost: defaultHost,
        guildName: report.guildName ?? null,
        guildFaction: report.guildFaction ?? null,
        zoneName: report.zoneName ?? null,
        startTime: report.startTime,
        endTime: report.endTime,
        sourceTag: 'personal',
      }),
    )
  })

  guildReports.forEach((report) => {
    upsertDocument(
      byReportId,
      createBaseDocument({
        reportId: report.reportId,
        title: report.title || report.reportId,
        sourceHost: report.sourceHost,
        guildName: report.guildName ?? null,
        guildFaction: report.guildFaction ?? null,
        zoneName: report.zoneName ?? null,
        startTime: report.startTime,
        endTime: report.endTime,
        sourceTag: 'guild',
      }),
    )
  })

  if (includeExamples) {
    exampleReports.forEach((report) => {
      upsertDocument(
        byReportId,
        createBaseDocument({
          reportId: report.reportId,
          title: report.label,
          sourceHost: report.host,
          sourceTag: 'example',
        }),
      )
    })
  }

  return [...byReportId.values()].map(finalizeDocument).sort(compareDocuments)
}

/** Build a Fuse index for report-search documents. */
export function createReportSearchIndex(
  documents: ReportSearchDocument[],
): Fuse<ReportSearchDocument> {
  return new Fuse(documents, reportSearchFuseOptions)
}

function isReportSearchMatchField(
  field: string | undefined,
): field is ReportSearchMatchField {
  return (
    field === 'reportId' ||
    field === 'title' ||
    field === 'guildName' ||
    field === 'zoneName'
  )
}

function toMatchRanges(
  indices: ReadonlyArray<Fuse.RangeTuple>,
): ReportSearchMatchRange[] {
  return indices
    .map(
      ([start, end]) =>
        [
          Math.max(0, Math.trunc(start)),
          Math.max(0, Math.trunc(end)),
        ] as ReportSearchMatchRange,
    )
    .filter(([start, end]) => end >= start)
}

function createSearchSuggestion(
  document: ReportSearchDocument,
): ReportSearchSuggestion {
  return {
    ...document,
    matchedAliases: [],
    matchRanges: {},
  }
}

function createSearchSuggestionFromResult(
  result: Fuse.FuseResult<ReportSearchDocument>,
): ReportSearchSuggestion {
  const suggestion = createSearchSuggestion(result.item)
  const matchedAliases = new Set<string>()

  result.matches?.forEach((match) => {
    if (match.key === 'aliases' && typeof match.value === 'string') {
      matchedAliases.add(match.value)
      return
    }

    if (isReportSearchMatchField(match.key)) {
      suggestion.matchRanges[match.key] = toMatchRanges(match.indices)
    }
  })

  return {
    ...suggestion,
    matchedAliases: [...matchedAliases],
  }
}

/** Returns report-search documents ranked by fuzzy score for a query. */
export function searchReportDocuments(
  searchIndex: Fuse<ReportSearchDocument>,
  documents: ReportSearchDocument[],
  query: string,
  limit = 20,
): ReportSearchSuggestion[] {
  const trimmed = query.trim()
  if (trimmed.length === 0) {
    return documents.slice(0, limit).map(createSearchSuggestion)
  }

  return searchIndex
    .search(trimmed, {
      limit,
    })
    .sort((left, right) => {
      const leftScore = left.score ?? Number.POSITIVE_INFINITY
      const rightScore = right.score ?? Number.POSITIVE_INFINITY
      if (leftScore !== rightScore) {
        return leftScore - rightScore
      }

      return compareDocuments(left.item, right.item)
    })
    .map(createSearchSuggestionFromResult)
}
