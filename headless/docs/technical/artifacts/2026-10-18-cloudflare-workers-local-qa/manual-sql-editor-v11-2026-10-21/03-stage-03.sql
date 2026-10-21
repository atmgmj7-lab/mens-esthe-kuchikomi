-- Eskomi v1.1 manual SQL Editor packet: stage 03 of 05
-- Project ref: goeagrxjsjcbbatpotbu
-- This file contains the checked-in source SQL unchanged plus an atomic source-ledger record.
-- Paste the ENTIRE file into Supabase SQL Editor and run it once. Do not run a later stage unless this one returns success.

begin;
select pg_advisory_xact_lock(hashtext('eskomi-v11-source-migrations-20261021'));

do $eskomi_preflight$
declare
  anchor_name text;
  anchor_source_sha256 text;
begin
  select name, encode(extensions.digest(statements[1], 'sha256'), 'hex')
    into anchor_name, anchor_source_sha256
  from supabase_migrations.schema_migrations
  where version = '20261020020548';
  if anchor_name is distinct from 'eskomi_supabase_primary_public_directory'
     or anchor_source_sha256 is distinct from '77520bc6a1e9b5aa5708e7e3848e517f6f6cb3bb7091bbb1380eb20eaaae95d2' then
    raise exception 'required directory migration 20261020020548 version/name/source hash does not match';
  end if;

  if exists (
    select 1
    from (values
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
      ('20261017157000', 'eskomi_canonical_partner_home_and_listing', 'a2439224b7031b77cb5bb39c7bcbc8591c32d403222a940b83400d21eaa25615')
    ) as expected(version, name, source_sha256)
    left join supabase_migrations.schema_migrations as ledger
      on ledger.version = expected.version
    where ledger.version is null
       or ledger.name is distinct from expected.name
       or coalesce(encode(extensions.digest(ledger.statements[1], 'sha256'), 'hex'), '') <> expected.source_sha256
  ) then
    raise exception 'prior source ledger does not match this packet';
  end if;
  if exists (
    select 1 from supabase_migrations.schema_migrations
    where version in ('20261017158000', '20261017159000', '20261017160000', '20261017161000', '20261017162000', '20261017163000', '20261017164000')
  ) then
    raise exception 'stage 03 is already partly or wholly recorded; stop and use 00-checkpoint.sql';
  end if;
end;
$eskomi_preflight$;

-- SOURCE 20261017158000_eskomi_canonical_primary_area_transition.sql
-- SHA-256 e45925db146edf2282d5bdc2a90d354c8b8ba57657f9f511aa6ff255d7913d39
-- A canonical publication can change its approved area.  The shop_areas
-- primary-area constraint is immediate, so clear the previous primary while
-- holding the app shop row lock before promoting the new area.
--
-- This is an additive corrective override: do not rewrite the historical
-- directory migration, because populated ledgers already contain it.
create or replace function private.sync_canonical_managed_shop_publication_v11(
  p_managed_shop_id uuid
) returns void
language plpgsql security definer set search_path = private, app, pg_temp as $$
declare
  v_shop private.managed_shops%rowtype;
  v_publication private.managed_shop_publications%rowtype;
  v_area_id uuid;
  v_description text;
begin
  select * into v_shop from private.managed_shops where id = p_managed_shop_id for key share;
  if not found or v_shop.app_shop_id is null then
    raise exception 'canonical managed shop not found' using errcode = 'P0002';
  end if;

  -- Serializes area primary transitions for this canonical shop. This lock is
  -- deliberately acquired before clearing and promoting shop_areas rows.
  perform 1 from app.shops where id = v_shop.app_shop_id for update;

  select * into v_publication from private.managed_shop_publications
  where managed_shop_id = v_shop.id for key share;

  if v_shop.publication_state = 'published' and v_publication.managed_shop_id is null then
    raise exception 'published canonical managed shop has no reviewed publication' using errcode = '23514';
  end if;

  if v_publication.managed_shop_id is not null then
    insert into app.areas (slug, name, is_published, published_at)
    values (v_publication.area_slug, v_publication.area_name, v_shop.publication_state = 'published',
      case when v_shop.publication_state = 'published' then now() else null end)
    on conflict (slug) do update set
      name = excluded.name,
      is_published = app.areas.is_published or excluded.is_published,
      published_at = case when app.areas.published_at is null and excluded.is_published then now() else app.areas.published_at end,
      updated_at = now()
    returning id into v_area_id;

    v_description := replace(replace(replace(replace(replace(coalesce(v_publication.introduction, ''), '&', '&amp;'), '<', '&lt;'), '>', '&gt;'), '"', '&quot;'), '''', '&#39;');
    update app.shops set
      name = v_publication.shop_name,
      description_html = v_description,
      excerpt = coalesce(v_publication.introduction, ''),
      official_url = v_publication.official_url,
      phone = v_publication.phone,
      address_text = v_publication.address,
      booking_url = v_publication.booking_url,
      publication_status = case v_shop.publication_state
        when 'published' then 'published'
        when 'deleted' then 'archived'
        else 'review'
      end,
      published_at = case when v_shop.publication_state = 'published' then coalesce(app.shops.published_at, v_publication.published_at, now()) else null end,
      updated_at = now()
    where id = v_shop.app_shop_id;

    -- Do this before the new primary insert/upsert: the partial unique index
    -- app.shop_areas(shop_id) WHERE is_primary is immediate.
    update app.shop_areas set is_primary = false
    where shop_id = v_shop.app_shop_id and area_id <> v_area_id and is_primary;
    insert into app.shop_areas (shop_id, area_id, is_primary, source_system)
    values (v_shop.app_shop_id, v_area_id, true, 'operator-managed')
    on conflict (shop_id, area_id) do update set is_primary = true, source_system = excluded.source_system;
  else
    update app.shops set publication_status = 'draft', published_at = null, updated_at = now()
    where id = v_shop.app_shop_id;
  end if;
end;
$$;

revoke all on function private.sync_canonical_managed_shop_publication_v11(uuid) from public, anon, authenticated;
grant execute on function private.sync_canonical_managed_shop_publication_v11(uuid) to service_role;

notify pgrst, 'reload schema';

insert into supabase_migrations.schema_migrations
  (version, statements, name, created_by, idempotency_key, rollback)
values
  ('20261017158000', array[$eskomi_packet_03_1$-- A canonical publication can change its approved area.  The shop_areas
-- primary-area constraint is immediate, so clear the previous primary while
-- holding the app shop row lock before promoting the new area.
--
-- This is an additive corrective override: do not rewrite the historical
-- directory migration, because populated ledgers already contain it.
create or replace function private.sync_canonical_managed_shop_publication_v11(
  p_managed_shop_id uuid
) returns void
language plpgsql security definer set search_path = private, app, pg_temp as $$
declare
  v_shop private.managed_shops%rowtype;
  v_publication private.managed_shop_publications%rowtype;
  v_area_id uuid;
  v_description text;
begin
  select * into v_shop from private.managed_shops where id = p_managed_shop_id for key share;
  if not found or v_shop.app_shop_id is null then
    raise exception 'canonical managed shop not found' using errcode = 'P0002';
  end if;

  -- Serializes area primary transitions for this canonical shop. This lock is
  -- deliberately acquired before clearing and promoting shop_areas rows.
  perform 1 from app.shops where id = v_shop.app_shop_id for update;

  select * into v_publication from private.managed_shop_publications
  where managed_shop_id = v_shop.id for key share;

  if v_shop.publication_state = 'published' and v_publication.managed_shop_id is null then
    raise exception 'published canonical managed shop has no reviewed publication' using errcode = '23514';
  end if;

  if v_publication.managed_shop_id is not null then
    insert into app.areas (slug, name, is_published, published_at)
    values (v_publication.area_slug, v_publication.area_name, v_shop.publication_state = 'published',
      case when v_shop.publication_state = 'published' then now() else null end)
    on conflict (slug) do update set
      name = excluded.name,
      is_published = app.areas.is_published or excluded.is_published,
      published_at = case when app.areas.published_at is null and excluded.is_published then now() else app.areas.published_at end,
      updated_at = now()
    returning id into v_area_id;

    v_description := replace(replace(replace(replace(replace(coalesce(v_publication.introduction, ''), '&', '&amp;'), '<', '&lt;'), '>', '&gt;'), '"', '&quot;'), '''', '&#39;');
    update app.shops set
      name = v_publication.shop_name,
      description_html = v_description,
      excerpt = coalesce(v_publication.introduction, ''),
      official_url = v_publication.official_url,
      phone = v_publication.phone,
      address_text = v_publication.address,
      booking_url = v_publication.booking_url,
      publication_status = case v_shop.publication_state
        when 'published' then 'published'
        when 'deleted' then 'archived'
        else 'review'
      end,
      published_at = case when v_shop.publication_state = 'published' then coalesce(app.shops.published_at, v_publication.published_at, now()) else null end,
      updated_at = now()
    where id = v_shop.app_shop_id;

    -- Do this before the new primary insert/upsert: the partial unique index
    -- app.shop_areas(shop_id) WHERE is_primary is immediate.
    update app.shop_areas set is_primary = false
    where shop_id = v_shop.app_shop_id and area_id <> v_area_id and is_primary;
    insert into app.shop_areas (shop_id, area_id, is_primary, source_system)
    values (v_shop.app_shop_id, v_area_id, true, 'operator-managed')
    on conflict (shop_id, area_id) do update set is_primary = true, source_system = excluded.source_system;
  else
    update app.shops set publication_status = 'draft', published_at = null, updated_at = now()
    where id = v_shop.app_shop_id;
  end if;
end;
$$;

revoke all on function private.sync_canonical_managed_shop_publication_v11(uuid) from public, anon, authenticated;
grant execute on function private.sync_canonical_managed_shop_publication_v11(uuid) to service_role;

notify pgrst, 'reload schema';
$eskomi_packet_03_1$], 'eskomi_canonical_primary_area_transition', null, null, null);

