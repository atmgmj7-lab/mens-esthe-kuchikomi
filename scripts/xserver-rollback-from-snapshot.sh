#!/usr/bin/env bash

set -euo pipefail
export LC_ALL=C
umask 077

fail() {
  echo "ROLLBACK_EXECUTION=FAIL $1" >&2
  exit 1
}

if [[ "$#" -ne 5 || "$1" != "--execute-approved-rollback" ]]; then
  fail "separate approval token and exact arguments are required"
fi

THEME_ROOT="${2%/}"
ROLLBACK_ROOT="${3%/}"
DEPLOYMENT_ID="$4"
BUNDLE_DIR="${5%/}"
EXPECTED_SUFFIX="/public_html/wp-content/themes/swell_child"

[[ "$THEME_ROOT" == *"$EXPECTED_SUFFIX" ]] || fail "theme root is invalid"
SITE_ROOT="${THEME_ROOT%$EXPECTED_SUFFIX}"
[[ -n "$SITE_ROOT" && "$ROLLBACK_ROOT" == "$SITE_ROOT/private/deploy-rollbacks" ]] || fail "rollback root is invalid"
[[ -d "$SITE_ROOT/private" && ! -L "$SITE_ROOT/private" ]] || fail "private root is unavailable"
[[ -d "$ROLLBACK_ROOT" && ! -L "$ROLLBACK_ROOT" ]] || fail "rollback root is unavailable"
[[ "$DEPLOYMENT_ID" =~ ^[0-9a-f]{40}-[1-9][0-9]*-[1-9][0-9]*$ ]] || fail "deployment identity is invalid"
[[ "$BUNDLE_DIR" == "$ROLLBACK_ROOT/$DEPLOYMENT_ID" ]] || fail "rollback bundle identity is invalid"
[[ -d "$BUNDLE_DIR" && ! -L "$BUNDLE_DIR" ]] || fail "rollback bundle is unavailable"
[[ -d "$THEME_ROOT" && -f "$THEME_ROOT/style.css" ]] || fail "theme root is unavailable"

for required in actual-deploy-manifest.tsv before-state.tsv absent-paths.txt deployment-identity.txt snapshot-files-sha256.txt bundle-sha256.txt; do
  [[ -f "$BUNDLE_DIR/$required" && ! -L "$BUNDLE_DIR/$required" ]] || fail "rollback bundle is incomplete"
done

(
  cd "$BUNDLE_DIR"
  sha256sum -c bundle-sha256.txt >/dev/null
  sha256sum -c snapshot-files-sha256.txt >/dev/null
)
grep -Fxq "deployment_id=$DEPLOYMENT_ID" "$BUNDLE_DIR/deployment-identity.txt" || fail "deployment identity does not match"
grep -Fxq "theme_root=$THEME_ROOT" "$BUNDLE_DIR/deployment-identity.txt" || fail "theme root identity does not match"

STATES=()
BEFORE_SHA=()
BEFORE_MODE=()
DEPLOY_SHA=()
DEPLOY_SIZE=()
ROLLBACK_ACTION=()
paths=()

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

assert_no_bundle_symlink_parent() {
  local relative="$1"
  local current="$BUNDLE_DIR/files"
  local component
  local -a components=()
  IFS='/' read -r -a components <<< "$relative"
  for component in "${components[@]:0:${#components[@]}-1}"; do
    current="$current/$component"
    [[ -d "$current" && ! -L "$current" ]] || return 1
  done
}

