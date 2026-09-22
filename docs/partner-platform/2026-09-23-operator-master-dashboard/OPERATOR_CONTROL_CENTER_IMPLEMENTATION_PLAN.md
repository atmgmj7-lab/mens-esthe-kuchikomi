# Operator Control Center v1 — local implementation artifact

## Scope completed locally

- `/dashboard/shops/`: WordPress公開店舗の一覧と、Partner/Review/Campaignの安全な状態投影。
- `/dashboard/shops/new/`: 店舗追加の入力・検証UI。外部書込みはしない。
- `/dashboard/shops/[id]/`: canonical WordPress Shop ID単位の統合詳細。
- `/dashboard/shops/[id]/edit/`: 公開情報の編集intentと、可逆な掲載対象外intentの入力・検証UI。
- 既存 `DashboardShell` / Basic Auth / `/dashboard/` ナビゲーションを再利用。

## Source and service boundary

| Domain | Authority | This v1 reads | This v1 never writes or exposes |
| --- | --- | --- | --- |
| Public shop data | WordPress | existing `getAllShopsForListing` / `getShopById` | parallel Supabase Shop CMS, WordPress mutation |
| Partner state / campaigns | Supabase private via existing service-only API projection | registration projection, canonical workspace state, active channel state | workspace ID, campaign token, registration contact data |
| Review aggregate | Supabase Native Review via existing service-only growth metrics | submitted/pending/published counts | review body, reviewer identity, moderation authority |
| Membership | Supabase private | explicit `not_available` state only | membership row, user ID, email, role mutation |

The list uses the existing registration projection as evidence. A missing row is `not_observed`, never an assertion that a workspace does not exist. A WordPress ID, slug, canonical URL, or metrics mismatch returns `identity_mismatch` and omits operational data.

## WordPress Writer contract

`operator-shop-write-contract.ts` only validates a `create`, `update`, or `listing_exclusion` intent and always reports `WORDPRESS_WRITER_MAPPING_REQUIRED`.

The existing dedicated official-facts writer remains the only reusable writer foundation, but its current bounded field mapping does not establish support for full shop creation, general shop editing, publication changes, or exclusions. No production Writer may be connected until an explicit field mapping, pre-write readback, post-write readback, rollback plan, and separate Production WordPress write approval exist.

`listing_exclusion` is deliberately not a delete contract. Its future operation must preserve history, record one reason (`out_of_scope_industry`, `closed_confirmed`, `duplicate`, `identity_mismatch`, or `other`), and be reversible before public listing/area/sitemap effects are applied.

## Delivery slices and verification

| Slice | RED check | Implementation | Verification |
| --- | --- | --- | --- |
| OPR-01 list/detail projection | missing routes and projection contract | server-only WordPress + service-only Supabase projection | identity mismatch, no-observation, PII/token omission fixtures |
| OPR-02 create/edit/exclusion UI | forms unavailable | local-only intent validation and responsive forms | no fetch/write path; 390/1280 browser QA |
| OPR-03 navigation/security | no management nav | `DashboardNav` extension under existing `/dashboard/` boundary | Basic Auth 401 and noindex/no-store browser assertion |

## Explicitly excluded

- Production WordPress create/update/unpublish/delete.
- Production Supabase business-data writes, workspace provisioning, membership/Auth changes, Partner activation, or Campaign creation.
- Partner-route access to operator pages and operator access through Partner credentials.
- Mrs.Rank UP Production flow. `P1-RANK-02B` remains complete; `P1-RANK-03` remains the separately approved Workspace provisioning gate.

## Local release checks

- `npm run test:operator-shop-control-center`
- `npm run test:operator-shop-projection`
- `npm run qa:operator-shop-control-center`
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- full `npm test`, diff/secret scan, specification and quality/security review before local commit.
