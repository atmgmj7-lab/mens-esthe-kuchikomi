-- Local-only Partner listing editor contract. The transaction is rolled back so
-- it can be repeated against the isolated local Supabase fixture database.
begin;
set local role service_role;

do $$
declare
  workspace_a uuid;
  workspace_b uuid;
  new_store uuid;
  legacy_application uuid;
  legacy_store uuid;
  decision text;
  publication record;
  banner_key text;
  banner_asset uuid;
begin
  if to_regprocedure('private.create_listing_store(text,text,text,text,uuid,bigint)') is null
    or to_regprocedure('private.save_partner_listing_draft(uuid,integer,jsonb)') is null
    or to_regprocedure('private.submit_partner_listing_change(uuid,integer)') is null
    or to_regprocedure('private.review_partner_listing_change(uuid,integer,text,text,text)') is null then
    raise exception 'Partner listing editor migration is not applied';
  end if;

  select workspace_id into workspace_a from api.provision_partner_workspace(
    8400000000000000001, 'local-new-store', '新規ローカル店舗',
    'https://mens-esthe-kuchikomi.com/shops/local-new-store/', 'operator'
  );
  select workspace_id into workspace_b from api.provision_partner_workspace(
    8400000000000000002, 'partner-listing-b', 'Partner Listing B',
    'https://mens-esthe-kuchikomi.com/shops/partner-listing-b/', 'operator'
  );
  update private.partner_workspaces set state = 'active_partner' where id in (workspace_a, workspace_b);

  new_store := private.create_listing_store(
    'local-new-store', '新規ローカル店舗', '大阪市中央区', 'https://example.test/new', workspace_a, null
  );
  if not exists (
    select 1 from private.listing_stores
    where id = new_store and workspace_id = workspace_a and existing_wp_shop_id is null
      and canonical_url = 'https://mens-esthe-kuchikomi.com/shops/local-new-store/'
  ) then
    raise exception 'new store must receive a stable slug without a legacy WordPress id';
  end if;

  -- The authenticated workspace may attach a private banner only to its own
  -- stable listing. The public projection is not touched by this upload.
  banner_key := private.reserve_partner_listing_banner_upload(workspace_a, 'image/png');
  banner_asset := private.attach_partner_listing_banner_asset(
    workspace_a, banner_key, repeat('a', 64), 'image/png', 1, 1, 1
  );
  if not exists (select 1 from private.listing_application_assets where id=banner_asset and listing_store_id=new_store and application_id is null) then
    raise exception 'Partner banner was not isolated to its stable store';
  end if;
  begin
    perform private.attach_partner_listing_banner_asset(workspace_b, banner_key, repeat('a', 64), 'image/png', 1, 1, 1);
    raise exception 'another Partner attached a banner to this store';
  exception when insufficient_privilege then null;
  end;

  decision := private.save_partner_listing_draft(workspace_a, 1, jsonb_build_object(
    'shop_name', '新規ローカル店舗', 'area', '大阪市中央区', 'website_url', 'https://example.test/new',
    'introduction', '本人編集の下書き紹介文', 'banner_asset_id', null
  ));
  if decision <> 'ok' then raise exception 'Partner draft was not saved'; end if;
  if private.save_partner_listing_draft(workspace_b, 1, jsonb_build_object(
    'shop_name', '他店変更', 'area', '大阪市', 'website_url', 'https://example.test/other'
  )) <> 'forbidden' then
    raise exception 'another Partner was allowed to edit this store';
  end if;
  if private.submit_partner_listing_change(workspace_a, 2) <> 'ok' then
    raise exception 'Partner draft was not submitted';
  end if;
  if private.review_partner_listing_change(new_store, 2, 'changes_requested', 'local_operator', '紹介文を補足してください。') <> 'ok' then
    raise exception 'operator could not return the submitted revision';
  end if;
  if exists (select 1 from private.listing_store_publications where listing_store_id = new_store) then
    raise exception 'returned revision leaked to public projection';
  end if;
  if not exists (
    select 1 from private.listing_store_reviews
    where listing_store_id = new_store and revision = 2 and note = '紹介文を補足してください。'
  ) then
    raise exception 'return reason was not retained privately';
  end if;

  if private.save_partner_listing_draft(workspace_a, 2, jsonb_build_object(
    'shop_name', '新規ローカル店舗', 'area', '大阪市中央区', 'website_url', 'https://example.test/new',
    'introduction', '差し戻し後に補足した紹介文', 'banner_asset_id', null
  )) <> 'ok' then raise exception 'Partner could not revise a returned listing'; end if;
  if private.submit_partner_listing_change(workspace_a, 3) <> 'ok' then raise exception 'revised listing was not submitted'; end if;
  if private.review_partner_listing_change(new_store, 3, 'approved', 'local_operator', '承認') <> 'ok' then
    raise exception 'operator could not approve revised listing';
  end if;
  select * into publication from private.listing_store_publications where listing_store_id = new_store;
  if publication.approved_revision <> 3
    or publication.introduction <> '差し戻し後に補足した紹介文'
    or publication.shop_slug <> 'local-new-store' then
    raise exception 'approved revision did not update the stable public projection';
  end if;
  if private.review_partner_listing_change(new_store, 3, 'approved', 'second_operator', 'duplicate') <> 'conflict' then
    raise exception 'duplicate approval was accepted';
  end if;
  if private.save_partner_listing_draft(workspace_a, 2, jsonb_build_object(
    'shop_name', '競合', 'area', '大阪市', 'website_url', 'https://example.test/stale'
  )) <> 'conflict' then raise exception 'stale Partner save was accepted'; end if;

  legacy_application := private.submit_listing_application(jsonb_build_object(
    'idempotency_key', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'kind', 'existing_change',
    'existing_wp_shop_id', 8400000000000000099, 'existing_shop_slug', 'legacy-unowned-store',
    'shop_name', '既存未確認店舗', 'area', '大阪市', 'website_url', 'https://example.test/legacy',
    'contact_name', '非公開連絡先', 'contact_email', 'legacy-contact@example.test', 'contact_role', 'owner',
    'edit_preference', 'shop', 'consent_privacy', true, 'consent_accuracy', true, 'consent_image_rights', true
  ));
  if private.review_listing_application(legacy_application, 1, 'approved', 'local_operator', 'content only') <> 'ok' then
    raise exception 'legacy application approval failed';
  end if;
  select id into legacy_store from private.listing_stores where existing_wp_shop_id = 8400000000000000099;
  if legacy_store is null or exists (select 1 from private.listing_stores where id = legacy_store and workspace_id is not null) then
    raise exception 'existing application granted ownership instead of creating an unbound stable listing';
  end if;
end;
$$;

select 1 / case when not has_table_privilege('anon', 'private.listing_stores', 'select') then 1 else 0 end;
select 1 / case when not has_table_privilege('authenticated', 'private.listing_store_revisions', 'select') then 1 else 0 end;
select 1 / case when not has_function_privilege('anon', 'api.get_partner_listing_editor(uuid)', 'execute') then 1 else 0 end;
rollback;
