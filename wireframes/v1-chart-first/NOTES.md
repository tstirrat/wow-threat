# v1: chart-first

Open `index.html` in a browser. Click a report in the library, or paste any
`…warcraftlogs.com/reports/<code>` URL. Every code loads the same fake raid
(5 pulls: Maulgar ×3, Gruul ×2) with different rolls.

## Brief

- **Who:** tanks, DPS, raid leaders and theorycrafters reading a pull after the fact,
  usually next to Warcraft Logs.
- **Job:** see who had threat, when, and why, down to which spell and coefficient.
  Spot aggro changes, taunts, fixates and near-pulls. Compare one player against
  another or against everyone.
- **Thesis:** the chart is the workspace. It takes the whole window and everything
  else docks around it.

## Layout

```
┌──────┬───────────────────────────────────────────────────────────────────────────┐
│ WOW  │ Chart bar: show · scale · thresholds · window · play · cursor │ Open report│
│Threat│                                                  Sign in · ⚙ · roster ▯ │
│      ├──────────────────────────────────────────────┬────────────────────────────┤
│ This │ ┌───────────────── chart ─────────────────┐  │ Roster at t                │
│report│ │  lines + event dots + red melee dots     │  │  On  Pin  ● Name  thr % TPS│
│  or  │ └──────────────────────────────────────────┘  │  …                         │
│ Lib  │ Aggro bar (class colours, fixates hatched)    │                            │
│      │ Fight overview (drag to pan/select)           │                            │
│      ├──────────────────────────────────────────────┴────────────────────────────┤
│      │ Breakdown: focused player × visible window          (B)       Shortcuts ? │
└──────┴───────────────────────────────────────────────────────────────────────────┘
```

- **No app top bar.** The chart bar is the only top bar and runs to the right edge.
  Chart controls sit on the left; Open report, account, settings (gear) and the roster
  toggle sit on the right. The roster sits under the bar, level with the chart.
- **Rail** (collapsible) holds all report navigation. *This report* shows the report
  title, star, guild and date, then pulls (kill/wipe, %, duration) with targets nested
  under the current pull. *Library* shows recent, starred reports, starred guilds
  (including guilds you're not in), my guilds and my logs. The last two need sign-in.
  The chart bar shows the pull/target title only when the rail is collapsed.
- **Roster** (right, hideable): one list replaces the legend, threat meter, player
  search and summary table. Sorted by threat at the cursor, or at the end of the
  window. Columns: threat, % of the aggro holder, TPS over the window.
- **Tooltip** (replaces the v1.0 "events at cursor" panel, which testers didn't find):
  anchored to the dot nearest the mouse. Shows the player (class colour), their share
  of the aggro holder, every event they had at that exact timestamp with the threat
  math and modifier chain, and "Boss melee hit" when a melee landed then.
- **Dots** on the lines: spell events in the line colour, boss melee in red, resource
  changes (rage gain) smaller. Each type can be hidden in settings.
- **Aggro bar**: who held aggro over time in their class colour, fixates hatched.
  Hover for the holder (name in class colour) and span; click to jump the cursor.
- **Overview strip**: the whole fight. Drag inside the window box to pan, drag
  elsewhere to pick a new window, double-click to reset.
- **Breakdown drawer** (bottom): the focused player's spells across the visible
  window. Click a row to see which modifiers make up its coefficient. The Shortcuts
  button sits at its right edge and stays visible when the drawer is collapsed.

## Interaction model

| Input                      | Result                                                        |
| -------------------------- | ------------------------------------------------------------- |
| Hover chart                | Crosshair; tooltip on the nearest dot                         |
| Click a dot or line        | Focus that player (drives the breakdown, highlights the line) |
| Click empty chart space    | Set the cursor to t (snaps to the nearest visible event)      |
| Drag on chart              | 2D zoom. Time range drives totals; Y only magnifies           |
| Flat drag (< 12px tall)    | Time-only zoom                                                |
| Double-click chart         | Reset zoom                                                    |
| Space                      | Play/pause from the cursor (stops at the window's right edge) |
| ← / →                      | Step to the previous/next event (focused player, or visible)  |
| Roster row                 | Focus. **On** toggles visibility, **Pin** pins                |

### Player states

- **Visible**: line drawn.
- **Focused**: exactly one or none. Defaults to the tank with the most threat over
  the fight. Kept across pulls when that player is present.
- **Pinned**: any number. Switching pulls makes pinned players the only visible ones.
  Pinned players missing from a pull stay in the roster greyed out ("not in this
  pull"). Try pinning someone, then switching to a Gruul pull (Sneakpeek sits out).

### Threat scale

- **Absolute**. Pull thresholds are off by default to cut clutter; when on, dashed
  110% (melee) and dotted 130% (ranged) curves follow the aggro holder's threat.
- **% of aggro holder**: everyone rescaled so 100% is the holder; 110/130 are flat lines.

## URL contract (hash)

`#/report/<code>?pull=&target=&players=&pinned=&focus=&t=&x=a_b&y=a_b&mode=rel&thr=1&buffs=0&emu=0&nosalv=`

- `players` omitted means everyone visible. `focus=none` is an explicit "no focus".
- The analysis settings (`buffs`, `emu`, `nosalv`) are in the link. Display settings,
  theme and panel open/closed state are not; they're saved in the browser.

## Settings

- **My display** (local): theme (system/light/dark), spell event dots, boss melee dots,
  resource change dots, fixate shading.
- **This analysis** (in the link): threat reduction emulation (Feign Death actually
  resets threat in the sim), inferred Salvation, and per-player "no Salvation" overrides.
  Turning inference off makes DPS pull more often. The sim reruns.

## Mobile (< 760px)

The chart bar wraps, with the pull/target title on its own line. **Menu** opens the
rail from the left; the roster button opens the roster from the right. Chart and
Breakdown are tabs.

## Faked or simplified

- The threat sim is a toy: per-player spell rolls, 110/130% aggro checks, scripted
  tank swaps, taunt responses, deaths 2–4s after a pull, one fixate on Maulgar.
- Every report code loads the same raid. Sign-in is a toggle.
- Wowhead tooltips, loading/computing states, rate limits and private reports aren't drawn.

## Open questions to test with this

1. Should clicking a line also move the cursor? Today the two are separate.
2. Does the breakdown drawer steal too much chart height? Should it overlay instead?
3. Is "% of aggro holder" the right relative baseline, or "% of focused player"?
4. Should the window (zoom) TPS and the cursor threat be visually distinguished more
   clearly in the roster?
5. Home: library-first (as here) or paste-URL-first for signed-out users?
6. Taunts, deaths and aggro losses no longer have their own markers (the event lane
   was removed). Is the tooltip on the dot enough, or do they need a distinct dot shape?
