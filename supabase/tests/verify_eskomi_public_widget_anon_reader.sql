-- Runs after the widget anon-reader migration in one transaction.  The caller
-- rolls it back, so no fixture schema or rows persist.
set local role service_role;

do $$
declare
  v_payload jsonb := jsonb_build_object(
    'shop_name', 'Fixture public widget shop', 'area_slug', 'fixture-widget-area',
    'area_name', 'Fixture widget area', 'official_url', 'https://fixture.invalid/',
    'introduction', 'fixture', 'address', null, 'business_hours', null,
    'phone', null, 'line_url', null, 'booking_url', null, 'basic_price', null,
    'price_90', null, 'banner_asset_id', null, 'gallery_asset_ids', '[]'::jsonb
  );
  v_shop uuid; v_workspace uuid; v_handle uuid; v_experience uuid; v_publication uuid;
  v_number integer; v_state text;
begin
  if not has_function_privilege('anon', 'api.get_public_review_widget_v11(uuid,integer,integer)', 'execute')
    or has_function_privilege('public', 'api.get_public_review_widget_v11(uuid,integer,integer)', 'execute')
    or has_function_privilege('anon', 'private.get_public_review_widget_v11(uuid,integer,integer)', 'execute') then
    raise exception 'only the API wrapper may be callable by anon';
  end if;
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='api' and p.proname='get_public_review_widget_v11' and not p.prosecdef) then
    raise exception 'public widget API wrapper must be security definer';
  end if;
  if has_table_privilege('anon','private.review_widget_settings_v11','select')
    or has_table_privilege('anon','app.review_experience_publications','select')
    or has_table_privilege('anon','private.review_experience_revisions','select')
    or has_table_privilege('anon','private.review_experience_reply_revisions','select') then
    raise exception 'anon must not select widget source tables';
  end if;

  perform private.create_and_publish_canonical_managed_shop('fixture-public-widget-shop', v_payload, 'fixture');
  select id into v_shop from app.shops where slug='fixture-public-widget-shop';
  select workspace_id into v_workspace from private.provision_partner_workspace_for_app_shop(v_shop);
  insert into private.review_widget_settings_v11(workspace_id,shop_id) values(v_workspace,v_shop) returning public_handle into v_handle;
  perform set_config('app.fixture_widget_handle', v_handle::text, true);

  for v_number in 1..8 loop
    insert into private.review_experiences(shop_id,guest_display_name,edit_receipt_hash,state,subject_snapshot)
      values(v_shop,'Fixture public widget reviewer ' || v_number, lpad(v_number::text,64,'0'),'submitted','{}'::jsonb)
      returning id into v_experience;
    insert into private.review_experience_revisions(experience_id,revision,nickname,experience_comment,assessment_snapshot)
      values(v_experience,1,'Fixture public widget reviewer','PUBLIC_WIDGET_REVIEW_' || v_number,jsonb_build_object('shopRating',5));
    insert into private.review_assessments(experience_id,target_kind,shop_id,rating,body)
      values(v_experience,'shop',v_shop,5,'PUBLIC_WIDGET_REVIEW_' || v_number);
    if private.moderate_review_experience_v11(v_experience,'approved','fixture',null,1) <> 'approved' then
      raise exception 'approved widget fixture review failed';
    end if;
    select id into v_publication from app.review_experience_publications where experience_id=v_experience;
    insert into private.review_experience_reply_revisions(publication_id,workspace_id,revision,body,state)
      values(v_publication,v_workspace,1,
        case when v_number=8 then 'APPROVED_WIDGET_REPLY' else 'PENDING_WIDGET_REPLY_MUST_NOT_BE_VISIBLE' end,
        case when v_number=8 then 'approved' else 'pending' end);
  end loop;

  insert into private.review_experiences(shop_id,guest_display_name,edit_receipt_hash,state,subject_snapshot)
    values(v_shop,'Fixture pending',lpad((txid_current()+10000000)::text,64,'b'),'submitted','{}'::jsonb) returning id into v_experience;
  insert into private.review_experience_revisions(experience_id,revision,nickname,experience_comment,assessment_snapshot)
    values(v_experience,1,'Fixture pending','PENDING_WIDGET_REVIEW_MUST_NOT_BE_VISIBLE',jsonb_build_object('shopRating',4));
  insert into private.review_assessments(experience_id,target_kind,shop_id,rating,body)
    values(v_experience,'shop',v_shop,4,'PENDING_WIDGET_REVIEW_MUST_NOT_BE_VISIBLE');

  insert into private.review_experiences(shop_id,guest_display_name,edit_receipt_hash,state,subject_snapshot)
    values(v_shop,'Fixture withdrawn',lpad((txid_current()+10000001)::text,64,'b'),'submitted','{}'::jsonb) returning id into v_experience;
  insert into private.review_experience_revisions(experience_id,revision,nickname,experience_comment,assessment_snapshot)
    values(v_experience,1,'Fixture withdrawn','WITHDRAWN_WIDGET_REVIEW_MUST_NOT_BE_VISIBLE',jsonb_build_object('shopRating',4));
  insert into private.review_assessments(experience_id,target_kind,shop_id,rating,body)
    values(v_experience,'shop',v_shop,4,'WITHDRAWN_WIDGET_REVIEW_MUST_NOT_BE_VISIBLE');
  if private.moderate_review_experience_v11(v_experience,'approved','fixture',null,1) <> 'approved'
    or private.moderate_review_experience_v11(v_experience,'withdrawn','fixture',null,2) <> 'withdrawn' then
    raise exception 'withdrawn widget fixture review failed';
  end if;
