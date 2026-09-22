# P1 Consolidated Release Manifest

## Release identity

- `BASE_SHA = 093e4abdaf5f2d3ee0aecabc55c2feb26f1767db`
- `FINAL_LOCAL_SHA = recorded after this self-referential manifest commit in the result packet`
- `RELEASE_CONTENT_SHA_BEFORE_MANIFEST = df437febd0943cc80dbd860c24ff27b2f99a8d55`
- `BRANCH = codex/p1-queue-release-consolidation-01`

The final commit SHA cannot be written into its own Git object without changing
that object. The exact final local SHA is therefore read back and recorded in
the result packet after this manifest is committed.

## Source commits and safe transplant mapping

| Accepted local task | Source commit | Integrated commit | Scope |
| --- | --- | --- | --- |
| REVIEW-UX-JA-01 | `a965d0d22801d9f1ed50794df1f80f34610fd13e` | `d4814e97b726f3e4d50af8cb0200f1c8bace3be6` | Customer-facing Japanese review-tag labels and their focused contract. |
| OSAKA-AREA-UI-ROLLOUT-01 | `f9ce7bef3a385806e673a216cfaf2f4013795d6e` | `240d1f776a8c283fef735e4582fcee226c7f07ec` | Shared Area template/comparison-provider contract coverage. |
| ESKOMI-OPERATOR-CONTROL-CENTER-01 | `365fe4024690e727a3758d4f595491a028875f92` | `df437febd0943cc80dbd860c24ff27b2f99a8d55` | Operator Basic-Auth and Partner route separation contract coverage. |

Source ancestry was linear and clean:

```text
093e4ab → a965d0d → f9ce7be → 365fe40
093e4ab → d4814e9 → 240d1f7 → df437fe
```

No source-file overlap or semantic conflict was found. The REVIEW-UX-JA
transplant deliberately uses the current approved Japanese copy contract while
leaving internal tag codes and all submitted values unchanged.

## Included

- Partner Pilot local completion, GROWTH-01, GROWTH-02, and GROWTH-06 already
  present in the base.
- Approved Eskomi header logo and approved shop-image fallback already present
  in the base.
- Customer-facing Japanese review labels:
  `接客が丁寧`, `店内が清潔`, `予約がスムーズ`, `料金が分かりやすい`, `初めてでも利用しやすい`, `また利用したい`, `待ち時間が気になった`, `料金が分かりにくかった`, and `案内が分かりにくかった`.
- Shared Area template coverage for `shinosaka`, `sakai`, `umeda`,
  `nihonbashi`, `nanba`, and `sakaisujihonmachi`; no per-Area template was
  created.
- Existing Basic-Auth Operator Control Center boundary and strict separation
  from Partner routes.

## Explicitly excluded

- Production DB mutation, migration, or schema change.
- WordPress write, listing unpublish, or public-fact enrichment.
- Membership, Partner state, or campaign mutation.
- Invitation, outreach, real review, or Production moderation.
- Deploy, promotion, secret, and environment changes.
- A new authentication platform or any MEO feature.

## Validation record

- Focused review, submission, AI-assist, campaign/isolation, Area, Shop,
  Partner-auth, Operator-boundary, and moderation contracts: PASS.
- Repository `npm test` once: PASS.
- Typecheck, lint, and production build: PASS.
- `git diff --check`: PASS.
- Browser QA: PASS at 320px, 390px, and 1280px for the customer review form,
  six shared-template Area routes, public header, Partner isolation, and the
  Operator boundary.
- Shop detail asset browser regression: PASS (33 scenarios, 1,204 assertions,
  8 screenshots); real-image and approved-fallback variants both remain
  covered.
- The review form's only synthetic submit was intercepted locally before the
  API route; its payload retained `staff_polite` while customers saw Japanese
  labels only.
- Sensitive-pattern review: PASS. The only pattern-like values are static
  non-secret UUID fixtures in the Operator boundary test; no credential or
  real PII is present in the consolidated diff.

## Previous staged evidence

- `PREVIOUS_STAGED_DEPLOYMENT = dpl_GfUGCJcbAawjDX6yMkgsvKzf6Mpc`
- `PREVIOUS_STAGED_SHA = 093e4abdaf5f2d3ee0aecabc55c2feb26f1767db`
- `PREVIOUS_STAGED_STATUS = ACCEPTED_INTERMEDIATE / SUPERSEDED_PENDING_NEW_STAGE`

The previous deployment is retained and was neither promoted nor deleted.

## Prepared, not executed, production sequence

1. `P1-CONSOLIDATED-01-MAIN-FAST-FORWARD-PUSH`
2. `P1-CONSOLIDATED-02` exact final-SHA staged deployment
3. `P1-CONSOLIDATED-03` staged-to-Production promotion

Pilot-specific Auth/membership, lifecycle, campaign/assets, outreach, and real
review operations remain separately approved gates after release promotion.
