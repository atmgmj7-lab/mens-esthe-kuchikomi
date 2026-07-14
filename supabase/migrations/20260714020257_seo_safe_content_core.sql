create schema if not exists app;
create schema if not exists private;
create schema if not exists api;

revoke all on schema app from public;
revoke all on schema private from public;
revoke all on schema api from public;

create table app.areas (
  id uuid primary key default gen_random_uuid(),
  wp_term_id bigint unique,
  slug text not null unique,
  name text not null,
  parent_id uuid references app.areas(id) on delete set null,
  description text not null default '',
  legacy_payload jsonb not null default '{}'::jsonb,
  is_published boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint areas_slug_not_blank check (btrim(slug) <> ''),
  constraint areas_name_not_blank check (btrim(name) <> ''),
  constraint areas_publish_state check (not is_published or published_at is not null)
);

create table app.shops (
  id uuid primary key default gen_random_uuid(),
  wp_post_id bigint unique,
  slug text not null unique,
  canonical_path text not null unique,
  name text not null,
  description_html text not null default '',
  excerpt text not null default '',
  official_url text,
  phone text,
  address_text text,
  access_text text,
  booking_url text,
  legacy_payload jsonb not null default '{}'::jsonb,
  publication_status text not null default 'draft',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shops_slug_not_blank check (btrim(slug) <> ''),
  constraint shops_name_not_blank check (btrim(name) <> ''),
  constraint shops_canonical_path check (canonical_path ~ '^/shops/[^/]+/$'),
  constraint shops_publication_status check (publication_status in ('draft', 'review', 'published', 'archived')),
  constraint shops_publish_state check (publication_status <> 'published' or published_at is not null)
);

create table app.shop_areas (
  shop_id uuid not null references app.shops(id) on delete cascade,
  area_id uuid not null references app.areas(id) on delete cascade,
  is_primary boolean not null default false,
  source_system text not null default 'wordpress',
  created_at timestamptz not null default now(),
  primary key (shop_id, area_id)
);

create unique index shop_areas_one_primary_per_shop
  on app.shop_areas (shop_id)
  where is_primary;

create table app.shop_prices (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references app.shops(id) on delete cascade,
  course_name text not null,
  duration_minutes integer,
  amount_yen integer not null,
  currency text not null default 'JPY',
  notes text,
  is_public boolean not null default false,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shop_prices_course_name_not_blank check (btrim(course_name) <> ''),
  constraint shop_prices_duration_positive check (duration_minutes is null or duration_minutes > 0),
  constraint shop_prices_amount_positive check (amount_yen > 0),
  constraint shop_prices_currency_jpy check (currency = 'JPY'),
  constraint shop_prices_public_verified check (not is_public or verified_at is not null)
);

create table app.shop_business_hours (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references app.shops(id) on delete cascade,
  day_of_week smallint,
  opens_at time,
  closes_at time,
  is_overnight boolean not null default false,
  notes text,
  is_public boolean not null default false,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shop_business_hours_day check (day_of_week is null or day_of_week between 0 and 6),
  constraint shop_business_hours_has_value check (
    (opens_at is not null and closes_at is not null) or nullif(btrim(notes), '') is not null
  ),
  constraint shop_business_hours_public_verified check (not is_public or verified_at is not null)
);

create table app.shop_images (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references app.shops(id) on delete cascade,
  wp_media_id bigint,
  image_url text not null,
  alt_text text not null default '',
  image_role text not null default 'gallery',
  sort_order integer not null default 0,
  is_public boolean not null default false,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shop_images_url_not_blank check (btrim(image_url) <> ''),
  constraint shop_images_role check (image_role in ('featured', 'gallery', 'logo', 'menu', 'other')),
  constraint shop_images_sort_order check (sort_order >= 0),
  constraint shop_images_public_verified check (not is_public or verified_at is not null),
  unique (shop_id, image_url)
);

create table app.sources (
  id uuid primary key default gen_random_uuid(),
  source_url text not null,
  source_kind text not null,
  title text,
  fetched_at timestamptz,
  verified_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sources_url_not_blank check (btrim(source_url) <> ''),
  constraint sources_kind check (source_kind in ('official', 'wordpress', 'user-submission', 'editorial', 'third-party')),
  unique (source_url, source_kind)
);

