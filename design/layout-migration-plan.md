# Layout migration plan: adopt v1 chart-first layout in `apps/web`

Goal: move the real app to the layout in `design/wireframes/v1-chart-first/` without
changing what it does. Every PR here is layout only: existing controls, data, hotkeys,
URL params and analytics keep working; they just move. New behaviour from the
wireframe (events tab, aggro bar, overview strip, 2D zoom, rolling TPS, resources) is
out of scope and listed at the end.

Rule for every PR: lint, typecheck, unit tests, the touched Playwright spec, `pnpm fmt`.
Page objects in `apps/web/src/test/page-objects/**` are updated in the same PR as the
markup they target.

## Target shape

```
┌──────┬────────────────────────────────────────────────────────────┐
│ rail │ app bar: Open report │ Report › Fight › Target │ acct ⚙ ▯ │
│      ├──────────────────────────────────────────────┬─────────────┤
│      │ chart (fills height)                         │ roster      │
│      │ transport (playback)                         │ (legend)    │
│      ├──────────────────────────────────────────────┴─────────────┤
│      │ player info drawer (focused player summary)                │
└──────┴────────────────────────────────────────────────────────────┘
```

## Today → target mapping

| Today                                                       | Target                                   |
| ----------------------------------------------------------- | ---------------------------------------- |
| `RootLayout` header (home, report input, Starred ▾, account) | App bar + rail library                   |
| `main.max-w-7xl` centre column                              | Full-window grid                         |
| `ReportSummaryHeader` card                                   | Rail "This report" header + bar title    |
| `FightQuickSwitcher` strip                                   | Rail pull list                           |
| `TargetSelector` in chart card header                        | Last crumb of the bar title (dropdown)   |
| `ThreatChartControls` row above chart                        | Settings panel (gear) + floating Reset zoom |
| `PlaybackControls` row above chart                           | Transport row under the chart            |
| `ThreatChart` fixed 560px + `ThreatChartLegend` 14rem column | Chart fills height; legend → roster panel |
| `ThreatMeter` replacing legend during replay                 | Roster panel content during replay (unchanged behaviour) |
| "Focused player summary" card                                | Player info drawer                       |
| Landing page cards (starred, recent, guilds, account)        | Rail library; home = centred URL box     |

## Phases and PRs

Two lanes can run in parallel because they touch different files. Lane A owns
`routes/*`, `pages/landing-page.tsx` and new rail/bar components. Lane B owns
`pages/fight-page.tsx`, `components/threat-chart*.tsx`, `player-summary-table.tsx`,
`playback-controls.tsx`. The only shared seam is the app bar title slot (A3 ↔ B1),
agreed up front below.

### Lane A: shell and navigation

**A1. Full-window shell** (blocks A2–A4)
- `RootLayout` becomes a CSS grid: `rail | bar / rail | outlet`. Drop `max-w-7xl` and
  page padding on report routes; landing keeps a centred box.
