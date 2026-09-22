# Mrs.Rank UP P1-RANK-05 Release Manifest

## Candidate identity

```text
BASE_MAIN_SHA = 37d52f829c7cf10317779557b6d7e00d99cb7236
FINAL_LOCAL_SHA = resolve from the final result packet (this manifest is part of that final commit and must not self-reference a guessed Git object)

SOURCE_COMMITS =
  9117004a4649eb35b43f134fca4078cd23f142e7  Operator Control Center
  a657d215c4d19f4c1db59e837abff15b7d81b5ef  Partner Login Email Management
  09c68811457fdbd051ef5a64963cf040705f5315  P1 Rank encoded-slug preservation

SOURCE_TO_INTEGRATED_SHA_MAP =
  9117004a4649eb35b43f134fca4078cd23f142e7 -> 9507aaec33c15ecc5eb9ac14442efa100b8904d1
  a657d215c4d19f4c1db59e837abff15b7d81b5ef -> 6466b2e875c4908ab649e2ae74b315ba5da69b5e
  09c68811457fdbd051ef5a64963cf040705f5315 -> 9632b53945386bb6039744e1c326fac5b5f1ade3
```

`a657d215` was inspected as the descendant of `9117004`; the two were applied in their original accepted order. `09c6881` is independently based directly on `BASE_MAIN_SHA`. No unrelated branch history was merged.

## Included scope

```text
P1_RANK04_FIX_INCLUDED = YES
OPERATOR_DASHBOARD_INCLUDED = YES
PARTNER_EMAIL_SETTINGS_INCLUDED = YES
```

- `P1_RANK04_FIX_INCLUDED`: the membership runner retains the exact, canonical percent-escape casing returned by WordPress. It rejects malformed/non-canonical input and continues to require exact workspace, shop ID, slug, and canonical URL binding.
- `OPERATOR_DASHBOARD_INCLUDED`: Basic-Auth `/dashboard` operator routes remain separate from Partner routes; the local UI has no Production WordPress or Supabase business write.
- `PARTNER_EMAIL_SETTINGS_INCLUDED`: the request path is protected by the authenticated Partner projection and the operator endpoint stays behind Basic Auth.

## Mrs.Rank UP readiness (read-only evidence)

```text
WP_SHOP_ID = 768
WORKSPACE = exactly one canonical workspace; masked identifier only in operational result packet
AUTH = exactly one matching Auth user; masked identifier only in operational result packet
MEMBERSHIP = exactly one active owner membership; foreign active memberships = 0
CURRENT_LIFECYCLE = normal_listing
REGISTRATION_SUBMISSION_COUNT = 0
CAMPAIGN_COUNT = 0

REGISTRATION_SUBMISSION_REQUIRED = YES
LIFECYCLE_CAMPAIGN_ATOMIC = YES
ACTIVATION_TARGET_STATE = free_official_partner
```

The current registration contract accepts a non-personal, authorized shop/operator contact label; it does not require an invented individual name. A later `P1-RANK-05A` operation must supply only confirmed registration values and remains a separate Production approval.

`api.review_partner_registration(...)` is the single atomic approval path: approved registration, lifecycle transition, state history, and the four defined campaign channels either complete together or roll back together. It cannot run before a valid registration submission exists.

## Vercel readiness (value-free readback)

```text
VERCEL_PROJECT = narikiyos-projects/escomi-headless
VERCEL_PRODUCTION_SUPABASE_URL = PRESENT_NONEMPTY
VERCEL_PRODUCTION_SERVICE_ROLE = PRESENT_NONEMPTY
VERCEL_PREVIEW_SUPABASE_URL = ABSENT
VERCEL_PREVIEW_SERVICE_ROLE = ABSENT
ENV_REDEPLOY_REQUIRED = NO
```

The checked staged-release workflow uses `--prod --skip-domain` and pulls the Production scope; it does not consume the Preview scope. Therefore the absent Preview values do not require an environment mutation or redeployment for this release candidate. The Production environment was read only; no value was printed, copied into source, or changed.

## Required gate sequence

1. `P1-RANK-05-A-MAIN-FAST-FORWARD-PUSH`: GitHub `main` only, after final ancestry and cleanliness readback. No Production data mutation, migration, or promotion.
2. `P1-RANK-05-C-STAGED-DEPLOYMENT-QA`: exact-SHA protected staged deployment and read-only QA using the verified Production scope. No environment mutation.
3. `P1-RANK-05A-REGISTRATION-SUBMISSION`: distinct approved registration write using confirmed facts only.
4. `P1-RANK-05B-LIFECYCLE-CAMPAIGN`: distinct approved call to the existing atomic lifecycle/campaign approval function.

No gate in this manifest authorizes a push, deployment, environment change, Auth change, WordPress write, registration, lifecycle change, campaign creation, review submission, moderation, or publication.
