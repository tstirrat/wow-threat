/**
 * Display initial auras from combatant info events.
 */
import type { FC } from 'react'

import type { InitialAuraDisplay, WowheadLinksConfig } from '../types/app'
import { Badge } from './ui/badge'

export type InitialAurasProps = {
  auras: InitialAuraDisplay[]
  wowhead: WowheadLinksConfig
}

function buildWowheadUrl(wowheadDomain: string, spellId: number): string {
  return `https://www.wowhead.com/${wowheadDomain}/spell=${spellId}`
}

export const InitialAuras: FC<InitialAurasProps> = ({ auras, wowhead }) => {
  if (auras.length === 0) {
    return null
  }

  return (
    <div className="space-y-1">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">
        Initial auras
      </div>
      <div className="flex flex-wrap gap-1">
        {auras.map((aura, index) => (
          <Badge
            asChild
            className={aura.isNotable ? 'bg-yellow-950/40 text-yellow-100' : ''}
            key={`${aura.spellId}-${index}`}
            variant={aura.isNotable ? 'secondary' : 'outline'}
          >
            <a
              data-wowhead={`spell=${aura.spellId}&domain=${wowhead.domain}`}
              href={buildWowheadUrl(wowhead.domain, aura.spellId)}
              rel="noreferrer"
              target="_blank"
              title={`${aura.name}${aura.stacks > 1 ? ` (${aura.stacks})` : ''}`}
            >
              <span>{aura.name}</span>
              {aura.stacks > 1 && (
                <span className="text-muted">×{aura.stacks}</span>
              )}
            </a>
          </Badge>
        ))}
      </div>
    </div>
  )
}
