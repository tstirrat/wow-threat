/**
 * Schema-accurate WCL GraphQL types reachable from `Report`.
 *
 * Generated from recursive introspection against `www.warcraftlogs.com` on
 * 2026-02-23.
 *
 * This file models what the API can return if queried, not what our app
 * currently requests. Because GraphQL responses are selection-set dependent,
 * these types are intentionally broader and more nullable than the query-shape
 * types in `reports.ts`.
 *
 * Prefer `reports.ts` for application/runtime typing. Use this file for schema
 * exploration, type generation inputs, and drift checks.
 */

export interface WCLSchemaBracket {
  min: number
  max: number
  bucket: number
  type: string | null
}

export interface WCLSchemaCharacter {
  canonicalID: number
  claimed: boolean | null
  classID: number
  /** Args: byBracket: boolean | null, className: string | null, compare: WCLSchemaRankingCompareType | null, difficulty: number | null, encounterID: number | null, includeCombatantInfo: boolean | null, includeOtherPlayers: boolean | null, includeHistoricalGraph: boolean | null, includePrivateLogs: boolean | null, metric: WCLSchemaCharacterRankingMetricType | null, partition: number | null, role: WCLSchemaRoleType | null, size: number | null, specName: string | null, timeframe: WCLSchemaRankingTimeframeType | null */
  encounterRankings: unknown | null
  faction: WCLSchemaGameFaction
  /** Args: specID: number | null, forceUpdate: boolean | null */
  gameData: unknown | null
  guildRank: number
  guilds: Array<WCLSchemaGuild | null> | null
  hidden: boolean
  id: number
  level: number
  name: string
  /** Args: limit: number | null, page: number | null */
  recentReports: WCLSchemaReportPagination | null
  server: WCLSchemaServer
  /** Args: byBracket: boolean | null, className: string | null, compare: WCLSchemaRankingCompareType | null, difficulty: number | null, includePrivateLogs: boolean | null, metric: WCLSchemaCharacterPageRankingMetricType | null, partition: number | null, role: WCLSchemaRoleType | null, size: number | null, specName: string | null, timeframe: WCLSchemaRankingTimeframeType | null, zoneID: number | null */
  zoneRankings: unknown | null
}

export type WCLSchemaCharacterPageRankingMetricType =
  | 'bosscdps'
  | 'bossdps'
  | 'bossndps'
  | 'bossrdps'
  | 'default'
  | 'dps'
  | 'hps'
  | 'krsi'
  | 'playerscore'
  | 'playerspeed'
  | 'cdps'
  | 'ndps'
  | 'rdps'
  | 'tankhps'
  | 'wdps'
  | 'healercombineddps'
  | 'healercombinedbossdps'
  | 'healercombinedcdps'
  | 'healercombinedbosscdps'
  | 'healercombinedndps'
  | 'healercombinedbossndps'
  | 'healercombinedrdps'
  | 'healercombinedbossrdps'
  | 'tankcombineddps'
  | 'tankcombinedbossdps'
  | 'tankcombinedcdps'
  | 'tankcombinedbosscdps'
  | 'tankcombinedndps'
  | 'tankcombinedbossndps'
  | 'tankcombinedrdps'
  | 'tankcombinedbossrdps'
  | 'points_and_damage'
  | 'points_and_healing'

export interface WCLSchemaCharacterPagination {
  data: Array<WCLSchemaCharacter | null> | null
  total: number
  per_page: number
  current_page: number
  from: number | null
  to: number | null
  last_page: number
  has_more_pages: boolean
}

