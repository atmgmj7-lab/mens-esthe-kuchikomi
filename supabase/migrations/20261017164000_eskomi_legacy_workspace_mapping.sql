-- Explicit, reviewable bridge from a legacy WP workspace to the canonical
-- app_shop_id identity. It never matches by name and never runs automatically.

create table private.partner_workspace_legacy_aliases_v11 (
  workspace_id uuid primary key references private.partner_workspaces(id) on delete restrict,
  legacy_wp_shop_id bigint not null unique check (legacy_wp_shop_id > 0),
  legacy_shop_slug text not null check (char_length(btrim(legacy_shop_slug)) between 1 and 200),
  legacy_canonical_url text not null check (legacy_canonical_url ~ '^https?://'),
  mapped_at timestamptz not null default now(),
  mapped_by text not null check (char_length(btrim(mapped_by)) between 1 and 120)
);
alter table private.partner_workspace_legacy_aliases_v11 enable row level security;
revoke all on table private.partner_workspace_legacy_aliases_v11 from public,anon,authenticated;
grant select,insert on table private.partner_workspace_legacy_aliases_v11 to service_role;

create or replace function private.list_legacy_partner_workspace_mapping_candidates_v11()
returns table (
  workspace_id uuid,legacy_wp_shop_id bigint,legacy_shop_slug text,legacy_canonical_url text,
  managed_shop_id uuid,app_shop_id uuid,app_shop_slug text,app_canonical_path text,mapping_status text
)
language sql security invoker set search_path=private,app,pg_temp as $$
  select workspace.id,workspace.wp_shop_id,workspace.shop_slug,workspace.canonical_url,
    managed.id,managed.app_shop_id,shop.slug,shop.canonical_path,
    case
      when workspace.app_shop_id is not null then 'already_canonical'
      when managed.id is null then 'no_exact_managed_shop'
      when managed.app_shop_id is null then 'managed_shop_unbound'
      when shop.id is null then 'app_shop_missing'
      when managed.shop_slug<>workspace.shop_slug or managed.existing_shop_slug<>workspace.shop_slug then 'slug_mismatch'
      when shop.slug<>workspace.shop_slug then 'app_slug_mismatch'
      when shop.canonical_path<>('/shops/'||workspace.shop_slug||'/') then 'canonical_path_mismatch'
      else 'ready'
    end
  from private.partner_workspaces workspace
  left join private.managed_shops managed on managed.existing_wp_shop_id=workspace.wp_shop_id
  left join app.shops shop on shop.id=managed.app_shop_id
  where workspace.wp_shop_id is not null
  order by workspace.created_at
$$;

create or replace function private.bind_legacy_managed_shop_to_app_shop_v11(
  p_managed_shop_id uuid,p_app_shop_id uuid,p_actor_label text
) returns text
language plpgsql security invoker set search_path=private,app,pg_temp as $$
declare managed private.managed_shops%rowtype; shop app.shops%rowtype;
begin
  if char_length(btrim(coalesce(p_actor_label,''))) not between 1 and 120 then raise exception 'mapping actor is required' using errcode='22023'; end if;
  select * into managed from private.managed_shops where id=p_managed_shop_id for update;
  select * into shop from app.shops where id=p_app_shop_id for key share;
  if managed.id is null or shop.id is null then raise exception 'mapping target not found' using errcode='P0002'; end if;
  if managed.existing_wp_shop_id is null or managed.app_shop_id is not null
    or managed.existing_shop_slug<>managed.shop_slug or managed.shop_slug<>shop.slug
    or shop.canonical_path<>('/shops/'||managed.shop_slug||'/') then
    raise exception 'legacy managed shop mapping is not an exact identity match' using errcode='23514';
  end if;
  if exists(select 1 from private.managed_shops other where other.app_shop_id=p_app_shop_id and other.id<>managed.id) then
    raise exception 'app shop is already mapped' using errcode='23505';
  end if;
  update private.managed_shops set app_shop_id=p_app_shop_id,updated_at=now() where id=managed.id;
  if managed.publication_state='published' then perform private.sync_canonical_managed_shop_publication_v11(managed.id); end if;
  return 'bound';