-- SOURCE 20261017159000_eskomi_canonical_partner_provisioning.sql
-- SHA-256 1b32232d0a5e8f7784c908731ccf284fb6358ebd967492b141baa5a7cd73cb9c
-- Dashboard provisioning must never reinterpret a Supabase directory_id as a
-- WordPress post id. Resolve a published managed shop by its stable slug and
-- delegate to the UUID workspace provisioner in the same database boundary.
create or replace function private.provision_partner_workspace_for_published_managed_shop(
  p_shop_slug text, p_source text default 'provisioning'
) returns table (workspace_id uuid, state text, initialized boolean)
language plpgsql security definer set search_path=private,app,pg_temp as $$
declare v_app_shop_id uuid;
begin
  if p_shop_slug !~ '^[a-z0-9][a-z0-9-]{1,118}[a-z0-9]$' then
    raise exception 'invalid canonical shop slug' using errcode='22023';
  end if;
  select managed.app_shop_id into v_app_shop_id
  from private.managed_shops managed
  join app.shops shop on shop.id=managed.app_shop_id
  where managed.shop_slug=p_shop_slug
    and managed.app_shop_id is not null
    and managed.publication_state='published'
    and shop.publication_status='published'
  for key share of managed,shop;
  if v_app_shop_id is null then return; end if;
  return query
    select * from private.provision_partner_workspace_for_app_shop(v_app_shop_id,p_source);
end $$;

create or replace function api.provision_partner_workspace_for_published_managed_shop(
  p_shop_slug text, p_source text default 'provisioning'
) returns table (workspace_id uuid, state text, initialized boolean)
language sql security invoker set search_path=private,api,pg_temp as $$
  select * from private.provision_partner_workspace_for_published_managed_shop(p_shop_slug,p_source)
$$;

revoke all on function private.provision_partner_workspace_for_published_managed_shop(text,text),api.provision_partner_workspace_for_published_managed_shop(text,text) from public,anon,authenticated;
grant execute on function private.provision_partner_workspace_for_published_managed_shop(text,text),api.provision_partner_workspace_for_published_managed_shop(text,text) to service_role;

notify pgrst,'reload schema';

insert into supabase_migrations.schema_migrations
  (version, statements, name, created_by, idempotency_key, rollback)
values
  ('20261017159000', array[$eskomi_packet_03_2$-- Dashboard provisioning must never reinterpret a Supabase directory_id as a
-- WordPress post id. Resolve a published managed shop by its stable slug and
-- delegate to the UUID workspace provisioner in the same database boundary.
create or replace function private.provision_partner_workspace_for_published_managed_shop(
  p_shop_slug text, p_source text default 'provisioning'
) returns table (workspace_id uuid, state text, initialized boolean)
language plpgsql security definer set search_path=private,app,pg_temp as $$
declare v_app_shop_id uuid;
begin
  if p_shop_slug !~ '^[a-z0-9][a-z0-9-]{1,118}[a-z0-9]$' then
    raise exception 'invalid canonical shop slug' using errcode='22023';
  end if;
  select managed.app_shop_id into v_app_shop_id
  from private.managed_shops managed
  join app.shops shop on shop.id=managed.app_shop_id
  where managed.shop_slug=p_shop_slug
    and managed.app_shop_id is not null
    and managed.publication_state='published'
    and shop.publication_status='published'
  for key share of managed,shop;
  if v_app_shop_id is null then return; end if;
  return query
    select * from private.provision_partner_workspace_for_app_shop(v_app_shop_id,p_source);
end $$;

create or replace function api.provision_partner_workspace_for_published_managed_shop(
  p_shop_slug text, p_source text default 'provisioning'
) returns table (workspace_id uuid, state text, initialized boolean)
language sql security invoker set search_path=private,api,pg_temp as $$
  select * from private.provision_partner_workspace_for_published_managed_shop(p_shop_slug,p_source)
$$;

revoke all on function private.provision_partner_workspace_for_published_managed_shop(text,text),api.provision_partner_workspace_for_published_managed_shop(text,text) from public,anon,authenticated;
grant execute on function private.provision_partner_workspace_for_published_managed_shop(text,text),api.provision_partner_workspace_for_published_managed_shop(text,text) to service_role;

notify pgrst,'reload schema';
$eskomi_packet_03_2$], 'eskomi_canonical_partner_provisioning', null, null, null);

-- SOURCE 20261017160000_eskomi_partner_workspace_compatibility.sql
-- SHA-256 7ca1a354a28cb2c612c0600844090aa5b82ba3ce208a1ef2e7084b34cafb3c9a
-- Keep active, WordPress-only workspaces able to authenticate while their
-- reviewed app_shop_id mapping is pending. Canonical rows remain stricter:
-- they require both a published app shop and published managed projection.
create or replace function private.get_partner_compatible_auth_membership(p_auth_user_id uuid)
returns table(workspace_id uuid,identity_kind text,app_shop_id uuid,wp_shop_id bigint,shop_slug text,role text)
language sql security definer set search_path=private,app,pg_temp as $$
  select workspace.id,
    case when workspace.app_shop_id is null then 'legacy' else 'canonical' end,
    workspace.app_shop_id,workspace.wp_shop_id,workspace.shop_slug,membership.role::text
  from private.partner_memberships membership
  join private.partner_workspaces workspace on workspace.id=membership.workspace_id
  left join app.shops shop on shop.id=workspace.app_shop_id
  left join private.managed_shops managed on managed.app_shop_id=workspace.app_shop_id
  where membership.auth_user_id=p_auth_user_id
    and membership.status='active'
    and membership.role in ('owner','manager')
    and workspace.state in ('free_official_partner','active_partner')
    and (
      (workspace.app_shop_id is null and workspace.wp_shop_id is not null)
      or (workspace.app_shop_id is not null and shop.publication_status='published' and managed.publication_state='published')
    )
$$;

create or replace function private.get_partner_compatible_workspace_identity(
  p_workspace_id uuid,p_auth_user_id uuid
) returns table(workspace_id uuid,identity_kind text,app_shop_id uuid,wp_shop_id bigint,shop_slug text,shop_name text,canonical_url text,state text)
language sql security definer set search_path=private,app,pg_temp as $$
  select workspace.id,
    case when workspace.app_shop_id is null then 'legacy' else 'canonical' end,
    workspace.app_shop_id,workspace.wp_shop_id,workspace.shop_slug,workspace.shop_name,workspace.canonical_url,workspace.state::text
  from private.partner_memberships membership
  join private.partner_workspaces workspace on workspace.id=membership.workspace_id
  left join app.shops shop on shop.id=workspace.app_shop_id
  left join private.managed_shops managed on managed.app_shop_id=workspace.app_shop_id
  where workspace.id=p_workspace_id
    and membership.auth_user_id=p_auth_user_id
    and membership.status='active'
    and membership.role in ('owner','manager')
    and workspace.state in ('free_official_partner','active_partner')
    and (
      (workspace.app_shop_id is null and workspace.wp_shop_id is not null)
      or (workspace.app_shop_id is not null and shop.publication_status='published' and managed.publication_state='published')
    )
$$;

create or replace function api.get_partner_compatible_auth_membership(p_auth_user_id uuid)
returns table(workspace_id uuid,identity_kind text,app_shop_id uuid,wp_shop_id bigint,shop_slug text,role text)
language sql security invoker set search_path=private,api,pg_temp as $$
  select * from private.get_partner_compatible_auth_membership(p_auth_user_id)
$$;
create or replace function api.get_partner_compatible_workspace_identity(p_workspace_id uuid,p_auth_user_id uuid)
returns table(workspace_id uuid,identity_kind text,app_shop_id uuid,wp_shop_id bigint,shop_slug text,shop_name text,canonical_url text,state text)
language sql security invoker set search_path=private,api,pg_temp as $$
  select * from private.get_partner_compatible_workspace_identity(p_workspace_id,p_auth_user_id)
