---
name: WOW Threat
description: A precision instrument for reading threat over time from Warcraft Logs combat data.
colors:
  arcane-cyan: 'oklch(0.61 0.11 222)'
  arcane-cyan-dark: 'oklch(0.71 0.13 215)'
  arcane-cyan-ink: 'oklch(0.98 0.02 201)'
  arcane-cyan-ink-dark: 'oklch(0.3 0.05 230)'
  scope-black: 'oklch(0.141 0.005 285.823)'
  phosphor-panel: 'oklch(0.21 0.006 285.885)'
  graphite-well: 'oklch(0.274 0.006 286.033)'
  trace-white: 'oklch(0.985 0 0)'
  paper: 'oklch(1 0 0)'
  bench-zinc: 'oklch(0.97 0.002 286)'
  zinc-mist: 'oklch(0.967 0.001 286.375)'
  graticule: 'oklch(0.92 0.004 286.32)'
  graticule-dark: 'oklch(1 0 0 / 10%)'
  field-stroke-dark: 'oklch(1 0 0 / 15%)'
  slate-label: 'oklch(0.53 0.016 286)'
  ash-label: 'oklch(0.705 0.015 286.067)'
  fault-red: 'oklch(0.577 0.245 27.325)'
  fault-red-dark: 'oklch(0.704 0.191 22.216)'
  class-warrior: '#C79C6E'
  class-paladin: '#F58CBA'
  class-hunter: '#ABD473'
  class-rogue: '#FFF569'
  class-shaman: '#0070DE'
  class-mage: '#69CCF0'
  class-warlock: '#9482C9'
  class-druid: '#FF7D0A'
  class-death-knight: '#C41F3B'
  class-monk: '#00FF98'
  class-demon-hunter: '#A330C9'
  class-evoker: '#33937F'
  class-unknown: '#94a3b8'
  class-warrior-light: '#9B6C41'
  class-paladin-light: '#C44884'
  class-hunter-light: '#608029'
  class-rogue-light: '#8E7318'
  class-shaman-light: '#0070DD'
  class-mage-light: '#08809C'
  class-warlock-light: '#7366D6'
  class-druid-light: '#CB4F00'
  class-death-knight-light: '#C41E3A'
  class-monk-light: '#00884F'
  class-demon-hunter-light: '#A330C9'
  class-evoker-light: '#00634C'
  mark-fixate: '#ffa500'
  mark-invulnerable: '#00ff00'
  mark-aggro-loss: '#ffff00'
  mark-death: '#dc2626'
  mark-boss-melee: '#ef4444'
  mark-totem: '#3b82f6'
  mark-playhead: '#facc15'
typography:
  headline:
    fontFamily: 'Inter Variable, sans-serif'
    fontSize: '1.125rem'
    fontWeight: 600
    lineHeight: 1.556
  title:
    fontFamily: 'Inter Variable, sans-serif'
    fontSize: '0.875rem'
    fontWeight: 500
    lineHeight: 1.429
  body:
    fontFamily: 'Inter Variable, sans-serif'
    fontSize: '0.75rem'
    fontWeight: 400
    lineHeight: 1.625
  body-strong:
    fontFamily: 'Inter Variable, sans-serif'
    fontSize: '0.75rem'
    fontWeight: 500
    lineHeight: 1.625
  eyebrow:
    fontFamily: 'Inter Variable, sans-serif'
    fontSize: '0.75rem'
    fontWeight: 600
    lineHeight: 1.333
    letterSpacing: '0.025em'
  label:
    fontFamily: 'Inter Variable, sans-serif'
    fontSize: '0.625rem'
    fontWeight: 500
    lineHeight: 1
    fontFeature: '"tnum"'
rounded:
  xs: '2px'
  sm: '3.2px'
  md: '5.2px'
  lg: '7.2px'
  xl: '11.2px'
  full: '9999px'
spacing:
  '0.5': '2px'
  '1': '4px'
  '1.5': '6px'
  '2': '8px'
  '3': '12px'
  '4': '16px'
  '5': '20px'
  '6': '24px'
