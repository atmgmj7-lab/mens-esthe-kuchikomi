# P1 Rank UP — technical unblock and approval packets

## Target lock

| Field | Locked value |
| --- | --- |
| Shop | Mrs.Rank UP（ミセスランクアップ） |
| WordPress Shop ID | `768` |
| Area | 大阪 > 新大阪 |
| Workspace at preflight | absent |
| Membership / campaign / native reviews | `0 / 0 / 0` |

Mrs.L'Amant, BAMBI SPA, and every other shop are excluded. The target is resolved by canonical WordPress identity, never a display name alone.

## A. Minimum Data API function exposure

The `api` schema remains the only API schema involved. `private` remains unexposed. The Production dashboard currently reports `0 of 47 functions exposed`; this is insufficient for the existing server-only adapters.

Enable only the following `api` wrappers, preserving the existing grants: `service_role` may execute; `anon` and `authenticated` remain denied. Exposure makes an RPC routable; it is not authorization to grant browser roles.

| API wrapper | Classification | P1 use |
| --- | --- | --- |
| `claim_shop_owner_request_rate_limit` | REQUIRED_SERVICE_ONLY | Store-registration rate limit. |
| `provision_partner_workspace` | REQUIRED_SERVICE_ONLY | Canonical Workspace initialization. |
| `register_partner_submission` | REQUIRED_SERVICE_ONLY | Store-controlled registration persistence. |
| `get_partner_auth_membership` | REQUIRED_SERVER_AUTH | Session-derived active membership lookup. |
| `get_partner_workspace_identity` | REQUIRED_SERVER_AUTH | Canonical Partner identity projection. |
| `list_partner_registration_reviews` | OPERATOR_ONLY | Existing Basic-Auth operator review list. |
| `review_partner_registration` | OPERATOR_ONLY | Atomic approval/rejection transaction. |
| `open_partner_review_campaign` | REQUIRED_SERVICE_ONLY | Token-to-canonical-shop resolution. |
| `record_partner_review_campaign_event` | REQUIRED_SERVICE_ONLY | Open/start attribution only. |
| `get_partner_review_growth_metrics` | REQUIRED_SERVER_AUTH | Own-workspace Partner metrics projection. |
| `get_partner_review_widget` | REQUIRED_SERVICE_ONLY | Public Widget eligibility projection. |
| `claim_review_submission_rate_limit` | REQUIRED_SERVICE_ONLY | Review submission rate limit. |
| `submit_review_with_tags` | REQUIRED_SERVICE_ONLY | Native review submission with immutable tags. |
| `list_review_moderation_queue` | OPERATOR_ONLY | Existing operator moderation queue. |
| `moderate_review` | OPERATOR_ONLY | Human moderation decision. |
| `publish_review` | OPERATOR_ONLY | Human publication decision. |
| `list_published_reviews` | REQUIRED_SERVICE_ONLY | Approved public-review / Widget adapter. |
| `get_published_review_metrics` | REQUIRED_SERVICE_ONLY | Approved aggregate / Widget adapter. |

Not required for this single-shop Pilot: the legacy WordPress conversion wrapper `record_partner_review_campaign_submission`, the nested-only `record_partner_review_campaign_review`, superseded `submit_review`, AI telemetry, detailed moderation/audit readers, and all unrelated Partner or Shop-owner functions.

No browser bundle may contain `SUPABASE_SERVICE_ROLE_KEY`; no browser role receives `EXECUTE`; no direct `private` table or schema access is introduced.

## B. Workspace, lifecycle, and campaign boundaries

`api.provision_partner_workspace(768, canonical_slug, canonical_name, canonical_url, source)` is the existing idempotent Workspace operation. It inserts or refreshes only the canonical identity and returns the existing or new workspace. Browser-selected IDs are not accepted as authority because the server resolves the canonical WordPress Shop first.

Store registration is the next existing boundary: `api.register_partner_submission(...)` saves the consent-bearing submission and transitions only `normal_listing -> shop_confirmed`.

