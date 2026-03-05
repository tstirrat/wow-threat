# Agent Task Board

## Agent Execution Policy

- Source of truth: this file is the canonical backlog for semi-autonomous task execution.
- Task selection policy:
  - pick tasks where `status: READY`
  - skip tasks with unmet `depends_on`
  - sort by `priority` (`P0` > `P1` > `P2` > `P3`), then `size` (`XS` < `S` < `M` < `L`), then lexical `id`
  - claim the first candidate by changing `status` to `IN_PROGRESS`
- Worktree policy:
  - create a new worktree from `origin/main` using `worktree_path`
  - create or switch to `branch_name` inside that worktree
- Implementation policy:
  - follow routing and quality rules in `AGENTS.md` and package-level guides
  - use `files_hint` as entrypoints, not hard constraints
  - satisfy every item in `acceptance_criteria`
- Validation policy:
  - run every command in `validation` from repo root
  - do not publish if any validation command fails
- Publish policy:
  - run `$push-pr` after successful validation
  - update `pr_url` and `commit_sha`
  - set `status: IN_REVIEW` after PR creation
  - set `status: DONE` only after merge

## Status Legend

- `DISCOVERY`: task intent is known, but implementation details need refinement before coding
- `READY`: fully specced and ready for implementation
- `IN_PROGRESS`: currently being implemented in a worktree
- `IN_REVIEW`: PR opened and awaiting review/merge
- `BLOCKED`: cannot proceed due to dependency or external blocker
- `DONE`: merged and complete

## Task Index (Open)

| ID      | Package              | Status      | Priority | Size | Title                                                     |
| ------- | -------------------- | ----------- | -------- | ---- | --------------------------------------------------------- |
| WEB-012 | `@wow-threat/web`    | READY       | P2       | M    | Add Starred, Guild lists at top                           |
| WEB-015 | `@wow-threat/web`    | READY       | P2       | S    | Isolate key toggles between isolated and previous players |
| WEB-016 | `@wow-threat/web`    | READY       | P2       | S    | Zoom key toggles between no zoom and previous zoom        |
| WEB-017 | `@wow-threat/web`    | READY       | P2       | M    | Fuzzy target selector                                     |
| WEB-018 | `@wow-threat/web`    | READY       | P2       | M    | Fuzzy fight selector                                      |
| WEB-019 | `@wow-threat/web`    | READY       | P0       | M    | Fight event pagination currently blocks the UI thread     |
| WEB-021 | `@wow-threat/web`    | READY       | P2       | S    | Keyboard shortcut for filter to tanks only                |
| WEB-027 | `@wow-threat/web`    | READY       | P3       | XS   | Make toggled players in legend more prominent             |
| WEB-032 | `@wow-threat/web`    | READY       | P0       | L    | Batch + stream events to worker/IndexedDB to prevent jank |

## Historical Completed IDs

- API-001
- API-002
- API-003
- API-004
- ENG-001
- ENG-002
- ENG-003
- WEB-001
- WEB-002
- WEB-003
- WEB-004
- WEB-005
- WEB-006
- WEB-007
- WEB-008
- WEB-009
- WEB-010
- WEB-011
- WEB-013
- WEB-020
- WEB-022
- WEB-023
- WEB-024
- WEB-025
- WEB-026
- WEB-028
- WEB-029
- WEB-030
- WEB-031
- API-005
- WEB-014
- ENG-004

## Task Cards (Open)

### WEB-012 - Add starred and guild lists at top

```yaml
id: WEB-012
title: Add starred and guild lists at top
package: @wow-threat/web
status: READY
priority: P2
size: M
depends_on: []
files_hint:
  - apps/web/src/pages/landing-page.tsx
  - apps/web/src/hooks/use-recent-reports.ts
  - apps/web/src/hooks/use-user-recent-reports.ts
  - apps/web/src/components
acceptance_criteria:
  - Add centered header quick-access text dropdown triggers for Starred and Guild in the main app header on all routes.
  - Use dropdown-menu behavior (not Select) and navigate immediately when an item is selected.
  - Starred dropdown shows up to 10 starred reports sorted by report startTime desc, with fallback to starredAt desc when startTime is missing.
  - Guild dropdown shows up to 10 reports from starred guild feeds sorted by report startTime desc.
  - Empty dropdown states show helper copy instead of hidden menus (for example, "Star reports to see them here.").
  - Existing landing-page Recent logs and Guild logs sections remain and align to the same ordering rules.
  - Source of truth remains user settings starredReports/starredEntities plus starred guild report query data.
validation:
  - pnpm --filter @wow-threat/web lint
  - pnpm --filter @wow-threat/web typecheck
  - pnpm --filter @wow-threat/web test
branch_name: codex/web-012-starred-guild-lists
worktree_path: ../wow-threat-web-012
publish: auto_push_pr
pr_url: null
commit_sha: null
```

### WEB-015 - Isolate key toggles isolation with previous selection

