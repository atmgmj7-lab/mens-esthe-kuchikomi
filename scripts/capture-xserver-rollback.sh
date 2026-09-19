#!/usr/bin/env bash

set -euo pipefail
export LC_ALL=C
umask 077

fail() {
  echo "ROLLBACK_CAPTURE=FAIL $1" >&2
  exit 1
}

if [[ "$#" -ne 4 ]]; then
  fail "usage: capture-xserver-rollback.sh THEME_ROOT ROLLBACK_ROOT DEPLOYMENT_ID MANIFEST"
fi

THEME_ROOT="${1%/}"
ROLLBACK_ROOT="${2%/}"
DEPLOYMENT_ID="$3"
MANIFEST="$4"

EXPECTED_SUFFIX="/public_html/wp-content/themes/swell_child"
[[ "$THEME_ROOT" == *"$EXPECTED_SUFFIX" ]] || fail "theme root is not the approved child theme path"
SITE_ROOT="${THEME_ROOT%$EXPECTED_SUFFIX}"
[[ -n "$SITE_ROOT" && "$ROLLBACK_ROOT" == "$SITE_ROOT/private/deploy-rollbacks" ]] || fail "rollback root is not the approved private path"
[[ -d "$SITE_ROOT/private" && ! -L "$SITE_ROOT/private" ]] || fail "private root is unavailable"
[[ "$DEPLOYMENT_ID" =~ ^[0-9a-f]{40}-[1-9][0-9]*-[1-9][0-9]*$ ]] || fail "deployment identity is invalid"
[[ -d "$THEME_ROOT" && -f "$THEME_ROOT/style.css" ]] || fail "theme root is unavailable"
[[ -d "$ROLLBACK_ROOT" && ! -L "$ROLLBACK_ROOT" ]] || fail "rollback root is unavailable"
[[ -f "$MANIFEST" && ! -L "$MANIFEST" ]] || fail "actual deploy manifest is unavailable"
[[ "$MANIFEST" == "$ROLLBACK_ROOT/.actual-deploy-manifest-$DEPLOYMENT_ID.tsv" ]] || fail "manifest input path is invalid"

FINAL_DIR="$ROLLBACK_ROOT/$DEPLOYMENT_ID"
STAGING_DIR="$ROLLBACK_ROOT/.staging-$DEPLOYMENT_ID"
[[ ! -e "$FINAL_DIR" && ! -e "$STAGING_DIR" ]] || fail "deployment identity already exists"

cleanup() {
  rm -f "$MANIFEST"
}
trap cleanup EXIT

mkdir -m 700 "$STAGING_DIR"
mkdir -m 700 "$STAGING_DIR/files"
cp "$MANIFEST" "$STAGING_DIR/actual-deploy-manifest.tsv"
chmod 600 "$STAGING_DIR/actual-deploy-manifest.tsv"
: > "$STAGING_DIR/before-state.tsv"
: > "$STAGING_DIR/absent-paths.txt"

