-- Run after 20261020030000 inside one local transaction. The caller rolls the
-- transaction back, so the retained fixture receives neither schema nor data.
-- The records below use the actual v1.1 moderation publication/hide path;
-- they are not an independent public-review fixture table.

do $$
declare
  v_summary record;
begin
  if has_table_privilege('anon', 'private.review_experiences', 'select')
    or has_table_privilege('anon', 'private.review_experience_revisions', 'select')
    or has_table_privilege('anon', 'app.review_experience_publications', 'select') then
    raise exception 'public roles must not read canonical review tables directly';
  end if;
  if has_function_privilege('public', 'api.list_public_review_experience_publications_global(integer,integer,text)', 'execute')
    or has_function_privilege('public', 'api.count_public_review_experience_publications_global(text)', 'execute')
    or has_function_privilege('public', 'api.list_public_shop_detail_reviews_v11(text,integer,integer)', 'execute')
    or has_function_privilege('public', 'api.get_public_shop_detail_review_summary_v11(text)', 'execute') then
    raise exception 'public must not retain default EXECUTE on public readers';
  end if;
  if not has_function_privilege('anon', 'api.list_public_review_experience_publications_global(integer,integer,text)', 'execute')
    or not has_function_privilege('anon', 'api.count_public_review_experience_publications_global(text)', 'execute')
    or not has_function_privilege('anon', 'api.list_public_shop_detail_reviews_v11(text,integer,integer)', 'execute')
    or not has_function_privilege('anon', 'api.get_public_shop_detail_review_summary_v11(text)', 'execute') then
    raise exception 'anon public review reader grants are incomplete';
  end if;
  if exists (
    select 1 from pg_proc function
    join pg_namespace namespace on namespace.oid = function.pronamespace
    where namespace.nspname = 'api'
      and function.proname in (
        'list_public_review_experience_publications_global',
        'count_public_review_experience_publications_global',
        'list_public_shop_detail_reviews_v11',
        'get_public_shop_detail_review_summary_v11'
      )
      and not function.prosecdef
  ) then
    raise exception 'every public review reader must be security definer';
  end if;
  select * into v_summary from api.get_public_shop_detail_review_summary_v11('fixture-empty-read-shop');
  if v_summary.review_count <> 0 or v_summary.rating_count <> 0
    or v_summary.average_rating is not null or v_summary.oldest_published_at is not null
    or v_summary.latest_published_at is not null then
    raise exception 'a genuinely empty canonical source must produce an empty summary';
  end if;
end
$$;

do $$
declare
  v_payload jsonb := jsonb_build_object(
    'shop_name', 'Fixture public read shop',
    'area_slug', 'fixture-public-read-area',
    'area_name', 'Fixture public read area',
    'official_url', 'https://fixture.invalid/',
    'introduction', 'fixture', 'address', null, 'business_hours', null,
    'phone', null, 'line_url', null, 'booking_url', null, 'basic_price', null,
    'price_90', null, 'banner_asset_id', null, 'gallery_asset_ids', '[]'::jsonb
  );
  v_public_shop uuid;
  v_stopped_shop uuid;
  v_public_experience uuid;
  v_hidden_experience uuid;
  v_pending_experience uuid;
  v_stopped_experience uuid;