```yaml
id: WEB-015
title: Isolate key toggles between isolated and previous selected players
package: @wow-threat/web
status: READY
priority: P2
size: S
depends_on: []
files_hint:
  - apps/web/src/components/threat-chart.tsx
  - apps/web/src/components/threat-chart-legend.tsx
  - apps/web/src/hooks/use-threat-chart-state.ts
  - apps/web/src/pages/fight-page.spec.ts
acceptance_criteria:
  - Pressing i toggles between isolated state and the previous multi-player selection.
  - When no prior selection exists, i isolates the currently focused player.
  - Toggling is reflected in chart lines and legend state.
  - Add or update tests for keyboard toggle behavior.
validation:
  - pnpm --filter @wow-threat/web lint
  - pnpm --filter @wow-threat/web typecheck
  - pnpm --filter @wow-threat/web test
  - pnpm --filter @wow-threat/web exec playwright test src/pages/fight-page.spec.ts
branch_name: codex/web-015-isolate-key-toggle
worktree_path: ../wow-threat-web-015
publish: auto_push_pr
pr_url: null
commit_sha: null
```

### WEB-016 - Zoom key toggles previous zoom window

```yaml
id: WEB-016
title: Zoom key toggles between no zoom and previous zoom
package: @wow-threat/web
status: READY
priority: P2
size: S
depends_on: []
files_hint:
  - apps/web/src/components/threat-chart.tsx
  - apps/web/src/hooks/use-threat-chart-zoom.ts
  - apps/web/src/pages/fight-page.spec.ts
acceptance_criteria:
  - Pressing z toggles between full-fight range and the previous user-selected zoom range.
  - If no previous zoom range exists, z leaves chart on full-fight range.
  - Toggling keeps focus-player table window aligned to chart window.
  - Add or update tests for keyboard zoom toggle behavior.
validation:
  - pnpm --filter @wow-threat/web lint
  - pnpm --filter @wow-threat/web typecheck
  - pnpm --filter @wow-threat/web test
  - pnpm --filter @wow-threat/web exec playwright test src/pages/fight-page.spec.ts
branch_name: codex/web-016-zoom-key-toggle
worktree_path: ../wow-threat-web-016
publish: auto_push_pr
pr_url: null
commit_sha: null
```

### WEB-017 - Fuzzy target selector

```yaml
id: WEB-017
title: Fuzzy target selector
package: @wow-threat/web
status: READY
priority: P2
size: M
depends_on: []
files_hint:
  - apps/web/src/components/threat-chart-controls.tsx
  - apps/web/src/lib/fight-navigation.ts
  - apps/web/src/pages/fight-page.tsx
acceptance_criteria:
  - Pressing t opens a fuzzy target selector on fight page when focus is not in an input/control context.
  - Candidate set includes boss and non-boss targets, with bosses ranked ahead of non-boss candidates.
  - Ranking priority is exact match, then prefix match, then fuzzy match.
  - Target result rows show target name, boss badge (when applicable), actor ID, and instance ID.
  - Selecting a target updates targetId in the URL immediately and closes the picker.
  - If a selected target has no events in the current window, keep existing behavior (no automatic window reset/change).
validation:
  - pnpm --filter @wow-threat/web lint
  - pnpm --filter @wow-threat/web typecheck
  - pnpm --filter @wow-threat/web test
branch_name: codex/web-017-fuzzy-target-selector
worktree_path: ../wow-threat-web-017
publish: auto_push_pr
pr_url: null
commit_sha: null
```

### WEB-018 - Fuzzy fight selector

```yaml
id: WEB-018
title: Fuzzy fight selector
package: @wow-threat/web
status: READY
priority: P2
size: M
depends_on: []
files_hint:
  - apps/web/src/pages/report-page.tsx
  - apps/web/src/lib/fight-navigation.ts
  - apps/web/src/pages/report-page.spec.ts
acceptance_criteria:
  - Pressing f opens a fuzzy fight selector on report and fight pages where quick-switch navigation is available, when not focused in input/control context.
  - Fuzzy selector coexists with the existing quick-switch UI.
  - Candidate set includes all fights (boss kills, boss wipes, and trash fights).
  - Fight results display kill/wipe status, with wipes visually de-emphasized.
  - Ranking priority is exact match, then prefix match, then fuzzy match by fight/boss name.
  - Selecting a fight navigates immediately and closes the picker.
  - Selection behavior matches quick-switch links: preserve pinned-player behavior and reset other transient query params.
validation:
  - pnpm --filter @wow-threat/web lint
  - pnpm --filter @wow-threat/web typecheck
  - pnpm --filter @wow-threat/web test
branch_name: codex/web-018-fuzzy-fight-selector
worktree_path: ../wow-threat-web-018
publish: auto_push_pr
pr_url: null
commit_sha: null
```

### WEB-019 - Fix fight event pagination blocking UI thread