components:
  button-primary:
    backgroundColor: '{colors.arcane-cyan}'
    textColor: '{colors.arcane-cyan-ink}'
    typography: '{typography.body-strong}'
    rounded: '{rounded.md}'
    padding: '0 8px'
    height: '28px'
  button-primary-dark:
    backgroundColor: '{colors.arcane-cyan-dark}'
    textColor: '{colors.arcane-cyan-ink-dark}'
    typography: '{typography.body-strong}'
    rounded: '{rounded.md}'
    padding: '0 8px'
    height: '28px'
  button-outline:
    backgroundColor: 'transparent'
    textColor: '{colors.scope-black}'
    typography: '{typography.body-strong}'
    rounded: '{rounded.md}'
    padding: '0 8px'
    height: '28px'
  button-ghost:
    backgroundColor: 'transparent'
    textColor: '{colors.scope-black}'
    typography: '{typography.body-strong}'
    rounded: '{rounded.md}'
    padding: '0 8px'
    height: '28px'
  button-ghost-hover:
    backgroundColor: '{colors.zinc-mist}'
    textColor: '{colors.scope-black}'
  button-icon-sm:
    rounded: '{rounded.md}'
    size: '24px'
  input:
    backgroundColor: 'transparent'
    textColor: '{colors.scope-black}'
    typography: '{typography.body}'
    rounded: '{rounded.md}'
    padding: '2px 8px'
    height: '28px'
  card-dark:
    backgroundColor: '{colors.phosphor-panel}'
    textColor: '{colors.trace-white}'
    typography: '{typography.body}'
    rounded: '{rounded.lg}'
    padding: '16px'
  badge:
    backgroundColor: '{colors.arcane-cyan}'
    textColor: '{colors.arcane-cyan-ink}'
    typography: '{typography.label}'
    rounded: '{rounded.full}'
    padding: '2px 8px'
    height: '20px'
  kbd:
    backgroundColor: '{colors.zinc-mist}'
    textColor: '{colors.slate-label}'
    typography: '{typography.label}'
    rounded: '{rounded.xs}'
    padding: '0 4px'
    height: '20px'
  threat-meter-row:
    typography: '{typography.label}'
    rounded: '{rounded.sm}'
    height: '20px'
---

# Design System: WOW Threat

## Overview

**Creative North Star: "The Combat Log Oscilloscope"**

WOW Threat is a measuring instrument, not a dashboard. The screen behaves like a scope: a dark, neutral field; a grid of faint lines; and bright traces running across it. Those traces are player threat lines drawn in WoW class colors, plus event markers for death, fixate, aggro loss and the playhead. All the chrome around them (header, selectors, legend, meter, controls) is zinc-grey and small, so the signal always comes first. The screen is judged by one thing: whether a tank, officer or theorycrafter can read "who had threat, when, and why" at a glance, then zoom in and trust the number.

The layout is dense on purpose. Controls are 28px tall, running text is 12px, and the meter and legend drop to 10px tabular labels so a 40-player raid fits beside a 560px chart without scrolling the page. Dark is the default theme because the product is often open next to WCL during a raid night and screen-shared over voice. Light mode must stay just as readable, especially for class colors.

Arcane Cyan is the single interface accent. It marks action and focus: the primary button, links, the focus ring and the landing-page hint. It never stands in for data. Data color belongs only to the class palette and the chart-mark set.

**Key Characteristics:**

- Neutral zinc chrome with one cool accent; all saturated color is data.
- Compact controls sized for a mouse and keyboard (28px buttons and inputs, 20px key badges).
- Surfaces are separated by tonal layers, not shadows.
- Inter Variable throughout, with tabular numbers wherever values line up in columns.
- Dark theme is the default, and every color decision is checked in both themes.

## Colors

Near-colorless zinc surfaces, one Arcane Cyan accent, and bright traces for the data: the WoW class palette and a fixed set of chart-mark meanings.

### Primary

- **Arcane Cyan** (`arcane-cyan` light / `arcane-cyan-dark` dark): the only interface accent. Used for primary buttons, links, the focus-adjacent hint gradient, badges and the landing arrow. On hover it drops to 80% opacity. Text on it uses **Arcane Cyan Ink** (`arcane-cyan-ink` light, `arcane-cyan-ink-dark` dark). The dark theme brightens the accent, and its ink flips to a deep navy.

### Neutral

- **Scope Black** (`scope-black`): the dark-theme page background and the light-theme text color.
- **Phosphor Panel** (`phosphor-panel`): dark-theme cards, popovers and the chart's tooltip background; one layer up from Scope Black.
- **Graphite Well** (`graphite-well`): dark-theme muted and secondary fills, including hover states, key badges and toggled rows.
- **Trace White** (`trace-white`): dark-theme text.
- **Bench Zinc** (`bench-zinc`): the light-theme page background. A faint cool grey that lets white cards lift off the page with no border.
- **Paper** (`paper`): light-theme cards, popovers and the header. The chart always sits on Paper, so class colors are drawn on the lightest possible background.
- **Zinc Mist** (`zinc-mist`): light-theme muted and secondary fills.
- **Graticule** (`graticule` light / `graticule-dark` dark): borders, dividers and chart axis and split lines. The chart draws its split lines at 40% of this value.
- **Field Stroke** (`field-stroke-dark`): dark-theme input stroke and input tint.
- **Slate Label / Ash Label** (`slate-label` light / `ash-label` dark): secondary text, captions, axis labels and the meter's value column. `slate-label` is tuned to stay at 4.5:1 or better on both Bench Zinc and Paper; don't lighten it. `ash-label` is also the light-theme focus ring color.
- **Fault Red** (`fault-red` / `fault-red-dark`): destructive actions and error alerts, always as a tint (10–20% fill) with the text in full Fault Red, never as a solid block.

