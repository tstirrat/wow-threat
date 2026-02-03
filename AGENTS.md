# AGENTS.md

## Project Overview

pnpm monorepo (Turborepo) for a World of Warcraft combat log threat calculation API.
The API runs on Cloudflare Workers using Hono. All code is TypeScript (strict mode, ESM).
Node >= 20 (see `.nvmrc`), pnpm 9.15+.

## Workspace Layout

```
apps/api/              @wcl-threat/api        Cloudflare Worker API (Hono v4)
apps/web/              (empty placeholder)     Future frontend
packages/shared/       @wcl-threat/shared      Cross-cutting utilities
packages/threat-config/@wcl-threat/threat-config  Per-class threat calculation configs
packages/wcl-types/    @wcl-threat/wcl-types   WCL API type definitions
tooling/typescript-config/                     Shared tsconfig presets
```

## Build & Dev Commands

```bash
pnpm install                              # Install all dependencies
pnpm build                                # Build all workspaces (turbo)
pnpm dev                                  # Start API dev server (wrangler dev)
pnpm clean                                # Clean all build artifacts + node_modules
pnpm --filter @wcl-threat/api deploy      # Deploy to production
pnpm --filter @wcl-threat/api deploy:staging  # Deploy to staging
```

## Testing

Framework: Vitest. The API package uses `@cloudflare/vitest-pool-workers` (tests run
inside miniflare). Other packages use standard Vitest.

```bash
# All tests
pnpm test

# Tests for a specific workspace
pnpm --filter @wcl-threat/api test
pnpm --filter @wcl-threat/threat-config test
pnpm --filter @wcl-threat/shared test

# Single test file (run from package directory)
pnpm --filter @wcl-threat/api exec vitest run src/services/threat.test.ts
pnpm --filter @wcl-threat/threat-config exec vitest run src/anniversary/classes/warrior.test.ts

# Single test by name pattern
pnpm --filter @wcl-threat/api exec vitest run -t "calculates basic damage threat"

# Watch mode
pnpm test:watch
pnpm --filter @wcl-threat/api test:watch
```

Tests are co-located with source (`foo.ts` / `foo.test.ts`). Test helpers live in
`apps/api/test/` (setup, mock-fetch, fixtures).

## Typecheck & Lint

```bash
pnpm typecheck                            # tsc --noEmit across all workspaces
pnpm lint                                 # eslint src/ across all workspaces
pnpm --filter @wcl-threat/api typecheck   # Typecheck API only
pnpm --filter @wcl-threat/api lint        # Lint API only
```

## Code Style

### Formatting

- No semicolons
- Single quotes for strings
- Trailing commas on multiline constructs (objects, params, arrays)
- 2-space indentation

### Imports

Order imports in groups separated by blank lines:
1. External packages (`hono`, `vitest`)
2. Workspace packages (`@wcl-threat/wcl-types`, `@wcl-threat/threat-config`)
3. Relative imports (`./types/bindings`, `../middleware/error`)

Use `import type` for type-only imports. Use inline `type` keyword for mixed imports:
```typescript
import type { Bindings, Variables } from './types/bindings'
import { type ThreatConfig, getActiveModifiers } from '@wcl-threat/threat-config'
```

Use relative paths for local imports (the `@/*` alias exists but is not used in practice).

### Naming Conventions

| Element             | Convention    | Examples                                    |
|---------------------|---------------|---------------------------------------------|
| Files/directories   | kebab-case    | `mock-fetch.ts`, `threat-config/`           |
| Functions           | camelCase     | `calculateThreat`, `createCache`            |
| Classes             | PascalCase    | `AppError`, `WCLClient`, `AuraTracker`      |
| Interfaces/Types    | PascalCase    | `ThreatConfig`, `CacheService`, `WCLEvent`  |
| Constants (strings) | UPPER_CASE    | `WCL_API_URL`, `REPORT_CODE_REGEX`          |
| Constants (objects) | camelCase     | `baseThreat`, `exclusiveAuras`              |
| Enum-like keys      | PascalCase    | `ErrorCodes.INVALID_REPORT_CODE`, `Spells.ShieldSlam` |
| Test files          | `.test.ts`    | `threat.test.ts`, `warrior.test.ts`         |

No `I` prefix on interfaces. Use `interface` for object shapes/contracts, `type` for
unions, aliases, and function types.

### Type Rules

- Strict mode: `strict: true`, `noUncheckedIndexedAccess: true`, `noImplicitOverride: true`
- `verbatimModuleSyntax: true` -- `import type` is enforced
- Explicit return types on exported functions and class methods
- Return types may be omitted on short lambdas and internal helpers
- Use `as const` for lookup tables (spell IDs, error codes)
- Generics where appropriate (`get<T>`, `Partial<>` for test factories)

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

**Test patterns:**
- BDD style: `describe`/`it`/`expect` (globals enabled)
- `beforeEach`/`afterEach` for setup/teardown
- Test descriptions are lowercase, starting with verbs
- Factory functions for test data with spread overrides: `{ ...defaults, ...overrides }`
- Integration tests mock `fetch` via `vi.stubGlobal()` and use `app.request()`

**No class inheritance** (except `AppError extends Error`). Prefer composition and
plain functions. No DI framework -- pass dependencies explicitly.
