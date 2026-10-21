# v1.1 full-chain preflight evidence — 2026-10-21

This is a preparation record, not an authorization to apply production SQL.
It is pinned to Git commit `b942faa935f8fcf531617b9ccd0faa73a1439778`, which
is the verified remote head of `codex/cloudflare-workers-prep-20261018`.

## Production ledger boundary

Read-only management API inspection found the legacy/base migrations and the
already-applied `20261020020548_eskomi_supabase_primary_public_directory`.
The repository source `20261019090000_eskomi_supabase_primary_public_directory.sql`
must therefore **not** be replayed under a second version.

The ordered candidate packet contains 50 files: all 47 files from
`20261017120000` through `20261017175000`, then `20261018100000`,
`20261020030000`, and `20261021000000`.  The earlier 28-file description
ended at `20261017156000`; the additional 19 files are `17157000` through
`17175000`, and are required dependencies rather than optional add-ons.

## SHA-256 manifest

Calculated with `sha256sum` from the pinned repository worktree, in lexical
migration order. The deploy operator must recalculate these hashes from the
commit being applied before any DDL action.

```text
1e2906e7b0169d2897db87912833ef7f777454af7afe423a967c769ebd5cc0a2  20261017120000_eskomi_canonical_shop_foundation.sql
c4e0bd7442577b65117e09c448ed1bcff3351ff1abcc9f94308c6ef88eed9b2a  20261017121000_eskomi_review_entry_read_adapter.sql
3c479d403511644444343dc112c2777ac69d7cbd0444d26b24d891547278b789  20261017122000_eskomi_canonical_integrity_fixes.sql
5ee28968a6d8701c6067bd995462b588013056ff7478fa79b956b11789e8cb71  20261017123000_eskomi_benefit_publication_independence.sql
ecc3ba179e3e2d25bb77b54ef677b2ed431f09a991d0575fec7da16ce68d9703  20261017124000_eskomi_review_entry_acceptance_safety.sql
57bf70a6171e89c4e0e2718663237c2f4f95001f7ea20ca81a7bf20dc8be55ab  20261017130000_eskomi_v11_private_receipts_and_publications.sql
9a42282aacfdba212fd50086c022283c76065f9befd83e4eb8f9f4f8a39ddf55  20261017131000_eskomi_v11_submission_vertical_slice.sql
6aa7a13ae72fa1c904aed0494e63091a2ff4123971bd5de236a77c6250b1b827  20261017132000_eskomi_v11_fair_burst_risk_flags.sql
795952c486636cda61c157c41ff34c58919b68ef8d89ad7a4f46ce4b9c45ca23  20261017133000_eskomi_v11_encrypted_replay_cache.sql
dd00362d57e53cfde805c1565c2c5aae7ef9da71a4dd47edf77bb8d145c2e616  20261017134000_eskomi_v11_postgrest_parameter_names.sql
5b65ea383de6d1d4a60b72879ed8a55e14a193ea216a79aa49ef1920d50bea3a  20261017135000_eskomi_v11_postgrest_read_parameter_names.sql
9472caf62834ce7e9bd48053647fe8f0d75371c3b5ddc8301f779008b615888b  20261017140000_eskomi_review_entry_therapist_selection.sql
f8b6a31418aa1e9bcac770a3ca7941255c4b079fe72f95ba5618e5b5ae1987d3  20261017141000_eskomi_review_entry_retired_therapist_fallback.sql
a35bf7317d999e35959a92f66607e9caba21de709d1456bc506144f6a90a48eb  20261017142000_eskomi_partner_therapist_tools.sql
33ccc0d8da8f3fdbdea1ce68036c632cad3328a33c47b389b18f19d3d65c5b54  20261017143000_eskomi_v11_acceptance_hardening.sql
f11cf8b97e12872758e42897dac8e52589c0d85bdfdc10d6b1120e98de65281f  20261017144000_eskomi_partner_therapist_history_and_membership.sql
f41242ef3fe79188e4256e77ae5b9e01676cffe1411423bb399920ab6802f6de  20261017145000_eskomi_partner_photo_membership_guard.sql
4b51333970488a1837e19d2923cd170c6307fe72d1bcb745e71e9e8f69734a0f  20261017146000_eskomi_moderation_and_membership_race_fix.sql
8cbd3f41016329961871e23d98f974956a85aa7001fd2162694f54f8079b17d0  20261017147000_eskomi_v11_operations_and_receipts.sql
91877f85d3ebc4756f7f4e18f2a8d4ffa3293a8a291874d4a92dcff155fb6b4e  20261017148000_eskomi_v11_guest_edits_and_widget.sql
ccb5a4ff3282f95676e43d8527ad5aefbedb411ecb298d29c35bc8d98f01fdc6  20261017149000_eskomi_v11_rpc_contract_and_upgrade_fix.sql
912fa31aaff18e28c695f43199550034cbbd59bc57a15debd810234e2ed3498d  20261017150000_eskomi_corrections_and_community.sql
60481b9c98b5121835ddaa9aeb44ad5ff0fe4f08999310f06cf15b644c20e371  20261017151000_eskomi_review_target_and_redemption_hardening.sql
5e14ae52c991dc3c6ecedbae540199c5913d4fca3bd4ecf18a3bf16a2b49624a  20261017152000_eskomi_community_ui_safety_and_review_projection.sql
91640643717c46b07fbefa4ee89185a839976a8fab1b534dae73c5feb50f3b65  20261017153000_eskomi_community_receipts_and_burst_controls.sql
95c30eb40048b69c4ea70a8828b2dcf0092d9ad8dab90f4c306764cc470c12e2  20261017154000_eskomi_public_shop_detail_reviews.sql
1c7d841cf88a636cd2db6946424bd09423304a22b79ddba8f263100abc5d021e  20261017155000_eskomi_canonical_managed_directory_operations.sql
d9ecfafb62a977d63dd6334f3c049bf357255f022df0ac98b3ea361d9038fbd5  20261017156000_eskomi_v11_global_review_projection.sql
a2439224b7031b77cb5bb39c7bcbc8591c32d403222a940b83400d21eaa25615  20261017157000_eskomi_canonical_partner_home_and_listing.sql
e45925db146edf2282d5bdc2a90d354c8b8ba57657f9f511aa6ff255d7913d39  20261017158000_eskomi_canonical_primary_area_transition.sql
1b32232d0a5e8f7784c908731ccf284fb6358ebd967492b141baa5a7cd73cb9c  20261017159000_eskomi_canonical_partner_provisioning.sql
7ca1a354a28cb2c612c0600844090aa5b82ba3ce208a1ef2e7084b34cafb3c9a  20261017160000_eskomi_partner_workspace_compatibility.sql
925cafbdac5d25483260d099cea7159088a98b8e88e14bb6d2aa146476a3b13c  20261017161000_eskomi_partner_area_selection.sql
99ee2ddbfef1967cd3e83eaf9e0a0ea948b6f8bffc94b417670acfdb2721127f  20261017162000_eskomi_partner_read_roles.sql
bbce76f47cfbb3100cdcb37bd614018b7fa187c2c57cd01d984e526812d72af1  20261017163000_eskomi_canonical_partner_registration_review.sql
81b7924912003da5e867046754c9c226fa849257c0a2b85a8728ab4b70b8c586  20261017164000_eskomi_legacy_workspace_mapping.sql
060ac944cac3246ea1c4dfa4d03feb3fd603718ccea0a29e1559179d28e876d2  20261017165000_eskomi_community_reports_and_appeals.sql
4ff2e3b87624aa8b77acb34b31cee1527e52efcab9a0b468693486a84691cfcd  20261017166000_eskomi_managed_reader_canonical_identity.sql
cc9896b20507c52486e1244b6e64cae19af0d5d50b50074d878d37fc0e3df3a0  20261017167000_eskomi_community_hidden_post_appeals.sql
5026644776d69f4818980e013505e0da1267674d026187c94bde5df23e508650  20261017168000_eskomi_community_queue_pagination.sql
120a9418f1f368a73a0be27911829cb1f31ee66ab61acae8c6e6d18a38e56e2e  20261017169000_eskomi_community_appeal_replay_order.sql
19bdf7d95b560ddc310e9de8c7c445d607f941afb092f6e21143382e13f5c77e  20261017170000_eskomi_public_therapist_profiles.sql
01e924aa1853aa57201916d6d7da738c489f84ab713c2684299e1d07a4533992  20261017171000_eskomi_public_profiles_access_and_community_guards.sql
ba1c78f07ed7b10f4c820a761d8dfc122c0a365ac5f8308cb099991ce41bdfda  20261017172000_eskomi_public_delivery_upgrade_hardening.sql
cbf74c135c81d683a2907b36221baa06d982c9911c34eaebe22b248d653ed316  20261017173000_eskomi_access_measurement_integrity.sql
8524ef543a1318b224b33ddce0c75bc22f941e2dc9586a2029d8ceb7080b401e  20261017174000_eskomi_access_context_abuse_and_report_integrity.sql
29031eebc60d709a6975b76823761d4f3467c391faaa4bd9d1381176377dbee8  20261017175000_eskomi_access_context_named_rpc.sql
282156343e6cf5fe5cdc8e7ff040bc617236cad18a8c6955188b9381e37de7c9  20261018100000_partner_login_email_canonical_audit.sql
996d821af1cf6596ec0ff24a044f9a8d00ac2a4862ae63b95997d5fdc5cf539d  20261020030000_eskomi_public_review_read_rpc.sql
11c947be9326299e53e6dabb2c70ad738040f664cb1586cdf901c57a0d98f11f  20261021000000_eskomi_access_collection_manifest_health.sql
```

