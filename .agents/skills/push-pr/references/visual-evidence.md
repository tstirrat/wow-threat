# Visual Evidence for UI Changes

When changes are visually verifiable (UI/layout/styling/interaction), attach
screenshots to the PR so reviewers can see the result without running the app.

## Capture Screenshots

Use the page specs in `apps/web/src/pages/*.spec.ts`. Each spec includes a
`maybeCaptureScreenshot(page)` call that:

- Returns immediately unless `process.env.PLAYWRIGHT_SCREENSHOT` is set.
- Writes to `<repoRoot>/output/<page>.png` (e.g., `landing-page.png`,
  `report-page.png`, `fight-page.png`).

Ensure each spec uses appropriate mocks so the captured page is a valid state
for PR context.

Run the relevant page spec with screenshots enabled:

```bash
PLAYWRIGHT_SCREENSHOT=1 pnpm --filter @wow-threat/web exec playwright test src/pages/landing-page.spec.ts
```

## Upload and Get URL

Upload only the relevant screenshot(s) via the image uploader tool. The uploader
runs headless by default and only switches to headed mode when GitHub login is
required.

```bash
image_path="<repoRoot>/output/landing-page.png"
image_url="$(pnpm --filter @wow-threat/web upload:github-image -- "$image_path" | tail -n 1)"
echo "$image_url"
```

## Insert into PR Description

Replace the `## Visuals` placeholder with the returned
`https://github.com/user-attachments/assets/...` URL:

```markdown
## Visuals

![Updated threat chart](https://github.com/user-attachments/assets/<asset-id>)
```

Screenshot files in `output/` are gitignored and expected to be overwritten on
future runs — do not commit them.
