-- Run only against a disposable database after every migration.  This test
-- deliberately executes the PL/pgSQL submission function; source/regex tests
-- cannot detect output-variable ambiguity in RETURNS TABLE functions.
begin;

do $$
declare
  v_managed uuid;
  v_shop uuid;
  v_workspace uuid;
  v_link uuid;
  v_experience uuid;
  v_replayed boolean;
  v_code text;
  v_status text;
  v_payload jsonb := jsonb_build_object(
    'shop_name', 'V2 execution fixture', 'area_slug', 'v2-execution-area', 'area_name', 'V2 Execution Area',
    'official_url', 'https://example.test/v2-execution', 'introduction', 'V2 execution fixture.', 'address', null,
    'business_hours', null, 'phone', null, 'line_url', null, 'booking_url', null, 'basic_price', null,
    'price_90', null, 'banner_asset_id', null, 'gallery_asset_ids', '[]'::jsonb
  );
begin
  select managed_shop_id, app_shop_id into v_managed, v_shop
  from private.create_canonical_managed_shop('v2-execution-fixture', v_payload, 'local validation');
  update app.shops set publication_status = 'published', published_at = now() where id = v_shop;
  update private.managed_shops set publication_state = 'published' where id = v_managed;
  select workspace_id into v_workspace from private.provision_partner_workspace_for_app_shop(v_shop);
  insert into private.benefit_programs(workspace_id, shop_id, state, benefit_text, operator_approved_at, operator_approved_by)
  values (v_workspace, v_shop, 'approved', 'Execution benefit', now(), 'local validation');
  insert into private.review_entry_links(shop_id, link_kind, created_by)
  values (v_shop, 'shop_qr', 'local validation') returning public_handle into v_link;

  select result.experience_id, result.replayed, result.benefit_code, result.benefit_status
  into v_experience, v_replayed, v_code, v_status
  from private.submit_review_experience_v2(
    v_link, repeat('1', 64), repeat('2', 64), null::text, repeat('3', 64), null::text, repeat('4', 64),
    3::smallint, 'A neutral v2 submission.', null::smallint
  ) as result;
  if v_replayed or v_code !~ '^ESK-[0-9A-F]{32}$' or v_status <> 'issued' then
    raise exception 'v2 first receipt mismatch';
  end if;
  if (select count(*) from private.review_revisions as revision
      join private.review_assessments as assessment on assessment.id = revision.assessment_id
      where assessment.experience_id = v_experience) <> 1 then
    raise exception 'v2 revision copy was not created';
  end if;

  select result.experience_id, result.replayed, result.benefit_code, result.benefit_status
  into v_experience, v_replayed, v_code, v_status
  from private.submit_review_experience_v2(
    v_link, repeat('1', 64), repeat('2', 64), null::text, repeat('3', 64), null::text, repeat('4', 64),
    3::smallint, 'A neutral v2 submission.', null::smallint
  ) as result;
  if not v_replayed or v_code is not null or v_status <> 'already_issued' then
    raise exception 'v2 idempotent retry mismatch';
  end if;
end;
$$;

rollback;
