# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Conventional Commits](https://www.conventionalcommits.org/).

## [Unreleased]

### Added

- **web**: Add root-level `ErrorBoundary` component wrapping `<RouterProvider>` in `app.tsx`. Catches unhandled React render errors and displays a user-friendly fallback with "Something went wrong", a "Try again" reset button, and a "Reload page" button. Supports a custom `fallback` render prop for scoped use. Includes a `componentDidCatch` hook point for future Sentry integration ([AGE-3]).
- **api**: `GET /health` now runs parallel dependency probes (KV, Firestore, WCL) with per-check timeouts (2 s / 3 s / 3 s). Returns structured `HealthCheckResult` with per-dependency `status`, `latencyMs`, and optional `message`. Aggregate status: `ok` (all up), `degraded` (some up), `error` (all down). HTTP 200 for ok/degraded; 503 only when all dependencies fail.
- **web**: Add explicit `Cache-Control` headers in `firebase.json` for Firebase Hosting. All SPA routes get `no-cache` via a `**` catch-all so browsers always revalidate after a deploy. Vite-hashed assets under `/assets/**` and font files get `public, max-age=31536000, immutable` for aggressive long-lived caching. Image files get `public, max-age=86400` (1 day). Firebase's last-match-wins semantics ensure the specific immutable rules override the catch-all for asset paths.

### Changed

- **web**: Strip `console.log`, `console.info`, and `console.debug` calls from production builds via `esbuild.pure` in `vite.config.ts`. Operational warning signals (`console.warn`) and critical error logging (`console.error`) are intentionally preserved so IndexedDB failures, worker fallbacks, and other production error paths remain observable.