export type WCLSchemaCharacterRankingMetricType =
  | 'bosscdps'
  | 'bossdps'
  | 'bossndps'
  | 'bossrdps'
  | 'default'
  | 'dps'
  | 'hps'
  | 'krsi'
  | 'playerscore'
  | 'playerspeed'
  | 'cdps'
  | 'ndps'
  | 'rdps'
  | 'tankhps'
  | 'wdps'
  | 'healercombineddps'
  | 'healercombinedbossdps'
  | 'healercombinedcdps'
  | 'healercombinedbosscdps'
  | 'healercombinedndps'
  | 'healercombinedbossndps'
  | 'healercombinedrdps'
  | 'healercombinedbossrdps'
  | 'tankcombineddps'
  | 'tankcombinedbossdps'
  | 'tankcombinedcdps'
  | 'tankcombinedbosscdps'
  | 'tankcombinedndps'
  | 'tankcombinedbossndps'
  | 'tankcombinedrdps'
  | 'tankcombinedbossrdps'

export interface WCLSchemaDifficulty {
  id: number
  name: string
  sizes: Array<number | null> | null
}

export interface WCLSchemaEncounter {
  id: number
  name: string
  /** Args: bracket: number | null, difficulty: number | null, filter: string | null, page: number | null, partition: number | null, serverRegion: string | null, serverSlug: string | null, size: number | null, leaderboard: WCLSchemaLeaderboardRank | null, hardModeLevel: WCLSchemaHardModeLevelRankFilter | null, metric: WCLSchemaCharacterRankingMetricType | null, includeCombatantInfo: boolean | null, includeOtherPlayers: boolean | null, className: string | null, specName: string | null, externalBuffs: WCLSchemaExternalBuffRankFilter | null, covenantID: number | null, soulbindID: number | null */
  characterRankings: unknown | null
  /** Args: bracket: number | null, difficulty: number | null, filter: string | null, page: number | null, partition: number | null, serverRegion: string | null, serverSlug: string | null, size: number | null, leaderboard: WCLSchemaLeaderboardRank | null, hardModeLevel: WCLSchemaHardModeLevelRankFilter | null, metric: WCLSchemaFightRankingMetricType | null */
  fightRankings: unknown | null
  zone: WCLSchemaZone
  journalID: number
}

export interface WCLSchemaEncounterPhases {
  encounterID: number
  separatesWipes: boolean | null
  phases: Array<WCLSchemaPhaseMetadata> | null
}

export type WCLSchemaEventDataType =
  | 'All'
  | 'Buffs'
  | 'Casts'
  | 'CombatantInfo'
  | 'DamageDone'
  | 'DamageTaken'
  | 'Deaths'
  | 'Debuffs'
  | 'Dispels'
  | 'Healing'
  | 'Interrupts'
  | 'Resources'
  | 'Summons'
  | 'Threat'

export interface WCLSchemaExpansion {
  id: number
  name: string
  zones: Array<WCLSchemaZone | null> | null
}

export type WCLSchemaExternalBuffRankFilter = 'Any' | 'Require' | 'Exclude'

export type WCLSchemaFightRankingMetricType =
  | 'default'
  | 'execution'
  | 'feats'
  | 'score'
  | 'speed'
  | 'progress'

export interface WCLSchemaGameFaction {
  id: number
  name: string
}

export interface WCLSchemaGameZone {
  id: number
  name: string | null
}

export type WCLSchemaGraphDataType =
  | 'Summary'
  | 'Buffs'
  | 'Casts'
  | 'DamageDone'
  | 'DamageTaken'
  | 'Deaths'
  | 'Debuffs'
  | 'Dispels'
  | 'Healing'
  | 'Interrupts'
  | 'Resources'
  | 'Summons'
  | 'Survivability'
  | 'Threat'

export interface WCLSchemaGuild {
  /** Args: guildTagID: number | null, limit: number | null, page: number | null, zoneID: number | null */
  attendance: WCLSchemaGuildAttendancePagination
  competitionMode: boolean
  description: string
  faction: WCLSchemaGameFaction
  id: number
  name: string
  server: WCLSchemaServer
  stealthMode: boolean
  tags: Array<WCLSchemaGuildTag | null> | null
  /** Args: limit: number | null, page: number | null */
  members: WCLSchemaCharacterPagination
  currentUserRank: WCLSchemaGuildRank | null
  /** Args: zoneId: number | null */
  zoneRanking: WCLSchemaGuildZoneRankings
}

