begin;

do $$
declare
  fixture_parent_id uuid := '41000000-0000-4000-8000-000000000001';
  area_id uuid := '41000000-0000-4000-8000-000000000002';
  shop_id uuid := '41000000-0000-4000-8000-000000000003';
  draft_id uuid := '41000000-0000-4000-8000-000000000004';
  post_id uuid := '41000000-0000-4000-8000-000000000005';
  unpublished_primary_area_id uuid := '41000000-0000-4000-8000-000000000007';
  published_secondary_area_id uuid := '41000000-0000-4000-8000-000000000008';
  published_primary_area_id uuid := '41000000-0000-4000-8000-000000000009';
  unpublished_secondary_area_id uuid := '41000000-0000-4000-8000-000000000010';
  unpublished_parent_area_id uuid := '41000000-0000-4000-8000-000000000011';
  public_child_with_hidden_parent_id uuid := '41000000-0000-4000-8000-000000000012';
  unpublished_primary_shop_id uuid := '41000000-0000-4000-8000-000000000013';
  published_primary_shop_id uuid := '41000000-0000-4000-8000-000000000014';
  payload jsonb;
begin
  insert into app.areas(id, slug, name, is_published, published_at)
  values (fixture_parent_id, 'primary-fixture-parent', '正本親エリア', true, now()),
    (area_id, 'primary-fixture-area', '正本エリア', true, now());
  update app.areas set parent_id = fixture_parent_id where id = area_id;
  insert into app.areas(id, slug, name, is_published, published_at)
  values
    (unpublished_primary_area_id, 'primary-fixture-hidden-primary', '非公開主エリア', false, null),
    (published_secondary_area_id, 'primary-fixture-public-secondary', '公開副エリア', true, now()),
    (published_primary_area_id, 'primary-fixture-public-primary', '公開主エリア', true, now()),
    (unpublished_secondary_area_id, 'primary-fixture-hidden-secondary', '非公開副エリア', false, null),
    (unpublished_parent_area_id, 'primary-fixture-hidden-parent', '非公開親エリア', false, null),
    (public_child_with_hidden_parent_id, 'primary-fixture-child-hidden-parent', '非公開親を持つ公開子エリア', true, now());
  update app.areas
    set parent_id = unpublished_parent_area_id
    where id = public_child_with_hidden_parent_id;

  insert into app.shops(id, wp_post_id, slug, canonical_path, name, description_html, excerpt, publication_status, published_at)
  values (shop_id, 920000000001, 'primary-fixture-shop', '/shops/primary-fixture-shop/', '正本公開店舗', '<p>公開紹介</p>', '公開紹介', 'published', now()),
    (draft_id, 920000000002, 'primary-fixture-draft', '/shops/primary-fixture-draft/', '下書き店舗', '<p>非公開</p>', '非公開', 'draft', null);
  insert into app.shop_areas(shop_id, area_id, is_primary) values (shop_id, area_id, true), (draft_id, area_id, true);
  insert into app.shops(id, wp_post_id, slug, canonical_path, name, description_html, excerpt, publication_status, published_at)
  values
    (unpublished_primary_shop_id, 920000000003, 'primary-fixture-hidden-primary-shop', '/shops/primary-fixture-hidden-primary-shop/', '非公開主エリア店舗', '<p>非公開主エリア</p>', '非公開主エリア', 'published', now()),
    (published_primary_shop_id, 920000000004, 'primary-fixture-public-primary-shop', '/shops/primary-fixture-public-primary-shop/', '公開主エリア店舗', '<p>公開主エリア</p>', '公開主エリア', 'published', now());
  insert into app.shop_areas(shop_id, area_id, is_primary) values
    (unpublished_primary_shop_id, unpublished_primary_area_id, true),
    (unpublished_primary_shop_id, published_secondary_area_id, false),
    (published_primary_shop_id, published_primary_area_id, true),
    (published_primary_shop_id, unpublished_secondary_area_id, false);
  insert into app.shop_images(shop_id, image_url, image_role, is_public, verified_at)
  values (shop_id, 'https://example.test/primary-fixture.png', 'featured', true, now());
  insert into app.contents(id, route_key, content_type, source_type, title, body_html, body_text, publication_status, published_at)
  values (post_id, '/column/primary-fixture-article/', 'other', 'editorial-comment', '正本公開記事', '<p>公開本文</p>', '公開本文', 'published', now()),
    ('41000000-0000-4000-8000-000000000006', '/column/primary-fixture-draft/', 'other', 'editorial-comment', '下書き記事', '<p>非公開本文</p>', '非公開本文', 'draft', null);

  set local role anon;
  select api.get_public_site_directory_v1() into payload;
  reset role;

  if not (payload->'shops' @> '[{"slug":"primary-fixture-shop","legacy_wp_shop_id":920000000001,"canonical_path":"/shops/primary-fixture-shop/"}]'::jsonb)
    or payload->'shops' @> '[{"slug":"primary-fixture-draft"}]'::jsonb then
    raise exception 'public shop projection leaked a draft or omitted the published fixture: %', payload->'shops';
  end if;
  if not (payload->'areas' @> '[{"slug":"primary-fixture-area","parent_slug":"primary-fixture-parent"}]'::jsonb) then
    raise exception 'public area projection missed hierarchy: %', payload->'areas';
  end if;
  if payload->'shops' @> '[{"slug":"primary-fixture-hidden-primary-shop"}]'::jsonb
    or not (payload->'shops' @> '[{"slug":"primary-fixture-public-primary-shop","area_slug":"primary-fixture-public-primary"}]'::jsonb) then
    raise exception 'shop projection did not enforce the published primary-area rule: %', payload->'shops';
  end if;
  if not (payload->'areas' @> '[{"slug":"primary-fixture-child-hidden-parent","parent_slug":null}]'::jsonb) then
    raise exception 'public area projection leaked an unpublished parent slug: %', payload->'areas';
  end if;
  if not (payload->'posts' @> '[{"route_key":"/column/primary-fixture-article/","title":"正本公開記事"}]'::jsonb)
    or payload->'posts' @> '[{"route_key":"/column/primary-fixture-draft/"}]'::jsonb then
    raise exception 'public article projection leaked a draft or omitted the published fixture: %', payload->'posts';
  end if;
end
$$;

rollback;