begin
  perform private.create_and_publish_canonical_managed_shop('fixture-public-read-shop', v_payload, 'fixture');
  perform private.create_and_publish_canonical_managed_shop('fixture-stopped-read-shop', v_payload || jsonb_build_object('shop_name', 'Fixture stopped read shop'), 'fixture');
  select id into v_public_shop from app.shops where slug = 'fixture-public-read-shop';
  select id into v_stopped_shop from app.shops where slug = 'fixture-stopped-read-shop';

  insert into private.review_experiences(shop_id, guest_display_name, edit_receipt_hash, state, subject_snapshot)
  values(v_public_shop, 'Fixture public reviewer', repeat('1', 64), 'submitted', '{}'::jsonb)
  returning id into v_public_experience;
  insert into private.review_experience_revisions(experience_id, revision, nickname, experience_comment, assessment_snapshot)
  values(v_public_experience, 1, 'Fixture public reviewer', 'PUBLIC_REVIEW_MUST_BE_VISIBLE', jsonb_build_object('shopRating', 5, 'therapistRating', null));
  insert into private.review_assessments(experience_id, target_kind, shop_id, rating, body)
  values(v_public_experience, 'shop', v_public_shop, 5, 'PUBLIC_REVIEW_MUST_BE_VISIBLE');
  if private.moderate_review_experience_v11(v_public_experience, 'approved', 'fixture qa', null, 1) <> 'approved' then
    raise exception 'fixture public review approval failed';
  end if;

  insert into private.review_experiences(shop_id, guest_display_name, edit_receipt_hash, state, subject_snapshot)
  values(v_public_shop, 'Fixture hidden reviewer', repeat('2', 64), 'submitted', '{}'::jsonb)
  returning id into v_hidden_experience;
  insert into private.review_experience_revisions(experience_id, revision, nickname, experience_comment, assessment_snapshot)
  values(v_hidden_experience, 1, 'Fixture hidden reviewer', 'HIDDEN_REVIEW_MUST_NOT_BE_VISIBLE', jsonb_build_object('shopRating', 4, 'therapistRating', null));
  insert into private.review_assessments(experience_id, target_kind, shop_id, rating, body)
  values(v_hidden_experience, 'shop', v_public_shop, 4, 'HIDDEN_REVIEW_MUST_NOT_BE_VISIBLE');
  if private.moderate_review_experience_v11(v_hidden_experience, 'approved', 'fixture qa', null, 1) <> 'approved'
    or private.moderate_review_experience_v11(v_hidden_experience, 'withdrawn', 'fixture qa', null, 2) <> 'withdrawn' then
    raise exception 'fixture review withdrawal/hide path failed';
  end if;

  insert into private.review_experiences(shop_id, guest_display_name, edit_receipt_hash, state, subject_snapshot)
  values(v_public_shop, 'Fixture pending reviewer', repeat('3', 64), 'submitted', '{}'::jsonb)
  returning id into v_pending_experience;
  insert into private.review_experience_revisions(experience_id, revision, nickname, experience_comment, assessment_snapshot)
  values(v_pending_experience, 1, 'Fixture pending reviewer', 'PENDING_REVIEW_MUST_NOT_BE_VISIBLE', jsonb_build_object('shopRating', 3, 'therapistRating', null));
  insert into private.review_assessments(experience_id, target_kind, shop_id, rating, body)
  values(v_pending_experience, 'shop', v_public_shop, 3, 'PENDING_REVIEW_MUST_NOT_BE_VISIBLE');

  insert into private.review_experiences(shop_id, guest_display_name, edit_receipt_hash, state, subject_snapshot)
  values(v_stopped_shop, 'Fixture stopped reviewer', repeat('4', 64), 'submitted', '{}'::jsonb)
  returning id into v_stopped_experience;
  insert into private.review_experience_revisions(experience_id, revision, nickname, experience_comment, assessment_snapshot)
  values(v_stopped_experience, 1, 'Fixture stopped reviewer', 'STOPPED_SHOP_REVIEW_MUST_NOT_BE_VISIBLE', jsonb_build_object('shopRating', 2, 'therapistRating', null));
  insert into private.review_assessments(experience_id, target_kind, shop_id, rating, body)
  values(v_stopped_experience, 'shop', v_stopped_shop, 2, 'STOPPED_SHOP_REVIEW_MUST_NOT_BE_VISIBLE');
  if private.moderate_review_experience_v11(v_stopped_experience, 'approved', 'fixture qa', null, 1) <> 'approved' then
    raise exception 'fixture stopped-shop review approval failed';
  end if;
  update private.managed_shops set publication_state = 'unlisted'
  where app_shop_id = v_stopped_shop;
end
$$;

-- A legacy public shop can be canonical and review-visible without a managed
-- directory row or a primary area.  The global unfiltered feed must include
-- it, while an area filter must not infer a membership.  A separate explicit
-- primary fixture proves the same filter still works only from is_primary.
do $$
declare
  v_null_shop uuid;
  v_primary_shop uuid;
  v_draft_shop uuid;
  v_area uuid;
  v_null_experience uuid;
  v_primary_experience uuid;
  v_draft_experience uuid;
  v_null_revision uuid;
  v_primary_revision uuid;
  v_draft_revision uuid;