### Data: Class Palette

Players are identified by WoW class colors, in two theme sets that share the same meaning:

- **Dark theme** (`class-*`): the official in-game colors, used exactly as the game ships them.
- **Light theme** (`class-*-light`): each official color darkened to about 4.5:1 against Paper, following the Warcraft Wiki light-skin set. The hue family stays recognizable (Rogue becomes mustard, Monk jade, Hunter olive, Mage teal). Shaman, Death Knight and Demon Hunter already pass on white and keep the same value.

Both sets are CSS variables (`--class-<name>`) defined per theme in `src/index.css`. Chart lines, legend swatches, meter bars and player names all use the same variable, so a name always matches its line. The canvas chart resolves the variables through the theme hook and re-resolves them whenever the theme changes. **Priest has no fixed value.** It renders in the current foreground color (near-white in dark mode, near-black in light mode). `class-unknown` is the fallback for unclassified actors and pets.

### Data: Chart Marks

Each mark has a fixed meaning. The exact values may be tuned for contrast in both themes:

- **Fixate** (`mark-fixate`, orange): a fixate or taunt window, drawn as a band with an orange leading edge and a translucent peach fill.
- **Invulnerable** (`mark-invulnerable`, green): a wash at roughly 14% opacity over periods of immunity.
- **Aggro loss** (`mark-aggro-loss`, yellow): segments where a player lost aggro.
- **Death** (`mark-death`, red): a vertical line where a player died.
- **Boss melee** (`mark-boss-melee`, red): boss melee hits shown in tooltips.
- **Totem** (`mark-totem`, blue): Tranquil Air Totem placement and removal.
- **Playhead** (`mark-playhead`, gold): the vertical line during playback, and the inset ring on the focused meter row.

### Named Rules

**The Trace Owns Color Rule.** Saturated color belongs to data: class colors and chart marks. Chrome stays zinc, and Arcane Cyan is the only exception. If a new UI element needs to catch the eye, give it weight or position, not a new hue.

**The Meanings Are Fixed Rule.** Orange means fixate, green means invulnerable, yellow means aggro loss, red means death, and gold means the playhead or focus. Values can change for contrast. Meanings never change, and a new mark type never reuses one of these hues.

**The Both-Themes Rule.** Every color is checked in dark and light mode. Class colors come in a per-theme pair; a class or mark color that disappears against one theme's background (as Rogue yellow and Priest white once did in light mode) is a bug.

**The Text Twin Rule.** Data colors are tuned for dark backgrounds. Any data color rendered as text in the DOM (tooltip amounts, spell schools, heal green, aura and marker labels, the summary table) goes through `src/lib/data-text-colors.ts` as a `light-dark()` pair. The light twin keeps the hue, darkened in OKLCH to about 4.6:1 on Paper. The canvas keeps the raw colors.

## Typography

**Display Font:** none (there is no display type)
**Body Font:** Inter Variable (with the system sans-serif as fallback), self-hosted via `@fontsource-variable/inter`

**Character:** A single neutral sans at small sizes, like the lettering on a bench instrument. Hierarchy comes from weight and color (medium vs. regular, foreground vs. muted), not from big jumps in size.

### Hierarchy

- **Headline** (600, 18px / 1.125rem): the app title in the header, and page-level states such as the error fallback and the sign-in completion page. The largest type in the product.
- **Title** (500, 14px / 0.875rem): card and section titles, and overlay headings (600 on overlays).
- **Body** (400, 12px / 0.75rem, line-height 1.625): the default running size for card content, descriptions, buttons, menus and inputs on desktop. Inputs step up to 14px below the `md` breakpoint.
- **Eyebrow** (600, 12px, letter-spacing 0.025em, UPPERCASE): group labels inside cards, such as "Starred" and "Recent".
- **Label** (500, 10px / 0.625rem, tabular numbers): threat meter rows, badges, key badges and dense legend metadata. 11px is also used for loading microcopy.

### Named Rules

