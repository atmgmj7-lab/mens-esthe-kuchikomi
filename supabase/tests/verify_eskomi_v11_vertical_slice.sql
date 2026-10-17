begin;
do $$
declare
  v_managed uuid; v_shop uuid; v_link uuid; v_experience uuid; v_replayed boolean; v_expiry timestamptz; v_decision text; v_payload jsonb := jsonb_build_object('shop_name','V11 vertical fixture','area_slug','v11-area','area_name','V11 Area','official_url','https://example.test/v11','introduction','V11 fixture','address',null,'business_hours',null,'phone',null,'line_url',null,'booking_url',null,'basic_price',null,'price_90',null,'banner_asset_id',null,'gallery_asset_ids','[]'::jsonb);
begin
  select managed_shop_id, app_shop_id into v_managed, v_shop from private.create_canonical_managed_shop('v11-vertical-fixture', v_payload, 'fixture');
  update app.shops set publication_status = 'published', published_at = now() where id = v_shop;
  update private.managed_shops set publication_state = 'published' where id = v_managed;
  insert into private.review_entry_links(shop_id, link_kind, created_by) values (v_shop, 'shop_qr', 'fixture') returning public_handle into v_link;
  perform private.create_review_submission_context(v_link, repeat('1',64), repeat('2',64));
  select experience_id, replayed, receipt_expires_at into v_experience, v_replayed, v_expiry from private.submit_review_experience_v11(v_link,repeat('1',64),repeat('3',64),repeat('4',64),repeat('5',64),repeat('6',64),1::smallint,'low but valid',null,null::smallint);
  if v_replayed or v_expiry <= now() then raise exception 'initial v1.1 receipt failed'; end if;
  select experience_id, replayed, receipt_expires_at into v_experience, v_replayed, v_expiry from private.submit_review_experience_v11(v_link,repeat('1',64),repeat('3',64),repeat('4',64),repeat('5',64),repeat('6',64),1::smallint,'low but valid',null,null::smallint);
  if not v_replayed then raise exception 'v1.1 idempotent replay failed'; end if;
  v_decision := private.moderate_review_experience_v11(v_experience,'approved','fixture','approved');
  if v_decision <> 'approved' or (select count(*) from app.review_experience_publications where experience_id = v_experience and publication_state = 'published') <> 1 then raise exception 'one-experience public projection failed'; end if;
  v_decision := private.moderate_review_experience_v11(v_experience,'withdrawn','fixture','withdrawn');
  if v_decision <> 'withdrawn' or exists(select 1 from api.list_public_review_experience_publications('v11-vertical-fixture',20,0)) then raise exception 'withdrawal did not hide the v1.1 public projection'; end if;
end $$;
rollback;
