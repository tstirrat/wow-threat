/**
 * Compile-time schema alignment checks for query-shape report types.
 *
 * Goal: prevent adding fields to `reports.ts` that do not exist in the
 * introspected schema model from `report-schema.ts`.
 *
 * These assertions intentionally validate key sets (prop alignment), not full
 * assignability, because app query-shape types are narrower than the schema and
 * GraphQL responses are selection-set dependent.
 */
import type {
  WCLSchemaCharacter,
  WCLSchemaEncounterPhases,
  WCLSchemaExpansion,
  WCLSchemaGameFaction,
  WCLSchemaGuild,
  WCLSchemaPartition,
  WCLSchemaPhaseMetadata,
  WCLSchemaRankingCompareType,
  WCLSchemaRankingTimeframeType,
  WCLSchemaReport,
  WCLSchemaReportAbility,
  WCLSchemaReportActor,
  WCLSchemaReportArchiveStatus,
  WCLSchemaReportFight,
  WCLSchemaReportFightNPC,
  WCLSchemaReportMasterData,
  WCLSchemaRoleType,
  WCLSchemaServer,
  WCLSchemaUser,
  WCLSchemaZone,
} from './report-schema'
import type {
  GameFaction,
  PhaseMetadata,
  Report,
  ReportAbility,
  ReportActor,
  ReportActorNPC,
  ReportActorPet,
  ReportActorPlayer,
  ReportArchiveStatus,
  ReportEncounterPhases,
  ReportFight,
  ReportFightNPC,
  ReportGuild,
  ReportMasterData,
  ReportOwner,
  ReportRankedCharacter,
  ReportRankedCharacterServer,
  ReportRankingCompareType,
  ReportRankingTimeframeType,
  ReportRoleType,
  Zone,
} from './reports'

type AssertTrue<T extends true> = T
type NoExtraKeys<LocalType, SchemaType> =
  Exclude<keyof LocalType, keyof SchemaType> extends never ? true : false

type ZoneExpansion = NonNullable<Zone['expansion']>
type ZonePartition = NonNullable<Zone['partitions']>[number]

/**
 * Compile-time key alignment assertions.
 *
 * Adding any non-schema key to local report types should fail `tsc --noEmit`.
 */
export type ReportSchemaKeyAlignmentAssertions = [
  AssertTrue<NoExtraKeys<Zone, WCLSchemaZone>>,
  AssertTrue<NoExtraKeys<ZoneExpansion, WCLSchemaExpansion>>,
  AssertTrue<NoExtraKeys<ZonePartition, WCLSchemaPartition>>,
  AssertTrue<NoExtraKeys<GameFaction, WCLSchemaGameFaction>>,
  AssertTrue<NoExtraKeys<PhaseMetadata, WCLSchemaPhaseMetadata>>,
  AssertTrue<NoExtraKeys<ReportEncounterPhases, WCLSchemaEncounterPhases>>,
  AssertTrue<NoExtraKeys<ReportFightNPC, WCLSchemaReportFightNPC>>,
  AssertTrue<NoExtraKeys<ReportFight, WCLSchemaReportFight>>,
  AssertTrue<NoExtraKeys<ReportActor, WCLSchemaReportActor>>,
  AssertTrue<NoExtraKeys<ReportActorNPC, WCLSchemaReportActor>>,
  AssertTrue<NoExtraKeys<ReportActorPlayer, WCLSchemaReportActor>>,
  AssertTrue<NoExtraKeys<ReportActorPet, WCLSchemaReportActor>>,
  AssertTrue<NoExtraKeys<ReportGuild, WCLSchemaGuild>>,
  AssertTrue<NoExtraKeys<ReportOwner, WCLSchemaUser>>,
  AssertTrue<NoExtraKeys<ReportArchiveStatus, WCLSchemaReportArchiveStatus>>,
  AssertTrue<NoExtraKeys<ReportAbility, WCLSchemaReportAbility>>,
  AssertTrue<NoExtraKeys<ReportMasterData, WCLSchemaReportMasterData>>,
  AssertTrue<NoExtraKeys<ReportRankedCharacterServer, WCLSchemaServer>>,
  AssertTrue<NoExtraKeys<ReportRankedCharacter, WCLSchemaCharacter>>,
  AssertTrue<NoExtraKeys<Report, WCLSchemaReport>>,
]

/**
 * Enum/value alignment assertions for key ranking/role dimensions.
 */
export type ReportSchemaValueAlignmentAssertions = [
  AssertTrue<ReportRoleType extends WCLSchemaRoleType ? true : false>,
  AssertTrue<
    ReportRankingCompareType extends WCLSchemaRankingCompareType ? true : false
  >,
  AssertTrue<
    ReportRankingTimeframeType extends WCLSchemaRankingTimeframeType
      ? true
      : false
  >,
]