**The Tabular Numbers Rule.** Any number that sits in a column or updates live (threat totals, percentages, timestamps, rate-limit counters) uses tabular numbers so the digits don't shift sideways.

**The No-Hero Rule.** Nothing is bigger than 18px. The chart is the hero, and type never competes with it.

## Layout

- **Container:** a single centered column with a 1280px maximum width, 16px side padding and 24px vertical padding. A sticky header sits above it with the report search, recent-report menu, theme toggle and account control.
- **Rhythm:** a 4px base grid. 8px (`gap-2`) is the default gap between controls, 4px (`gap-1`) inside groups, 12–20px between cards, and 16px inside cards.
- **Landing:** a dismissible hint above a three-column card grid from the `md` breakpoint up (recent logs, guild logs, personal logs); a single stack below it.
- **Fight page:** a 560px-tall chart next to the legend and threat meter panels, which are capped at 560px and scroll internally, so the page itself doesn't grow with raid size. The controls sit directly above the chart.
- **Breakpoints:** Tailwind defaults: `sm` 640px (card headers go from stacked to side-by-side), `md` 768px (grid columns; input text shrinks to 12px), `lg` 1024px.
- **Keyboard overlays:** the fight and target selectors, player search and shortcut help open as centered overlays, not new pages, so the URL state and chart stay in place underneath.

## Elevation & Depth

Depth comes from **tonal layering**. Each surface is one step away from the surface beneath it. Dark: Scope Black page → Phosphor Panel card → Graphite Well for hover, pressed and well states. Light: Bench Zinc page → Paper card → Zinc Mist for hover and well states. Shadows are reserved for elements that float above the page: popovers, dropdown menus, tooltips and overlays.

In light mode the step alone separates top-level cards from the page, with no ring. Two cases keep a 1px ring at 10% foreground opacity: cards in dark mode, where it defines the edge against the near-black page, and cards nested inside another card (the legend panel, empty-state boxes) in either theme, because Paper on Paper has no tonal step.

### Shadow Vocabulary

- **Floating** (`shadow-md`): dropdown menus, popovers and the command palette. The standard shadcn value; used only on layers that sit above the page.
- **Lifted** (`shadow-lg`): full overlays and dialogs.
- **Focus inset** (`box-shadow: inset 0 0 0 1px` Playhead gold): the focused threat meter row. This marks state, not depth.

### Named Rules

**The Flat Page Rule.** Anything that belongs to the page (cards, the chart, the legend, the meter) has no shadow. Only elements that float above the page get one.

**The One Step Rule.** A nested surface is exactly one tonal step away from its parent. Don't skip steps and don't stack three tints.

## Shapes

Small, even corners, like a machined tool. The base radius is 7.2px (0.45rem); every other step is calculated from it:

- **Cards and panels:** `lg` (7.2px).
- **Buttons, inputs and selects:** `md` (5.2px).
- **Threat meter bars and extra-small buttons:** `sm` (3.2px).
- **Key badges:** `xs` (2px).
- **Badges:** fully rounded pills, the only fully round shape.

Borders are 1px hairlines in Graticule. Legend swatches are short 2px horizontal strokes (20px wide) in the class color, so the swatch echoes the chart line instead of being a filled dot.

## Components

### Buttons

Compact and instrument-like. Small, tight, and quick to use with a mouse or keyboard.

- **Shape:** gently rounded (`md`, 5.2px), 28px tall, 8px horizontal padding, 12px medium text, icons at 14px.
- **Primary:** Arcane Cyan fill with Arcane Cyan Ink text. On hover the fill drops to 80%.
- **Outline:** a hairline Graticule border; in dark mode it has a faint 30% input tint and brightens on hover. This is the header's default control style (sign-in, account and recent-reports menus).
- **Ghost:** no border or fill; the Zinc Mist / Graphite Well fill appears on hover. Used for icon actions: dismiss, refresh and legend toggles.
- **Destructive:** a Fault Red tint (10% light, 20% dark) with Fault Red text.
- **Sizes:** `xs` 20px, `sm` 24px, default 28px, `lg` 32px; square icon versions at the same heights.
- **Focus:** the border changes to the ring color and a 2px ring appears at 30% opacity. Disabled buttons drop to 50% opacity and ignore the pointer.

### Inputs / Fields

- **Style:** 28px tall, `md` radius, a 1px input stroke, a 20% (light) or 30% (dark) input tint, and 8px horizontal padding.
- **Focus:** the same as buttons: ring-colored border plus a 2px ring at 30%.
- **Error:** a Fault Red border with a Fault Red ring at 20–40%.
- **Signature:** the report URL field in the header is the main entry point. ⌘/Ctrl+O focuses it, and a Search icon sits inside it.

