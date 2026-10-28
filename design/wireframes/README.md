# Wireframes

Low-fidelity, self-contained UX prototypes for the WOW Threat web app. They exist to
test layout and interaction ideas before anything changes in `apps/web`.

## Rules

- **One folder per variant**: `v1-chart-first/`, `v2-<idea>/`, and so on. Leave
  earlier variants alone so they can be compared. Copy a folder to branch an idea.
- **Self-contained**: plain HTML, CSS and JS. No build step, no dependencies, no
  frameworks, no imports from anywhere else in the repo. Open `index.html` directly
  in a browser.
- **Greybox only**: system font, greys, 1px rules. Colour only where it carries data
  (class colours on player lines). The visual style is decided later.
- **Fake data**: each variant generates its own fake report. Numbers only need to be
  plausible enough to exercise the interactions.
- **Notes live with the variant**: each folder has a `NOTES.md` with the brief, the
  interaction model, what is faked, and open questions. Put analysis or critique of a
  variant in that folder too (for example `CRITIQUE.md`).

This folder is outside the pnpm workspace, so turbo, lint, typecheck and tests ignore it.

## Variants

| Folder            | Idea                                                                                                      |
| ----------------- | --------------------------------------------------------------------------------------------------------- |
| `v1-chart-first/` | Full-window, chart-first layout: report rail, roster/inspector dock, aggro ribbon, spell breakdown drawer |