end
$$;

set local role anon;

select count(*) = 7 and bool_and(review_body like 'PUBLIC_WIDGET_REVIEW_%') as anon_widget_only_approved_published
from api.get_public_review_widget_v11(current_setting('app.fixture_widget_handle')::uuid,999,-1);
select count(*) = 1 and max(reply_body) = 'APPROVED_WIDGET_REPLY'
  and not bool_or(reply_body = 'PENDING_WIDGET_REPLY_MUST_NOT_BE_VISIBLE') as anon_widget_reply_only_approved
from api.get_public_review_widget_v11(current_setting('app.fixture_widget_handle')::uuid,999,-1);
select (select count(*) from api.get_public_review_widget_v11(current_setting('app.fixture_widget_handle')::uuid,0,0)) = 1
  and (select count(*) from api.get_public_review_widget_v11(current_setting('app.fixture_widget_handle')::uuid,999,7)) = 1
  and (select count(*) from api.get_public_review_widget_v11(current_setting('app.fixture_widget_handle')::uuid,999,8)) = 0
  and (select count(*) from api.get_public_review_widget_v11(null,3,0)) = 0 as anon_widget_limit_and_offset_clamped;

reset role;
set local role service_role;
update private.review_widget_settings_v11 set state='disabled' where public_handle=current_setting('app.fixture_widget_handle')::uuid;
set local role anon;
select count(*) = 0 as anon_widget_disabled_or_unlisted_hidden
from api.get_public_review_widget_v11(current_setting('app.fixture_widget_handle')::uuid,3,0);

reset role;
set local role service_role;
update private.review_widget_settings_v11 set state='active' where public_handle=current_setting('app.fixture_widget_handle')::uuid;
update private.managed_shops set publication_state='unlisted'
where app_shop_id=(select shop_id from private.review_widget_settings_v11 where public_handle=current_setting('app.fixture_widget_handle')::uuid);
set local role anon;
select count(*) = 0 as anon_widget_disabled_or_unlisted_hidden
from api.get_public_review_widget_v11(current_setting('app.fixture_widget_handle')::uuid,3,0);
reset role;
select not has_table_privilege('anon','private.review_widget_settings_v11','select')
  and not has_table_privilege('anon','app.review_experience_publications','select')
  and not has_table_privilege('anon','private.review_experience_revisions','select')
  and not has_table_privilege('anon','private.review_experience_reply_revisions','select') as anon_widget_direct_tables_denied;
