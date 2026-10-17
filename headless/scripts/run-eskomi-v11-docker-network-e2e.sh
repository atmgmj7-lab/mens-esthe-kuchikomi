#!/usr/bin/env bash
set -euo pipefail

# HTTP-only v1.1 lifecycle acceptance on the existing isolated Docker network.
# The delegated replay runner owns fixture creation and cleanup; API_ONLY avoids
# the separately documented Chromium/CDP environment limitation.
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ESKOMI_E2E_API_ONLY=1 exec "$repo_root/headless/scripts/run-eskomi-v11-replay-docker-http-e2e.sh"
