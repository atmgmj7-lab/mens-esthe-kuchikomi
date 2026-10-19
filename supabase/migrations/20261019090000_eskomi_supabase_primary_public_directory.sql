-- Public, read-only projection used only after the explicit Supabase-primary cutover.
-- It intentionally excludes drafts, moderation state, private import records, and
-- partner workspace data. Existing base-table RLS remains the direct-read boundary.
create or replace function api.get_public_site_directory_v1()
returns jsonb
language sql
security definer
set search_path = app, api, pg_temp
as $$
  with published_shops as (
    select s.id, s.wp_post_id, s.slug, s.canonical_path, s.name, s.description_html, s.excerpt,
      s.official_url, s.updated_at,
      -- A public shop has one authoritative primary area. Do not silently replace an
      -- unpublished primary assignment with a secondary area: that would change its
      -- canonical public location during a staged area withdrawal.
      (select a.slug from app.shop_areas sa join app.areas a on a.id = sa.area_id and a.is_published
       where sa.shop_id = s.id and sa.is_primary limit 1) as area_slug,
      (select a.name from app.shop_areas sa join app.areas a on a.id = sa.area_id and a.is_published
       where sa.shop_id = s.id and sa.is_primary limit 1) as area_name,
      (select i.image_url from app.shop_images i where i.shop_id = s.id and i.is_public
       order by (i.image_role = 'featured') desc, i.sort_order, i.created_at limit 1) as image_url
    from app.shops s
    where s.publication_status = 'published'
      -- The managed-directory workflow can explicitly withdraw a legacy
      -- WordPress identity.  A Security Definer reader must preserve that
      -- operator decision instead of re-exposing the matching app row.
      and not exists (
        select 1
        from private.managed_shops managed
        where managed.existing_wp_shop_id = s.wp_post_id
          and managed.publication_state <> 'published'
      )
  ), published_areas as (
    select a.id, a.slug, a.name, a.description, parent.slug as parent_slug
    from app.areas a left join app.areas parent on parent.id = a.parent_id and parent.is_published
    where a.is_published
  ), published_posts as (
    select c.id, c.route_key, c.title, c.body_html, c.body_text, c.updated_at
    from app.contents c
    where c.publication_status = 'published'
      and c.shop_id is null and c.area_id is null
      and c.route_key ~ '^/column/[^/]+/$'
      and nullif(btrim(c.title), '') is not null
  ), published_pages as (
    select c.id, c.route_key, c.title, c.body_html, c.body_text, c.updated_at
    from app.contents c
    where c.publication_status = 'published'
      and c.shop_id is null and c.area_id is null
      and c.route_key = any(array['/contact/', '/about/', '/sitemap/', '/storelisting/', '/advertise/', '/osaka-nihonbashi/'])
      and nullif(btrim(c.title), '') is not null
  )
  select jsonb_build_object(
    'shops', coalesce((select jsonb_agg(jsonb_build_object(
      'id', id, 'legacy_wp_shop_id', wp_post_id, 'slug', slug, 'canonical_path', canonical_path,
      'name', name, 'description_html', description_html, 'excerpt', excerpt, 'official_url', official_url,
      'image_url', image_url, 'area_slug', area_slug, 'area_name', area_name, 'modified_at', updated_at
    ) order by slug) from published_shops where area_slug is not null), '[]'::jsonb),
    'areas', coalesce((select jsonb_agg(jsonb_build_object(
      'id', id, 'slug', slug, 'name', name, 'description', description, 'parent_slug', parent_slug
    ) order by slug) from published_areas), '[]'::jsonb),
    'posts', coalesce((select jsonb_agg(jsonb_build_object(
      'id', id, 'route_key', route_key, 'title', title, 'body_html', body_html, 'body_text', body_text, 'modified_at', updated_at
    ) order by route_key) from published_posts), '[]'::jsonb),
    'pages', coalesce((select jsonb_agg(jsonb_build_object(
      'id', id, 'route_key', route_key, 'title', title, 'body_html', body_html, 'body_text', body_text, 'modified_at', updated_at
    ) order by route_key) from published_pages), '[]'::jsonb),
    'coverage', jsonb_build_object(
      'published_shop_count', (select count(*) from published_shops where area_slug is not null),
      'published_area_count', (select count(*) from published_areas),
      'public_column_count', (select count(*) from published_posts),
      'public_static_page_count', (select count(*) from published_pages),
      'mapped_wp_shop_count', (select count(*) from published_shops where area_slug is not null and wp_post_id is not null)
    )
  )
$$;

revoke all on function api.get_public_site_directory_v1() from public;
grant execute on function api.get_public_site_directory_v1() to anon, authenticated;
notify pgrst, 'reload schema';
