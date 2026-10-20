-- Public read-only v1.1 review projections. These security-definer readers
-- expose only canonical approved publications. They do not create a second
-- review store: moderation writes app.review_experience_publications and
-- withdrawals hide it in the v1.1 source chain.

create or replace function api.list_public_shop_detail_reviews_v11(
  p_shop_slug text, p_limit integer default 20, p_offset integer default 0
) returns table(
  public_handle uuid, rating smallint, body text, display_name text,
  therapist_display_name text, published_at timestamptz,
  reply_body text, reply_published_at timestamptz
)
language sql security definer set search_path = '' as $$
  select publication.public_handle,
    nullif(revision.assessment_snapshot->>'shopRating', '')::smallint,
    coalesce(revision.experience_comment, ''), nullif(btrim(revision.nickname), ''),
    publication.therapist_display_name_snapshot, publication.published_at,
    reply.body, reply.reviewed_at
  from app.review_experience_publications as publication
  join private.review_experience_revisions as revision on revision.id = publication.active_revision_id and revision.moderation_state = 'approved'
  join app.shops as shop on shop.id = publication.shop_id and shop.publication_status = 'published'
  left join private.managed_shops as managed on managed.app_shop_id = shop.id
  left join lateral (
    select response.body, response.reviewed_at
    from private.review_experience_reply_revisions as response
    where response.publication_id = publication.id and response.state = 'approved' and char_length(response.body) <= 2000
    order by response.revision desc limit 1
  ) as reply on true
  where shop.slug = p_shop_slug and publication.publication_state = 'published'
    and char_length(coalesce(revision.experience_comment, '')) <= 400
    and char_length(coalesce(revision.nickname, '')) <= 30
    and char_length(coalesce(publication.therapist_display_name_snapshot, '')) <= 120
    and (managed.id is null or managed.publication_state = 'published')
  order by publication.published_at desc, publication.id desc
  limit greatest(1, least(p_limit, 20)) offset greatest(p_offset, 0)
$$;

create or replace function api.get_public_shop_detail_review_summary_v11(p_shop_slug text)
returns table(
  review_count bigint, rating_count bigint, average_rating numeric,
  oldest_published_at timestamptz, latest_published_at timestamptz
)
language sql security definer set search_path = '' as $$
  select count(*), count(rating), avg(rating)::numeric, min(published_at), max(published_at)
  from (
    select publication.published_at, nullif(revision.assessment_snapshot->>'shopRating', '')::smallint as rating
    from app.review_experience_publications as publication
    join private.review_experience_revisions as revision on revision.id = publication.active_revision_id and revision.moderation_state = 'approved'
    join app.shops as shop on shop.id = publication.shop_id and shop.publication_status = 'published'
    left join private.managed_shops as managed on managed.app_shop_id = shop.id
    where shop.slug = p_shop_slug and publication.publication_state = 'published'
      and char_length(coalesce(revision.experience_comment, '')) <= 400
      and char_length(coalesce(revision.nickname, '')) <= 30
      and char_length(coalesce(publication.therapist_display_name_snapshot, '')) <= 120
      and (managed.id is null or managed.publication_state = 'published')
  ) as published
$$;

create or replace function api.list_public_review_experience_publications_global(
  p_limit integer default 20, p_offset integer default 0, p_area_slug text default null
) returns table(
  public_handle uuid, rating smallint, body text, display_name text,
  therapist_display_name text, published_at timestamptz, directory_id bigint,
  shop_slug text, shop_name text, area_slug text, area_name text
)
language sql security definer set search_path = '' as $$
  select publication.public_handle,
    nullif(revision.assessment_snapshot->>'shopRating', '')::smallint,
    coalesce(revision.experience_comment, ''), nullif(btrim(revision.nickname), ''),
    publication.therapist_display_name_snapshot, publication.published_at,
    managed.directory_id, shop.slug, shop.name, area.slug, area.name
  from app.review_experience_publications as publication
  join private.review_experience_revisions as revision on revision.id = publication.active_revision_id and revision.moderation_state = 'approved'
  join app.shops as shop on shop.id = publication.shop_id and shop.publication_status = 'published'
  join private.managed_shops as managed on managed.app_shop_id = shop.id and managed.publication_state = 'published'
  join private.managed_shop_publications as directory on directory.managed_shop_id = managed.id
  join app.shop_areas as shop_area on shop_area.shop_id = shop.id and shop_area.is_primary
  join app.areas as area on area.id = shop_area.area_id and area.is_published
  where publication.publication_state = 'published'
    and char_length(coalesce(revision.experience_comment, '')) <= 400
    and char_length(coalesce(revision.nickname, '')) <= 30
    and char_length(coalesce(publication.therapist_display_name_snapshot, '')) <= 120
    and (p_area_slug is null or area.slug = p_area_slug)
  order by publication.published_at desc, publication.id desc
  limit greatest(1, least(p_limit, 50)) offset greatest(p_offset, 0)
$$;

create or replace function api.count_public_review_experience_publications_global(p_area_slug text default null)
returns bigint
language sql security definer set search_path = '' as $$
  select count(*)
  from app.review_experience_publications as publication
  join private.review_experience_revisions as revision on revision.id = publication.active_revision_id and revision.moderation_state = 'approved'
  join app.shops as shop on shop.id = publication.shop_id and shop.publication_status = 'published'
  join private.managed_shops as managed on managed.app_shop_id = shop.id and managed.publication_state = 'published'
  join private.managed_shop_publications as directory on directory.managed_shop_id = managed.id
  join app.shop_areas as shop_area on shop_area.shop_id = shop.id and shop_area.is_primary
  join app.areas as area on area.id = shop_area.area_id and area.is_published
  where publication.publication_state = 'published'
    and char_length(coalesce(revision.experience_comment, '')) <= 400
    and char_length(coalesce(revision.nickname, '')) <= 30
    and char_length(coalesce(publication.therapist_display_name_snapshot, '')) <= 120
    and (p_area_slug is null or area.slug = p_area_slug)
$$;

revoke all on function
  api.list_public_review_experience_publications_global(integer, integer, text),
  api.count_public_review_experience_publications_global(text),
  api.list_public_shop_detail_reviews_v11(text, integer, integer),
  api.get_public_shop_detail_review_summary_v11(text)
from public, anon, authenticated;

grant execute on function
  api.list_public_review_experience_publications_global(integer, integer, text),
  api.count_public_review_experience_publications_global(text),
  api.list_public_shop_detail_reviews_v11(text, integer, integer),
  api.get_public_shop_detail_review_summary_v11(text)
to anon, authenticated;

notify pgrst, 'reload schema';