$$;

revoke all on function private.get_partner_compatible_auth_membership(uuid),private.get_partner_compatible_workspace_identity(uuid,uuid),api.get_partner_compatible_auth_membership(uuid),api.get_partner_compatible_workspace_identity(uuid,uuid) from public,anon,authenticated;
grant execute on function private.get_partner_compatible_auth_membership(uuid),private.get_partner_compatible_workspace_identity(uuid,uuid),api.get_partner_compatible_auth_membership(uuid),api.get_partner_compatible_workspace_identity(uuid,uuid) to service_role;

notify pgrst,'reload schema';

insert into supabase_migrations.schema_migrations
  (version, statements, name, created_by, idempotency_key, rollback)
values
  ('20261017160000', array[$eskomi_packet_03_3$-- Keep active, WordPress-only workspaces able to authenticate while their
-- reviewed app_shop_id mapping is pending. Canonical rows remain stricter:
-- they require both a published app shop and published managed projection.
create or replace function private.get_partner_compatible_auth_membership(p_auth_user_id uuid)
returns table(workspace_id uuid,identity_kind text,app_shop_id uuid,wp_shop_id bigint,shop_slug text,role text)
language sql security definer set search_path=private,app,pg_temp as $$
  select workspace.id,
    case when workspace.app_shop_id is null then 'legacy' else 'canonical' end,
    workspace.app_shop_id,workspace.wp_shop_id,workspace.shop_slug,membership.role::text
  from private.partner_memberships membership
  join private.partner_workspaces workspace on workspace.id=membership.workspace_id
  left join app.shops shop on shop.id=workspace.app_shop_id
  left join private.managed_shops managed on managed.app_shop_id=workspace.app_shop_id
  where membership.auth_user_id=p_auth_user_id
    and membership.status='active'
    and membership.role in ('owner','manager')
    and workspace.state in ('free_official_partner','active_partner')
    and (
      (workspace.app_shop_id is null and workspace.wp_shop_id is not null)
      or (workspace.app_shop_id is not null and shop.publication_status='published' and managed.publication_state='published')
    )
$$;

create or replace function private.get_partner_compatible_workspace_identity(
  p_workspace_id uuid,p_auth_user_id uuid
) returns table(workspace_id uuid,identity_kind text,app_shop_id uuid,wp_shop_id bigint,shop_slug text,shop_name text,canonical_url text,state text)
language sql security definer set search_path=private,app,pg_temp as $$
  select workspace.id,
    case when workspace.app_shop_id is null then 'legacy' else 'canonical' end,
    workspace.app_shop_id,workspace.wp_shop_id,workspace.shop_slug,workspace.shop_name,workspace.canonical_url,workspace.state::text
  from private.partner_memberships membership
  join private.partner_workspaces workspace on workspace.id=membership.workspace_id
  left join app.shops shop on shop.id=workspace.app_shop_id
  left join private.managed_shops managed on managed.app_shop_id=workspace.app_shop_id
  where workspace.id=p_workspace_id
    and membership.auth_user_id=p_auth_user_id
    and membership.status='active'
    and membership.role in ('owner','manager')
    and workspace.state in ('free_official_partner','active_partner')
    and (
      (workspace.app_shop_id is null and workspace.wp_shop_id is not null)
      or (workspace.app_shop_id is not null and shop.publication_status='published' and managed.publication_state='published')
    )
$$;

create or replace function api.get_partner_compatible_auth_membership(p_auth_user_id uuid)
returns table(workspace_id uuid,identity_kind text,app_shop_id uuid,wp_shop_id bigint,shop_slug text,role text)
language sql security invoker set search_path=private,api,pg_temp as $$
  select * from private.get_partner_compatible_auth_membership(p_auth_user_id)
$$;
create or replace function api.get_partner_compatible_workspace_identity(p_workspace_id uuid,p_auth_user_id uuid)
returns table(workspace_id uuid,identity_kind text,app_shop_id uuid,wp_shop_id bigint,shop_slug text,shop_name text,canonical_url text,state text)
language sql security invoker set search_path=private,api,pg_temp as $$
  select * from private.get_partner_compatible_workspace_identity(p_workspace_id,p_auth_user_id)
$$;

revoke all on function private.get_partner_compatible_auth_membership(uuid),private.get_partner_compatible_workspace_identity(uuid,uuid),api.get_partner_compatible_auth_membership(uuid),api.get_partner_compatible_workspace_identity(uuid,uuid) from public,anon,authenticated;
grant execute on function private.get_partner_compatible_auth_membership(uuid),private.get_partner_compatible_workspace_identity(uuid,uuid),api.get_partner_compatible_auth_membership(uuid),api.get_partner_compatible_workspace_identity(uuid,uuid) to service_role;

notify pgrst,'reload schema';
$eskomi_packet_03_3$], 'eskomi_partner_workspace_compatibility', null, null, null);

-- SOURCE 20261017161000_eskomi_partner_area_selection.sql
-- SHA-256 925cafbdac5d25483260d099cea7159088a98b8e88e14bb6d2aa146476a3b13c
-- A Partner may request a move only to an existing published area. It submits
-- the stable slug; it never supplies an area display name that could rewrite
-- a shared app.areas master row used by other shops.
create or replace function private.get_partner_canonical_listing_editor(
  p_workspace_id uuid,p_auth_user_id uuid
) returns jsonb
language plpgsql security definer set search_path=private,app,pg_temp as $$
declare v_shop uuid;
begin
  v_shop:=private.assert_partner_canonical_membership(p_workspace_id,p_auth_user_id);
  return (
    select jsonb_build_object(
      'store_id',managed.id,'app_shop_id',v_shop,'shop_slug',managed.shop_slug,'canonical_url',managed.canonical_url,
      'current_revision',managed.current_revision,
      'revision',jsonb_build_object('state',revision.state,'shop_name',revision.shop_name,'area_slug',revision.area_slug,'area',revision.area_name,
        'website_url',revision.official_url,'introduction',revision.introduction,'banner_asset_id',revision.banner_asset_id),
      'area_options',coalesce((select jsonb_agg(jsonb_build_object('slug',area.slug,'name',area.name) order by area.name,area.slug)
        from app.areas area where area.is_published or area.slug=revision.area_slug),'[]'::jsonb),
      'latest_review',(select jsonb_build_object('decision',review.decision,'note',review.note)
        from private.managed_shop_reviews review where review.managed_shop_id=managed.id order by review.created_at desc limit 1)
    )
    from private.managed_shops managed
    join private.managed_shop_revisions revision on revision.managed_shop_id=managed.id and revision.revision=managed.current_revision
    where managed.app_shop_id=v_shop
  );
end $$;

create or replace function private.save_partner_canonical_listing_draft(
  p_workspace_id uuid,p_auth_user_id uuid,p_expected_revision integer,p_patch jsonb
) returns text
language plpgsql security definer set search_path=private,app,pg_temp as $$
declare v_shop uuid; v_managed private.managed_shops%rowtype; v_revision private.managed_shop_revisions%rowtype; v_payload jsonb; v_name text; v_area_slug text; v_area_name text; v_url text; v_intro text; v_banner uuid;
begin
  v_shop:=private.assert_partner_canonical_membership(p_workspace_id,p_auth_user_id);
  if jsonb_typeof(p_patch)<>'object' or exists(select 1 from jsonb_object_keys(p_patch) key where key not in ('shop_name','area_slug','official_url','introduction','banner_asset_id')) then
    raise exception 'invalid listing patch' using errcode='22023';
  end if;
  select * into v_managed from private.managed_shops where app_shop_id=v_shop for update;
  if not found or v_managed.current_revision<>p_expected_revision then return 'conflict'; end if;
  select * into v_revision from private.managed_shop_revisions where managed_shop_id=v_managed.id and revision=v_managed.current_revision for key share;
  v_name:=btrim(coalesce(p_patch->>'shop_name',v_revision.shop_name));
  v_area_slug:=btrim(coalesce(p_patch->>'area_slug',v_revision.area_slug));
  select name into v_area_name from app.areas where slug=v_area_slug and (is_published or slug=v_revision.area_slug) for key share;
  v_url:=btrim(coalesce(p_patch->>'official_url',v_revision.official_url));
  v_intro:=nullif(btrim(coalesce(p_patch->>'introduction',v_revision.introduction,'')),'');
  v_banner:=case when p_patch ? 'banner_asset_id' and p_patch->>'banner_asset_id' is not null then (p_patch->>'banner_asset_id')::uuid else v_revision.banner_asset_id end;
  if char_length(v_name) not between 1 and 120 or v_area_name is null or v_url !~ '^https?://' or char_length(coalesce(v_intro,''))>5000 then
    raise exception 'invalid listing patch' using errcode='22023';
  end if;
  v_payload:=jsonb_build_object('shop_name',v_name,'area_slug',v_area_slug,'area_name',v_area_name,'official_url',v_url,
    'introduction',v_intro,'address',v_revision.address,'business_hours',v_revision.business_hours,'phone',v_revision.phone,
    'line_url',v_revision.line_url,'booking_url',v_revision.booking_url,'basic_price',v_revision.basic_price,'price_90',v_revision.price_90,
    'banner_asset_id',v_banner,'gallery_asset_ids',coalesce(to_jsonb(v_revision.gallery_asset_ids),'[]'::jsonb));
  return private.save_managed_shop_draft(v_managed.id,p_expected_revision,v_payload,'partner_workspace:' || p_workspace_id);
