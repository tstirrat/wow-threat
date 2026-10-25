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
┌ WOW Threat │ Report ★ / Pull ▾ / Target ▾ │ Open report ⌘O · Settings · Account ┐
├──────┬──────────────────────────────────────────────┬────────────────────────────┤
│ Rail │ Toolbar: show preset · scale · thresholds ·  │ Roster at t                │
│      │          window · play/speed · cursor         │  On  Pin  ● Name  thr % TPS│
│ This │ ┌───────────────── chart ─────────────────┐  │  …                         │
│report│ │                                          │  ├────────────────────────────┤
│  or  │ └──────────────────────────────────────────┘  │ N events at t              │
│ Lib  │ Aggro ribbon + event markers                  │  spell, math, modifiers    │
│      │ Fight overview (drag to pan/select)           │                            │
│      ├──────────────────────────────────────────────┴────────────────────────────┤
│      │ Breakdown: focused player × visible window (B to toggle)                  │
└──────┴───────────────────────────────────────────────────────────────────────────┘
```

- **Rail** (collapsible): *This report* shows pulls (kill/wipe, %, duration) with
  targets nested under the current pull. *Library* shows recent, starred reports,
  starred guilds (including guilds you're not in), my guilds and my logs. The last two
  need sign-in.
- **Roster / inspector** (right): a single list replaces the legend, threat meter,
  player search and summary table. Sorted by threat at the cursor, or at the end of
  the window when there's no cursor. Columns: threat, % of the aggro holder, TPS over
  the window. Below the list, every event at the cursor's exact timestamp with its
  full threat math and modifier chain.
- **Breakdown drawer** (bottom): the focused player's spells across the visible
  window. Hits, raw, bonus, coefficient, threat, TPS, % of gain. Click a row to see
  which modifiers make up its coefficient.
- **Aggro ribbon**: who held aggro over time (fixates hatched lighter). Markers below:
  ▲ taunt, ▽ aggro lost, ✕ death, ○ Feign Death, ticks for boss melee. Hover for
  detail, click to jump the cursor there.
- **Overview strip**: the whole fight. Drag inside the window box to pan, drag
  elsewhere to pick a new window, double-click to reset.

## Interaction model

| Input                      | Result                                                        |
| -------------------------- | ------------------------------------------------------------- |
| Hover chart                | Crosshair plus a small tip (time, nearest line, % of holder)  |
| Click a line               | Focus that player (drives the breakdown, highlights the line) |
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

- **Absolute** with dashed 110% (melee) and dotted 130% (ranged) curves over the
  aggro holder's threat.
- **% of aggro holder**: everyone rescaled so 100% is the holder; 110/130 are flat lines.

## URL contract (hash)

`#/report/<code>?pull=&target=&players=&pinned=&focus=&t=&x=a_b&y=a_b&mode=rel&thr=0&buffs=0&emu=0&nosalv=`

- `players` omitted means everyone visible. `focus=none` is an explicit "no focus".
- The analysis settings (`buffs`, `emu`, `nosalv`) are in the link. Display settings
  and panel open/closed state are not; they're saved in the browser.

## Settings

- **My display** (local): boss melee markers, fixate shading, energize events in the
  inspector, hover tip.
- **This analysis** (in the link): threat reduction emulation (Feign Death actually
  resets threat in the sim), inferred Salvation, and per-player "no Salvation" overrides.
  Turning inference off makes DPS pull more often. The sim reruns.

## Mobile (< 760px)

Chart on top. **Menu** opens the rail from the left; **Roster** opens the roster from
the right. Chart and Breakdown are tabs.

## Faked or simplified

- The threat sim is a toy: per-player spell rolls, 110/130% aggro checks, scripted
  tank swaps, taunt responses, deaths 2–4s after a pull, one fixate on Maulgar.
- Every report code loads the same raid. Sign-in is a toggle.
- Wowhead tooltips, loading/computing states, rate limits and private reports aren't drawn.

## Open questions to test with this

1. Is the right-hand roster wide enough to hold both the list and the events-at-t
   section, or does the events section want its own place (e.g. under the chart)?
2. Should clicking a line also move the cursor? Today the two are separate.
3. Does the breakdown drawer steal too much chart height? Should it overlay instead?
4. Is "% of aggro holder" the right relative baseline, or "% of focused player"?
5. Should the window (zoom) TPS and the cursor threat be visually distinguished more
   clearly in the roster?
6. Home: library-first (as here) or paste-URL-first for signed-out users?
