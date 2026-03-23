# Claim System Reference

## Storage Layout

Claim coordination prevents multiple agents from picking up the same task.

- Default root: `$CLAUDE_HOME/task-claims` (fallback: `~/.claude/task-claims`)
- Scoped per repo: `<root>/<repo-slug>-<repo-hash>/`
- One file per task: `<TASK-ID>.claim`
- File content: absolute worktree path for the claiming agent

## Lease Lifecycle

1. `claim` writes the lease file atomically (O_CREAT | O_EXCL).
2. The lease stays active until the worktree directory is removed.
3. `todo_task.py` auto-reaps stale leases when the stored worktree path no longer
   exists (or has no `.git`) and the lease is older than 6 hours.

## Manual Lease Cleanup

```bash
# Reap leases older than 6 hours whose worktrees are gone
python3 .claude/skills/take-task/scripts/todo_task.py reap

# Aggressive: reap all orphaned leases regardless of age
python3 .claude/skills/take-task/scripts/todo_task.py --stale-seconds 0 reap
```

## Task Selection Policy

`todo_task.py next` and `claim` enforce this order:

1. `status: READY` only
2. Skip tasks with unmet `depends_on` (dependency IDs must be in historical DONE set)
3. Skip tasks with an active lease file
4. Sort: `priority` (P0 > P1 > P2 > P3), then `size` (XS < S < M < L), then lexical `id`
