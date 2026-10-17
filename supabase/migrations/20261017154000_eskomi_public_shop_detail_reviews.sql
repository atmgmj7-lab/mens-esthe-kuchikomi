-- Public shop-detail review projection for the v1.1 canonical shop path.
-- It is intentionally limited to already-approved publications and approved
-- partner replies.  No guest receipt, moderation note, or private identity is
-- exposed through this read model.

-- New submissions create the revision before the one or two assessment rows.
-- Capture both rows while that initial revision is pending so every public
-- surface reads the same immutable score snapshot (rather than a legacy
-- assessment row or an empty default JSON object).
create or replace function private.capture_pending_review_assessment_snapshot_v11()
returns trigger language plpgsql security definer set search_path = private, pg_temp as $$
begin
  update private.review_experience_revisions as revision
  set assessment_snapshot = jsonb_build_object(
    'shopRating', (
      select assessment.rating
      from private.review_assessments as assessment
      where assessment.experience_id = new.experience_id
        and assessment.target_kind = 'shop'
    ),
    'therapistRating', (
      select assessment.rating
      from private.review_assessments as assessment
      where assessment.experience_id = new.experience_id
        and assessment.target_kind = 'therapist'
    )
  )
  where revision.experience_id = new.experience_id
    and revision.revision = (
      select max(current_revision.revision)
      from private.review_experience_revisions as current_revision
      where current_revision.experience_id = new.experience_id
    )
    and revision.moderation_state = 'pending';
  return new;
end;
$$;

drop trigger if exists review_assessment_snapshot_capture_v11 on private.review_assessments;
create trigger review_assessment_snapshot_capture_v11
after insert on private.review_assessments
for each row execute function private.capture_pending_review_assessment_snapshot_v11();

update private.review_experience_revisions as revision
set assessment_snapshot = jsonb_build_object(
  'shopRating', (select assessment.rating from private.review_assessments as assessment where assessment.experience_id = revision.experience_id and assessment.target_kind = 'shop'),
  'therapistRating', (select assessment.rating from private.review_assessments as assessment where assessment.experience_id = revision.experience_id and assessment.target_kind = 'therapist')
)
where revision.assessment_snapshot = '{}'::jsonb;

create or replace function api.list_public_shop_detail_reviews_v11(
  p_shop_slug text,
  p_limit integer default 20,
  p_offset integer default 0
) returns table(
  public_handle uuid,
  rating smallint,
  body text,
  display_name text,
  therapist_display_name text,
  published_at timestamptz,
  reply_body text,
  reply_published_at timestamptz
)
language sql security invoker set search_path = private, app, pg_temp as $$
  select
    publication.public_handle,
    nullif(revision.assessment_snapshot->>'shopRating', '')::smallint,
    revision.experience_comment,
    revision.nickname,
    publication.therapist_display_name_snapshot,
    publication.published_at,
    reply.body,
    reply.reviewed_at
  from app.review_experience_publications as publication
  join private.review_experience_revisions as revision
    on revision.id = publication.active_revision_id
   and revision.moderation_state = 'approved'
  join app.shops as shop
    on shop.id = publication.shop_id
   and shop.publication_status = 'published'
  left join private.managed_shops as managed
    on managed.app_shop_id = shop.id
  left join lateral (
    select response.body, response.reviewed_at
    from private.review_experience_reply_revisions as response
    where response.publication_id = publication.id
      and response.state = 'approved'
    order by response.revision desc
    limit 1
  ) as reply on true
  where shop.slug = p_shop_slug
    and publication.publication_state = 'published'
    and (managed.id is null or managed.publication_state = 'published')
  order by publication.published_at desc, publication.id desc
  limit greatest(1, least(p_limit, 20))
  offset greatest(p_offset, 0)
$$;

create or replace function api.get_public_shop_detail_review_summary_v11(
  p_shop_slug text
) returns table(
  review_count bigint,
  rating_count bigint,
  average_rating numeric,
  oldest_published_at timestamptz,
  latest_published_at timestamptz
)
language sql security invoker set search_path = private, app, pg_temp as $$
  select
    count(*),
    count(rating),
    avg(rating)::numeric,
    min(published_at),
    max(published_at)
  from (
    select
      publication.published_at,
      nullif(revision.assessment_snapshot->>'shopRating', '')::smallint as rating
    from app.review_experience_publications as publication
    join private.review_experience_revisions as revision
      on revision.id = publication.active_revision_id
     and revision.moderation_state = 'approved'
    join app.shops as shop
      on shop.id = publication.shop_id
     and shop.publication_status = 'published'
    left join private.managed_shops as managed
      on managed.app_shop_id = shop.id
    where shop.slug = p_shop_slug
      and publication.publication_state = 'published'
      and (managed.id is null or managed.publication_state = 'published')
  ) as published
$$;

revoke all on function
  private.capture_pending_review_assessment_snapshot_v11(),
  api.list_public_shop_detail_reviews_v11(text, integer, integer),
  api.get_public_shop_detail_review_summary_v11(text)
from public, anon, authenticated;
grant execute on function
  private.capture_pending_review_assessment_snapshot_v11(),
  api.list_public_shop_detail_reviews_v11(text, integer, integer),
  api.get_public_shop_detail_review_summary_v11(text)
to service_role;

notify pgrst, 'reload schema';
