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
  new_application uuid;
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

  -- Approval is a public-projection checkpoint, not the end of a Partner's
  -- ability to prepare and submit the next revision.
  if private.save_partner_listing_draft(workspace_a, 3, jsonb_build_object(
    'shop_name', '新規ローカル店舗', 'area', '大阪市中央区', 'website_url', 'https://example.test/new',
    'introduction', '承認後の次回更新', 'banner_asset_id', null
  )) <> 'ok' then raise exception 'Partner could not start a new draft after approval'; end if;
  if private.submit_partner_listing_change(workspace_a, 4) <> 'ok'
    or private.review_partner_listing_change(new_store, 4, 'approved', 'local_operator', '再承認') <> 'ok' then
    raise exception 'Partner could not complete a second approval cycle';
  end if;
  if not exists (
    select 1 from private.listing_store_publications
    where listing_store_id = new_store and approved_revision = 4 and introduction = '承認後の次回更新'
  ) then raise exception 'second Partner approval did not update the stable public projection'; end if;

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

  -- Separate approved applications may target one existing stable store. The
  -- newer approval must replace only its public projection, never ownership.
  legacy_application := private.submit_listing_application(jsonb_build_object(
    'idempotency_key', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'kind', 'existing_change',
    'existing_wp_shop_id', 8400000000000000099, 'existing_shop_slug', 'legacy-unowned-store',
    'shop_name', '既存店舗の再申請', 'area', '大阪市', 'website_url', 'https://example.test/legacy-v2',
    'introduction', '既存店舗の二回目承認紹介文', 'contact_name', '別の非公開連絡先', 'contact_email', 'second-contact@example.test', 'contact_role', 'manager',
    'edit_preference', 'operator', 'consent_privacy', true, 'consent_accuracy', true, 'consent_image_rights', true
  ));
  if private.review_listing_application(legacy_application, 1, 'approved', 'local_operator', 'second content approval') <> 'ok' then
    raise exception 'second existing-store application approval failed';
  end if;
  if not exists (
    select 1 from private.listing_store_publications
    where listing_store_id = legacy_store and shop_name = '既存店舗の再申請'
      and website_url = 'https://example.test/legacy-v2' and introduction = '既存店舗の二回目承認紹介文'
  ) then raise exception 'second application approval did not update the stable shop projection'; end if;
  if (select count(*) from private.listing_applications where listing_store_id = legacy_store) <> 2 then
    raise exception 'multiple applications were not retained against the existing stable store';
  end if;

  new_application := private.submit_listing_application(jsonb_build_object(
    'idempotency_key', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'kind', 'new_listing',
    'shop_name', '新規申請の公開店舗', 'area', '大阪市', 'website_url', 'https://example.test/new-public',
    'introduction', '新規申請の承認済み紹介文', 'contact_name', '新規の非公開連絡先', 'contact_email', 'new-contact@example.test', 'contact_role', 'owner',
    'edit_preference', 'operator', 'consent_privacy', true, 'consent_accuracy', true, 'consent_image_rights', true
  ));
  if private.review_listing_application(new_application, 1, 'approved', 'local_operator', 'new listing approval') <> 'ok' then
    raise exception 'new listing application approval failed';
  end if;
  if not exists (
    select 1 from private.listing_store_publications p
    join private.listing_stores s on s.id=p.listing_store_id
    where s.origin_application_id=new_application and p.shop_name='新規申請の公開店舗'
  ) then raise exception 'new listing approval did not create a stable public projection'; end if;
end;
$$;

select 1 / case when not has_table_privilege('anon', 'private.listing_stores', 'select') then 1 else 0 end;
select 1 / case when not has_table_privilege('authenticated', 'private.listing_store_revisions', 'select') then 1 else 0 end;
select 1 / case when not has_function_privilege('anon', 'api.get_partner_listing_editor(uuid)', 'execute') then 1 else 0 end;
rollback;
