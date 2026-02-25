/**
 * Built-in threat engine fight processors.
 */
import type { FightProcessorFactory } from '../event-processors'
import { createInferInitialBuffsProcessor } from './infer-initial-buffs'
import { createMinmaxSalvationProcessor } from './minmax-salvation'
import { createPartyDetectionProcessor } from './party-detection'
import { createTranquilAirEmulationProcessor } from './tranquil-air-emulation'

export { createInferInitialBuffsProcessor } from './infer-initial-buffs'
export { createMinmaxSalvationProcessor } from './minmax-salvation'
export {
  createPartyDetectionProcessor,
  partyAssignmentsKey,
  type PartyAssignments,
} from './party-detection'
export { createTranquilAirEmulationProcessor } from './tranquil-air-emulation'

/** Built-in processor factories installed by default on engine instances. */
export const defaultFightProcessorFactories: FightProcessorFactory[] = [
  createPartyDetectionProcessor,
  createTranquilAirEmulationProcessor,
  createInferInitialBuffsProcessor,
  createMinmaxSalvationProcessor,
]
