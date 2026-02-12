/**
 * Fight navigation list for report-level route.
 */
import type { FC } from 'react'
import { Link } from 'react-router-dom'

import {
  buildFightNavigationGroups,
  normalizeEncounterNameForNavigation,
} from '../lib/fight-navigation'
import type { ReportFightSummary } from '../types/api'

export type FightsListProps = {
  reportId: string
  fights: ReportFightSummary[]
}

const formatFightDuration = (fight: ReportFightSummary): string => {
  const durationMs = Math.max(0, fight.endTime - fight.startTime)
  const totalSeconds = Math.floor(durationMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export const FightsList: FC<FightsListProps> = ({
  reportId,
  fights,
}) => {
  if (fights.length === 0) {
    return <p className="text-sm text-muted">No fights found in this report.</p>
  }

  const grouped = buildFightNavigationGroups(fights)
  const trashFightGroups = Array.from(
    grouped.trashFights.reduce(
      (accumulator, fight) => {
        const key = normalizeEncounterNameForNavigation(fight.name)
        const existing = accumulator.get(key)

        if (existing) {
          existing.fights.push(fight)
          return accumulator
        }

        accumulator.set(key, {
          name: fight.name,
          fights: [fight],
        })

        return accumulator
      },
      new Map<
        string,
        {
          name: string
          fights: ReportFightSummary[]
        }
      >(),
    ),
  ).map(([, value]) => value)

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <h3 className="text-xs uppercase tracking-wide text-muted">Boss kills</h3>
        {grouped.bossEncounters.length > 0 ? (
          <ul aria-label="Boss kill fights" className="space-y-2">
            {grouped.bossEncounters.map((encounter) => (
              <li
                className="rounded-md border border-border bg-panel px-3 py-3"
                key={encounter.encounterKey}
              >
                <div className="flex flex-wrap items-center gap-1 text-sm">
                  <Link
                    className="font-medium underline"
                    to={`/report/${reportId}/fight/${encounter.primaryKill.id}?type=summary`}
                  >
                    {encounter.name}
                  </Link>
                  <span>:</span>
                  <Link
                    className="underline"
                    to={`/report/${reportId}/fight/${encounter.primaryKill.id}?type=summary`}
                  >
                    Kill ({formatFightDuration(encounter.primaryKill)})
                  </Link>
                  {encounter.extraKills.length > 0 ? (
                    <span className="inline-flex flex-wrap items-center gap-1">
                      <span>Kills:</span>
                      {encounter.extraKills.map((fight, index) => (
                        <Link
                          className="underline"
                          key={fight.id}
                          to={`/report/${reportId}/fight/${fight.id}?type=summary`}
                        >
                          kill {index + 2}
                        </Link>
                      ))}
                    </span>
                  ) : null}
                  {encounter.wipes.length > 0 ? (
                    <span className="inline-flex flex-wrap items-center gap-1">
                      <span>Wipes:</span>
                      {encounter.wipes.map((fight, index) => (
                        <Link
                          className="underline"
                          key={fight.id}
                          to={`/report/${reportId}/fight/${fight.id}?type=summary`}
                        >
                          wipe {index + 1}
                        </Link>
                      ))}
                    </span>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">No boss kills found in this report.</p>
        )}
      </div>

      {grouped.trashFights.length > 0 ? (
        <div className="space-y-2">
          <h3 className="text-xs uppercase tracking-wide text-muted">Trash fights</h3>
          <details className="rounded-md border border-dashed border-border bg-panel px-3 py-2 opacity-80">
            <summary
              aria-label={`Show trash fights (${grouped.trashFights.length})`}
              className="cursor-pointer text-sm text-muted"
            >
              Show trash fights ({grouped.trashFights.length})
            </summary>
            <p className="mt-2 flex flex-wrap gap-x-1 gap-y-1 text-sm text-muted">
              {trashFightGroups.map((trashGroup, groupIndex) => (
                <span key={normalizeEncounterNameForNavigation(trashGroup.name)}>
                  {groupIndex > 0 ? ', ' : null}
                  <span className="font-medium">{trashGroup.name}</span>{' '}
                  {trashGroup.fights.map((fight, fightIndex) => (
                    <span key={fight.id}>
                      {fightIndex > 0 ? ' ' : null}
                      <Link
                        className="underline"
                        to={`/report/${reportId}/fight/${fight.id}?type=summary`}
                      >
                        #{fight.id}
                      </Link>
                    </span>
                  ))}
                </span>
              ))}
            </p>
          </details>
        </div>
      ) : null}
    </div>
  )
}