## The 19 migrations absent from the older 28-file scope

| Range | Function and data effect | ACL / backfill effect |
| --- | --- | --- |
| 17157000–17162000 | Canonical Partner home, listing editor, approved area move, provisioning, legacy-compatible membership, and owner/manager read roles. | RPCs are revoked from browser roles and granted to `service_role`; no broad table grant. |
| 17163000–17164000 | Canonical registration review; exact legacy workspace mapping. Adds `private.partner_workspace_legacy_aliases_v11`. | Mapping and review RPCs are service-role only; mapping requires explicit workspace, managed-shop, and `app.shops` UUIDs. |
| 17165000–17169000 | Community reports/appeals, hidden-post appeal guards, pagination, and replay ordering. Adds `private.community_post_reports_v11` and `private.community_post_appeals_v11`. | Service-role-only RPCs. No production business backfill; changes replay/appeal safety semantics. |
| 17170000–17171000 | Public therapist profiles plus aggregate Partner access reporting. Adds private access daily/rollup tables. | Browser roles receive no direct private-table access; transport RPCs are service-role only. |
| 17172000–17175000 | Therapist/access hardening: visibility checks, observation/dedupe, context limits, collection runs, HMAC issuance limits, and JSON parameter-name correction. | All new private tables use RLS with explicit revokes and service-role grants. `17172000` seeds observation records from existing rollup state and marks unverifiable legacy community appeals for review; `17173000` converts prior `observed` measurement rows to `missing` and emits legacy-appeal audit events. |

