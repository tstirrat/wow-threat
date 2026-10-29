# CLAUDE.md

## Task Routing (Open These Files First)

| Task                                   | Open these files first                                                                                                                                                                                                                                                               |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Add/change routes or page flow         | `apps/web/src/routes/router.tsx`, `apps/web/src/routes/root-layout.tsx`, `apps/web/src/routes/report-layout.tsx`, `apps/web/src/pages/*.tsx`                                                                                                                                         |
| App shell (bar, rail, slots)           | `apps/web/src/routes/root-layout.tsx`, `apps/web/src/routes/app-shell-context.ts`, `apps/web/src/routes/app-shell-provider.tsx`, `apps/web/src/components/app-bar.tsx`, `apps/web/src/components/app-rail.tsx`                                                                       |
| Rail contents (library, report)        | `apps/web/src/components/rail-library.tsx`, `apps/web/src/components/report-outline.tsx`, `apps/web/src/components/*-reports-list.tsx`                                                                                                                                               |
| Fight workspace layout                 | `apps/web/src/components/fight-workspace.tsx`, `apps/web/src/pages/fight-page.tsx`, `apps/web/src/components/player-info-drawer.tsx`, `apps/web/src/components/playback-controls.tsx`, `apps/web/src/hooks/use-roster-visibility.ts`                                                 |
| Report/fight data loading              | `apps/web/src/api/client.ts`, `apps/web/src/api/reports.ts`, `apps/web/src/hooks/use-report-data.ts`, `apps/web/src/hooks/use-fight-data.ts`, `apps/web/src/hooks/use-fight-events.ts`                                                                                               |
| Threat engine processing (frontend)    | `apps/web/src/lib/client-threat-engine.ts`, `apps/web/src/workers/threat-engine.worker.ts`, `apps/web/src/workers/threat-engine-worker-types.ts`, `apps/web/src/hooks/use-fight-events.ts`                                                                                           |
| Query-param/deep-link behavior         | `apps/web/src/hooks/use-fight-query-state.ts`, `apps/web/src/lib/search-params.ts`, `apps/web/src/lib/fight-navigation.ts`                                                                                                                                                           |
| Threat chart, legend, tooltip behavior | `apps/web/src/components/threat-chart.tsx`, `apps/web/src/components/threat-chart-legend.tsx`, `apps/web/src/components/fight-settings-panel.tsx`, `apps/web/src/components/fight-bar-target.tsx`, `apps/web/src/lib/threat-chart-*.ts*`, `apps/web/src/hooks/use-threat-chart-*.ts` |
| Auth and WCL popup flow                | `apps/web/src/auth/auth-provider.tsx`, `apps/web/src/auth/wcl-popup-bridge.ts`, `apps/web/src/pages/auth-complete-page.tsx`                                                                                                                                                          |
| Recent reports/account persistence     | `apps/web/src/hooks/use-recent-reports.ts`, `apps/web/src/hooks/use-user-recent-reports.ts`, `apps/web/src/lib/recent-reports.ts`, `apps/web/src/lib/account-recent-reports-cache.ts`                                                                                                |
| UI component updates                   | `apps/web/src/components/*.tsx`, `apps/web/src/components/ui/*.tsx`, `apps/web/src/index.css`                                                                                                                                                                                        |
| E2E test updates after UX changes      | `apps/web/src/pages/*.spec.ts`, `apps/web/src/test/page-objects/**`, `apps/web/src/test/helpers/**`                                                                                                                                                                                  |

## Change Checklist

1. Update route/page/component/hook files in the primary flow
2. Update unit/integration tests near touched modules (`*.test.ts`/`*.test.tsx`)
3. Update Playwright specs/page objects when interaction or navigation behavior changes
4. Add PostHog tracking if the change introduces a meaningful user interaction (see below)
5. Run scoped checks:
   - `pnpm --filter @wow-threat/web lint`
   - `pnpm --filter @wow-threat/web typecheck`
   - `pnpm --filter @wow-threat/web test`
   - `pnpm --filter @wow-threat/web exec playwright test <relevant-spec>` (required final validation for frontend app changes)
   - `pnpm --filter @wow-threat/web e2e` (required when multiple or broad user flows are impacted)
