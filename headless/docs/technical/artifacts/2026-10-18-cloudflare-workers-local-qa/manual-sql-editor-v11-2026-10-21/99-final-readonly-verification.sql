-- Read-only final verification for the manual Eskomi v1.1 SQL Editor packet.
with expected(version, name, source_sha256) as (values
  ('20261017120000', 'eskomi_canonical_shop_foundation', '1e2906e7b0169d2897db87912833ef7f777454af7afe423a967c769ebd5cc0a2'),
      ('20261017121000', 'eskomi_review_entry_read_adapter', 'c4e0bd7442577b65117e09c448ed1bcff3351ff1abcc9f94308c6ef88eed9b2a'),
      ('20261017122000', 'eskomi_canonical_integrity_fixes', '3c479d403511644444343dc112c2777ac69d7cbd0444d26b24d891547278b789'),
      ('20261017123000', 'eskomi_benefit_publication_independence', '5ee28968a6d8701c6067bd995462b588013056ff7478fa79b956b11789e8cb71'),
      ('20261017124000', 'eskomi_review_entry_acceptance_safety', 'ecc3ba179e3e2d25bb77b54ef677b2ed431f09a991d0575fec7da16ce68d9703'),
      ('20261017130000', 'eskomi_v11_private_receipts_and_publications', '57bf70a6171e89c4e0e2718663237c2f4f95001f7ea20ca81a7bf20dc8be55ab'),
      ('20261017131000', 'eskomi_v11_submission_vertical_slice', '9a42282aacfdba212fd50086c022283c76065f9befd83e4eb8f9f4f8a39ddf55'),
      ('20261017132000', 'eskomi_v11_fair_burst_risk_flags', '6aa7a13ae72fa1c904aed0494e63091a2ff4123971bd5de236a77c6250b1b827'),
      ('20261017133000', 'eskomi_v11_encrypted_replay_cache', '795952c486636cda61c157c41ff34c58919b68ef8d89ad7a4f46ce4b9c45ca23'),
      ('20261017134000', 'eskomi_v11_postgrest_parameter_names', 'dd00362d57e53cfde805c1565c2c5aae7ef9da71a4dd47edf77bb8d145c2e616'),
      ('20261017135000', 'eskomi_v11_postgrest_read_parameter_names', '5b65ea383de6d1d4a60b72879ed8a55e14a193ea216a79aa49ef1920d50bea3a'),
      ('20261017140000', 'eskomi_review_entry_therapist_selection', '9472caf62834ce7e9bd48053647fe8f0d75371c3b5ddc8301f779008b615888b'),
      ('20261017141000', 'eskomi_review_entry_retired_therapist_fallback', 'f8b6a31418aa1e9bcac770a3ca7941255c4b079fe72f95ba5618e5b5ae1987d3'),
      ('20261017142000', 'eskomi_partner_therapist_tools', 'a35bf7317d999e35959a92f66607e9caba21de709d1456bc506144f6a90a48eb'),
      ('20261017143000', 'eskomi_v11_acceptance_hardening', '33ccc0d8da8f3fdbdea1ce68036c632cad3328a33c47b389b18f19d3d65c5b54'),
      ('20261017144000', 'eskomi_partner_therapist_history_and_membership', 'f11cf8b97e12872758e42897dac8e52589c0d85bdfdc10d6b1120e98de65281f'),
      ('20261017145000', 'eskomi_partner_photo_membership_guard', 'f41242ef3fe79188e4256e77ae5b9e01676cffe1411423bb399920ab6802f6de'),
      ('20261017146000', 'eskomi_moderation_and_membership_race_fix', '4b51333970488a1837e19d2923cd170c6307fe72d1bcb745e71e9e8f69734a0f'),
      ('20261017147000', 'eskomi_v11_operations_and_receipts', '8cbd3f41016329961871e23d98f974956a85aa7001fd2162694f54f8079b17d0'),
      ('20261017148000', 'eskomi_v11_guest_edits_and_widget', '91877f85d3ebc4756f7f4e18f2a8d4ffa3293a8a291874d4a92dcff155fb6b4e'),
      ('20261017149000', 'eskomi_v11_rpc_contract_and_upgrade_fix', 'ccb5a4ff3282f95676e43d8527ad5aefbedb411ecb298d29c35bc8d98f01fdc6'),
      ('20261017150000', 'eskomi_corrections_and_community', '912fa31aaff18e28c695f43199550034cbbd59bc57a15debd810234e2ed3498d'),
      ('20261017151000', 'eskomi_review_target_and_redemption_hardening', '60481b9c98b5121835ddaa9aeb44ad5ff0fe4f08999310f06cf15b644c20e371'),
      ('20261017152000', 'eskomi_community_ui_safety_and_review_projection', '5e14ae52c991dc3c6ecedbae540199c5913d4fca3bd4ecf18a3bf16a2b49624a'),
      ('20261017153000', 'eskomi_community_receipts_and_burst_controls', '91640643717c46b07fbefa4ee89185a839976a8fab1b534dae73c5feb50f3b65'),
      ('20261017154000', 'eskomi_public_shop_detail_reviews', '95c30eb40048b69c4ea70a8828b2dcf0092d9ad8dab90f4c306764cc470c12e2'),
      ('20261017155000', 'eskomi_canonical_managed_directory_operations', '1c7d841cf88a636cd2db6946424bd09423304a22b79ddba8f263100abc5d021e'),
      ('20261017156000', 'eskomi_v11_global_review_projection', 'd9ecfafb62a977d63dd6334f3c049bf357255f022df0ac98b3ea361d9038fbd5'),
      ('20261017157000', 'eskomi_canonical_partner_home_and_listing', 'a2439224b7031b77cb5bb39c7bcbc8591c32d403222a940b83400d21eaa25615'),
      ('20261017158000', 'eskomi_canonical_primary_area_transition', 'e45925db146edf2282d5bdc2a90d354c8b8ba57657f9f511aa6ff255d7913d39'),
      ('20261017159000', 'eskomi_canonical_partner_provisioning', '1b32232d0a5e8f7784c908731ccf284fb6358ebd967492b141baa5a7cd73cb9c'),
      ('20261017160000', 'eskomi_partner_workspace_compatibility', '7ca1a354a28cb2c612c0600844090aa5b82ba3ce208a1ef2e7084b34cafb3c9a'),
      ('20261017161000', 'eskomi_partner_area_selection', '925cafbdac5d25483260d099cea7159088a98b8e88e14bb6d2aa146476a3b13c'),
      ('20261017162000', 'eskomi_partner_read_roles', '99ee2ddbfef1967cd3e83eaf9e0a0ea948b6f8bffc94b417670acfdb2721127f'),
      ('20261017163000', 'eskomi_canonical_partner_registration_review', 'bbce76f47cfbb3100cdcb37bd614018b7fa187c2c57cd01d984e526812d72af1'),
      ('20261017164000', 'eskomi_legacy_workspace_mapping', '81b7924912003da5e867046754c9c226fa849257c0a2b85a8728ab4b70b8c586'),
      ('20261017165000', 'eskomi_community_reports_and_appeals', '060ac944cac3246ea1c4dfa4d03feb3fd603718ccea0a29e1559179d28e876d2'),
      ('20261017166000', 'eskomi_managed_reader_canonical_identity', '4ff2e3b87624aa8b77acb34b31cee1527e52efcab9a0b468693486a84691cfcd'),
      ('20261017167000', 'eskomi_community_hidden_post_appeals', 'cc9896b20507c52486e1244b6e64cae19af0d5d50b50074d878d37fc0e3df3a0'),
      ('20261017168000', 'eskomi_community_queue_pagination', '5026644776d69f4818980e013505e0da1267674d026187c94bde5df23e508650'),
      ('20261017169000', 'eskomi_community_appeal_replay_order', '120a9418f1f368a73a0be27911829cb1f31ee66ab61acae8c6e6d18a38e56e2e'),
      ('20261017170000', 'eskomi_public_therapist_profiles', '19bdf7d95b560ddc310e9de8c7c445d607f941afb092f6e21143382e13f5c77e'),
      ('20261017171000', 'eskomi_public_profiles_access_and_community_guards', '01e924aa1853aa57201916d6d7da738c489f84ab713c2684299e1d07a4533992'),
      ('20261017172000', 'eskomi_public_delivery_upgrade_hardening', 'ba1c78f07ed7b10f4c820a761d8dfc122c0a365ac5f8308cb099991ce41bdfda'),
      ('20261017173000', 'eskomi_access_measurement_integrity', 'cbf74c135c81d683a2907b36221baa06d982c9911c34eaebe22b248d653ed316'),
      ('20261017174000', 'eskomi_access_context_abuse_and_report_integrity', '8524ef543a1318b224b33ddce0c75bc22f941e2dc9586a2029d8ceb7080b401e'),
      ('20261017175000', 'eskomi_access_context_named_rpc', '29031eebc60d709a6975b76823761d4f3467c391faaa4bd9d1381176377dbee8'),
      ('20261018100000', 'partner_login_email_canonical_audit', '282156343e6cf5fe5cdc8e7ff040bc617236cad18a8c6955188b9381e37de7c9'),
      ('20261020030000', 'eskomi_public_review_read_rpc', 'c073a3b926b65c7120c9b7a2c13ca4323693197dc143470818d2d3c57a0ed184'),
      ('20261021000000', 'eskomi_access_collection_manifest_health', '11c947be9326299e53e6dabb2c70ad738040f664cb1586cdf901c57a0d98f11f')
), comparison as (
  select e.version,
    l.version is not null as recorded,
    l.name is not distinct from e.name as name_matches,
    coalesce(encode(extensions.digest(l.statements[1], 'sha256'), 'hex'), '') = e.source_sha256 as source_matches
  from expected e
  left join supabase_migrations.schema_migrations l using (version)
)
select jsonb_build_object(
  'project_ref_expected', 'goeagrxjsjcbbatpotbu',
  'directory_anchor_exact', exists(
    select 1 from supabase_migrations.schema_migrations
    where version = '20261020020548'
      and name = 'eskomi_supabase_primary_public_directory'
      and encode(extensions.digest(statements[1], 'sha256'), 'hex') = '77520bc6a1e9b5aa5708e7e3848e517f6f6cb3bb7091bbb1380eb20eaaae95d2'
  ),
  'packet_exact', (select count(*) from comparison where recorded and name_matches and source_matches),
  'packet_expected', 50,
  'packet_mismatch_or_missing', (select count(*) from comparison where not (recorded and name_matches and source_matches)),
  'four_public_review_rpcs_present', (
    select count(*)
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'api'
      and p.proname in (
        'list_public_shop_detail_reviews_v11',
        'get_public_shop_detail_review_summary_v11',
        'list_public_review_experience_publications_global',
        'count_public_review_experience_publications_global'
      )
  )
) as final_verification;
