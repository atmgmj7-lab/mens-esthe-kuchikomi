-- Local-only generalized operator directory contract. It always rolls back.
begin;
set local role service_role;

do $$
declare
  legacy_store uuid;
  new_store uuid;
  result text;
begin
  if to_regclass('private.managed_shops') is null
    or to_regprocedure('private.import_managed_shop_from_legacy(bigint,text,jsonb,text)') is null
    or to_regprocedure('private.create_managed_shop(text,jsonb,text)') is null
    or to_regprocedure('private.save_managed_shop_draft(uuid,integer,jsonb,text)') is null
    or to_regprocedure('private.submit_managed_shop_revision(uuid,integer,text)') is null
    or to_regprocedure('private.review_managed_shop_revision(uuid,integer,text,text,text)') is null then
    raise exception 'managed directory migration is not applied';
  end if;
  if to_regprocedure('api.attach_managed_shop_asset(uuid,uuid,text,text,text,integer,integer,integer,text)') is null
    or to_regprocedure('api.get_published_managed_shop_asset(uuid)') is null
    or to_regprocedure('api.set_managed_shop_visibility(uuid,integer,text,text)') is null
    or to_regprocedure('api.create_managed_shop(text,jsonb,text)') is null then
    raise exception 'managed directory asset API migration is not applied';
  end if;

  legacy_store := private.import_managed_shop_from_legacy(
    8400000000000000201,
    'legacy-managed-shop',
    jsonb_build_object(
      'shop_name','既存管理店舗','area_slug','osaka','area_name','大阪市',
      'official_url','https://example.test/legacy','introduction','既存の読取取込'
    ),
    'local-test'
  );
  if legacy_store is null then raise exception 'legacy import did not create identity'; end if;

  begin
    perform private.import_managed_shop_from_legacy(8400000000000000201, 'different-slug', jsonb_build_object(
      'shop_name','不一致','area_slug','osaka','area_name','大阪市','official_url','https://example.test/mismatch'
    ), 'local-test');
    raise exception 'legacy slug identity mismatch';
  exception when integrity_constraint_violation then null;
  end;

  result := private.save_managed_shop_draft(legacy_store, 1, jsonb_build_object(
    'shop_name','既存管理店舗','area_slug','osaka','area_name','大阪市',
    'official_url','https://example.test/legacy-v2','introduction','公開前の下書き'
  ), 'operator-local');
  if result <> 'ok' then raise exception 'managed draft was not saved'; end if;
  if exists (select 1 from private.managed_shop_publications where managed_shop_id=legacy_store) then
    raise exception 'draft leaked to managed public projection';
  end if;
  if private.submit_managed_shop_revision(legacy_store, 2, 'operator-local') <> 'ok' then
    raise exception 'managed revision was not submitted';
  end if;
  if private.review_managed_shop_revision(legacy_store, 2, 'changes_requested', 'operator-local', '紹介文を補足してください。') <> 'ok' then
    raise exception 'operator could not request changes';
  end if;
  if private.save_managed_shop_draft(legacy_store, 2, jsonb_build_object(
    'shop_name','既存管理店舗','area_slug','osaka','area_name','大阪市',
    'official_url','https://example.test/legacy-v2','introduction','補足済みの紹介文'
  ), 'operator-local') <> 'ok'
    or private.submit_managed_shop_revision(legacy_store, 3, 'operator-local') <> 'ok'
    or private.review_managed_shop_revision(legacy_store, 3, 'approved', 'operator-local', '承認') <> 'ok' then
    raise exception 'managed approval flow failed';
  end if;
  if not exists (select 1 from private.managed_shop_publications where managed_shop_id=legacy_store and approved_revision=3 and introduction='補足済みの紹介文') then
    raise exception 'approved managed projection missing';
  end if;
  if not exists (select 1 from api.list_published_managed_shops() where managed_shop_id=legacy_store) then
    raise exception 'approved managed publication is not publicly listed';
  end if;
  if private.set_managed_shop_visibility(legacy_store, 3, 'unlisted', 'operator-local') <> 'ok'
    or exists (select 1 from api.list_published_managed_shops() where managed_shop_id=legacy_store) then
    raise exception 'unlisted managed publication remained publicly listed';
  end if;
  if private.set_managed_shop_visibility(legacy_store, 3, 'published', 'operator-local') <> 'ok'
    or not exists (select 1 from api.list_published_managed_shops() where managed_shop_id=legacy_store) then
    raise exception 'republished managed publication is unavailable';
  end if;
  if private.save_managed_shop_draft(legacy_store, 2, jsonb_build_object(
    'shop_name','競合','area_slug','osaka','area_name','大阪市','official_url','https://example.test/stale'
  ), 'operator-local') <> 'conflict' then raise exception 'stale managed revision was accepted'; end if;

  new_store := private.create_managed_shop('new-managed-shop', jsonb_build_object(
    'shop_name','新規管理店舗','area_slug','osaka','area_name','大阪市',
    'official_url',null,'introduction','新規下書き'
  ), 'operator-local');
  if new_store is null or exists (select 1 from private.managed_shops where id=new_store and existing_wp_shop_id is not null) then
    raise exception 'new managed store identity was not isolated from WordPress';
  end if;
  if not exists (select 1 from private.managed_shop_revisions where managed_shop_id=new_store and official_url is null) then
    raise exception 'legacy-compatible managed draft rejected a missing official URL';
  end if;
  begin
    perform private.attach_managed_shop_asset(new_store, gen_random_uuid(), 'managed-shops/' || legacy_store::text || '/cross-store.png', repeat('a',64), 'image/png', 1, 1, 1, 'operator-local');
    raise exception 'cross-store asset was accepted';
  exception when insufficient_privilege then null;
  end;
end;
$$;

select 1 / case when not has_table_privilege('anon', 'private.managed_shops', 'select') then 1 else 0 end as anonymous_role_can_read_managed_directory;
rollback;
