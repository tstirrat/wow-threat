# Frontend Requirements (v0)

Last updated: 2026-02-10
Status: Draft (implementation not started)

## 1) Scope and Goals

Build a public, URL-addressable web UI for viewing threat data from Warcraft Logs reports and fights.

Primary goals for v0:
- Provide an app landing page for loading reports via URL, history, or examples.
- Provide a report-level view with ranked players across bosses/fights.
- Provide a fight-level view for a selected fight in a report.
- Support deep-linking to specific players from the URL.
- Support deep-link sharing for chart views.
- Keep view components lean by moving state/effects/fetch logic into custom hooks.

Out of scope for v0:
- Authentication/authorization
- Analytics/telemetry
- Full URL sync for every filter and sort setting

## 2) Architecture Decisions

- App architecture: Single Page Application (SPA)
- Frontend runtime: React (functional components only)
- Build/dev tool: Vite
- Routing: React Router (data routers + nested routes)
- Server state: TanStack React Query
- Hosting: Cloudflare Pages (frontend), existing Cloudflare Worker API remains backend
- Browser support: modern evergreen browsers only

Rationale:
- UI is interaction-heavy and data-driven, which suits SPA behavior.
- SEO is not a v0 requirement.
- Existing Cloudflare API setup aligns cleanly with static frontend hosting on Pages.

## 3) Route and URL Requirements

Required routes:
- `/`
- `/report/:reportId`
- `/report/:reportId/fight/:fightId`

Query parameter support (required in v0):
- `players`: comma-separated player IDs for deep-link filtering
- `targetId`: selected boss/add target within a fight
- `startMs`: selected chart window start (fight-relative milliseconds)
- `endMs`: selected chart window end (fight-relative milliseconds)
- Example: `/report/ABC123/fight/42?targetId=9001&players=101,205&startMs=45000&endMs=120000`

URL behavior rules:
- If `players` is present, filter visible ranking/chart rows to those IDs.
- If `players` is absent, show all players for the current context.
- If `targetId` is present and valid, render that fight target.
- If `startMs` and `endMs` are present and valid, initialize chart zoom window from URL.
- Unknown/invalid player IDs are ignored (no hard error).
- Unknown/invalid `targetId` falls back to default target selection.
- Invalid or partial time window params fall back to full-fight range.

Deferred URL behavior (not in v0):
- Sort order in URL
- Non-player filter state in URL

Route behaviors:
- `/` is the app landing page:
  - Input to paste a Warcraft Logs report URL.
  - Last 5 loaded reports (from local storage), when available.
  - Example report links when no history exists.
- `/report/:reportId` is a report landing view:
  - Show all players and all bosses/fights in link-driven navigation (not dropdown-only UX).
  - Allow click-through to fight chart views and single-player focused views.
- `/report/:reportId/fight/:fightId` is the fight chart view:
  - Show chart for selected target with all visible player lines by default.
  - Support player-focused views via `players` query param.
  - Include link back to Warcraft Logs report and deep link to the same fight on Warcraft Logs.

## 4) Data and Caching Requirements

Backend contract:
- API endpoints are near-stable but may evolve with minor changes.
- Frontend should isolate request/response mapping in a small API client layer.

Fetching model:
- Use React Query for all server-state fetching/caching.
- Default to fetch-once semantics for static report/fight data.
- Prefer long `staleTime` and minimal automatic refetching for v0.

Initial React Query defaults (v0):
- `staleTime`: high (for example, 30 minutes+)
- `refetchOnWindowFocus`: false
- `refetchOnReconnect`: false
- `retry`: conservative (for example, 1 retry)

Client persistence requirements:
- Store last 5 loaded reports in local storage, scoped to current browser/user context.
- Recent report entry should include enough metadata for display and relaunch (for example: `reportId`, `title`, `lastOpenedAt`).
- Deduplicate by `reportId` and keep most-recent-first ordering.

## 5) UI Composition and Code Conventions

