/**
 * Player filter controls for deep-linkable visibility states.
 */
import type { PlayerClass } from '@wcl-threat/wcl-types'
import type { FC } from 'react'

import { getClassColor } from '../lib/class-colors'
import type { ReportActorSummary } from '../types/api'

export type PlayerFilterPanelProps = {
  players: ReportActorSummary[]
  selectedPlayerIds: number[]
  onChange: (playerIds: number[]) => void
}

export const PlayerFilterPanel: FC<PlayerFilterPanelProps> = ({
  players,
  selectedPlayerIds,
  onChange,
}) => {
  const selectedSet = new Set(selectedPlayerIds)

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <button
          className="rounded-md border border-border bg-panel px-2 py-1 text-xs"
          type="button"
          onClick={() => onChange([])}
        >
          Show all
        </button>
        <button
          className="rounded-md border border-border bg-panel px-2 py-1 text-xs"
          type="button"
          onClick={() => onChange(players.map((player) => player.id))}
        >
          Select all players
        </button>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {players.map((player) => {
          const classColor = getClassColor(
            player.subType as PlayerClass | undefined,
          )
          const isChecked = selectedSet.has(player.id)

          return (
            <li
              className="rounded-md border border-border bg-panel px-2 py-1"
              key={player.id}
            >
              <label className="flex items-center gap-2 text-sm">
                <input
                  checked={isChecked}
                  type="checkbox"
                  onChange={(event) => {
                    if (event.target.checked) {
                      onChange([...selectedSet, player.id])
                      return
                    }

                    onChange(selectedPlayerIds.filter((id) => id !== player.id))
                  }}
                />
                <span style={{ color: classColor }}>{player.name}</span>
              </label>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
