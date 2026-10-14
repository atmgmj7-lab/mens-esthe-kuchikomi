-- Local-only: an application id is not an upload authorization.  The browser receives
-- one opaque, short-lived capability after a successful application submission.  Only
-- its SHA-256 is stored, so a database read cannot be replayed as an upload.
create table private.listing_application_upload_tokens (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references private.listing_applications(id) on delete restrict,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  object_id uuid not null,
  object_key text unique,
  state text not null default 'issued' check (state in ('issued', 'reserved', 'consumed', 'superseded', 'expired')),
  expires_at timestamptz not null,
  reserved_at timestamptz,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  check ((state in ('reserved', 'consumed')) = (reserved_at is not null)),
  check ((state = 'consumed') = (consumed_at is not null))
);
alter table private.listing_application_upload_tokens enable row level security;
revoke all on table private.listing_application_upload_tokens from public, anon, authenticated;
grant select, insert, update on table private.listing_application_upload_tokens to service_role;

create or replace function private.issue_listing_application_upload_token(
  p_application_id uuid,
  p_token_hash text,
  p_object_id uuid,
  p_expires_at timestamptz
) returns void language plpgsql security definer set search_path = private, pg_temp as $$
declare v_state private.listing_application_state;
begin
  if p_token_hash !~ '^[0-9a-f]{64}$' or p_expires_at <= now() or p_expires_at > now() + interval '30 minutes' then
    raise exception 'invalid upload capability' using errcode = '22023';
  end if;
  select state into v_state from private.listing_applications where id = p_application_id for update;
  if not found or v_state not in ('received', 'content_review', 'changes_requested') then
    raise exception 'application unavailable for upload' using errcode = '23514';
  end if;
  update private.listing_application_upload_tokens
  set state = case when expires_at <= now() then 'expired' else 'superseded' end
  where application_id = p_application_id and state in ('issued', 'reserved');
  insert into private.listing_application_upload_tokens(application_id, token_hash, object_id, expires_at)
  values (p_application_id, p_token_hash, p_object_id, p_expires_at);
end;
$$;

create or replace function private.reserve_listing_application_upload(
  p_application_id uuid,
  p_token_hash text,
  p_content_type text
) returns text language plpgsql security definer set search_path = private, pg_temp as $$
declare v private.listing_application_upload_tokens%rowtype; v_extension text;
begin
  v_extension := case p_content_type when 'image/png' then 'png' when 'image/jpeg' then 'jpg' when 'image/webp' then 'webp' else null end;
  if v_extension is null or p_token_hash !~ '^[0-9a-f]{64}$' then raise exception 'invalid upload capability' using errcode='22023'; end if;
  select * into v from private.listing_application_upload_tokens
  where application_id = p_application_id and token_hash = p_token_hash for update;
  if not found then raise exception 'upload capability rejected' using errcode='42501'; end if;
  if v.expires_at <= now() then
    update private.listing_application_upload_tokens set state='expired' where id=v.id and state in ('issued','reserved');
    raise exception 'upload capability expired' using errcode='42501';
  end if;
  if v.state = 'issued' then
    update private.listing_application_upload_tokens
    set state='reserved', reserved_at=now(), object_key=format('listing-applications/%s/%s.%s', p_application_id, object_id, v_extension)
    where id=v.id
    returning * into v;
  elsif v.state <> 'reserved' then
    raise exception 'upload capability already used' using errcode='42501';
  end if;
  if v.object_key !~ ('^listing-applications/' || p_application_id::text || '/[0-9a-f-]+\\.' || v_extension || '$') then
    raise exception 'upload capability type mismatch' using errcode='22023';
  end if;
  return v.object_key;
end;
$$;

-- Replaces the earlier service-role function.  A caller must present a token reservation
-- for this exact application/object pair; an application id alone can never attach data.
drop function if exists api.attach_listing_application_asset(uuid,text,text,text,integer,integer,integer);
drop function if exists private.attach_listing_application_asset(uuid,text,text,text,integer,integer,integer);
create or replace function private.attach_listing_application_asset(
  p_application_id uuid, p_token_hash text, p_object_key text, p_sha256 text,
  p_content_type text, p_byte_size integer, p_width integer, p_height integer
) returns uuid language plpgsql security definer set search_path = private, pg_temp as $$
declare v_asset_id uuid; v_token private.listing_application_upload_tokens%rowtype;
begin
  select * into v_token from private.listing_application_upload_tokens
  where application_id=p_application_id and token_hash=p_token_hash for update;
  if not found or v_token.state <> 'reserved' or v_token.expires_at <= now() or v_token.object_key <> p_object_key then
    raise exception 'upload capability rejected' using errcode='42501';
  end if;
  insert into private.listing_application_assets(application_id,object_key,sha256,content_type,byte_size,width,height)
  values(p_application_id,p_object_key,p_sha256,p_content_type,p_byte_size,p_width,p_height) returning id into v_asset_id;
  update private.listing_applications set banner_asset_id=v_asset_id, revision=revision+1, updated_at=now()
  where id=p_application_id and state in ('received','content_review','changes_requested');
  if not found then raise exception 'application unavailable for asset' using errcode='23514'; end if;
  update private.listing_application_upload_tokens set state='consumed', consumed_at=now() where id=v_token.id;
  return v_asset_id;
end;
$$;
create or replace function api.attach_listing_application_asset(
  p_application_id uuid, p_token_hash text, p_object_key text, p_sha256 text,
  p_content_type text, p_byte_size integer, p_width integer, p_height integer
) returns uuid language sql security invoker set search_path=private,pg_temp as $$
  select private.attach_listing_application_asset(p_application_id,p_token_hash,p_object_key,p_sha256,p_content_type,p_byte_size,p_width,p_height)
$$;

revoke all on function private.issue_listing_application_upload_token(uuid,text,uuid,timestamptz) from public, anon, authenticated;
revoke all on function private.reserve_listing_application_upload(uuid,text,text) from public, anon, authenticated;
revoke all on function private.attach_listing_application_asset(uuid,text,text,text,text,integer,integer,integer) from public, anon, authenticated;
revoke all on function api.attach_listing_application_asset(uuid,text,text,text,text,integer,integer,integer) from public, anon, authenticated;
grant execute on function private.issue_listing_application_upload_token(uuid,text,uuid,timestamptz) to service_role;
grant execute on function private.reserve_listing_application_upload(uuid,text,text) to service_role;
grant execute on function private.attach_listing_application_asset(uuid,text,text,text,text,integer,integer,integer) to service_role;
grant execute on function api.attach_listing_application_asset(uuid,text,text,text,text,integer,integer,integer) to service_role;
