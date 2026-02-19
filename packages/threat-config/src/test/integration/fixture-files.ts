/**
 * Fixture File Helpers
 *
 * Resolves fight event file names and paths for integration fixtures.
 */
import { existsSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

const fightEventsFilePattern = /^fight-\d+-[a-z0-9-]+-events\.json$/u

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Slugify a fight name for stable fixture file naming.
 */
export function slugifyFightName(fightName: string): string {
  const slug = fightName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return slug.length > 0 ? slug : 'unknown-fight'
}

/**
 * Build the canonical fight events filename.
 */
export function fightEventsFileName(
  fightId: number,
  fightName: string,
): string {
  return `fight-${fightId}-${slugifyFightName(fightName)}-events.json`
}

/**
 * Check whether a filename matches fight events naming conventions.
 */
export function isFightEventsFileName(fileName: string): boolean {
  return fightEventsFilePattern.test(fileName)
}

/**
 * Check whether a fixture directory contains any fight-scoped events file.
 */
export function hasAnyFightEventsFile(fixtureDirectory: string): boolean {
  try {
    return readdirSync(fixtureDirectory).some((entry) =>
      isFightEventsFileName(entry),
    )
  } catch {
    return false
  }
}

/**
 * Check whether a fixture directory contains events for a specific fight id.
 */
export function hasFightEventsFile(
  fixtureDirectory: string,
  fightId: number,
): boolean {
  try {
    const fightIdPattern = new RegExp(
      `^fight-${escapeRegExp(String(fightId))}(?:-[a-z0-9-]+)?-events\\.json$`,
      'u',
    )

    return readdirSync(fixtureDirectory).some((entry) =>
      fightIdPattern.test(entry),
    )
  } catch {
    return false
  }
}

/**
 * Resolve a fixture events file path for one fight.
 *
 * Resolution order:
 * 1) Canonical `fight-<id>-<name>-events.json` (when fightName is provided)
 * 2) Any `fight-<id>-*-events.json`
 */
export function resolveFixtureEventsFilePath(
  fixtureDirectory: string,
  fightId: number,
  fightName?: string,
): string {
  if (fightName) {
    const namedPath = resolve(
      fixtureDirectory,
      fightEventsFileName(fightId, fightName),
    )
    if (existsSync(namedPath)) {
      return namedPath
    }
  }

  const fightIdNamedPattern = new RegExp(
    `^fight-${escapeRegExp(String(fightId))}-[a-z0-9-]+-events\\.json$`,
    'u',
  )
  const matchingFightFileName = readdirSync(fixtureDirectory).find((entry) =>
    fightIdNamedPattern.test(entry),
  )
  if (matchingFightFileName) {
    return resolve(fixtureDirectory, matchingFightFileName)
  }

  throw new Error(
    `Fixture ${fixtureDirectory} is missing events for fight ${fightId}`,
  )
}