export interface WCLSchemaGuildAttendance {
  code: string
  players: Array<WCLSchemaPlayerAttendance | null> | null
  startTime: number | null
  zone: WCLSchemaZone | null
}

export interface WCLSchemaGuildAttendancePagination {
  data: Array<WCLSchemaGuildAttendance | null> | null
  total: number
  per_page: number
  current_page: number
  from: number | null
  to: number | null
  last_page: number
  has_more_pages: boolean
}

export interface WCLSchemaGuildPagination {
  data: Array<WCLSchemaGuild | null> | null
  total: number
  per_page: number
  current_page: number
  from: number | null
  to: number | null
  last_page: number
  has_more_pages: boolean
}

export type WCLSchemaGuildRank =
  | 'NonMember'
  | 'Applicant'
  | 'Recruit'
  | 'Member'
  | 'Officer'
  | 'GuildMaster'

export interface WCLSchemaGuildTag {
  id: number
  guild: WCLSchemaGuild
  name: string
}

export interface WCLSchemaGuildZoneRankings {
  /** Args: size: number | null */
  progress: WCLSchemaWorldRegionServerRankPositions | null
  /** Args: size: number | null, difficulty: number | null */
  speed: WCLSchemaWorldRegionServerRankPositions | null
  /** Args: size: number | null, difficulty: number | null */
  completeRaidSpeed: WCLSchemaWorldRegionServerRankPositions | null
}

export type WCLSchemaHardModeLevelRankFilter =
  | 'Any'
  | 'Highest'
  | 'NormalMode'
  | 'Level0'
  | 'Level1'
  | 'Level2'
  | 'Level3'
  | 'Level4'

export type WCLSchemaHostilityType = 'Friendlies' | 'Enemies'

export type WCLSchemaKillType =
  | 'All'
  | 'Encounters'
  | 'Kills'
  | 'Trash'
  | 'Wipes'

export type WCLSchemaLeaderboardRank = 'Any' | 'LogsOnly'

export interface WCLSchemaPartition {
  id: number
  name: string
  compactName: string
  default: boolean
}

export interface WCLSchemaPhaseMetadata {
  id: number
  name: string
  isIntermission: boolean | null
}

export interface WCLSchemaPhaseTransition {
  id: number
  startTime: number
}

export interface WCLSchemaPlayerAttendance {
  name: string | null
  type: string | null
  presence: number | null
}

export interface WCLSchemaRank {
  number: number
  percentile: number | null
  color: string
}

export type WCLSchemaRankingCompareType = 'Rankings' | 'Parses'

export type WCLSchemaRankingTimeframeType = 'Today' | 'Historical'

export interface WCLSchemaReportRankingCharacter {
  id: number
  name: string
  server: {
    id: number | null
    name: string | null
    region: 'US' | 'EU' | 'TW' | 'KR' | 'CN'
  } | null
  class: string
  spec: string
  amount: number
  rank: number
  best: number
  totalParses: number
  rankPercent: number
  bracketData: number
  bracket: number
}

export interface WCLSchemaReportRankingRoleGroup {
  characters: WCLSchemaReportRankingCharacter[]
}

export interface WCLSchemaReportRankingRoles {
  tanks: WCLSchemaReportRankingRoleGroup
  healers: WCLSchemaReportRankingRoleGroup
  dps: WCLSchemaReportRankingRoleGroup
}

export interface WCLSchemaReportEncounterRanking {
  encounterID: number
  encounterId?: number | null
  fightID: number | null
  roles: WCLSchemaReportRankingRoles
}

export interface WCLSchemaReportPlayerDetailSpec {
  spec: string
  count: number
}

export interface WCLSchemaReportPlayerDetailEntry {
  id: number
  name: string
  type: string
  icon?: string | null
  specs: WCLSchemaReportPlayerDetailSpec[]
}

export interface WCLSchemaReportPlayerDetailsByRole {
  tanks?: WCLSchemaReportPlayerDetailEntry[]
  healers?: WCLSchemaReportPlayerDetailEntry[]
  dps?: WCLSchemaReportPlayerDetailEntry[]
}

