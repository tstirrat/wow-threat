# AGENTS.md

## Project Overview

pnpm monorepo (Turborepo) for a World of Warcraft combat log threat calculation platform.
The backend API runs on Cloudflare Workers using Hono, and the frontend web app is a React SPA hosted on Firebase Hosting.
All code is TypeScript (strict mode, ESM). Node >= 20 (see `.nvmrc`), pnpm 9.15+.

## Warcraft Logs Domains

Use the correct Warcraft Logs host for the game branch you are inspecting:

- `www.warcraftlogs.com` -> Retail
- `classic.warcraftlogs.com` -> Classic progression (currently Mists of Pandaria)
- `fresh.warcraftlogs.com` -> Anniversary Edition progression (currently Burning Crusade)
- `vanilla.warcraftlogs.com` -> Classic Era (does not progress to Burning Crusade)
- `sod.warcraftlogs.com` -> Season of Discovery

When querying combatant/talent payloads, pick the host intentionally. Payload shape
and talent metadata can differ by host/version.

When reasoning about the WCL GraphQL API (field names, types, and nesting), use
`packages/wcl-types/src/report-schema.ts` as the source of truth. This file is
generated from schema introspection, so do not guess GraphQL structure when this file
can be referenced.

Events queries use the implied WCL default `useAbilityIDs: true`, so event payloads
include `abilityGameID` and do not include nested `ability` objects. Resolve spell
metadata (name, school/type, icon) through `report.masterData.abilities`.

## Workspace Layout

```
apps/api/               @wow-threat/api          Cloudflare Worker API (Hono v4)
apps/web/               @wow-threat/web          Frontend SPA (React + Vite, Firebase Hosting)
packages/shared/        @wow-threat/shared       Cross-cutting utilities
packages/engine/ @wow-threat/engine Core threat simulation engine
packages/config/ @wow-threat/config Per-class threat calculation configs
packages/wcl-types/     @wow-threat/wcl-types    WCL API type definitions
tooling/typescript-config/                       Shared tsconfig presets
```

## Build & Dev Commands

```bash
pnpm install                                  # Install all dependencies
pnpm build                                    # Build all workspaces (turbo)
pnpm dev                                      # Run dev scripts via Turborepo
pnpm clean                                    # Clean all build artifacts + node_modules
pnpm --filter @wow-threat/api dev             # Start API dev server (wrangler dev)
pnpm --filter @wow-threat/web dev             # Start web dev server (vite)
pnpm --filter @wow-threat/api deploy          # Deploy API to production
pnpm --filter @wow-threat/api deploy:staging  # Deploy API to staging
```

### Sandbox / Turborepo Note

- In this Codex environment, top-level pnpm commands that invoke Turborepo must be run with elevated privileges.
- This includes commands like `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm fmt`, `pnpm build`, and `pnpm dev`.
- When running these top-level commands from Codex, request escalation first instead of running them in the default sandbox.

## Worktree & Preview Workflow

When working in a git worktree, verify context before running app previews:

```bash
git rev-parse --show-toplevel                 # Repo root for current worktree
git branch --show-current                     # Current branch (may be detached HEAD)
git worktree list                             # All worktrees and their paths
```

For web preview testing from the current worktree:

```bash
pnpm --filter @wow-threat/web dev             # Starts Vite on default port 5173
```

- Read the Vite startup output and share the `Local` URL (for example `http://localhost:5173/`).
- If 5173 is already in use, Vite auto-selects another port (for example 5174); always share the actual printed URL.
- Keep the dev server running while the user validates changes; stop it with `Ctrl+C` when done.

### Main Merge Policy (Worktrees)

When merging into `main` from a worktree:

- Always fetch first and sync with the latest remote state (`origin/main`) before merging.
- Use fast-forward only merges into `main` (`--ff-only`); do not create merge commits.
- If fast-forward is not possible, rebase the feature branch onto `origin/main` and then retry the fast-forward merge.

```bash
git fetch origin --prune
git rebase origin/main                      # run on feature branch if needed
git -C /path/to/main-worktree merge --ff-only <feature-branch>
```

## Quality Expectations

- Every change must be linted, type checked, and tested before it is considered complete; use the workspace commands (`pnpm lint`, `pnpm typecheck`, `pnpm test`, etc.) that cover the touched areas.
- Introduce targeted tests for any new code or functionality whenever practical—unit, integration, or e2e tests that guard the behavior you add are preferred and should live alongside the relevant source files.
- Run `pnpm fmt` using the project’s Prettier formatter before considering a change complete.

## Config Versioning Rule

- Any effective threat-config change under `packages/config/src/**` must bump the owning config version in its index file:
  - Era: `packages/config/src/era/index.ts`
  - SoD: `packages/config/src/sod/index.ts`
  - Anniversary/TBC: `packages/config/src/tbc/index.ts`
- If a change is made in Era config code, also bump SoD and Anniversary/TBC config versions, because those configs import and inherit Era behavior.