end $$;

revoke all on function private.get_partner_canonical_listing_editor(uuid,uuid),private.save_partner_canonical_listing_draft(uuid,uuid,integer,jsonb) from public,anon,authenticated;
grant execute on function private.get_partner_canonical_listing_editor(uuid,uuid),private.save_partner_canonical_listing_draft(uuid,uuid,integer,jsonb) to service_role;

notify pgrst,'reload schema';

insert into supabase_migrations.schema_migrations
  (version, statements, name, created_by, idempotency_key, rollback)
values
  ('20261017161000', array[$eskomi_packet_03_4$-- A Partner may request a move only to an existing published area. It submits
-- the stable slug; it never supplies an area display name that could rewrite
-- a shared app.areas master row used by other shops.
create or replace function private.get_partner_canonical_listing_editor(
  p_workspace_id uuid,p_auth_user_id uuid
) returns jsonb
language plpgsql security definer set search_path=private,app,pg_temp as $$
declare v_shop uuid;
begin
  v_shop:=private.assert_partner_canonical_membership(p_workspace_id,p_auth_user_id);
  return (
    select jsonb_build_object(
      'store_id',managed.id,'app_shop_id',v_shop,'shop_slug',managed.shop_slug,'canonical_url',managed.canonical_url,
      'current_revision',managed.current_revision,
      'revision',jsonb_build_object('state',revision.state,'shop_name',revision.shop_name,'area_slug',revision.area_slug,'area',revision.area_name,
        'website_url',revision.official_url,'introduction',revision.introduction,'banner_asset_id',revision.banner_asset_id),
      'area_options',coalesce((select jsonb_agg(jsonb_build_object('slug',area.slug,'name',area.name) order by area.name,area.slug)
        from app.areas area where area.is_published or area.slug=revision.area_slug),'[]'::jsonb),
      'latest_review',(select jsonb_build_object('decision',review.decision,'note',review.note)
        from private.managed_shop_reviews review where review.managed_shop_id=managed.id order by review.created_at desc limit 1)
    )
    from private.managed_shops managed
    join private.managed_shop_revisions revision on revision.managed_shop_id=managed.id and revision.revision=managed.current_revision
    where managed.app_shop_id=v_shop
  );
end $$;

create or replace function private.save_partner_canonical_listing_draft(
  p_workspace_id uuid,p_auth_user_id uuid,p_expected_revision integer,p_patch jsonb
) returns text
language plpgsql security definer set search_path=private,app,pg_temp as $$
declare v_shop uuid; v_managed private.managed_shops%rowtype; v_revision private.managed_shop_revisions%rowtype; v_payload jsonb; v_name text; v_area_slug text; v_area_name text; v_url text; v_intro text; v_banner uuid;
begin
  v_shop:=private.assert_partner_canonical_membership(p_workspace_id,p_auth_user_id);
  if jsonb_typeof(p_patch)<>'object' or exists(select 1 from jsonb_object_keys(p_patch) key where key not in ('shop_name','area_slug','official_url','introduction','banner_asset_id')) then
    raise exception 'invalid listing patch' using errcode='22023';
  end if;
  select * into v_managed from private.managed_shops where app_shop_id=v_shop for update;
  if not found or v_managed.current_revision<>p_expected_revision then return 'conflict'; end if;
  select * into v_revision from private.managed_shop_revisions where managed_shop_id=v_managed.id and revision=v_managed.current_revision for key share;
  v_name:=btrim(coalesce(p_patch->>'shop_name',v_revision.shop_name));
  v_area_slug:=btrim(coalesce(p_patch->>'area_slug',v_revision.area_slug));
  select name into v_area_name from app.areas where slug=v_area_slug and (is_published or slug=v_revision.area_slug) for key share;
  v_url:=btrim(coalesce(p_patch->>'official_url',v_revision.official_url));
  v_intro:=nullif(btrim(coalesce(p_patch->>'introduction',v_revision.introduction,'')),'');
  v_banner:=case when p_patch ? 'banner_asset_id' and p_patch->>'banner_asset_id' is not null then (p_patch->>'banner_asset_id')::uuid else v_revision.banner_asset_id end;
  if char_length(v_name) not between 1 and 120 or v_area_name is null or v_url !~ '^https?://' or char_length(coalesce(v_intro,''))>5000 then
    raise exception 'invalid listing patch' using errcode='22023';
  end if;
  v_payload:=jsonb_build_object('shop_name',v_name,'area_slug',v_area_slug,'area_name',v_area_name,'official_url',v_url,
    'introduction',v_intro,'address',v_revision.address,'business_hours',v_revision.business_hours,'phone',v_revision.phone,
    'line_url',v_revision.line_url,'booking_url',v_revision.booking_url,'basic_price',v_revision.basic_price,'price_90',v_revision.price_90,
    'banner_asset_id',v_banner,'gallery_asset_ids',coalesce(to_jsonb(v_revision.gallery_asset_ids),'[]'::jsonb));
  return private.save_managed_shop_draft(v_managed.id,p_expected_revision,v_payload,'partner_workspace:' || p_workspace_id);
end $$;

revoke all on function private.get_partner_canonical_listing_editor(uuid,uuid),private.save_partner_canonical_listing_draft(uuid,uuid,integer,jsonb) from public,anon,authenticated;
grant execute on function private.get_partner_canonical_listing_editor(uuid,uuid),private.save_partner_canonical_listing_draft(uuid,uuid,integer,jsonb) to service_role;

notify pgrst,'reload schema';
$eskomi_packet_03_4$], 'eskomi_partner_area_selection', null, null, null);

-- SOURCE 20261017162000_eskomi_partner_read_roles.sql
-- SHA-256 99ee2ddbfef1967cd3e83eaf9e0a0ea948b6f8bffc94b417670acfdb2721127f
-- Read-only Partner surfaces are available to owners and managers. Creating
-- or changing a widget/link remains owner-only; a manager can reuse an
-- already prepared handle but cannot create one through a read request.
create or replace function private.assert_partner_v11_read_membership(
  p_workspace_id uuid,p_auth_user_id uuid
) returns uuid language plpgsql security definer set search_path=private,app,pg_temp as $$
declare v_shop uuid;
begin
  select workspace.app_shop_id into v_shop
  from private.partner_memberships membership
  join private.partner_workspaces workspace on workspace.id=membership.workspace_id
  join app.shops shop on shop.id=workspace.app_shop_id
  where membership.workspace_id=p_workspace_id and membership.auth_user_id=p_auth_user_id
    and membership.status='active' and membership.role in ('owner','manager')
    and workspace.state in ('free_official_partner','active_partner')
    and shop.publication_status='published'
  for update of membership,workspace,shop;
  if v_shop is null then raise exception 'partner membership is unavailable' using errcode='42501'; end if;
  return v_shop;
end $$;

create or replace function private.get_partner_review_widget_v11(p_workspace_id uuid,p_auth_user_id uuid)
returns table(public_handle uuid,state text,revision integer,shop_name text,canonical_path text)
language plpgsql security definer set search_path=private,app,pg_temp as $$
declare v_shop uuid; v_role text;
begin
  v_shop:=private.assert_partner_v11_read_membership(p_workspace_id,p_auth_user_id);
  select membership.role::text into v_role from private.partner_memberships membership
    where membership.workspace_id=p_workspace_id and membership.auth_user_id=p_auth_user_id and membership.status='active' for key share;
  if not exists(select 1 from private.review_widget_settings_v11 where workspace_id=p_workspace_id) and v_role='owner' then
    insert into private.review_widget_settings_v11(workspace_id,shop_id) values(p_workspace_id,v_shop) on conflict(workspace_id) do nothing;
  end if;
  return query select setting.public_handle,setting.state,setting.revision,shop.name,shop.canonical_path
    from private.review_widget_settings_v11 setting join app.shops shop on shop.id=setting.shop_id
    where setting.workspace_id=p_workspace_id and setting.shop_id=v_shop;
end $$;

