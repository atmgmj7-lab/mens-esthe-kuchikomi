-- Eskomi v1.1 manual SQL Editor packet: stage 05 of 05
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
      ('20261017171000', 'eskomi_public_profiles_access_and_community_guards', '01e924aa1853aa57201916d6d7da738c489f84ab713c2684299e1d07a4533992')
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
    where version in ('20261017172000', '20261017173000', '20261017174000', '20261017175000', '20261018100000', '20261020030000', '20261021000000')
  ) then
    raise exception 'stage 05 is already partly or wholly recorded; stop and use 00-checkpoint.sql';
  end if;
end;
$eskomi_preflight$;

-- SOURCE 20261017172000_eskomi_public_delivery_upgrade_hardening.sql
-- SHA-256 ba1c78f07ed7b10f4c820a761d8dfc122c0a365ac5f8308cb099991ce41bdfda
-- Follow-up hardening for the public therapist/profile and aggregate access
-- delivery added in 17171000.  This migration is deliberately additive: it
-- repairs already-applied projections rather than rewriting migration history.

create or replace function private.public_therapist_assignment_is_visible_v11(p_assignment_id uuid)
returns boolean language sql security definer set search_path=private,app,pg_temp as $$
  select exists(
    select 1
    from app.therapist_assignments assignment
    join app.shops shop on shop.id=assignment.shop_id and shop.publication_status='published'
    join private.managed_shops managed on managed.app_shop_id=shop.id and managed.publication_state='published'
    join private.therapist_assignment_rights rights on rights.assignment_id=assignment.id
    join private.therapist_assets asset on asset.workspace_id=rights.workspace_id and asset.object_key=assignment.photo_asset_key
    where assignment.id=p_assignment_id and assignment.lifecycle_state='active'
      and assignment.photo_rights_confirmed_at is not null
      and (assignment.active_until is null or assignment.active_until > now())
  )
$$;

create or replace function private.list_public_therapists_for_shop_v11(p_shop_slug text,p_limit integer default 20)
returns table(assignment_id uuid,display_name text,photo_asset_id uuid)
language sql security definer set search_path=private,app,pg_temp as $$
  select assignment.id,assignment.display_name,asset.id
  from app.therapist_assignments assignment
  join app.shops shop on shop.id=assignment.shop_id and shop.slug=p_shop_slug
  join private.therapist_assignment_rights rights on rights.assignment_id=assignment.id
  join private.therapist_assets asset on asset.workspace_id=rights.workspace_id and asset.object_key=assignment.photo_asset_key
  where private.public_therapist_assignment_is_visible_v11(assignment.id)
  order by assignment.active_from desc,assignment.id desc
  limit greatest(1,least(p_limit,50))
$$;

create or replace function private.get_public_therapist_profile_detail_v11(p_assignment_id uuid,p_limit integer default 20)
returns table(assignment_id uuid,display_name text,shop_slug text,shop_name text,shop_path text,official_line_url text,photo_asset_id uuid,review_handle uuid,rating smallint,body text,published_at timestamptz)
language sql security definer set search_path=private,app,pg_temp as $$
  select assignment.id,assignment.display_name,shop.slug,shop.name,shop.canonical_path,publication_shop.line_url,asset.id,
    publication.public_handle,nullif(revision.assessment_snapshot->>'therapistRating','')::smallint,revision.experience_comment,publication.published_at
  from app.therapist_assignments assignment
  join app.shops shop on shop.id=assignment.shop_id
  join private.managed_shops managed on managed.app_shop_id=shop.id
  left join private.managed_shop_publications publication_shop on publication_shop.managed_shop_id=managed.id
  join private.therapist_assignment_rights rights on rights.assignment_id=assignment.id
  join private.therapist_assets asset on asset.workspace_id=rights.workspace_id and asset.object_key=assignment.photo_asset_key
  left join app.review_experience_publications publication on publication.therapist_assignment_id=assignment.id and publication.publication_state='published'
  left join private.review_experience_revisions revision on revision.id=publication.active_revision_id and revision.moderation_state='approved'
  where assignment.id=p_assignment_id and private.public_therapist_assignment_is_visible_v11(assignment.id)
  order by publication.published_at desc nulls last,publication.id desc nulls last
  limit greatest(1,least(p_limit,20))
$$;

create or replace function private.list_public_therapist_sitemap_v11()
returns table(assignment_id uuid,updated_at timestamptz)
language sql security definer set search_path=private,app,pg_temp as $$
  select assignment.id,assignment.updated_at
  from app.therapist_assignments assignment
  where private.public_therapist_assignment_is_visible_v11(assignment.id)
  order by assignment.id
$$;

create or replace function private.get_public_therapist_photo_v11(p_assignment_id uuid)
returns table(object_key text,content_type text)
language sql security definer set search_path=private,app,pg_temp as $$
  select asset.object_key,asset.content_type
  from app.therapist_assignments assignment
  join private.therapist_assignment_rights rights on rights.assignment_id=assignment.id
  join private.therapist_assets asset on asset.workspace_id=rights.workspace_id and asset.object_key=assignment.photo_asset_key
  where assignment.id=p_assignment_id and private.public_therapist_assignment_is_visible_v11(assignment.id)
$$;

