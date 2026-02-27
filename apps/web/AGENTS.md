# AGENTS.md

## Task Routing (Open These Files First)

| Task                                   | Open these files first                                                                                                                                                                                                                |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Add/change routes or page flow         | `apps/web/src/routes/router.tsx`, `apps/web/src/routes/root-layout.tsx`, `apps/web/src/routes/report-layout.tsx`, `apps/web/src/pages/*.tsx`                                                                                          |
| Report/fight data loading              | `apps/web/src/api/client.ts`, `apps/web/src/api/reports.ts`, `apps/web/src/hooks/use-report-data.ts`, `apps/web/src/hooks/use-fight-data.ts`                                                                                          |
| Query-param/deep-link behavior         | `apps/web/src/hooks/use-fight-query-state.ts`, `apps/web/src/lib/search-params.ts`, `apps/web/src/lib/fight-navigation.ts`                                                                                                            |
| Threat chart, legend, tooltip behavior | `apps/web/src/components/threat-chart.tsx`, `apps/web/src/components/threat-chart-legend.tsx`, `apps/web/src/components/threat-chart-controls.tsx`, `apps/web/src/lib/threat-chart-*.ts*`, `apps/web/src/hooks/use-threat-chart-*.ts` |
| Auth and WCL popup flow                | `apps/web/src/auth/auth-provider.tsx`, `apps/web/src/auth/wcl-popup-bridge.ts`, `apps/web/src/pages/auth-complete-page.tsx`                                                                                                           |
| Recent reports/account persistence     | `apps/web/src/hooks/use-recent-reports.ts`, `apps/web/src/hooks/use-user-recent-reports.ts`, `apps/web/src/lib/recent-reports.ts`, `apps/web/src/lib/account-recent-reports-cache.ts`                                                 |
| UI component updates                   | `apps/web/src/components/*.tsx`, `apps/web/src/components/ui/*.tsx`, `apps/web/src/index.css`                                                                                                                                         |
| E2E test updates after UX changes      | `apps/web/src/pages/*.spec.ts`, `apps/web/src/test/page-objects/**`, `apps/web/src/test/helpers/**`                                                                                                                                   |

## Change Checklist

1. Update route/page/component/hook files in the primary flow
2. Update unit/integration tests near touched modules (`*.test.ts`/`*.test.tsx`)
3. Update Playwright specs/page objects when interaction or navigation behavior changes
4. Run scoped checks:
   - `pnpm --filter @wow-threat/web lint`
   - `pnpm --filter @wow-threat/web typecheck`
   - `pnpm --filter @wow-threat/web test`
   - `pnpm --filter @wow-threat/web exec playwright test <relevant-spec>` (required final validation for frontend app changes)
   - `pnpm --filter @wow-threat/web e2e` (required when multiple or broad user flows are impacted)

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

export const ExampleReportList: React.FC<ExampleReportListProps> = ({
  examples,
}) => {
  // ...
}
```

Additional component composition guidance:

- Keep components presentational and typed.
- Move behavior to custom hooks (`useReportData`, `useFightData`, query-param hooks, selectors).
- Keep transforms in hooks/selectors, not inline JSX.
- React Compiler is enabled for this app. Do not add `useMemo` or `useCallback` as default optimization tools.
- Only add manual memoization when there is a demonstrated correctness or performance need that the compiler does not cover.

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

Playwright page object conventions:

- Prefer page objects over inlined locators in e2e specs.
- Any non-trivial UI component that is exercised in an e2e test should have a corresponding page object.
- Trivial UI elements do not require dedicated page objects (for example: a single link, a single button, or one simple control).
- Keep assertions (`expect`) in test files, not inside page object classes.
- Page objects should expose actions, locators, and lightweight state helpers only.
- Page objects may compose other page objects (sub-page objects) when it improves reuse and clarity.
- When updating UI components, check whether related page objects and specs need updates before finalizing the change.

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
