/**
 * Effect Handler Tracking
 *
 * Manages active effect handlers that intercept future events.
 * Handlers are installed by abilities (e.g., Misdirection) and can:
 * - Pass events through for normal processing
 * - Augment events (redirect threat, modify threat)
 * - Skip events (zero threat)
 * - Self-uninstall when their effect expires
 */
import type {
  ActorContext,
  EffectHandler,
  EffectHandlerContext,
  EffectHandlerResult,
} from '@wcl-threat/threat-config'
import type { WCLEvent } from '@wcl-threat/wcl-types'

interface ActiveHandler {
  id: string
  handler: EffectHandler
  installedAt: number
}

interface EffectRuntimeActorContext extends ActorContext {
  setAura: (actorId: number, spellId: number) => void
  removeAura: (actorId: number, spellId: number) => void
}

/**
 * Tracks and executes effect handlers
 */
export class EffectTracker {
  private handlers = new Map<string, ActiveHandler>()
  private nextId = 1

  /**
   * Install a new effect handler
   * @returns The unique ID of the installed handler
   */
  install(handler: EffectHandler, timestamp: number): string {
    const id = `handler-${this.nextId++}`
    this.handlers.set(id, { id, handler, installedAt: timestamp })
    return id
  }

  /**
   * Run all active handlers on an event
   * @param event - The WCL event to process
   * @param timestamp - Current timestamp
   * @param actors - Actor context for accessing fight state
   * @returns Array of results from all handlers
   */
  runHandlers(
    event: WCLEvent,
    timestamp: number,
    actors: EffectRuntimeActorContext,
  ): EffectHandlerResult[] {
    const results: EffectHandlerResult[] = []

    for (const [id, active] of this.handlers) {
      const ctx: EffectHandlerContext = {
        timestamp,
        installedAt: active.installedAt,
        actors,
        uninstall: () => {
          this.handlers.delete(id)
        },
        setAura: (actorId, spellId) => {
          actors.setAura(actorId, spellId)
        },
        removeAura: (actorId, spellId) => {
          actors.removeAura(actorId, spellId)
        },
      }

      results.push(active.handler(event, ctx))
    }

    return results
  }

  /**
   * Get the count of active handlers (for testing/debugging)
   */
  getActiveCount(): number {
    return this.handlers.size
  }

  /**
   * Clear all handlers (for testing)
   */
  clear(): void {
    this.handlers.clear()
  }
}