create or replace function private.get_partner_canonical_growth_v11(
  p_workspace_id uuid,p_auth_user_id uuid
) returns table(workspace_id uuid,app_shop_id uuid,review_handle uuid,widget_handle uuid,shop_name text,canonical_path text,submitted_reviews bigint,pending_reviews bigint,published_reviews bigint)
language plpgsql security definer set search_path=private,app,pg_temp as $$
declare v_shop uuid; v_review_handle uuid; v_widget_handle uuid; v_role text;
begin
  v_shop:=private.assert_partner_canonical_membership(p_workspace_id,p_auth_user_id);
  select membership.role::text into v_role from private.partner_memberships membership
    where membership.workspace_id=p_workspace_id and membership.auth_user_id=p_auth_user_id and membership.status='active' for key share;
  if v_role='owner' then
    select link.public_handle into v_review_handle from private.create_partner_review_entry_link(p_workspace_id,null,'line') link;
  else
    select link.public_handle into v_review_handle
    from private.partner_review_entry_link_bindings binding
    join private.review_entry_links link on link.id=binding.link_id
    where binding.workspace_id=p_workspace_id and binding.therapist_assignment_id is null and binding.channel='line'
      and link.is_active and (link.expires_at is null or link.expires_at>now());
  end if;
  select widget.public_handle into v_widget_handle from private.get_partner_review_widget_v11(p_workspace_id,p_auth_user_id) widget;
  return query
    select p_workspace_id,v_shop,v_review_handle,v_widget_handle,shop.name,shop.canonical_path,
      (select count(*) from private.review_experiences experience where experience.shop_id=v_shop and experience.state<>'withdrawn'),
      (select count(*) from private.review_experiences experience where experience.shop_id=v_shop and experience.state in ('submitted','under_review')),
      (select count(*) from app.review_experience_publications publication where publication.shop_id=v_shop and publication.publication_state='published')
    from app.shops shop where shop.id=v_shop;
end $$;

revoke all on function private.assert_partner_v11_read_membership(uuid,uuid),private.get_partner_review_widget_v11(uuid,uuid),private.get_partner_canonical_growth_v11(uuid,uuid) from public,anon,authenticated;
grant execute on function private.assert_partner_v11_read_membership(uuid,uuid),private.get_partner_review_widget_v11(uuid,uuid),private.get_partner_canonical_growth_v11(uuid,uuid) to service_role;

notify pgrst,'reload schema';

insert into supabase_migrations.schema_migrations
  (version, statements, name, created_by, idempotency_key, rollback)
values
  ('20261017162000', array[$eskomi_packet_03_5$-- Read-only Partner surfaces are available to owners and managers. Creating
-- or changing a widget/link remains owner-only; a manager can reuse an
-- already prepared handle but cannot create one through a read request.
create or replace function private.assert_partner_v11_read_membership(
  p_workspace_id uuid,p_auth_user_id uuid
) returns uuid language plpgsql security definer set search_path=private,app,pg_temp as $$
declare v_shop uuid;
begin
  select workspace.app_shop_id into v_shop
  from private.partner_memberships membership
  join private.partner_workspaces workspace on workspace.id=membership.workspace_id
  join app.shops shop on shop.id=workspace.app_shop_id
  where membership.workspace_id=p_workspace_id and membership.auth_user_id=p_auth_user_id
    and membership.status='active' and membership.role in ('owner','manager')
    and workspace.state in ('free_official_partner','active_partner')
    and shop.publication_status='published'
  for update of membership,workspace,shop;
  if v_shop is null then raise exception 'partner membership is unavailable' using errcode='42501'; end if;
  return v_shop;
end $$;

create or replace function private.get_partner_review_widget_v11(p_workspace_id uuid,p_auth_user_id uuid)
returns table(public_handle uuid,state text,revision integer,shop_name text,canonical_path text)
language plpgsql security definer set search_path=private,app,pg_temp as $$
declare v_shop uuid; v_role text;
begin
  v_shop:=private.assert_partner_v11_read_membership(p_workspace_id,p_auth_user_id);
  select membership.role::text into v_role from private.partner_memberships membership
    where membership.workspace_id=p_workspace_id and membership.auth_user_id=p_auth_user_id and membership.status='active' for key share;
  if not exists(select 1 from private.review_widget_settings_v11 where workspace_id=p_workspace_id) and v_role='owner' then
    insert into private.review_widget_settings_v11(workspace_id,shop_id) values(p_workspace_id,v_shop) on conflict(workspace_id) do nothing;
  end if;
  return query select setting.public_handle,setting.state,setting.revision,shop.name,shop.canonical_path
    from private.review_widget_settings_v11 setting join app.shops shop on shop.id=setting.shop_id
    where setting.workspace_id=p_workspace_id and setting.shop_id=v_shop;
end $$;

create or replace function private.get_partner_canonical_growth_v11(
  p_workspace_id uuid,p_auth_user_id uuid
) returns table(workspace_id uuid,app_shop_id uuid,review_handle uuid,widget_handle uuid,shop_name text,canonical_path text,submitted_reviews bigint,pending_reviews bigint,published_reviews bigint)
language plpgsql security definer set search_path=private,app,pg_temp as $$
declare v_shop uuid; v_review_handle uuid; v_widget_handle uuid; v_role text;
begin
  v_shop:=private.assert_partner_canonical_membership(p_workspace_id,p_auth_user_id);
  select membership.role::text into v_role from private.partner_memberships membership
    where membership.workspace_id=p_workspace_id and membership.auth_user_id=p_auth_user_id and membership.status='active' for key share;
  if v_role='owner' then
    select link.public_handle into v_review_handle from private.create_partner_review_entry_link(p_workspace_id,null,'line') link;
  else
    select link.public_handle into v_review_handle
    from private.partner_review_entry_link_bindings binding
    join private.review_entry_links link on link.id=binding.link_id
    where binding.workspace_id=p_workspace_id and binding.therapist_assignment_id is null and binding.channel='line'
      and link.is_active and (link.expires_at is null or link.expires_at>now());
  end if;
  select widget.public_handle into v_widget_handle from private.get_partner_review_widget_v11(p_workspace_id,p_auth_user_id) widget;
  return query
    select p_workspace_id,v_shop,v_review_handle,v_widget_handle,shop.name,shop.canonical_path,
      (select count(*) from private.review_experiences experience where experience.shop_id=v_shop and experience.state<>'withdrawn'),
      (select count(*) from private.review_experiences experience where experience.shop_id=v_shop and experience.state in ('submitted','under_review')),
      (select count(*) from app.review_experience_publications publication where publication.shop_id=v_shop and publication.publication_state='published')
    from app.shops shop where shop.id=v_shop;
end $$;

revoke all on function private.assert_partner_v11_read_membership(uuid,uuid),private.get_partner_review_widget_v11(uuid,uuid),private.get_partner_canonical_growth_v11(uuid,uuid) from public,anon,authenticated;
grant execute on function private.assert_partner_v11_read_membership(uuid,uuid),private.get_partner_review_widget_v11(uuid,uuid),private.get_partner_canonical_growth_v11(uuid,uuid) to service_role;

notify pgrst,'reload schema';
$eskomi_packet_03_5$], 'eskomi_partner_read_roles', null, null, null);

-- SOURCE 20261017163000_eskomi_canonical_partner_registration_review.sql
-- SHA-256 bbce76f47cfbb3100cdcb37bd614018b7fa187c2c57cd01d984e526812d72af1
-- Keep the original WordPress-shaped registration RPCs for existing stores,
-- while giving the canonical app_shop_id path an explicit v1.1 contract.
-- No browser role receives these service-only moderation endpoints.

create or replace function private.list_partner_registration_reviews_v11()
returns table (
  submission_id uuid,
  workspace_id uuid,
  status text,
  contact_name text,
  contact_role text,
  contact_email text,
  confirmation_details text,
  source_url text,
  created_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by text,
  review_reason text,
  workspace_state text,
  identity_kind text,
  app_shop_id uuid,
  wp_shop_id bigint,
  shop_slug text,
  shop_name text,
  canonical_url text,
  campaigns jsonb
)
language sql security invoker set search_path=private,app,pg_temp as $$
  select submission.id,submission.workspace_id,submission.status,submission.contact_name,submission.contact_role,
    submission.contact_email,submission.confirmation_details,submission.source_url,submission.created_at,
    submission.reviewed_at,submission.reviewed_by,submission.review_reason,workspace.state::text,
    case when workspace.app_shop_id is not null then 'canonical' else 'legacy' end,
    workspace.app_shop_id,workspace.wp_shop_id,
    coalesce(shop.slug,workspace.shop_slug),coalesce(shop.name,workspace.shop_name),
    case when shop.id is not null then 'https://mens-esthe-kuchikomi.com' || shop.canonical_path else workspace.canonical_url end,
    coalesce(jsonb_agg(jsonb_build_object('id',campaign.id,'channel',campaign.channel::text,'token',campaign.token,
      'isActive',campaign.is_active,'createdAt',campaign.created_at) order by campaign.channel)
      filter(where campaign.id is not null),'[]'::jsonb)
  from private.partner_registration_submissions submission
  join private.partner_workspaces workspace on workspace.id=submission.workspace_id
  left join app.shops shop on shop.id=workspace.app_shop_id
  left join private.partner_review_campaigns campaign on campaign.workspace_id=workspace.id
  group by submission.id,workspace.id,shop.id
  order by submission.created_at desc
