# Mrs.Rank UP Pilot — Technical Release Manifest

## Release identity

| Field | Value |
| --- | --- |
| TARGET | Mrs.Rank UP（ミセスランクアップ） |
| WP_SHOP_ID | `768` |
| BASE_MAIN_SHA | `c5408fa4aa99348b3560e7dd4ac41c2d3db9d20e` |
| FINAL_LOCAL_SHA | Recorded from the immutable final commit in the result packet; this file intentionally does not self-reference its own Git object ID. |
| BRANCH | `codex/mrs-rankup-pilot-technical-unblock-01` |
| PRODUCTION_CHANGE | `0` |

## Accepted source reconciliation

`origin/main` is the exact `c5408fa` baseline. The two accepted sources are direct descendants, so no rebase, merge, or blind cherry-pick was performed.

| Source commit | Source purpose | Integrated SHA | Reconciliation |
| --- | --- | --- | --- |
| `d4b0052c53d409f1ced1cc24acda109ab19ce56e` | P1 Rank technical unblock and approval-packet documentation | same commit | direct child of base |
| `91df70f5ccfcb848ac6fb4af1f49e86e3d917faf` | Server-only Auth / membership operator method and local migration | same commit | direct child of `d4b0052` |

## Migration review

| Field | Finding |
| --- | --- |
| MIGRATION_REQUIRED | `YES` |
| File | `supabase/migrations/20260922102917_partner_membership_operator.sql` |
| Why required | Existing schema has no canonical, service-only membership grant operation. The Pilot must not give a browser direct `private.partner_memberships` write path. |
| Scope | Adds only `private.grant_partner_membership(...)` and its `api.grant_partner_membership(...)` wrapper. It changes no table, enum, policy, trigger, public source, review payload, AI contract, or campaign shape. |
| Destructive DDL | `NO` — functions are created/replaced only. |
| Broad grants | `NO` — both signatures revoke `public`, `anon`, and `authenticated`; only `service_role` receives `EXECUTE`. |
| Private leakage | `NO` — `private` remains unexposed and no browser call is introduced. |
| Reapply behavior | Function DDL is `create or replace`; exact membership retries return `already_present`, while any distinct pre-existing binding fails closed. Migration history still prevents an ordinary second production application. |
| Production application | `NOT PERFORMED` |

### Recovery / reversal boundary

Before any successful P1-RANK-04 membership depends on it, an operator may revoke `service_role` execution and drop the two function signatures in reverse wrapper order. That is a separately approved Production operation and is not executed here. A newly created Auth user is compensating-deleted only when its immediately following membership grant fails; a pre-existing Auth user is never deleted. After a successful membership, lifecycle, campaign, review, or publication action, recovery is an explicit audited Operator decision — never an automatic delete, replay, or guessed reversal.

## Data API contract

| Field | Value |
| --- | --- |
| RPC_REQUIRED_COUNT | `19` |
| RPC_REQUIRED_LIST | [P1_RANK_DATA_API_EXPOSURE_MATRIX.md](P1_RANK_DATA_API_EXPOSURE_MATRIX.md) — exact ordered list |
| private schema | `NOT EXPOSED` |
| anon | `DENY` |
| authenticated browser | `DENY` for privileged direct execution |
| service role | server-only adapter / controlled runner only |
| Production exposure state | `NOT VERIFIED BY THIS LOCAL-ONLY TASK`; P1-RANK-02 requires configuration and readback |

## Method and identity contracts

| Field | Contract |
| --- | --- |
| WORKSPACE_METHOD | Existing `api.provision_partner_workspace(...)`, called only after server-side resolution of canonical WP Shop `768`; repeat is existing idempotent provision/readback behavior. |
| AUTH_METHOD | `headless/scripts/p1-rank-auth-membership-operator.mjs` lists exact Auth identities; missing identity fails unless `P1_RANK_CREATE_AUTH_USER=true` is explicitly set. It generates no password and emits masked readback only. |
| MEMBERSHIP_METHOD | `api.grant_partner_membership(...)` locks and verifies workspace ID, WP Shop ID, slug, canonical URL, role, and prior binding. Exact retry is idempotent; wrong workspace/shop or conflicting binding fails closed. |
| LIFECYCLE_CAMPAIGN_METHOD | Existing `api.review_partner_registration(...)` remains the one atomic P1-RANK-05 Operator decision: it approves/rejects registration, records state history, and on approval creates exactly one campaign for `counter_qr`, `line_after_visit`, `shop_website`, and `eskomi_shop_page`. |
| ASSET_IDENTITY_CHAIN | `WP 768 → matching workspace → active channel campaign → opaque token → /r/{token}/ → same canonical review form → QR / LINE / Website CTA / Widget`; no Production token or personalized URL is guessed. |

The atomically approved lifecycle is intentionally not split: it avoids a partial Partner state with missing campaign channels. Rejection creates no campaign. Successful campaign changes are recovered only through a separately approved, audited Operator workflow.

## Local evidence

The local dry run covers canonical workspace provision/repeat, Auth/membership exact match and explicit creation gate, wrong workspace/shop, duplicate/conflicting membership, Partner A/B isolation, anonymous and revoked-membership denial, Partner/Operator separation, atomic lifecycle/campaign, native review and moderation/publication visibility, invalid token, pending/rejected review non-public visibility, Widget/Dashboard projection, AI fallback regression, and client service-role exposure denial. Its fixtures are local/synthetic and create neither an Auth user nor any business data in Production.

## Production operation sequence

| Packet | Operation | State |
| --- | --- | --- |
| P1-RANK-01 | Initial outreach | `DONE — ALREADY_SENT`; never resend here |
| P1-RANK-02 | Minimum Data API exposure and migration/config readback | pending separate approval |
| P1-RANK-03 | Canonical Workspace provision/readback | pending separate approval |
| P1-RANK-04 | Auth + membership using the controlled runner | pending separate approval |
| P1-RANK-05 | Atomic lifecycle approval + four channel campaigns | pending separate approval |
| P1-RANK-06 | QR / URL / CTA / Widget identity readback | pending separate approval |
| P1-RANK-07 | One controlled real review | pending separate approval and reviewer consent |
| P1-RANK-08 | Human moderation / publication | pending separate approval |
| P1-RANK-09 | Widget and own-workspace Dashboard readback | pending separate approval |

SHOP_CONSENT = `PENDING`. Outreach having been sent is not proof of shop participation consent, so none of the pending Production operations is authorized by this release preparation.