6. Format with `pnpm fmt` before finalizing.

## PostHog Analytics

PostHog is used for load-milestone tracking and user interaction telemetry. Only enabled in production (`MODE === 'production'`). Config: `apps/web/src/lib/posthog.ts`.

**When to add tracking:** Add a `posthog.capture()` call when a new feature introduces a user interaction that would be worth funneling in PostHog — i.e. you could imagine filtering by it to understand engagement or drop-off. Skip it for incidental UI state (tooltips, hover states, transient toggles with no product signal).

**How to add it:** Call `usePostHog()` directly in the hook or component where the action happens. Do not thread tracking callbacks through props — just import `usePostHog` at the site of the action.

```ts
import { usePostHog } from 'posthog-js/react'

const posthog = usePostHog()
posthog?.capture('my_event', { fight_id: fightId, report_id: reportId })
```

To see what events are currently captured, search for `posthog?.capture` and `posthog.capture` across `apps/web/src`.

## Frontend Architecture (v0)

- App architecture: Single Page Application (SPA)
- Frontend runtime: React (functional components only)
- Build/dev tool: Vite
- Routing: React Router (data routers + nested routes)
- Server state: TanStack React Query
- Hosting: Firebase Hosting (frontend), Cloudflare Worker API remains backend
- Authentication: Firebase Authentication for office access
- Browser support: modern evergreen browsers only

### Threat Processing Boundary

- The API provides raw paginated fight event data (`FightEventsResponse`), not pre-augmented threat timelines.
- The web app is responsible for threat-engine execution and augmented timeline generation.
- Primary implementation files: `apps/web/src/lib/client-threat-engine.ts`, `apps/web/src/workers/threat-engine.worker.ts`, `apps/web/src/hooks/use-fight-events.ts`.

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

- `/` landing page is a centred box:
  - Input for Warcraft Logs report URL
  - Example report links when no history exists
  - Recent, starred, guild and account report lists live in the rail Library, not on the page
- `/report/:reportId` includes:
  - Report and fight navigation in the rail "This report" tab (link-driven, not dropdown-only)
  - Zero state in the outlet; click-through to the fight chart
- `/report/:reportId/fight/:fightId` includes:
  - Chart for the selected target with all visible player lines by default; the target selector is the last crumb of the app bar title (a crumb-styled menu button)
  - Player-focused views via `players` query param
  - Link to Warcraft Logs report and direct fight link (rail report header)

### App Layout

The app is a full-window, chart-first shell (design: `design/wireframes/v1-chart-first/`).