while IFS=$'\t' read -r state before_sha before_size before_mode deploy_sha deploy_size relative extra || [[ -n "${state}${relative}${extra}" ]]; do
  [[ -z "$extra" ]] || fail "before-state row has extra columns"
  [[ "$state" == "EXISTS" || "$state" == "ABSENT" ]] || fail "before-state status is invalid"
  [[ "$deploy_sha" =~ ^[0-9a-f]{64}$ && "$deploy_size" =~ ^(0|[1-9][0-9]*)$ ]] || fail "deployed identity is invalid"
  assert_safe_relative_path "$relative" || fail "rollback path is unsafe"
  assert_no_symlink_parent "$relative" || fail "rollback path has an unsafe parent"
  for ((existing_index=0; existing_index<${#paths[@]}; existing_index++)); do
    existing_path="${paths[$existing_index]}"
    [[ "$existing_path" != "$relative" ]] || fail "rollback path is duplicated"
  done
  if [[ "$state" == "EXISTS" ]]; then
    [[ "$before_sha" =~ ^[0-9a-f]{64}$ && "$before_size" =~ ^(0|[1-9][0-9]*)$ && "$before_mode" =~ ^[0-7]{3,4}$ ]] || fail "existing snapshot metadata is invalid"
    assert_no_bundle_symlink_parent "$relative" || fail "snapshot path has an unsafe parent"
    [[ -f "$BUNDLE_DIR/files/$relative" && ! -L "$BUNDLE_DIR/files/$relative" ]] || fail "existing snapshot file is missing"
    snapshot_link_count="$(stat -c '%h' "$BUNDLE_DIR/files/$relative" 2>/dev/null || stat -f '%l' "$BUNDLE_DIR/files/$relative")"
    [[ "$snapshot_link_count" == "1" ]] || fail "snapshot file has multiple hard links"
    [[ "$(sha256sum "$BUNDLE_DIR/files/$relative" | awk '{print $1}')" == "$before_sha" ]] || fail "existing snapshot hash mismatch"
  else
    [[ "$before_sha" == "-" && "$before_size" == "0" && "$before_mode" == "-" ]] || fail "absence assertion is invalid"
  fi
  index="${#paths[@]}"
  STATES[$index]="$state"
  BEFORE_SHA[$index]="$before_sha"
  BEFORE_MODE[$index]="$before_mode"
  DEPLOY_SHA[$index]="$deploy_sha"
  DEPLOY_SIZE[$index]="$deploy_size"
  paths+=("$relative")
done < "$BUNDLE_DIR/before-state.tsv"

[[ "${#paths[@]}" -gt 0 ]] || fail "rollback bundle is empty"
manifest_count="$(wc -l < "$BUNDLE_DIR/actual-deploy-manifest.tsv" | tr -d ' ')"
[[ "$manifest_count" == "${#paths[@]}" ]] || fail "rollback coverage count mismatch"
cmp -s \
  <(cut -f1-3 "$BUNDLE_DIR/actual-deploy-manifest.tsv") \
  <(cut -f5-7 "$BUNDLE_DIR/before-state.tsv") \
  || fail "actual manifest and before-state do not match"
cmp -s \
  <(awk -F $'\t' '$1 == "ABSENT" { print $7 }' "$BUNDLE_DIR/before-state.tsv") \
  "$BUNDLE_DIR/absent-paths.txt" \
  || fail "absence assertions do not match before-state"
grep -Fxq "stage_path_count=${#paths[@]}" "$BUNDLE_DIR/deployment-identity.txt" || fail "stage count identity does not match"
snapshot_existing_count="$(awk -F $'\t' '$1 == "EXISTS" { count++ } END { print count + 0 }' "$BUNDLE_DIR/before-state.tsv")"
snapshot_absent_count="$(awk -F $'\t' '$1 == "ABSENT" { count++ } END { print count + 0 }' "$BUNDLE_DIR/before-state.tsv")"
grep -Fxq "snapshot_existing_count=$snapshot_existing_count" "$BUNDLE_DIR/deployment-identity.txt" || fail "existing snapshot count identity does not match"
grep -Fxq "snapshot_absent_count=$snapshot_absent_count" "$BUNDLE_DIR/deployment-identity.txt" || fail "absence count identity does not match"

# Validate the entire current state before changing any target. A safely
# interrupted deployment may contain a mix of deployed and original states.
for ((index=0; index<${#paths[@]}; index++)); do
  relative="${paths[$index]}"
  target="$THEME_ROOT/$relative"
  if [[ "${STATES[$index]}" == "EXISTS" ]]; then
    [[ -f "$target" && ! -L "$target" ]] || fail "current target is unavailable"
    link_count="$(stat -c '%h' "$target" 2>/dev/null || stat -f '%l' "$target")"
    [[ "$link_count" == "1" ]] || fail "current target has multiple hard links"
    current_sha="$(sha256sum "$target" | awk '{print $1}')"
    current_size="$(stat -c '%s' "$target" 2>/dev/null || stat -f '%z' "$target")"
    if [[ "$current_sha" == "${DEPLOY_SHA[$index]}" && "$current_size" == "${DEPLOY_SIZE[$index]}" ]]; then
      ROLLBACK_ACTION[$index]="RESTORE"
    elif [[ "$current_sha" == "${BEFORE_SHA[$index]}" ]]; then
      ROLLBACK_ACTION[$index]="NOOP"
    else
      fail "current target does not match deployed or original state"
    fi
  elif [[ ! -e "$target" && ! -L "$target" ]]; then
    ROLLBACK_ACTION[$index]="NOOP"
  elif [[ -f "$target" && ! -L "$target" ]]; then
    link_count="$(stat -c '%h' "$target" 2>/dev/null || stat -f '%l' "$target")"
    [[ "$link_count" == "1" ]] || fail "current target has multiple hard links"
    current_sha="$(sha256sum "$target" | awk '{print $1}')"
    current_size="$(stat -c '%s' "$target" 2>/dev/null || stat -f '%z' "$target")"
    [[ "$current_sha" == "${DEPLOY_SHA[$index]}" && "$current_size" == "${DEPLOY_SIZE[$index]}" ]] || fail "created target does not match deployed state"
    ROLLBACK_ACTION[$index]="REMOVE"
  else
    fail "created target has an unsupported current state"
  fi
done

restore_existing_one() {
  local index="$1"
  local relative="${paths[$index]}"
  local target="$THEME_ROOT/$relative"
  if [[ "${ROLLBACK_ACTION[$index]}" == "NOOP" ]]; then
    return
  fi
  [[ "${ROLLBACK_ACTION[$index]}" == "RESTORE" ]] || return 0
  [[ -f "$target" && ! -L "$target" ]] || fail "target changed during rollback"
  [[ "$(sha256sum "$target" | awk '{print $1}')" == "${DEPLOY_SHA[$index]}" ]] || fail "target changed during rollback"
  local temporary="$target.escomi-rollback-$DEPLOYMENT_ID"
  [[ ! -e "$temporary" ]] || fail "rollback temporary path already exists"
  cp "$BUNDLE_DIR/files/$relative" "$temporary"
  chmod "${BEFORE_MODE[$index]}" "$temporary"
  mv "$temporary" "$target"
}

remove_created_one() {
  local index="$1"
  local relative="${paths[$index]}"
  local target="$THEME_ROOT/$relative"
  [[ "${ROLLBACK_ACTION[$index]}" == "REMOVE" ]] || return 0
  [[ -f "$target" && ! -L "$target" ]] || fail "target changed during rollback"
  [[ "$(sha256sum "$target" | awk '{print $1}')" == "${DEPLOY_SHA[$index]}" ]] || fail "target changed during rollback"
  rm "$target"
}

functions_index=""
# Restore old dependencies and other pre-existing files first.
for ((index=0; index<${#paths[@]}; index++)); do
  relative="${paths[$index]}"
  [[ "$relative" == "functions.php" ]] && continue
  restore_existing_one "$index"
done
# Restore the previous functions.php only after its old dependencies are ready.
for ((index=0; index<${#paths[@]}; index++)); do
  if [[ "${paths[$index]}" == "functions.php" ]]; then
    functions_index="$index"
    break
  fi
done
if [[ -n "$functions_index" ]]; then
  restore_existing_one "$functions_index"
fi
# Only the old functions.php is now active; remove files recorded ABSENT before.
for ((index=0; index<${#paths[@]}; index++)); do
  remove_created_one "$index"
done

for ((index=0; index<${#paths[@]}; index++)); do
  relative="${paths[$index]}"
  target="$THEME_ROOT/$relative"
  if [[ "${STATES[$index]}" == "EXISTS" ]]; then
    [[ -f "$target" && "$(sha256sum "$target" | awk '{print $1}')" == "${BEFORE_SHA[$index]}" ]] || fail "restored file verification failed"
  else
    [[ ! -e "$target" && ! -L "$target" ]] || fail "created file removal verification failed"
  fi
done

echo "ROLLBACK_EXECUTION=PASS deployment=$DEPLOYMENT_ID files=${#paths[@]}"
