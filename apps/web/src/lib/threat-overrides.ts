/**
 * Shareable per-player threat override parsing and config-derived UI metadata.
 */
import type {
  ActorContext,
  ThreatConfig,
  ThreatContext,
} from '@wow-threat/shared'
import type { DamageEvent } from '@wow-threat/wcl-types'

import type { ReportActorSubType } from '../types/api'

export const THREAT_OVERRIDES_QUERY_PARAM = 'threatOverrides'

const RIGHTEOUS_FURY_AURA_ID = 25780

export type AuraOverrideState = 'auto' | 'off' | 'on'
export type ExplicitAuraOverrideState = Exclude<AuraOverrideState, 'auto'>

export interface ActorThreatOverrides {
  auras: Record<string, ExplicitAuraOverrideState>
  talents: Record<string, number>
}

export type ThreatOverridesByActor = Record<string, ActorThreatOverrides>

export interface SerializedActorAuraOverrides {
  add: number[]
  remove: number[]
}

export type SerializedAuraOverridesByActor = Record<
  string,
  SerializedActorAuraOverrides
>

export type SerializedTalentRankOverridesByActor = Record<
  string,
  Record<string, number>
>

export interface AuraThreatOverrideOption {
  auraIds: number[]
  description: string
  enabledAuraId: number
  key: string
  kind: 'aura'
  label: string
}

export interface TalentThreatOverrideOption {
  description: string
  key: string
  kind: 'talent'
  label: string
  maxRank: number
  spellId: number
  talentEntryId: number
}

export type ThreatOverrideOption =
  | AuraThreatOverrideOption
  | TalentThreatOverrideOption

function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0
}

function createEmptyActorOverrides(): ActorThreatOverrides {
  return { auras: {}, talents: {} }
}

function isActorOverridesEmpty(overrides: ActorThreatOverrides): boolean {
  return (
    Object.keys(overrides.auras).length === 0 &&
    Object.keys(overrides.talents).length === 0
  )
}

/** True when the actor has at least one explicit aura or talent override. */
export function actorHasThreatOverrides(
  overrides: ActorThreatOverrides | undefined,
): boolean {
  return overrides !== undefined && !isActorOverridesEmpty(overrides)
}

/** Parse the compact URL representation of per-player threat overrides. */
export function parseThreatOverridesParam(
  raw: string | null,
): ThreatOverridesByActor {
  if (!raw) {
    return {}
  }

  return raw.split(';').reduce<ThreatOverridesByActor>((result, actorPart) => {
    const separatorIndex = actorPart.indexOf(':')
    if (separatorIndex <= 0) {
      return result
    }

    const actorId = Number.parseInt(actorPart.slice(0, separatorIndex), 10)
    if (!isPositiveInteger(actorId)) {
      return result
    }

    const actorOverrides = createEmptyActorOverrides()
    actorPart
      .slice(separatorIndex + 1)
      .split(',')
      .forEach((token) => {
        const match = /^([at])(\d+)=(\d+)$/.exec(token.trim())
        if (!match) {
          return
        }

        const [, kind, rawId, rawValue] = match
        const id = Number.parseInt(rawId ?? '', 10)
        const value = Number.parseInt(rawValue ?? '', 10)
        if (!isPositiveInteger(id) || !Number.isInteger(value)) {
          return
        }

        if (kind === 'a' && (value === 0 || value === 1)) {
          actorOverrides.auras[String(id)] = value === 1 ? 'on' : 'off'
        }
        if (kind === 't' && value >= 0) {
          actorOverrides.talents[String(id)] = value
        }
      })

    if (!isActorOverridesEmpty(actorOverrides)) {
      result[String(actorId)] = actorOverrides
    }
    return result
  }, {})
}

/** Serialize per-player threat overrides into a stable, shareable URL value. */
export function serializeThreatOverridesParam(
  overridesByActor: ThreatOverridesByActor,
): string {
  return Object.entries(overridesByActor)
    .map(([rawActorId, overrides]) => ({
      actorId: Number.parseInt(rawActorId, 10),
      overrides,
    }))
    .filter(({ actorId, overrides }) => {
      return isPositiveInteger(actorId) && !isActorOverridesEmpty(overrides)
    })
    .sort((left, right) => left.actorId - right.actorId)
    .map(({ actorId, overrides }) => {
      const auraTokens = Object.entries(overrides.auras)
        .map(([rawAuraId, state]) => ({
          auraId: Number.parseInt(rawAuraId, 10),
          state,
        }))
        .filter(({ auraId }) => isPositiveInteger(auraId))
        .sort((left, right) => left.auraId - right.auraId)
        .map(({ auraId, state }) => `a${auraId}=${state === 'on' ? 1 : 0}`)
      const talentTokens = Object.entries(overrides.talents)
        .map(([rawTalentEntryId, rank]) => ({
          rank,
          talentEntryId: Number.parseInt(rawTalentEntryId, 10),
        }))
        .filter(
          ({ rank, talentEntryId }) =>
            isPositiveInteger(talentEntryId) &&
            Number.isInteger(rank) &&
            rank >= 0,
        )
        .sort((left, right) => left.talentEntryId - right.talentEntryId)
        .map(({ rank, talentEntryId }) => `t${talentEntryId}=${rank}`)

      return `${actorId}:${[...auraTokens, ...talentTokens].join(',')}`
    })
    .join(';')
}

