-- Deliberately persistent local-only fixture for the primary-mode HTTP rehearsal.
-- Do not run against a cloud or production database.
insert into app.areas(id, slug, name, is_published, published_at)
values
  ('42000000-0000-4000-8000-000000000001', 'primary-http-parent', 'HTTP親エリア', true, now()),
  ('42000000-0000-4000-8000-000000000002', 'primary-http-area', 'HTTP正本エリア', true, now())
on conflict (id) do nothing;

update app.areas
set parent_id = '42000000-0000-4000-8000-000000000001'
where id = '42000000-0000-4000-8000-000000000002';

insert into app.shops(id, wp_post_id, slug, canonical_path, name, description_html, excerpt, publication_status, published_at)
values
  ('42000000-0000-4000-8000-000000000003', 920000000101, 'primary-http-shop', '/shops/primary-http-shop/', 'HTTP正本公開店舗', '<p>HTTP公開紹介</p>', 'HTTP公開紹介', 'published', now()),
  ('42000000-0000-4000-8000-000000000004', 920000000102, 'primary-http-draft', '/shops/primary-http-draft/', 'HTTP下書き店舗', '<p>非公開</p>', '非公開', 'draft', null)
on conflict (id) do nothing;

insert into app.shop_areas(shop_id, area_id, is_primary)
values
  ('42000000-0000-4000-8000-000000000003', '42000000-0000-4000-8000-000000000002', true),
  ('42000000-0000-4000-8000-000000000004', '42000000-0000-4000-8000-000000000002', true)
on conflict do nothing;

insert into app.shop_images(shop_id, image_url, image_role, is_public, verified_at)
values ('42000000-0000-4000-8000-000000000003', 'https://example.test/primary-http.png', 'featured', true, now())
on conflict (shop_id, image_url) do nothing;

insert into app.contents(id, route_key, content_type, source_type, title, body_html, body_text, publication_status, published_at)
values
  ('42000000-0000-4000-8000-000000000005', '/column/primary-http-article/', 'other', 'editorial-comment', 'HTTP正本公開記事', '<p>HTTP公開本文</p>', 'HTTP公開本文', 'published', now()),
  ('42000000-0000-4000-8000-000000000006', '/column/primary-http-draft/', 'other', 'editorial-comment', 'HTTP下書き記事', '<p>非公開本文</p>', '非公開本文', 'draft', null)
on conflict (id) do nothing;
