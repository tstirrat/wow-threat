#!/usr/bin/env bash
# Measures how far the current branch has drifted from origin/main and
# back-merges when divergence meets or exceeds PUSH_PR_DIVERGENCE_THRESHOLD.
# Exits non-zero if a merge conflict occurs.

set -euo pipefail

divergence="$(git rev-list --left-right --count origin/main...HEAD)"
behind="${divergence%% *}"
ahead="${divergence##* }"
echo "behind=$behind ahead=$ahead"

threshold="${PUSH_PR_DIVERGENCE_THRESHOLD:-1}"
if [ "$behind" -ge "$threshold" ]; then
  echo "Branch is $behind commit(s) behind origin/main (threshold=$threshold). Merging..."
  git merge --no-edit origin/main
else
  echo "Branch is current (behind=$behind, threshold=$threshold). No merge needed."
fi
