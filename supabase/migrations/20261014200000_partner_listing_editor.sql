-- Local-only stable listing/editor workflow. It adds a store identity that is
-- intentionally independent from a listing application id and a legacy WP id.
create type private.listing_store_revision_state as enum (
  'draft', 'submitted', 'changes_requested', 'approved'
);

create table private.listing_stores (
  id uuid primary key default gen_random_uuid(),
  shop_slug text not null unique check (shop_slug ~ '^[^/[:space:]]{1,200}$'),
  canonical_url text generated always as ('https://mens-esthe-kuchikomi.com/shops/' || shop_slug || '/') stored,
  workspace_id uuid unique references private.partner_workspaces(id) on delete restrict,
  existing_wp_shop_id bigint unique check (existing_wp_shop_id is null or existing_wp_shop_id > 0),
  origin_application_id uuid unique references private.listing_applications(id) on delete restrict,
  current_revision integer not null default 0 check (current_revision >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table private.listing_store_revisions (
  id uuid primary key default gen_random_uuid(),
  listing_store_id uuid not null references private.listing_stores(id) on delete restrict,
  revision integer not null check (revision > 0),
  state private.listing_store_revision_state not null,
  shop_name text not null check (char_length(shop_name) between 1 and 120),
  area text not null check (char_length(area) between 1 and 120),
  website_url text not null check (website_url ~ '^https?://'),
  introduction text check (introduction is null or char_length(introduction) <= 5000),
  banner_asset_id uuid references private.listing_application_assets(id) on delete restrict,
  created_at timestamptz not null default now(),
  submitted_at timestamptz,
  unique (listing_store_id, revision),
  check ((state = 'submitted' and submitted_at is not null) or (state <> 'submitted'))
);

create table private.listing_store_reviews (
  id uuid primary key default gen_random_uuid(),
  listing_store_id uuid not null references private.listing_stores(id) on delete restrict,
  revision integer not null check (revision > 0),
  decision text not null check (decision in ('approved', 'changes_requested')),
  reviewer_label text not null check (char_length(reviewer_label) between 1 and 120),
  note text check (note is null or char_length(note) <= 5000),
  created_at timestamptz not null default now(),
  foreign key (listing_store_id, revision) references private.listing_store_revisions(listing_store_id, revision) on delete restrict
);

create table private.listing_store_publications (
  listing_store_id uuid primary key references private.listing_stores(id) on delete restrict,
  approved_revision integer not null check (approved_revision > 0),
  shop_slug text not null unique check (shop_slug ~ '^[^/[:space:]]{1,200}$'),
  shop_name text not null,
  area text not null,
  website_url text not null,
  introduction text,
  banner_asset_id uuid references private.listing_application_assets(id) on delete restrict,
  published_at timestamptz not null default now(),
  foreign key (listing_store_id, approved_revision) references private.listing_store_revisions(listing_store_id, revision) on delete restrict
);

alter table private.listing_applications add column listing_store_id uuid references private.listing_stores(id) on delete restrict;
create unique index listing_applications_listing_store_id_unique on private.listing_applications(listing_store_id) where listing_store_id is not null;

alter table private.listing_stores enable row level security;
alter table private.listing_store_revisions enable row level security;
alter table private.listing_store_reviews enable row level security;
alter table private.listing_store_publications enable row level security;
revoke all on table private.listing_stores, private.listing_store_revisions, private.listing_store_reviews, private.listing_store_publications from public, anon, authenticated;
grant select, insert, update on table private.listing_stores, private.listing_store_revisions, private.listing_store_reviews, private.listing_store_publications to service_role;

create or replace function private.create_listing_store(
  p_shop_slug text, p_shop_name text, p_area text, p_website_url text,
  p_workspace_id uuid default null, p_existing_wp_shop_id bigint default null
) returns uuid language plpgsql security definer set search_path=private,pg_temp as $$
declare v_store uuid; v_workspace private.partner_workspaces%rowtype;
begin
  if p_shop_slug !~ '^[^/[:space:]]{1,200}$' or char_length(p_shop_name) not between 1 and 120
    or char_length(p_area) not between 1 and 120 or p_website_url !~ '^https?://' then
    raise exception 'invalid listing store' using errcode='22023';
  end if;
  if p_workspace_id is not null then
    select * into v_workspace from private.partner_workspaces where id=p_workspace_id for key share;
    if not found or v_workspace.shop_slug <> p_shop_slug then
      raise exception 'workspace cannot be bound to this listing' using errcode='42501';
    end if;
  end if;
  insert into private.listing_stores(shop_slug,workspace_id,existing_wp_shop_id)
  values(p_shop_slug,p_workspace_id,p_existing_wp_shop_id)
  returning id into v_store;
  insert into private.listing_store_revisions(listing_store_id,revision,state,shop_name,area,website_url,introduction)
  values(v_store,1,'draft',p_shop_name,p_area,p_website_url,null);
  update private.listing_stores set current_revision=1,updated_at=now() where id=v_store;
  return v_store;
end;
$$;

create or replace function private.ensure_listing_store_for_application(p_application_id uuid)
returns uuid language plpgsql security definer set search_path=private,pg_temp as $$
declare v private.listing_applications%rowtype; v_store uuid; v_slug text;
begin
  select * into v from private.listing_applications where id=p_application_id for update;
  if not found then raise exception 'application unavailable' using errcode='23514'; end if;
  if v.listing_store_id is not null then return v.listing_store_id; end if;
  if v.kind = 'existing_change' then
    select id into v_store from private.listing_stores where existing_wp_shop_id=v.existing_wp_shop_id for update;
    if v_store is null then
      insert into private.listing_stores(shop_slug,existing_wp_shop_id) values(v.existing_shop_slug,v.existing_wp_shop_id) returning id into v_store;
      insert into private.listing_store_revisions(listing_store_id,revision,state,shop_name,area,website_url,introduction,banner_asset_id)
      values(v_store,1,'approved',v.shop_name,v.area,v.website_url,v.introduction,v.banner_asset_id);
      update private.listing_stores set current_revision=1,updated_at=now() where id=v_store;
      insert into private.listing_store_publications(listing_store_id,approved_revision,shop_slug,shop_name,area,website_url,introduction,banner_asset_id)
      values(v_store,1,v.existing_shop_slug,v.shop_name,v.area,v.website_url,v.introduction,v.banner_asset_id);
    end if;
  else
    v_slug := 'listing-' || replace(v.id::text,'-','');
    insert into private.listing_stores(shop_slug,origin_application_id) values(v_slug,v.id) returning id into v_store;
    insert into private.listing_store_revisions(listing_store_id,revision,state,shop_name,area,website_url,introduction,banner_asset_id)
    values(v_store,1,'approved',v.shop_name,v.area,v.website_url,v.introduction,v.banner_asset_id);
    update private.listing_stores set current_revision=1,updated_at=now() where id=v_store;
    insert into private.listing_store_publications(listing_store_id,approved_revision,shop_slug,shop_name,area,website_url,introduction,banner_asset_id)
    values(v_store,1,v_slug,v.shop_name,v.area,v.website_url,v.introduction,v.banner_asset_id);
  end if;
  update private.listing_applications set listing_store_id=v_store,updated_at=now() where id=v.id;
  return v_store;
end;
$$;

create or replace function private.save_partner_listing_draft(
  p_workspace_id uuid, p_expected_revision integer, p_payload jsonb
) returns text language plpgsql security definer set search_path=private,pg_temp as $$
declare v_store private.listing_stores%rowtype; v_previous private.listing_store_revisions%rowtype;
declare v_name text; v_area text; v_url text; v_intro text; v_banner uuid;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then raise exception 'invalid listing draft' using errcode='22023'; end if;
  select * into v_store from private.listing_stores where workspace_id=p_workspace_id for update;
  if not found then return 'forbidden'; end if;
  if v_store.current_revision <> p_expected_revision then return 'conflict'; end if;
  select * into v_previous from private.listing_store_revisions where listing_store_id=v_store.id and revision=v_store.current_revision;
  if v_previous.state not in ('draft','changes_requested') then return 'conflict'; end if;
  v_name := nullif(trim(p_payload->>'shop_name'),''); v_area := nullif(trim(p_payload->>'area'),''); v_url := nullif(trim(p_payload->>'website_url'),'');
  v_intro := nullif(trim(coalesce(p_payload->>'introduction','')),'');
  if char_length(v_name) not between 1 and 120 or char_length(v_area) not between 1 and 120 or v_url !~ '^https?://' or char_length(v_intro) > 5000 then
    raise exception 'invalid listing draft' using errcode='22023';
  end if;
  begin v_banner := nullif(p_payload->>'banner_asset_id','')::uuid; exception when invalid_text_representation then raise exception 'invalid banner asset' using errcode='22023'; end;
  insert into private.listing_store_revisions(listing_store_id,revision,state,shop_name,area,website_url,introduction,banner_asset_id)
  values(v_store.id,v_store.current_revision+1,'draft',v_name,v_area,v_url,v_intro,v_banner);
  update private.listing_stores set current_revision=current_revision+1,updated_at=now() where id=v_store.id;
  return 'ok';
end;
$$;

create or replace function private.submit_partner_listing_change(p_workspace_id uuid, p_expected_revision integer)
returns text language plpgsql security definer set search_path=private,pg_temp as $$
declare v_store private.listing_stores%rowtype;
begin
  select * into v_store from private.listing_stores where workspace_id=p_workspace_id for update;
  if not found then return 'forbidden'; end if;
  if v_store.current_revision <> p_expected_revision then return 'conflict'; end if;
  update private.listing_store_revisions set state='submitted',submitted_at=now()
  where listing_store_id=v_store.id and revision=v_store.current_revision and state='draft';
  if not found then return 'conflict'; end if;
  update private.listing_stores set updated_at=now() where id=v_store.id;
  return 'ok';
end;
$$;

create or replace function private.review_partner_listing_change(
  p_listing_store_id uuid, p_expected_revision integer, p_decision text, p_reviewer_label text, p_note text default null
) returns text language plpgsql security definer set search_path=private,pg_temp as $$
declare v_store private.listing_stores%rowtype; v_revision private.listing_store_revisions%rowtype;
begin
  if p_decision not in ('approved','changes_requested') or char_length(trim(p_reviewer_label)) not between 1 and 120 or char_length(p_note) > 5000 then
    raise exception 'invalid listing review' using errcode='22023';
  end if;
  select * into v_store from private.listing_stores where id=p_listing_store_id for update;
  if not found or v_store.current_revision <> p_expected_revision then return 'conflict'; end if;
  select * into v_revision from private.listing_store_revisions
  where listing_store_id=v_store.id and revision=v_store.current_revision and state='submitted' for update;
  if not found then return 'conflict'; end if;
  update private.listing_store_revisions set state=p_decision::private.listing_store_revision_state where id=v_revision.id;
  insert into private.listing_store_reviews(listing_store_id,revision,decision,reviewer_label,note)
  values(v_store.id,v_revision.revision,p_decision,p_reviewer_label,nullif(trim(p_note),''));
  if p_decision='approved' then
    insert into private.listing_store_publications(listing_store_id,approved_revision,shop_slug,shop_name,area,website_url,introduction,banner_asset_id)
    values(v_store.id,v_revision.revision,v_store.shop_slug,v_revision.shop_name,v_revision.area,v_revision.website_url,v_revision.introduction,v_revision.banner_asset_id)
    on conflict(listing_store_id) do update set approved_revision=excluded.approved_revision,shop_slug=excluded.shop_slug,shop_name=excluded.shop_name,area=excluded.area,website_url=excluded.website_url,introduction=excluded.introduction,banner_asset_id=excluded.banner_asset_id,published_at=now();
  end if;
  update private.listing_stores set updated_at=now() where id=v_store.id;
  return 'ok';
end;
$$;

create or replace function private.review_listing_application(p_application_id uuid, p_expected_revision integer, p_decision text, p_reviewer_label text, p_note text default null)
returns text language plpgsql security definer set search_path = private, pg_temp as $$
declare v private.listing_applications%rowtype;
begin
  select * into v from private.listing_applications where id = p_application_id for update;
  if not found or v.revision <> p_expected_revision then return 'conflict'; end if;
  if p_decision not in ('approved','changes_requested','rejected') then raise exception 'invalid decision' using errcode='22023'; end if;
  insert into private.listing_application_reviews(application_id,expected_revision,decision,reviewer_label,note)
  values(p_application_id,p_expected_revision,p_decision,p_reviewer_label,p_note);
  update private.listing_applications set state = case p_decision when 'approved' then 'approved_candidate'::private.listing_application_state when 'changes_requested' then 'changes_requested'::private.listing_application_state else 'rejected'::private.listing_application_state end, updated_at=now() where id=p_application_id;
  if p_decision = 'approved' then
    insert into private.listing_public_projections(application_id,approved_revision,shop_name,area,website_url,introduction,banner_asset_id)
    values(v.id,v.revision,v.shop_name,v.area,v.website_url,v.introduction,v.banner_asset_id)
    on conflict(application_id) do update set approved_revision=excluded.approved_revision,shop_name=excluded.shop_name,area=excluded.area,website_url=excluded.website_url,introduction=excluded.introduction,banner_asset_id=excluded.banner_asset_id,published_at=now();
    perform private.ensure_listing_store_for_application(v.id);
  end if;
  return 'ok';
end;
$$;

create or replace function api.get_partner_listing_editor(p_workspace_id uuid)
returns jsonb language sql security definer set search_path=private,pg_temp as $$
  select jsonb_build_object(
    'store_id',s.id,'shop_slug',s.shop_slug,'canonical_url',s.canonical_url,'current_revision',s.current_revision,
    'revision',jsonb_build_object('state',r.state,'shop_name',r.shop_name,'area',r.area,'website_url',r.website_url,'introduction',r.introduction,'banner_asset_id',r.banner_asset_id),
    'latest_review',coalesce((select jsonb_build_object('decision',q.decision,'note',q.note,'created_at',q.created_at) from private.listing_store_reviews q where q.listing_store_id=s.id order by q.created_at desc limit 1),'null'::jsonb)
  )
  from private.listing_stores s
  join private.listing_store_revisions r on r.listing_store_id=s.id and r.revision=s.current_revision
  where s.workspace_id=p_workspace_id
$$;

create or replace function api.get_public_listing_store_by_slug(p_shop_slug text)
returns table(shop_slug text, canonical_url text, shop_name text, area text, website_url text, introduction text, banner_asset_id uuid, approved_revision integer, published_at timestamptz)
language sql security definer set search_path=private,pg_temp as $$
  select p.shop_slug,s.canonical_url,p.shop_name,p.area,p.website_url,p.introduction,p.banner_asset_id,p.approved_revision,p.published_at
  from private.listing_store_publications p join private.listing_stores s on s.id=p.listing_store_id
  where p.shop_slug=p_shop_slug limit 1
$$;

create or replace function api.save_partner_listing_draft(p_workspace_id uuid,p_expected_revision integer,p_payload jsonb)
returns text language sql security invoker set search_path=private,pg_temp as $$ select private.save_partner_listing_draft(p_workspace_id,p_expected_revision,p_payload) $$;
create or replace function api.submit_partner_listing_change(p_workspace_id uuid,p_expected_revision integer)
returns text language sql security invoker set search_path=private,pg_temp as $$ select private.submit_partner_listing_change(p_workspace_id,p_expected_revision) $$;
create or replace function api.review_partner_listing_change(p_listing_store_id uuid,p_expected_revision integer,p_decision text,p_reviewer_label text,p_note text default null)
returns text language sql security invoker set search_path=private,pg_temp as $$ select private.review_partner_listing_change(p_listing_store_id,p_expected_revision,p_decision,p_reviewer_label,p_note) $$;

revoke all on function private.create_listing_store(text,text,text,text,uuid,bigint) from public,anon,authenticated;
revoke all on function private.ensure_listing_store_for_application(uuid) from public,anon,authenticated;
revoke all on function private.save_partner_listing_draft(uuid,integer,jsonb) from public,anon,authenticated;
revoke all on function private.submit_partner_listing_change(uuid,integer) from public,anon,authenticated;
revoke all on function private.review_partner_listing_change(uuid,integer,text,text,text) from public,anon,authenticated;
revoke all on function api.get_partner_listing_editor(uuid) from public,anon,authenticated;
revoke all on function api.get_public_listing_store_by_slug(text) from public;
revoke all on function api.save_partner_listing_draft(uuid,integer,jsonb) from public,anon,authenticated;
revoke all on function api.submit_partner_listing_change(uuid,integer) from public,anon,authenticated;
revoke all on function api.review_partner_listing_change(uuid,integer,text,text,text) from public,anon,authenticated;
grant execute on function private.create_listing_store(text,text,text,text,uuid,bigint) to service_role;
grant execute on function private.ensure_listing_store_for_application(uuid) to service_role;
grant execute on function private.save_partner_listing_draft(uuid,integer,jsonb) to service_role;
grant execute on function private.submit_partner_listing_change(uuid,integer) to service_role;
grant execute on function private.review_partner_listing_change(uuid,integer,text,text,text) to service_role;
grant execute on function api.get_partner_listing_editor(uuid) to service_role;
grant execute on function api.get_public_listing_store_by_slug(text) to anon,authenticated,service_role;
grant execute on function api.save_partner_listing_draft(uuid,integer,jsonb) to service_role;
grant execute on function api.submit_partner_listing_change(uuid,integer) to service_role;
grant execute on function api.review_partner_listing_change(uuid,integer,text,text,text) to service_role;
