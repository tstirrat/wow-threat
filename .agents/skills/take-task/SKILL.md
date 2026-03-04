---
name: take-task
description: Select and execute the next ready task from TODO.md or todo.md by applying backlog priority rules, claiming the task via shared lease files in $CODEX_HOME (fallback ~/.codex), reusing the current worktree/branch when present (or creating task-linked branch/worktree when needed), implementing and validating the change, publishing with $push-pr, marking the task complete in the same PR, and setting up periodic PR comment triage with $gh-address-comments. Use when asked to take the next task or run backlog work end to end.
---

# Take Task

## Overview

Run an end-to-end task lifecycle from backlog selection to PR publication and review follow-up.
Use `scripts/todo_task.py` for deterministic task selection, shared task leases, and task status updates in `TODO.md`.

## Workflow

1. Identify and claim the next eligible task.
2. Reuse the current worktree/branch when available; otherwise create or switch to task-linked branch/worktree context.
3. Implement the task and pass task-scoped validation.
4. Archive the task as complete in `TODO.md` in the same PR.
5. Publish with `$push-pr` and ensure PR title includes the task ID in Conventional Commit format.
6. Start periodic PR comment checks via `$gh-address-comments`.

## 1) Claim The Next Task

From repo root, preview then claim:

```bash
python3 .agents/skills/take-task/scripts/todo_task.py next
```

The script enforces the backlog policy in `TODO.md` and skips tasks already leased by other agents:

- `status: READY`
- skip tasks with unmet `depends_on`
- sort by `priority` (`P0` > `P1` > `P2` > `P3`), then `size` (`XS` < `S` < `M` < `L`), then lexical `id`
- skip task IDs with active lease files in shared claims storage

Claim coordination storage:

- default root: `$CODEX_HOME/task-claims` (fallback: `~/.codex/task-claims`)
- one file per task: `<TASK-ID>.claim`
- file content: absolute worktree path for the claiming agent
- stale leases are auto-reaped when the stored worktree path no longer exists (or has no `.git`) and lease age exceeds 6 hours (`--stale-seconds` override)

Then claim exactly once and capture output fields for later steps:

```bash
claim_output="$(python3 .agents/skills/take-task/scripts/todo_task.py claim)"
printf '%s\n' "$claim_output"

task_id="$(printf '%s\n' "$claim_output" | awk -F= '/^id=/{print $2}')"
title="$(printf '%s\n' "$claim_output" | sed -n 's/^title=//p')"
branch_name="$(printf '%s\n' "$claim_output" | awk -F= '/^branch_name=/{print $2}')"
worktree_path="$(printf '%s\n' "$claim_output" | awk -F= '/^worktree_path=/{print $2}')"
claim_file="$(printf '%s\n' "$claim_output" | awk -F= '/^claim_file=/{print $2}')"
```

Optional manual stale-lease cleanup:

```bash
python3 .agents/skills/take-task/scripts/todo_task.py reap
```

Aggressive cleanup (no grace period):

```bash
python3 .agents/skills/take-task/scripts/todo_task.py --stale-seconds 0 reap
```

## 2) Reuse Current Worktree/Branch Or Create One

Default behavior:

- if current working directory is already inside a git worktree, keep using it
- if that worktree already has a checked-out branch, keep it as-is
- only create a new branch when the current checkout is detached; use a task-linked name
- only create a new worktree when not already inside one

Use a task-linked branch fallback (`task-id` + short description) only when creating a new branch:

```bash
task_id_slug="$(printf '%s' "$task_id" | tr '[:upper:]' '[:lower:]')"
title_slug="$(printf '%s' "$title" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+|-+$//g; s/-+/-/g' | cut -d- -f1-6)"
default_branch="codex/${task_id_slug}${title_slug:+-$title_slug}"
```

Create/switch:

```bash
git fetch origin --prune

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  worktree_path="$(git rev-parse --show-toplevel)"
  current_branch="$(git symbolic-ref --short -q HEAD || true)"

  if [ -n "$current_branch" ]; then
    branch_name="$current_branch"
  else
    case "$branch_name" in
      *"$task_id_slug"*) ;;
      *) branch_name="$default_branch" ;;
    esac
    git checkout -b "$branch_name"
  fi
else
  case "$branch_name" in
    *"$task_id_slug"*) ;;
    *) branch_name="$default_branch" ;;
  esac

  if git -C "$worktree_path" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    existing_branch="$(git -C "$worktree_path" symbolic-ref --short -q HEAD || true)"
    if [ -n "$existing_branch" ]; then
      branch_name="$existing_branch"
    else
      git -C "$worktree_path" checkout -b "$branch_name"
    fi
  else
    git worktree add "$worktree_path" -b "$branch_name" origin/main
  fi
fi
```

Run all coding, validation, and file updates inside `"$worktree_path"`.

## 3) Implement And Validate

1. Follow `AGENTS.md` and package-level guides.
2. Use the card `files_hint` as entrypoints.
3. Satisfy all `acceptance_criteria`.
4. Run every command listed under the card `validation` key.
5. Stop if any validation command fails.

## 4) Archive Completed Task In The Same PR

Before publishing, mark the task complete in `TODO.md`:

```bash
python3 .agents/skills/take-task/scripts/todo_task.py complete --id "$task_id" --status DONE
```

When status is `DONE`, this command:

- removes the task from `Task Index (Open)`
- removes the task from `Task Cards (Open)`
- appends the task ID to `Historical Completed IDs`

Lease files are intentionally retained until the worktree is removed; this prevents duplicate pickup from stale `TODO.md` copies in other worktrees.

## 5) Publish With Push-PR

Use `$push-pr` from the task worktree.

PR title format must remain Conventional Commits and include the task ID:

```text
<type>(<scope>): <TASK-ID> <summary>
```

Example:

```text
fix(engine): ENG-004 attribute Earth Shield threat to tank
```

If `$push-pr` creates/updates a PR title without the task ID, edit it immediately to match this format.

## 6) Start Periodic PR Comment Triage

After the PR exists:

1. Run `$gh-address-comments` once immediately.
2. Create a recurring automation to run every 4 hours on the task worktree with prompt intent:
   - check the current branch PR for unresolved comments
   - summarize actionable items
   - apply fixes only for user-approved threads

Suggested schedule:

```text
FREQ=HOURLY;INTERVAL=4
```

If automations are unavailable, rerun `$gh-address-comments` manually whenever the user asks to recheck PR feedback.

## Output Expectations

After completing this skill:

1. One eligible task is claimed and implemented.
2. Existing worktree/branch context is reused when present; new task-linked branch/worktree is only created when needed.
3. Validation commands for the chosen task pass.
4. `TODO.md` archives the task from open sections and records its ID under historical completed IDs.
5. Branch is published through `$push-pr` with task ID in PR title.
6. Periodic PR comment triage is configured or explicitly run.
