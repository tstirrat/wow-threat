# v1: chart-first

Open `index.html` in a browser. Click a report in the sidebar library, or paste any
`…warcraftlogs.com/reports/<code>` URL into the box on the home page (or ⌘O).
Every code loads the same fake raid (5 pulls: Maulgar ×3, Gruul ×2) with
different rolls.

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
│ WOW  │ Open report ⌘O │ Report › #pull Boss · outcome › target │    Sign in │
│Threat│                                                  Sign in · ⚙ · roster ▯ │
│      ├──────────────────────────────────────────────┬────────────────────────────┤
│ This │ ┌───────────────── chart ─────────────────┐  │ Roster        Overrides    │
│report│ │  lines + event dots + red melee dots     │  │  On  Pin  ● Name  thr % TPS│
│  or  │ └──────────────────────────────────────────┘  │  …                         │
│ Lib  │ Aggro bar (class colours, fixates hatched)    │                            │
│      │ Fight overview (drag to pan/select)           │                            │
│      │ Transport: window · play/speed · cursor/clear │                            │
│      ├──────────────────────────────────────────────┴────────────────────────────┤
│      │ Player info (I): name · role · auras │ summary │ spells   Shortcuts ?   │
└──────┴───────────────────────────────────────────────────────────────────────────┘
```

- **No app top bar.** The chart bar is the only top bar and runs to the right edge.
  Open report (⌘O) leads on the left, then a divider and the report/fight title;
  account, settings (gear) and the roster toggle sit on the right. The roster sits under the bar, level with the chart.
- **Rail** (collapsible) holds all report navigation. *This report* shows the report
  title, star, guild and date, then pulls (kill/wipe, %, duration) with targets nested
  under the current pull. *Library* shows recent, starred reports, starred guilds
  (including guilds you're not in), my guilds and my logs. The last two need sign-in.
  The chart bar always shows "Report › #pull Boss · Wipe/Kill · duration › target",
  so screenshots carry their context.
- **Floating chart controls** (top right of the plot): a single scale toggle that
  reads Absolute or % of aggro (<kbd>A</kbd>), and Reset zoom to its left, shown only
  while zoomed.
- **Home**: just a centred box for pasting a report URL, with a ⌘O hint. The library
  lives in the sidebar only.
- **Roster** (right, hideable): one list replaces the legend, threat meter, player
  search and summary table. Sorted by threat at the cursor, or at the end of the
  window. Columns: threat, % of the aggro holder, and rolling TPS over the last
  N seconds before that time (5s default; 3/5/10/30s in Settings). It updates during
  playback, so ramp-ups are visible. Window-wide TPS lives in player info. Each row has
  an eye (show/hide line) and a pin (filled and pressed in when pinned).
  The header has a filter and three show buttons. **All** toggles: from a partial
  set it shows everyone, from everyone it hides everyone. **Tanks** shows only tanks.
  **Top 5** shows the five highest threat at the cursor (or window end). The pressed
  button reflects the current set.
- **Events tab** (side panel, <kbd>E</kbd>): a second tab beside Roster (<kbd>R</kbd>).
  It lists everything visible players did within ±1/2/3s of the cursor (±2s default),
  in time order: events before the cursor above a horizontal cursor line, events
  after it below, with the offset (−0.42s / +1.10s) shown once per timestamp so
  simultaneous events group together. Each row: player (class colour), spell or
  "Boss melee hit" (red), threat change. Taunts, deaths and Feign Death are bold.
  "Focused only" narrows to the focused player. Hovering a row rings its dot on
  the chart; clicking moves the cursor there. The list keeps the cursor line
  centred and follows playback. Pressing the active tab's key again hides the panel.
- **Pets**: hunter and warlock pets are their own rows and lines, named
  "Wolf (Quickshot)", in the owner's class colour, drawn dashed. They get no
  Salvation. Bramblearrow's cat sits out the Gruul pulls.
- **Tooltip** (replaces the v1.0 "events at cursor" panel, which testers didn't find):
  anchored to the dot nearest the mouse. Shows the player (class colour), their share
  of the aggro holder, every event they had at that exact timestamp with the threat
  math and modifier chain, and "Boss melee hit" when a melee landed then.
  Away from dots there is no tooltip, except over a shaded fixate area (who, span,
  duration). Who has aggro is on the aggro bar instead.
- **Dots** on the lines: spell events in the line colour, boss melee in red, resource
  changes (rage gain) smaller. Each type can be hidden in settings.
- **Aggro bar**: who held aggro over time in their class colour, fixates hatched.
  Hover for the holder (name in class colour) and span; click to jump the cursor.
- **Transport row** (under the overview, above player info): window readout,
  play/pause (Space) and speed, cursor time and Clear.
- **Overview strip**: the whole fight. Drag inside the window box to pan, drag
  elsewhere to pick a new window, double-click to reset.
- **Player info drawer** (bottom, <kbd>I</kbd>): the focused player across the
  visible window. The title bar stays useful when collapsed: player name in class
  colour, a tank or healer icon, and their initial threat auras as Wowhead spell
  icons (stances, forms, buffs only), plus an overrides link. Expanded, it shows:
  - **Summary** (left): class/role/range (or pet owner), threat talents with ranks
    and multipliers, threat and TPS in the window, time holding aggro, **closest to
    pulling** (highest % of the aggro holder while not holding it, with its pull
    limit; fixates excluded; click to jump the cursor there), taunts and deaths.
  - **Spells** (right): hits, raw, bonus, coefficient, threat, TPS, % of gain. Click
    a row to see the modifiers behind its coefficient.
  The Shortcuts button sits at the bar's right edge.
- **Threat overrides** (what-ifs): per player, force a buff on or off (Blessing of
  Salvation, Tranquil Air Totem) regardless of buff inference, and change threat
  talent ranks (Defiance, Feral Instinct, Arcane Subtlety, Silent Resolve, …). They
  last for the whole report and rerun the sim live.
  - **Where:** an **Overrides** button in the roster header (count badge, <kbd>O</kbd>),
    a link in Settings → This analysis, the right-click menu on any player (roster
    row or chart line), and the sliders icon on a roster row that has overrides.
  - **All-players view:** every player with overrides, a one-line summary, Edit and
    Clear per player, **Clear all**, and a picker to start on someone new.
  - **Player view:** buffs as Auto (shows the inferred value) / On / Off, talents as
    rank pickers showing the multiplier per rank, "changed" tags, Reset, and the
    player's threat at the cursor with and without their overrides.
  - Overridden modifiers are marked "(override)" in the tooltip and player info, and
    the player info bar links to the focused player's overrides.
- **Right-click menu** on a player: Focus, Show only, Hide/Show line, Pin, Override
  buffs and talents…, Clear overrides. Arrow keys move through it, Esc closes.

## Interaction model

| Input                      | Result                                                        |
| -------------------------- | ------------------------------------------------------------- |
| Hover chart                | Crosshair; tooltip only near a dot or over a fixate area      |
| Click a dot or line        | Focus that player (drives player info, highlights the line)   |
| Click empty chart space    | Set the cursor to t (snaps to the nearest visible event)      |
| Drag on chart              | 2D zoom. Time range drives totals; Y only magnifies           |
| Flat drag (< 12px tall)    | Time-only zoom                                                |
| Double-click chart         | Reset zoom                                                    |
| Space                      | Play/pause from the cursor (stops at the window's right edge) |
| ← / →                      | Step to the previous/next event (focused player, or visible)  |
| Roster row                 | Focus. Eye toggles visibility, pin icon pins                  |
| Double-click roster row    | Show only that player; double-click again to show everyone    |

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

`#/report/<code>?pull=&target=&players=&pinned=&focus=&t=&x=a_b&y=a_b&mode=rel&thr=1&buffs=0&emu=0&ov=`