begin
  insert into app.areas(wp_term_id,slug,name,is_published,published_at)
  values(990001,'fixture-explicit-primary-area','Fixture explicit primary area',true,now())
  returning id into v_area;
  insert into app.shops(slug,canonical_path,name,publication_status,published_at)
  values('fixture-legacy-primary-null','/shops/fixture-legacy-primary-null/','Fixture legacy primary null','published',now())
  returning id into v_null_shop;
  insert into app.shops(slug,canonical_path,name,publication_status,published_at)
  values('fixture-legacy-primary-explicit','/shops/fixture-legacy-primary-explicit/','Fixture legacy primary explicit','published',now())
  returning id into v_primary_shop;
  insert into app.shops(slug,canonical_path,name,publication_status,published_at)
  values('fixture-legacy-draft','/shops/fixture-legacy-draft/','Fixture legacy draft','draft',null)
  returning id into v_draft_shop;
  insert into app.shop_areas(shop_id,area_id,is_primary,source_system)
  values(v_primary_shop,v_area,true,'fixture');

  insert into private.review_experiences(shop_id,guest_display_name,edit_receipt_hash,state,reviewed_at)
  values(v_null_shop,'Fixture legacy reviewer',repeat('5',64),'approved',now()) returning id into v_null_experience;
  insert into private.review_experience_revisions(experience_id,revision,nickname,experience_comment,assessment_snapshot,moderation_state,reviewed_at)
  values(v_null_experience,1,'Fixture legacy reviewer','LEGACY_NULL_PRIMARY_VISIBLE',jsonb_build_object('shopRating',5),'approved',now()) returning id into v_null_revision;
  insert into app.review_experience_publications(experience_id,active_revision_id,shop_id,publication_state,published_at)
  values(v_null_experience,v_null_revision,v_null_shop,'published',now());

  insert into private.review_experiences(shop_id,guest_display_name,edit_receipt_hash,state,reviewed_at)
  values(v_primary_shop,'Fixture legacy reviewer',repeat('6',64),'approved',now()) returning id into v_primary_experience;
  insert into private.review_experience_revisions(experience_id,revision,nickname,experience_comment,assessment_snapshot,moderation_state,reviewed_at)
  values(v_primary_experience,1,'Fixture legacy reviewer','LEGACY_EXPLICIT_PRIMARY_VISIBLE',jsonb_build_object('shopRating',5),'approved',now()) returning id into v_primary_revision;
  insert into app.review_experience_publications(experience_id,active_revision_id,shop_id,publication_state,published_at)
  values(v_primary_experience,v_primary_revision,v_primary_shop,'published',now());

  insert into private.review_experiences(shop_id,guest_display_name,edit_receipt_hash,state,reviewed_at)
  values(v_draft_shop,'Fixture legacy reviewer',repeat('7',64),'approved',now()) returning id into v_draft_experience;
  insert into private.review_experience_revisions(experience_id,revision,nickname,experience_comment,assessment_snapshot,moderation_state,reviewed_at)
  values(v_draft_experience,1,'Fixture legacy reviewer','DRAFT_REVIEW_MUST_NOT_BE_VISIBLE',jsonb_build_object('shopRating',5),'approved',now()) returning id into v_draft_revision;
  insert into app.review_experience_publications(experience_id,active_revision_id,shop_id,publication_state,published_at)
  values(v_draft_experience,v_draft_revision,v_draft_shop,'published',now());
end
$$;

set local role anon;

do $$
declare
  v_summary record;
  v_count bigint;
  v_body text;
begin
  select api.count_public_review_experience_publications_global('fixture-public-read-area') into v_count;
  if v_count <> 1 then
    raise exception 'only the approved, published, active-shop review may reach global count: %', v_count;
  end if;
  select count(*), max(body) into v_count, v_body
  from api.list_public_review_experience_publications_global(20, 0, 'fixture-public-read-area');
  if v_count <> 1 or v_body <> 'PUBLIC_REVIEW_MUST_BE_VISIBLE' then
    raise exception 'global reader leaked hidden, pending, or stopped reviews';
  end if;
  select * into v_summary from api.get_public_shop_detail_review_summary_v11('fixture-public-read-shop');
  if v_summary.review_count <> 1 or v_summary.rating_count <> 1 or v_summary.average_rating <> 5
    or v_summary.oldest_published_at is null or v_summary.latest_published_at is null then
    raise exception 'approved shop summary is invalid';
  end if;
  foreach v_body in array array['fixture-stopped-read-shop', 'fixture-empty-read-shop'] loop
    select * into v_summary from api.get_public_shop_detail_review_summary_v11(v_body);
    if v_summary.review_count <> 0 or v_summary.rating_count <> 0 or v_summary.average_rating is not null
      or v_summary.oldest_published_at is not null or v_summary.latest_published_at is not null then
      raise exception 'stopped or empty shop leaked through summary: %', v_body;
    end if;
  end loop;
end
$$;

select exists(
  select 1 from api.list_public_review_experience_publications_global(50,0,null)
  where body='LEGACY_NULL_PRIMARY_VISIBLE' and area_id is null and area_slug is null and area_name is null
) as anon_global_primary_null_is_visible;
select not exists(
  select 1 from api.list_public_review_experience_publications_global(50,0,'fixture-explicit-primary-area')
  where body='LEGACY_NULL_PRIMARY_VISIBLE'
) as anon_area_filter_does_not_infer_primary;
select exists(
  select 1 from api.list_public_review_experience_publications_global(50,0,'fixture-explicit-primary-area')
  where body='LEGACY_EXPLICIT_PRIMARY_VISIBLE'
) as anon_area_filter_uses_explicit_primary;
select not exists(
  select 1 from api.list_public_review_experience_publications_global(50,0,null)
  where body='DRAFT_REVIEW_MUST_NOT_BE_VISIBLE'
) as anon_global_draft_never_visible;

select count(*) = 1 as anon_global_only_published
from api.list_public_review_experience_publications_global(20, 0, 'fixture-public-read-area');
select api.count_public_review_experience_publications_global('fixture-public-read-area') = 1 as anon_area_count_only_published;
select count(*) = 1 as anon_shop_detail_only_published
from api.list_public_shop_detail_reviews_v11('fixture-public-read-shop', 20, 0);
select (review_count = 0 and rating_count = 0 and average_rating is null) as anon_empty_shop_summary
from api.get_public_shop_detail_review_summary_v11('fixture-empty-read-shop');

reset role;
