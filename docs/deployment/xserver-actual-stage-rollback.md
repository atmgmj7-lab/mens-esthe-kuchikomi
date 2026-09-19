# Xserver actual-stage rollback contract

This deployment binds rollback evidence to the exact `STAGE_DIR` produced by the current GitHub Actions run. It deliberately allows Next.js build IDs to vary between builds.

## Implementation plan

1. Build the Dashboard and prepare the public theme stage with the existing exclusions.
2. Generate `ACTUAL_DEPLOY_MANIFEST` from that stage. Each sorted row records SHA-256, byte size, and relative path. Symlinks and other non-regular staged entries fail closed.
3. Establish SSH connectivity and run the existing private coverage preactivation check.
4. Before the first theme upload, create a deployment-identity rollback bundle under the site's private rollback root outside `public_html`.
5. For every manifest path, copy the current regular remote file or record an explicit `ABSENT` assertion. Reject path traversal, duplicate paths, symlinks, hard links, unsupported target types, checksum drift, and count mismatch.
6. Validate bundle and snapshot checksums, then atomically rename the completed private staging bundle into its final deployment identity.
7. Only after capture succeeds, retain the existing dependency-first, staged-body, second-preflight, and `functions.php`-last deployment order.

## Failure boundary

Connectivity, preactivation, rollback capture, or rollback validation failure occurs before the first theme upload. Capture cleanup removes only the exact incomplete private staging directory and manifest for that deployment identity, so a failed preupload gate leaves the server filesystem as it was before the run. The exact deployment manifest is kept inside a successfully completed private bundle. Coverage recovery configuration and operational manifests remain excluded from the public stage and from this code rollback bundle. A static workflow concurrency group serializes Xserver production deployments without cancelling an active run.

## Separately authorized rollback

`scripts/xserver-rollback-from-snapshot.sh` requires the explicit `--execute-approved-rollback` token, exact deployment identity, and exact private bundle path. Before changing any file, it validates the bundle and verifies that every current target matches either the deployed state or its captured original/absence state, allowing safe recovery from a partial deploy. It restores previously existing dependencies first, restores `functions.php`, then removes only files explicitly recorded `ABSENT`. It preserves unlisted files and does not use `rsync --delete` or directory-wide target deletion.

This document authorizes no production rollback. A rollback remains a separate production operation requiring its own approval.
