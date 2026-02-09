/**
 * Event Interceptor Tracking
 *
 * Manages active event interceptors that intercept future events.
 * Interceptors are installed by abilities (e.g., Misdirection) and can:
 * - Pass events through for normal processing
 * - Augment events (redirect threat, modify threat)
 * - Skip events (zero threat)
 * - Self-uninstall when their effect expires
 */
import type {
  ActorContext,
  EventInterceptor,
  EventInterceptorContext,
  EventInterceptorResult,
} from '@wcl-threat/threat-config'
import type { WCLEvent } from '@wcl-threat/wcl-types'

interface ActiveInterceptor {
  id: string
  interceptor: EventInterceptor
  installedAt: number
}

interface InterceptorRuntimeActorContext extends ActorContext {
  setAura: (actorId: number, spellId: number) => void
  removeAura: (actorId: number, spellId: number) => void
}

/**
 * Tracks and executes event interceptors
 */
export class InterceptorTracker {
  private interceptors = new Map<string, ActiveInterceptor>()
  private nextId = 1

  /**
   * Install a new event interceptor
   * @returns The unique ID of the installed interceptor
   */
  install(interceptor: EventInterceptor, timestamp: number): string {
    const id = `interceptor-${this.nextId++}`
    this.interceptors.set(id, { id, interceptor, installedAt: timestamp })
    return id
  }

  /**
   * Run all active interceptors on an event
   * @param event - The WCL event to process
   * @param timestamp - Current timestamp
   * @param actors - Actor context for accessing fight state
   * @returns Array of results from all interceptors
   */
  runInterceptors(
    event: WCLEvent,
    timestamp: number,
    actors: InterceptorRuntimeActorContext,
  ): EventInterceptorResult[] {
    const results: EventInterceptorResult[] = []

    for (const [id, active] of this.interceptors) {
      const ctx: EventInterceptorContext = {
        timestamp,
        installedAt: active.installedAt,
        actors,
        uninstall: () => {
          this.interceptors.delete(id)
        },
        setAura: (actorId, spellId) => {
          actors.setAura(actorId, spellId)
        },
        removeAura: (actorId, spellId) => {
          actors.removeAura(actorId, spellId)
        },
      }

      results.push(active.interceptor(event, ctx))
    }

    return results
  }

  /**
   * Get the count of active interceptors (for testing/debugging)
   */
  getActiveCount(): number {
    return this.interceptors.size
  }

  /**
   * Clear all interceptors (for testing)
   */
  clear(): void {
    this.interceptors.clear()
  }
}
