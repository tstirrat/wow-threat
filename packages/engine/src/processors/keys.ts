/**
 * Shared typed namespace keys for engine processors.
 */
import { createProcessorDataKey } from '../event-processors'

export interface SalvationInferenceMetadata {
  combatantInfoMinorSalvationPlayerIds: Set<number>
  minorSalvationRemovedPlayerIds: Set<number>
}

export const salvationInferenceMetadataKey =
  createProcessorDataKey<SalvationInferenceMetadata>(
    'engine:salvationInferenceMetadata',
  )