/** Preserve the temporary forceRf URL as a compatibility alias. */
export function applyLegacyRighteousFuryOverride(
  overridesByActor: ThreatOverridesByActor,
  rawActorId: string | null,
): ThreatOverridesByActor {
  const actorId = Number.parseInt(rawActorId ?? '', 10)
  if (!isPositiveInteger(actorId)) {
    return overridesByActor
  }

  const actorKey = String(actorId)
  const actorOverrides =
    overridesByActor[actorKey] ?? createEmptyActorOverrides()
  if (actorOverrides.auras[String(RIGHTEOUS_FURY_AURA_ID)]) {
    return overridesByActor
  }

  return {
    ...overridesByActor,
    [actorKey]: {
      auras: {
        ...actorOverrides.auras,
        [String(RIGHTEOUS_FURY_AURA_ID)]: 'on',
      },
      talents: { ...actorOverrides.talents },
    },
  }
}

/** Convert URL-level aura choices into worker-safe records. */
export function serializeAuraOverridesByActor(
  overridesByActor: ThreatOverridesByActor,
): SerializedAuraOverridesByActor | undefined {
  const serialized = Object.entries(
    overridesByActor,
  ).reduce<SerializedAuraOverridesByActor>((result, [actorId, overrides]) => {
    const add = Object.entries(overrides.auras)
      .filter(([, state]) => state === 'on')
      .map(([auraId]) => Number.parseInt(auraId, 10))
      .filter(isPositiveInteger)
      .sort((left, right) => left - right)
    const remove = Object.entries(overrides.auras)
      .filter(([, state]) => state === 'off')
      .map(([auraId]) => Number.parseInt(auraId, 10))
      .filter(isPositiveInteger)
      .sort((left, right) => left - right)
    if (add.length > 0 || remove.length > 0) {
      result[actorId] = { add, remove }
    }
    return result
  }, {})

  return Object.keys(serialized).length > 0 ? serialized : undefined
}

/** Convert URL-level talent choices into worker-safe records. */
export function serializeTalentRankOverridesByActor(
  overridesByActor: ThreatOverridesByActor,
): SerializedTalentRankOverridesByActor | undefined {
  const serialized = Object.entries(
    overridesByActor,
  ).reduce<SerializedTalentRankOverridesByActor>(
    (result, [actorId, overrides]) => {
      const talentRanks = Object.fromEntries(
        Object.entries(overrides.talents)
          .filter(
            ([rawTalentEntryId, rank]) =>
              isPositiveInteger(Number.parseInt(rawTalentEntryId, 10)) &&
              Number.isInteger(rank) &&
              rank >= 0,
          )
          .sort(
            ([leftTalentEntryId], [rightTalentEntryId]) =>
              Number.parseInt(leftTalentEntryId, 10) -
              Number.parseInt(rightTalentEntryId, 10),
          ),
      )
      if (Object.keys(talentRanks).length > 0) {
        result[actorId] = talentRanks
      }
      return result
    },
    {},
  )

  return Object.keys(serialized).length > 0 ? serialized : undefined
}

const displayActorContext: ActorContext = {
  getActor: () => null,
  getActorsInRange: () => [],
  getCurrentTarget: () => null,
  getDistance: () => null,
  getFightEnemies: () => [],
  getLastTarget: () => null,
  getPosition: () => null,
  getThreat: () => 0,
  getTopActorsByThreat: () => [],
  isActorAlive: () => true,
}

const displayEvent: DamageEvent = {
  abilityGameID: 0,
  absorbed: 0,
  amount: 1,
  blocked: 0,
  hitType: 1,
  mitigated: 0,
  multistrike: false,
  overkill: 0,
  sourceID: 1,
  targetID: 2,
  tick: false,
  timestamp: 0,
  type: 'damage',
}