- `ov` lists players joined by `,`, each `pid.item.item`: `salv0`/`salv1`, `tranq0`/
  `tranq1` force a buff; `t<index>r<rank>` sets a talent rank. Example:
  `ov=1.salv1.t0r2,8.salv0` = Brakka with Salvation and Defiance 2/5, Pyrelle without
  Salvation.

- `players` omitted means everyone visible. `focus=none` is an explicit "no focus".
- The analysis settings (`buffs`, `emu`, `ov`) are in the link. Display settings,
  theme and panel open/closed state are not; they're saved in the browser.

## Settings

- **Chart** (in the link): pull thresholds, with its <kbd>T</kbd> shortcut shown.
- **My display** (local): theme (system/light/dark), spell event dots, boss melee dots,
  resource change dots, fixate shading, rolling TPS window.
- **This analysis** (in the link): threat reduction emulation (Feign Death actually
  resets threat in the sim) and inferred Salvation, plus a button into the player
  overrides panel. Turning inference off makes DPS pull more often. The sim reruns.

## Mobile (< 760px)

The chart bar wraps, with the pull/target title on its own line. **Menu** opens the
rail from the left; the roster button opens the roster from the right. Chart and
Player info are tabs.

## Faked or simplified

- The threat sim is a toy: per-player spell rolls, 110/130% aggro checks, scripted
  tank swaps, taunt responses, deaths 2–4s after a pull, one fixate on Maulgar.
- Every report code loads the same raid. Sign-in is a toggle.
- Wowhead tooltips, loading/computing states, rate limits and private reports aren't drawn.

## Open questions to test with this

1. Should clicking a line also move the cursor? Today the two are separate.
2. Does the player info drawer steal too much chart height? Should it overlay instead?
3. Is "% of aggro holder" the right relative baseline, or "% of focused player"?
4. Should the window (zoom) TPS and the cursor threat be visually distinguished more
   clearly in the roster?
5. Should pets be grouped under their owner in the roster instead of ranked on
   their own?
6. Taunts, deaths and aggro losses no longer have their own markers (the event lane
   was removed). Is the tooltip on the dot enough, or do they need a distinct dot shape?