Component model:
- Functional components only.
- Prefer stateless presentational components.
- Move behavior to custom hooks (`useReportData`, `useFightData`, `usePlayerFilter`, etc.).

Separation of concerns:
- Hooks: fetching, derived state, memoized transforms, URL/query-param parsing.
- Components: rendering and event wiring only.
- API client module: network calls + DTO normalization.

Project conventions:
- No snapshot testing in unit tests.
- Keep component props explicit and typed.
- Keep data transforms in hooks/selectors, not inline in JSX.

Interaction requirements:
- Avoid dropdown-only navigation for core report/fight discovery; use visible link/list structures.
- When a fight includes multiple bosses/adds:
  - Auto-select default target as the enemy with the highest accumulated threat in that fight.
  - Allow user to switch targets via an explicit selector control.
- Chart must support selecting a partial time window and a clear one-click reset to full range.
- Chart legend is displayed on the right side of the chart.
- Double-clicking a legend actor label isolates that actor line (hide all others); repeat action restores standard visibility behavior.
- When a player is selected/focused, render a summary table below the chart with:
  - Total threat
  - Total damage done
  - Total healing done
- For pets, show owner attribution in chart legend and tooltip labels:
  - Format: `<Pet Name> (<Owner Name>)`

## 6) UI Library Decision

Selected for v0:
- `shadcn/ui` (built on Radix primitives) + Tailwind CSS

Why this fits:
- Good accessibility baseline via Radix.
- Fast to ship common UI (tables, dialogs, dropdowns, tabs) while keeping full control.
- Avoids heavy vendor lock-in and supports custom visual direction as the app evolves.

## 6.1) Charting Library Decision

Selected for v0:
- Apache ECharts (via React wrapper)

Rationale:
- Strong performance for high-volume line chart rendering.
- Built-in zoom and pan support via `dataZoom`.
- Flexible tooltip customization for event-dense datasets.
- Open-source licensing fits current project stage.

Implementation note:
- Prefer `echarts-for-react` for React integration unless a better-maintained wrapper is adopted.

Chart requirements:
- Primary chart type: multi-series line chart.
- Expected density: thousands of points across many player series.
- Tooltip must show a single nearest data point to cursor (not all points at matching X).
- Tooltip content for hovered point must include:
  - Cumulative threat amount
  - Threat delta amount for the event
  - Event type
  - Ability name
  - Active multipliers for that ability/event
  - Formula text used for threat calculation
- Support custom tooltip rendering and performant interaction under high point counts.
- Built-in zoom/pan via ECharts `dataZoom`.

## 7) Testing Requirements

Unit/integration testing:
- Test runner: Vitest
- Component testing: React Testing Library
- Standard: behavior-focused tests only (no snapshot unit tests)

End-to-end testing:
- Playwright required for critical user flows
- Playwright tests must mock/stub Warcraft Logs API responses (no real WCL quota usage in CI/local test runs)
- Initial critical flows:
  - Load report from pasted Warcraft Logs URL
  - Show example logs when no history exists
  - Persist and show recent history (last 5 reports)
  - Navigate to report route and render ranked list
  - Navigate to fight route and render fight-specific data
  - Auto-select default fight target and allow target switching
  - Deep-link with `players` query param and verify filtering
  - Show right-side legend and isolate line on double-click
  - Show single-point tooltip with cumulative, delta, event type, ability, multipliers, and formula text
  - Deep-link with chart window params and verify initial zoom + reset

Quality gate direction:
- New user-facing features should include RTL coverage and, where critical, Playwright coverage.

## 8) Initial App Structure (Proposed)

- `apps/web/src/routes/`
- `apps/web/src/pages/`
- `apps/web/src/components/` (presentational components)
- `apps/web/src/hooks/` (custom hooks for state/effects)
- `apps/web/src/api/` (API client + response mappers)
- `apps/web/src/lib/` (shared frontend utilities)
- `apps/web/src/test/` (test setup/helpers)

## 9) Open Questions

- None currently for v0 requirements.
