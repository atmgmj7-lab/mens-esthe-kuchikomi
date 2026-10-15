-- Private listing-application schema. Production application is gated by release review.
create type private.listing_application_kind as enum ('new_listing', 'existing_change');
create type private.listing_edit_preference as enum ('operator', 'shop');
create type private.listing_application_state as enum ('received', 'identity_review', 'content_review', 'changes_requested', 'approved_candidate', 'rejected');

create table private.listing_applications (
  id uuid primary key default gen_random_uuid(),
  idempotency_key uuid not null unique,
  kind private.listing_application_kind not null,
  existing_wp_shop_id bigint,
  existing_shop_slug text,
  shop_name text not null check (char_length(shop_name) between 1 and 120),
  area text not null check (char_length(area) between 1 and 120),
  website_url text not null check (website_url ~ '^https?://'),
  introduction text check (introduction is null or char_length(introduction) <= 5000),
  banner_asset_id uuid,
  contact_name text not null check (char_length(contact_name) between 1 and 80),
  contact_email text not null check (char_length(contact_email) between 3 and 254),
  contact_role text not null check (contact_role in ('owner','manager','staff','authorized-agency')),
  edit_preference private.listing_edit_preference not null,
  consent_privacy boolean not null check (consent_privacy),
  consent_accuracy boolean not null check (consent_accuracy),
  consent_image_rights boolean not null check (consent_image_rights),
  state private.listing_application_state not null default 'received',
  revision integer not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((kind = 'new_listing' and existing_wp_shop_id is null and existing_shop_slug is null) or (kind = 'existing_change' and existing_wp_shop_id is not null and existing_shop_slug is not null))
);

create table private.listing_application_assets (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references private.listing_applications(id) on delete restrict,
  object_key text not null unique check (object_key ~ '^listing-applications/[0-9a-f-]+/[0-9a-f-]+\\.(png|jpe?g|webp)$'),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  content_type text not null check (content_type in ('image/png','image/jpeg','image/webp')),
  byte_size integer not null check (byte_size between 1 and 5242880),
  width integer not null check (width between 1 and 8000),
  height integer not null check (height between 1 and 8000),
  created_at timestamptz not null default now()
);
alter table private.listing_applications add constraint listing_applications_banner_asset_fk foreign key (banner_asset_id) references private.listing_application_assets(id) on delete restrict;

alter table private.listing_applications enable row level security;
alter table private.listing_application_assets enable row level security;
revoke all on table private.listing_applications, private.listing_application_assets from public, anon, authenticated;
grant select, insert, update on table private.listing_applications, private.listing_application_assets to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('listing-application-private', 'listing-application-private', false, 5242880, array['image/png','image/jpeg','image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
-- Storage object RLS already denies browser roles without a bucket-specific policy.
-- Do not alter global storage.objects grants: other buckets may rely on them.