## Testing

Framework: Vitest.

- API package uses `@cloudflare/vitest-pool-workers` (tests run inside miniflare).
- Web package uses Vitest + React Testing Library for component/integration tests.
- Custom snapshot tests are allowed for `@wow-threat/engine`, `@wow-threat/config`, or any tests that assert final augmented events payloads; these are most commonly used in `@wow-threat/config`.
- End-to-end tests are in Playwright.
- Prefer shared event factory helpers (`createDamageEvent`, `createHealEvent`, and other `createXEvent` helpers) when building test events. Use raw event payload objects only when absolutely necessary for a scenario the helpers cannot express.

```bash
# All tests
pnpm test

# Tests for a specific workspace
pnpm --filter @wow-threat/api test
pnpm --filter @wow-threat/web test
pnpm --filter @wow-threat/engine test
pnpm --filter @wow-threat/config test
pnpm --filter @wow-threat/shared test

# API single test file
pnpm --filter @wow-threat/api exec vitest run src/services/threat.test.ts

# Web single test file
pnpm --filter @wow-threat/web exec vitest run src/lib/threat-aggregation.test.ts

# Threat engine single test file
pnpm --filter @wow-threat/engine exec vitest run src/threat-engine.test.ts

# Single test by name pattern
pnpm --filter @wow-threat/api exec vitest run -t "calculates basic damage threat"
pnpm --filter @wow-threat/web exec vitest run -t "loads report from pasted url"

# Watch mode
pnpm test:watch
pnpm --filter @wow-threat/api test:watch
pnpm --filter @wow-threat/web test:watch
pnpm --filter @wow-threat/engine test:watch

# Web end-to-end
pnpm --filter @wow-threat/web e2e
```

Tests are co-located with source (`foo.ts` / `foo.test.ts`).
API test helpers live in `apps/api/test/`. Web test helpers live in `apps/web/src/test/`.
Threat engine test helpers live in `packages/engine/src/test/helpers/`.

## Typecheck & Lint

```bash
pnpm typecheck                            # tsc --noEmit across all workspaces
pnpm lint                                 # eslint src/ across all workspaces
pnpm --filter @wow-threat/api typecheck   # Typecheck API only
pnpm --filter @wow-threat/api lint        # Lint API only
pnpm --filter @wow-threat/web typecheck   # Typecheck web only
pnpm --filter @wow-threat/web lint        # Lint web only
```

## Web Frontend Conventions

React/frontend-specific architecture and conventions live in
`apps/web/AGENTS.md`.

## Code Style

### Formatting

- No semicolons
- Single quotes for strings
- Trailing commas on multiline constructs (objects, params, arrays)
- 2-space indentation

### Imports

Order imports in groups separated by blank lines:

1. External packages (`hono`, `vitest`)
2. Workspace packages (`@wow-threat/wcl-types`, `@wow-threat/config`)
3. Relative imports (`./types/bindings`, `../middleware/error`)

Use `import type` for type-only imports. Use inline `type` keyword for mixed imports:

```typescript
import { type ThreatConfig, getActiveModifiers } from '@wow-threat/config'

import type { Bindings, Variables } from './types/bindings'
```

Use relative paths for local imports (the `@/*` alias exists but is not used in practice).
Relative imports (`./`, `../`) must stay within the current workspace package only.
Never use relative paths that cross a package boundary; cross-package imports must use
workspace package specifiers (e.g. `@wow-threat/shared`, `@wow-threat/engine`).

### Naming Conventions

| Element             | Convention | Examples                                              |
| ------------------- | ---------- | ----------------------------------------------------- |
| Files/directories   | kebab-case | `mock-fetch.ts`, `threat-config/`                     |
| Functions           | camelCase  | `calculateThreat`, `createCache`                      |
| Classes             | PascalCase | `AppError`, `WCLClient`, `AuraTracker`                |
| Interfaces/Types    | PascalCase | `ThreatConfig`, `CacheService`, `WCLEvent`            |
| Constants (strings) | UPPER_CASE | `WCL_API_URL`, `REPORT_CODE_REGEX`                    |
| Constants (objects) | camelCase  | `baseThreat`, `exclusiveAuras`                        |
| Enum-like keys      | PascalCase | `ErrorCodes.INVALID_REPORT_CODE`, `Spells.ShieldSlam` |
| Test files          | `.test.ts` | `threat.test.ts`, `warrior.test.ts`                   |

No `I` prefix on interfaces. Use `interface` for object shapes/contracts, `type` for
unions, aliases, and function types.

### Type Rules

- Strict mode: `strict: true`, `noUncheckedIndexedAccess: true`, `noImplicitOverride: true`
- `verbatimModuleSyntax: true` -- `import type` is enforced
- Explicit return types on exported functions and class methods
- Return types may be omitted on short lambdas and internal helpers
- Prefer meaningful domain types over plain primitives when semantics matter
  (e.g., `SpellId`, `ActorId`, `EncounterId` instead of bare `number`)
