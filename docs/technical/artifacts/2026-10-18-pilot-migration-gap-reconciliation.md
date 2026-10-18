# Eskomi v1.1 — Mrs.Rank UP pilot migration-gap reconciliation (2026-10-18)

## Source and boundary

This is a redacted reconciliation of an authorized read-only production check.
It records no credentials, private UUIDs, or production data rows. It does not
authorize or perform a production migration, mapping, state change, or flag
change.

- The production migration ledger's final recorded version was
  `20261015182000`.
- The branch-local migration manifest is strictly timestamp-ordered and ends
  at `20261018100000_partner_login_email_canonical_audit.sql`.
- The selected pilot remains Mrs.Rank UP, WP Shop ID `768`; the public URL and
  other immutable identity fields are in the first-pilot minimum gate.

## Ordered migration delta after the production ledger

The operator must let the normal migration tool calculate and apply this exact
ordered suffix after it has re-read the ledger and validated file identity. No
file may be selected, skipped, reordered, or backfilled manually.

```text
20261017120000_eskomi_canonical_shop_foundation.sql
20261017121000_eskomi_review_entry_read_adapter.sql
20261017122000_eskomi_canonical_integrity_fixes.sql
20261017123000_eskomi_benefit_publication_independence.sql
20261017124000_eskomi_review_entry_acceptance_safety.sql
20261017130000_eskomi_v11_private_receipts_and_publications.sql
20261017131000_eskomi_v11_submission_vertical_slice.sql
20261017132000_eskomi_v11_fair_burst_risk_flags.sql
20261017133000_eskomi_v11_encrypted_replay_cache.sql
20261017134000_eskomi_v11_postgrest_parameter_names.sql
20261017135000_eskomi_v11_postgrest_read_parameter_names.sql
20261017140000_eskomi_review_entry_therapist_selection.sql
20261017141000_eskomi_review_entry_retired_therapist_fallback.sql
20261017142000_eskomi_partner_therapist_tools.sql
20261017143000_eskomi_v11_acceptance_hardening.sql
20261017144000_eskomi_partner_therapist_history_and_membership.sql
20261017145000_eskomi_partner_photo_membership_guard.sql
20261017146000_eskomi_moderation_and_membership_race_fix.sql
20261017147000_eskomi_v11_operations_and_receipts.sql
20261017148000_eskomi_v11_guest_edits_and_widget.sql
20261017149000_eskomi_v11_rpc_contract_and_upgrade_fix.sql
20261017150000_eskomi_corrections_and_community.sql
20261017151000_eskomi_review_target_and_redemption_hardening.sql
20261017152000_eskomi_community_ui_safety_and_review_projection.sql
20261017153000_eskomi_community_receipts_and_burst_controls.sql
20261017154000_eskomi_public_shop_detail_reviews.sql
20261017155000_eskomi_canonical_managed_directory_operations.sql
20261017156000_eskomi_v11_global_review_projection.sql
20261017157000_eskomi_canonical_partner_home_and_listing.sql
20261017158000_eskomi_canonical_primary_area_transition.sql
20261017159000_eskomi_canonical_partner_provisioning.sql
20261017160000_eskomi_partner_workspace_compatibility.sql
20261017161000_eskomi_partner_area_selection.sql
20261017162000_eskomi_partner_read_roles.sql
20261017163000_eskomi_canonical_partner_registration_review.sql
20261017164000_eskomi_legacy_workspace_mapping.sql
20261017165000_eskomi_community_reports_and_appeals.sql
20261017166000_eskomi_managed_reader_canonical_identity.sql
20261017167000_eskomi_community_hidden_post_appeals.sql
20261017168000_eskomi_community_queue_pagination.sql
20261017169000_eskomi_community_appeal_replay_order.sql
20261017170000_eskomi_public_therapist_profiles.sql
20261017171000_eskomi_public_profiles_access_and_community_guards.sql
20261017172000_eskomi_public_delivery_upgrade_hardening.sql
20261017173000_eskomi_access_measurement_integrity.sql
20261017174000_eskomi_access_context_abuse_and_report_integrity.sql
20261017175000_eskomi_access_context_named_rpc.sql
20261018100000_partner_login_email_canonical_audit.sql
```

