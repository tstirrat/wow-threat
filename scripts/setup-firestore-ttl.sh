#!/usr/bin/env bash
# ---------------------------------------------------------
# Enable Firestore TTL on wcl_bridge_codes collection
# ---------------------------------------------------------
# Bridge codes are single-use OAuth tokens that expire after
# 5 minutes. This script configures Firestore to automatically
# delete expired documents using the 'expiresAtMs' field.
#
# Prerequisites:
#   - gcloud CLI installed and authenticated
#   - Firestore database created in the target project
#
# Usage:
#   ./scripts/setup-firestore-ttl.sh
#   FIREBASE_PROJECT_ID=my-project ./scripts/setup-firestore-ttl.sh
#
# This command is idempotent — safe to re-run.
# ---------------------------------------------------------
set -euo pipefail

PROJECT_ID="${FIREBASE_PROJECT_ID:-wow-threat}"

echo "Enabling Firestore TTL on wcl_bridge_codes.expiresAtMs for project: ${PROJECT_ID}"

gcloud firestore fields ttls update expiresAtMs \
  --collection-group=wcl_bridge_codes \
  --enable-ttl \
  --project="${PROJECT_ID}"

echo "Done. Firestore will automatically delete expired bridge codes."
