/**
 * Built-in threat engine fight processors.
 */
import type { FightProcessorFactory } from '../event-processors'
import { createInferInitialSalvationProcessor } from './infer-initial-salvation'
import { createMinmaxSalvationProcessor } from './minmax-salvation'

export { createInferInitialSalvationProcessor } from './infer-initial-salvation'
export { createMinmaxSalvationProcessor } from './minmax-salvation'

/** Built-in processor factories installed by default on engine instances. */
export const defaultFightProcessorFactories: FightProcessorFactory[] = [
  createInferInitialSalvationProcessor,
  createMinmaxSalvationProcessor,
]