export interface WCLSchemaReportPlayerDetails {
  data?: {
    playerDetails?: WCLSchemaReportPlayerDetailsByRole | null
  } | null
}

export interface WCLSchemaRegion {
  id: number
  compactName: string
  name: string
  slug: string
  subregions: Array<WCLSchemaSubregion | null> | null
  /** Args: limit: number | null, page: number | null */
  servers: WCLSchemaServerPagination | null
}

export interface WCLSchemaReport {
  code: string
  endTime: number
  /** Args: abilityID: number | null, dataType: WCLSchemaEventDataType | null, death: number | null, difficulty: number | null, encounterID: number | null, endTime: number | null, fightIDs: Array<number | null> | null, filterExpression: string | null, hostilityType: WCLSchemaHostilityType | null, includeResources: boolean | null, killType: WCLSchemaKillType | null, limit: number | null, sourceAurasAbsent: string | null, sourceAurasPresent: string | null, sourceClass: string | null, sourceID: number | null, sourceInstanceID: number | null, startTime: number | null, targetAurasAbsent: string | null, targetAurasPresent: string | null, targetClass: string | null, targetID: number | null, targetInstanceID: number | null, translate: boolean | null, useAbilityIDs: boolean | null, useActorIDs: boolean | null, viewOptions: number | null, wipeCutoff: number | null */
  events: WCLSchemaReportEventPaginator | null
  exportedSegments: number
  /** Args: difficulty: number | null, encounterID: number | null, fightIDs: Array<number | null> | null, killType: WCLSchemaKillType | null, translate: boolean | null */
  fights: Array<WCLSchemaReportFight | null> | null
  /** Args: abilityID: number | null, dataType: WCLSchemaGraphDataType | null, death: number | null, difficulty: number | null, encounterID: number | null, endTime: number | null, fightIDs: Array<number | null> | null, filterExpression: string | null, hostilityType: WCLSchemaHostilityType | null, killType: WCLSchemaKillType | null, sourceAurasAbsent: string | null, sourceAurasPresent: string | null, sourceClass: string | null, sourceID: number | null, sourceInstanceID: number | null, startTime: number | null, targetAurasAbsent: string | null, targetAurasPresent: string | null, targetClass: string | null, targetID: number | null, targetInstanceID: number | null, translate: boolean | null, viewOptions: number | null, viewBy: WCLSchemaViewType | null, wipeCutoff: number | null */
  graph: unknown | null
  guild: WCLSchemaGuild | null
  guildTag: WCLSchemaGuildTag | null
  owner: WCLSchemaUser | null
  /** Args: translate: boolean | null */
  masterData: WCLSchemaReportMasterData | null
  /** Args: difficulty: number | null, encounterID: number | null, endTime: number | null, fightIDs: Array<number | null> | null, killType: WCLSchemaKillType | null, startTime: number | null, translate: boolean | null, includeCombatantInfo: boolean | null */
  playerDetails: WCLSchemaReportPlayerDetails | null
  rankedCharacters: Array<WCLSchemaCharacter | null> | null
  /**
   * Rankings information for a report, filterable to specific fights, bosses,
   * metrics, etc. This data is not considered frozen, and it can change without
   * notice. Use at your own risk.
   *
   * Arguments
   * - compare: Optional. Whether or not to compare against rankings
   *   (best scores across the entire tier) or two weeks worth of parses (more
   *   representative of real-world performance).
   *
   * - difficulty: Optional. Whether or not to filter the fights to a
   *   specific difficulty. By default all fights are included.
   *
   * - encounterID: Optional. Whether or not to filter the fights to a
   *   specific boss. By default all fights are included.
   *
   * - fightIDs: Optional. A list of fight ids to include. Fights with
   *   any other id will be excluded.
   *
   * - playerMetric: Optional. You can filter to a specific player
   *   metric like dps or hps.
   *
   * - timeframe: Optional. Whether or not the returned report
   *   rankings should be compared against today's rankings or historical rankings
   *   around the time the fight occurred.
   *
   * Args: compare: WCLSchemaRankingCompareType | null, difficulty: number | null, encounterID: number | null, fightIDs: Array<number | null> | null, playerMetric: WCLSchemaReportRankingMetricType | null, timeframe: WCLSchemaRankingTimeframeType | null
   */
  rankings: {
    data:
      | WCLSchemaRankingCompareType[]
      | WCLSchemaReportEncounterRanking[]
      | WCLSchemaReportRankingMetricType[]
      | WCLSchemaRankingTimeframeType[]
  } | null
  region: WCLSchemaRegion | null
  revision: number
  segments: number
  startTime: number
  /** Args: abilityID: number | null, dataType: WCLSchemaTableDataType | null, death: number | null, difficulty: number | null, encounterID: number | null, endTime: number | null, fightIDs: Array<number | null> | null, filterExpression: string | null, hostilityType: WCLSchemaHostilityType | null, killType: WCLSchemaKillType | null, sourceAurasAbsent: string | null, sourceAurasPresent: string | null, sourceClass: string | null, sourceID: number | null, sourceInstanceID: number | null, startTime: number | null, targetAurasAbsent: string | null, targetAurasPresent: string | null, targetClass: string | null, targetID: number | null, targetInstanceID: number | null, translate: boolean | null, viewOptions: number | null, viewBy: WCLSchemaViewType | null, wipeCutoff: number | null */
  table: unknown | null
  title: string
  visibility: string
  zone: WCLSchemaZone | null
  archiveStatus: WCLSchemaReportArchiveStatus | null
  phases: Array<WCLSchemaEncounterPhases> | null
}