- Extract the current header into `components/app-bar.tsx` unchanged (so A3 and A4
  don't both edit `root-layout.tsx`).
- Add `components/app-rail.tsx`: collapsible container with two slots, open by default
  on every page load (collapsing lasts for the session only; remembering it in local
  storage can come later). Empty for now apart from the collapse button.
- Add a bar title slot the report routes can fill:
  ```tsx
  // routes/app-shell-context.tsx
  export interface AppShellSlots {
    setBarTitle: (node: ReactNode) => void
    setRailReportSection: (node: ReactNode) => void
  }
  ```
  (portal or context setter; pick one in the PR, both are cheap.)

**A2. Rail: this report** (after A1, parallel with A3/A4)
- New `components/report-outline.tsx`: report title, star, guild, date, threat config
  label, WCL link, then the boss-kill list from `buildBossKillNavigationFights`, current
  fight highlighted. Reuses `FightQuickSwitcher`'s link building (query params carried).
- `ReportLayout` fills the rail slot and stops rendering `ReportSummaryHeader` and
  `FightQuickSwitcher` inline. `ReportPage` zero state stays in the outlet.
- Page objects: `fight-quick-switcher-object.ts` retargeted to the rail.

**A3. Library in the rail + home box** (after A1, parallel with A2/A4)
- New `components/rail-library.tsx` using the existing `StarredReportsList`,
  `RecentReportsList`, `StarredGuildReportsList`, `AccountRecentReportsList`.
- Rail shows Library when not on a report, and as a second tab on report routes.
- `LandingPage` shrinks to a centred URL box (+ example reports when there's no
  history). The header "Starred ▾" dropdown goes away (now in the rail).
- Page objects: `recent-reports-object.ts` retargeted.

**A4. Unified app bar** (after A1, parallel with A2/A3)
- `app-bar.tsx` layout: Open report (⌘O, existing collapsible input) on the left, divider,
  title slot, then account menu, theme toggle, settings slot and roster-toggle slot on
  the right. Same behaviour, new positions.
- Title slot filled by `ReportLayout` with "Report › #fight Boss · Kill · 3:12" and by
  `FightPage` with the `TargetSelector` appended (see B1).

### Lane B: fight workspace

**B1. Fight workspace regions + full-height chart** (can start alongside A1)
- New `components/fight-workspace.tsx`: grid with `chart | roster`, `transport`,
  `drawer` regions. `FightPage` renders into it instead of stacked `SectionCard`s.
- `ThreatChart` height becomes `100%` of its region (flex), with a min height so it
  still works inside the old shell until A1 lands. Keep ECharts `dataZoom` as is.
- `ThreatChart` gets the legend as a prop/slot instead of rendering the
  `grid-cols-[1fr_14rem]` itself, so B2 can move it.
- The fight title + `TargetSelector` render in a small region header for now; when A4
  lands, they move into the bar title slot (one-line follow-up in whichever lands second).

**K1. Hotkey remap** (after B1, before B2/B4/B5)
- Frees R, I and E and adopts the wireframe keys for actions that already exist.
  See the hotkey table below. Updates the shortcuts overlay and its tests.
- Lives in `fight-page.tsx` and `threat-chart.tsx`, so it goes in lane B order.

**B2. Roster panel** (after K1)
- `ThreatChartLegend` moves into the right `roster` region, full height, hideable
  (toggle button in the bar's roster slot, and <kbd>R</kbd>; persisted in local storage).
- `ThreatMeter` keeps replacing it during replay, same as today.

**B3. Transport row** (after B1, parallel with B2 if careful; otherwise after)
- `PlaybackControls` moves below the chart into the `transport` region. No behaviour
  change.

**B4. Player info drawer** (after K1)
- "Focused player summary" card becomes a bottom drawer titled "Player info":
  collapsible (<kbd>I</kbd>), open state persisted, collapsed bar still shows the
  focused player name in class colour + initial auras. `PlayerSummaryTable` content
  unchanged.
- Shortcuts (`?`) button at the drawer bar's right edge.

**B5. Settings panel + floating chart controls** (after K1)
- `ThreatChartControls` toggles (boss damage, fixate bands, energize, infer threat
  reduction, show pets) move into a settings side panel opened by the bar's gear
  (<kbd>,</kbd>). Each toggle shows its hotkey where it has one.
- Reset zoom becomes a floating button top-right of the chart, shown only while zoomed.
- `PlayerThreatOverridesPanel` stays where it is (already a side panel).

### Phase C: finish

**C1. Mobile pass** (after A and B): rail and roster become off-canvas, chart / player
info tabs under 760px, bar wraps.

**C2. Cleanup**: delete `SectionCard`/`ReportSummaryHeader` if unused, update
`apps/web/CLAUDE.md` route behaviour notes, full `pnpm --filter @wow-threat/web e2e`.

## Ordering at a glance

```
A1 ──┬── A2
     ├── A3
     └── A4 ──────────────┐
B1 ── K1 ──┬── B2 ────────┼── C1 ── C2
           ├── B3         │
           ├── B4         │
           └── B5 ────────┘
```

Start: A1 and B1 together. After A1 merges, A2/A3/A4 can go in parallel (separate
files). Lane B is mostly sequential because K1 and B2–B5 all edit `fight-page.tsx`;
keep each PR's `fight-page.tsx` diff to wiring only.

## Decisions

1. **Hotkeys: adopt the wireframe keys.** K1 moves the clashing actions; the panel
   keys arrive with their panels.

   | Key           | Today                     | After                                      | PR  |
   | ------------- | ------------------------- | ------------------------------------------ | --- |
   | R             | Toggle replay mode        | Show/hide roster panel                     | B2  |
   | I             | Isolate focused player    | Show/hide player info drawer               | B4  |
   | E             | Toggle energize events    | Reserved for the events tab (unbound)      | K1  |
   | P             | Toggle show pets          | Pin/unpin focused player                   | K1  |
   | H             | —                         | Hide/show focused player's line            | K1  |
   | O             | —                         | Overrides panel for the focused player     | K1  |
   | 0             | —                         | Reset zoom                                 | K1  |
   | ,             | —                         | Open settings                              | B5  |
   | Space         | Play/pause (replay only)  | Play/pause; enters replay mode if needed   | K1  |
   | Shift+I       | —                         | Isolate focused player (moved from I)      | K1  |
   | B, C, Z, /, ←/→, Shift+,/., ⌘O, ?, Esc | unchanged | unchanged                 | —   |

   Replay mode loses its own key (Space and the transport button cover it). Energize
   events and show pets lose theirs and live in the settings panel. A (abs/%) and T
   (thresholds) stay unbound until those features exist.
2. **Left sidebar (rail) starts open** on every page load. Remembering collapsed state
   in local storage is a later nicety.
3. **Target picker goes in the top bar title** for now (option (a) below). A sidebar
   target list under the current pull is a later addition.

### Target picker options considered

Today the target (which enemy's threat table the chart shows: Maulgar, Kiggler, Blindeye,
…) is a dropdown in the chart card header. Once that card goes away it needs a new home:

- **(a) In the top bar title**, as the last crumb: "Report › #3 Maulgar · Kill ›
  Kiggler the Crazed ▾". One click away, visible in screenshots.
- **(b) In the left sidebar**, listed under the current pull (as in the wireframe), one
  click per target, no dropdown.
- **(c) Both**: bar shows the current target (and can switch), sidebar lists them.

Chosen: (a) in A4/B1, since it's a straight move of today's dropdown. (b) can be added
later; it needs the fight's target list in the report layout, which today only the fight
page computes.

## Out of scope (functional, later)

Events tab, aggro ribbon, overview strip, 2D zoom, absolute/% toggle, rolling TPS
column, roster eye/pin/All/Tanks/Top 5 redesign, right-click menu, resources and
avoided attacks, playback-from-cursor model.