- Shell: `RootLayout` is a grid `rail | bar / rail | outlet` (`h-screen`). The landing page keeps a centred box; report routes fill the outlet.
- Rail (`app-rail.tsx`): collapsible, open on every page load. A footer pinned to the bottom (`rail-account.tsx`) holds the account control (sign in / signed-in menu / auth disabled / loading skeletons) and the theme toggle, icon-only when collapsed; the mobile sheet has the same footer. The header's "WOW Threat" link is the way home. Library only off-report (`rail-library.tsx`); on report routes a "This report" tab (`report-outline.tsx`: report header, star, boss-kill list) plus a Library tab.
- App bar (`app-bar.tsx`): report context only. Left: one "Open report" button (⌘O stays in its tooltip, the `?` overlay and the `mod+o` hotkey). Middle: breadcrumb `Report › Fight ▾ › vs Target ▾` (`fight-crumb.tsx` for the report link and boss-kill fight menu, `fight-bar-target.tsx` / `target-selector.tsx` for the target crumb). The report crumb collapses first (hidden under 1100px), then the fight text shortens, then the target truncates. Right: WCL fight icon link, settings (gear), roster toggle. Below 760px it wraps to two rows (☰, fight crumb, settings, roster / target crumb, WCL icon) with 40px touch targets. Routed pages fill slots via `routes/app-shell-context.ts` (`setBarTitle`, `setBarTitleTrailing`, `setBarExternalLink`, `setBarSettings`, `setBarRosterToggle`, `setRailReportSection`); `ReportLayout` fills the report and fight crumbs and the rail section, `FightPage` the target crumb, WCL link, gear and roster toggle.
- Fight workspace (`fight-workspace.tsx`): regions `chart | roster`, `transport`, `drawer` (each has `data-region`). The chart fills its region (min height 240px); the roster is the legend, replaced by `ThreatMeter` during replay and hideable (persisted). Transport (`playback-controls.tsx`) sits under the chart. The Player info drawer (`player-info-drawer.tsx`) is the bottom region; settings live in a side panel (`fight-settings-panel.tsx`).
- Mobile (< 760px, `useIsMobileLayout`): rail becomes a left sheet opened from the bar, roster becomes an off-canvas panel with a scrim, and the workspace shows Chart / Player info tabs.
- Hotkeys (registered in `fight-page.tsx`, listed in the `?` overlay): <kbd>R</kbd> roster, <kbd>I</kbd> player info drawer, <kbd>,</kbd> settings, <kbd>Shift+I</kbd> isolate focused player, <kbd>P</kbd> pin, <kbd>H</kbd> hide, <kbd>O</kbd> overrides, <kbd>0</kbd> reset zoom, <kbd>Space</kbd> play/pause (enters replay mode if needed). <kbd>E</kbd> is reserved.

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
- Keep component bodies minimal when possible: simple local input/transient state (`useState` for controlled inputs, open/close toggles, etc.) is fine inline, but grouped feature state + handlers should be encapsulated in a custom hook.
- Prefer grouping new feature logic into a custom hook rather than adding multiple related state/effect/handler blocks directly in a component body.
- It is fine to keep small UI-local state/effects in the component body when they are tied to DOM/view concerns and do not represent a broader feature workflow.
- Treat feature boundaries as the primary organizing unit: new logical features should usually keep their state/effects/handlers together in a hook, but avoid extracting trivial one-off logic into hooks unnecessarily.
- Hook extraction can be private to the component file when reuse is unlikely; prefer clarity and separation of concerns over forcing everything into the component body.
- Avoid large blocks of inlined JSX. Find natural component boundaries and extract named child components (with descriptive props) within the same file. This applies to repeated items in lists, conditional branches, and any section of markup that has its own logical identity.
- React Compiler is enabled for this app. Do not add `useMemo` or `useCallback` as default optimization tools.
- Only add manual memoization when there is a demonstrated correctness or performance need that the compiler does not cover.

Interaction requirements:

- Avoid dropdown-only navigation for core report/fight discovery.
- For fights with multiple bosses/adds, auto-select default target as enemy with highest accumulated threat.
- Provide explicit target selector control (app bar title).
- Chart supports selecting partial time window and one-click reset to full range (floating Reset zoom button, or <kbd>0</kbd>).
- Chart legend is rendered on the right side as the roster panel.
- Double-clicking a legend actor isolates that actor; repeating restores normal visibility behavior.
- Focused-player summary (total threat, total damage done, total healing done) is shown in the Player info drawer under the chart.
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

Playwright e2e stability findings:

- Prefer Playwright-native URL predicate assertions for query params and path checks:
  - `await expect(page).toHaveURL((url) => url.searchParams.get('players') === '2')`
  - `await expect(page).toHaveURL((url) => url.pathname === '/report/<id>/fight/<id>')`
- Prefer semantic URL predicates over regexes that depend on query-param ordering.
- Avoid `page.evaluate`-based URL polling (`window.location.search`) for assertion waits; it is more prone to timing races with router updates.
- When a keyboard shortcut depends on recently updated React state, wait for deterministic UI state before sending the next keypress (for example: wait for focused-player summary text before pressing isolate hotkeys).
- Do not add unrelated/no-op interactions (for example random clicks) as timing guards unless no deterministic app-state wait exists.
- When adding or modifying a specific e2e test, run a deflake pass by isolating that test and repeating it with `--repeat-each` greater than `20` (for example `--repeat-each=25`) before finalizing:
  - `pnpm --filter @wow-threat/web exec playwright test <spec> -g "<test name>" --repeat-each=25`
- After the single-test deflake pass succeeds, run a second deflake pass on the full spec file to catch test interaction flakiness (for example `--repeat-each=5`):
  - `pnpm --filter @wow-threat/web exec playwright test <spec> --repeat-each=5`

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
