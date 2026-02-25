/**
 * Shared data payload types used by threat chart rendering and tooltip formatters.
 */
import type { HitType } from '@wow-threat/wcl-types'

import type { ThreatPointMarkerKind, ThreatPointModifier } from '../types/app'

export interface TooltipPointPayload {
  actorId: number
  actorColor: string
  abilityName: string
  spellId?: number
  targetName?: string | null
  amount: number
  baseThreat: number
  eventType: string
  hitType?: HitType
  isTick?: boolean
  formula: string
  modifiedThreat: number
  resourceType?: number | null
  spellSchool: string | null
  modifiers: ThreatPointModifier[]
  threatDelta: number
  timeMs: number
  totalThreat: number
  markerKind?: ThreatPointMarkerKind
}

export interface SeriesChartPoint extends TooltipPointPayload {
  focusedActorId: number
  value: [number, number]
}