## What the existing fixtures do and do not establish

| Evidence | Established | Does not establish |
| --- | --- | --- |
| Fresh SQL/HTTP fixtures | A disposable empty PostgreSQL instance can apply the whole ordered manifest and exercise the scoped canonical flows. | Upgrade compatibility with the actual `20261015182000` production schema/data. |
| `run-eskomi-v11-populated-upgrade-e2e.sh` | An additive upgrade from its representative populated fixture preserves the tested legacy/canonical records. | The current production ledger, its data shape, missing columns, or Mrs.Rank UP mapping. |
| Read-only production reconciliation | The ledger boundary and the pilot's current preconditions below. | Permission to change any production row or configuration. |

Accordingly, the first authorized migration window needs an additional,
disposable **`20261015182000`-baseline upgrade rehearsal**. It must start from
a sanitized schema/data snapshot that represents the production boundary,
apply the exact suffix above with the normal tool, and run the existing
read-only candidate and public-projection checks. The repository-only synthetic
rehearsal is now recorded in
[`2026-10-18-synthetic-20261015182000-rehearsal.md`](2026-10-18-synthetic-20261015182000-rehearsal.md);
it is evidence of the code path, not a production snapshot or approval.

## Mrs.Rank UP mapping readiness: current hard stops

The read-only reconciliation found these conditions, without retaining the
private identifiers in this repository:

1. The current production `private.managed_shops` schema has no `app_shop_id`
   column because the canonical migrations are not yet applied.
2. No existing managed-shop row exactly matches the known candidate identities
   for the legacy pilot set, including Mrs.Rank UP (WP 768). After migration,
   `api.list_legacy_partner_workspace_mapping_candidates_v11()` will therefore
   not be expected to return `mapping_status='ready'` for 768 until a separately
   approved managed canonical projection has been created and read back.
3. A canonical `app.shops` row for Mrs.Rank UP exists but is currently `draft`.
   Public v1.1 detail/widget readers require a published canonical shop; the
   v1.1 widget also requires a published managed-shop projection.
4. The existing partner workspace is `free_official_partner`, but remains a
   legacy identity until the exact canonical mapping succeeds. The Partner UI
   intentionally exposes settings only and withholds v1.1 review links,
   therapist tools, widget, and listing mutation while that condition holds.
5. The current `app.reviews` aggregate is zero. This is a useful baseline,
   but it is not evidence that the v1.1 public projection is complete: that
   model reads `app.review_experience_publications` and its matching canonical
   shop/managed publication state after the migration.

These are preparation gaps, not reasons to weaken the mapping validator or to
insert a name-based match. They make the previous one-row `ready` preflight a
hard stop until each prerequisite has an approved, auditable operational path.

## Required read-only gates after a future migration rehearsal

Before any separately approved pilot write, the release record must show:

1. the applied ledger is exactly the ordered suffix above, with no gap or
   checksum discrepancy;
2. the Mrs.Rank UP `app.shops` row, the newly created managed projection, and
   its status/slug/canonical path agree exactly with WP 768;
3. the candidate RPC returns exactly one `ready` row for WP 768 and the other
   two legacy candidates remain out of scope with no write;
4. the canonical shop and managed projection publication states satisfy the
   v1.1 widget/detail eligibility conditions; and
5. zero-count baselines are captured separately for legacy reviews,
   `app.reviews`, and the v1.1 public publication reader. This does not waive
   the full-reader comparison required before changing
   `ESKOMI_V11_PUBLIC_REVIEW_SOURCE`.

No production query, migration, projection creation, binding, publication, or
reader flag change is requested by these gates.
