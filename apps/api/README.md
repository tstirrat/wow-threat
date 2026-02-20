# `@wow-threat/api` HTTP Contract

This document defines the frontend-facing API contract for the Worker in this package.

## Base URL

- Local dev: `http://localhost:8787`
- API prefix: `/v1`

## Authentication

- `/health` is public.
- All `/v1/*` routes require `Authorization: Bearer <api_key>` in non-dev environments.

## Error Response

All non-2xx responses return the same shape:

```json
{
  "error": {
    "code": "STRING_CODE",
    "message": "Human readable message",
    "details": {}
  },
  "requestId": "req_..."
}
```

Common codes:

- `INVALID_REPORT_CODE`
- `INVALID_FIGHT_ID`
- `INVALID_CONFIG_VERSION`
- `REPORT_NOT_FOUND`
- `FIGHT_NOT_FOUND`
- `WCL_API_ERROR`
- `WCL_RATE_LIMITED`
- `UNAUTHORIZED`
- `INTERNAL_ERROR`

## Endpoints

### `GET /health`

Health check.

```json
{
  "status": "ok",
  "environment": "development",
  "requestId": "req_..."
}
```

### `GET /v1/reports/:code`

Returns report metadata used to drive report/fight selection UIs.

Response type: `ReportResponse` (`apps/api/src/types/api.ts`).

Notes:

- `fights[].enemyNPCs[].name` and similar participant `name` fields are optional.
- `actors` are normalized to a stable summary shape (`id`, `name`, `type`, optional `subType`, optional `petOwner`).
- `abilities` exposes report-level ability metadata from `masterData.abilities` (`gameID`, `icon`, `name`, `type`) and defaults to `[]` when unavailable.

### `GET /v1/reports/:code/fights/:id`

Returns one fight plus normalized friendly/enemy actor lists for that fight.

Response type: `FightsResponse` (`apps/api/src/types/api.ts`).

### `GET /v1/reports/:code/fights/:id/events`

Returns threat-augmented events for the fight.

Response type: `AugmentedEventsResponse` (`apps/api/src/types/api.ts`).

Query params:

- `configVersion` (optional): must match the active config version for the report `gameVersion`; otherwise returns `400 INVALID_CONFIG_VERSION`.

Behavior notes:

- The endpoint returns events that the threat engine processes, not every raw WCL event type.
- Threat is currently calculated for `damage`, `heal`, `energize`, `cast`, `death`, and aura events including apply/refresh/stack/remove phases (`applybuff`, `refreshbuff`, `applybuffstack`, `removebuff`, `removebuffstack`, `applydebuff`, `refreshdebuff`, `applydebuffstack`, `removedebuff`, `removedebuffstack`).
- Each returned event includes a `threat` object with a calculation breakdown and optional threat `changes`.
- Fixate/taunt chart-state markers are derived from aura phase events (apply/refresh/stack/remove). AoE fixate/taunt charting assumes logs emit per-target debuff aura events for each affected enemy.

## Cache Headers

Production/staging responses are immutable:

- `Cache-Control: public, max-age=31536000, immutable`

Development responses disable caching:

- `Cache-Control: no-store, no-cache, must-revalidate`

The events endpoint also returns:

- `X-Cache-Status: HIT|MISS`
- `X-Game-Version`
- `X-Config-Version`
