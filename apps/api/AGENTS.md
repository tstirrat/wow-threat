# AGENTS.md

## API Architecture

- Runtime: Cloudflare Workers
- Framework: Hono
- Package: `@wow-threat/api`
- Deployment/config: `apps/api/wrangler.toml`

## Task Routing (Open These Files First)

| Task                                   | Open these files first                                                                                                                                                                    |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Add or change API endpoint             | `apps/api/src/index.ts`, `apps/api/src/routes/*.ts`, `apps/api/src/types/api.ts`                                                                                                          |
| Auth/session behavior                  | `apps/api/src/routes/auth.ts`, `apps/api/src/middleware/auth.ts`, `apps/api/src/services/firebase-auth.ts`, `apps/api/src/services/token-utils.ts`, `apps/api/src/services/auth-store.ts` |
| Warcraft Logs integration              | `apps/api/src/services/wcl.ts`, `apps/api/src/services/wcl-oauth.ts`, `apps/api/src/services/wcl-rate-limit.ts`, `packages/wcl-types/src/report-schema.ts`                                |
| Error handling and API error responses | `apps/api/src/middleware/error.ts`, `apps/api/src/routes/*.ts`                                                                                                                            |
| Cache/config persistence               | `apps/api/src/services/cache.ts`, `apps/api/src/services/runtime-config.ts`, `apps/api/src/services/firestore-client.ts`                                                                  |
| CORS/origin allowlist behavior         | `apps/api/src/services/origins.ts`, `apps/api/src/index.ts`                                                                                                                               |

## Change Checklist

1. Update implementation in route/service/middleware file(s)
2. Update or add nearby `*.test.ts` coverage for touched behavior
3. Run scoped checks:
   - `pnpm --filter @wow-threat/api lint`
   - `pnpm --filter @wow-threat/api typecheck`
   - `pnpm --filter @wow-threat/api test`

## Response Compression

- Cloudflare handles response compression at the edge for compressible responses.
- Keep route handlers simple (`c.json(...)`) and do not add manual gzip/brotli logic by default.
- If you suspect compression is not being applied, verify runtime headers/behavior before adding application-level compression code.

## KV Cache Compression

- Store KV cache values as plain JSON by default for simplicity and debuggability.
- Do not add gzip-at-rest preemptively.
- Revisit KV compression only when there is clear pressure from value size, storage limits/cost, or measurable performance impact.
