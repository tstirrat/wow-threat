#!/usr/bin/env bash
# Resolve and set up a worktree/branch for a claimed task.
#
# Reads env vars: TASK_ID (required), TASK_TITLE (optional), BRANCH_NAME, WORKTREE_PATH
# Prints: branch_name=<resolved> and worktree_path=<resolved>
#
# Reuse policy:
# - If already inside a git worktree, stay in it and use its current branch.
# - Only create a new branch when the checkout is detached.
# - Only create a new worktree when not already inside one.
set -euo pipefail

task_id_slug="$(printf '%s' "${TASK_ID}" | tr '[:upper:]' '[:lower:]')"
title_slug="$(printf '%s' "${TASK_TITLE:-}" \
  | tr '[:upper:]' '[:lower:]' \
  | sed -E 's/[^a-z0-9]+/-/g; s/^-+|-+$//g; s/-+/-/g' \
  | cut -d- -f1-6)"
default_branch="claude/${task_id_slug}${title_slug:+-$title_slug}"

branch_name="${BRANCH_NAME:-$default_branch}"
worktree_path="${WORKTREE_PATH:-}"

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

  if [ -n "$worktree_path" ] && git -C "$worktree_path" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
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

printf 'branch_name=%s\n' "$branch_name"
printf 'worktree_path=%s\n' "$worktree_path"
