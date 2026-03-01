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

Returns one raw WCL events page for the fight.

Response type: `FightEventsResponse` (`apps/api/src/types/api.ts`).

Query params:

- `cv` (optional): must match the active config cache version; otherwise returns `400 INVALID_CONFIG_VERSION`.
- `cursor` (optional): page cursor timestamp for subsequent events pages.
- `refresh` (optional): bypasses internal raw cache when truthy (`1`/`true`).

Behavior notes:

- The endpoint is a passthrough for WCL `WCLEvent` payloads and does not run server-side threat processing.
- Paging uses `nextPageTimestamp` in the response body and `X-Next-Page-Timestamp` response header.

## Cache Headers

Production/staging responses are immutable for report/fight responses and for
versioned event responses (`?cv=<active-version>`):

- `Cache-Control: public, max-age=31536000, immutable`

Unversioned public event responses require revalidation:

- `Cache-Control: public, max-age=0, must-revalidate`

Development responses disable caching:

- `Cache-Control: no-store, no-cache, must-revalidate`

The events endpoint also returns:

- `X-Events-Mode: raw`
- `X-Game-Version`
- `X-Config-Version`
- `X-Next-Page-Timestamp`
