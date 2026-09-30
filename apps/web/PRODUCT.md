# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

People who raid in World of Warcraft and want to understand threat after a pull, using logs already uploaded to Warcraft Logs (WCL):

- **Tanks** check whether their threat lead held, and where and why they lost aggro.
- **DPS** check their threat ceiling: how close they came to pulling, so they can push harder or learn when to hold back.
- **Raid leaders and officers** diagnose wipes and threat-related deaths, often while screen-sharing with the raid.
- **Theorycrafters** check threat mechanics and coefficients, and look for bugs in the threat rules.

The product serves all four groups. None of them is secondary.

## Product Purpose

WoW Threat turns a WCL report into per-fight threat charts. A user pastes a report URL, picks a fight, then a target (boss or add), and sees each player's threat over time, plus a threat meter, a player summary and per-event tooltips. Success means someone can answer "who had threat, when, and why" for a pull quickly and trust the answer.

## Positioning

- **Accurate threat rules per class and talent.** Threat is simulated with declarative rules for each expansion (Era, Season of Discovery, TBC/Anniversary). The rules model class base threat, talents, stances, auras, buffs and split threat, which WCL's own views don't do. Correctness is the core claim.
- **Fast, deep-linkable charts.** Every view is a shareable URL: report, fight, `players`, `targetId`, and the `startMs`/`endMs` window. The threat engine runs in the browser, in a Web Worker with IndexedDB caching, so charts load quickly and links reproduce exactly what the sender saw.

## Operating Context

- Usually opened between pulls or after raid, next to WCL. It may also be screen-shared during raid discussion.
- Entry points: a WCL report URL pasted on the landing page (focused with ⌘/Ctrl+O), recent or starred reports, guild or personal log lists, and the Chrome extension (`packages/chrome-extension`), which adds a "Threat" tab to WCL report pages and deep-links the current fight and player.
- Supported WCL hosts: `classic`, `vanilla`, `fresh`, `sod` and `www`.

## Capabilities and Constraints

- Routes: `/`, `/report/:reportId`, `/report/:reportId/fight/:fightId`. The URL query parameters are a contract that deep links rely on.
- Charts work without signing in. Signing in with WCL adds personal log lists, starred guild logs and account-synced starred reports.
- The fight page has keyboard shortcuts, a fight quick-switcher, and fuzzy selectors for fights and targets. Playback controls and initial-aura display are also present.
- Light and dark themes (mode toggle). Class colors identify players and must stay legible in both themes.
- Wowhead tooltips (`wow.zamimg.com`) are loaded for spell and ability references.
- Threat config versions bust the event cache. A rule change shows up as changed chart output.
- PostHog tracks meaningful interactions. Sentry tracks errors.

## Brand Commitments

- Name: "WOW Threat" (page title). The domain is `wow-threat.web.app`.
- No logo, mascot or brand voice has been decided yet.

## Evidence on Hand

- Real example reports for Fresh (TBC) and SoD are in `src/lib/constants.ts` (`exampleReports`).
- No testimonials, usage numbers, guild endorsements or press exist. Do not invent any.

## Product Principles

1. **Correctness is the product.** A chart that looks good but shows wrong threat is worse than no chart. Show the reasoning behind a number (multipliers, auras, split) wherever it helps someone trust it.
2. **Every view is shareable.** Any state someone would want to point at should survive a copied URL.
3. **Fast to the answer.** Getting from pasting a report to seeing a readable chart for the right fight and target should take as few steps as possible, including on reports with many pulls.
4. **Serve both a quick glance and a deep dive.** A tank checking one pull and a theorycrafter auditing coefficients use the same screen. Keep the quick read obvious and keep the detail available.
