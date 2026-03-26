---
name: take-task
description: Select and execute the next ready task from TODO.md by applying backlog priority rules, claiming the task, implementing and validating the change, publishing with /push-pr, and marking the task complete in the same PR. Use when asked to take the next task or run backlog work end to end.
user-invocable: true
model: claude-sonnet-4-6
effort: low
---

# Take Task

Run an end-to-end task lifecycle: backlog selection → claim → implement → validate → PR.

## Scripts

| Script                      | Purpose                                                   |
| --------------------------- | --------------------------------------------------------- |
| `scripts/todo_task.py`      | Task selection, claiming, and status updates in `TODO.md` |
| `scripts/setup_worktree.sh` | Resolve and set up the branch/worktree for a claimed task |

See `references/claim-system.md` for claim storage layout and task selection policy.

---

## 1) Claim The Next Task

Preview, then claim:

```bash
python3 .agents/skills/take-task/scripts/todo_task.py next
```

Claim and capture output fields:

```bash
claim_output="$(python3 .agents/skills/take-task/scripts/todo_task.py claim)"
printf '%s\n' "$claim_output"

task_id="$(printf '%s\n' "$claim_output" | awk -F= '/^id=/{print $2}')"
title="$(printf '%s\n' "$claim_output" | sed -n 's/^title=//p')"
branch_name="$(printf '%s\n' "$claim_output" | awk -F= '/^branch_name=/{print $2}')"
worktree_path="$(printf '%s\n' "$claim_output" | awk -F= '/^worktree_path=/{print $2}')"
claim_file="$(printf '%s\n' "$claim_output" | awk -F= '/^claim_file=/{print $2}')"
```

## 2) Set Up Worktree/Branch

Pass the claim fields to the setup script. It reuses the current worktree/branch when
available and only creates a new one when needed:

```bash
wt_output="$(TASK_ID="$task_id" TASK_TITLE="$title" BRANCH_NAME="$branch_name" \
  WORKTREE_PATH="$worktree_path" \
  bash .agents/skills/take-task/scripts/setup_worktree.sh)"

branch_name="$(printf '%s\n' "$wt_output" | awk -F= '/^branch_name=/{print $2}')"
worktree_path="$(printf '%s\n' "$wt_output" | awk -F= '/^worktree_path=/{print $2}')"
```

Run all coding, validation, and file updates inside `"$worktree_path"`.

## 3) Implement And Validate

1. Follow `CLAUDE.md` and package-level guides.
2. Use the card `files_hint` as entrypoints.
3. Satisfy all `acceptance_criteria`.
4. Run every command listed under the card `validation` key.
5. Stop if any validation command fails.

## 4) Archive Completed Task

Before publishing, mark the task complete in `TODO.md`:

```bash
python3 .agents/skills/take-task/scripts/todo_task.py complete --id "$task_id" --status DONE
```

When status is `DONE` this removes the task from `Task Index (Open)` and `Task Cards (Open)`,
and appends its ID to `Historical Completed IDs`. Lease files are retained until the
worktree is removed to prevent duplicate pickup from stale `TODO.md` copies.

## 5) Publish With Push-PR

Use `/push-pr` from the task worktree. PR title must be Conventional Commits with the task ID:

```
<type>(<scope>): <TASK-ID> <summary>
```

Example: `fix(engine): ENG-004 attribute Earth Shield threat to tank`

If `/push-pr` creates/updates a PR title without the task ID, edit it immediately.

## Output Expectations

1. One eligible task is claimed and implemented.
2. Existing worktree/branch context is reused when present.
3. All validation commands pass.
4. `TODO.md` archives the task and records its ID in historical completed IDs.
5. Branch is published via `/push-pr` with task ID in the PR title.