- Use `as const` for lookup tables (spell IDs, error codes)
- Generics where appropriate (`get<T>`, `Partial<>` for test factories)

### Domain ID Branding

Use branded types for domain identifiers that cross API/frontend boundaries so IDs are
not accidentally mixed.

- Brand IDs that represent distinct concepts, such as `EncounterId`, `SpellId`,
  `TalentPointId`, `ActorId`, `FightId`, and `ReportId`.
- Apply branding at boundaries: API response mappers, request validators, route param
  parsers, and query-param parsers.
- Keep wire payloads plain (`number`/`string`) and convert to branded types in
  application code after validation/parsing.
- Keep plain `number` for generic numeric values that are not domain identities
  (e.g., ranks, counts, percentages, loop indexes, local counters).
- Do not over-brand internal ephemeral values (loop indexes, chart point indexes, local
  counters).

```typescript
type Brand<T, TBrand extends string> = T & { readonly __brand: TBrand }

type EncounterId = Brand<number, 'EncounterId'>
type SpellId = Brand<number, 'SpellId'>
type TalentPointId = Brand<number, 'TalentPointId'>
type ActorId = Brand<number, 'ActorId'>
type FightId = Brand<number, 'FightId'>
type ReportId = Brand<string, 'ReportId'>
```

### Error Handling

Errors are thrown (not returned). Use the `AppError` class with factory functions:

```typescript
throw invalidReportCode(code)
throw fightNotFound(reportCode, fightId)
throw wclApiError(`Failed: ${response.status}`)
```

Error codes live in the `ErrorCodes` const object. The global `errorHandler` middleware
catches `AppError` instances and returns structured JSON responses. Do not use try/catch
in route handlers -- let errors propagate to the global handler.

### Functional Patterns

Prefer functional array operations over imperative for-of loops. Functional patterns are
easier to read, verify, and compose:

```typescript
// Good: functional, composable, explicit intent
const actorsInFight = actors
  .filter((a) => fightActorIds.includes(a.id))
  .map((a) => ({ ...a, class: a.type === 'Player' ? a.subType : null }))

// Good: functional transformation with map + filter
const validEnemies = allEnemies
  .map((npc) => ({ ...npc, name: actorMap.get(npc.id)?.name ?? 'Unknown' }))
  .filter((e) => e.id !== ENVIRONMENT_TARGET_ID)

// Avoid: imperative loop is harder to verify
const actorsInFight = []
for (const actor of actors) {
  if (fightActorIds.includes(actor.id)) {
    actorsInFight.push({
      ...actor,
      class: actor.type === 'Player' ? actor.subType : null,
    })
  }
}
```

Use helper functions for complex filter/map conditions:

```typescript
const isHostileNPC = (npc: FightNPC) => npc.id !== ENVIRONMENT_TARGET_ID
const enrichWithName = (npc: FightNPC, actorMap: Map<number, Actor>) => ({
  ...npc,
  name: actorMap.get(npc.id)?.name ?? 'Unknown',
})

const validEnemies = allEnemies
  .filter(isHostileNPC)
  .map((npc) => enrichWithName(npc, actorMap))
```

### JSDoc & Comments

- Every source file starts with a JSDoc block describing the module
- Exported functions get a short (1-line) JSDoc description
- Use `// ===...===` section separators in type definition and config files
- Inline comments sparingly for domain-specific clarifications
- Test files also get a file-level JSDoc header

## Common Patterns

**Factory functions over constructors:** `createCache()`, `createKVCache()`,
`createMemoryCache()`, error factories, test data factories.

**Configuration-as-data:** Threat configs are declarative objects mapping spell IDs to
formula factories, not imperative if/else chains.

**Discriminated unions:** `WCLEvent` discriminates on `type` field. Use switch/if for
type narrowing.

**Cache-first:** Check cache, fall back to API, cache the result. Cache keys built by
`CacheKeys` helper object.

**Hono routing:** Routes composed via `new Hono()` + `.route()` mounting. Dependencies
flow through Hono context (`c.env`, `c.set()`/`c.get()`).

**Implementation plans:** Include brief code snippets where helpful so proposed changes
have concrete context (function signatures, key conditionals, or data shapes).

**Test patterns:**

- BDD style: `describe`/`it`/`expect` (globals enabled)
- `beforeEach`/`afterEach` for setup/teardown
- Test descriptions are lowercase, starting with verbs
- Factory functions for test data with spread overrides: `{ ...defaults, ...overrides }`
- Integration tests mock `fetch` via `vi.stubGlobal()` and use `app.request()`
- Use custom snapshots when asserting final augmented events payloads (typically in `@wow-threat/config` tests)

**No class inheritance** (except `AppError extends Error`). Prefer composition and
plain functions. No DI framework -- pass dependencies explicitly.