create table app.shop_source_links (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references app.shops(id) on delete cascade,
  source_id uuid not null references app.sources(id) on delete cascade,
  field_name text not null,
  verification_status text not null default 'unverified',
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shop_source_links_field_not_blank check (btrim(field_name) <> ''),
  constraint shop_source_links_status check (verification_status in ('unverified', 'verified', 'stale', 'rejected')),
  constraint shop_source_links_public_verified check (not is_public or verification_status = 'verified'),
  unique (shop_id, source_id, field_name)
);

create table app.contents (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid references app.shops(id) on delete cascade,
  area_id uuid references app.areas(id) on delete cascade,
  route_key text,
  content_type text not null,
  source_type text not null,
  title text,
  body_html text not null default '',
  body_text text not null default '',
  source_id uuid references app.sources(id) on delete set null,
  publication_status text not null default 'draft',
  is_ai_generated boolean not null default false,
  is_promotion boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contents_one_owner check (
    num_nonnulls(shop_id, area_id, nullif(btrim(route_key), '')) = 1
  ),
  constraint contents_type check (content_type in ('shop-description', 'area-guide', 'faq', 'editorial-comment', 'promotion', 'other')),
  constraint contents_source_type check (source_type in ('editorial-comment', 'shop-provided', 'shop-description', 'ai-generated', 'promotion', 'unknown')),
  constraint contents_publication_status check (publication_status in ('draft', 'review', 'published', 'archived')),
  constraint contents_body_not_blank check (nullif(btrim(body_text), '') is not null or nullif(btrim(body_html), '') is not null),
  constraint contents_ai_source check (not is_ai_generated or source_type = 'ai-generated'),
  constraint contents_promotion_source check (not is_promotion or source_type = 'promotion'),
  constraint contents_publish_state check (publication_status <> 'published' or published_at is not null)
);

create table app.content_revisions (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references app.contents(id) on delete cascade,
  version_number integer not null,
  title text,
  body_html text not null default '',
  body_text text not null default '',
  source_id uuid references app.sources(id) on delete set null,
  changed_by uuid,
  change_note text,
  created_at timestamptz not null default now(),
  constraint content_revisions_version_positive check (version_number > 0),
  unique (content_id, version_number)
);

create table app.reviews (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references app.shops(id) on delete cascade,
  source_type text not null default 'user-review',
  moderation_status text not null default 'pending',
  publication_status text not null default 'draft',
  body text not null,
  rating smallint,
  author_name text,
  author_id uuid,
  is_public boolean not null default false,
  is_ai_generated boolean not null default false,
  is_promotion boolean not null default false,
  source_system text not null default 'wordpress',
  source_post_type text,
  source_post_id bigint,
  source_field text,
  submitted_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reviews_source_type check (source_type in ('user-review', 'editorial-comment', 'shop-provided', 'ai-generated', 'promotion', 'unknown')),
  constraint reviews_moderation_status check (moderation_status in ('pending', 'approved', 'rejected', 'spam')),
  constraint reviews_publication_status check (publication_status in ('draft', 'published', 'archived')),
  constraint reviews_body_not_blank check (btrim(body) <> ''),
  constraint reviews_rating_range check (rating is null or rating between 1 and 5),
  constraint reviews_public_safety check (
    not is_public or (
      source_type = 'user-review'
      and moderation_status = 'approved'
      and publication_status = 'published'
      and not is_ai_generated
      and not is_promotion
      and approved_at is not null
    )
  )
);

create table private.import_batches (
  id uuid primary key default gen_random_uuid(),
  source_system text not null,
  source_url text,
  status text not null default 'pending',
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  source_count integer not null default 0,
  imported_count integer not null default 0,
  failed_count integer not null default 0,
  checksum text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint import_batches_source_not_blank check (btrim(source_system) <> ''),
  constraint import_batches_status check (status in ('pending', 'running', 'completed', 'failed', 'rolled-back')),
  constraint import_batches_counts_nonnegative check (
    source_count >= 0 and imported_count >= 0 and failed_count >= 0
  )
);

