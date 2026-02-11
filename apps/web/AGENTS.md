# AGENTS.md

## Frontend Architecture (v0)

- App architecture: Single Page Application (SPA)
- Frontend runtime: React (functional components only)
- Build/dev tool: Vite
- Routing: React Router (data routers + nested routes)
- Server state: TanStack React Query
- Hosting: Firebase Hosting (frontend), Cloudflare Worker API remains backend
- Authentication: Firebase Authentication for office access
- Browser support: modern evergreen browsers only

### Frontend Route Contract

Required routes:

- `/`
- `/report/:reportId`
- `/report/:reportId/fight/:fightId`

Required query params:

- `players`: comma-separated player IDs for deep-link filtering
- `targetId`: selected boss/add target within a fight
- `startMs`: selected chart window start (fight-relative milliseconds)
- `endMs`: selected chart window end (fight-relative milliseconds)

URL behavior rules:

- If `players` is present, filter visible ranking/chart rows to those IDs.
- If `players` is absent, show all players for the current context.
- Unknown/invalid player IDs are ignored (no hard error).
- Unknown/invalid `targetId` falls back to default target selection.
- Invalid or partial time window params fall back to full-fight range.

Route behavior details:

- `/` landing page includes:
  - Input for Warcraft Logs report URL
  - Last 5 loaded reports from local storage
  - Example report links when no history exists
- `/report/:reportId` includes:
  - Link-driven navigation for players and fights (not dropdown-only)
  - Click-through to fight chart and player-focused views
- `/report/:reportId/fight/:fightId` includes:
  - Chart for selected target with all visible player lines by default
  - Player-focused views via `players` query param
  - Link to Warcraft Logs report and direct fight link

### Frontend Data & Caching

- Isolate network requests and response normalization in `apps/web/src/api/`.
- Use React Query for all server-state fetching/caching.
- Prefer fetch-once semantics for static report/fight data.
- Use long `staleTime` and minimal automatic refetching.

React Query defaults for v0:

- `staleTime`: high (for example, 30 minutes+)
- `refetchOnWindowFocus`: `false`
- `refetchOnReconnect`: `false`
- `retry`: conservative (for example, 1 retry)

Client persistence:

- Store last 5 loaded reports in local storage.
- Recent report entries should include enough metadata for relaunch (`reportId`, `title`, `lastOpenedAt`).
- Deduplicate by `reportId`, keep most-recent-first.

## Frontend Component Conventions

Prefer functional components to be structured with exported props types and `React.FC`:

```tsx
export type ExampleReportListProps = {
  examples: ExampleReportLink[]
}

export const ExampleReportList: React.FC<ExampleReportListProps> = ({ examples }) => {
  // ...
}
```

Additional component composition guidance:

- Keep components presentational and typed.
- Move behavior to custom hooks (`useReportData`, `useFightData`, query-param hooks, selectors).
- Keep transforms in hooks/selectors, not inline JSX.

Interaction requirements:

- Avoid dropdown-only navigation for core report/fight discovery.
- For fights with multiple bosses/adds, auto-select default target as enemy with highest accumulated threat.
- Provide explicit target selector control.
- Chart supports selecting partial time window and one-click reset to full range.
- Chart legend is rendered on the right side.
- Double-clicking a legend actor isolates that actor; repeating restores normal visibility behavior.
- Focused-player view renders summary table below chart with total threat, total damage done, total healing done.
- Pet labels include owner attribution in legend/tooltip: `<Pet Name> (<Owner Name>)`.

### Frontend UI Libraries

Selected for v0:

- `shadcn/ui` (Radix primitives) + Tailwind CSS
- Apache ECharts via `echarts-for-react`

Chart requirements:

- Multi-series line chart with high point density.
- Built-in zoom/pan via ECharts `dataZoom`.
- Tooltip shows a single nearest data point (not all points for X).
- Tooltip includes cumulative threat, delta threat, event type, ability name, active multipliers, and formula text.

### Frontend Testing Requirements

- Unit/integration: Vitest + React Testing Library.
- No snapshot tests for unit/component coverage.
- End-to-end: Playwright with mocked/stubbed Warcraft Logs API responses.

Critical e2e flows:

- Load report from pasted Warcraft Logs URL.
- Show example logs when no history exists.
- Persist/show recent history (last 5 reports).
- Navigate report route and render ranked list.
- Navigate fight route and render fight data.
- Auto-select default target and allow target switching.
- Deep-link with `players` and verify filtering.
- Show right-side legend and isolate line on double-click.
- Show single-point tooltip with required event/formula fields.
- Deep-link chart window params and verify initial zoom + reset.

### Frontend App Structure

- `apps/web/src/routes/`
- `apps/web/src/pages/`
- `apps/web/src/components/` (presentational components)
- `apps/web/src/hooks/` (custom hooks for state/effects)
- `apps/web/src/api/` (API client + response mappers)
- `apps/web/src/lib/` (shared frontend utilities)
- `apps/web/src/test/` (test setup/helpers)
