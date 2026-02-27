/**
 * Derived state selectors for the fight page chart and focused player summary.
 */
import type { ThreatConfig } from '@wow-threat/shared'
import { useMemo } from 'react'

import { useFightQueryState } from '../../hooks/use-fight-query-state'
import { buildVisibleSeriesForLegend } from '../../lib/fight-page-series'
import {
  buildFightTargetOptions,
  buildFocusedPlayerAggregation,
  buildInitialAurasDisplay,
  buildThreatSeries,
  resolveSeriesWindowBounds,
  selectDefaultTarget,
} from '../../lib/threat-aggregation'
import type {
  AugmentedEventsResponse,
  FightsResponse,
  ReportActorRole,
  ReportResponse,
} from '../../types/api'
import type {
  FightTarget,
  ThreatSeries,
  WowheadLinksConfig,
} from '../../types/app'

const defaultWowheadLinksConfig: WowheadLinksConfig = {
  domain: 'classic',
}

function resolveSelectedTarget({
  defaultTarget,
  queryTargetId,
  queryTargetInstance,
  targetOptions,
}: {
  defaultTarget: FightTarget | null
  queryTargetId: number | null
  queryTargetInstance: number | null
  targetOptions: ReturnType<typeof buildFightTargetOptions>
}): FightTarget | null {
  if (queryTargetId !== null && queryTargetInstance !== null) {
    return {
      id: queryTargetId,
      instance: queryTargetInstance,
    }
  }

  if (defaultTarget) {
    return defaultTarget
  }

  const firstTarget = targetOptions[0]
  if (!firstTarget) {
    return null
  }

  return {
    id: firstTarget.id,
    instance: firstTarget.instance,
  }
}

function resolveFocusedPlayerId({
  focusId,
  players,
  visibleSeries,
}: {
  focusId: number | null
  players: number[]
  visibleSeries: ThreatSeries[]
}): number | null {
  const candidatePlayerId = focusId ?? players[0] ?? null
  if (candidatePlayerId === null) {
    return null
  }

  const hasVisibleSeries = visibleSeries.some(
    (series) => series.actorId === candidatePlayerId,
  )
  return hasVisibleSeries ? candidatePlayerId : null
}

export interface UseFightPageDerivedStateResult {
  durationMs: number
  focusedPlayerRows: ReturnType<typeof buildFocusedPlayerAggregation>['rows']
  focusedPlayerSummary: ReturnType<
    typeof buildFocusedPlayerAggregation
  >['summary']
  initialAuras: ReturnType<typeof buildInitialAurasDisplay>
  queryState: ReturnType<typeof useFightQueryState>
  selectedTarget: FightTarget | null
  targetOptions: ReturnType<typeof buildFightTargetOptions>
  validPlayerIds: Set<number>
  visibleSeries: ThreatSeries[]
  wowheadLinksConfig: WowheadLinksConfig
}

