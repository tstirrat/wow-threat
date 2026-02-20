/**
 * Player filter controls for deep-linkable visibility states.
 */
import type { PlayerClass } from '@wow-threat/wcl-types'
import type { FC } from 'react'

import { getClassColor } from '../lib/class-colors'
import type { ReportActorSummary } from '../types/api'
import { Button } from './ui/button'
import { Card, CardContent } from './ui/card'
import { Checkbox } from './ui/checkbox'
import { Label } from './ui/label'

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
        <Button
          size="sm"
          type="button"
          variant="outline"
          onClick={() => onChange([])}
        >
          Show all
        </Button>
        <Button
          size="sm"
          type="button"
          variant="outline"
          onClick={() => onChange(players.map((player) => player.id))}
        >
          Select all players
        </Button>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {players.map((player) => {
          const classColor = getClassColor(
            player.subType as PlayerClass | undefined,
          )
          const isChecked = selectedSet.has(player.id)
          const inputId = `player-filter-${player.id}`

          return (
            <li key={player.id}>
              <Card className="bg-panel" size="sm">
                <CardContent>
                  <div className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={isChecked}
                      id={inputId}
                      onCheckedChange={(checked) => {
                        if (checked === true) {
                          onChange([...selectedSet, player.id])
                          return
                        }

                        onChange(
                          selectedPlayerIds.filter((id) => id !== player.id),
                        )
                      }}
                    />
                    <Label className="cursor-pointer text-sm" htmlFor={inputId}>
                      <span style={{ color: classColor }}>{player.name}</span>
                    </Label>
                  </div>
                </CardContent>
              </Card>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