function createDisplayContext(activeAuraId: number): ThreatContext {
  return {
    actors: displayActorContext,
    amount: 1,
    encounterId: null,
    event: displayEvent,
    sourceActor: { class: 'paladin', id: 1, name: 'Paladin' },
    sourceAuras: new Set([activeAuraId]),
    spellSchoolMask: 127,
    targetActor: { class: null, id: 2, name: 'Target' },
    targetAuras: new Set(),
  }
}

function formatMultiplierDescription(value: number): string {
  return `Forces this ${value < 1 ? 'threat reduction' : 'threat modifier'} for the full fight (x${value.toFixed(2)}).`
}

function buildAuraOptions(config: ThreatConfig): AuraThreatOverrideOption[] {
  const paladinConfig = config.classes.paladin
  if (!paladinConfig) {
    return []
  }

  const rawOptions = Object.entries(paladinConfig.auraModifiers)
    .map(([rawAuraId, modifier]) => {
      const auraId = Number.parseInt(rawAuraId, 10)
      const resolvedModifier = modifier(createDisplayContext(auraId))
      return { auraId, modifier: resolvedModifier }
    })
    .filter(({ auraId }) => isPositiveInteger(auraId))

  const salvationOptions = rawOptions.filter(({ modifier }) =>
    modifier.name.includes('Blessing of Salvation'),
  )
  const preferredSalvation =
    salvationOptions.find(({ modifier }) =>
      modifier.name.startsWith('Greater '),
    ) ?? salvationOptions[0]
  const commonOptions: AuraThreatOverrideOption[] = preferredSalvation
    ? [
        {
          auraIds: salvationOptions.map(({ auraId }) => auraId),
          description: formatMultiplierDescription(
            preferredSalvation.modifier.value,
          ),
          enabledAuraId: preferredSalvation.auraId,
          key: `aura-${salvationOptions.map(({ auraId }) => auraId).join('-')}`,
          kind: 'aura',
          label: 'Blessing of Salvation',
        },
      ]
    : []

  return [
    ...commonOptions,
    ...rawOptions
      .filter(
        ({ auraId }) =>
          !salvationOptions.some(
            (salvationOption) => salvationOption.auraId === auraId,
          ),
      )
      .map(({ auraId, modifier }) => ({
        auraIds: [auraId],
        description: formatMultiplierDescription(modifier.value),
        enabledAuraId: auraId,
        key: `aura-${auraId}`,
        kind: 'aura' as const,
        label: modifier.name,
      })),
  ]
}

/** Build Paladin override controls directly from the active threat config. */
export function buildThreatOverrideOptions(
  config: ThreatConfig | null,
  actorClass: ReportActorSubType | undefined,
): ThreatOverrideOption[] {
  if (!config) {
    return []
  }

  const auraOptions = buildAuraOptions(config)
  const salvationOptions = auraOptions.filter(
    (option) => option.label === 'Blessing of Salvation',
  )
  if (actorClass !== 'Paladin') {
    return salvationOptions
  }

  const talentOptions = Object.entries(
    config.classes.paladin?.talentModifiers ?? {},
  ).map(([rawTalentEntryId, talent]) => {
    const talentEntryId = Number.parseInt(rawTalentEntryId, 10)
    const modifier = talent.modifier(createDisplayContext(talent.spellId), 1)
    return {
      description: `Overrides the reported talent rank from 0 to ${talent.maxRank}.`,
      key: `talent-${talentEntryId}`,
      kind: 'talent' as const,
      label: modifier.name.replace(/ \(Rank \d+\)$/, ''),
      maxRank: talent.maxRank,
      spellId: talent.spellId,
      talentEntryId,
    }
  })

  return [...auraOptions, ...talentOptions]
}

/** Resolve a grouped aura option's selected UI state. */
export function resolveAuraOptionState(
  actorOverrides: ActorThreatOverrides | undefined,
  option: AuraThreatOverrideOption,
): AuraOverrideState {
  const explicitStates = option.auraIds
    .map((auraId) => actorOverrides?.auras[String(auraId)])
    .filter((state): state is ExplicitAuraOverrideState => state !== undefined)
  if (explicitStates.length === 0) {
    return 'auto'
  }
  if (
    actorOverrides?.auras[String(option.enabledAuraId)] === 'on' &&
    option.auraIds.every(
      (auraId) =>
        auraId === option.enabledAuraId ||
        actorOverrides.auras[String(auraId)] === 'off',
    )
  ) {
    return 'on'
  }
  return explicitStates.every((state) => state === 'off') ? 'off' : 'auto'
}