/** Build fight-page chart and summary derived state from fetched fight and events data. */
export function useFightPageDerivedState({
  eventsData,
  fightData,
  reportData,
  showPets,
  threatConfig,
}: {
  eventsData: AugmentedEventsResponse | null
  fightData: FightsResponse | null
  reportData: ReportResponse
  showPets: boolean
  threatConfig: ThreatConfig | null
}): UseFightPageDerivedStateResult {
  const validPlayerIds = useMemo(
    () =>
      new Set(
        (fightData?.actors ?? [])
          .filter((actor) => actor.type === 'Player')
          .map((actor) => actor.id),
      ),
    [fightData?.actors],
  )
  const validActorIds = useMemo(
    () => new Set((fightData?.actors ?? []).map((actor) => actor.id)),
    [fightData?.actors],
  )
  const targetOptions = useMemo(
    () =>
      buildFightTargetOptions({
        enemies: fightData?.enemies ?? [],
        events: eventsData?.events ?? [],
      }),
    [eventsData?.events, fightData?.enemies],
  )
  const validTargetKeys = useMemo(
    () => new Set(targetOptions.map((target) => target.key)),
    [targetOptions],
  )

  const durationMs = useMemo(() => {
    if (!fightData || !eventsData) {
      return 0
    }

    const fightDuration = fightData.endTime - fightData.startTime
    return fightDuration > 0 ? fightDuration : eventsData.summary.duration
  }, [eventsData, fightData])

  const actorRoleById = useMemo(() => {
    if (!fightData) {
      return new Map<number, ReportActorRole>()
    }

    return new Map(
      fightData.actors
        .filter((actor) => actor.type === 'Player' && actor.role)
        .map((actor) => [actor.id, actor.role]),
    )
  }, [fightData])

  const queryState = useFightQueryState({
    validPlayerIds,
    validActorIds,
    validTargetKeys,
    maxDurationMs: durationMs,
  })

  const defaultTarget = useMemo(
    () => selectDefaultTarget(eventsData?.events ?? [], validTargetKeys),
    [eventsData?.events, validTargetKeys],
  )
  const selectedTarget = useMemo(
    () =>
      resolveSelectedTarget({
        defaultTarget,
        queryTargetId: queryState.state.targetId,
        queryTargetInstance: queryState.state.targetInstance,
        targetOptions,
      }),
    [
      defaultTarget,
      queryState.state.targetId,
      queryState.state.targetInstance,
      targetOptions,
    ],
  )

  const allSeries = useMemo(() => {
    if (!selectedTarget || !eventsData || !fightData) {
      return []
    }

    const threatSeries = buildThreatSeries({
      events: eventsData.events,
      actors: fightData.actors,
      abilities: reportData.abilities,
      fightStartTime: fightData.startTime,
      fightEndTime: fightData.endTime,
      target: selectedTarget,
    })

    return threatSeries.map((series) => {
      if (series.actorType !== 'Player') {
        return series
      }

      const actorRole = actorRoleById.get(series.actorId)
      return actorRole ? { ...series, actorRole } : series
    })
  }, [
    actorRoleById,
    eventsData,
    fightData,
    reportData.abilities,
    selectedTarget,
  ])

  const visibleSeries = useMemo(
    () => buildVisibleSeriesForLegend(allSeries, showPets),
    [allSeries, showPets],
  )

  const windowBounds = useMemo(
    () => resolveSeriesWindowBounds(visibleSeries),
    [visibleSeries],
  )
  const selectedWindowStartMs = queryState.state.startMs ?? windowBounds.min
  const selectedWindowEndMs = queryState.state.endMs ?? windowBounds.max

  const focusedPlayerId = useMemo(
    () =>
      resolveFocusedPlayerId({
        focusId: queryState.state.focusId,
        players: queryState.state.players,
        visibleSeries,
      }),
    [queryState.state.focusId, queryState.state.players, visibleSeries],
  )

  const focusedPlayerAggregation = useMemo(() => {
    if (selectedTarget === null) {
      return {
        summary: null,
        rows: [],
      }
    }

    return buildFocusedPlayerAggregation({
      events: eventsData?.events ?? [],
      actors: fightData?.actors ?? [],
      abilities: reportData.abilities,
      fightStartTime: fightData?.startTime ?? 0,
      target: selectedTarget,
      focusedPlayerId,
      windowStartMs: selectedWindowStartMs,
      windowEndMs: selectedWindowEndMs,
    })
  }, [
    eventsData?.events,
    fightData?.actors,
    fightData?.startTime,
    focusedPlayerId,
    reportData.abilities,
    selectedTarget,
    selectedWindowEndMs,
    selectedWindowStartMs,
  ])

  const initialAuras = useMemo(
    () =>
      buildInitialAurasDisplay(
        eventsData?.events ?? [],
        focusedPlayerId,
        threatConfig,
        {
          initialAurasByActor: eventsData?.initialAurasByActor,
          abilities: reportData.abilities,
        },
      ),
    [
      eventsData?.events,
      eventsData?.initialAurasByActor,
      focusedPlayerId,
      reportData.abilities,
      threatConfig,
    ],
  )
  const wowheadLinksConfig = threatConfig?.wowhead ?? defaultWowheadLinksConfig

  return {
    durationMs,
    focusedPlayerRows: focusedPlayerAggregation.rows,
    focusedPlayerSummary: focusedPlayerAggregation.summary,
    initialAuras,
    queryState,
    selectedTarget,
    targetOptions,
    validPlayerIds,
    visibleSeries,
    wowheadLinksConfig,
  }
}
