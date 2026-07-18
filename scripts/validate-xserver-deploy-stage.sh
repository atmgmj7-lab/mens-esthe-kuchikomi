#!/usr/bin/env bash

set -euo pipefail

if [[ "$#" -ne 2 ]]; then
  echo "Usage: $0 STAGE_DIR PREDEPLOY_PHP_LIST" >&2
  exit 2
fi

STAGE_DIR="$1"
PREDEPLOY_PHP_LIST="$2"

if [[ ! -d "$STAGE_DIR" ]]; then
  echo "::error::Deployment stage directory is missing." >&2
  exit 1
fi
if [[ ! -f "$PREDEPLOY_PHP_LIST" ]]; then
  echo "::error::Predeploy PHP dependency list is missing." >&2
  exit 1
fi
if [[ -e "$STAGE_DIR/scripts" ]]; then
  echo "::error::Deployment stage contains forbidden scripts directory." >&2
  exit 1
fi

for required_path in functions.php style.css dashboard/index.html; do
  if [[ ! -f "$STAGE_DIR/$required_path" ]]; then
    echo "::error::Deployment stage is missing $required_path." >&2
    exit 1
  fi
done
if [[ ! -d "$STAGE_DIR/dashboard/_next" ]]; then
  echo "::error::Deployment stage is missing dashboard generated assets." >&2
  exit 1
fi

dependency_count=0
while IFS= read -r dependency || [[ -n "$dependency" ]]; do
  if [[ -z "$dependency" || "$dependency" == \#* ]]; then
    continue
  fi
  if [[ ! "$dependency" =~ ^[A-Za-z0-9._-]+\.php$ ]]; then
    echo "::error::Unsupported predeploy PHP dependency name." >&2
    exit 1
  fi
  dependency_count=$((dependency_count + 1))
  if [[ ! -f "$STAGE_DIR/$dependency" ]]; then
    echo "::error::Deployment stage is missing required PHP dependency: $dependency" >&2
    exit 1
  fi
done < "$PREDEPLOY_PHP_LIST"

if [[ "$dependency_count" -eq 0 ]]; then
  echo "::error::Predeploy PHP dependency list is empty." >&2
  exit 1
fi
