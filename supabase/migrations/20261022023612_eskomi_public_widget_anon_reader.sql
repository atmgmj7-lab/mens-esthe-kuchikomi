-- Public review-widget transport is restricted to this one API projection.
-- The private reader remains uncallable to browser roles.  Do not wrap it by
-- name: SQL-function lookup would require anon USAGE on private.  This API
-- security-definer instead carries the identical, explicit public predicate,
-- with no ambient search path and no browser table grant.

create or replace function api.get_public_review_widget_v11(
  p_handle uuid, p_limit integer default 3, p_offset integer default 0
) returns table(
  shop_name text, canonical_path text, review_count bigint, average_rating numeric,
  public_version bigint, data_as_of timestamptz, review_body text,
  review_rating smallint, published_at timestamptz, reply_body text,
  reply_published_at timestamptz
)
language sql security definer set search_path = '' as $$
  with setting as (
    select widget.shop_id
    from private.review_widget_settings_v11 as widget
    join app.shops as shop on shop.id = widget.shop_id and shop.publication_status = 'published'
    left join private.managed_shops as managed on managed.app_shop_id = shop.id
    where widget.public_handle = p_handle and widget.state = 'active'
      and (managed.id is null or managed.publication_state = 'published')
  ), reviews as (
    select publication.id, publication.public_version, publication.published_at,
      revision.experience_comment,
      nullif(revision.assessment_snapshot ->> 'shopRating', '')::smallint as rating
    from app.review_experience_publications as publication
    join private.review_experience_revisions as revision
      on revision.id = publication.active_revision_id and revision.moderation_state = 'approved'
    where publication.shop_id = (select shop_id from setting)
      and publication.publication_state = 'published'
  ), summary as (
    select count(*) as count, avg(rating)::numeric as average,
      coalesce(max(public_version), 0) as version
    from reviews
  )
  select shop.name, shop.canonical_path, summary.count, summary.average,
    summary.version, now(), reviews.experience_comment, reviews.rating,
    reviews.published_at, reply.body, reply.reviewed_at
  from setting
  join app.shops as shop on shop.id = setting.shop_id
  cross join summary
  left join reviews on true
  left join lateral (
    select response.body, response.reviewed_at
    from private.review_experience_reply_revisions as response
    where response.publication_id = reviews.id and response.state = 'approved'
    order by response.revision desc limit 1
  ) as reply on true
  order by reviews.published_at desc nulls last, reviews.id desc nulls last
  limit greatest(1, least(p_limit, 7)) offset greatest(p_offset, 0)
$$;

revoke all on function api.get_public_review_widget_v11(uuid,integer,integer)
  from public, anon, authenticated;
grant execute on function api.get_public_review_widget_v11(uuid,integer,integer) to anon;

notify pgrst, 'reload schema';