$$;

create or replace function private.review_partner_registration_v11(
  p_submission_id uuid,p_decision text,p_actor_label text,p_reason text
)
returns table (
  state text,status text,workspace_id uuid,identity_kind text,app_shop_id uuid,wp_shop_id bigint,
  shop_slug text,canonical_url text
)
language plpgsql security invoker set search_path=private,app,pg_temp as $$
declare v_workspace private.partner_workspaces%rowtype;
begin
  select workspace.* into v_workspace
  from private.partner_registration_submissions submission
  join private.partner_workspaces workspace on workspace.id=submission.workspace_id
  where submission.id=p_submission_id
  for key share of workspace;
  if v_workspace.id is null then raise exception 'partner registration submission not found' using errcode='P0002'; end if;
  if v_workspace.app_shop_id is not null and not exists (
    select 1 from private.managed_shops managed join app.shops shop on shop.id=managed.app_shop_id
    where managed.app_shop_id=v_workspace.app_shop_id and managed.publication_state='published'
      and shop.publication_status='published' and managed.shop_slug=shop.slug
  ) then
    raise exception 'canonical partner registration has no published managed shop' using errcode='23514';
  end if;
  return query
    select reviewed.state,reviewed.status,workspace.id,
      case when workspace.app_shop_id is not null then 'canonical' else 'legacy' end,
      workspace.app_shop_id,workspace.wp_shop_id,coalesce(shop.slug,workspace.shop_slug),
      case when shop.id is not null then 'https://mens-esthe-kuchikomi.com' || shop.canonical_path else workspace.canonical_url end
    from private.review_partner_registration(p_submission_id,p_decision,p_actor_label,p_reason) reviewed
    join private.partner_registration_submissions submission on submission.id=p_submission_id
    join private.partner_workspaces workspace on workspace.id=submission.workspace_id
    left join app.shops shop on shop.id=workspace.app_shop_id;
end $$;

create or replace function api.list_partner_registration_reviews_v11()
returns table (
  submission_id uuid,workspace_id uuid,status text,contact_name text,contact_role text,contact_email text,
  confirmation_details text,source_url text,created_at timestamptz,reviewed_at timestamptz,reviewed_by text,
  review_reason text,workspace_state text,identity_kind text,app_shop_id uuid,wp_shop_id bigint,shop_slug text,
  shop_name text,canonical_url text,campaigns jsonb
)
language sql security invoker set search_path=private,api,pg_temp as $$
  select * from private.list_partner_registration_reviews_v11()
$$;

create or replace function api.review_partner_registration_v11(
  p_submission_id uuid,p_decision text,p_actor_label text,p_reason text
)
returns table (
  state text,status text,workspace_id uuid,identity_kind text,app_shop_id uuid,wp_shop_id bigint,
  shop_slug text,canonical_url text
)
language sql security invoker set search_path=private,api,pg_temp as $$
  select * from private.review_partner_registration_v11(p_submission_id,p_decision,p_actor_label,p_reason)
$$;

revoke all on function private.list_partner_registration_reviews_v11(),private.review_partner_registration_v11(uuid,text,text,text),api.list_partner_registration_reviews_v11(),api.review_partner_registration_v11(uuid,text,text,text) from public,anon,authenticated;
grant execute on function private.list_partner_registration_reviews_v11(),private.review_partner_registration_v11(uuid,text,text,text),api.list_partner_registration_reviews_v11(),api.review_partner_registration_v11(uuid,text,text,text) to service_role;

notify pgrst,'reload schema';

insert into supabase_migrations.schema_migrations
  (version, statements, name, created_by, idempotency_key, rollback)
values
  ('20261017163000', array[$eskomi_packet_03_6$-- Keep the original WordPress-shaped registration RPCs for existing stores,
-- while giving the canonical app_shop_id path an explicit v1.1 contract.
-- No browser role receives these service-only moderation endpoints.

create or replace function private.list_partner_registration_reviews_v11()
returns table (
  submission_id uuid,
  workspace_id uuid,
  status text,
  contact_name text,
  contact_role text,
  contact_email text,
  confirmation_details text,
  source_url text,
  created_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by text,
  review_reason text,
  workspace_state text,
  identity_kind text,
  app_shop_id uuid,
  wp_shop_id bigint,
  shop_slug text,
  shop_name text,
  canonical_url text,
  campaigns jsonb
)
language sql security invoker set search_path=private,app,pg_temp as $$
  select submission.id,submission.workspace_id,submission.status,submission.contact_name,submission.contact_role,
    submission.contact_email,submission.confirmation_details,submission.source_url,submission.created_at,
    submission.reviewed_at,submission.reviewed_by,submission.review_reason,workspace.state::text,
    case when workspace.app_shop_id is not null then 'canonical' else 'legacy' end,
    workspace.app_shop_id,workspace.wp_shop_id,
    coalesce(shop.slug,workspace.shop_slug),coalesce(shop.name,workspace.shop_name),
    case when shop.id is not null then 'https://mens-esthe-kuchikomi.com' || shop.canonical_path else workspace.canonical_url end,
    coalesce(jsonb_agg(jsonb_build_object('id',campaign.id,'channel',campaign.channel::text,'token',campaign.token,
      'isActive',campaign.is_active,'createdAt',campaign.created_at) order by campaign.channel)
      filter(where campaign.id is not null),'[]'::jsonb)
  from private.partner_registration_submissions submission
  join private.partner_workspaces workspace on workspace.id=submission.workspace_id
  left join app.shops shop on shop.id=workspace.app_shop_id
  left join private.partner_review_campaigns campaign on campaign.workspace_id=workspace.id
  group by submission.id,workspace.id,shop.id
  order by submission.created_at desc
$$;

create or replace function private.review_partner_registration_v11(
  p_submission_id uuid,p_decision text,p_actor_label text,p_reason text
)
returns table (
  state text,status text,workspace_id uuid,identity_kind text,app_shop_id uuid,wp_shop_id bigint,
  shop_slug text,canonical_url text
)
language plpgsql security invoker set search_path=private,app,pg_temp as $$
declare v_workspace private.partner_workspaces%rowtype;
begin
  select workspace.* into v_workspace
  from private.partner_registration_submissions submission
  join private.partner_workspaces workspace on workspace.id=submission.workspace_id
  where submission.id=p_submission_id
  for key share of workspace;
  if v_workspace.id is null then raise exception 'partner registration submission not found' using errcode='P0002'; end if;
  if v_workspace.app_shop_id is not null and not exists (
    select 1 from private.managed_shops managed join app.shops shop on shop.id=managed.app_shop_id
    where managed.app_shop_id=v_workspace.app_shop_id and managed.publication_state='published'
      and shop.publication_status='published' and managed.shop_slug=shop.slug
  ) then
    raise exception 'canonical partner registration has no published managed shop' using errcode='23514';
  end if;
  return query
    select reviewed.state,reviewed.status,workspace.id,
      case when workspace.app_shop_id is not null then 'canonical' else 'legacy' end,
      workspace.app_shop_id,workspace.wp_shop_id,coalesce(shop.slug,workspace.shop_slug),
      case when shop.id is not null then 'https://mens-esthe-kuchikomi.com' || shop.canonical_path else workspace.canonical_url end
    from private.review_partner_registration(p_submission_id,p_decision,p_actor_label,p_reason) reviewed
    join private.partner_registration_submissions submission on submission.id=p_submission_id
    join private.partner_workspaces workspace on workspace.id=submission.workspace_id
    left join app.shops shop on shop.id=workspace.app_shop_id;
end $$;

create or replace function api.list_partner_registration_reviews_v11()
returns table (
  submission_id uuid,workspace_id uuid,status text,contact_name text,contact_role text,contact_email text,
  confirmation_details text,source_url text,created_at timestamptz,reviewed_at timestamptz,reviewed_by text,
  review_reason text,workspace_state text,identity_kind text,app_shop_id uuid,wp_shop_id bigint,shop_slug text,
  shop_name text,canonical_url text,campaigns jsonb
)
language sql security invoker set search_path=private,api,pg_temp as $$
  select * from private.list_partner_registration_reviews_v11()
$$;

create or replace function api.review_partner_registration_v11(
  p_submission_id uuid,p_decision text,p_actor_label text,p_reason text
)
returns table (
  state text,status text,workspace_id uuid,identity_kind text,app_shop_id uuid,wp_shop_id bigint,
  shop_slug text,canonical_url text
)
language sql security invoker set search_path=private,api,pg_temp as $$
  select * from private.review_partner_registration_v11(p_submission_id,p_decision,p_actor_label,p_reason)
$$;

revoke all on function private.list_partner_registration_reviews_v11(),private.review_partner_registration_v11(uuid,text,text,text),api.list_partner_registration_reviews_v11(),api.review_partner_registration_v11(uuid,text,text,text) from public,anon,authenticated;
grant execute on function private.list_partner_registration_reviews_v11(),private.review_partner_registration_v11(uuid,text,text,text),api.list_partner_registration_reviews_v11(),api.review_partner_registration_v11(uuid,text,text,text) to service_role;

notify pgrst,'reload schema';
$eskomi_packet_03_6$], 'eskomi_canonical_partner_registration_review', null, null, null);

