-- Run only against a disposable/local database after the canonical-shop
-- foundation migration.  The enclosing transaction always rolls back.
begin;

do $$
declare
  v_managed uuid;
  v_shop uuid;
  v_workspace uuid;
  v_therapist uuid;
  v_assignment uuid;
  v_link uuid;
  v_experience uuid;
  v_replayed boolean;
  v_program uuid;
  v_archived uuid;
  v_suffix text := replace(gen_random_uuid()::text, '-', '');
  v_payload jsonb;
begin
  v_payload := jsonb_build_object(
    'shop_name', 'Canonical validation ' || v_suffix,
    'area_slug', 'validation-area-' || left(v_suffix, 8),
    'area_name', 'Validation Area',
    'official_url', 'https://example.test/' || v_suffix,
    'introduction', 'Disposable local validation only.',
    'address', 'Validation address',
    'business_hours', '10:00-20:00',
    'phone', '000-0000-0000',
    'line_url', null,
    'booking_url', null,
    'basic_price', 10000,
    'price_90', 14000,
    'banner_asset_id', null,
    'gallery_asset_ids', '[]'::jsonb
  );

  select managed_shop_id, app_shop_id into v_managed, v_shop
  from private.create_canonical_managed_shop('canonical-validation-' || left(v_suffix, 20), v_payload, 'local validation');
  if exists (select 1 from app.shops where id = v_shop and wp_post_id is not null) then
    raise exception 'new canonical shop must not have a WordPress ID';
  end if;
  select workspace_id into v_workspace from private.provision_partner_workspace_for_app_shop(v_shop);

  insert into app.therapists(stable_key) values ('therapist-' || left(v_suffix, 20)) returning id into v_therapist;
  insert into app.therapist_assignments(therapist_id, shop_id, display_name)
  values (v_therapist, v_shop, 'Validation therapist') returning id into v_assignment;
  insert into private.review_entry_links(shop_id, therapist_assignment_id, link_kind, created_by)
  values (v_shop, v_assignment, 'therapist_link', 'local validation') returning public_handle into v_link;

  select experience_id, replayed into v_experience, v_replayed
  from private.submit_review_experience(
    v_link, repeat('a', 63) || '1', repeat('b', 63) || '1', 'Validation guest', repeat('c', 63) || '1',
    repeat('d', 63) || '1', repeat('e', 63) || '1', 1::smallint, 'Low-score review validates neutral benefit eligibility.',
    5::smallint, 'Therapist assessment is a separate record.'
  );
  if v_replayed then raise exception 'first submission must not replay'; end if;
  select experience_id, replayed into strict v_experience, v_replayed
  from private.submit_review_experience(
    v_link, repeat('a', 63) || '1', repeat('b', 63) || '1', 'Validation guest', repeat('c', 63) || '1',
    repeat('d', 63) || '1', repeat('e', 63) || '1', 1::smallint, 'Low-score review validates neutral benefit eligibility.',
    5::smallint, 'Therapist assessment is a separate record.'
  );
  if not v_replayed then raise exception 'identical submission must replay'; end if;

  perform private.moderate_review_experience(v_experience, 'approved', 'local operator', 'validated');
  if (select count(*) from app.review_publications where shop_id = v_shop) <> 2 then
    raise exception 'shop and therapist assessments must publish separately';
  end if;

  insert into private.benefit_programs(workspace_id, shop_id, state, benefit_text, operator_approved_at, operator_approved_by)
  values (v_workspace, v_shop, 'approved', 'Neutral benefit for every approved review.', now(), 'local operator')
  returning id into v_program;
  if private.issue_benefit_code(v_program, v_experience, repeat('f', 63) || '1') <> 'issued' then
    raise exception 'approved review must receive a benefit regardless of rating';
  end if;
  if private.redeem_benefit_code(v_workspace, repeat('f', 63) || '1') <> 'redeemed'
    or private.redeem_benefit_code(v_workspace, repeat('f', 63) || '1') <> 'already_used' then
    raise exception 'benefit code must redeem exactly once';
  end if;

  v_archived := private.import_managed_shop_from_legacy_as_archived(
    990000002,
    'archive-validation-' || left(v_suffix, 20),
    v_payload,
    'local validation',
    'archive import validation'
  );
  if not exists (select 1 from private.managed_shops where id = v_archived and publication_state = 'deleted')
    or exists (select 1 from private.managed_shop_publications where managed_shop_id = v_archived) then
    raise exception 'archive import must create only a tombstone, never a publication';
  end if;
end
$$;

do $$
begin
  if has_table_privilege('anon', 'private.review_experiences', 'select')
    or has_table_privilege('anon', 'app.review_publications', 'select')
    or has_function_privilege('anon', 'api.submit_review_experience(uuid,text,text,text,text,text,text,smallint,text,smallint,text)', 'execute') then
    raise exception 'anonymous role received a forbidden direct privilege';
  end if;
end
$$;

rollback;
