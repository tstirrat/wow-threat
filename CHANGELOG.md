# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Conventional Commits](https://www.conventionalcommits.org/).

## [Unreleased]

### Added

- **api**: Integrate Sentry error tracking via `@sentry/cloudflare`. Worker default export is wrapped with `withSentry`; 5xx errors are explicitly captured in `errorHandler` via `Sentry.captureException`. DSN configured via `SENTRY_DSN` Wrangler secret (optional; no-op when unset).
- **web**: Integrate Sentry error tracking via `@sentry/react`. `initSentry()` is called in `main.tsx` before React mounts. No-ops when `VITE_SENTRY_DSN` is unset. Uses named imports and `tracePropagationTargets` to restrict distributed-tracing headers to the app's own origin.
- **web**: Add root-level `ErrorBoundary` component wrapping `<RouterProvider>` in `app.tsx`. Catches unhandled React render errors and displays a user-friendly fallback with "Something went wrong", a "Try again" reset button, and a "Reload page" button. Supports a custom `fallback` render prop for scoped use. Includes a `componentDidCatch` hook point for future Sentry integration ([AGE-3]).
- **api**: `GET /health` now runs parallel dependency probes (KV, Firestore, WCL) with per-check timeouts (2 s / 3 s / 3 s). Returns structured `HealthCheckResult` with per-dependency `status`, `latencyMs`, and optional `message`. Aggregate status: `ok` (all up), `degraded` (some up), `error` (all down). HTTP 200 for ok/degraded; 503 only when all dependencies fail.
- **web**: Add explicit `Cache-Control` headers in `firebase.json` for Firebase Hosting. All SPA routes get `no-cache` via a `**` catch-all so browsers always revalidate after a deploy. Vite-hashed assets under `/assets/**` and font files get `public, max-age=31536000, immutable` for aggressive long-lived caching. Image files get `public, max-age=86400` (1 day). Firebase's last-match-wins semantics ensure the specific immutable rules override the catch-all for asset paths.
- **web**: Add `Content-Security-Policy-Report-Only` and security headers to Firebase Hosting config. CSP uses deny-by-default with allowlisted origins: `self`, `https://wow.zamimg.com` (Wowhead tooltips), WCL API, and required Firebase/Google endpoints (`securetoken.googleapis.com`, `identitytoolkit.googleapis.com`, `firestore.googleapis.com`, `firebaseinstallations.googleapis.com`). `style-src` includes `unsafe-inline` for Wowhead tooltip inline styles. Additional headers: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` disabling camera/mic/geolocation.

### Changed

- **web**: Strip `console.log`, `console.info`, and `console.debug` calls from production builds via `esbuild.pure` in `vite.config.ts`. Operational warning signals (`console.warn`) and critical error logging (`console.error`) are intentionally preserved so IndexedDB failures, worker fallbacks, and other production error paths remain observable.
