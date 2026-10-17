-- Run only against a disposable/local database after all Eskomi canonical
-- migrations.  This transaction validates suppression, recovery, ownership,
-- withdrawal and nullable legacy-id boundaries without retaining test data.
begin;

do $$
declare
  v_payload jsonb := jsonb_build_object(
    'shop_name', 'Integrity validation shop', 'area_slug', 'integrity-area', 'area_name', 'Integrity Area',
    'official_url', 'https://example.test/integrity', 'introduction', 'Disposable local validation.',
    'address', null, 'business_hours', null, 'phone', null, 'line_url', null, 'booking_url', null,
    'basic_price', null, 'price_90', null, 'banner_asset_id', null, 'gallery_asset_ids', '[]'::jsonb
  );
  v_suffix text := left(replace(gen_random_uuid()::text, '-', ''), 20);
  v_managed uuid;
  v_shop uuid;
  v_workspace uuid;
  v_other_managed uuid;
  v_other_shop uuid;
  v_archived uuid;
  v_therapist uuid;
  v_assignment uuid;
  v_link uuid;
  v_experience uuid;
  v_replayed boolean;
  v_program uuid;
begin
  select managed_shop_id, app_shop_id into v_managed, v_shop
  from private.create_canonical_managed_shop('integrity-' || v_suffix, v_payload, 'local validation');
  select workspace_id into v_workspace from private.provision_partner_workspace_for_app_shop(v_shop);
  select managed_shop_id, app_shop_id into v_other_managed, v_other_shop
  from private.create_canonical_managed_shop('integrity-other-' || v_suffix, v_payload || jsonb_build_object('shop_name', 'Other integrity shop'), 'local validation');

  begin
    insert into private.partner_workspaces (wp_shop_id, shop_slug, shop_name, canonical_url)
    values (0, 'invalid-zero-' || v_suffix, 'Invalid zero', 'https://mens-esthe-kuchikomi.com/shops/invalid-zero-' || v_suffix || '/');
    raise exception 'wp_shop_id = 0 was accepted';
  exception when check_violation then null;
  end;
  begin
    insert into private.partner_workspaces (wp_shop_id, shop_slug, shop_name, canonical_url)
    values (-1, 'invalid-negative-' || v_suffix, 'Invalid negative', 'https://mens-esthe-kuchikomi.com/shops/invalid-negative-' || v_suffix || '/');
    raise exception 'negative wp_shop_id was accepted';
  exception when check_violation then null;
  end;
  begin
    insert into private.benefit_programs(workspace_id, shop_id, benefit_text)
    values (v_workspace, v_other_shop, 'This cross-shop program must fail.');
    raise exception 'benefit program accepted a shop outside its workspace';
  exception when foreign_key_violation then null;
  end;

  v_archived := private.import_managed_shop_from_legacy_as_archived(
    990000003, 'integrity-archive-' || v_suffix, v_payload, 'local validation', 'tombstone validation'
  );
  if not exists (
    select 1 from api.list_unlisted_managed_shop_legacy_identities()
    where existing_wp_shop_id = 990000003 and shop_slug = 'integrity-archive-' || v_suffix
  ) or not exists (
    select 1 from api.list_managed_shop_legacy_listing_states()
    where existing_wp_shop_id = 990000003 and publication_state = 'deleted'
  ) then
    raise exception 'unpublished deleted tombstone was omitted from legacy suppression';
  end if;
  if private.restore_archived_managed_shop_to_unlisted(v_archived, 1, 'local validation') <> 'ok'
    or not exists (
      select 1 from api.list_managed_shop_legacy_listing_states()
      where existing_wp_shop_id = 990000003 and publication_state = 'unlisted'
    ) then
    raise exception 'unpublished deleted tombstone did not restore to unlisted';
  end if;

  insert into app.therapists(stable_key) values ('integrity-therapist-' || v_suffix) returning id into v_therapist;
  insert into app.therapist_assignments(therapist_id, shop_id, display_name)
  values (v_therapist, v_shop, 'Integrity therapist') returning id into v_assignment;
  insert into private.review_entry_links(shop_id, therapist_assignment_id, link_kind, created_by)
  values (v_shop, v_assignment, 'therapist_link', 'local validation') returning public_handle into v_link;
  select experience_id, replayed into v_experience, v_replayed
  from private.submit_review_experience(
    v_link, repeat('1', 64), repeat('2', 64), 'Integrity guest', repeat('3', 64),
    null, null, 3::smallint, 'A neutral review validates withdrawal.', 4::smallint, 'Therapist review validates withdrawal.'
  );
  if v_replayed or private.moderate_review_experience(v_experience, 'approved', 'local operator', 'approved') <> 'approved' then
    raise exception 'review approval setup failed';
  end if;
  insert into private.benefit_programs(workspace_id, shop_id, state, benefit_text, operator_approved_at, operator_approved_by)
  values (v_workspace, v_shop, 'approved', 'Neutral benefit.', now(), 'local operator') returning id into v_program;
  if private.issue_benefit_code(v_program, v_experience, repeat('4', 64)) <> 'issued' then
    raise exception 'benefit issue setup failed';
  end if;
  if private.moderate_review_experience(v_experience, 'withdrawn', 'local operator', 'guest withdrawal') <> 'withdrawn'
    or exists (select 1 from app.review_publications where shop_id = v_shop and archived_at is null)
    or not exists (select 1 from private.benefit_codes where experience_id = v_experience and state = 'issued')
    or not exists (select 1 from private.review_outbox where aggregate_id = v_experience and event_type = 'review_withdrawn') then
    raise exception 'withdrawal did not remove only the public projection while retaining the neutral benefit';
  end if;
end;
$$;

rollback;
