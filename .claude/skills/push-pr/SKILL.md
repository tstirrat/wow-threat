---
name: push-pr
description: Commit and publish local git work as a GitHub pull request with branch safety checks, conventional commit messages, and PR metadata synchronization. Use when the user asks to push changes, create/update a PR, ensure work is on a feature branch, or refresh PR title/body and screenshots after branch drift.
user-invocable: true
model: claude-sonnet-4-6
effort: medium
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

```bash
git rev-parse --show-toplevel
git branch --show-current
git worktree list
```

Treat any branch other than `main` as a feature branch.
If on `main`, detached `HEAD`, or an unnamed branch, fetch `origin/main` and create a feature branch from that ref without checking out local `main`.
If in a worktree, use the current worktree branch from `git branch --show-current` as the source of truth.

## 2) Fetch Latest Main and Ensure Feature Branch

```bash
git fetch origin --prune
```

If already on a feature branch, keep it.

If on `main`, detached `HEAD`, or an unnamed branch, create a new feature branch from the latest `origin/main`:

```bash
git checkout -b claude/<short-task-slug> origin/main
```

## 3) Check Mainline Divergence and Back-Merge

Run the bundled divergence check script to measure drift and back-merge when needed:

```bash
bash .claude/skills/push-pr/scripts/check-divergence.sh
```

The script exits non-zero on merge conflict — resolve conflicts before continuing.
Override the threshold with `PUSH_PR_DIVERGENCE_THRESHOLD` (default: `1` commit).

## 4) Commit Local Changes

1. Inspect pending changes: `git status --short`.
2. Stage: `git add -A`.
3. Write a Conventional Commit message, e.g.:
   - `feat(web): add tank filter to threat chart`
   - `fix(api): handle missing fight actors`
   - `chore(config): align spell metadata`

### First Commit Rule

Detect whether this is the first commit on the branch:

```bash
git rev-list --count origin/main..HEAD
```

If the count is `0`, include a detailed body explaining what changed and why:

```bash
git commit -m "<type>(<scope>): <summary>" -m "<details and rationale>"
```

For subsequent commits, keep the message concise unless extra context helps reviewers.

## 5) Push and Create/Update PR

1. Verify auth: `gh auth status`.
2. Push with upstream tracking:

```bash
git push -u origin <branch>
```

3. Check for an existing PR:

```bash
gh pr view --json number,title,body,url,headRefName,baseRefName
```

4. **No PR exists** — create one:
   - Title in Conventional Commit format: `<type>(<scope>): <summary>`
   - Body based on `assets/pr-body-template.md`

```bash
gh pr create --title "<title>" --body-file <temp-body-file>
```

5. **PR exists** — push new commits and continue to drift check (step 6).

## 6) Handle Branch Drift

When branch intent changes (scope shifts, `fix` becomes `feat`, focus changes):

1. Recompute the best Conventional Commit title from the current diff.
2. Update title and description when they no longer match.

```bash
gh pr edit <number> --title "<new-title>" --body-file <temp-body-file>
```

Keep the body aligned to the template in `assets/pr-body-template.md`.

## 7) Add Visual Evidence for UI Changes

If changes are visually verifiable (UI/layout/styling/interaction), read
`references/visual-evidence.md` for the full screenshot-capture and upload
workflow, then insert the returned GitHub attachment URL into the PR `## Visuals`
section.

## Output Expectations

After running this skill the repository should be in this state:

1. Current branch is a non-`main` feature branch.
2. Branch is back-merged from `origin/main` when significant divergence is detected.
3. Local changes are committed with Conventional Commit messages.
4. Branch is pushed to origin.
5. PR exists and points to the current branch state.
6. PR title/body are up to date with branch intent.
7. Visual proof is attached in PR description when applicable, sourced from relevant `<repoRoot>/output/<page>.png` screenshots without committing image files.