```yaml
id: WEB-019
title: Fight event pagination retrieves all pages while blocking UI thread
package: @wow-threat/web
status: READY
priority: P0
size: M
depends_on: []
files_hint:
  - apps/web/src/hooks/use-fight-events.ts
  - apps/web/src/workers/threat-engine.worker.ts
  - apps/web/src/lib/client-threat-engine.ts
  - apps/web/src/pages/fight-page.spec.ts
acceptance_criteria:
  - Keep fight-event pagination sequential and cursor-driven (no parallel page fetching).
  - Yield to the event loop after every page fetch iteration (for example setTimeout(0) or equivalent) so UI rendering/input is not starved.
  - On context change/newer request, stop fetching subsequent pages and discard stale partial results.
  - If a page fetch fails, fail fast with existing error handling and no automatic retries.
  - Preserve page ordering and ensure successful loads still render fight page/chart end-to-end.
validation:
  - pnpm --filter @wow-threat/web lint
  - pnpm --filter @wow-threat/web typecheck
  - pnpm --filter @wow-threat/web test
branch_name: codex/web-019-pagination-ui-thread
worktree_path: ../wow-threat-web-019
publish: auto_push_pr
pr_url: null
commit_sha: null
```

### WEB-021 - Keyboard shortcut for tank filter mode

```yaml
id: WEB-021
title: Keyboard shortcut for filter to tanks only
package: @wow-threat/web
status: READY
priority: P2
size: S
depends_on: []
files_hint:
  - apps/web/src/components/threat-chart-controls.tsx
  - apps/web/src/hooks/use-threat-chart-state.ts
  - apps/web/src/pages/fight-page.spec.ts
acceptance_criteria:
  - Add keyboard shortcut to cycle filter mode: tanks only -> healers only -> everyone.
  - Current mode is visible in UI controls.
  - Mode changes update chart and legend consistently.
  - Add or update tests for filter cycle behavior.
validation:
  - pnpm --filter @wow-threat/web lint
  - pnpm --filter @wow-threat/web typecheck
  - pnpm --filter @wow-threat/web test
  - pnpm --filter @wow-threat/web exec playwright test src/pages/fight-page.spec.ts
branch_name: codex/web-021-keyboard-filter-cycle
worktree_path: ../wow-threat-web-021
publish: auto_push_pr
pr_url: null
commit_sha: null
```

### WEB-027 - Make toggled players in legend more prominent

```yaml
id: WEB-027
title: Toggled players in legend should be visually more prominent
package: @wow-threat/web
status: READY
priority: P3
size: XS
depends_on: []
files_hint:
  - apps/web/src/components/threat-chart-legend.tsx
  - apps/web/src/components/threat-chart.tsx
  - apps/web/src/pages/fight-page.spec.ts
acceptance_criteria:
  - Legend entries for toggled players have a clear visual prominence treatment.
  - Treatment differentiates toggled, isolated, and default states without ambiguity.
  - No regressions to legend click and double-click behavior.
validation:
  - pnpm --filter @wow-threat/web lint
  - pnpm --filter @wow-threat/web typecheck
  - pnpm --filter @wow-threat/web test
  - pnpm --filter @wow-threat/web exec playwright test src/pages/fight-page.spec.ts
branch_name: codex/web-027-legend-prominence
worktree_path: ../wow-threat-web-027
publish: auto_push_pr
pr_url: null
commit_sha: null
```

### WEB-032 - Batch and stream events to worker and IndexedDB

```yaml
id: WEB-032
title: Batch and stream events to or from web worker and IndexedDB to prevent long frames
package: @wow-threat/web
status: READY
priority: P0
size: L
depends_on:
  - WEB-019
files_hint:
  - apps/web/src/hooks/use-fight-events.ts
  - apps/web/src/workers/threat-engine.worker.ts
  - apps/web/src/workers/threat-engine-worker-types.ts
  - apps/web/src/lib/client-threat-engine.ts
acceptance_criteria:
  - Keep page fetches sequential, then chunk raw events into configurable chunk size (default 10000) before persistence/transfer.
  - Persist raw chunks in IndexedDB under a per-request job key (reportId/fightId/requestId) and start worker processing only after all chunks are written.
  - Worker reads raw chunks from IndexedDB, processes events, writes augmented cache output, and returns completion status to main thread.
  - Raw chunk records are cleaned up after processing on both success and failure paths.
  - Cancellation/stale-context behavior matches WEB-019: discard stale partials/results and stop additional work.
  - If IndexedDB is unavailable or errors, fallback to current in-memory worker payload flow.
  - Performance target is no obvious long-frame stalls (about 300ms) on large fights (around 40k-60k events), with acceptable tradeoff that small fights stay fast and large-fight load time does not regress dramatically.
validation:
  - pnpm --filter @wow-threat/web lint
  - pnpm --filter @wow-threat/web typecheck
  - pnpm --filter @wow-threat/web test
branch_name: codex/web-032-stream-worker-indexeddb
worktree_path: ../wow-threat-web-032
publish: auto_push_pr
pr_url: null
commit_sha: null
```
