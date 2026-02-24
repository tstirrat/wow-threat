/**
 * Player-focused navigation grid from report view to boss-kill fight pages.
 */
import type { PlayerClass } from '@wow-threat/wcl-types'
import type { FC } from 'react'
import { Link } from 'react-router-dom'

import { getClassColor } from '../lib/class-colors'
import {
  isBossFightForNavigation,
  normalizeEncounterNameForNavigation,
} from '../lib/fight-navigation'
import type {
  ReportActorRole,
  ReportActorSummary,
  ReportFightSummary,
} from '../types/api'
import { Button } from './ui/button'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table'

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
    return (
      <p className="text-sm text-muted">No players detected in this report.</p>
    )
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
    return (
      <p className="text-sm text-muted">
        No boss kills found for player navigation.
      </p>
    )
  }

  const sortedPlayers = playerRows
    .filter((player) =>
      bossKillColumns.some((fight) =>
        fight.friendlyPlayers.includes(player.id),
      ),
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
    return (
      <p className="text-sm text-muted">No players found with boss kills.</p>
    )
  }

  const resolvePlayerRole = (player: ReportActorSummary): ReportActorRole | null =>
    player.role ?? null

  const hasRoleColumn = sortedPlayers.some(
    (player) => resolvePlayerRole(player) !== null,
  )

  return (
    <Table aria-label="Player navigation by boss kill" className="text-sm">
      <TableCaption className="sr-only">
        Player navigation by boss kill
      </TableCaption>
      <TableHeader>
        <TableRow className="text-left text-xs uppercase tracking-wide text-muted">
          <TableHead>Player</TableHead>
          {hasRoleColumn ? <TableHead>Role</TableHead> : null}
          {bossKillColumns.map((fight) => (
            <TableHead key={fight.id}>
              {fight.name} #{fight.id}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {sortedPlayers.map((player) => {
          const classColor = getClassColor(
            player.subType as PlayerClass | undefined,
          )
          const role = resolvePlayerRole(player)

          return (
            <TableRow key={player.id}>
              <TableCell>
                <span className="font-medium" style={{ color: classColor }}>
                  {player.name}
                </span>
              </TableCell>
              {hasRoleColumn ? (
                <TableCell className="text-xs uppercase text-muted">
                  {role ?? '—'}
                </TableCell>
              ) : null}
              {bossKillColumns.map((fight) => {
                const participated = fight.friendlyPlayers.includes(player.id)
                const fightQuery = new URLSearchParams({
                  players: String(player.id),
                  focusId: String(player.id),
                }).toString()

                return (
                  <TableCell className="align-middle" key={fight.id}>
                    {participated ? (
                      <Button asChild size="icon-sm" variant="outline">
                        <Link
                          aria-label={`Open ${fight.name} chart for ${player.name}`}
                          title={`Open ${fight.name} chart for ${player.name}`}
                          to={`/report/${reportId}/fight/${fight.id}?${fightQuery}`}
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
                      </Button>
                    ) : null}
                  </TableCell>
                )
              })}
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
