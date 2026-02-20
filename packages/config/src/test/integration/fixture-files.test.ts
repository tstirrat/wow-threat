/**
 * Fixture File Helper Tests
 *
 * Verifies fight events file naming and resolution behavior.
 */
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import {
  fightEventsFileName,
  hasFightEventsFile,
  resolveFixtureEventsFilePath,
  slugifyFightName,
} from './fixture-files'

const tempDirectories: string[] = []

afterEach(async () => {
  await Promise.all(
    tempDirectories.map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  )
  tempDirectories.length = 0
})

describe('slugifyFightName', () => {
  it('normalizes fight names into stable slugs', () => {
    expect(slugifyFightName('Patchwerk')).toBe('patchwerk')
    expect(slugifyFightName('Noth the Plaguebringer (Heroic)')).toBe(
      'noth-the-plaguebringer-heroic',
    )
  })
})

describe('fightEventsFileName', () => {
  it('builds fight-scoped event filenames with fight name slugs', () => {
    expect(fightEventsFileName(14, 'Patchwerk')).toBe(
      'fight-14-patchwerk-events.json',
    )
  })
})

describe('resolveFixtureEventsFilePath', () => {
  it('resolves the canonical fight-id + fight-name file first', async () => {
    const fixtureDirectory = await mkdtemp(
      resolve(tmpdir(), 'threat-config-fixtures-'),
    )
    tempDirectories.push(fixtureDirectory)

    const fileName = fightEventsFileName(14, 'Patchwerk')
    await writeFile(resolve(fixtureDirectory, fileName), '[]\n', 'utf8')

    const resolvedPath = resolveFixtureEventsFilePath(
      fixtureDirectory,
      14,
      'Patchwerk',
    )

    expect(basename(resolvedPath)).toBe(fileName)
  })

  it('falls back to any fight-<id>-*-events file when slug input differs', async () => {
    const fixtureDirectory = await mkdtemp(
      resolve(tmpdir(), 'threat-config-fixtures-'),
    )
    tempDirectories.push(fixtureDirectory)

    await writeFile(
      resolve(fixtureDirectory, 'fight-14-patchwerk-events.json'),
      '[]\n',
      'utf8',
    )

    const resolvedPath = resolveFixtureEventsFilePath(
      fixtureDirectory,
      14,
      'Patchwerk 25',
    )

    expect(basename(resolvedPath)).toBe('fight-14-patchwerk-events.json')
  })

  it('throws when no compatible events file exists', async () => {
    const fixtureDirectory = await mkdtemp(
      resolve(tmpdir(), 'threat-config-fixtures-'),
    )
    tempDirectories.push(fixtureDirectory)

    await mkdir(fixtureDirectory, { recursive: true })

    expect(() =>
      resolveFixtureEventsFilePath(fixtureDirectory, 14, 'Patchwerk'),
    ).toThrow(`missing events for fight 14`)
  })
})

describe('hasFightEventsFile', () => {
  it('detects named fight events files by fight id', async () => {
    const fixtureDirectory = await mkdtemp(
      resolve(tmpdir(), 'threat-config-fixtures-'),
    )
    tempDirectories.push(fixtureDirectory)

    await writeFile(
      resolve(fixtureDirectory, 'fight-14-patchwerk-events.json'),
      '[]\n',
      'utf8',
    )

    expect(hasFightEventsFile(fixtureDirectory, 14)).toBe(true)
    expect(hasFightEventsFile(fixtureDirectory, 15)).toBe(false)
  })
})
