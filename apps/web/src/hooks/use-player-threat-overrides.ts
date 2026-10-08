/**
 * URL-backed state for shareable per-player threat calculation overrides.
 */
import { usePostHog } from 'posthog-js/react'
import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'

import {
  type ActorThreatOverrides,
  type AuraOverrideState,
  type AuraThreatOverrideOption,
  THREAT_OVERRIDES_QUERY_PARAM,
  type ThreatOverridesByActor,
  applyLegacyRighteousFuryOverride,
  parseThreatOverridesParam,
  serializeThreatOverridesParam,
} from '../lib/threat-overrides'

function cloneActorOverrides(
  overrides: ActorThreatOverrides | undefined,
): ActorThreatOverrides {
  return {
    auras: { ...overrides?.auras },
    talents: { ...overrides?.talents },
  }
}

function removeEmptyActor(
  overridesByActor: ThreatOverridesByActor,
  actorId: number,
): void {
  const actorOverrides = overridesByActor[String(actorId)]
  if (
    actorOverrides &&
    Object.keys(actorOverrides.auras).length === 0 &&
    Object.keys(actorOverrides.talents).length === 0
  ) {
    delete overridesByActor[String(actorId)]
  }
}

export interface UsePlayerThreatOverridesResult {
  overridesByActor: ThreatOverridesByActor
  overrideScope: string | null
  resetActorOverrides: (actorId: number) => void
  setAuraOverride: (
    actorId: number,
    option: AuraThreatOverrideOption,
    state: AuraOverrideState,
  ) => void
  setTalentRankOverride: (
    actorId: number,
    talentEntryId: number,
    rank: number | null,
  ) => void
}

/** Read and update threat overrides without disturbing other fight query params. */
export function usePlayerThreatOverrides({
  fightId,
  reportId,
}: {
  fightId: number
  reportId: string
}): UsePlayerThreatOverridesResult {
  const posthog = usePostHog()
  const [searchParams, setSearchParams] = useSearchParams()
  const searchParamsString = searchParams.toString()
  const overridesByActor = useMemo(() => {
    const current = new URLSearchParams(searchParamsString)
    return applyLegacyRighteousFuryOverride(
      parseThreatOverridesParam(current.get(THREAT_OVERRIDES_QUERY_PARAM)),
      current.get('forceRf'),
    )
  }, [searchParamsString])
  const serializedOverrides = serializeThreatOverridesParam(overridesByActor)

  const updateOverrides = (
    update: (current: ThreatOverridesByActor) => ThreatOverridesByActor,
  ): void => {
    setSearchParams((currentSearchParams) => {
      const currentOverrides = applyLegacyRighteousFuryOverride(
        parseThreatOverridesParam(
          currentSearchParams.get(THREAT_OVERRIDES_QUERY_PARAM),
        ),
        currentSearchParams.get('forceRf'),
      )
      const nextOverrides = update(currentOverrides)
      const serialized = serializeThreatOverridesParam(nextOverrides)
      const nextSearchParams = new URLSearchParams(currentSearchParams)
      nextSearchParams.delete('forceRf')
      if (serialized) {
        nextSearchParams.set(THREAT_OVERRIDES_QUERY_PARAM, serialized)
      } else {
        nextSearchParams.delete(THREAT_OVERRIDES_QUERY_PARAM)
      }
      return nextSearchParams
    })
  }

  const setAuraOverride = (
    actorId: number,
    option: AuraThreatOverrideOption,
    state: AuraOverrideState,
  ): void => {
    posthog?.capture('player_threat_aura_overridden', {
      actor_id: actorId,
      fight_id: fightId,
      override_state: state,
      report_id: reportId,
      spell_id: option.enabledAuraId,
    })
    updateOverrides((current) => {
      const next = { ...current }
      const actorOverrides = cloneActorOverrides(current[String(actorId)])
      option.auraIds.forEach((auraId) => {
        if (state === 'auto') {
          delete actorOverrides.auras[String(auraId)]
          return
        }

        actorOverrides.auras[String(auraId)] =
          state === 'on' && auraId === option.enabledAuraId ? 'on' : 'off'
      })
      next[String(actorId)] = actorOverrides
      removeEmptyActor(next, actorId)
      return next
    })
  }

  const setTalentRankOverride = (
    actorId: number,
    talentEntryId: number,
    rank: number | null,
  ): void => {
    posthog?.capture('player_threat_talent_overridden', {
      actor_id: actorId,
      fight_id: fightId,
      rank,
      report_id: reportId,
      talent_entry_id: talentEntryId,
    })
    updateOverrides((current) => {
      const next = { ...current }
      const actorOverrides = cloneActorOverrides(current[String(actorId)])
      if (rank === null) {
        delete actorOverrides.talents[String(talentEntryId)]
      } else {
        actorOverrides.talents[String(talentEntryId)] = rank
      }
      next[String(actorId)] = actorOverrides
      removeEmptyActor(next, actorId)
      return next
    })
  }

  const resetActorOverrides = (actorId: number): void => {
    posthog?.capture('player_threat_overrides_reset', {
      actor_id: actorId,
      fight_id: fightId,
      report_id: reportId,
    })
    updateOverrides((current) => {
      const next = { ...current }
      delete next[String(actorId)]
      return next
    })
  }

  return {
    overridesByActor,
    overrideScope: serializedOverrides || null,
    resetActorOverrides,
    setAuraOverride,
    setTalentRankOverride,
  }
}
