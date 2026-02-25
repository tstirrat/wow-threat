import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const fixtureDirectory = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../fixtures',
)

export function readFixtureFile<T>(fileName: string): T {
  const fixturePath = resolve(fixtureDirectory, fileName)
  const fixtureContent = readFileSync(fixturePath, 'utf8')
  return JSON.parse(fixtureContent) as T
}