export interface WCLSchemaReportAbility {
  gameID: number | null
  icon: string | null
  name: string | null
  type: string | null
}

export interface WCLSchemaReportActor {
  gameID: number | null
  icon: string | null
  id: number | null
  name: string | null
  petOwner: number | null
  server: string | null
  subType: string | null
  type: string | null
}

export interface WCLSchemaReportArchiveStatus {
  isArchived: boolean
  isAccessible: boolean
  archiveDate: number | null
}

export interface WCLSchemaReportDungeonPull {
  boundingBox: WCLSchemaReportMapBoundingBox | null
  encounterID: number
  endTime: number
  enemyNPCs: Array<WCLSchemaReportDungeonPullNPC | null> | null
  id: number
  kill: boolean | null
  maps: Array<WCLSchemaReportMap | null> | null
  name: string
  startTime: number
  x: number
  y: number
}

export interface WCLSchemaReportDungeonPullNPC {
  id: number | null
  gameID: number | null
  minimumInstanceID: number | null
  maximumInstanceID: number | null
  minimumInstanceGroupID: number | null
  maximumInstanceGroupID: number | null
}

export interface WCLSchemaReportEventPaginator {
  data: unknown | null
  nextPageTimestamp: number | null
}

export interface WCLSchemaReportFight {
  averageItemLevel: number | null
  bossPercentage: number | null
  boundingBox: WCLSchemaReportMapBoundingBox | null
  classicSeasonID: number | null
  completeRaid: boolean
  difficulty: number | null
  dungeonPulls: Array<WCLSchemaReportDungeonPull | null> | null
  encounterID: number
  endTime: number
  enemyNPCs: Array<WCLSchemaReportFightNPC | null> | null
  enemyPets: Array<WCLSchemaReportFightNPC | null> | null
  enemyPlayers: Array<number | null> | null
  fightPercentage: number | null
  friendlyNPCs: Array<WCLSchemaReportFightNPC | null> | null
  friendlyPets: Array<WCLSchemaReportFightNPC | null> | null
  friendlyPlayers: Array<number | null> | null
  gameZone: WCLSchemaGameZone | null
  hardModeLevel: number | null
  id: number
  inProgress: boolean | null
  keystoneAffixes: Array<number | null> | null
  keystoneBonus: number | null
  keystoneLevel: number | null
  keystoneTime: number | null
  kill: boolean | null
  lastPhase: number | null
  lastPhaseAsAbsoluteIndex: number | null
  lastPhaseIsIntermission: boolean | null
  layer: number | null
  maps: Array<WCLSchemaReportMap | null> | null
  name: string
  originalEncounterID: number | null
  phaseTransitions: Array<WCLSchemaPhaseTransition> | null
  rating: number | null
  size: number | null
  startTime: number
  /** Args: actorID: number */
  talentImportCode: string | null
  wipeCalledTime: number | null
}