-- SOURCE 20261017164000_eskomi_legacy_workspace_mapping.sql
-- SHA-256 81b7924912003da5e867046754c9c226fa849257c0a2b85a8728ab4b70b8c586
-- Explicit, reviewable bridge from a legacy WP workspace to the canonical
-- app_shop_id identity. It never matches by name and never runs automatically.

create table private.partner_workspace_legacy_aliases_v11 (
  workspace_id uuid primary key references private.partner_workspaces(id) on delete restrict,
  legacy_wp_shop_id bigint not null unique check (legacy_wp_shop_id > 0),
  legacy_shop_slug text not null check (char_length(btrim(legacy_shop_slug)) between 1 and 200),
  legacy_canonical_url text not null check (legacy_canonical_url ~ '^https?://'),
  mapped_at timestamptz not null default now(),
  mapped_by text not null check (char_length(btrim(mapped_by)) between 1 and 120)
);
alter table private.partner_workspace_legacy_aliases_v11 enable row level security;
revoke all on table private.partner_workspace_legacy_aliases_v11 from public,anon,authenticated;
grant select,insert on table private.partner_workspace_legacy_aliases_v11 to service_role;

create or replace function private.list_legacy_partner_workspace_mapping_candidates_v11()
returns table (
  workspace_id uuid,legacy_wp_shop_id bigint,legacy_shop_slug text,legacy_canonical_url text,
  managed_shop_id uuid,app_shop_id uuid,app_shop_slug text,app_canonical_path text,mapping_status text
)
language sql security invoker set search_path=private,app,pg_temp as $$
  select workspace.id,workspace.wp_shop_id,workspace.shop_slug,workspace.canonical_url,
    managed.id,managed.app_shop_id,shop.slug,shop.canonical_path,
    case
      when workspace.app_shop_id is not null then 'already_canonical'
      when managed.id is null then 'no_exact_managed_shop'
      when managed.app_shop_id is null then 'managed_shop_unbound'
      when shop.id is null then 'app_shop_missing'
      when managed.shop_slug<>workspace.shop_slug or managed.existing_shop_slug<>workspace.shop_slug then 'slug_mismatch'
      when shop.slug<>workspace.shop_slug then 'app_slug_mismatch'
      when shop.canonical_path<>('/shops/'||workspace.shop_slug||'/') then 'canonical_path_mismatch'
      else 'ready'
    end
  from private.partner_workspaces workspace
  left join private.managed_shops managed on managed.existing_wp_shop_id=workspace.wp_shop_id
  left join app.shops shop on shop.id=managed.app_shop_id
  where workspace.wp_shop_id is not null
  order by workspace.created_at
$$;

create or replace function private.bind_legacy_managed_shop_to_app_shop_v11(
  p_managed_shop_id uuid,p_app_shop_id uuid,p_actor_label text
) returns text
language plpgsql security invoker set search_path=private,app,pg_temp as $$
declare managed private.managed_shops%rowtype; shop app.shops%rowtype;
begin
  if char_length(btrim(coalesce(p_actor_label,''))) not between 1 and 120 then raise exception 'mapping actor is required' using errcode='22023'; end if;
  select * into managed from private.managed_shops where id=p_managed_shop_id for update;
  select * into shop from app.shops where id=p_app_shop_id for key share;
  if managed.id is null or shop.id is null then raise exception 'mapping target not found' using errcode='P0002'; end if;
  if managed.existing_wp_shop_id is null or managed.app_shop_id is not null
    or managed.existing_shop_slug<>managed.shop_slug or managed.shop_slug<>shop.slug
    or shop.canonical_path<>('/shops/'||managed.shop_slug||'/') then
    raise exception 'legacy managed shop mapping is not an exact identity match' using errcode='23514';
  end if;
  if exists(select 1 from private.managed_shops other where other.app_shop_id=p_app_shop_id and other.id<>managed.id) then
    raise exception 'app shop is already mapped' using errcode='23505';
  end if;
  update private.managed_shops set app_shop_id=p_app_shop_id,updated_at=now() where id=managed.id;
  if managed.publication_state='published' then perform private.sync_canonical_managed_shop_publication_v11(managed.id); end if;
  return 'bound';
end $$;

create or replace function private.map_legacy_partner_workspace_to_canonical_v11(
  p_workspace_id uuid,p_managed_shop_id uuid,p_app_shop_id uuid,p_actor_label text
) returns text
language plpgsql security invoker set search_path=private,app,pg_temp as $$
declare workspace private.partner_workspaces%rowtype; candidate record;
begin
  if char_length(btrim(coalesce(p_actor_label,''))) not between 1 and 120 then raise exception 'mapping actor is required' using errcode='22023'; end if;
  select * into workspace from private.partner_workspaces where id=p_workspace_id for update;
  if workspace.id is null then raise exception 'partner workspace not found' using errcode='P0002'; end if;
  select * into candidate from private.list_legacy_partner_workspace_mapping_candidates_v11() where workspace_id=p_workspace_id;
  if candidate.mapping_status<>'ready' or candidate.managed_shop_id<>p_managed_shop_id or candidate.app_shop_id<>p_app_shop_id then
    raise exception 'legacy workspace mapping is not an exact approved candidate' using errcode='23514';
  end if;
  insert into private.partner_workspace_legacy_aliases_v11(workspace_id,legacy_wp_shop_id,legacy_shop_slug,legacy_canonical_url,mapped_by)
  values(workspace.id,workspace.wp_shop_id,workspace.shop_slug,workspace.canonical_url,btrim(p_actor_label));
  update private.partner_workspaces set app_shop_id=p_app_shop_id,wp_shop_id=null,updated_at=now() where id=workspace.id;
  return 'mapped';
end $$;

