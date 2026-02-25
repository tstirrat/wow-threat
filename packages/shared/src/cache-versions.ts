/**
 * Shared cache schema and immutable-route version constants.
 *
 * `cacheSchemaVersions` backs API KV key versioning.
 * `immutableApiRouteVersions` tracks immutable report/fight response semantics.
 * `immutableApiCacheVersions` is sent as a query param by clients and folds in
 * route + relevant schema versions as a compact token.
 */
export const cacheSchemaVersions = {
  report: 'v6',
  fights: 'v3',
  events: 'v3',
  friendlyBuffBandsByFight: 'v5',
  encounterActorRoles: 'v1',
  augmentedEvents: 'v14',
} as const

export const immutableApiRouteVersions = {
  report: 'v1',
  fight: 'v1',
} as const

function stripVersionPrefix(version: string): string {
  return version.startsWith('v') ? version.slice(1) : version
}

export const immutableApiCacheVersions = {
  report: `report-v${stripVersionPrefix(immutableApiRouteVersions.report)}${stripVersionPrefix(cacheSchemaVersions.report)}`,
  fight: `fight-v${stripVersionPrefix(immutableApiRouteVersions.fight)}${stripVersionPrefix(cacheSchemaVersions.fights)}${stripVersionPrefix(cacheSchemaVersions.encounterActorRoles)}`,
} as const