## Mapping and publication scope

Read-only preflight counts: 379 published and 3 draft `app.shops`; 34
published areas; 782 non-primary `app.shop_areas`; three legacy Partner
workspaces. All three workspace `wp_shop_id + shop_slug` pairs match an
existing `app.shops` row exactly. None currently matches a managed-shop
identity, so no mapping DML is authorized from this evidence.

The 379-directory migration and the three workspace mappings are separate
operations. Mapping needs an operator-reviewed manifest containing only the
exact workspace UUID, WP ID, slug, existing `app.shops` UUID, intended
managed-shop UUID, and an operator label. It must not use display-name or
similarity matching. The 3 drafts and any stopped/unlisted/deleted managed
records remain non-public.

## Validation and unresolved conditions

The full 51-source synthetic migration chain (including the already-applied
directory source for rehearsal only) passed with artificial data, as did the
non-target mapping rejection proof. This does not establish production backup
or restore capability.

The management API exposes no PITR or backup-retention proof. Before production
DDL, record the project dashboard's backup/PITR retention setting, latest
recoverable point, and the documented restore target/rollback owner. Do not
trigger a backup, restore, new project, or paid setting change from this packet.

Current production grants were read only. `app.shops` and `app.shop_areas`
report SELECT privilege for `anon` and `authenticated` while RLS is enabled;
that privilege alone does not prove row disclosure. Any revoke proposal needs
a separate Data API/RLS-policy and dependency audit, rather than being bundled
into this migration packet.
