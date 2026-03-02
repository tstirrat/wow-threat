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

| ID      | Package              | Status    | Priority | Size | Title                                                     |
| ------- | -------------------- | --------- | -------- | ---- | --------------------------------------------------------- |
| API-005 | `@wow-threat/api`    | READY     | P1       | M    | Anonymous account cleanup                                 |
| ENG-004 | `@wow-threat/engine` | READY     | P1       | S    | Apply Earth Shield threat to the tank, not the caster     |
| WEB-012 | `@wow-threat/web`    | DISCOVERY | P2       | M    | Add Starred, Guild lists at top                           |
| WEB-014 | `@wow-threat/web`    | READY     | P2       | S    | Focused player links back to WCL                          |
| WEB-015 | `@wow-threat/web`    | READY     | P2       | S    | Isolate key toggles between isolated and previous players |
| WEB-016 | `@wow-threat/web`    | READY     | P2       | S    | Zoom key toggles between no zoom and previous zoom        |
| WEB-017 | `@wow-threat/web`    | DISCOVERY | P2       | M    | Fuzzy target selector                                     |
| WEB-018 | `@wow-threat/web`    | DISCOVERY | P2       | M    | Fuzzy fight selector                                      |
| WEB-019 | `@wow-threat/web`    | DISCOVERY | P0       | M    | Fight event pagination currently blocks the UI thread     |
| WEB-021 | `@wow-threat/web`    | READY     | P2       | S    | Keyboard shortcut for filter to tanks only                |
| WEB-024 | `@wow-threat/web`    | READY     | P3       | XS   | Fixate band styling + legend explanation                  |
| WEB-027 | `@wow-threat/web`    | READY     | P3       | XS   | Make toggled players in legend more prominent             |
| WEB-028 | `@wow-threat/web`    | READY     | P3       | XS   | Add symbol/icon for healers                               |
| WEB-032 | `@wow-threat/web`    | DISCOVERY | P0       | L    | Batch + stream events to worker/IndexedDB to prevent jank |

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
- WEB-025
- WEB-026
- WEB-029
- WEB-030
- WEB-031

## Task Cards (Open)

### API-005 - Anonymous account cleanup

```yaml
id: API-005
title: Anonymous account cleanup
package: @wow-threat/api
status: READY
priority: P1
size: M
depends_on: []
files_hint:
  - apps/api/src/services/auth-store.ts
  - apps/api/src/routes/auth.ts
  - apps/api/src/services/firestore-client.ts
  - apps/api/src/routes/auth.test.ts
acceptance_criteria:
  - Track per-anonymous-user updatedAt timestamps on relevant read/write touch points.
  - Periodically delete stale anonymous user records older than 60 days.
  - Preserve behavior for non-anonymous accounts.
  - Add tests covering stale deletion and non-stale retention paths.
validation:
  - pnpm --filter @wow-threat/api lint
  - pnpm --filter @wow-threat/api typecheck
  - pnpm --filter @wow-threat/api test
  - pnpm --filter @wow-threat/api exec vitest run src/routes/auth.test.ts
branch_name: codex/api-005-anonymous-account-cleanup
worktree_path: ../wow-threat-api-005
publish: auto_push_pr
pr_url: null
commit_sha: null
```

### ENG-004 - Apply Earth Shield threat to tank, not caster

```yaml
id: ENG-004
title: Apply Earth Shield threat to tank, not caster
package: @wow-threat/engine
status: READY
priority: P1
size: S
depends_on: []
files_hint:
  - packages/engine/src/threat-engine.ts
  - packages/engine/src/fight-state.ts
  - packages/engine/src/actor-state.ts
  - packages/engine/src/threat-engine.test.ts
acceptance_criteria:
  - Earth Shield threat attribution is applied to the tank receiving the proc.
  - Threat is no longer attributed to the Earth Shield caster for this scenario.
  - Existing threat attribution behavior for unrelated spells remains unchanged.
  - Add or update tests that reproduce and verify the attribution rule.
validation:
  - pnpm --filter @wow-threat/engine lint
  - pnpm --filter @wow-threat/engine typecheck
  - pnpm --filter @wow-threat/engine test
  - pnpm --filter @wow-threat/engine exec vitest run src/threat-engine.test.ts
branch_name: codex/eng-004-earth-shield-threat-to-tank
worktree_path: ../wow-threat-eng-004
publish: auto_push_pr
pr_url: null
commit_sha: null
```

### WEB-012 - Add starred and guild lists at top

```yaml
id: WEB-012
title: Add starred and guild lists at top
package: @wow-threat/web
status: DISCOVERY
priority: P2
size: M
depends_on: []
files_hint:
  - apps/web/src/pages/landing-page.tsx
  - apps/web/src/hooks/use-recent-reports.ts
  - apps/web/src/hooks/use-user-recent-reports.ts
  - apps/web/src/components
acceptance_criteria:
  - Define canonical placement and ordering rules for starred and guild lists.
  - Define persistence and source-of-truth behavior for starred and guild membership.
  - Capture final UX spec in this card, then promote status to READY.
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

### WEB-014 - Focused player links back to WCL

```yaml
id: WEB-014
title: Focused player links back to WCL
package: @wow-threat/web
status: READY
priority: P2
size: S
depends_on: []
files_hint:
  - apps/web/src/pages/fight-page.tsx
  - apps/web/src/lib/fight-navigation.ts
  - apps/web/src/pages/fight-page.spec.ts
