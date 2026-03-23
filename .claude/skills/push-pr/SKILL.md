---
name: push-pr
description: Commit and publish local git work as a GitHub pull request with branch safety checks, conventional commit messages, and PR metadata synchronization. Use when the user asks to push changes, create/update a PR, ensure work is on a feature branch, or refresh PR title/body and screenshots after branch drift.
user-invocable: true
---

# Push PR

Prepare local changes, keep branch hygiene, and ensure the linked GitHub PR reflects the current diff.

## Workflow

1. Verify git context and branch/worktree state.
2. Fetch latest `origin/main` and ensure work is on a feature branch.
3. Check divergence from `origin/main` and back-merge when significantly behind.
4. Commit local changes with Conventional Commits.
5. Push branch and create or update the PR.
6. Refresh PR title/body when the branch intent has drifted.
7. Add visual proof for UI-visible changes.

## 1) Verify Context

Run:

```bash
git rev-parse --show-toplevel
git branch --show-current
git worktree list
```

Treat any branch other than `main` as a feature branch.
If on `main`, detached `HEAD`, or an unnamed branch, fetch `origin/main` and create a feature branch from that ref without checking out local `main`.
If in a worktree, still use the current worktree branch from `git branch --show-current` as the source of truth.

## 2) Fetch Latest Main and Ensure Feature Branch

Always fetch before continuing:

```bash
git fetch origin --prune
```

If already on a feature branch, keep it.

If on `main`, detached `HEAD`, or an unnamed branch, create a new feature branch from the latest `origin/main` (worktree-safe):

```bash
git checkout -b claude/<short-task-slug> origin/main
```

## 3) Check Mainline Divergence and Back-Merge

Measure how far the branch has drifted from latest `origin/main`:

```bash
divergence="$(git rev-list --left-right --count origin/main...HEAD)"
behind="${divergence%% *}"
ahead="${divergence##* }"
echo "behind=$behind ahead=$ahead"
```

Treat divergence as significant when `behind` is greater than or equal to `1` commit by default. You can override this threshold with `PUSH_PR_DIVERGENCE_THRESHOLD`.

```bash
threshold="${PUSH_PR_DIVERGENCE_THRESHOLD:-1}"
if [ "$behind" -ge "$threshold" ]; then
  git merge --no-edit origin/main
fi
```

If conflicts occur, resolve them before proceeding. The goal is to keep the PR branch reasonably current with `origin/main` when drift is high.

## 4) Commit Local Changes

1. Inspect pending changes: `git status --short`.
2. If there are changes, stage them: `git add -A`.
3. Create a Conventional Commit message, for example:
   - `feat(web): add tank filter to threat chart`
   - `fix(api): handle missing fight actors`
   - `chore(config): align spell metadata`

### First Commit Rule

If this is the first commit on the branch, include a descriptive body that explains what changed and why.
Detect first-commit state with:

```bash
git rev-list --count origin/main..HEAD
```

If the count is `0`, the next commit is the first branch commit and must include a detailed body.

Use:

```bash
git commit -m "<type>(<scope>): <summary>" -m "<details and rationale>"
```

For later commits, keep the message concise unless extra context is needed.

## 5) Push and Create/Update PR

1. Ensure `gh` auth works: `gh auth status`.
2. Push with upstream tracking when needed:

```bash
git push -u origin <branch>
```

3. Check for an existing PR for the branch:

```bash
gh pr view --json number,title,body,url,headRefName,baseRefName
```

4. If no PR exists, create one with:
   - Title in Conventional Commit format (`<type>(<scope>): <summary>`).
   - Body using this concise template:

```markdown
## Description

<what changed>

## Validation

- <test or check>

## Risks

- <known risk or `None`>

## Visuals

- <GitHub attachment URL or `N/A`>
```

Example:

```bash
gh pr create --title "feat(web): add tank filter to threat chart" --body-file <temp-body-file>
```

If a PR exists, push new commits and continue to drift checks.

## 6) Handle Branch Drift

When branch intent changes (for example a `fix` branch becomes a `feat`, scope changes, or implementation focus shifts):

1. Recompute the best Conventional Commit style PR title from the current diff.
2. Update PR title when it no longer matches.
3. Update PR description when it no longer reflects the current diff.
4. Keep PR description aligned to the concise template (`Description`, `Validation`, `Risks`, `Visuals`).

Use:

```bash
gh pr edit <number> --title "<new-title>" --body-file <temp-body-file>
```

## 7) Add Visual Evidence for UI Changes

If changes are visually verifiable (UI/layout/styling/interaction):

1. Use the page specs in `apps/web/src/pages/*.spec.ts` for screenshots.
2. Each page spec should include `maybeCaptureScreenshot(page)` that:
   - Returns immediately unless `process.env.PLAYWRIGHT_SCREENSHOT` is set.
   - Writes to `<repoRoot>/output/<page>.png` (`landing-page.png`, `report-page.png`, `fight-page.png`).
3. Ensure each page spec uses appropriate mocks so the captured page is a valid state for PR context.
4. Run the specific page spec with screenshots enabled, for example:

```bash
PLAYWRIGHT_SCREENSHOT=1 pnpm --filter @wow-threat/web exec playwright test src/pages/landing-page.spec.ts
```

5. Upload only the relevant `<repoRoot>/output/<page>.png` file(s) for the UI changes in this PR via the image uploader tool and capture each returned GitHub attachment URL:
   - The uploader runs headless by default and only switches to headed mode when GitHub login is required.

```bash
image_path="<repoRoot>/output/landing-page.png"
image_url="$(pnpm --filter @wow-threat/web upload:github-image -- "$image_path" | tail -n 1)"
echo "$image_url"
```

6. Insert the returned `https://github.com/user-attachments/assets/...` URL into PR `## Visuals` markdown.
7. Leave screenshot files in `output/`; this path is gitignored and images are expected to be overwritten on future runs.

Preferred markdown format:

```markdown
## Visuals

![Updated threat chart](https://github.com/user-attachments/assets/<asset-id>)
```

## Output Expectations

After running this skill, leave the repository in this state:

1. Current branch is a non-`main` feature branch.
2. Branch is back-merged from `origin/main` when significant divergence is detected.
3. Local changes are committed with Conventional Commit messages.
4. Branch is pushed to origin.
5. PR exists and points to the current branch state.
6. PR title/body are up to date with branch intent.
7. Visual proof is attached in PR description when applicable, sourced from relevant `<repoRoot>/output/<page>.png` screenshots without committing image files.
