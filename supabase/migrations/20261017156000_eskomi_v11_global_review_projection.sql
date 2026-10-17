-- The global review list reads the same approved v1.1 publication revision
-- as the shop detail.  It intentionally exposes no receipt, session, or
-- moderation material.
create or replace function api.list_public_review_experience_publications_global(
  p_limit integer default 20, p_offset integer default 0, p_area_slug text default null
) returns table(
  public_handle uuid, rating smallint, body text, display_name text,
  therapist_display_name text, published_at timestamptz,
  directory_id bigint, shop_slug text, shop_name text, area_slug text, area_name text
) language sql security invoker set search_path=private,app,api,pg_temp as $$
  select publication.public_handle,
    nullif(revision.assessment_snapshot->>'shopRating','')::smallint,
    revision.experience_comment, revision.nickname, publication.therapist_display_name_snapshot,
    publication.published_at, managed.directory_id, shop.slug, shop.name,
    area.slug, area.name
  from app.review_experience_publications publication
  join private.review_experience_revisions revision
    on revision.id=publication.active_revision_id and revision.moderation_state='approved'
  join app.shops shop on shop.id=publication.shop_id and shop.publication_status='published'
  join private.managed_shops managed on managed.app_shop_id=shop.id and managed.publication_state='published'
  join private.managed_shop_publications directory on directory.managed_shop_id=managed.id
  join app.shop_areas shop_area on shop_area.shop_id=shop.id and shop_area.is_primary
  join app.areas area on area.id=shop_area.area_id and area.is_published
  where publication.publication_state='published'
    and (p_area_slug is null or area.slug=p_area_slug)
  order by publication.published_at desc, publication.id desc
  limit greatest(1,least(p_limit,50)) offset greatest(p_offset,0)
$$;

create or replace function api.count_public_review_experience_publications_global(p_area_slug text default null)
returns bigint language sql security invoker set search_path=private,app,api,pg_temp as $$
  select count(*) from app.review_experience_publications publication
  join private.review_experience_revisions revision on revision.id=publication.active_revision_id and revision.moderation_state='approved'
  join app.shops shop on shop.id=publication.shop_id and shop.publication_status='published'
  join private.managed_shops managed on managed.app_shop_id=shop.id and managed.publication_state='published'
  join app.shop_areas shop_area on shop_area.shop_id=shop.id and shop_area.is_primary
  join app.areas area on area.id=shop_area.area_id and area.is_published
  where publication.publication_state='published' and (p_area_slug is null or area.slug=p_area_slug)
$$;

revoke all on function api.list_public_review_experience_publications_global(integer,integer,text), api.count_public_review_experience_publications_global(text) from public, anon, authenticated;
grant execute on function api.list_public_review_experience_publications_global(integer,integer,text), api.count_public_review_experience_publications_global(text) to service_role;
notify pgrst, 'reload schema';