`api.review_partner_registration(submission_id, approved, actor, reason)` is intentionally one atomic server-side transaction. On approval it:

1. marks the registration approved;
2. changes `shop_confirmed -> free_official_partner` with state history; and
3. creates exactly one campaign for each channel: `counter_qr`, `line_after_visit`, `shop_website`, and `eskomi_shop_page`.

Keep this as one P1-RANK-05 approval/write. Splitting it would create an untested partial state that violates the established one-campaign-per-channel invariant. Rejection changes only the registration status and creates no campaign.

## C. Asset identity chain

```text
WP Shop 768 canonical identity
  -> Workspace bound to the same ID / slug / canonical URL
  -> active channel-specific campaign
  -> opaque campaign token
  -> https://mens-esthe-kuchikomi.com/r/{token}/
  -> server-resolved /reviews/submit/?shop={same canonical slug}&campaign={same token}
```

- Counter QR is generated only from the read-back `counter_qr` token and encodes `/r/{token}/`.
- LINE copy uses the read-back `line_after_visit` URL.
- Website CTA uses the read-back `shop_website` URL.
- The Widget accepts only the active `shop_website` token and resolves its review URL through `get_partner_review_widget`.
- The Review form rejects any campaign whose resolved shop ID or normalized slug differs from the canonical prefill.

No token, QR payload, personalized URL, or Widget iframe is guessed or distributed before post-write readback.

## D. Local dry-run evidence

All fixtures are synthetic and are rolled back or cleaned locally. No Production Shop 768 row, Auth user, token, review, or contact data is used.

| Contract | Result |
| --- | --- |
| Workspace and store-registration transition | PASS — local Supabase contract |
| Partner A/B isolation, anonymous denial, revoked-membership denial | PASS — local source and SQL contracts |
| Atomic lifecycle + four campaigns | PASS — local Supabase contract |
| Cross-shop campaign attribution rejection | PASS — isolated native Review E2E |
| Review → moderation → publication → metrics → Widget | PASS — isolated native Review E2E at 390px and 1280px |
| Partner / Operator boundary | PASS — Partner session gate and separate Basic-Auth operator routes are source-contracted |

## E. Independent approval packets

| Packet | Exact operation | Preconditions / postcheck |
| --- | --- | --- |
| `P1-RANK-01` | Initial participation outreach | Confirm official shop contact and user approval immediately before sending. No DB write. |
| `P1-RANK-02` | Minimum Data API function exposure | Enable only the 18 listed `api` wrappers; read back `service_role=execute`, `anon/authenticated=deny`, and `private=unexposed`. |
| `P1-RANK-03` | Workspace provisioning | Read canonical WP Shop 768, call the existing provision wrapper once, and read back exact identity/state. |
| `P1-RANK-04` | Auth + membership | Use the controlled operation in `P1_RANK_AUTH_MEMBERSHIP_OPERATION.md`; this packet is not ready until an approved server-side Auth/membership operator method exists. |
| `P1-RANK-05` | Lifecycle + campaigns | Approve the existing atomic registration-review transaction as one operation; read back `free_official_partner` and four exact channels. |
| `P1-RANK-06` | Asset readback | Verify every asset against WP Shop 768, workspace, channel, and token; no external distribution before match. |
| `P1-RANK-07` | Controlled real review | Obtain reviewer consent, preserve negative-review acceptance, submit once, and confirm pending moderation. |
| `P1-RANK-08` | Moderation / publication | Authorized human decision only; verify approved public output and audit state. |
| `P1-RANK-09` | Widget / Dashboard verification | Verify own-workspace metrics and same-shop Widget reflection without PII or SEO changes. |

## Current stop

`P1-RANK-01` is the first external operation. `P1-RANK-02` is the first technical operation. Neither is executed by this task.

The remaining local blocker is the missing approved server-side Auth-user and membership-grant operator method. This is not solved by exposing `private`, granting browser roles, or creating a new client-side Auth flow.