assert_safe_relative_path() {
  local relative="$1"
  [[ -n "$relative" && "$relative" != /* && "$relative" != ./* ]] || return 1
  [[ "$relative" != *$'\t'* && "$relative" != *$'\r'* && "$relative" != *$'\n'* ]] || return 1
  local component
  local -a components=()
  IFS='/' read -r -a components <<< "$relative"
  for component in "${components[@]}"; do
    [[ -n "$component" && "$component" != "." && "$component" != ".." ]] || return 1
  done
}

assert_no_symlink_parent() {
  local relative="$1"
  local current="$THEME_ROOT"
  local component
  local -a components=()
  IFS='/' read -r -a components <<< "$relative"
  for component in "${components[@]:0:${#components[@]}-1}"; do
    current="$current/$component"
    if [[ -L "$current" ]]; then
      return 1
    fi
    if [[ -e "$current" && ! -d "$current" ]]; then
      return 1
    fi
  done
}

previous_path=""
stage_count=0
existing_count=0
absent_count=0

while IFS=$'\t' read -r deploy_sha deploy_size relative extra || [[ -n "${deploy_sha}${deploy_size}${relative}${extra}" ]]; do
  [[ -z "$extra" ]] || fail "manifest row has extra columns"
  [[ "$deploy_sha" =~ ^[0-9a-f]{64}$ ]] || fail "manifest hash is invalid"
  [[ "$deploy_size" =~ ^(0|[1-9][0-9]*)$ ]] || fail "manifest size is invalid"
  assert_safe_relative_path "$relative" || fail "manifest path is unsafe"
  [[ -z "$previous_path" || "$previous_path" < "$relative" ]] || fail "manifest paths are not strictly sorted"
  assert_no_symlink_parent "$relative" || fail "remote path has an unsafe parent"
  previous_path="$relative"
  stage_count=$((stage_count + 1))

  target="$THEME_ROOT/$relative"
  if [[ -L "$target" ]]; then
    fail "remote target is a symlink"
  elif [[ -e "$target" ]]; then
    [[ -f "$target" ]] || fail "remote target is not a regular file"
    link_count="$(stat -c '%h' "$target" 2>/dev/null || stat -f '%l' "$target")"
    [[ "$link_count" == "1" ]] || fail "remote target has multiple hard links"
    snapshot="$STAGING_DIR/files/$relative"
    mkdir -p "$(dirname "$snapshot")"
    chmod 700 "$(dirname "$snapshot")"
    cp -p "$target" "$snapshot"
    chmod 600 "$snapshot"
    before_sha="$(sha256sum "$snapshot" | awk '{print $1}')"
    current_sha="$(sha256sum "$target" | awk '{print $1}')"
    [[ "$before_sha" == "$current_sha" ]] || fail "remote target changed during snapshot"
    before_size="$(stat -c '%s' "$snapshot" 2>/dev/null || stat -f '%z' "$snapshot")"
    current_size="$(stat -c '%s' "$target" 2>/dev/null || stat -f '%z' "$target")"
    [[ "$before_size" == "$current_size" ]] || fail "remote target size changed during snapshot"
    before_mode="$(stat -c '%a' "$target" 2>/dev/null || stat -f '%Lp' "$target")"
    printf 'EXISTS\t%s\t%s\t%s\t%s\t%s\t%s\n' \
      "$before_sha" "$before_size" "$before_mode" "$deploy_sha" "$deploy_size" "$relative" \
      >> "$STAGING_DIR/before-state.tsv"
    existing_count=$((existing_count + 1))
  else
    printf '%s\n' "$relative" >> "$STAGING_DIR/absent-paths.txt"
    printf 'ABSENT\t-\t0\t-\t%s\t%s\t%s\n' \
      "$deploy_sha" "$deploy_size" "$relative" >> "$STAGING_DIR/before-state.tsv"
    absent_count=$((absent_count + 1))
  fi
done < "$STAGING_DIR/actual-deploy-manifest.tsv"

[[ "$stage_count" -gt 0 ]] || fail "manifest is empty"
[[ "$stage_count" -eq $((existing_count + absent_count)) ]] || fail "snapshot coverage count mismatch"

cat > "$STAGING_DIR/deployment-identity.txt" <<EOF
deployment_id=$DEPLOYMENT_ID
theme_root=$THEME_ROOT
stage_path_count=$stage_count
snapshot_existing_count=$existing_count
snapshot_absent_count=$absent_count
EOF

(
  cd "$STAGING_DIR"
  find files -type f -print | LC_ALL=C sort | while IFS= read -r file; do
    sha256sum "$file"
  done > snapshot-files-sha256.txt
  sha256sum actual-deploy-manifest.tsv before-state.tsv absent-paths.txt \
    deployment-identity.txt snapshot-files-sha256.txt > bundle-sha256.txt
  sha256sum -c snapshot-files-sha256.txt >/dev/null
  sha256sum -c bundle-sha256.txt >/dev/null
)

find "$STAGING_DIR" -type d -exec chmod 700 {} +
find "$STAGING_DIR" -type f -exec chmod 600 {} +
mv "$STAGING_DIR" "$FINAL_DIR"
STAGING_DIR=""
trap - EXIT
rm -f "$MANIFEST"

echo "ROLLBACK_CAPTURE=PASS deployment=$DEPLOYMENT_ID stage=$stage_count existing=$existing_count absent=$absent_count"