end $$;

create or replace function private.map_legacy_partner_workspace_to_canonical_v11(
  p_workspace_id uuid,p_managed_shop_id uuid,p_app_shop_id uuid,p_actor_label text
) returns text
language plpgsql security invoker set search_path=private,app,pg_temp as $$
declare workspace private.partner_workspaces%rowtype; candidate record;
begin
  if char_length(btrim(coalesce(p_actor_label,''))) not between 1 and 120 then raise exception 'mapping actor is required' using errcode='22023'; end if;
  select * into workspace from private.partner_workspaces where id=p_workspace_id for update;
  if workspace.id is null then raise exception 'partner workspace not found' using errcode='P0002'; end if;
  select * into candidate from private.list_legacy_partner_workspace_mapping_candidates_v11() where workspace_id=p_workspace_id;
  if candidate.mapping_status<>'ready' or candidate.managed_shop_id<>p_managed_shop_id or candidate.app_shop_id<>p_app_shop_id then
    raise exception 'legacy workspace mapping is not an exact approved candidate' using errcode='23514';
  end if;
  insert into private.partner_workspace_legacy_aliases_v11(workspace_id,legacy_wp_shop_id,legacy_shop_slug,legacy_canonical_url,mapped_by)
  values(workspace.id,workspace.wp_shop_id,workspace.shop_slug,workspace.canonical_url,btrim(p_actor_label));
  update private.partner_workspaces set app_shop_id=p_app_shop_id,wp_shop_id=null,updated_at=now() where id=workspace.id;
  return 'mapped';
end $$;

create or replace function api.list_legacy_partner_workspace_mapping_candidates_v11()
returns table (workspace_id uuid,legacy_wp_shop_id bigint,legacy_shop_slug text,legacy_canonical_url text,managed_shop_id uuid,app_shop_id uuid,app_shop_slug text,app_canonical_path text,mapping_status text)
language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.list_legacy_partner_workspace_mapping_candidates_v11() $$;
create or replace function api.bind_legacy_managed_shop_to_app_shop_v11(p_managed_shop_id uuid,p_app_shop_id uuid,p_actor_label text)
returns text language sql security invoker set search_path=private,api,pg_temp as $$ select private.bind_legacy_managed_shop_to_app_shop_v11(p_managed_shop_id,p_app_shop_id,p_actor_label) $$;
create or replace function api.map_legacy_partner_workspace_to_canonical_v11(p_workspace_id uuid,p_managed_shop_id uuid,p_app_shop_id uuid,p_actor_label text)
returns text language sql security invoker set search_path=private,api,pg_temp as $$ select private.map_legacy_partner_workspace_to_canonical_v11(p_workspace_id,p_managed_shop_id,p_app_shop_id,p_actor_label) $$;
revoke all on function private.list_legacy_partner_workspace_mapping_candidates_v11(),private.bind_legacy_managed_shop_to_app_shop_v11(uuid,uuid,text),private.map_legacy_partner_workspace_to_canonical_v11(uuid,uuid,uuid,text),api.list_legacy_partner_workspace_mapping_candidates_v11(),api.bind_legacy_managed_shop_to_app_shop_v11(uuid,uuid,text),api.map_legacy_partner_workspace_to_canonical_v11(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function private.list_legacy_partner_workspace_mapping_candidates_v11(),private.bind_legacy_managed_shop_to_app_shop_v11(uuid,uuid,text),private.map_legacy_partner_workspace_to_canonical_v11(uuid,uuid,uuid,text),api.list_legacy_partner_workspace_mapping_candidates_v11(),api.bind_legacy_managed_shop_to_app_shop_v11(uuid,uuid,text),api.map_legacy_partner_workspace_to_canonical_v11(uuid,uuid,uuid,text) to service_role;
notify pgrst,'reload schema';