export interface WCLSchemaReportFightNPC {
  gameID: number | null
  id: number | null
  instanceCount: number | null
  groupCount: number | null
  petOwner: number | null
}

export interface WCLSchemaReportMap {
  id: number
}

export interface WCLSchemaReportMapBoundingBox {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

export interface WCLSchemaReportMasterData {
  logVersion: number
  gameVersion: number | null
  lang: string | null
  abilities: Array<WCLSchemaReportAbility | null> | null
  /** Args: type: string | null, subType: string | null */
  actors: Array<WCLSchemaReportActor | null> | null
}

export interface WCLSchemaReportPagination {
  data: Array<WCLSchemaReport | null> | null
  total: number
  per_page: number
  current_page: number
  from: number | null
  to: number | null
  last_page: number
  has_more_pages: boolean
}

export type WCLSchemaReportRankingMetricType =
  | 'bosscdps'
  | 'bossdps'
  | 'bossndps'
  | 'bossrdps'
  | 'default'
  | 'dps'
  | 'hps'
  | 'krsi'
  | 'playerscore'
  | 'playerspeed'
  | 'cdps'
  | 'ndps'
  | 'rdps'
  | 'tankhps'
  | 'wdps'

export type WCLSchemaRoleType = 'Any' | 'DPS' | 'Healer' | 'Tank'

export interface WCLSchemaServer {
  id: number
  name: string
  normalizedName: string
  slug: string
  region: WCLSchemaRegion
  subregion: WCLSchemaSubregion
  /** Args: limit: number | null, page: number | null */
  guilds: WCLSchemaGuildPagination | null
  /** Args: limit: number | null, page: number | null */
  characters: WCLSchemaCharacterPagination | null
  blizzardID: number
  connectedRealmID: number
  seasonID: number
}

export interface WCLSchemaServerPagination {
  data: Array<WCLSchemaServer | null> | null
  total: number
  per_page: number
  current_page: number
  from: number | null
  to: number | null
  last_page: number
  has_more_pages: boolean
}

export interface WCLSchemaSubregion {
  id: number
  name: string
  region: WCLSchemaRegion
  /** Args: limit: number | null, page: number | null */
  servers: WCLSchemaServerPagination | null
}

export type WCLSchemaTableDataType =
  | 'Summary'
  | 'Buffs'
  | 'Casts'
  | 'DamageDone'
  | 'DamageTaken'
  | 'Deaths'
  | 'Debuffs'
  | 'Dispels'
  | 'Healing'
  | 'Interrupts'
  | 'Resources'
  | 'Summons'
  | 'Survivability'
  | 'Threat'

export interface WCLSchemaUser {
  id: number
  name: string
  avatar: string
  guilds: Array<WCLSchemaGuild | null> | null
  characters: Array<WCLSchemaCharacter | null> | null
  battleTag: string | null
}

export type WCLSchemaViewType = 'Default' | 'Ability' | 'Source' | 'Target'

export interface WCLSchemaWorldRegionServerRankPositions {
  worldRank: WCLSchemaRank | null
  regionRank: WCLSchemaRank | null
  serverRank: WCLSchemaRank | null
}

export interface WCLSchemaZone {
  id: number
  brackets: WCLSchemaBracket | null
  difficulties: Array<WCLSchemaDifficulty | null> | null
  encounters: Array<WCLSchemaEncounter | null> | null
  expansion: WCLSchemaExpansion
  frozen: boolean
  name: string
  partitions: Array<WCLSchemaPartition | null> | null
}

/** Convenience alias for the schema-accurate report root. */
export type WCLSchemaReportRoot = WCLSchemaReport
