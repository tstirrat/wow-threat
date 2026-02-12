/**
 * Hunter Threat Configuration - Anniversary Edition
 *
 * Feign Death drops threat. Distracting Shot generates fixed threat.
 * Misdirection redirects threat to an ally.
 */
import type { EventInterceptor } from '@wcl-threat/shared'
import type { ClassThreatConfig } from '@wcl-threat/shared'

import { calculateThreat, modifyThreat } from '../../shared/formulas'

// ============================================================================
// Spell IDs
// ============================================================================

export const Spells = {
  FeignDeath: 5384,
  Misdirection: 34477,
  DistractingShotR1: 20736,
  DistractingShotR2: 14274,
  DistractingShotR3: 15629,
  DistractingShotR4: 15630,
  DistractingShotR5: 15631,
  DistractingShotR6: 15632,
  DisengageR1: 781,
  DisengageR2: 14272,
  DisengageR3: 14273,
} as const

/**
 * Misdirection - Redirects threat from the hunter to a target ally
 *
 * The hunter casts Misdirection on an ally, which redirects the hunter's
 * threat on their next 3 damage attacks to that ally, or expires after 30 seconds.
 *
 * @param hunterId - The hunter casting Misdirection
 * @param targetId - The ally receiving redirected threat
 */
function createMisdirectionInterceptor(
  hunterId: number,
  targetId: number,
): EventInterceptor {
  let chargesRemaining = 3
  const DURATION_MS = 30000

  return (event, ctx) => {
    // Expire after 30 seconds
    if (ctx.timestamp - ctx.installedAt > DURATION_MS) {
      ctx.uninstall()
      return { action: 'passthrough' }
    }

    // Only redirect hunter's damage events
    if (event.type !== 'damage' || event.sourceID !== hunterId) {
      return { action: 'passthrough' }
    }

    chargesRemaining--
    if (chargesRemaining <= 0) {
      ctx.uninstall()
    }

    // Don't redirect to dead targets, but still consume a charge
    if (!ctx.actors.isActorAlive({ id: targetId })) {
      return { action: 'passthrough' }
    }

    // Redirect threat to the target
    return {
      action: 'augment',
      threatRecipientOverride: targetId,
    }
  }
}

// ============================================================================
// Configuration
// ============================================================================

export const hunterConfig: ClassThreatConfig = {
  auraModifiers: {},

  abilities: {
    // Feign Death - threat drop
    [Spells.FeignDeath]: modifyThreat({ modifier: 0, target: 'all' }),

    // Misdirection - redirect threat to ally
    [Spells.Misdirection]: (ctx) => ({
      formula: '0',
      value: 0,
      splitAmongEnemies: false,
      effects: [
        {
          type: 'installInterceptor',
          interceptor: createMisdirectionInterceptor(
            ctx.sourceActor.id,
            ctx.event.targetID,
          ),
        },
      ],
    }),

    // Distracting Shot - damage + flat threat per rank
    [Spells.DistractingShotR1]: calculateThreat({ modifier: 1, bonus: 110 }),
    [Spells.DistractingShotR2]: calculateThreat({ modifier: 1, bonus: 160 }),
    [Spells.DistractingShotR3]: calculateThreat({ modifier: 1, bonus: 250 }),
    [Spells.DistractingShotR4]: calculateThreat({ modifier: 1, bonus: 350 }),
    [Spells.DistractingShotR5]: calculateThreat({ modifier: 1, bonus: 465 }),
    [Spells.DistractingShotR6]: calculateThreat({ modifier: 1, bonus: 600 }),

    // Disengage - negative threat
    [Spells.DisengageR1]: calculateThreat({ modifier: 0, bonus: -140 }),
    [Spells.DisengageR2]: calculateThreat({ modifier: 0, bonus: -280 }),
    [Spells.DisengageR3]: calculateThreat({ modifier: 0, bonus: -405 }),
  },
}