create table private.partner_shop_access_observation_days_v11 (
  shop_id uuid not null references app.shops(id) on delete restrict,
  observed_on date not null,
  collection_state text not null default 'observed' check (collection_state in ('observed','missing')),
  updated_at timestamptz not null default now(),
  primary key(shop_id,observed_on)
);
create table private.partner_shop_access_dedupe_v11 (
  shop_id uuid not null references app.shops(id) on delete restrict,
  observed_on date not null,
  event_kind text not null check (event_kind in ('shop_view','official_line_click')),
  browser_tag_hash text not null check (browser_tag_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null,
  primary key(shop_id,observed_on,event_kind,browser_tag_hash)
);
create index partner_shop_access_dedupe_expiry_v11 on private.partner_shop_access_dedupe_v11(expires_at);
alter table private.partner_shop_access_observation_days_v11 enable row level security;
alter table private.partner_shop_access_dedupe_v11 enable row level security;
revoke all on table private.partner_shop_access_observation_days_v11,private.partner_shop_access_dedupe_v11 from public,anon,authenticated;
grant select,insert,update,delete on table private.partner_shop_access_observation_days_v11,private.partner_shop_access_dedupe_v11 to service_role;

-- Existing event days are known observations.  The old first-observed marker
-- cannot prove a no-event day was collected, so those days intentionally stay
-- unknown rather than being displayed as zero.
insert into private.partner_shop_access_observation_days_v11(shop_id,observed_on,collection_state,updated_at)
select shop_id,observed_on,'observed',updated_at from private.partner_shop_access_daily_v11
on conflict(shop_id,observed_on) do nothing;

drop function api.record_public_shop_access_v11(text,text);
drop function private.record_public_shop_access_v11(text,text);
create function private.record_public_shop_access_v11(p_shop_slug text,p_event_kind text,p_browser_tag_hash text)
returns void language plpgsql security definer set search_path=private,app,pg_temp as $$
declare v_shop_id uuid; v_day date; v_inserted integer; v_current bigint;
begin
  if p_event_kind not in ('shop_view','official_line_click') or p_shop_slug is null or p_shop_slug !~ '^[^/[:space:]\\]+$'
    or p_browser_tag_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid public access event' using errcode='22023';
  end if;
  select shop.id into v_shop_id from app.shops shop join private.managed_shops managed on managed.app_shop_id=shop.id
    where shop.slug=p_shop_slug and shop.publication_status='published' and managed.publication_state='published';
  if not found then raise exception 'shop unavailable' using errcode='P0002'; end if;
  v_day := (now() at time zone 'Asia/Tokyo')::date;
  insert into private.partner_shop_access_dedupe_v11(shop_id,observed_on,event_kind,browser_tag_hash,expires_at)
    values(v_shop_id,v_day,p_event_kind,p_browser_tag_hash,now()+interval '2 days')
    on conflict do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted=0 then return; end if;
  insert into private.partner_shop_access_daily_v11(shop_id,observed_on) values(v_shop_id,v_day) on conflict do nothing;
  select case when p_event_kind='shop_view' then shop_view_count else official_line_click_count end into v_current
    from private.partner_shop_access_daily_v11 where shop_id=v_shop_id and observed_on=v_day for update;
  if v_current >= 10000 then raise exception 'access event burst limit reached' using errcode='22023'; end if;
  update private.partner_shop_access_daily_v11 set
    shop_view_count=shop_view_count + case when p_event_kind='shop_view' then 1 else 0 end,
    official_line_click_count=official_line_click_count + case when p_event_kind='official_line_click' then 1 else 0 end,
    updated_at=now()
    where shop_id=v_shop_id and observed_on=v_day;
  insert into private.partner_shop_access_observation_days_v11(shop_id,observed_on,collection_state)
    values(v_shop_id,v_day,'observed')
    on conflict(shop_id,observed_on) do update set collection_state='observed',updated_at=now();
  insert into private.partner_shop_access_rollup_state_v11(shop_id,first_observed_on)
    values(v_shop_id,v_day) on conflict(shop_id) do update set updated_at=now();
end $$;
create function api.record_public_shop_access_v11(p_shop_slug text,p_event_kind text,p_browser_tag_hash text)
returns void language sql security invoker set search_path=private,api,pg_temp as $$
  select private.record_public_shop_access_v11(p_shop_slug,p_event_kind,p_browser_tag_hash)
$$;

create function private.mark_partner_shop_access_observed_day_v11(p_observed_on date)
returns void language plpgsql security definer set search_path=private,app,pg_temp as $$
begin
  if p_observed_on is null or p_observed_on > (now() at time zone 'Asia/Tokyo')::date then raise exception 'invalid observation day' using errcode='22023'; end if;
  insert into private.partner_shop_access_observation_days_v11(shop_id,observed_on,collection_state)
  select shop.id,p_observed_on,'observed'
  from app.shops shop join private.managed_shops managed on managed.app_shop_id=shop.id
  where shop.publication_status='published' and managed.publication_state='published'
  on conflict(shop_id,observed_on) do update set collection_state='observed',updated_at=now();
end $$;

create or replace function private.get_partner_shop_access_report_v11(p_workspace_id uuid,p_auth_user_id uuid,p_from date,p_to date)
returns table(observed_on date,shop_view_count bigint,official_line_click_count bigint,has_data boolean,updated_at timestamptz)
language plpgsql security definer set search_path=private,app,pg_temp as $$
declare v_shop_id uuid;
begin
  if p_from is null or p_to is null or p_from>p_to or p_to-p_from>179 then raise exception 'invalid report range' using errcode='22023'; end if;
  perform private.assert_partner_therapist_membership(p_workspace_id,p_auth_user_id);
  select workspace.app_shop_id into v_shop_id from private.partner_workspaces workspace
    join app.shops shop on shop.id=workspace.app_shop_id and shop.publication_status='published'
    join private.managed_shops managed on managed.app_shop_id=shop.id and managed.publication_state='published'
    where workspace.id=p_workspace_id;
  if v_shop_id is null then raise exception 'partner shop is unavailable' using errcode='42501'; end if;
  return query
    select days.observed_on::date,coalesce(daily.shop_view_count,0),coalesce(daily.official_line_click_count,0),
      observation.collection_state='observed',
      greatest(daily.updated_at,observation.updated_at)
    from generate_series(p_from,p_to,interval '1 day') days(observed_on)
    left join private.partner_shop_access_daily_v11 daily on daily.shop_id=v_shop_id and daily.observed_on=days.observed_on::date
    left join private.partner_shop_access_observation_days_v11 observation on observation.shop_id=v_shop_id and observation.observed_on=days.observed_on::date
    order by days.observed_on;
end $$;

-- Bind only legacy appeals whose currently active action is provably the exact
-- rejected/hidden state.  Others are retained for an auditable manual close;
-- no migration path guesses that a visitor withdrawal may be reopened.
with bindable as (
  select appeal.id,post.revision as target_post_revision,event.id as target_event_id,event.reason as target_reason
  from private.community_post_appeals_v11 appeal
  join private.community_posts_v11 post on post.id=appeal.post_id
  join lateral (
    select row.id,row.action,row.reason,row.revision from private.community_moderation_events_v11 row
    where row.entity_kind='community_post' and row.entity_id=post.id
    order by row.created_at desc,row.id desc limit 1
  ) event on true
  where appeal.state in ('received','reviewing') and appeal.target_post_revision is null
    and event.revision=post.revision
    and ((event.action='rejected' and post.moderation_state='rejected' and post.publication_state='draft' and post.withdrawn_at is null)
      or (event.action='hidden' and post.moderation_state='rejected' and post.publication_state='withdrawn'))
)
update private.community_post_appeals_v11 appeal
set target_post_revision=bindable.target_post_revision,target_event_id=bindable.target_event_id,target_reason=bindable.target_reason
from bindable where appeal.id=bindable.id;

with requires_manual_close as (
  update private.community_post_appeals_v11 appeal
  set state='reviewing',operator_reason='legacy appeal requires manual closure: current moderation target cannot be proven',revision=revision+1
  where appeal.state in ('received','reviewing') and appeal.target_post_revision is null
  returning appeal.post_id
)
insert into private.community_moderation_events_v11(entity_kind,entity_id,action,reason,operator_actor,revision)
select 'community_post',post_id,'appeal_legacy_requires_review','legacy appeal target cannot be proven','migration_20261017172000',post.revision
from requires_manual_close join private.community_posts_v11 post on post.id=requires_manual_close.post_id;

create or replace function private.review_community_appeal_v11(p_appeal_id uuid,p_decision text,p_reason text,p_expected_revision integer)
returns text language plpgsql security definer set search_path=private,pg_temp as $$
declare v_appeal private.community_post_appeals_v11%rowtype; v_post_revision integer; v_event_revision integer;
begin
  select * into v_appeal from private.community_post_appeals_v11
    where id=p_appeal_id and revision=p_expected_revision and state in ('received','reviewing') for update;
  if not found or p_decision not in ('dismiss','reopen_review') or char_length(btrim(coalesce(p_reason,'')))>1000 then raise exception 'appeal changed' using errcode='40001'; end if;
  if p_decision='reopen_review' then
    if v_appeal.target_post_revision is null or v_appeal.target_event_id is null then raise exception 'appeal target requires manual closure' using errcode='40001'; end if;
    update private.community_posts_v11 post set moderation_state='pending',publication_state='draft',published_at=null,withdrawn_at=null,operator_reason=btrim(p_reason),revision=revision+1
      where post.id=v_appeal.post_id and post.revision=v_appeal.target_post_revision and post.moderation_state='rejected'
        and ((post.publication_state='draft' and post.withdrawn_at is null) or post.publication_state='withdrawn')
        and exists(select 1 from private.community_moderation_events_v11 event where event.id=v_appeal.target_event_id and event.entity_kind='community_post'
          and event.entity_id=post.id and event.action in ('hidden','rejected') and event.revision=post.revision and event.reason=v_appeal.target_reason)
      returning revision into v_post_revision;
    if not found then raise exception 'appeal target is stale' using errcode='40001'; end if;
  end if;
  update private.community_post_appeals_v11 set state=case when p_decision='dismiss' then 'dismissed' else 'resolved' end,
    operator_reason=btrim(p_reason),revision=revision+1,resolved_at=now() where id=p_appeal_id;
  select revision into v_event_revision from private.community_posts_v11 where id=v_appeal.post_id;
  insert into private.community_moderation_events_v11(entity_kind,entity_id,action,reason,operator_actor,revision)
    values('community_post',v_appeal.post_id,'appeal_'||p_decision,btrim(p_reason),'dashboard_shared_operator',coalesce(v_post_revision,v_event_revision));
  return p_decision;
end $$;

revoke all on function private.public_therapist_assignment_is_visible_v11(uuid),private.mark_partner_shop_access_observed_day_v11(date),private.record_public_shop_access_v11(text,text,text),api.record_public_shop_access_v11(text,text,text) from public,anon,authenticated;
grant execute on function private.public_therapist_assignment_is_visible_v11(uuid),private.mark_partner_shop_access_observed_day_v11(date),private.record_public_shop_access_v11(text,text,text),api.record_public_shop_access_v11(text,text,text) to service_role;
notify pgrst,'reload schema';

insert into supabase_migrations.schema_migrations
  (version, statements, name, created_by, idempotency_key, rollback)
values
  ('20261017172000', array[$eskomi_packet_05_1$-- Follow-up hardening for the public therapist/profile and aggregate access
-- delivery added in 17171000.  This migration is deliberately additive: it
-- repairs already-applied projections rather than rewriting migration history.

create or replace function private.public_therapist_assignment_is_visible_v11(p_assignment_id uuid)
returns boolean language sql security definer set search_path=private,app,pg_temp as $$
  select exists(
    select 1
    from app.therapist_assignments assignment
    join app.shops shop on shop.id=assignment.shop_id and shop.publication_status='published'
    join private.managed_shops managed on managed.app_shop_id=shop.id and managed.publication_state='published'
    join private.therapist_assignment_rights rights on rights.assignment_id=assignment.id
    join private.therapist_assets asset on asset.workspace_id=rights.workspace_id and asset.object_key=assignment.photo_asset_key
    where assignment.id=p_assignment_id and assignment.lifecycle_state='active'
      and assignment.photo_rights_confirmed_at is not null
      and (assignment.active_until is null or assignment.active_until > now())
  )
$$;

create or replace function private.list_public_therapists_for_shop_v11(p_shop_slug text,p_limit integer default 20)
returns table(assignment_id uuid,display_name text,photo_asset_id uuid)
language sql security definer set search_path=private,app,pg_temp as $$
  select assignment.id,assignment.display_name,asset.id
  from app.therapist_assignments assignment
  join app.shops shop on shop.id=assignment.shop_id and shop.slug=p_shop_slug
  join private.therapist_assignment_rights rights on rights.assignment_id=assignment.id
  join private.therapist_assets asset on asset.workspace_id=rights.workspace_id and asset.object_key=assignment.photo_asset_key
  where private.public_therapist_assignment_is_visible_v11(assignment.id)
  order by assignment.active_from desc,assignment.id desc
  limit greatest(1,least(p_limit,50))
$$;

create or replace function private.get_public_therapist_profile_detail_v11(p_assignment_id uuid,p_limit integer default 20)
returns table(assignment_id uuid,display_name text,shop_slug text,shop_name text,shop_path text,official_line_url text,photo_asset_id uuid,review_handle uuid,rating smallint,body text,published_at timestamptz)
language sql security definer set search_path=private,app,pg_temp as $$
  select assignment.id,assignment.display_name,shop.slug,shop.name,shop.canonical_path,publication_shop.line_url,asset.id,
    publication.public_handle,nullif(revision.assessment_snapshot->>'therapistRating','')::smallint,revision.experience_comment,publication.published_at
  from app.therapist_assignments assignment
  join app.shops shop on shop.id=assignment.shop_id
  join private.managed_shops managed on managed.app_shop_id=shop.id
  left join private.managed_shop_publications publication_shop on publication_shop.managed_shop_id=managed.id
  join private.therapist_assignment_rights rights on rights.assignment_id=assignment.id
  join private.therapist_assets asset on asset.workspace_id=rights.workspace_id and asset.object_key=assignment.photo_asset_key
  left join app.review_experience_publications publication on publication.therapist_assignment_id=assignment.id and publication.publication_state='published'
  left join private.review_experience_revisions revision on revision.id=publication.active_revision_id and revision.moderation_state='approved'
  where assignment.id=p_assignment_id and private.public_therapist_assignment_is_visible_v11(assignment.id)
  order by publication.published_at desc nulls last,publication.id desc nulls last
  limit greatest(1,least(p_limit,20))
$$;

create or replace function private.list_public_therapist_sitemap_v11()
returns table(assignment_id uuid,updated_at timestamptz)
language sql security definer set search_path=private,app,pg_temp as $$
  select assignment.id,assignment.updated_at
  from app.therapist_assignments assignment
  where private.public_therapist_assignment_is_visible_v11(assignment.id)
  order by assignment.id
$$;

create or replace function private.get_public_therapist_photo_v11(p_assignment_id uuid)
returns table(object_key text,content_type text)
language sql security definer set search_path=private,app,pg_temp as $$
  select asset.object_key,asset.content_type
  from app.therapist_assignments assignment
  join private.therapist_assignment_rights rights on rights.assignment_id=assignment.id
  join private.therapist_assets asset on asset.workspace_id=rights.workspace_id and asset.object_key=assignment.photo_asset_key
  where assignment.id=p_assignment_id and private.public_therapist_assignment_is_visible_v11(assignment.id)
$$;

create table private.partner_shop_access_observation_days_v11 (
  shop_id uuid not null references app.shops(id) on delete restrict,
  observed_on date not null,
  collection_state text not null default 'observed' check (collection_state in ('observed','missing')),
  updated_at timestamptz not null default now(),
  primary key(shop_id,observed_on)
);
create table private.partner_shop_access_dedupe_v11 (
  shop_id uuid not null references app.shops(id) on delete restrict,
  observed_on date not null,
  event_kind text not null check (event_kind in ('shop_view','official_line_click')),
  browser_tag_hash text not null check (browser_tag_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null,
  primary key(shop_id,observed_on,event_kind,browser_tag_hash)
);
create index partner_shop_access_dedupe_expiry_v11 on private.partner_shop_access_dedupe_v11(expires_at);
alter table private.partner_shop_access_observation_days_v11 enable row level security;
alter table private.partner_shop_access_dedupe_v11 enable row level security;
revoke all on table private.partner_shop_access_observation_days_v11,private.partner_shop_access_dedupe_v11 from public,anon,authenticated;
grant select,insert,update,delete on table private.partner_shop_access_observation_days_v11,private.partner_shop_access_dedupe_v11 to service_role;

-- Existing event days are known observations.  The old first-observed marker
-- cannot prove a no-event day was collected, so those days intentionally stay
-- unknown rather than being displayed as zero.
insert into private.partner_shop_access_observation_days_v11(shop_id,observed_on,collection_state,updated_at)
select shop_id,observed_on,'observed',updated_at from private.partner_shop_access_daily_v11
on conflict(shop_id,observed_on) do nothing;

drop function api.record_public_shop_access_v11(text,text);
drop function private.record_public_shop_access_v11(text,text);
create function private.record_public_shop_access_v11(p_shop_slug text,p_event_kind text,p_browser_tag_hash text)
returns void language plpgsql security definer set search_path=private,app,pg_temp as $$
declare v_shop_id uuid; v_day date; v_inserted integer; v_current bigint;
begin
  if p_event_kind not in ('shop_view','official_line_click') or p_shop_slug is null or p_shop_slug !~ '^[^/[:space:]\\]+$'
    or p_browser_tag_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid public access event' using errcode='22023';
  end if;
  select shop.id into v_shop_id from app.shops shop join private.managed_shops managed on managed.app_shop_id=shop.id
    where shop.slug=p_shop_slug and shop.publication_status='published' and managed.publication_state='published';
  if not found then raise exception 'shop unavailable' using errcode='P0002'; end if;
  v_day := (now() at time zone 'Asia/Tokyo')::date;
  insert into private.partner_shop_access_dedupe_v11(shop_id,observed_on,event_kind,browser_tag_hash,expires_at)
    values(v_shop_id,v_day,p_event_kind,p_browser_tag_hash,now()+interval '2 days')
    on conflict do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted=0 then return; end if;
  insert into private.partner_shop_access_daily_v11(shop_id,observed_on) values(v_shop_id,v_day) on conflict do nothing;
  select case when p_event_kind='shop_view' then shop_view_count else official_line_click_count end into v_current
    from private.partner_shop_access_daily_v11 where shop_id=v_shop_id and observed_on=v_day for update;
  if v_current >= 10000 then raise exception 'access event burst limit reached' using errcode='22023'; end if;
  update private.partner_shop_access_daily_v11 set
    shop_view_count=shop_view_count + case when p_event_kind='shop_view' then 1 else 0 end,
    official_line_click_count=official_line_click_count + case when p_event_kind='official_line_click' then 1 else 0 end,
    updated_at=now()
    where shop_id=v_shop_id and observed_on=v_day;
  insert into private.partner_shop_access_observation_days_v11(shop_id,observed_on,collection_state)
    values(v_shop_id,v_day,'observed')
    on conflict(shop_id,observed_on) do update set collection_state='observed',updated_at=now();
  insert into private.partner_shop_access_rollup_state_v11(shop_id,first_observed_on)
    values(v_shop_id,v_day) on conflict(shop_id) do update set updated_at=now();
end $$;
create function api.record_public_shop_access_v11(p_shop_slug text,p_event_kind text,p_browser_tag_hash text)
returns void language sql security invoker set search_path=private,api,pg_temp as $$
  select private.record_public_shop_access_v11(p_shop_slug,p_event_kind,p_browser_tag_hash)
$$;

create function private.mark_partner_shop_access_observed_day_v11(p_observed_on date)
returns void language plpgsql security definer set search_path=private,app,pg_temp as $$
begin
  if p_observed_on is null or p_observed_on > (now() at time zone 'Asia/Tokyo')::date then raise exception 'invalid observation day' using errcode='22023'; end if;
  insert into private.partner_shop_access_observation_days_v11(shop_id,observed_on,collection_state)
  select shop.id,p_observed_on,'observed'
  from app.shops shop join private.managed_shops managed on managed.app_shop_id=shop.id
  where shop.publication_status='published' and managed.publication_state='published'
  on conflict(shop_id,observed_on) do update set collection_state='observed',updated_at=now();
end $$;

create or replace function private.get_partner_shop_access_report_v11(p_workspace_id uuid,p_auth_user_id uuid,p_from date,p_to date)
returns table(observed_on date,shop_view_count bigint,official_line_click_count bigint,has_data boolean,updated_at timestamptz)
language plpgsql security definer set search_path=private,app,pg_temp as $$
declare v_shop_id uuid;
begin
  if p_from is null or p_to is null or p_from>p_to or p_to-p_from>179 then raise exception 'invalid report range' using errcode='22023'; end if;
  perform private.assert_partner_therapist_membership(p_workspace_id,p_auth_user_id);
  select workspace.app_shop_id into v_shop_id from private.partner_workspaces workspace
    join app.shops shop on shop.id=workspace.app_shop_id and shop.publication_status='published'
    join private.managed_shops managed on managed.app_shop_id=shop.id and managed.publication_state='published'
    where workspace.id=p_workspace_id;
  if v_shop_id is null then raise exception 'partner shop is unavailable' using errcode='42501'; end if;
  return query
    select days.observed_on::date,coalesce(daily.shop_view_count,0),coalesce(daily.official_line_click_count,0),
      observation.collection_state='observed',
      greatest(daily.updated_at,observation.updated_at)
    from generate_series(p_from,p_to,interval '1 day') days(observed_on)
    left join private.partner_shop_access_daily_v11 daily on daily.shop_id=v_shop_id and daily.observed_on=days.observed_on::date
    left join private.partner_shop_access_observation_days_v11 observation on observation.shop_id=v_shop_id and observation.observed_on=days.observed_on::date
    order by days.observed_on;
end $$;

-- Bind only legacy appeals whose currently active action is provably the exact
-- rejected/hidden state.  Others are retained for an auditable manual close;
-- no migration path guesses that a visitor withdrawal may be reopened.
with bindable as (
  select appeal.id,post.revision as target_post_revision,event.id as target_event_id,event.reason as target_reason
  from private.community_post_appeals_v11 appeal
  join private.community_posts_v11 post on post.id=appeal.post_id
  join lateral (
    select row.id,row.action,row.reason,row.revision from private.community_moderation_events_v11 row
    where row.entity_kind='community_post' and row.entity_id=post.id
    order by row.created_at desc,row.id desc limit 1
  ) event on true
  where appeal.state in ('received','reviewing') and appeal.target_post_revision is null
    and event.revision=post.revision
    and ((event.action='rejected' and post.moderation_state='rejected' and post.publication_state='draft' and post.withdrawn_at is null)
      or (event.action='hidden' and post.moderation_state='rejected' and post.publication_state='withdrawn'))
)
update private.community_post_appeals_v11 appeal
set target_post_revision=bindable.target_post_revision,target_event_id=bindable.target_event_id,target_reason=bindable.target_reason
from bindable where appeal.id=bindable.id;

with requires_manual_close as (
  update private.community_post_appeals_v11 appeal
  set state='reviewing',operator_reason='legacy appeal requires manual closure: current moderation target cannot be proven',revision=revision+1
  where appeal.state in ('received','reviewing') and appeal.target_post_revision is null
  returning appeal.post_id
)
insert into private.community_moderation_events_v11(entity_kind,entity_id,action,reason,operator_actor,revision)
select 'community_post',post_id,'appeal_legacy_requires_review','legacy appeal target cannot be proven','migration_20261017172000',post.revision
from requires_manual_close join private.community_posts_v11 post on post.id=requires_manual_close.post_id;

create or replace function private.review_community_appeal_v11(p_appeal_id uuid,p_decision text,p_reason text,p_expected_revision integer)
returns text language plpgsql security definer set search_path=private,pg_temp as $$
declare v_appeal private.community_post_appeals_v11%rowtype; v_post_revision integer; v_event_revision integer;
begin
  select * into v_appeal from private.community_post_appeals_v11
    where id=p_appeal_id and revision=p_expected_revision and state in ('received','reviewing') for update;
  if not found or p_decision not in ('dismiss','reopen_review') or char_length(btrim(coalesce(p_reason,'')))>1000 then raise exception 'appeal changed' using errcode='40001'; end if;
  if p_decision='reopen_review' then
    if v_appeal.target_post_revision is null or v_appeal.target_event_id is null then raise exception 'appeal target requires manual closure' using errcode='40001'; end if;
    update private.community_posts_v11 post set moderation_state='pending',publication_state='draft',published_at=null,withdrawn_at=null,operator_reason=btrim(p_reason),revision=revision+1
      where post.id=v_appeal.post_id and post.revision=v_appeal.target_post_revision and post.moderation_state='rejected'
        and ((post.publication_state='draft' and post.withdrawn_at is null) or post.publication_state='withdrawn')
        and exists(select 1 from private.community_moderation_events_v11 event where event.id=v_appeal.target_event_id and event.entity_kind='community_post'
          and event.entity_id=post.id and event.action in ('hidden','rejected') and event.revision=post.revision and event.reason=v_appeal.target_reason)
      returning revision into v_post_revision;
    if not found then raise exception 'appeal target is stale' using errcode='40001'; end if;
  end if;
  update private.community_post_appeals_v11 set state=case when p_decision='dismiss' then 'dismissed' else 'resolved' end,
    operator_reason=btrim(p_reason),revision=revision+1,resolved_at=now() where id=p_appeal_id;
  select revision into v_event_revision from private.community_posts_v11 where id=v_appeal.post_id;
  insert into private.community_moderation_events_v11(entity_kind,entity_id,action,reason,operator_actor,revision)
    values('community_post',v_appeal.post_id,'appeal_'||p_decision,btrim(p_reason),'dashboard_shared_operator',coalesce(v_post_revision,v_event_revision));
  return p_decision;
end $$;

revoke all on function private.public_therapist_assignment_is_visible_v11(uuid),private.mark_partner_shop_access_observed_day_v11(date),private.record_public_shop_access_v11(text,text,text),api.record_public_shop_access_v11(text,text,text) from public,anon,authenticated;
grant execute on function private.public_therapist_assignment_is_visible_v11(uuid),private.mark_partner_shop_access_observed_day_v11(date),private.record_public_shop_access_v11(text,text,text),api.record_public_shop_access_v11(text,text,text) to service_role;
notify pgrst,'reload schema';
$eskomi_packet_05_1$], 'eskomi_public_delivery_upgrade_hardening', null, null, null);

-- SOURCE 20261017173000_eskomi_access_measurement_integrity.sql
-- SHA-256 cbf74c135c81d683a2907b36221baa06d982c9911c34eaebe22b248d653ed316
-- Measurement integrity follow-up.  An accepted client event is not proof
-- that every visitor was observed; only the scheduled collector health check
-- may close a past JST day as complete.  Anonymous context hashes are scoped
-- to one shop/day/event/session and are purged after their short lifetime.

alter table private.partner_shop_access_dedupe_v11 rename column browser_tag_hash to access_context_hash;
alter table private.partner_shop_access_dedupe_v11 drop constraint if exists partner_shop_access_dedupe_v11_browser_tag_hash_check;
alter table private.partner_shop_access_dedupe_v11 add constraint partner_shop_access_dedupe_v11_access_context_hash_check check (access_context_hash ~ '^[0-9a-f]{64}$');

create table private.partner_shop_access_context_limits_v11 (
  shop_id uuid not null references app.shops(id) on delete restrict,
  observed_on date not null,
  session_scope_hash text not null check (session_scope_hash ~ '^[0-9a-f]{64}$'),
  accepted_event_count smallint not null default 0 check (accepted_event_count between 0 and 2),
  expires_at timestamptz not null,
  primary key(shop_id,observed_on,session_scope_hash)
);
create index partner_shop_access_context_limits_expiry_v11 on private.partner_shop_access_context_limits_v11(expires_at);

-- `observed` used to mean that at least one browser event arrived.  That is
-- not sufficient evidence for a zero.  Preserve its audit trail as partial.
update private.partner_shop_access_observation_days_v11 set collection_state='missing' where collection_state='observed';
alter table private.partner_shop_access_observation_days_v11 drop constraint partner_shop_access_observation_days_v11_collection_state_check;
alter table private.partner_shop_access_observation_days_v11 add constraint partner_shop_access_observation_days_v11_collection_state_check check (collection_state in ('complete','partial','missing'));
alter table private.partner_shop_access_observation_days_v11 alter column collection_state set default 'missing';

create table private.partner_shop_access_collection_runs_v11 (
  observed_on date primary key,
  collection_state text not null check (collection_state in ('complete','partial')),
  checked_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table private.partner_shop_access_context_limits_v11 enable row level security;
alter table private.partner_shop_access_collection_runs_v11 enable row level security;
revoke all on table private.partner_shop_access_context_limits_v11,private.partner_shop_access_collection_runs_v11 from public,anon,authenticated;
grant select,insert,update,delete on table private.partner_shop_access_context_limits_v11,private.partner_shop_access_collection_runs_v11 to service_role;

drop function api.record_public_shop_access_v11(text,text,text);
drop function private.record_public_shop_access_v11(text,text,text);
create function private.record_public_shop_access_v11(p_shop_slug text,p_event_kind text,p_access_context_hash text,p_session_scope_hash text)
returns void language plpgsql security definer set search_path=private,app,pg_temp as $$
declare v_shop_id uuid; v_day date; v_inserted integer; v_current bigint; v_context_inserted integer;
begin
  if p_event_kind not in ('shop_view','official_line_click') or p_shop_slug is null or p_shop_slug !~ '^[^/[:space:]\\]+$'
    or p_access_context_hash !~ '^[0-9a-f]{64}$' or p_session_scope_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid public access event' using errcode='22023';
  end if;
  select shop.id into v_shop_id from app.shops shop join private.managed_shops managed on managed.app_shop_id=shop.id
    where shop.slug=p_shop_slug and shop.publication_status='published' and managed.publication_state='published';
  if not found then raise exception 'shop unavailable' using errcode='P0002'; end if;
  v_day := (now() at time zone 'Asia/Tokyo')::date;
  insert into private.partner_shop_access_daily_v11(shop_id,observed_on) values(v_shop_id,v_day) on conflict do nothing;
  select case when p_event_kind='shop_view' then shop_view_count else official_line_click_count end into v_current
    from private.partner_shop_access_daily_v11 where shop_id=v_shop_id and observed_on=v_day for update;
  if v_current >= 10000 then raise exception 'access event burst limit reached' using errcode='22023'; end if;
  insert into private.partner_shop_access_dedupe_v11(shop_id,observed_on,event_kind,access_context_hash,expires_at)
    values(v_shop_id,v_day,p_event_kind,p_access_context_hash,now()+interval '2 days') on conflict do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted=0 then return; end if;
  insert into private.partner_shop_access_context_limits_v11(shop_id,observed_on,session_scope_hash,accepted_event_count,expires_at)
    values(v_shop_id,v_day,p_session_scope_hash,1,now()+interval '2 days')
    on conflict(shop_id,observed_on,session_scope_hash) do update set accepted_event_count=private.partner_shop_access_context_limits_v11.accepted_event_count+1,
      expires_at=excluded.expires_at where private.partner_shop_access_context_limits_v11.accepted_event_count<2;
  get diagnostics v_context_inserted = row_count;
  if v_context_inserted=0 then
    delete from private.partner_shop_access_dedupe_v11 where shop_id=v_shop_id and observed_on=v_day and event_kind=p_event_kind and access_context_hash=p_access_context_hash;
    raise exception 'access context burst limit reached' using errcode='22023';
  end if;
  update private.partner_shop_access_daily_v11 set
    shop_view_count=shop_view_count + case when p_event_kind='shop_view' then 1 else 0 end,
    official_line_click_count=official_line_click_count + case when p_event_kind='official_line_click' then 1 else 0 end,
    updated_at=now() where shop_id=v_shop_id and observed_on=v_day;
  -- This is the first accepted telemetry event, not a proof that a zero day
  -- was fully measured.  The scheduled finalizer controls complete/partial.
  insert into private.partner_shop_access_rollup_state_v11(shop_id,first_observed_on) values(v_shop_id,v_day)
    on conflict(shop_id) do update set updated_at=now();
end $$;
create function api.record_public_shop_access_v11(p_shop_slug text,p_event_kind text,p_access_context_hash text,p_session_scope_hash text)
returns void language sql security invoker set search_path=private,api,pg_temp as $$
  select private.record_public_shop_access_v11(p_shop_slug,p_event_kind,p_access_context_hash,p_session_scope_hash)
$$;

create function private.prune_partner_shop_access_short_lived_v11(p_now timestamptz default now())
returns integer language plpgsql security definer set search_path=private,pg_temp as $$
declare v_deleted integer;
begin
  if p_now is null then raise exception 'invalid prune time' using errcode='22023'; end if;
  with removed_dedupe as (
    delete from private.partner_shop_access_dedupe_v11 where expires_at<=p_now returning 1
  ), removed_contexts as (
    delete from private.partner_shop_access_context_limits_v11 where expires_at<=p_now returning 1
  ) select (select count(*) from removed_dedupe)+(select count(*) from removed_contexts) into v_deleted;
  return v_deleted;
end $$;

create function private.finalize_partner_shop_access_collection_day_v11(p_observed_on date,p_collection_state text)
returns integer language plpgsql security definer set search_path=private,app,pg_temp as $$
declare v_changed integer;
begin
  if p_observed_on is null or p_observed_on >= (now() at time zone 'Asia/Tokyo')::date
    or p_collection_state not in ('complete','partial') then raise exception 'invalid collection finalization' using errcode='22023'; end if;
  perform private.prune_partner_shop_access_short_lived_v11(now());
  insert into private.partner_shop_access_collection_runs_v11(observed_on,collection_state,checked_at,updated_at)
    values(p_observed_on,p_collection_state,now(),now())
    on conflict(observed_on) do update set collection_state=excluded.collection_state,checked_at=excluded.checked_at,updated_at=excluded.updated_at;
  insert into private.partner_shop_access_observation_days_v11(shop_id,observed_on,collection_state,updated_at)
  select state.shop_id,p_observed_on,p_collection_state,now()
  from private.partner_shop_access_rollup_state_v11 state
  join app.shops shop on shop.id=state.shop_id and shop.publication_status='published'
  join private.managed_shops managed on managed.app_shop_id=shop.id and managed.publication_state='published'
  where state.first_observed_on<=p_observed_on
  on conflict(shop_id,observed_on) do update set collection_state=excluded.collection_state,updated_at=excluded.updated_at;
  get diagnostics v_changed=row_count;
  return v_changed;
end $$;
create function api.finalize_partner_shop_access_collection_day_v11(p_observed_on date,p_collection_state text)
returns integer language sql security invoker set search_path=private,api,pg_temp as $$
  select private.finalize_partner_shop_access_collection_day_v11(p_observed_on,p_collection_state)
$$;

drop function api.get_partner_shop_access_report_v11(uuid,uuid,date,date);
drop function private.get_partner_shop_access_report_v11(uuid,uuid,date,date);
create function private.get_partner_shop_access_report_v11(p_workspace_id uuid,p_auth_user_id uuid,p_from date,p_to date)
returns table(observed_on date,shop_view_count bigint,official_line_click_count bigint,has_data boolean,measurement_state text,updated_at timestamptz)
language plpgsql security definer set search_path=private,app,pg_temp as $$
declare v_shop_id uuid;
begin
  if p_from is null or p_to is null or p_from>p_to or p_to-p_from>179 then raise exception 'invalid report range' using errcode='22023'; end if;
  v_shop_id:=private.assert_partner_v11_read_membership(p_workspace_id,p_auth_user_id);
  if not exists(select 1 from private.partner_workspaces workspace join private.managed_shops managed on managed.app_shop_id=workspace.app_shop_id and managed.publication_state='published'
    where workspace.id=p_workspace_id and workspace.app_shop_id=v_shop_id) then raise exception 'partner shop is unavailable' using errcode='42501'; end if;
  return query select days.observed_on::date,coalesce(daily.shop_view_count,0),coalesce(daily.official_line_click_count,0),
      observation.collection_state='complete',coalesce(observation.collection_state,'unknown'),greatest(daily.updated_at,observation.updated_at)
    from generate_series(p_from,p_to,interval '1 day') days(observed_on)
    left join private.partner_shop_access_daily_v11 daily on daily.shop_id=v_shop_id and daily.observed_on=days.observed_on::date
    left join private.partner_shop_access_observation_days_v11 observation on observation.shop_id=v_shop_id and observation.observed_on=days.observed_on::date
    order by days.observed_on;
end $$;
create function api.get_partner_shop_access_report_v11(p_workspace_id uuid,p_auth_user_id uuid,p_from date,p_to date)
returns table(observed_on date,shop_view_count bigint,official_line_click_count bigint,has_data boolean,measurement_state text,updated_at timestamptz)
language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.get_partner_shop_access_report_v11(p_workspace_id,p_auth_user_id,p_from,p_to) $$;

-- A legacy appeal is only bound where the appealed action demonstrably
-- happened no later than the appeal itself.  Never infer a newer rejection.
with requires_manual_close as (
  update private.community_post_appeals_v11 appeal set target_post_revision=null,target_event_id=null,target_reason=null,state='reviewing',operator_reason='legacy appeal requires manual closure: moderation target time cannot be proven',revision=revision+1
  where appeal.state in ('received','reviewing') and appeal.target_post_revision is not null
    and not exists(select 1 from private.community_moderation_events_v11 event where event.id=appeal.target_event_id and event.created_at<=appeal.created_at)
  returning appeal.post_id
)
insert into private.community_moderation_events_v11(entity_kind,entity_id,action,reason,operator_actor,revision)
select 'community_post',post_id,'appeal_legacy_requires_review','legacy appeal target time cannot be proven','migration_20261017173000',post.revision
from requires_manual_close join private.community_posts_v11 post on post.id=requires_manual_close.post_id;

revoke all on function private.record_public_shop_access_v11(text,text,text,text),api.record_public_shop_access_v11(text,text,text,text),private.prune_partner_shop_access_short_lived_v11(timestamptz),private.finalize_partner_shop_access_collection_day_v11(date,text),api.finalize_partner_shop_access_collection_day_v11(date,text),private.get_partner_shop_access_report_v11(uuid,uuid,date,date),api.get_partner_shop_access_report_v11(uuid,uuid,date,date) from public,anon,authenticated;
grant execute on function private.record_public_shop_access_v11(text,text,text,text),api.record_public_shop_access_v11(text,text,text,text),private.prune_partner_shop_access_short_lived_v11(timestamptz),private.finalize_partner_shop_access_collection_day_v11(date,text),api.finalize_partner_shop_access_collection_day_v11(date,text),private.get_partner_shop_access_report_v11(uuid,uuid,date,date),api.get_partner_shop_access_report_v11(uuid,uuid,date,date) to service_role;
notify pgrst,'reload schema';

insert into supabase_migrations.schema_migrations
  (version, statements, name, created_by, idempotency_key, rollback)
values
  ('20261017173000', array[$eskomi_packet_05_2$-- Measurement integrity follow-up.  An accepted client event is not proof
-- that every visitor was observed; only the scheduled collector health check
-- may close a past JST day as complete.  Anonymous context hashes are scoped
-- to one shop/day/event/session and are purged after their short lifetime.

alter table private.partner_shop_access_dedupe_v11 rename column browser_tag_hash to access_context_hash;
alter table private.partner_shop_access_dedupe_v11 drop constraint if exists partner_shop_access_dedupe_v11_browser_tag_hash_check;
alter table private.partner_shop_access_dedupe_v11 add constraint partner_shop_access_dedupe_v11_access_context_hash_check check (access_context_hash ~ '^[0-9a-f]{64}$');

create table private.partner_shop_access_context_limits_v11 (
  shop_id uuid not null references app.shops(id) on delete restrict,
  observed_on date not null,
  session_scope_hash text not null check (session_scope_hash ~ '^[0-9a-f]{64}$'),
  accepted_event_count smallint not null default 0 check (accepted_event_count between 0 and 2),
  expires_at timestamptz not null,
  primary key(shop_id,observed_on,session_scope_hash)
);
create index partner_shop_access_context_limits_expiry_v11 on private.partner_shop_access_context_limits_v11(expires_at);

-- `observed` used to mean that at least one browser event arrived.  That is
-- not sufficient evidence for a zero.  Preserve its audit trail as partial.
update private.partner_shop_access_observation_days_v11 set collection_state='missing' where collection_state='observed';
alter table private.partner_shop_access_observation_days_v11 drop constraint partner_shop_access_observation_days_v11_collection_state_check;
alter table private.partner_shop_access_observation_days_v11 add constraint partner_shop_access_observation_days_v11_collection_state_check check (collection_state in ('complete','partial','missing'));
alter table private.partner_shop_access_observation_days_v11 alter column collection_state set default 'missing';

create table private.partner_shop_access_collection_runs_v11 (
  observed_on date primary key,
  collection_state text not null check (collection_state in ('complete','partial')),
  checked_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table private.partner_shop_access_context_limits_v11 enable row level security;
alter table private.partner_shop_access_collection_runs_v11 enable row level security;
revoke all on table private.partner_shop_access_context_limits_v11,private.partner_shop_access_collection_runs_v11 from public,anon,authenticated;
grant select,insert,update,delete on table private.partner_shop_access_context_limits_v11,private.partner_shop_access_collection_runs_v11 to service_role;

drop function api.record_public_shop_access_v11(text,text,text);
drop function private.record_public_shop_access_v11(text,text,text);
create function private.record_public_shop_access_v11(p_shop_slug text,p_event_kind text,p_access_context_hash text,p_session_scope_hash text)
returns void language plpgsql security definer set search_path=private,app,pg_temp as $$
declare v_shop_id uuid; v_day date; v_inserted integer; v_current bigint; v_context_inserted integer;
begin
  if p_event_kind not in ('shop_view','official_line_click') or p_shop_slug is null or p_shop_slug !~ '^[^/[:space:]\\]+$'
    or p_access_context_hash !~ '^[0-9a-f]{64}$' or p_session_scope_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid public access event' using errcode='22023';
  end if;
  select shop.id into v_shop_id from app.shops shop join private.managed_shops managed on managed.app_shop_id=shop.id
    where shop.slug=p_shop_slug and shop.publication_status='published' and managed.publication_state='published';
  if not found then raise exception 'shop unavailable' using errcode='P0002'; end if;
  v_day := (now() at time zone 'Asia/Tokyo')::date;
  insert into private.partner_shop_access_daily_v11(shop_id,observed_on) values(v_shop_id,v_day) on conflict do nothing;
  select case when p_event_kind='shop_view' then shop_view_count else official_line_click_count end into v_current
    from private.partner_shop_access_daily_v11 where shop_id=v_shop_id and observed_on=v_day for update;
  if v_current >= 10000 then raise exception 'access event burst limit reached' using errcode='22023'; end if;
  insert into private.partner_shop_access_dedupe_v11(shop_id,observed_on,event_kind,access_context_hash,expires_at)
    values(v_shop_id,v_day,p_event_kind,p_access_context_hash,now()+interval '2 days') on conflict do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted=0 then return; end if;
  insert into private.partner_shop_access_context_limits_v11(shop_id,observed_on,session_scope_hash,accepted_event_count,expires_at)
    values(v_shop_id,v_day,p_session_scope_hash,1,now()+interval '2 days')
    on conflict(shop_id,observed_on,session_scope_hash) do update set accepted_event_count=private.partner_shop_access_context_limits_v11.accepted_event_count+1,
      expires_at=excluded.expires_at where private.partner_shop_access_context_limits_v11.accepted_event_count<2;
  get diagnostics v_context_inserted = row_count;
  if v_context_inserted=0 then
    delete from private.partner_shop_access_dedupe_v11 where shop_id=v_shop_id and observed_on=v_day and event_kind=p_event_kind and access_context_hash=p_access_context_hash;
    raise exception 'access context burst limit reached' using errcode='22023';
  end if;
  update private.partner_shop_access_daily_v11 set
    shop_view_count=shop_view_count + case when p_event_kind='shop_view' then 1 else 0 end,
    official_line_click_count=official_line_click_count + case when p_event_kind='official_line_click' then 1 else 0 end,
    updated_at=now() where shop_id=v_shop_id and observed_on=v_day;
  -- This is the first accepted telemetry event, not a proof that a zero day
  -- was fully measured.  The scheduled finalizer controls complete/partial.
  insert into private.partner_shop_access_rollup_state_v11(shop_id,first_observed_on) values(v_shop_id,v_day)
    on conflict(shop_id) do update set updated_at=now();
end $$;
create function api.record_public_shop_access_v11(p_shop_slug text,p_event_kind text,p_access_context_hash text,p_session_scope_hash text)
returns void language sql security invoker set search_path=private,api,pg_temp as $$
  select private.record_public_shop_access_v11(p_shop_slug,p_event_kind,p_access_context_hash,p_session_scope_hash)
$$;

create function private.prune_partner_shop_access_short_lived_v11(p_now timestamptz default now())
returns integer language plpgsql security definer set search_path=private,pg_temp as $$
declare v_deleted integer;
begin
  if p_now is null then raise exception 'invalid prune time' using errcode='22023'; end if;
  with removed_dedupe as (
    delete from private.partner_shop_access_dedupe_v11 where expires_at<=p_now returning 1
  ), removed_contexts as (
    delete from private.partner_shop_access_context_limits_v11 where expires_at<=p_now returning 1
  ) select (select count(*) from removed_dedupe)+(select count(*) from removed_contexts) into v_deleted;
  return v_deleted;
end $$;

create function private.finalize_partner_shop_access_collection_day_v11(p_observed_on date,p_collection_state text)
returns integer language plpgsql security definer set search_path=private,app,pg_temp as $$
declare v_changed integer;
begin
  if p_observed_on is null or p_observed_on >= (now() at time zone 'Asia/Tokyo')::date
    or p_collection_state not in ('complete','partial') then raise exception 'invalid collection finalization' using errcode='22023'; end if;
  perform private.prune_partner_shop_access_short_lived_v11(now());
  insert into private.partner_shop_access_collection_runs_v11(observed_on,collection_state,checked_at,updated_at)
    values(p_observed_on,p_collection_state,now(),now())
    on conflict(observed_on) do update set collection_state=excluded.collection_state,checked_at=excluded.checked_at,updated_at=excluded.updated_at;
  insert into private.partner_shop_access_observation_days_v11(shop_id,observed_on,collection_state,updated_at)
  select state.shop_id,p_observed_on,p_collection_state,now()
  from private.partner_shop_access_rollup_state_v11 state
  join app.shops shop on shop.id=state.shop_id and shop.publication_status='published'
  join private.managed_shops managed on managed.app_shop_id=shop.id and managed.publication_state='published'
  where state.first_observed_on<=p_observed_on
  on conflict(shop_id,observed_on) do update set collection_state=excluded.collection_state,updated_at=excluded.updated_at;
  get diagnostics v_changed=row_count;
  return v_changed;
end $$;
create function api.finalize_partner_shop_access_collection_day_v11(p_observed_on date,p_collection_state text)
returns integer language sql security invoker set search_path=private,api,pg_temp as $$
  select private.finalize_partner_shop_access_collection_day_v11(p_observed_on,p_collection_state)
$$;

drop function api.get_partner_shop_access_report_v11(uuid,uuid,date,date);
drop function private.get_partner_shop_access_report_v11(uuid,uuid,date,date);
create function private.get_partner_shop_access_report_v11(p_workspace_id uuid,p_auth_user_id uuid,p_from date,p_to date)
returns table(observed_on date,shop_view_count bigint,official_line_click_count bigint,has_data boolean,measurement_state text,updated_at timestamptz)
language plpgsql security definer set search_path=private,app,pg_temp as $$
declare v_shop_id uuid;
begin
  if p_from is null or p_to is null or p_from>p_to or p_to-p_from>179 then raise exception 'invalid report range' using errcode='22023'; end if;
  v_shop_id:=private.assert_partner_v11_read_membership(p_workspace_id,p_auth_user_id);
  if not exists(select 1 from private.partner_workspaces workspace join private.managed_shops managed on managed.app_shop_id=workspace.app_shop_id and managed.publication_state='published'
    where workspace.id=p_workspace_id and workspace.app_shop_id=v_shop_id) then raise exception 'partner shop is unavailable' using errcode='42501'; end if;
  return query select days.observed_on::date,coalesce(daily.shop_view_count,0),coalesce(daily.official_line_click_count,0),
      observation.collection_state='complete',coalesce(observation.collection_state,'unknown'),greatest(daily.updated_at,observation.updated_at)
    from generate_series(p_from,p_to,interval '1 day') days(observed_on)
    left join private.partner_shop_access_daily_v11 daily on daily.shop_id=v_shop_id and daily.observed_on=days.observed_on::date
    left join private.partner_shop_access_observation_days_v11 observation on observation.shop_id=v_shop_id and observation.observed_on=days.observed_on::date
    order by days.observed_on;
end $$;
create function api.get_partner_shop_access_report_v11(p_workspace_id uuid,p_auth_user_id uuid,p_from date,p_to date)
returns table(observed_on date,shop_view_count bigint,official_line_click_count bigint,has_data boolean,measurement_state text,updated_at timestamptz)
language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.get_partner_shop_access_report_v11(p_workspace_id,p_auth_user_id,p_from,p_to) $$;

-- A legacy appeal is only bound where the appealed action demonstrably
-- happened no later than the appeal itself.  Never infer a newer rejection.
with requires_manual_close as (
  update private.community_post_appeals_v11 appeal set target_post_revision=null,target_event_id=null,target_reason=null,state='reviewing',operator_reason='legacy appeal requires manual closure: moderation target time cannot be proven',revision=revision+1
  where appeal.state in ('received','reviewing') and appeal.target_post_revision is not null
    and not exists(select 1 from private.community_moderation_events_v11 event where event.id=appeal.target_event_id and event.created_at<=appeal.created_at)
  returning appeal.post_id
)
insert into private.community_moderation_events_v11(entity_kind,entity_id,action,reason,operator_actor,revision)
select 'community_post',post_id,'appeal_legacy_requires_review','legacy appeal target time cannot be proven','migration_20261017173000',post.revision
from requires_manual_close join private.community_posts_v11 post on post.id=requires_manual_close.post_id;

revoke all on function private.record_public_shop_access_v11(text,text,text,text),api.record_public_shop_access_v11(text,text,text,text),private.prune_partner_shop_access_short_lived_v11(timestamptz),private.finalize_partner_shop_access_collection_day_v11(date,text),api.finalize_partner_shop_access_collection_day_v11(date,text),private.get_partner_shop_access_report_v11(uuid,uuid,date,date),api.get_partner_shop_access_report_v11(uuid,uuid,date,date) from public,anon,authenticated;
grant execute on function private.record_public_shop_access_v11(text,text,text,text),api.record_public_shop_access_v11(text,text,text,text),private.prune_partner_shop_access_short_lived_v11(timestamptz),private.finalize_partner_shop_access_collection_day_v11(date,text),api.finalize_partner_shop_access_collection_day_v11(date,text),private.get_partner_shop_access_report_v11(uuid,uuid,date,date),api.get_partner_shop_access_report_v11(uuid,uuid,date,date) to service_role;
notify pgrst,'reload schema';
$eskomi_packet_05_2$], 'eskomi_access_measurement_integrity', null, null, null);

-- SOURCE 20261017174000_eskomi_access_context_abuse_and_report_integrity.sql
-- SHA-256 8524ef543a1318b224b33ddce0c75bc22f941e2dc9586a2029d8ceb7080b401e
-- Follow-up hardening for anonymous public-access measurement.  A signed
-- context proves that this server issued it, but it is not itself a complete
-- anti-abuse system.  Keep only short-lived HMAC scopes: never a raw IP.

create table private.partner_shop_access_context_issue_limits_v11 (
  shop_id uuid not null references app.shops(id) on delete restrict,
  observed_on date not null,
  scope_kind text not null check (scope_kind in ('session','network')),
  scope_hash text not null check (scope_hash ~ '^[0-9a-f]{64}$'),
  issued_count smallint not null default 0 check (issued_count between 0 and 20),
  expires_at timestamptz not null,
  primary key(shop_id,observed_on,scope_kind,scope_hash)
);
create index partner_shop_access_context_issue_limits_expiry_v11 on private.partner_shop_access_context_issue_limits_v11(expires_at);
alter table private.partner_shop_access_context_issue_limits_v11 enable row level security;
revoke all on table private.partner_shop_access_context_issue_limits_v11 from public,anon,authenticated;
grant select,insert,update,delete on table private.partner_shop_access_context_issue_limits_v11 to service_role;

create function private.reserve_public_shop_access_context_v11(
  p_shop_slug text,
  p_session_scope_hash text,
  p_network_scope_hash text default null,
  p_is_new_session boolean default false
) returns void language plpgsql security definer set search_path=private,app,pg_temp as $$
declare v_shop_id uuid; v_day date; v_reserved integer;
begin
  if p_shop_slug is null or p_shop_slug !~ '^[^/[:space:]\\]+$' or p_session_scope_hash !~ '^[0-9a-f]{64}$'
    or (p_network_scope_hash is not null and p_network_scope_hash !~ '^[0-9a-f]{64}$') then
    raise exception 'invalid public access context' using errcode='22023';
  end if;
  select shop.id into v_shop_id from app.shops shop join private.managed_shops managed on managed.app_shop_id=shop.id
    where shop.slug=p_shop_slug and shop.publication_status='published' and managed.publication_state='published';
  if not found then raise exception 'shop unavailable' using errcode='P0002'; end if;
  v_day := (now() at time zone 'Asia/Tokyo')::date;

  -- This permits normal retries for a server-issued session, while bounding
  -- context minting before it can consume the shop-wide event ceiling.
  insert into private.partner_shop_access_context_issue_limits_v11(shop_id,observed_on,scope_kind,scope_hash,issued_count,expires_at)
    values(v_shop_id,v_day,'session',p_session_scope_hash,1,now()+interval '10 minutes')
    on conflict(shop_id,observed_on,scope_kind,scope_hash) do update set issued_count=case when private.partner_shop_access_context_issue_limits_v11.expires_at<=now() then 1 else private.partner_shop_access_context_issue_limits_v11.issued_count+1 end,
      expires_at=excluded.expires_at where private.partner_shop_access_context_issue_limits_v11.expires_at<=now() or private.partner_shop_access_context_issue_limits_v11.issued_count<8;
  get diagnostics v_reserved=row_count;
  if v_reserved=0 then raise exception 'access context session limit reached' using errcode='22023'; end if;

  -- Network scope is a coarse, trusted-proxy HMAC signal only.  It applies
  -- only while minting a new session, so a shared network cannot lock out an
  -- existing normal visitor.  At 20 new sessions per ten-minute window and
  -- two accepted events per session, this single-signal cap remains below the
  -- 10,000/day shop ceiling. It is not an identity or a complete bot defence.
  if p_is_new_session and p_network_scope_hash is not null then
    insert into private.partner_shop_access_context_issue_limits_v11(shop_id,observed_on,scope_kind,scope_hash,issued_count,expires_at)
      values(v_shop_id,v_day,'network',p_network_scope_hash,1,now()+interval '10 minutes')
      on conflict(shop_id,observed_on,scope_kind,scope_hash) do update set issued_count=case when private.partner_shop_access_context_issue_limits_v11.expires_at<=now() then 1 else private.partner_shop_access_context_issue_limits_v11.issued_count+1 end,
        expires_at=excluded.expires_at where private.partner_shop_access_context_issue_limits_v11.expires_at<=now() or private.partner_shop_access_context_issue_limits_v11.issued_count<20;
    get diagnostics v_reserved=row_count;
    if v_reserved=0 then raise exception 'access context network limit reached' using errcode='22023'; end if;
  end if;
end $$;
create function api.reserve_public_shop_access_context_v11(text,text,text,boolean)
returns void language sql security invoker set search_path=private,api,pg_temp as $$
  select private.reserve_public_shop_access_context_v11($1,$2,$3,$4)
$$;

drop function api.get_partner_shop_access_report_v11(uuid,uuid,date,date);
drop function private.get_partner_shop_access_report_v11(uuid,uuid,date,date);
create function private.get_partner_shop_access_report_v11(p_workspace_id uuid,p_auth_user_id uuid,p_from date,p_to date)
returns table(observed_on date,shop_view_count bigint,official_line_click_count bigint,has_data boolean,has_recorded_data boolean,measurement_state text,updated_at timestamptz)
language plpgsql security definer set search_path=private,app,pg_temp as $$
declare v_shop_id uuid;
begin
  if p_from is null or p_to is null or p_from>p_to or p_to-p_from>179 then raise exception 'invalid report range' using errcode='22023'; end if;
  v_shop_id:=private.assert_partner_v11_read_membership(p_workspace_id,p_auth_user_id);
  if not exists(select 1 from private.partner_workspaces workspace join private.managed_shops managed on managed.app_shop_id=workspace.app_shop_id and managed.publication_state='published'
    where workspace.id=p_workspace_id and workspace.app_shop_id=v_shop_id) then raise exception 'partner shop is unavailable' using errcode='42501'; end if;
  return query select days.observed_on::date,coalesce(daily.shop_view_count,0),coalesce(daily.official_line_click_count,0),
      observation.collection_state='complete',daily.shop_id is not null,coalesce(observation.collection_state,'unknown'),greatest(daily.updated_at,observation.updated_at)
    from generate_series(p_from,p_to,interval '1 day') days(observed_on)
    left join private.partner_shop_access_daily_v11 daily on daily.shop_id=v_shop_id and daily.observed_on=days.observed_on::date
    left join private.partner_shop_access_observation_days_v11 observation on observation.shop_id=v_shop_id and observation.observed_on=days.observed_on::date
    order by days.observed_on;
end $$;
create function api.get_partner_shop_access_report_v11(p_workspace_id uuid,p_auth_user_id uuid,p_from date,p_to date)
returns table(observed_on date,shop_view_count bigint,official_line_click_count bigint,has_data boolean,has_recorded_data boolean,measurement_state text,updated_at timestamptz)
language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.get_partner_shop_access_report_v11(p_workspace_id,p_auth_user_id,p_from,p_to) $$;

-- Expiry is an intended upper bound, not a deletion guarantee: rows disappear
-- only after this finalizer/pruner succeeds.  A missing finalization run must
-- remain unknown in reports and be investigated operationally.
create or replace function private.prune_partner_shop_access_short_lived_v11(p_now timestamptz default now())
returns integer language plpgsql security definer set search_path=private,pg_temp as $$
declare v_deleted integer;
begin
  if p_now is null then raise exception 'invalid prune time' using errcode='22023'; end if;
  with removed_dedupe as (
    delete from private.partner_shop_access_dedupe_v11 where expires_at<=p_now returning 1
  ), removed_contexts as (
    delete from private.partner_shop_access_context_limits_v11 where expires_at<=p_now returning 1
  ), removed_issuance as (
    delete from private.partner_shop_access_context_issue_limits_v11 where expires_at<=p_now returning 1
  ) select (select count(*) from removed_dedupe)+(select count(*) from removed_contexts)+(select count(*) from removed_issuance) into v_deleted;
  return v_deleted;
end $$;

revoke all on function private.reserve_public_shop_access_context_v11(text,text,text,boolean),api.reserve_public_shop_access_context_v11(text,text,text,boolean),private.get_partner_shop_access_report_v11(uuid,uuid,date,date),api.get_partner_shop_access_report_v11(uuid,uuid,date,date),private.prune_partner_shop_access_short_lived_v11(timestamptz) from public,anon,authenticated;
grant execute on function private.reserve_public_shop_access_context_v11(text,text,text,boolean),api.reserve_public_shop_access_context_v11(text,text,text,boolean),private.get_partner_shop_access_report_v11(uuid,uuid,date,date),api.get_partner_shop_access_report_v11(uuid,uuid,date,date),private.prune_partner_shop_access_short_lived_v11(timestamptz) to service_role;
notify pgrst,'reload schema';

insert into supabase_migrations.schema_migrations
  (version, statements, name, created_by, idempotency_key, rollback)
values
  ('20261017174000', array[$eskomi_packet_05_3$-- Follow-up hardening for anonymous public-access measurement.  A signed
-- context proves that this server issued it, but it is not itself a complete
-- anti-abuse system.  Keep only short-lived HMAC scopes: never a raw IP.

create table private.partner_shop_access_context_issue_limits_v11 (
  shop_id uuid not null references app.shops(id) on delete restrict,
  observed_on date not null,
  scope_kind text not null check (scope_kind in ('session','network')),
  scope_hash text not null check (scope_hash ~ '^[0-9a-f]{64}$'),
  issued_count smallint not null default 0 check (issued_count between 0 and 20),
  expires_at timestamptz not null,
  primary key(shop_id,observed_on,scope_kind,scope_hash)
);
create index partner_shop_access_context_issue_limits_expiry_v11 on private.partner_shop_access_context_issue_limits_v11(expires_at);
alter table private.partner_shop_access_context_issue_limits_v11 enable row level security;
revoke all on table private.partner_shop_access_context_issue_limits_v11 from public,anon,authenticated;
grant select,insert,update,delete on table private.partner_shop_access_context_issue_limits_v11 to service_role;

create function private.reserve_public_shop_access_context_v11(
  p_shop_slug text,
  p_session_scope_hash text,
  p_network_scope_hash text default null,
  p_is_new_session boolean default false
) returns void language plpgsql security definer set search_path=private,app,pg_temp as $$
declare v_shop_id uuid; v_day date; v_reserved integer;
begin
  if p_shop_slug is null or p_shop_slug !~ '^[^/[:space:]\\]+$' or p_session_scope_hash !~ '^[0-9a-f]{64}$'
    or (p_network_scope_hash is not null and p_network_scope_hash !~ '^[0-9a-f]{64}$') then
    raise exception 'invalid public access context' using errcode='22023';
  end if;
  select shop.id into v_shop_id from app.shops shop join private.managed_shops managed on managed.app_shop_id=shop.id
    where shop.slug=p_shop_slug and shop.publication_status='published' and managed.publication_state='published';
  if not found then raise exception 'shop unavailable' using errcode='P0002'; end if;
  v_day := (now() at time zone 'Asia/Tokyo')::date;

  -- This permits normal retries for a server-issued session, while bounding
  -- context minting before it can consume the shop-wide event ceiling.
  insert into private.partner_shop_access_context_issue_limits_v11(shop_id,observed_on,scope_kind,scope_hash,issued_count,expires_at)
    values(v_shop_id,v_day,'session',p_session_scope_hash,1,now()+interval '10 minutes')
    on conflict(shop_id,observed_on,scope_kind,scope_hash) do update set issued_count=case when private.partner_shop_access_context_issue_limits_v11.expires_at<=now() then 1 else private.partner_shop_access_context_issue_limits_v11.issued_count+1 end,
      expires_at=excluded.expires_at where private.partner_shop_access_context_issue_limits_v11.expires_at<=now() or private.partner_shop_access_context_issue_limits_v11.issued_count<8;
  get diagnostics v_reserved=row_count;
  if v_reserved=0 then raise exception 'access context session limit reached' using errcode='22023'; end if;

  -- Network scope is a coarse, trusted-proxy HMAC signal only.  It applies
  -- only while minting a new session, so a shared network cannot lock out an
  -- existing normal visitor.  At 20 new sessions per ten-minute window and
  -- two accepted events per session, this single-signal cap remains below the
  -- 10,000/day shop ceiling. It is not an identity or a complete bot defence.
  if p_is_new_session and p_network_scope_hash is not null then
    insert into private.partner_shop_access_context_issue_limits_v11(shop_id,observed_on,scope_kind,scope_hash,issued_count,expires_at)
      values(v_shop_id,v_day,'network',p_network_scope_hash,1,now()+interval '10 minutes')
      on conflict(shop_id,observed_on,scope_kind,scope_hash) do update set issued_count=case when private.partner_shop_access_context_issue_limits_v11.expires_at<=now() then 1 else private.partner_shop_access_context_issue_limits_v11.issued_count+1 end,
        expires_at=excluded.expires_at where private.partner_shop_access_context_issue_limits_v11.expires_at<=now() or private.partner_shop_access_context_issue_limits_v11.issued_count<20;
    get diagnostics v_reserved=row_count;
    if v_reserved=0 then raise exception 'access context network limit reached' using errcode='22023'; end if;
  end if;
end $$;
create function api.reserve_public_shop_access_context_v11(text,text,text,boolean)
returns void language sql security invoker set search_path=private,api,pg_temp as $$
  select private.reserve_public_shop_access_context_v11($1,$2,$3,$4)
$$;

drop function api.get_partner_shop_access_report_v11(uuid,uuid,date,date);
drop function private.get_partner_shop_access_report_v11(uuid,uuid,date,date);
create function private.get_partner_shop_access_report_v11(p_workspace_id uuid,p_auth_user_id uuid,p_from date,p_to date)
returns table(observed_on date,shop_view_count bigint,official_line_click_count bigint,has_data boolean,has_recorded_data boolean,measurement_state text,updated_at timestamptz)
language plpgsql security definer set search_path=private,app,pg_temp as $$
declare v_shop_id uuid;
begin
  if p_from is null or p_to is null or p_from>p_to or p_to-p_from>179 then raise exception 'invalid report range' using errcode='22023'; end if;
  v_shop_id:=private.assert_partner_v11_read_membership(p_workspace_id,p_auth_user_id);
  if not exists(select 1 from private.partner_workspaces workspace join private.managed_shops managed on managed.app_shop_id=workspace.app_shop_id and managed.publication_state='published'
    where workspace.id=p_workspace_id and workspace.app_shop_id=v_shop_id) then raise exception 'partner shop is unavailable' using errcode='42501'; end if;
  return query select days.observed_on::date,coalesce(daily.shop_view_count,0),coalesce(daily.official_line_click_count,0),
      observation.collection_state='complete',daily.shop_id is not null,coalesce(observation.collection_state,'unknown'),greatest(daily.updated_at,observation.updated_at)
    from generate_series(p_from,p_to,interval '1 day') days(observed_on)
    left join private.partner_shop_access_daily_v11 daily on daily.shop_id=v_shop_id and daily.observed_on=days.observed_on::date
    left join private.partner_shop_access_observation_days_v11 observation on observation.shop_id=v_shop_id and observation.observed_on=days.observed_on::date
    order by days.observed_on;
end $$;
create function api.get_partner_shop_access_report_v11(p_workspace_id uuid,p_auth_user_id uuid,p_from date,p_to date)
returns table(observed_on date,shop_view_count bigint,official_line_click_count bigint,has_data boolean,has_recorded_data boolean,measurement_state text,updated_at timestamptz)
language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.get_partner_shop_access_report_v11(p_workspace_id,p_auth_user_id,p_from,p_to) $$;

-- Expiry is an intended upper bound, not a deletion guarantee: rows disappear
-- only after this finalizer/pruner succeeds.  A missing finalization run must
-- remain unknown in reports and be investigated operationally.
create or replace function private.prune_partner_shop_access_short_lived_v11(p_now timestamptz default now())
returns integer language plpgsql security definer set search_path=private,pg_temp as $$
declare v_deleted integer;
begin
  if p_now is null then raise exception 'invalid prune time' using errcode='22023'; end if;
  with removed_dedupe as (
    delete from private.partner_shop_access_dedupe_v11 where expires_at<=p_now returning 1
  ), removed_contexts as (
    delete from private.partner_shop_access_context_limits_v11 where expires_at<=p_now returning 1
  ), removed_issuance as (
    delete from private.partner_shop_access_context_issue_limits_v11 where expires_at<=p_now returning 1
  ) select (select count(*) from removed_dedupe)+(select count(*) from removed_contexts)+(select count(*) from removed_issuance) into v_deleted;
  return v_deleted;
end $$;

revoke all on function private.reserve_public_shop_access_context_v11(text,text,text,boolean),api.reserve_public_shop_access_context_v11(text,text,text,boolean),private.get_partner_shop_access_report_v11(uuid,uuid,date,date),api.get_partner_shop_access_report_v11(uuid,uuid,date,date),private.prune_partner_shop_access_short_lived_v11(timestamptz) from public,anon,authenticated;
grant execute on function private.reserve_public_shop_access_context_v11(text,text,text,boolean),api.reserve_public_shop_access_context_v11(text,text,text,boolean),private.get_partner_shop_access_report_v11(uuid,uuid,date,date),api.get_partner_shop_access_report_v11(uuid,uuid,date,date),private.prune_partner_shop_access_short_lived_v11(timestamptz) to service_role;
notify pgrst,'reload schema';
$eskomi_packet_05_3$], 'eskomi_access_context_abuse_and_report_integrity', null, null, null);

-- SOURCE 20261017175000_eskomi_access_context_named_rpc.sql
-- SHA-256 29031eebc60d709a6975b76823761d4f3467c391faaa4bd9d1381176377dbee8
-- PostgREST resolves JSON RPC bodies by argument name.  Keep the public
-- wrapper's names explicit; the prior positional signature silently rejected
-- the analytics context route's p_* JSON body.
drop function api.reserve_public_shop_access_context_v11(text,text,text,boolean);
create function api.reserve_public_shop_access_context_v11(
  p_shop_slug text,
  p_session_scope_hash text,
  p_network_scope_hash text,
  p_is_new_session boolean
) returns void language sql security invoker set search_path=private,api,pg_temp as $$
  select private.reserve_public_shop_access_context_v11(p_shop_slug,p_session_scope_hash,p_network_scope_hash,p_is_new_session)
$$;
revoke all on function api.reserve_public_shop_access_context_v11(text,text,text,boolean) from public,anon,authenticated;
grant execute on function api.reserve_public_shop_access_context_v11(text,text,text,boolean) to service_role;
notify pgrst,'reload schema';

insert into supabase_migrations.schema_migrations
  (version, statements, name, created_by, idempotency_key, rollback)
values
  ('20261017175000', array[$eskomi_packet_05_4$-- PostgREST resolves JSON RPC bodies by argument name.  Keep the public
-- wrapper's names explicit; the prior positional signature silently rejected
-- the analytics context route's p_* JSON body.
drop function api.reserve_public_shop_access_context_v11(text,text,text,boolean);
create function api.reserve_public_shop_access_context_v11(
  p_shop_slug text,
  p_session_scope_hash text,
  p_network_scope_hash text,
  p_is_new_session boolean
) returns void language sql security invoker set search_path=private,api,pg_temp as $$
  select private.reserve_public_shop_access_context_v11(p_shop_slug,p_session_scope_hash,p_network_scope_hash,p_is_new_session)
$$;
revoke all on function api.reserve_public_shop_access_context_v11(text,text,text,boolean) from public,anon,authenticated;
grant execute on function api.reserve_public_shop_access_context_v11(text,text,text,boolean) to service_role;
notify pgrst,'reload schema';
$eskomi_packet_05_4$], 'eskomi_access_context_named_rpc', null, null, null);

-- SOURCE 20261018100000_partner_login_email_canonical_audit.sql
-- SHA-256 282156343e6cf5fe5cdc8e7ff040bc617236cad18a8c6955188b9381e37de7c9
-- Canonical Partner workspaces deliberately have app_shop_id and no WordPress
-- ID. Keep the existing legacy audit key while making exactly one identity
-- mandatory for every login-email audit event.
alter table private.partner_login_email_audit_events
  add column if not exists app_shop_id uuid references app.shops(id) on delete restrict;

alter table private.partner_login_email_audit_events
  alter column wp_shop_id drop not null;

alter table private.partner_login_email_audit_events
  drop constraint if exists partner_login_email_audit_events_identity_check;

alter table private.partner_login_email_audit_events
  add constraint partner_login_email_audit_events_identity_check
  check (num_nonnulls(wp_shop_id, app_shop_id) = 1);

create or replace function private.record_partner_login_email_change_request(
  p_workspace_id uuid,
  p_auth_user_id uuid,
  p_email text
)
returns table (
  status text,
  workspace_id uuid,
  auth_user_id uuid,
  email text,
  intent text,
  updated_at timestamptz
)
language plpgsql
security invoker
set search_path = private, pg_temp
as $$
declare
  v_normalized_email text := lower(btrim(p_email));
  v_saved private.partner_login_email_intents%rowtype;
  v_wp_shop_id bigint;
  v_app_shop_id uuid;
begin
  if char_length(v_normalized_email) not between 3 and 254
    or v_normalized_email !~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
    raise exception 'invalid login email' using errcode = '22023';
  end if;

  select w.wp_shop_id, w.app_shop_id into v_wp_shop_id, v_app_shop_id
    from private.partner_memberships m
    join private.partner_workspaces w on w.id = m.workspace_id
    where m.workspace_id = p_workspace_id
      and m.auth_user_id = p_auth_user_id
      and m.status = 'active'
      and w.state in ('free_official_partner', 'active_partner')
    limit 1;
  if num_nonnulls(v_wp_shop_id, v_app_shop_id) <> 1 then
    raise exception 'active partner membership is required' using errcode = 'P0001';
  end if;

  insert into private.partner_login_email_intents (workspace_id, email, intent, updated_at)
  values (p_workspace_id, v_normalized_email, 'partner_change_requested', now())
  on conflict on constraint partner_login_email_intents_pkey do update
    set email = excluded.email, intent = excluded.intent, updated_at = excluded.updated_at
  returning * into v_saved;

  insert into private.partner_login_email_audit_events (
    workspace_id, wp_shop_id, app_shop_id, action, actor_kind, result
  ) values (p_workspace_id, v_wp_shop_id, v_app_shop_id, 'partner_change_requested', 'partner', 'recorded');

  return query select 'available'::text, p_workspace_id, p_auth_user_id,
    v_saved.email, v_saved.intent::text, v_saved.updated_at;
end;
$$;

insert into supabase_migrations.schema_migrations
  (version, statements, name, created_by, idempotency_key, rollback)
values
  ('20261018100000', array[$eskomi_packet_05_5$-- Canonical Partner workspaces deliberately have app_shop_id and no WordPress
-- ID. Keep the existing legacy audit key while making exactly one identity
-- mandatory for every login-email audit event.
alter table private.partner_login_email_audit_events
  add column if not exists app_shop_id uuid references app.shops(id) on delete restrict;

alter table private.partner_login_email_audit_events
  alter column wp_shop_id drop not null;

alter table private.partner_login_email_audit_events
  drop constraint if exists partner_login_email_audit_events_identity_check;

alter table private.partner_login_email_audit_events
  add constraint partner_login_email_audit_events_identity_check
  check (num_nonnulls(wp_shop_id, app_shop_id) = 1);

create or replace function private.record_partner_login_email_change_request(
  p_workspace_id uuid,
  p_auth_user_id uuid,
  p_email text
)
returns table (
  status text,
  workspace_id uuid,
  auth_user_id uuid,
  email text,
  intent text,
  updated_at timestamptz
)
language plpgsql
security invoker
set search_path = private, pg_temp
as $$
declare
  v_normalized_email text := lower(btrim(p_email));
  v_saved private.partner_login_email_intents%rowtype;
  v_wp_shop_id bigint;
  v_app_shop_id uuid;
begin
  if char_length(v_normalized_email) not between 3 and 254
    or v_normalized_email !~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
    raise exception 'invalid login email' using errcode = '22023';
  end if;

  select w.wp_shop_id, w.app_shop_id into v_wp_shop_id, v_app_shop_id
    from private.partner_memberships m
    join private.partner_workspaces w on w.id = m.workspace_id
    where m.workspace_id = p_workspace_id
      and m.auth_user_id = p_auth_user_id
      and m.status = 'active'
      and w.state in ('free_official_partner', 'active_partner')
    limit 1;
  if num_nonnulls(v_wp_shop_id, v_app_shop_id) <> 1 then
    raise exception 'active partner membership is required' using errcode = 'P0001';
  end if;

  insert into private.partner_login_email_intents (workspace_id, email, intent, updated_at)
  values (p_workspace_id, v_normalized_email, 'partner_change_requested', now())
  on conflict on constraint partner_login_email_intents_pkey do update
    set email = excluded.email, intent = excluded.intent, updated_at = excluded.updated_at
  returning * into v_saved;

  insert into private.partner_login_email_audit_events (
    workspace_id, wp_shop_id, app_shop_id, action, actor_kind, result
  ) values (p_workspace_id, v_wp_shop_id, v_app_shop_id, 'partner_change_requested', 'partner', 'recorded');

  return query select 'available'::text, p_workspace_id, p_auth_user_id,
    v_saved.email, v_saved.intent::text, v_saved.updated_at;
end;
$$;
$eskomi_packet_05_5$], 'partner_login_email_canonical_audit', null, null, null);

-- SOURCE 20261020030000_eskomi_public_review_read_rpc.sql
-- SHA-256 c073a3b926b65c7120c9b7a2c13ca4323693197dc143470818d2d3c57a0ed184
-- Public read-only v1.1 review projections. These security-definer readers
-- expose only canonical approved publications. They do not create a second
-- review store: moderation writes app.review_experience_publications and
-- withdrawals hide it in the v1.1 source chain.

-- The earlier v1.1 global reader exposed a managed-directory bigint.  The
-- public contract now uses the canonical UUID identity, so PostgreSQL requires
-- an explicit signature drop before the replacement return table is defined.
-- The grants are re-established below; no table, RLS, or data change occurs.
drop function if exists api.list_public_review_experience_publications_global(integer, integer, text);

create or replace function api.list_public_shop_detail_reviews_v11(
  p_shop_slug text, p_limit integer default 20, p_offset integer default 0
) returns table(
  public_handle uuid, rating smallint, body text, display_name text,
  therapist_display_name text, published_at timestamptz,
  reply_body text, reply_published_at timestamptz
)
language sql security definer set search_path = '' as $$
  select publication.public_handle,
    nullif(revision.assessment_snapshot->>'shopRating', '')::smallint,
    coalesce(revision.experience_comment, ''), nullif(btrim(revision.nickname), ''),
    publication.therapist_display_name_snapshot, publication.published_at,
    reply.body, reply.reviewed_at
  from app.review_experience_publications as publication
  join private.review_experience_revisions as revision on revision.id = publication.active_revision_id and revision.moderation_state = 'approved'
  join app.shops as shop on shop.id = publication.shop_id and shop.publication_status = 'published'
  left join lateral (
    select response.body, response.reviewed_at
    from private.review_experience_reply_revisions as response
    where response.publication_id = publication.id and response.state = 'approved' and char_length(response.body) <= 2000
    order by response.revision desc limit 1
  ) as reply on true
  where shop.slug = p_shop_slug and publication.publication_state = 'published'
    and char_length(coalesce(revision.experience_comment, '')) <= 400
    and char_length(coalesce(revision.nickname, '')) <= 30
    and char_length(coalesce(publication.therapist_display_name_snapshot, '')) <= 120
    and not exists (
      select 1
      from private.managed_shops as managed
      where managed.app_shop_id = shop.id
        and managed.publication_state <> 'published'
    )
  order by publication.published_at desc, publication.id desc
  limit greatest(1, least(p_limit, 20)) offset greatest(p_offset, 0)
$$;

create or replace function api.get_public_shop_detail_review_summary_v11(p_shop_slug text)
returns table(
  review_count bigint, rating_count bigint, average_rating numeric,
  oldest_published_at timestamptz, latest_published_at timestamptz
)
language sql security definer set search_path = '' as $$
  select count(*), count(rating), avg(rating)::numeric, min(published_at), max(published_at)
  from (
    select publication.published_at, nullif(revision.assessment_snapshot->>'shopRating', '')::smallint as rating
    from app.review_experience_publications as publication
    join private.review_experience_revisions as revision on revision.id = publication.active_revision_id and revision.moderation_state = 'approved'
    join app.shops as shop on shop.id = publication.shop_id and shop.publication_status = 'published'
    where shop.slug = p_shop_slug and publication.publication_state = 'published'
      and char_length(coalesce(revision.experience_comment, '')) <= 400
      and char_length(coalesce(revision.nickname, '')) <= 30
      and char_length(coalesce(publication.therapist_display_name_snapshot, '')) <= 120
      and not exists (
        select 1
        from private.managed_shops as managed
        where managed.app_shop_id = shop.id
          and managed.publication_state <> 'published'
      )
  ) as published
$$;

create or replace function api.list_public_review_experience_publications_global(
  p_limit integer default 20, p_offset integer default 0, p_area_slug text default null
) returns table(
  public_handle uuid, rating smallint, body text, display_name text,
  therapist_display_name text, published_at timestamptz, shop_id uuid,
  shop_slug text, shop_name text, area_id uuid, area_slug text, area_name text
)
language sql security definer set search_path = '' as $$
  select publication.public_handle,
    nullif(revision.assessment_snapshot->>'shopRating', '')::smallint,
    coalesce(revision.experience_comment, ''), nullif(btrim(revision.nickname), ''),
    publication.therapist_display_name_snapshot, publication.published_at,
    shop.id, shop.slug, shop.name, area.id, area.slug, area.name
  from app.review_experience_publications as publication
  join private.review_experience_revisions as revision on revision.id = publication.active_revision_id and revision.moderation_state = 'approved'
  join app.shops as shop on shop.id = publication.shop_id and shop.publication_status = 'published'
  left join app.shop_areas as shop_area on shop_area.shop_id = shop.id and shop_area.is_primary
  left join app.areas as area on area.id = shop_area.area_id and area.is_published
  where publication.publication_state = 'published'
    and char_length(coalesce(revision.experience_comment, '')) <= 400
    and char_length(coalesce(revision.nickname, '')) <= 30
    and char_length(coalesce(publication.therapist_display_name_snapshot, '')) <= 120
    and not exists (
      select 1
      from private.managed_shops as managed
      where managed.app_shop_id = shop.id
        and managed.publication_state <> 'published'
    )
    and (p_area_slug is null or area.slug = p_area_slug)
  order by publication.published_at desc, publication.id desc
  limit greatest(1, least(p_limit, 50)) offset greatest(p_offset, 0)
$$;

create or replace function api.count_public_review_experience_publications_global(p_area_slug text default null)
returns bigint
language sql security definer set search_path = '' as $$
  select count(*)
  from app.review_experience_publications as publication
  join private.review_experience_revisions as revision on revision.id = publication.active_revision_id and revision.moderation_state = 'approved'
  join app.shops as shop on shop.id = publication.shop_id and shop.publication_status = 'published'
  left join app.shop_areas as shop_area on shop_area.shop_id = shop.id and shop_area.is_primary
  left join app.areas as area on area.id = shop_area.area_id and area.is_published
  where publication.publication_state = 'published'
    and char_length(coalesce(revision.experience_comment, '')) <= 400
    and char_length(coalesce(revision.nickname, '')) <= 30
    and char_length(coalesce(publication.therapist_display_name_snapshot, '')) <= 120
    and not exists (
      select 1
      from private.managed_shops as managed
      where managed.app_shop_id = shop.id
        and managed.publication_state <> 'published'
    )
    and (p_area_slug is null or area.slug = p_area_slug)
$$;

revoke all on function
  api.list_public_review_experience_publications_global(integer, integer, text),
  api.count_public_review_experience_publications_global(text),
  api.list_public_shop_detail_reviews_v11(text, integer, integer),
  api.get_public_shop_detail_review_summary_v11(text)
from public, anon, authenticated;

grant execute on function
  api.list_public_review_experience_publications_global(integer, integer, text),
  api.count_public_review_experience_publications_global(text),
  api.list_public_shop_detail_reviews_v11(text, integer, integer),
  api.get_public_shop_detail_review_summary_v11(text)
to anon, authenticated;

notify pgrst, 'reload schema';

insert into supabase_migrations.schema_migrations
  (version, statements, name, created_by, idempotency_key, rollback)
values
  ('20261020030000', array[$eskomi_packet_05_6$-- Public read-only v1.1 review projections. These security-definer readers
-- expose only canonical approved publications. They do not create a second
-- review store: moderation writes app.review_experience_publications and
-- withdrawals hide it in the v1.1 source chain.

-- The earlier v1.1 global reader exposed a managed-directory bigint.  The
-- public contract now uses the canonical UUID identity, so PostgreSQL requires
-- an explicit signature drop before the replacement return table is defined.
-- The grants are re-established below; no table, RLS, or data change occurs.
drop function if exists api.list_public_review_experience_publications_global(integer, integer, text);

create or replace function api.list_public_shop_detail_reviews_v11(
  p_shop_slug text, p_limit integer default 20, p_offset integer default 0
) returns table(
  public_handle uuid, rating smallint, body text, display_name text,
  therapist_display_name text, published_at timestamptz,
  reply_body text, reply_published_at timestamptz
)
language sql security definer set search_path = '' as $$
  select publication.public_handle,
    nullif(revision.assessment_snapshot->>'shopRating', '')::smallint,
    coalesce(revision.experience_comment, ''), nullif(btrim(revision.nickname), ''),
    publication.therapist_display_name_snapshot, publication.published_at,
    reply.body, reply.reviewed_at
  from app.review_experience_publications as publication
  join private.review_experience_revisions as revision on revision.id = publication.active_revision_id and revision.moderation_state = 'approved'
  join app.shops as shop on shop.id = publication.shop_id and shop.publication_status = 'published'
  left join lateral (
    select response.body, response.reviewed_at
    from private.review_experience_reply_revisions as response
    where response.publication_id = publication.id and response.state = 'approved' and char_length(response.body) <= 2000
    order by response.revision desc limit 1
  ) as reply on true
  where shop.slug = p_shop_slug and publication.publication_state = 'published'
    and char_length(coalesce(revision.experience_comment, '')) <= 400
    and char_length(coalesce(revision.nickname, '')) <= 30
    and char_length(coalesce(publication.therapist_display_name_snapshot, '')) <= 120
    and not exists (
      select 1
      from private.managed_shops as managed
      where managed.app_shop_id = shop.id
        and managed.publication_state <> 'published'
    )
  order by publication.published_at desc, publication.id desc
  limit greatest(1, least(p_limit, 20)) offset greatest(p_offset, 0)
$$;

create or replace function api.get_public_shop_detail_review_summary_v11(p_shop_slug text)
returns table(
  review_count bigint, rating_count bigint, average_rating numeric,
  oldest_published_at timestamptz, latest_published_at timestamptz
)
language sql security definer set search_path = '' as $$
  select count(*), count(rating), avg(rating)::numeric, min(published_at), max(published_at)
  from (
    select publication.published_at, nullif(revision.assessment_snapshot->>'shopRating', '')::smallint as rating
    from app.review_experience_publications as publication
    join private.review_experience_revisions as revision on revision.id = publication.active_revision_id and revision.moderation_state = 'approved'
    join app.shops as shop on shop.id = publication.shop_id and shop.publication_status = 'published'
    where shop.slug = p_shop_slug and publication.publication_state = 'published'
      and char_length(coalesce(revision.experience_comment, '')) <= 400
      and char_length(coalesce(revision.nickname, '')) <= 30
      and char_length(coalesce(publication.therapist_display_name_snapshot, '')) <= 120
      and not exists (
        select 1
        from private.managed_shops as managed
        where managed.app_shop_id = shop.id
          and managed.publication_state <> 'published'
      )
  ) as published
$$;

create or replace function api.list_public_review_experience_publications_global(
  p_limit integer default 20, p_offset integer default 0, p_area_slug text default null
) returns table(
  public_handle uuid, rating smallint, body text, display_name text,
  therapist_display_name text, published_at timestamptz, shop_id uuid,
  shop_slug text, shop_name text, area_id uuid, area_slug text, area_name text
)
language sql security definer set search_path = '' as $$
  select publication.public_handle,
    nullif(revision.assessment_snapshot->>'shopRating', '')::smallint,
    coalesce(revision.experience_comment, ''), nullif(btrim(revision.nickname), ''),
    publication.therapist_display_name_snapshot, publication.published_at,
    shop.id, shop.slug, shop.name, area.id, area.slug, area.name
  from app.review_experience_publications as publication
  join private.review_experience_revisions as revision on revision.id = publication.active_revision_id and revision.moderation_state = 'approved'
  join app.shops as shop on shop.id = publication.shop_id and shop.publication_status = 'published'
  left join app.shop_areas as shop_area on shop_area.shop_id = shop.id and shop_area.is_primary
  left join app.areas as area on area.id = shop_area.area_id and area.is_published
  where publication.publication_state = 'published'
    and char_length(coalesce(revision.experience_comment, '')) <= 400
    and char_length(coalesce(revision.nickname, '')) <= 30
    and char_length(coalesce(publication.therapist_display_name_snapshot, '')) <= 120
    and not exists (
      select 1
      from private.managed_shops as managed
      where managed.app_shop_id = shop.id
        and managed.publication_state <> 'published'
    )
    and (p_area_slug is null or area.slug = p_area_slug)
  order by publication.published_at desc, publication.id desc
  limit greatest(1, least(p_limit, 50)) offset greatest(p_offset, 0)
$$;

create or replace function api.count_public_review_experience_publications_global(p_area_slug text default null)
returns bigint
language sql security definer set search_path = '' as $$
  select count(*)
  from app.review_experience_publications as publication
  join private.review_experience_revisions as revision on revision.id = publication.active_revision_id and revision.moderation_state = 'approved'
  join app.shops as shop on shop.id = publication.shop_id and shop.publication_status = 'published'
  left join app.shop_areas as shop_area on shop_area.shop_id = shop.id and shop_area.is_primary
  left join app.areas as area on area.id = shop_area.area_id and area.is_published
  where publication.publication_state = 'published'
    and char_length(coalesce(revision.experience_comment, '')) <= 400
    and char_length(coalesce(revision.nickname, '')) <= 30
    and char_length(coalesce(publication.therapist_display_name_snapshot, '')) <= 120
    and not exists (
      select 1
      from private.managed_shops as managed
      where managed.app_shop_id = shop.id
        and managed.publication_state <> 'published'
    )
    and (p_area_slug is null or area.slug = p_area_slug)
$$;

revoke all on function
  api.list_public_review_experience_publications_global(integer, integer, text),
  api.count_public_review_experience_publications_global(text),
  api.list_public_shop_detail_reviews_v11(text, integer, integer),
  api.get_public_shop_detail_review_summary_v11(text)
from public, anon, authenticated;

grant execute on function
  api.list_public_review_experience_publications_global(integer, integer, text),
  api.count_public_review_experience_publications_global(text),
  api.list_public_shop_detail_reviews_v11(text, integer, integer),
  api.get_public_shop_detail_review_summary_v11(text)
to anon, authenticated;

notify pgrst, 'reload schema';
$eskomi_packet_05_6$], 'eskomi_public_review_read_rpc', null, null, null);

-- SOURCE 20261021000000_eskomi_access_collection_manifest_health.sql
-- SHA-256 11c947be9326299e53e6dabb2c70ad738040f664cb1586cdf901c57a0d98f11f
-- A collector may mark a past access-report day complete only after it has
-- recorded an independently checkable manifest.  This stores aggregate check
-- counts and a content hash, never visitor identifiers, request bodies, or IPs.

create table private.partner_shop_access_collection_manifests_v11 (
  observed_on date primary key,
  collector_label text not null check (collector_label ~ '^[a-z0-9][a-z0-9_-]{2,63}$'),
  required_check_count smallint not null check (required_check_count between 1 and 16),
  passed_check_count smallint not null check (passed_check_count between 0 and 16 and passed_check_count<=required_check_count),
  manifest_hash text not null check (manifest_hash ~ '^[0-9a-f]{64}$'),
  collection_state text not null check (collection_state in ('complete','partial')),
  checked_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table private.partner_shop_access_collection_manifests_v11 enable row level security;
revoke all on table private.partner_shop_access_collection_manifests_v11 from public,anon,authenticated;
grant select,insert,update,delete on table private.partner_shop_access_collection_manifests_v11 to service_role;

-- Fail closed: a direct finalizer call can still record a partial day, but it
-- cannot manufacture a complete day without the matching health manifest.
create or replace function private.finalize_partner_shop_access_collection_day_v11(p_observed_on date,p_collection_state text)
returns integer language plpgsql security definer set search_path=private,app,pg_temp as $$
declare v_changed integer;
begin
  if p_observed_on is null or p_observed_on >= (now() at time zone 'Asia/Tokyo')::date
    or p_collection_state not in ('complete','partial') then raise exception 'invalid collection finalization' using errcode='22023'; end if;
  if p_collection_state='complete' and not exists(
    select 1 from private.partner_shop_access_collection_manifests_v11 manifest
    where manifest.observed_on=p_observed_on and manifest.collection_state='complete'
  ) then raise exception 'complete collection requires a health manifest' using errcode='22023'; end if;
  perform private.prune_partner_shop_access_short_lived_v11(now());
  insert into private.partner_shop_access_collection_runs_v11(observed_on,collection_state,checked_at,updated_at)
    values(p_observed_on,p_collection_state,now(),now())
    on conflict(observed_on) do update set collection_state=excluded.collection_state,checked_at=excluded.checked_at,updated_at=excluded.updated_at;
  insert into private.partner_shop_access_observation_days_v11(shop_id,observed_on,collection_state,updated_at)
  select state.shop_id,p_observed_on,p_collection_state,now()
  from private.partner_shop_access_rollup_state_v11 state
  join app.shops shop on shop.id=state.shop_id and shop.publication_status='published'
  join private.managed_shops managed on managed.app_shop_id=shop.id and managed.publication_state='published'
  where state.first_observed_on<=p_observed_on
  on conflict(shop_id,observed_on) do update set collection_state=excluded.collection_state,updated_at=excluded.updated_at;
  get diagnostics v_changed=row_count;
  return v_changed;
end $$;

create function private.record_partner_shop_access_collection_manifest_v11(
  p_observed_on date,
  p_collector_label text,
  p_required_check_count smallint,
  p_passed_check_count smallint,
  p_manifest_hash text
) returns text language plpgsql security definer set search_path=private,app,pg_temp as $$
declare v_state text;
begin
  if p_observed_on is null or p_observed_on >= (now() at time zone 'Asia/Tokyo')::date
    or p_collector_label !~ '^[a-z0-9][a-z0-9_-]{2,63}$'
    or p_required_check_count not between 1 and 16
    or p_passed_check_count not between 0 and p_required_check_count
    or p_manifest_hash !~ '^[0-9a-f]{64}$' then raise exception 'invalid collection manifest' using errcode='22023'; end if;
  v_state:=case when p_passed_check_count=p_required_check_count then 'complete' else 'partial' end;
  insert into private.partner_shop_access_collection_manifests_v11(
    observed_on,collector_label,required_check_count,passed_check_count,manifest_hash,collection_state,checked_at,updated_at
  ) values (
    p_observed_on,p_collector_label,p_required_check_count,p_passed_check_count,p_manifest_hash,v_state,now(),now()
  ) on conflict(observed_on) do update set
    collector_label=excluded.collector_label,required_check_count=excluded.required_check_count,
    passed_check_count=excluded.passed_check_count,manifest_hash=excluded.manifest_hash,
    collection_state=excluded.collection_state,checked_at=excluded.checked_at,updated_at=excluded.updated_at;
  perform private.finalize_partner_shop_access_collection_day_v11(p_observed_on,v_state);
  return v_state;
end $$;

create function api.record_partner_shop_access_collection_manifest_v11(
  p_observed_on date,
  p_collector_label text,
  p_required_check_count smallint,
  p_passed_check_count smallint,
  p_manifest_hash text
) returns text language sql security invoker set search_path=private,api,pg_temp as $$
  select private.record_partner_shop_access_collection_manifest_v11(
    p_observed_on,p_collector_label,p_required_check_count,p_passed_check_count,p_manifest_hash
  )
$$;

revoke all on function private.finalize_partner_shop_access_collection_day_v11(date,text),api.finalize_partner_shop_access_collection_day_v11(date,text),private.record_partner_shop_access_collection_manifest_v11(date,text,smallint,smallint,text),api.record_partner_shop_access_collection_manifest_v11(date,text,smallint,smallint,text) from public,anon,authenticated;
grant execute on function private.finalize_partner_shop_access_collection_day_v11(date,text),api.finalize_partner_shop_access_collection_day_v11(date,text),private.record_partner_shop_access_collection_manifest_v11(date,text,smallint,smallint,text),api.record_partner_shop_access_collection_manifest_v11(date,text,smallint,smallint,text) to service_role;
notify pgrst,'reload schema';

insert into supabase_migrations.schema_migrations
  (version, statements, name, created_by, idempotency_key, rollback)
values
  ('20261021000000', array[$eskomi_packet_05_7$-- A collector may mark a past access-report day complete only after it has
-- recorded an independently checkable manifest.  This stores aggregate check
-- counts and a content hash, never visitor identifiers, request bodies, or IPs.

create table private.partner_shop_access_collection_manifests_v11 (
  observed_on date primary key,
  collector_label text not null check (collector_label ~ '^[a-z0-9][a-z0-9_-]{2,63}$'),
  required_check_count smallint not null check (required_check_count between 1 and 16),
  passed_check_count smallint not null check (passed_check_count between 0 and 16 and passed_check_count<=required_check_count),
  manifest_hash text not null check (manifest_hash ~ '^[0-9a-f]{64}$'),
  collection_state text not null check (collection_state in ('complete','partial')),
  checked_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table private.partner_shop_access_collection_manifests_v11 enable row level security;
revoke all on table private.partner_shop_access_collection_manifests_v11 from public,anon,authenticated;
grant select,insert,update,delete on table private.partner_shop_access_collection_manifests_v11 to service_role;

-- Fail closed: a direct finalizer call can still record a partial day, but it
-- cannot manufacture a complete day without the matching health manifest.
create or replace function private.finalize_partner_shop_access_collection_day_v11(p_observed_on date,p_collection_state text)
returns integer language plpgsql security definer set search_path=private,app,pg_temp as $$
declare v_changed integer;
begin
  if p_observed_on is null or p_observed_on >= (now() at time zone 'Asia/Tokyo')::date
    or p_collection_state not in ('complete','partial') then raise exception 'invalid collection finalization' using errcode='22023'; end if;
  if p_collection_state='complete' and not exists(
    select 1 from private.partner_shop_access_collection_manifests_v11 manifest
    where manifest.observed_on=p_observed_on and manifest.collection_state='complete'
  ) then raise exception 'complete collection requires a health manifest' using errcode='22023'; end if;
  perform private.prune_partner_shop_access_short_lived_v11(now());
  insert into private.partner_shop_access_collection_runs_v11(observed_on,collection_state,checked_at,updated_at)
    values(p_observed_on,p_collection_state,now(),now())
    on conflict(observed_on) do update set collection_state=excluded.collection_state,checked_at=excluded.checked_at,updated_at=excluded.updated_at;
  insert into private.partner_shop_access_observation_days_v11(shop_id,observed_on,collection_state,updated_at)
  select state.shop_id,p_observed_on,p_collection_state,now()
  from private.partner_shop_access_rollup_state_v11 state
  join app.shops shop on shop.id=state.shop_id and shop.publication_status='published'
  join private.managed_shops managed on managed.app_shop_id=shop.id and managed.publication_state='published'
  where state.first_observed_on<=p_observed_on
  on conflict(shop_id,observed_on) do update set collection_state=excluded.collection_state,updated_at=excluded.updated_at;
  get diagnostics v_changed=row_count;
  return v_changed;
end $$;

create function private.record_partner_shop_access_collection_manifest_v11(
  p_observed_on date,
  p_collector_label text,
  p_required_check_count smallint,
  p_passed_check_count smallint,
  p_manifest_hash text
) returns text language plpgsql security definer set search_path=private,app,pg_temp as $$
declare v_state text;
begin
  if p_observed_on is null or p_observed_on >= (now() at time zone 'Asia/Tokyo')::date
    or p_collector_label !~ '^[a-z0-9][a-z0-9_-]{2,63}$'
    or p_required_check_count not between 1 and 16
    or p_passed_check_count not between 0 and p_required_check_count
    or p_manifest_hash !~ '^[0-9a-f]{64}$' then raise exception 'invalid collection manifest' using errcode='22023'; end if;
  v_state:=case when p_passed_check_count=p_required_check_count then 'complete' else 'partial' end;
  insert into private.partner_shop_access_collection_manifests_v11(
    observed_on,collector_label,required_check_count,passed_check_count,manifest_hash,collection_state,checked_at,updated_at
  ) values (
    p_observed_on,p_collector_label,p_required_check_count,p_passed_check_count,p_manifest_hash,v_state,now(),now()
  ) on conflict(observed_on) do update set
    collector_label=excluded.collector_label,required_check_count=excluded.required_check_count,
    passed_check_count=excluded.passed_check_count,manifest_hash=excluded.manifest_hash,
    collection_state=excluded.collection_state,checked_at=excluded.checked_at,updated_at=excluded.updated_at;
  perform private.finalize_partner_shop_access_collection_day_v11(p_observed_on,v_state);
  return v_state;
end $$;

create function api.record_partner_shop_access_collection_manifest_v11(
  p_observed_on date,
  p_collector_label text,
  p_required_check_count smallint,
  p_passed_check_count smallint,
  p_manifest_hash text
) returns text language sql security invoker set search_path=private,api,pg_temp as $$
  select private.record_partner_shop_access_collection_manifest_v11(
    p_observed_on,p_collector_label,p_required_check_count,p_passed_check_count,p_manifest_hash
  )
$$;

revoke all on function private.finalize_partner_shop_access_collection_day_v11(date,text),api.finalize_partner_shop_access_collection_day_v11(date,text),private.record_partner_shop_access_collection_manifest_v11(date,text,smallint,smallint,text),api.record_partner_shop_access_collection_manifest_v11(date,text,smallint,smallint,text) from public,anon,authenticated;
grant execute on function private.finalize_partner_shop_access_collection_day_v11(date,text),api.finalize_partner_shop_access_collection_day_v11(date,text),private.record_partner_shop_access_collection_manifest_v11(date,text,smallint,smallint,text),api.record_partner_shop_access_collection_manifest_v11(date,text,smallint,smallint,text) to service_role;
notify pgrst,'reload schema';
$eskomi_packet_05_7$], 'eskomi_access_collection_manifest_health', null, null, null);
commit;

select jsonb_build_object(
  'status', 'COMMITTED',
  'project_ref_expected', 'goeagrxjsjcbbatpotbu',
  'stage', '05',
  'records', (
    select jsonb_agg(jsonb_build_object(
      'version', expected.version,
      'name', expected.name,
      'source_sha256', encode(extensions.digest(ledger.statements[1], 'sha256'), 'hex')
    ) order by expected.version)
    from (values ('20261017172000', 'eskomi_public_delivery_upgrade_hardening', 'ba1c78f07ed7b10f4c820a761d8dfc122c0a365ac5f8308cb099991ce41bdfda'), ('20261017173000', 'eskomi_access_measurement_integrity', 'cbf74c135c81d683a2907b36221baa06d982c9911c34eaebe22b248d653ed316'), ('20261017174000', 'eskomi_access_context_abuse_and_report_integrity', '8524ef543a1318b224b33ddce0c75bc22f941e2dc9586a2029d8ceb7080b401e'), ('20261017175000', 'eskomi_access_context_named_rpc', '29031eebc60d709a6975b76823761d4f3467c391faaa4bd9d1381176377dbee8'), ('20261018100000', 'partner_login_email_canonical_audit', '282156343e6cf5fe5cdc8e7ff040bc617236cad18a8c6955188b9381e37de7c9'), ('20261020030000', 'eskomi_public_review_read_rpc', 'c073a3b926b65c7120c9b7a2c13ca4323693197dc143470818d2d3c57a0ed184'), ('20261021000000', 'eskomi_access_collection_manifest_health', '11c947be9326299e53e6dabb2c70ad738040f664cb1586cdf901c57a0d98f11f')) as expected(version, name, source_sha256)
    join supabase_migrations.schema_migrations as ledger using (version)
  )
) as stage_result;
