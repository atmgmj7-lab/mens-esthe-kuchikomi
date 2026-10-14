begin;
do $$
declare a uuid; b uuid; expired uuid; key text; result text; public_row record;
begin
  a := private.submit_listing_application(jsonb_build_object('idempotency_key','11111111-1111-4111-8111-111111111111','kind','new_listing','shop_name','画像付き新規店舗','area','大阪市中央区','website_url','https://example.test/first','contact_name','非公開担当者','contact_email','private@example.test','contact_role','owner','edit_preference','operator','consent_privacy',true,'consent_accuracy',true,'consent_image_rights',true));
  if private.submit_listing_application(jsonb_build_object('idempotency_key','11111111-1111-4111-8111-111111111111','kind','new_listing','shop_name','画像付き新規店舗','area','大阪市中央区','website_url','https://example.test/first','contact_name','非公開担当者','contact_email','private@example.test','contact_role','owner','edit_preference','operator','consent_privacy',true,'consent_accuracy',true,'consent_image_rights',true)) <> a then raise exception 'idempotent submit changed application id'; end if;
  b := private.submit_listing_application(jsonb_build_object('idempotency_key','22222222-2222-4222-8222-222222222222','kind','new_listing','shop_name','別の店舗','area','大阪市北区','website_url','https://example.test/second','contact_name','別の担当者','contact_email','other@example.test','contact_role','manager','edit_preference','shop','consent_privacy',true,'consent_accuracy',true,'consent_image_rights',true));
  perform private.issue_listing_application_upload_token(a, repeat('a',64), gen_random_uuid(), now() + interval '10 minutes');
  key := private.reserve_listing_application_upload(a, repeat('a',64), 'image/png');
  if key !~ ('^listing-applications/' || a::text || '/[0-9a-f-]+[.]png$') then raise exception 'bad reserved key'; end if;
  perform private.attach_listing_application_asset(a,repeat('a',64),key,repeat('b',64),'image/png',42,2,2);
  begin perform private.reserve_listing_application_upload(a,repeat('a',64),'image/png'); raise exception 'reused token unexpectedly reserved'; exception when insufficient_privilege then null; end;
  begin perform private.reserve_listing_application_upload(b,repeat('a',64),'image/png'); raise exception 'cross application token unexpectedly reserved'; exception when insufficient_privilege then null; end;
  expired := private.submit_listing_application(jsonb_build_object('idempotency_key','33333333-3333-4333-8333-333333333333','kind','new_listing','shop_name','期限店舗','area','京都市','website_url','https://example.test/expired','contact_name','期限担当者','contact_email','expired@example.test','contact_role','owner','edit_preference','operator','consent_privacy',true,'consent_accuracy',true,'consent_image_rights',true));
  perform private.issue_listing_application_upload_token(expired, repeat('c',64), gen_random_uuid(), now() + interval '10 minutes');
  update private.listing_application_upload_tokens set expires_at=now()-interval '1 second' where application_id=expired;
  begin perform private.reserve_listing_application_upload(expired,repeat('c',64),'image/png'); raise exception 'expired token unexpectedly reserved'; exception when insufficient_privilege then null; end;
  result := private.review_listing_application(a,2,'approved','local_test','approved'); if result <> 'ok' then raise exception 'approval failed'; end if;
  select * into public_row from api.get_public_listing_projections() where application_id=a;
  if public_row.shop_name <> '画像付き新規店舗' or public_row.website_url <> 'https://example.test/first' then raise exception 'bad public projection'; end if;
  result := private.update_listing_application(a,2,jsonb_build_object('shop_name','更新済み新規店舗','area','大阪市中央区','website_url','https://example.test/updated','introduction','承認待ちの紹介文','edit_preference','operator')); if result <> 'ok' then raise exception 'edit failed'; end if;
  if private.update_listing_application(a,2,jsonb_build_object('shop_name','競合','area','大阪','website_url','https://example.test/conflict','edit_preference','operator')) <> 'conflict' then raise exception 'stale edit was accepted'; end if;
  result := private.review_listing_application(a,3,'approved','local_test','updated'); if result <> 'ok' then raise exception 'updated approval failed'; end if;
  if not exists (select 1 from api.get_public_listing_projections() p where p.application_id=a and p.shop_name='更新済み新規店舗' and p.introduction='承認待ちの紹介文') then raise exception 'updated public projection missing'; end if;
end $$;
select 1 / case when not has_table_privilege('anon','private.listing_application_upload_tokens','select') then 1 else 0 end;
select 1 / case when not has_function_privilege('anon','api.attach_listing_application_asset(uuid,text,text,text,text,integer,integer,integer)','execute') then 1 else 0 end;
rollback;
