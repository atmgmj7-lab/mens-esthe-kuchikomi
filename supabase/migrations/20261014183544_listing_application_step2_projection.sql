create table private.listing_application_revisions (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references private.listing_applications(id) on delete restrict,
  revision integer not null check (revision > 0),
  public_payload jsonb not null,
  private_payload jsonb not null,
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  unique (application_id, revision)
);
create table private.listing_application_reviews (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references private.listing_applications(id) on delete restrict,
  expected_revision integer not null,
  decision text not null check (decision in ('approved','changes_requested','rejected')),
  reviewer_label text not null check (char_length(reviewer_label) between 1 and 120),
  note text check (note is null or char_length(note) <= 5000),
  created_at timestamptz not null default now()
);
create table private.listing_public_projections (
  application_id uuid primary key references private.listing_applications(id) on delete restrict,
  approved_revision integer not null,
  shop_name text not null,
  area text not null,
  website_url text not null,
  introduction text,
  banner_asset_id uuid references private.listing_application_assets(id) on delete restrict,
  published_at timestamptz not null default now()
);
alter table private.listing_application_revisions enable row level security;
alter table private.listing_application_reviews enable row level security;
alter table private.listing_public_projections enable row level security;
revoke all on table private.listing_application_revisions, private.listing_application_reviews, private.listing_public_projections from public, anon, authenticated;
grant select, insert, update on table private.listing_application_revisions, private.listing_application_reviews, private.listing_public_projections to service_role;

create or replace function private.review_listing_application(p_application_id uuid, p_expected_revision integer, p_decision text, p_reviewer_label text, p_note text default null)
returns text language plpgsql security definer set search_path = private, pg_temp as $$
declare v private.listing_applications%rowtype; begin
  select * into v from private.listing_applications where id = p_application_id for update;
  if not found or v.revision <> p_expected_revision then return 'conflict'; end if;
  if p_decision not in ('approved','changes_requested','rejected') then raise exception 'invalid decision' using errcode='22023'; end if;
  insert into private.listing_application_reviews(application_id,expected_revision,decision,reviewer_label,note) values(p_application_id,p_expected_revision,p_decision,p_reviewer_label,p_note);
  update private.listing_applications set state = case p_decision when 'approved' then 'approved_candidate'::private.listing_application_state when 'changes_requested' then 'changes_requested'::private.listing_application_state else 'rejected'::private.listing_application_state end, updated_at=now() where id=p_application_id;
  if p_decision = 'approved' then
    insert into private.listing_public_projections(application_id,approved_revision,shop_name,area,website_url,introduction,banner_asset_id)
    values(v.id,v.revision,v.shop_name,v.area,v.website_url,v.introduction,v.banner_asset_id)
    on conflict(application_id) do update set approved_revision=excluded.approved_revision,shop_name=excluded.shop_name,area=excluded.area,website_url=excluded.website_url,introduction=excluded.introduction,banner_asset_id=excluded.banner_asset_id,published_at=now();
  end if; return 'ok'; end;
$$;
revoke all on function private.review_listing_application(uuid,integer,text,text,text) from public, anon, authenticated;
grant execute on function private.review_listing_application(uuid,integer,text,text,text) to service_role;
