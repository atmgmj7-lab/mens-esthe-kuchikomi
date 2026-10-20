-- Local-only lifecycle contract for a genuinely WordPress-independent shop.
-- It uses the same API RPC signatures as the dashboard repository and rolls
-- back every fixture row.
begin;
-- API functions are security-invoker but call security-definer private
-- workflows.  Keep the inspection below as the local database owner because
-- private tables deliberately have RLS with no service-role table policy.

do $$
declare
  v_managed uuid;
  v_app uuid;
  v_suffix text := left(replace(gen_random_uuid()::text, '-', ''), 20);
  v_slug text;
  v_payload jsonb;
  v_result text;
  v_draft_managed uuid;
  v_draft_app uuid;
begin
  if to_regprocedure('api.create_and_publish_canonical_managed_shop(text,jsonb,text)') is null
    or to_regprocedure('api.save_and_publish_canonical_managed_shop(uuid,integer,jsonb,text)') is null
    or to_regprocedure('api.set_canonical_managed_shop_visibility(uuid,integer,text,text)') is null
    or to_regprocedure('api.review_canonical_managed_shop_revision(uuid,integer,text,text,text)') is null
    or to_regprocedure('api.archive_canonical_managed_shop(uuid,integer,text)') is null
    or to_regprocedure('api.restore_canonical_managed_shop_to_unlisted(uuid,integer,text)') is null
    or to_regprocedure('api.list_public_review_experience_publications_global(integer,integer,text)') is null then
    raise exception 'canonical managed directory API is not applied';
  end if;

  v_slug := 'canonical-directory-' || v_suffix;
  v_payload := jsonb_build_object(
    'shop_name','正規管理店舗 ' || v_suffix,
    'area_slug','canonical-area-' || left(v_suffix, 8),
    'area_name','正規テスト地域',
    'official_url','https://example.test/' || v_suffix,
    'introduction','初回公開の紹介。<script>は文字として保存する。',
    'address','大阪府テスト市', 'business_hours','10:00-22:00', 'phone','000-0000-0000',
    'line_url',null, 'booking_url','https://example.test/reserve/' || v_suffix,
    'basic_price',10000, 'price_90',14000, 'banner_asset_id',null, 'gallery_asset_ids','[]'::jsonb
  );

  v_managed := api.create_and_publish_canonical_managed_shop(v_slug, v_payload, 'local canonical operator');
  select app_shop_id into v_app from private.managed_shops where id = v_managed;
  if v_app is null or exists (select 1 from app.shops where id=v_app and wp_post_id is not null) then
    raise exception 'new dashboard shop did not receive an app_shop_id-only identity (% / %, app rows=%)', v_managed, v_app, (select count(*) from app.shops where slug=v_slug);
  end if;
  if not exists (select 1 from app.shops where id=v_app and slug=v_slug and publication_status='published')
    or not exists (select 1 from app.shop_areas sa join app.areas a on a.id=sa.area_id where sa.shop_id=v_app and a.slug=v_payload->>'area_slug')
    or not exists (select 1 from api.list_published_managed_shops() where managed_shop_id=v_managed and shop_slug=v_slug) then
    raise exception 'canonical creation did not reach public shop, area, and directory projections';
  end if;

  v_payload := v_payload || jsonb_build_object('shop_name','正規管理店舗 更新 ' || v_suffix, 'introduction','運営による直接編集の反映');
  v_result := api.save_and_publish_canonical_managed_shop(v_managed, 1, v_payload, 'local canonical operator');
  if v_result <> 'ok' or not exists (
    select 1 from app.shops where id=v_app and name=v_payload->>'shop_name' and excerpt='運営による直接編集の反映' and publication_status='published'
  ) then raise exception 'canonical direct edit did not reflect into app.shops'; end if;

  -- Changing a published canonical shop's area must clear the old primary
  -- before promoting the new one; the database has an immediate one-primary
  -- partial unique index.
  v_payload := v_payload || jsonb_build_object('area_slug','canonical-moved-' || left(v_suffix, 8), 'area_name','移動先テスト地域');
  v_result := api.save_and_publish_canonical_managed_shop(v_managed, 2, v_payload, 'local canonical operator');
  if v_result <> 'ok'
    or not exists (select 1 from app.shop_areas area join app.areas definition on definition.id=area.area_id where area.shop_id=v_app and area.is_primary and definition.slug=v_payload->>'area_slug')
    or exists (select 1 from app.shop_areas area join app.areas definition on definition.id=area.area_id where area.shop_id=v_app and area.is_primary and definition.slug<>v_payload->>'area_slug') then
    raise exception 'canonical direct area transition did not preserve one primary projection';
  end if;

  select managed_shop_id, app_shop_id into v_draft_managed, v_draft_app
  from api.create_canonical_managed_shop('canonical-draft-' || v_suffix, v_payload, 'local canonical operator');
  if api.submit_managed_shop_revision(v_draft_managed, 1, 'local canonical operator') <> 'ok' then
    raise exception 'canonical draft could not be submitted';
  end if;
  v_result := api.review_canonical_managed_shop_revision(v_draft_managed, 1, 'approved', 'local canonical operator', 'approved');
  if v_result <> 'ok'
    or not exists (select 1 from app.shops where id=v_draft_app and publication_status='published') then
    raise exception 'canonical draft approval did not publish its app identity (% / %)', v_result, (select publication_status from app.shops where id=v_draft_app);
  end if;

  v_result := api.set_canonical_managed_shop_visibility(v_managed, 3, 'unlisted', 'local canonical operator');
  if v_result <> 'ok'
    or exists (select 1 from api.list_published_managed_shops() where managed_shop_id=v_managed)
    or not exists (select 1 from app.shops where id=v_app and publication_status='review' and published_at is null) then
    raise exception 'canonical unlist leaked into public projections (result=% public=% app=% managed=%)', v_result,
      (select count(*) from api.list_published_managed_shops() where managed_shop_id=v_managed),
      (select publication_status || ':' || coalesce(published_at::text, 'null') from app.shops where id=v_app),
      (select publication_state from private.managed_shops where id=v_managed);
  end if;
  v_result := api.set_canonical_managed_shop_visibility(v_managed, 3, 'published', 'local canonical operator');
  if v_result <> 'ok'
    or not exists (select 1 from app.shops where id=v_app and publication_status='published') then
    raise exception 'canonical re-publication did not restore app visibility (% / %)', v_result, (select publication_status from app.shops where id=v_app);
  end if;

  v_result := api.archive_canonical_managed_shop(v_managed, 3, 'local canonical operator');
  if v_result <> 'ok'
    or exists (select 1 from api.list_published_managed_shops() where managed_shop_id=v_managed)
    or not exists (select 1 from app.shops where id=v_app and publication_status='archived') then
    raise exception 'canonical archive did not hide the app shop (% / %)', v_result, (select publication_status from app.shops where id=v_app);
  end if;
  v_result := api.restore_canonical_managed_shop_to_unlisted(v_managed, 3, 'local canonical operator');
  if v_result <> 'ok'
    or not exists (select 1 from private.managed_shops where id=v_managed and publication_state='unlisted')
    or not exists (select 1 from app.shops where id=v_app and publication_status='review') then
    raise exception 'canonical archive restore must return only to unlisted (% / % / %)', v_result,
      (select publication_state from private.managed_shops where id=v_managed),
      (select publication_status from app.shops where id=v_app);
  end if;
end;
$$;

select 1 / case when not has_function_privilege('anon', 'api.create_and_publish_canonical_managed_shop(text,jsonb,text)', 'execute') then 1 else 0 end as anon_cannot_create_canonical_shop;
select 1 / case when has_function_privilege('anon', 'api.list_public_review_experience_publications_global(integer,integer,text)', 'execute') then 1 else 0 end as anon_can_read_global_review_projection;
rollback;
