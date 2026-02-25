/**
 * Built-in threat engine fight processors.
 */
import type { FightProcessorFactory } from '../event-processors'
import { createInferInitialBuffsProcessor } from './infer-initial-buffs'
import { createMinmaxSalvationProcessor } from './minmax-salvation'

export { createInferInitialBuffsProcessor } from './infer-initial-buffs'
export { createMinmaxSalvationProcessor } from './minmax-salvation'

/** Built-in processor factories installed by default on engine instances. */
export const defaultFightProcessorFactories: FightProcessorFactory[] = [
  createInferInitialBuffsProcessor,
  createMinmaxSalvationProcessor,
]