create table private.import_records (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references private.import_batches(id) on delete cascade,
  entity_type text not null,
  source_id text not null,
  target_table text,
  target_id uuid,
  status text not null default 'pending',
  source_payload jsonb not null default '{}'::jsonb,
  transformed_payload jsonb not null default '{}'::jsonb,
  issues jsonb not null default '[]'::jsonb,
  imported_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint import_records_entity_not_blank check (btrim(entity_type) <> ''),
  constraint import_records_source_id_not_blank check (btrim(source_id) <> ''),
  constraint import_records_status check (status in ('pending', 'ready', 'imported', 'skipped', 'failed')),
  unique (batch_id, entity_type, source_id)
);

create index areas_parent_id_idx on app.areas (parent_id);
create index shops_publication_status_idx on app.shops (publication_status, published_at desc);
create index shop_areas_area_id_idx on app.shop_areas (area_id, shop_id);
create index shop_prices_shop_id_idx on app.shop_prices (shop_id, amount_yen);
create index shop_business_hours_shop_id_idx on app.shop_business_hours (shop_id, day_of_week);
create index shop_images_shop_id_idx on app.shop_images (shop_id, sort_order);
create index shop_source_links_shop_id_idx on app.shop_source_links (shop_id, field_name);
create index contents_shop_id_idx on app.contents (shop_id, publication_status);
create index contents_area_id_idx on app.contents (area_id, publication_status);
create index contents_route_key_idx on app.contents (route_key, publication_status);
create index reviews_shop_public_idx on app.reviews (shop_id, submitted_at desc) where is_public;
create index import_records_batch_status_idx on private.import_records (batch_id, status);

alter table app.areas enable row level security;
alter table app.shops enable row level security;
alter table app.shop_areas enable row level security;
alter table app.shop_prices enable row level security;
alter table app.shop_business_hours enable row level security;
alter table app.shop_images enable row level security;
alter table app.sources enable row level security;
alter table app.shop_source_links enable row level security;
alter table app.contents enable row level security;
alter table app.content_revisions enable row level security;
alter table app.reviews enable row level security;
alter table private.import_batches enable row level security;
alter table private.import_records enable row level security;

create policy areas_public_read on app.areas
  for select to anon, authenticated
  using (is_published);

create policy shops_public_read on app.shops
  for select to anon, authenticated
  using (publication_status = 'published');

create policy shop_areas_public_read on app.shop_areas
  for select to anon, authenticated
  using (
    exists (
      select 1 from app.shops
      where shops.id = shop_areas.shop_id
        and shops.publication_status = 'published'
    )
    and exists (
      select 1 from app.areas
      where areas.id = shop_areas.area_id
        and areas.is_published
    )
  );

create policy shop_prices_public_read on app.shop_prices
  for select to anon, authenticated
  using (
    is_public
    and verified_at is not null
    and exists (
      select 1 from app.shops
      where shops.id = shop_prices.shop_id
        and shops.publication_status = 'published'
    )
  );

create policy shop_business_hours_public_read on app.shop_business_hours
  for select to anon, authenticated
  using (
    is_public
    and verified_at is not null
    and exists (
      select 1 from app.shops
      where shops.id = shop_business_hours.shop_id
        and shops.publication_status = 'published'
    )
  );

create policy shop_images_public_read on app.shop_images
  for select to anon, authenticated
  using (
    is_public
    and verified_at is not null
    and exists (
      select 1 from app.shops
      where shops.id = shop_images.shop_id
        and shops.publication_status = 'published'
    )
  );

create policy shop_source_links_public_read on app.shop_source_links
  for select to anon, authenticated
  using (
    is_public
    and verification_status = 'verified'
    and exists (
      select 1 from app.shops
      where shops.id = shop_source_links.shop_id
        and shops.publication_status = 'published'
    )
  );

create policy sources_public_read on app.sources
  for select to anon, authenticated
  using (
    verified_at is not null
    and exists (
      select 1 from app.shop_source_links
      where shop_source_links.source_id = sources.id
        and shop_source_links.is_public
        and shop_source_links.verification_status = 'verified'
    )
  );

