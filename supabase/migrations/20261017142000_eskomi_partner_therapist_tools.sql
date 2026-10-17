-- Store-scoped therapist registration, reusable review links, and request
-- previews.  These are service-role transport functions: the Next routes
-- derive workspace_id from the existing Partner session and never accept it
-- from the browser.

alter table app.therapist_assignments
  add column if not exists revision integer not null default 1 check (revision > 0);

create table private.therapist_assets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references private.partner_workspaces(id) on delete restrict,
  object_key text not null unique check (object_key ~ '^therapists/[0-9a-f-]+/[0-9a-f-]+\.(png|jpe?g|webp)$'),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  content_type text not null check (content_type in ('image/png', 'image/jpeg', 'image/webp')),
  byte_size integer not null check (byte_size > 0 and byte_size <= 5242880),
  width integer not null check (width > 0 and width <= 4096),
  height integer not null check (height > 0 and height <= 4096),
  created_at timestamptz not null default now()
);

create table private.partner_therapist_photo_uploads (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references private.partner_workspaces(id) on delete restrict,
  object_key text unique,
  state text not null default 'issued' check (state in ('issued', 'reserved', 'consumed')),
  created_at timestamptz not null default now()
);

create table private.therapist_assignment_rights (
  assignment_id uuid primary key references app.therapist_assignments(id) on delete restrict,
  workspace_id uuid not null references private.partner_workspaces(id) on delete restrict,
  permission_policy_version text not null check (char_length(btrim(permission_policy_version)) between 1 and 120),
  permission_confirmed_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table private.partner_review_entry_link_bindings (
  link_id uuid primary key references private.review_entry_links(id) on delete restrict,
  workspace_id uuid not null references private.partner_workspaces(id) on delete restrict,
  therapist_assignment_id uuid references app.therapist_assignments(id) on delete restrict,
  channel text not null check (channel in ('line', 'email')),
  created_at timestamptz not null default now()
);
create unique index partner_review_entry_link_binding_assignment_channel_key
  on private.partner_review_entry_link_bindings(workspace_id, therapist_assignment_id, channel)
  where therapist_assignment_id is not null;
create unique index partner_review_entry_link_binding_shop_channel_key
  on private.partner_review_entry_link_bindings(workspace_id, channel)
  where therapist_assignment_id is null;

alter table private.therapist_assets enable row level security;
alter table private.partner_therapist_photo_uploads enable row level security;
alter table private.therapist_assignment_rights enable row level security;
alter table private.partner_review_entry_link_bindings enable row level security;
revoke all on table private.therapist_assets, private.partner_therapist_photo_uploads,
  private.therapist_assignment_rights, private.partner_review_entry_link_bindings
  from public, anon, authenticated;
grant select, insert, update on table private.therapist_assets, private.partner_therapist_photo_uploads,
  private.therapist_assignment_rights, private.partner_review_entry_link_bindings to service_role;

create or replace function private.partner_workspace_app_shop(p_workspace_id uuid)
returns uuid language plpgsql security definer set search_path=private,pg_temp as $$
declare v_shop uuid;
begin
  select app_shop_id into v_shop from private.partner_workspaces
  where id=p_workspace_id and state in ('free_official_partner','active_partner') and app_shop_id is not null;
  if v_shop is null then raise exception 'partner workspace is unavailable' using errcode='42501'; end if;
  return v_shop;
end $$;

-- This is deliberately separate from the legacy WordPress-shaped dashboard
-- membership projection.  Canonical-only workspaces have no wp_shop_id, but
-- must still be able to use the existing Partner login to administer their
-- own therapist records.
create or replace function private.get_partner_therapist_workspace_scope(p_auth_user_id uuid)
returns table(workspace_id uuid, app_shop_id uuid, role text)
language sql security invoker set search_path=private,pg_temp as $$
  select workspace.id, workspace.app_shop_id, membership.role::text
  from private.partner_memberships membership
  join private.partner_workspaces workspace on workspace.id=membership.workspace_id
  where membership.auth_user_id=p_auth_user_id
    and membership.status='active'
    and workspace.state in ('free_official_partner','active_partner')
    and workspace.app_shop_id is not null
$$;

create or replace function private.reserve_partner_therapist_photo_upload(p_workspace_id uuid, p_content_type text)
returns text language plpgsql security definer set search_path=private,pg_temp as $$
declare v_upload uuid; v_extension text; v_key text;
begin
  perform private.partner_workspace_app_shop(p_workspace_id);
  v_extension := case p_content_type when 'image/png' then 'png' when 'image/jpeg' then 'jpg' when 'image/webp' then 'webp' else null end;
  if v_extension is null then raise exception 'invalid therapist photo content type' using errcode='22023'; end if;
  insert into private.partner_therapist_photo_uploads(workspace_id) values(p_workspace_id) returning id into v_upload;
  v_key := format('therapists/%s/%s.%s',p_workspace_id,v_upload,v_extension);
  update private.partner_therapist_photo_uploads set object_key=v_key,state='reserved' where id=v_upload;
  return v_key;
end $$;

create or replace function private.attach_partner_therapist_photo(
  p_workspace_id uuid,p_object_key text,p_sha256 text,p_content_type text,p_byte_size integer,p_width integer,p_height integer
) returns uuid language plpgsql security definer set search_path=private,pg_temp as $$
declare v_upload private.partner_therapist_photo_uploads%rowtype; v_asset uuid;
begin
  perform private.partner_workspace_app_shop(p_workspace_id);
  select * into v_upload from private.partner_therapist_photo_uploads
  where workspace_id=p_workspace_id and object_key=p_object_key for update;
  if not found or v_upload.state <> 'reserved' then raise exception 'therapist photo upload rejected' using errcode='42501'; end if;
  insert into private.therapist_assets(workspace_id,object_key,sha256,content_type,byte_size,width,height)
  values(p_workspace_id,p_object_key,p_sha256,p_content_type,p_byte_size,p_width,p_height) returning id into v_asset;
  update private.partner_therapist_photo_uploads set state='consumed' where id=v_upload.id;
  return v_asset;
end $$;

create or replace function private.create_partner_therapist_assignment(
  p_workspace_id uuid,p_display_name text,p_photo_asset_id uuid,p_permission_policy_version text,p_permission_confirmed boolean
) returns table(assignment_id uuid, display_name text, photo_asset_id uuid, revision integer)
language plpgsql security definer set search_path=private,app,extensions,pg_temp as $$
declare v_shop uuid; v_asset private.therapist_assets%rowtype; v_therapist uuid; v_assignment uuid; v_name text;
begin
  v_shop := private.partner_workspace_app_shop(p_workspace_id);
  v_name := btrim(coalesce(p_display_name,''));
  if char_length(v_name) not between 1 and 40 or not p_permission_confirmed
    or char_length(btrim(coalesce(p_permission_policy_version,''))) not between 1 and 120 then
    raise exception 'invalid therapist registration' using errcode='22023';
  end if;
  select * into v_asset from private.therapist_assets where id=p_photo_asset_id and workspace_id=p_workspace_id for key share;
  if not found then raise exception 'therapist photo is unavailable' using errcode='42501'; end if;
  insert into app.therapists(stable_key) values('therapist-' || encode(extensions.gen_random_bytes(16),'hex')) returning id into v_therapist;
  insert into app.therapist_assignments(therapist_id,shop_id,display_name,photo_asset_key,photo_rights_confirmed_at)
  values(v_therapist,v_shop,v_name,v_asset.object_key,now()) returning id into v_assignment;
  insert into private.therapist_assignment_rights(assignment_id,workspace_id,permission_policy_version,permission_confirmed_at)
  values(v_assignment,p_workspace_id,btrim(p_permission_policy_version),now());
  return query select v_assignment,v_name,v_asset.id,1;
end $$;

create or replace function private.list_partner_therapist_assignments(p_workspace_id uuid)
returns table(assignment_id uuid, display_name text, photo_asset_id uuid, lifecycle_state text, revision integer, permission_policy_version text)
language sql security definer set search_path=private,app,pg_temp as $$
  select assignment.id, assignment.display_name, asset.id, assignment.lifecycle_state, assignment.revision, rights.permission_policy_version
  from app.therapist_assignments assignment
  join private.therapist_assignment_rights rights on rights.assignment_id=assignment.id and rights.workspace_id=p_workspace_id
  join private.therapist_assets asset on asset.workspace_id=rights.workspace_id and asset.object_key=assignment.photo_asset_key
  where assignment.shop_id=private.partner_workspace_app_shop(p_workspace_id)
  order by assignment.created_at desc, assignment.id
$$;

create or replace function private.end_partner_therapist_assignment(p_workspace_id uuid,p_assignment_id uuid,p_expected_revision integer)
returns table(assignment_id uuid,lifecycle_state text,revision integer)
language plpgsql security definer set search_path=private,app,pg_temp as $$
declare v_assignment app.therapist_assignments%rowtype; v_shop uuid;
begin
  v_shop:=private.partner_workspace_app_shop(p_workspace_id);
  select assignment.* into v_assignment from app.therapist_assignments assignment
  join private.therapist_assignment_rights rights on rights.assignment_id=assignment.id and rights.workspace_id=p_workspace_id
  where assignment.id=p_assignment_id and assignment.shop_id=v_shop for update;
  if not found then raise exception 'therapist assignment is unavailable' using errcode='42501'; end if;
  if p_expected_revision <> v_assignment.revision then raise exception 'therapist assignment changed' using errcode='40001'; end if;
  if v_assignment.lifecycle_state <> 'active' then return query select v_assignment.id,v_assignment.lifecycle_state,v_assignment.revision; return; end if;
  update app.therapist_assignments set lifecycle_state='retired',active_until=now(),revision=app.therapist_assignments.revision+1,updated_at=now()
  where app.therapist_assignments.id=v_assignment.id
  returning app.therapist_assignments.id,app.therapist_assignments.lifecycle_state,app.therapist_assignments.revision
  into v_assignment.id,v_assignment.lifecycle_state,v_assignment.revision;
  return query select v_assignment.id,v_assignment.lifecycle_state,v_assignment.revision;
end $$;

create or replace function private.update_partner_therapist_assignment(
  p_workspace_id uuid,p_assignment_id uuid,p_expected_revision integer,p_display_name text,p_photo_asset_id uuid,p_permission_policy_version text,p_permission_confirmed boolean
) returns table(assignment_id uuid,display_name text,photo_asset_id uuid,revision integer)
language plpgsql security definer set search_path=private,app,pg_temp as $$
declare v_assignment app.therapist_assignments%rowtype; v_asset private.therapist_assets%rowtype; v_name text; v_shop uuid;
begin
  v_shop:=private.partner_workspace_app_shop(p_workspace_id);
  v_name:=btrim(coalesce(p_display_name,''));
  if char_length(v_name) not between 1 and 40 or not p_permission_confirmed
    or char_length(btrim(coalesce(p_permission_policy_version,''))) not between 1 and 120 then
    raise exception 'invalid therapist update' using errcode='22023';
  end if;
  select assignment.* into v_assignment from app.therapist_assignments assignment
  join private.therapist_assignment_rights rights on rights.assignment_id=assignment.id and rights.workspace_id=p_workspace_id
  where assignment.id=p_assignment_id and assignment.shop_id=v_shop for update;
  if not found then raise exception 'therapist assignment is unavailable' using errcode='42501'; end if;
  if v_assignment.revision <> p_expected_revision then raise exception 'therapist assignment changed' using errcode='40001'; end if;
  if v_assignment.lifecycle_state <> 'active' then raise exception 'therapist assignment is retired' using errcode='40001'; end if;
  select * into v_asset from private.therapist_assets where id=p_photo_asset_id and workspace_id=p_workspace_id for key share;
  if not found then raise exception 'therapist photo is unavailable' using errcode='42501'; end if;
  update app.therapist_assignments set display_name=v_name,photo_asset_key=v_asset.object_key,photo_rights_confirmed_at=now(),revision=app.therapist_assignments.revision+1,updated_at=now()
  where id=v_assignment.id returning * into v_assignment;
  update private.therapist_assignment_rights as rights
  set permission_policy_version=btrim(p_permission_policy_version),permission_confirmed_at=now(),updated_at=now()
  where rights.assignment_id=v_assignment.id and rights.workspace_id=p_workspace_id;
  return query select v_assignment.id,v_assignment.display_name,v_asset.id,v_assignment.revision;
end $$;

create or replace function private.create_partner_review_entry_link(p_workspace_id uuid,p_therapist_assignment_id uuid,p_channel text)
returns table(public_handle uuid, therapist_display_name text)
language plpgsql security definer set search_path=private,app,pg_temp as $$
declare v_shop uuid; v_link private.review_entry_links%rowtype; v_assignment app.therapist_assignments%rowtype;
begin
  v_shop:=private.partner_workspace_app_shop(p_workspace_id);
  if p_channel not in ('line','email') then raise exception 'invalid review link channel' using errcode='22023'; end if;
  select link.* into v_link from private.partner_review_entry_link_bindings binding
  join private.review_entry_links link on link.id=binding.link_id
  where binding.workspace_id=p_workspace_id and binding.therapist_assignment_id is not distinct from p_therapist_assignment_id
    and binding.channel=p_channel and link.is_active for key share of link;
  if found then
    select display_name into v_assignment.display_name from app.therapist_assignments where id=p_therapist_assignment_id
      and lifecycle_state='active' and (active_until is null or active_until>now());
    return query select v_link.public_handle,v_assignment.display_name; return;
  end if;
  if p_therapist_assignment_id is not null then
    select assignment.* into v_assignment from app.therapist_assignments assignment
    join private.therapist_assignment_rights rights on rights.assignment_id=assignment.id and rights.workspace_id=p_workspace_id
    where assignment.id=p_therapist_assignment_id and assignment.shop_id=v_shop and assignment.lifecycle_state='active'
      and (assignment.active_until is null or assignment.active_until>now()) for key share;
    if not found then raise exception 'therapist assignment is unavailable' using errcode='42501'; end if;
  end if;
  insert into private.review_entry_links(shop_id,therapist_assignment_id,link_kind,created_by)
  values(v_shop,p_therapist_assignment_id,case when p_therapist_assignment_id is null then 'shop_qr' else 'therapist_link' end,'partner:' || p_workspace_id)
  returning * into v_link;
  insert into private.partner_review_entry_link_bindings(link_id,workspace_id,therapist_assignment_id,channel)
  values(v_link.id,p_workspace_id,p_therapist_assignment_id,p_channel);
  return query select v_link.public_handle,v_assignment.display_name;
end $$;

create or replace function private.preview_partner_review_request(
  p_workspace_id uuid,p_therapist_assignment_id uuid,p_channel text,p_greeting_variant text
) returns table(subject text, body text, review_url text, therapist_display_name text)
language plpgsql security definer set search_path=private,app,pg_temp as $$
declare v_shop uuid; v_name text; v_handle uuid; v_shop_name text; v_intro text; v_greeting text;
begin
  if p_greeting_variant not in ('today','recent') then raise exception 'invalid greeting variant' using errcode='22023'; end if;
  select link_result.public_handle,link_result.therapist_display_name into v_handle,v_name
  from private.create_partner_review_entry_link(p_workspace_id,p_therapist_assignment_id,p_channel) as link_result;
  v_shop:=private.partner_workspace_app_shop(p_workspace_id);
  select name into v_shop_name from app.shops where id=v_shop;
  v_greeting:=case when p_greeting_variant='today' then '本日は' else '先日は' end;
  v_intro:=v_greeting || v_shop_name || 'をご利用いただき、ありがとうございました。' || E'\n\n'
    || 'よろしければ、お店' || case when v_name is null then '' else 'と担当セラピスト「' || v_name || '」' end || 'について率直なご感想をお聞かせください。会員登録は不要で、セラピストの評価は省略できます。' || E'\n\n'
    || 'こちらは公開口コミの投稿ページです。内容は確認後、Eskomiや当店ホームページに掲載される場合があります。' || E'\n'
    || '評価の良し悪しにかかわらず、率直なご感想をお待ちしております。' || E'\n\n'
    || 'https://mens-esthe-kuchikomi.com/r/' || v_handle || '/';
  return query select case when p_channel='email' then 'ご利用ありがとうございました｜' || v_shop_name else null end,v_intro,'https://mens-esthe-kuchikomi.com/r/' || v_handle || '/',v_name;
end $$;

create or replace function api.reserve_partner_therapist_photo_upload(p_workspace_id uuid,p_content_type text)
returns text language sql security invoker set search_path=private,pg_temp as $$ select private.reserve_partner_therapist_photo_upload(p_workspace_id,p_content_type) $$;
create or replace function api.attach_partner_therapist_photo(p_workspace_id uuid,p_object_key text,p_sha256 text,p_content_type text,p_byte_size integer,p_width integer,p_height integer)
returns uuid language sql security invoker set search_path=private,pg_temp as $$ select private.attach_partner_therapist_photo(p_workspace_id,p_object_key,p_sha256,p_content_type,p_byte_size,p_width,p_height) $$;
create or replace function api.create_partner_therapist_assignment(p_workspace_id uuid,p_display_name text,p_photo_asset_id uuid,p_permission_policy_version text,p_permission_confirmed boolean)
returns table(assignment_id uuid,display_name text,photo_asset_id uuid,revision integer) language sql security invoker set search_path=private,pg_temp as $$ select * from private.create_partner_therapist_assignment(p_workspace_id,p_display_name,p_photo_asset_id,p_permission_policy_version,p_permission_confirmed) $$;
create or replace function api.list_partner_therapist_assignments(p_workspace_id uuid)
returns table(assignment_id uuid,display_name text,photo_asset_id uuid,lifecycle_state text,revision integer,permission_policy_version text) language sql security invoker set search_path=private,pg_temp as $$ select * from private.list_partner_therapist_assignments(p_workspace_id) $$;
create or replace function api.end_partner_therapist_assignment(p_workspace_id uuid,p_assignment_id uuid,p_expected_revision integer)
returns table(assignment_id uuid,lifecycle_state text,revision integer) language sql security invoker set search_path=private,pg_temp as $$ select * from private.end_partner_therapist_assignment(p_workspace_id,p_assignment_id,p_expected_revision) $$;
create or replace function api.update_partner_therapist_assignment(p_workspace_id uuid,p_assignment_id uuid,p_expected_revision integer,p_display_name text,p_photo_asset_id uuid,p_permission_policy_version text,p_permission_confirmed boolean)
returns table(assignment_id uuid,display_name text,photo_asset_id uuid,revision integer) language sql security invoker set search_path=private,pg_temp as $$ select * from private.update_partner_therapist_assignment(p_workspace_id,p_assignment_id,p_expected_revision,p_display_name,p_photo_asset_id,p_permission_policy_version,p_permission_confirmed) $$;
create or replace function api.create_partner_review_entry_link(p_workspace_id uuid,p_therapist_assignment_id uuid,p_channel text)
returns table(public_handle uuid,therapist_display_name text) language sql security invoker set search_path=private,pg_temp as $$ select * from private.create_partner_review_entry_link(p_workspace_id,p_therapist_assignment_id,p_channel) $$;
create or replace function api.preview_partner_review_request(p_workspace_id uuid,p_therapist_assignment_id uuid,p_channel text,p_greeting_variant text)
returns table(subject text,body text,review_url text,therapist_display_name text) language sql security invoker set search_path=private,pg_temp as $$ select * from private.preview_partner_review_request(p_workspace_id,p_therapist_assignment_id,p_channel,p_greeting_variant) $$;
create or replace function api.get_partner_therapist_workspace_scope(p_auth_user_id uuid)
returns table(workspace_id uuid,app_shop_id uuid,role text) language sql security invoker set search_path=private,pg_temp as $$ select * from private.get_partner_therapist_workspace_scope(p_auth_user_id) $$;

revoke all on function private.partner_workspace_app_shop(uuid),private.get_partner_therapist_workspace_scope(uuid),private.reserve_partner_therapist_photo_upload(uuid,text),private.attach_partner_therapist_photo(uuid,text,text,text,integer,integer,integer),private.create_partner_therapist_assignment(uuid,text,uuid,text,boolean),private.list_partner_therapist_assignments(uuid),private.end_partner_therapist_assignment(uuid,uuid,integer),private.update_partner_therapist_assignment(uuid,uuid,integer,text,uuid,text,boolean),private.create_partner_review_entry_link(uuid,uuid,text),private.preview_partner_review_request(uuid,uuid,text,text) from public,anon,authenticated;
revoke all on function api.get_partner_therapist_workspace_scope(uuid),api.reserve_partner_therapist_photo_upload(uuid,text),api.attach_partner_therapist_photo(uuid,text,text,text,integer,integer,integer),api.create_partner_therapist_assignment(uuid,text,uuid,text,boolean),api.list_partner_therapist_assignments(uuid),api.end_partner_therapist_assignment(uuid,uuid,integer),api.update_partner_therapist_assignment(uuid,uuid,integer,text,uuid,text,boolean),api.create_partner_review_entry_link(uuid,uuid,text),api.preview_partner_review_request(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function private.partner_workspace_app_shop(uuid),private.get_partner_therapist_workspace_scope(uuid),private.reserve_partner_therapist_photo_upload(uuid,text),private.attach_partner_therapist_photo(uuid,text,text,text,integer,integer,integer),private.create_partner_therapist_assignment(uuid,text,uuid,text,boolean),private.list_partner_therapist_assignments(uuid),private.end_partner_therapist_assignment(uuid,uuid,integer),private.update_partner_therapist_assignment(uuid,uuid,integer,text,uuid,text,boolean),private.create_partner_review_entry_link(uuid,uuid,text),private.preview_partner_review_request(uuid,uuid,text,text) to service_role;
grant execute on function api.get_partner_therapist_workspace_scope(uuid),api.reserve_partner_therapist_photo_upload(uuid,text),api.attach_partner_therapist_photo(uuid,text,text,text,integer,integer,integer),api.create_partner_therapist_assignment(uuid,text,uuid,text,boolean),api.list_partner_therapist_assignments(uuid),api.end_partner_therapist_assignment(uuid,uuid,integer),api.update_partner_therapist_assignment(uuid,uuid,integer,text,uuid,text,boolean),api.create_partner_review_entry_link(uuid,uuid,text),api.preview_partner_review_request(uuid,uuid,text,text) to service_role;

notify pgrst, 'reload schema';
