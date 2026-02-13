/**
 * Display initial auras from combatant info events.
 */
import type { FC } from 'react'

export interface InitialAura {
  spellId: number
  name: string
  stacks: number
}

export type InitialAurasProps = {
  auras: InitialAura[]
}

function buildWowheadUrl(spellId: number): string {
  return `https://www.wowhead.com/classic/spell=${spellId}`
}

export const InitialAuras: FC<InitialAurasProps> = ({ auras }) => {
  if (auras.length === 0) {
    return null
  }

  return (
    <div className="space-y-1">
      <div className="text-xs uppercase tracking-wide text-muted">
        Initial auras
      </div>
      <div className="flex flex-wrap gap-1">
        {auras.map((aura) => (
          <a
            key={aura.spellId}
            href={buildWowheadUrl(aura.spellId)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded bg-black/10 px-2 py-1 text-xs hover:bg-black/20"
            title={`${aura.name}${aura.stacks > 1 ? ` (${aura.stacks})` : ''}`}
          >
            <span>{aura.name}</span>
            {aura.stacks > 1 && (
              <span className="text-muted">×{aura.stacks}</span>
            )}
          </a>
        ))}
      </div>
    </div>
  )
}