create policy contents_public_read on app.contents
  for select to anon, authenticated
  using (
    publication_status = 'published'
    and source_type <> 'unknown'
    and (
      (
        shop_id is not null
        and exists (
          select 1 from app.shops
          where shops.id = contents.shop_id
            and shops.publication_status = 'published'
        )
      )
      or (
        area_id is not null
        and exists (
          select 1 from app.areas
          where areas.id = contents.area_id
            and areas.is_published
        )
      )
      or route_key is not null
    )
  );

create policy reviews_public_read on app.reviews
  for select to anon, authenticated
  using (
    is_public
    and source_type = 'user-review'
    and moderation_status = 'approved'
    and publication_status = 'published'
    and not is_ai_generated
    and not is_promotion
    and exists (
      select 1 from app.shops
      where shops.id = reviews.shop_id
        and shops.publication_status = 'published'
    )
  );

create view api.published_areas
with (security_invoker = true)
as
select id, wp_term_id, slug, name, parent_id, description, published_at, updated_at
from app.areas
where is_published;

create view api.published_shops
with (security_invoker = true)
as
select
  id,
  wp_post_id,
  slug,
  canonical_path,
  name,
  description_html,
  excerpt,
  official_url,
  phone,
  address_text,
  access_text,
  booking_url,
  published_at,
  updated_at
from app.shops
where publication_status = 'published';

create view api.published_shop_areas
with (security_invoker = true)
as
select shop_id, area_id, is_primary
from app.shop_areas;

create view api.published_shop_prices
with (security_invoker = true)
as
select id, shop_id, course_name, duration_minutes, amount_yen, currency, notes, verified_at, updated_at
from app.shop_prices
where is_public and verified_at is not null;

create view api.published_shop_business_hours
with (security_invoker = true)
as
select id, shop_id, day_of_week, opens_at, closes_at, is_overnight, notes, verified_at, updated_at
from app.shop_business_hours
where is_public and verified_at is not null;

create view api.published_shop_images
with (security_invoker = true)
as
select id, shop_id, wp_media_id, image_url, alt_text, image_role, sort_order, verified_at, updated_at
from app.shop_images
where is_public and verified_at is not null;

create view api.published_shop_sources
with (security_invoker = true)
as
select
  links.shop_id,
  links.field_name,
  sources.source_url,
  sources.source_kind,
  sources.title,
  sources.fetched_at,
  sources.verified_at
from app.shop_source_links as links
join app.sources as sources on sources.id = links.source_id
where links.is_public
  and links.verification_status = 'verified'
  and sources.verified_at is not null;

create view api.published_contents
with (security_invoker = true)
as
select
  id,
  shop_id,
  area_id,
  route_key,
  content_type,
  source_type,
  title,
  body_html,
  body_text,
  is_ai_generated,
  is_promotion,
  published_at,
  updated_at
from app.contents
where publication_status = 'published'
  and source_type <> 'unknown';

create view api.published_reviews
with (security_invoker = true)
as
select id, shop_id, body, rating, author_name, submitted_at, published_at, updated_at
from (
  select
    reviews.*,
    approved_at as published_at
  from app.reviews
) as reviews
where is_public
  and source_type = 'user-review'
  and moderation_status = 'approved'
  and publication_status = 'published'
  and not is_ai_generated
  and not is_promotion;

revoke all on all tables in schema app from public;
revoke all on all tables in schema private from public;
revoke all on all tables in schema api from public;

grant usage on schema app, api to anon, authenticated;
grant select on app.areas to anon, authenticated;
grant select on app.shops to anon, authenticated;
grant select on app.shop_areas to anon, authenticated;
grant select on app.shop_prices to anon, authenticated;
grant select on app.shop_business_hours to anon, authenticated;
grant select on app.shop_images to anon, authenticated;
grant select on app.sources to anon, authenticated;
grant select on app.shop_source_links to anon, authenticated;
grant select on app.contents to anon, authenticated;
grant select on app.reviews to anon, authenticated;
grant select on all tables in schema api to anon, authenticated;

grant usage on schema app, private, api to service_role;
grant all privileges on all tables in schema app to service_role;
grant all privileges on all tables in schema private to service_role;
grant all privileges on all tables in schema api to service_role;

alter default privileges in schema app revoke all on tables from public;
alter default privileges in schema private revoke all on tables from public;
alter default privileges in schema api revoke all on tables from public;