acceptance_criteria:
  - Focused player view includes a link to the matching Warcraft Logs report and fight.
  - Link opens in a new tab with rel=noopener noreferrer.
  - Host selection follows current branch domain logic.
  - Add or update tests for link visibility and URL generation.
validation:
  - pnpm --filter @wow-threat/web lint
  - pnpm --filter @wow-threat/web typecheck
  - pnpm --filter @wow-threat/web test
  - pnpm --filter @wow-threat/web exec playwright test src/pages/fight-page.spec.ts
branch_name: codex/web-014-focused-player-link-to-wcl
worktree_path: ../wow-threat-web-014
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
status: DISCOVERY
priority: P2
size: M
depends_on: []
files_hint:
  - apps/web/src/components/threat-chart-controls.tsx
  - apps/web/src/lib/fight-navigation.ts
  - apps/web/src/pages/fight-page.tsx
acceptance_criteria:
  - Define trigger key behavior for t and conflict handling with existing shortcuts.
  - Define candidate ranking and display fields for fuzzy target matches.
  - Define behavior when selected target has no events in current window.
  - Capture final UX spec in this card, then promote status to READY.
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
status: DISCOVERY
priority: P2
size: M
depends_on: []
files_hint:
  - apps/web/src/pages/report-page.tsx
  - apps/web/src/lib/fight-navigation.ts
  - apps/web/src/pages/report-page.spec.ts
acceptance_criteria:
  - Define trigger key behavior and interaction with existing quick-open flows.
  - Define fuzzy ranking fields for fights (boss, encounter id, duration, timestamp).
  - Define post-selection behavior for preserving selected players/target/window params.
  - Capture final UX spec in this card, then promote status to READY.
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
status: DISCOVERY
priority: P0
size: M
depends_on: []
files_hint:
  - apps/web/src/hooks/use-fight-events.ts
  - apps/web/src/workers/threat-engine.worker.ts
  - apps/web/src/lib/client-threat-engine.ts
  - apps/web/src/pages/fight-page.spec.ts
acceptance_criteria:
  - Define measurable performance target for main-thread responsiveness.
  - Define whether pagination fetches are incremental, parallel, or adaptive by page count.
  - Define UX loading states while pages stream in.
  - Capture final implementation spec in this card, then promote status to READY.
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

### WEB-024 - Fixate band styling and legend explanation

```yaml
id: WEB-024
title: Fixate band should have orange left border and legend explanation
package: @wow-threat/web
status: READY
priority: P3
size: XS
depends_on: []
files_hint:
  - apps/web/src/components/threat-chart.tsx
  - apps/web/src/components/threat-chart-legend.tsx
  - apps/web/src/pages/fight-page.spec.ts
acceptance_criteria:
  - Fixate band has distinct orange-toned background and left-edge orange border.
  - Legend clearly explains fixate band visual meaning.
  - Styling remains readable in current theme and does not obscure data points.
validation:
  - pnpm --filter @wow-threat/web lint
  - pnpm --filter @wow-threat/web typecheck
  - pnpm --filter @wow-threat/web test
  - pnpm --filter @wow-threat/web exec playwright test src/pages/fight-page.spec.ts
branch_name: codex/web-024-fixate-band-legend
worktree_path: ../wow-threat-web-024
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

### WEB-028 - Add healer icon/symbol

```yaml
id: WEB-028
title: Symbol or icon for healers
package: @wow-threat/web
status: READY
priority: P3
size: XS
depends_on: []
files_hint:
  - apps/web/src/components/threat-chart-legend.tsx
  - apps/web/src/components/threat-chart-tooltip.tsx
  - apps/web/src/pages/fight-page.spec.ts
acceptance_criteria:
  - Healers are represented by a consistent symbol/icon in legend and related UI.
  - Icon is accessible and visually distinct from tank/DPS indicators.
  - Existing role labeling behavior remains intact.
validation:
  - pnpm --filter @wow-threat/web lint
  - pnpm --filter @wow-threat/web typecheck
  - pnpm --filter @wow-threat/web test
  - pnpm --filter @wow-threat/web exec playwright test src/pages/fight-page.spec.ts
branch_name: codex/web-028-healer-icon
worktree_path: ../wow-threat-web-028
publish: auto_push_pr
pr_url: null
commit_sha: null
```

### WEB-032 - Batch and stream events to worker and IndexedDB

```yaml
id: WEB-032
title: Batch and stream events to or from web worker and IndexedDB to prevent long frames
package: @wow-threat/web
status: DISCOVERY
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
  - Define target frame-time budget and throughput goals for large fights.
  - Define message protocol for batched worker transport.
  - Define IndexedDB write and read batching strategy with cancellation behavior.
  - Capture final implementation spec in this card, then promote status to READY.
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
