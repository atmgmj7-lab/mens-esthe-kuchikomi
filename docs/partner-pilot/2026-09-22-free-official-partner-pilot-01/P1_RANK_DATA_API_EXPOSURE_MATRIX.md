# P1 Rank UP — Data API Exposure Matrix

## Purpose and boundary

This is the exact minimum wrapper set for the Mrs.Rank UP Pilot (`WP Shop ID 768`). It is a local release contract, not evidence that Production exposure has already changed. `P1-RANK-02` must configure only these wrappers and then read the settings and effective grants back.

The `api` schema is the only candidate Data API schema. `private` stays unexposed. Exposure makes the listed wrapper routable to the trusted server adapters; it does not grant a browser role access to an RPC.

| Boundary | Required state |
| --- | --- |
| private schema | `NOT EXPOSED` |
| anon | `DENY` |
| authenticated browser | `DENY` for privileged direct execution |
| service role | server-only, through a server adapter or controlled operator runner |
| `SUPABASE_SECRET_KEY` | canonical modern server-only secret; client exposure `0` |
| `SUPABASE_SERVICE_ROLE_KEY` | temporary legacy server-only fallback; client exposure `0` |

## Required wrapper set — 19

| API wrapper | Classification | P1 purpose | Required grant |
| --- | --- | --- | --- |
| `api.claim_shop_owner_request_rate_limit` | SERVICE_ONLY_REQUIRED | Rate-limit the existing controlled registration request route. | service role only |
| `api.provision_partner_workspace` | SERVICE_ONLY_REQUIRED | Provision or read back the canonical Workspace for WP Shop 768. | service role only |
| `api.register_partner_submission` | SERVICE_ONLY_REQUIRED | Persist a consent-bearing registration submission. | service role only |
| `api.grant_partner_membership` | SERVICE_ONLY_REQUIRED | Grant one canonical active membership through the non-browser P1-RANK-04 runner. | service role only |
| `api.get_partner_auth_membership` | SERVER_AUTH_REQUIRED | Resolve only the session-derived active membership on the server. | service role only |
| `api.get_partner_workspace_identity` | SERVER_AUTH_REQUIRED | Project only the matching canonical Partner identity on the server. | service role only |
| `api.list_partner_registration_reviews` | OPERATOR_ONLY | List existing registrations through the established Basic-Auth Operator route. | service role only |
| `api.review_partner_registration` | OPERATOR_ONLY | Perform the existing atomic approval/rejection transaction. | service role only |
| `api.open_partner_review_campaign` | SERVICE_ONLY_REQUIRED | Resolve an opaque token to its canonical active campaign and shop. | service role only |
| `api.record_partner_review_campaign_event` | SERVICE_ONLY_REQUIRED | Record only permitted campaign open/start attribution. | service role only |
| `api.get_partner_review_growth_metrics` | SERVER_AUTH_REQUIRED | Project aggregate growth metrics for the session-derived own workspace. | service role only |
| `api.get_partner_review_widget` | SERVICE_ONLY_REQUIRED | Resolve the active Website-CTA token to the safe public Widget projection. | service role only |
| `api.claim_review_submission_rate_limit` | SERVICE_ONLY_REQUIRED | Apply the server-side native-review rate-limit claim. | service role only |
| `api.submit_review_with_tags` | SERVICE_ONLY_REQUIRED | Submit the native review with stable immutable tag codes. | service role only |
| `api.list_review_moderation_queue` | OPERATOR_ONLY | Read the moderation queue in the existing Operator route. | service role only |
| `api.moderate_review` | OPERATOR_ONLY | Apply a human moderation decision. | service role only |
| `api.publish_review` | OPERATOR_ONLY | Apply a human publication decision after approval. | service role only |
| `api.list_published_reviews` | SERVICE_ONLY_REQUIRED | Supply the approved-only public-review / Widget adapter. | service role only |
| `api.get_published_review_metrics` | SERVICE_ONLY_REQUIRED | Supply approved aggregate metrics only. | service role only |

The classifications describe who may invoke the server-side operation. They do not create a direct browser RPC path: all 19 retain `service_role` execution only, while `anon` and ordinary `authenticated` stay denied.

## Explicitly not required for P1-RANK-02

These are not a reason to broaden exposure. They remain outside the single-shop Pilot operation unless a separately approved task gives them a bounded server-side use.

| Wrapper / group | Classification | Reason |
| --- | --- | --- |
| `record_partner_review_campaign_submission` | NOT_REQUIRED | Legacy WordPress conversion recording; P1 uses the native-review path. |
| `record_partner_review_campaign_review` | NOT_REQUIRED | Nested-only conversion helper; P1 uses the native-review path. |
| `submit_review` | NOT_REQUIRED | Superseded by `submit_review_with_tags`. |
| AI telemetry wrappers | NOT_REQUIRED | Existing AI telemetry is not an operational prerequisite for a single controlled Pilot review. |
| detailed moderation/audit readers | NOT_REQUIRED | Operator queue/detail boundaries remain deliberately narrow. |
| unrelated Partner or Shop-owner wrappers | NOT_REQUIRED | No multi-shop, role-administration, or unrelated shop operation is in scope. |

## P1-RANK-02 readback checklist

1. Confirm the configured API schema does not include `private`.
2. Confirm the available wrapper set equals the 19 required entries above — no more and no fewer.
3. For every listed signature, confirm `service_role` can execute and `anon` plus `authenticated` cannot.
4. Confirm no browser bundle, client environment variable, response, log, or screenshot contains `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY`.
5. Confirm API calls use only server-side adapters and retain session-derived workspace/shop checks.

Any mismatch is a P1-RANK-02 blocker. This document does not authorize a configuration change.