### Cards / Containers

- **Corner style:** `lg` (7.2px).
- **Background:** Phosphor Panel (dark), Paper (light).
- **Separation:** tonal step against the page. The 10% ring appears only in dark mode and on cards nested inside a card. See Elevation & Depth.
- **Internal padding:** 16px (12px for the small size), 16px gaps between the header and content.
- **Section card:** a title and an optional muted subtitle on the left, with actions right-aligned in the header from the `sm` breakpoint up.

### Chips / Badges

- **Style:** 20px pills, 10px medium text, Arcane Cyan fill by default; secondary, outline (tinted and bordered) and destructive (tinted) versions follow the button colors.

### Key badges

- **Style:** 20px tall and at least 20px wide, `xs` radius, a Zinc Mist / Graphite Well fill, 10px muted label. Grouped with a literal "+" between keys. Shown wherever a shortcut exists, including inside tooltips, where the fill switches to an inverted translucent background.

### Navigation

- **Header:** full width and sticky, with the report search and a starred/recent-reports dropdown on the left, and the theme toggle and account dropdown on the right (`sm` outline buttons). The account menu shows WCL rate-limit usage in muted 12px text.
- **Fight and target switching:** keyboard-first overlays with fuzzy search (fight quick-switcher, fight selector, target selector). These are how people move around, and they replace tabbed navigation.

### Threat Chart (signature)

The oscilloscope itself: an ECharts canvas 560px tall.

- **Field:** a transparent background; axis lines in Graticule, split lines in Graticule at 40%, and axis labels in Slate / Ash Label.
- **Traces:** one line per player in their class color, 2px wide (3px on emphasis). Event points are circles scaled by threat size.
- **Overlays:** chart marks as defined in Colors: death and playhead as vertical mark lines, fixate and invulnerability as shaded bands, and aggro loss as recolored trace segments.
- **Tooltip:** a Phosphor Panel / Paper background, a Graticule border and foreground text; it shows the threat breakdown (multipliers, auras, split) behind each point.
- **Theme:** CSS variables are read at render time and the chart redraws when the theme changes, because canvas can't read CSS variables itself.

### Threat Meter (signature)

A live ranked list next to the chart. Each 20px row is a bar filled in the class color behind the player name (10px medium, left) and the value (10px tabular Slate / Ash Label, right). The focused row gets a 1px Playhead-gold inset ring. Filtered-out players fade to 40% opacity instead of disappearing, so the ranking stays stable. The list scrolls inside a card capped at 560px.

### Legend (signature)

A scrolling list of players, each with a 2px class-colored line swatch, their name in 12px medium and the Priest-aware class color. Clicking toggles a player; hidden players are dimmed. The header has the actions for selecting or clearing players in bulk.

## Do's and Don'ts

### Do:

- **Do** keep all chrome in zinc neutrals and save saturated color for class traces and chart marks (The Trace Owns Color Rule).
- **Do** use Arcane Cyan for exactly one kind of meaning: primary action and focus.
- **Do** separate surfaces with one tonal step. Use `bg-card` for panels.
- **Do** keep controls at the compact scale: 28px default, 24px `sm`, 12px text, 10px labels.
- **Do** use tabular numbers for every number shown in a column or updated live.
- **Do** check every new color in both dark (the default) and light themes, including Priest's foreground-based color.
- **Do** give any new data-colored text a light twin with `themedTextColor(light, dark)` (The Text Twin Rule); the spell-school test enforces AA contrast for schools.
- **Do** show a key badge next to any action that has a shortcut.
- **Do** keep the legend and meter capped at the chart's 560px height, with internal scrolling.

### Don't:

- **Don't** use color utilities that aren't defined in `src/index.css` `@theme` (the old `bg-panel` and `text-text` aliases are gone), and don't use `text-muted` for text: it resolves to the muted _fill_ color. Use `bg-card`, `text-foreground` and `text-muted-foreground`.
- **Don't** add a new hue for chrome, statuses or decoration; that competes with the traces.
- **Don't** reuse a chart-mark hue for a new meaning, or change what an existing mark means.
- **Don't** put shadows on page-level surfaces (cards, the chart, the legend, the meter).
- **Don't** add rings or borders to separate top-level surfaces in light mode; the Bench Zinc → Paper step does that. Nest a card inside a card only when the inner one needs its own edge.
- **Don't** set any type larger than 18px; the chart is the hero.
- **Don't** hardcode a class color or any theme-dependent color as a hex value. Use the `--class-*` variables, and resolve them through the chart theme hook for canvas.
