/**
 * Player-focused navigation grid from report view to boss-kill fight pages.
 */
import type { FC } from 'react'
import type { PlayerClass } from '@wcl-threat/wcl-types'
import { Link } from 'react-router-dom'

import { getClassColor } from '../lib/class-colors'
import {
  isBossFightForNavigation,
  normalizeEncounterNameForNavigation,
} from '../lib/fight-navigation'
import type { ReportActorSummary, ReportFightSummary } from '../types/api'

export type PlayersNavigationListProps = {
  reportId: string
  players: ReportActorSummary[]
  fights: ReportFightSummary[]
}

export const PlayersNavigationList: FC<PlayersNavigationListProps> = ({
  reportId,
  players,
  fights,
}) => {
  const playerRows = players.filter((actor) => actor.type === 'Player')

  if (playerRows.length === 0) {
    return <p className="text-sm text-muted">No players detected in this report.</p>
  }

  const knownBossNames = new Set(
    fights
      .filter(isBossFightForNavigation)
      .map((fight) => normalizeEncounterNameForNavigation(fight.name)),
  )

  const bossKillColumns = fights.filter(
    (fight) =>
      fight.kill &&
      (isBossFightForNavigation(fight) ||
        knownBossNames.has(normalizeEncounterNameForNavigation(fight.name))),
  )

  if (bossKillColumns.length === 0) {
    return <p className="text-sm text-muted">No boss kills found for player navigation.</p>
  }

  const sortedPlayers = playerRows
    .filter((player) =>
      bossKillColumns.some((fight) => fight.friendlyPlayers.includes(player.id)),
    )
    .sort((left, right) => {
      const byName = left.name.localeCompare(right.name, undefined, {
        sensitivity: 'base',
      })

      if (byName !== 0) {
        return byName
      }

      return left.id - right.id
    })

  if (sortedPlayers.length === 0) {
    return <p className="text-sm text-muted">No players found with boss kills.</p>
  }

  const resolvePlayerRole = (
    player: ReportActorSummary,
  ): 'tank' | 'heal' | 'dps' | null => {
    const role = (player as ReportActorSummary & { role?: string | null }).role

    if (role === 'tank' || role === 'heal' || role === 'dps') {
      return role
    }

    return null
  }

  const hasRoleColumn = sortedPlayers.some((player) => resolvePlayerRole(player) !== null)

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
            <th className="px-2 py-2">Player</th>
            {hasRoleColumn ? <th className="px-2 py-2">Role</th> : null}
            {bossKillColumns.map((fight) => (
              <th className="px-2 py-2" key={fight.id}>
                {fight.name} #{fight.id}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedPlayers.map((player) => {
            const classColor = getClassColor(player.subType as PlayerClass | undefined)
            const role = resolvePlayerRole(player)

            return (
              <tr className="border-b border-border" key={player.id}>
                <td className="px-2 py-2">
                  <span className="font-medium" style={{ color: classColor }}>
                    {player.name}
                  </span>
                </td>
                {hasRoleColumn ? (
                  <td className="px-2 py-2 text-xs uppercase text-muted">
                    {role ?? '—'}
                  </td>
                ) : null}
                {bossKillColumns.map((fight) => {
                  const participated = fight.friendlyPlayers.includes(player.id)
                  const petIds = fight.friendlyPets
                    .filter((pet) => pet.petOwner === player.id)
                    .map((pet) => pet.id)
                  const linkPlayerIds = Array.from(new Set([player.id, ...petIds])).join(',')

                  return (
                    <td className="px-2 py-2 align-middle" key={fight.id}>
                      {participated ? (
                        <Link
                          aria-label={`Open ${fight.name} chart for ${player.name}`}
                          className="inline-flex items-center justify-center rounded border border-border p-1"
                          title={`Open ${fight.name} chart for ${player.name}`}
                          to={`/report/${reportId}/fight/${fight.id}?players=${linkPlayerIds}&type=summary`}
                        >
                          <svg
                            aria-hidden="true"
                            className="h-3.5 w-3.5"
                            fill="none"
                            viewBox="0 0 16 16"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              d="M2 13.5h12M3 11l3-3 2 2 4-5"
                              stroke="currentColor"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="1.4"
                            />
                          </svg>
                        </Link>
                      ) : null}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