create or replace function api.list_legacy_partner_workspace_mapping_candidates_v11()
returns table (workspace_id uuid,legacy_wp_shop_id bigint,legacy_shop_slug text,legacy_canonical_url text,managed_shop_id uuid,app_shop_id uuid,app_shop_slug text,app_canonical_path text,mapping_status text)
language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.list_legacy_partner_workspace_mapping_candidates_v11() $$;
create or replace function api.bind_legacy_managed_shop_to_app_shop_v11(p_managed_shop_id uuid,p_app_shop_id uuid,p_actor_label text)
returns text language sql security invoker set search_path=private,api,pg_temp as $$ select private.bind_legacy_managed_shop_to_app_shop_v11(p_managed_shop_id,p_app_shop_id,p_actor_label) $$;
create or replace function api.map_legacy_partner_workspace_to_canonical_v11(p_workspace_id uuid,p_managed_shop_id uuid,p_app_shop_id uuid,p_actor_label text)
returns text language sql security invoker set search_path=private,api,pg_temp as $$ select private.map_legacy_partner_workspace_to_canonical_v11(p_workspace_id,p_managed_shop_id,p_app_shop_id,p_actor_label) $$;
revoke all on function private.list_legacy_partner_workspace_mapping_candidates_v11(),private.bind_legacy_managed_shop_to_app_shop_v11(uuid,uuid,text),private.map_legacy_partner_workspace_to_canonical_v11(uuid,uuid,uuid,text),api.list_legacy_partner_workspace_mapping_candidates_v11(),api.bind_legacy_managed_shop_to_app_shop_v11(uuid,uuid,text),api.map_legacy_partner_workspace_to_canonical_v11(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function private.list_legacy_partner_workspace_mapping_candidates_v11(),private.bind_legacy_managed_shop_to_app_shop_v11(uuid,uuid,text),private.map_legacy_partner_workspace_to_canonical_v11(uuid,uuid,uuid,text),api.list_legacy_partner_workspace_mapping_candidates_v11(),api.bind_legacy_managed_shop_to_app_shop_v11(uuid,uuid,text),api.map_legacy_partner_workspace_to_canonical_v11(uuid,uuid,uuid,text) to service_role;
notify pgrst,'reload schema';

insert into supabase_migrations.schema_migrations
  (version, statements, name, created_by, idempotency_key, rollback)
values
  ('20261017164000', array[$eskomi_packet_03_7$-- Explicit, reviewable bridge from a legacy WP workspace to the canonical
-- app_shop_id identity. It never matches by name and never runs automatically.

create table private.partner_workspace_legacy_aliases_v11 (
  workspace_id uuid primary key references private.partner_workspaces(id) on delete restrict,
  legacy_wp_shop_id bigint not null unique check (legacy_wp_shop_id > 0),
  legacy_shop_slug text not null check (char_length(btrim(legacy_shop_slug)) between 1 and 200),
  legacy_canonical_url text not null check (legacy_canonical_url ~ '^https?://'),
  mapped_at timestamptz not null default now(),
  mapped_by text not null check (char_length(btrim(mapped_by)) between 1 and 120)
);
alter table private.partner_workspace_legacy_aliases_v11 enable row level security;
revoke all on table private.partner_workspace_legacy_aliases_v11 from public,anon,authenticated;
grant select,insert on table private.partner_workspace_legacy_aliases_v11 to service_role;

create or replace function private.list_legacy_partner_workspace_mapping_candidates_v11()
returns table (
  workspace_id uuid,legacy_wp_shop_id bigint,legacy_shop_slug text,legacy_canonical_url text,
  managed_shop_id uuid,app_shop_id uuid,app_shop_slug text,app_canonical_path text,mapping_status text
)
language sql security invoker set search_path=private,app,pg_temp as $$
  select workspace.id,workspace.wp_shop_id,workspace.shop_slug,workspace.canonical_url,
    managed.id,managed.app_shop_id,shop.slug,shop.canonical_path,
    case
      when workspace.app_shop_id is not null then 'already_canonical'
      when managed.id is null then 'no_exact_managed_shop'
      when managed.app_shop_id is null then 'managed_shop_unbound'
      when shop.id is null then 'app_shop_missing'
      when managed.shop_slug<>workspace.shop_slug or managed.existing_shop_slug<>workspace.shop_slug then 'slug_mismatch'
      when shop.slug<>workspace.shop_slug then 'app_slug_mismatch'
      when shop.canonical_path<>('/shops/'||workspace.shop_slug||'/') then 'canonical_path_mismatch'
      else 'ready'
    end
  from private.partner_workspaces workspace
  left join private.managed_shops managed on managed.existing_wp_shop_id=workspace.wp_shop_id
  left join app.shops shop on shop.id=managed.app_shop_id
  where workspace.wp_shop_id is not null
  order by workspace.created_at
$$;

create or replace function private.bind_legacy_managed_shop_to_app_shop_v11(
  p_managed_shop_id uuid,p_app_shop_id uuid,p_actor_label text
) returns text
language plpgsql security invoker set search_path=private,app,pg_temp as $$
declare managed private.managed_shops%rowtype; shop app.shops%rowtype;
begin
  if char_length(btrim(coalesce(p_actor_label,''))) not between 1 and 120 then raise exception 'mapping actor is required' using errcode='22023'; end if;
  select * into managed from private.managed_shops where id=p_managed_shop_id for update;
  select * into shop from app.shops where id=p_app_shop_id for key share;
  if managed.id is null or shop.id is null then raise exception 'mapping target not found' using errcode='P0002'; end if;
  if managed.existing_wp_shop_id is null or managed.app_shop_id is not null
    or managed.existing_shop_slug<>managed.shop_slug or managed.shop_slug<>shop.slug
    or shop.canonical_path<>('/shops/'||managed.shop_slug||'/') then
    raise exception 'legacy managed shop mapping is not an exact identity match' using errcode='23514';
  end if;
  if exists(select 1 from private.managed_shops other where other.app_shop_id=p_app_shop_id and other.id<>managed.id) then
    raise exception 'app shop is already mapped' using errcode='23505';
  end if;
  update private.managed_shops set app_shop_id=p_app_shop_id,updated_at=now() where id=managed.id;
  if managed.publication_state='published' then perform private.sync_canonical_managed_shop_publication_v11(managed.id); end if;
  return 'bound';
end $$;

create or replace function private.map_legacy_partner_workspace_to_canonical_v11(
  p_workspace_id uuid,p_managed_shop_id uuid,p_app_shop_id uuid,p_actor_label text
) returns text
language plpgsql security invoker set search_path=private,app,pg_temp as $$
declare workspace private.partner_workspaces%rowtype; candidate record;
begin
  if char_length(btrim(coalesce(p_actor_label,''))) not between 1 and 120 then raise exception 'mapping actor is required' using errcode='22023'; end if;
  select * into workspace from private.partner_workspaces where id=p_workspace_id for update;
  if workspace.id is null then raise exception 'partner workspace not found' using errcode='P0002'; end if;
  select * into candidate from private.list_legacy_partner_workspace_mapping_candidates_v11() where workspace_id=p_workspace_id;
  if candidate.mapping_status<>'ready' or candidate.managed_shop_id<>p_managed_shop_id or candidate.app_shop_id<>p_app_shop_id then
    raise exception 'legacy workspace mapping is not an exact approved candidate' using errcode='23514';
  end if;
  insert into private.partner_workspace_legacy_aliases_v11(workspace_id,legacy_wp_shop_id,legacy_shop_slug,legacy_canonical_url,mapped_by)
  values(workspace.id,workspace.wp_shop_id,workspace.shop_slug,workspace.canonical_url,btrim(p_actor_label));
  update private.partner_workspaces set app_shop_id=p_app_shop_id,wp_shop_id=null,updated_at=now() where id=workspace.id;
  return 'mapped';
end $$;

create or replace function api.list_legacy_partner_workspace_mapping_candidates_v11()
returns table (workspace_id uuid,legacy_wp_shop_id bigint,legacy_shop_slug text,legacy_canonical_url text,managed_shop_id uuid,app_shop_id uuid,app_shop_slug text,app_canonical_path text,mapping_status text)
language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.list_legacy_partner_workspace_mapping_candidates_v11() $$;
create or replace function api.bind_legacy_managed_shop_to_app_shop_v11(p_managed_shop_id uuid,p_app_shop_id uuid,p_actor_label text)
returns text language sql security invoker set search_path=private,api,pg_temp as $$ select private.bind_legacy_managed_shop_to_app_shop_v11(p_managed_shop_id,p_app_shop_id,p_actor_label) $$;
create or replace function api.map_legacy_partner_workspace_to_canonical_v11(p_workspace_id uuid,p_managed_shop_id uuid,p_app_shop_id uuid,p_actor_label text)
returns text language sql security invoker set search_path=private,api,pg_temp as $$ select private.map_legacy_partner_workspace_to_canonical_v11(p_workspace_id,p_managed_shop_id,p_app_shop_id,p_actor_label) $$;
revoke all on function private.list_legacy_partner_workspace_mapping_candidates_v11(),private.bind_legacy_managed_shop_to_app_shop_v11(uuid,uuid,text),private.map_legacy_partner_workspace_to_canonical_v11(uuid,uuid,uuid,text),api.list_legacy_partner_workspace_mapping_candidates_v11(),api.bind_legacy_managed_shop_to_app_shop_v11(uuid,uuid,text),api.map_legacy_partner_workspace_to_canonical_v11(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function private.list_legacy_partner_workspace_mapping_candidates_v11(),private.bind_legacy_managed_shop_to_app_shop_v11(uuid,uuid,text),private.map_legacy_partner_workspace_to_canonical_v11(uuid,uuid,uuid,text),api.list_legacy_partner_workspace_mapping_candidates_v11(),api.bind_legacy_managed_shop_to_app_shop_v11(uuid,uuid,text),api.map_legacy_partner_workspace_to_canonical_v11(uuid,uuid,uuid,text) to service_role;
notify pgrst,'reload schema';
$eskomi_packet_03_7$], 'eskomi_legacy_workspace_mapping', null, null, null);
commit;

select jsonb_build_object(
  'status', 'COMMITTED',
  'project_ref_expected', 'goeagrxjsjcbbatpotbu',
  'stage', '03',
  'records', (
    select jsonb_agg(jsonb_build_object(
      'version', expected.version,
      'name', expected.name,
      'source_sha256', encode(extensions.digest(ledger.statements[1], 'sha256'), 'hex')
    ) order by expected.version)
    from (values ('20261017158000', 'eskomi_canonical_primary_area_transition', 'e45925db146edf2282d5bdc2a90d354c8b8ba57657f9f511aa6ff255d7913d39'), ('20261017159000', 'eskomi_canonical_partner_provisioning', '1b32232d0a5e8f7784c908731ccf284fb6358ebd967492b141baa5a7cd73cb9c'), ('20261017160000', 'eskomi_partner_workspace_compatibility', '7ca1a354a28cb2c612c0600844090aa5b82ba3ce208a1ef2e7084b34cafb3c9a'), ('20261017161000', 'eskomi_partner_area_selection', '925cafbdac5d25483260d099cea7159088a98b8e88e14bb6d2aa146476a3b13c'), ('20261017162000', 'eskomi_partner_read_roles', '99ee2ddbfef1967cd3e83eaf9e0a0ea948b6f8bffc94b417670acfdb2721127f'), ('20261017163000', 'eskomi_canonical_partner_registration_review', 'bbce76f47cfbb3100cdcb37bd614018b7fa187c2c57cd01d984e526812d72af1'), ('20261017164000', 'eskomi_legacy_workspace_mapping', '81b7924912003da5e867046754c9c226fa849257c0a2b85a8728ab4b70b8c586')) as expected(version, name, source_sha256)
    join supabase_migrations.schema_migrations as ledger using (version)
  )
) as stage_result;
