# AGENTS.md

## API Architecture

- Runtime: Cloudflare Workers
- Framework: Hono
- Package: `@wow-threat/api`
- Deployment/config: `apps/api/wrangler.toml`

## Response Compression

- Cloudflare handles response compression at the edge for compressible responses.
- Keep route handlers simple (`c.json(...)`) and do not add manual gzip/brotli logic by default.
- If you suspect compression is not being applied, verify runtime headers/behavior before adding application-level compression code.

## KV Cache Compression

- Store KV cache values as plain JSON by default for simplicity and debuggability.
- Do not add gzip-at-rest preemptively.
- Revisit KV compression only when there is clear pressure from value size, storage limits/cost, or measurable performance impact.
