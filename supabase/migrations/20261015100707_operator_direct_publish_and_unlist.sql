-- Operators publish their own work directly. Partner changes continue to use
-- their separate submit/review workflow and never receive these RPC grants.
create or replace function private.publish_managed_shop_revision(
  p_managed_shop_id uuid,
  p_expected_revision integer,
  p_actor_label text,
  p_note text default '運営の直接公開'
) returns text language plpgsql security definer set search_path=private,pg_temp as $$
declare
  v_shop private.managed_shops%rowtype;
  v_revision private.managed_shop_revisions%rowtype;
begin
  if char_length(trim(p_actor_label)) not between 1 and 120
    or char_length(trim(coalesce(p_note,''))) > 5000 then
    raise exception 'invalid direct managed shop publication' using errcode='22023';
  end if;
  select * into v_shop from private.managed_shops where id=p_managed_shop_id for update;
  if not found then return 'not_found'; end if;
  if v_shop.current_revision <> p_expected_revision then return 'conflict'; end if;
  select * into v_revision from private.managed_shop_revisions
  where managed_shop_id=v_shop.id and revision=v_shop.current_revision for update;
  if not found or v_revision.state <> 'draft' then return 'conflict'; end if;

  update private.managed_shop_revisions
  set state='approved'
  where managed_shop_id=v_shop.id and revision=v_revision.revision;
  insert into private.managed_shop_reviews(managed_shop_id,revision,decision,reviewer_label,note)
  values(v_shop.id,v_revision.revision,'approved',trim(p_actor_label),nullif(trim(coalesce(p_note,'')),''));
  insert into private.managed_shop_publications(
    managed_shop_id,approved_revision,shop_slug,canonical_url,directory_id,existing_wp_shop_id,shop_name,area_slug,area_name,official_url,introduction,address,business_hours,phone,line_url,booking_url,basic_price,price_90,banner_asset_id,gallery_asset_ids
  ) values (
    v_shop.id,v_revision.revision,v_shop.shop_slug,v_shop.canonical_url,v_shop.directory_id,v_shop.existing_wp_shop_id,
    v_revision.shop_name,v_revision.area_slug,v_revision.area_name,v_revision.official_url,v_revision.introduction,v_revision.address,v_revision.business_hours,v_revision.phone,v_revision.line_url,v_revision.booking_url,v_revision.basic_price,v_revision.price_90,v_revision.banner_asset_id,v_revision.gallery_asset_ids
  ) on conflict(managed_shop_id) do update set
    approved_revision=excluded.approved_revision,shop_slug=excluded.shop_slug,canonical_url=excluded.canonical_url,directory_id=excluded.directory_id,existing_wp_shop_id=excluded.existing_wp_shop_id,
    shop_name=excluded.shop_name,area_slug=excluded.area_slug,area_name=excluded.area_name,official_url=excluded.official_url,introduction=excluded.introduction,address=excluded.address,business_hours=excluded.business_hours,phone=excluded.phone,line_url=excluded.line_url,booking_url=excluded.booking_url,basic_price=excluded.basic_price,price_90=excluded.price_90,banner_asset_id=excluded.banner_asset_id,gallery_asset_ids=excluded.gallery_asset_ids,published_at=now();
  update private.managed_shops set publication_state='published',updated_at=now() where id=v_shop.id;
  return 'ok';
end;
$$;

create or replace function private.create_and_publish_managed_shop(
  p_shop_slug text,p_payload jsonb,p_actor_label text
) returns uuid language plpgsql security definer set search_path=private,pg_temp as $$
declare v_id uuid;
begin
  v_id := private.create_managed_shop(p_shop_slug,p_payload,p_actor_label);
  if private.publish_managed_shop_revision(v_id,1,p_actor_label) <> 'ok' then
    raise exception 'managed shop direct publication failed' using errcode='40001';
  end if;
  return v_id;
end;
$$;

create or replace function private.import_and_publish_managed_shop_from_legacy(
  p_wp_shop_id bigint,p_shop_slug text,p_payload jsonb,p_actor_label text
) returns uuid language plpgsql security definer set search_path=private,pg_temp as $$
declare v_id uuid; v_revision integer; v_state text;
begin
  v_id := private.import_managed_shop_from_legacy(p_wp_shop_id,p_shop_slug,p_payload,p_actor_label);
  select s.current_revision,r.state into v_revision,v_state
  from private.managed_shops s join private.managed_shop_revisions r on r.managed_shop_id=s.id and r.revision=s.current_revision
  where s.id=v_id for update;
  if v_state='draft' then
    if private.publish_managed_shop_revision(v_id,v_revision,p_actor_label) <> 'ok' then
      raise exception 'legacy managed shop direct publication failed' using errcode='40001';
    end if;
  elsif v_state <> 'approved' then
    raise exception 'legacy managed shop has pending revision' using errcode='40001';
  end if;
  return v_id;
end;
$$;

create or replace function private.save_and_publish_managed_shop(
  p_managed_shop_id uuid,p_expected_revision integer,p_payload jsonb,p_actor_label text
) returns text language plpgsql security definer set search_path=private,pg_temp as $$
declare v_saved text; v_next integer;
begin
  v_saved := private.save_managed_shop_draft(p_managed_shop_id,p_expected_revision,p_payload,p_actor_label);
  if v_saved <> 'ok' then return v_saved; end if;
  select current_revision into v_next from private.managed_shops where id=p_managed_shop_id;
  return private.publish_managed_shop_revision(p_managed_shop_id,v_next,p_actor_label);
end;
$$;

-- Operator-direct edits begin from an approved revision. A private image may
-- be staged there before save_and_publish creates the next approved revision.
-- Browser roles remain excluded; this function is service-role only.
create or replace function private.attach_managed_shop_asset(
  p_managed_shop_id uuid,p_asset_id uuid,p_object_key text,p_sha256 text,p_content_type text,p_byte_size integer,p_width integer,p_height integer,p_actor_label text
) returns uuid language plpgsql security definer set search_path=private,pg_temp as $$
declare v_state text; v_extension text;
begin
  select r.state into v_state from private.managed_shops s
  join private.managed_shop_revisions r on r.managed_shop_id=s.id and r.revision=s.current_revision
  where s.id=p_managed_shop_id for update;
  if not found or v_state not in ('draft','changes_requested','approved') then raise exception 'managed shop asset unavailable' using errcode='42501'; end if;
  v_extension := case p_content_type when 'image/png' then 'png' when 'image/jpeg' then 'jpg' when 'image/webp' then 'webp' else null end;
  if p_asset_id is null or p_object_key <> format('managed-shops/%s/%s.%s',p_managed_shop_id,p_asset_id,v_extension)
    or p_sha256 !~ '^[0-9a-f]{64}$' or p_byte_size not between 1 and 5242880 or p_width not between 1 and 8000 or p_height not between 1 and 8000
    or char_length(trim(p_actor_label)) not between 1 and 120 then
    raise exception 'managed shop asset rejected' using errcode='42501';
  end if;
  insert into private.managed_shop_assets(id,managed_shop_id,object_key,sha256,content_type,byte_size,width,height)
  values(p_asset_id,p_managed_shop_id,p_object_key,p_sha256,p_content_type,p_byte_size,p_width,p_height);
  return p_asset_id;
end;
$$;

create or replace function api.create_and_publish_managed_shop(
  p_shop_slug text,p_payload jsonb,p_actor_label text
) returns uuid language sql security invoker set search_path=private,pg_temp as $$
  select private.create_and_publish_managed_shop(p_shop_slug,p_payload,p_actor_label)
$$;

create or replace function api.import_and_publish_managed_shop_from_legacy(
  p_wp_shop_id bigint,p_shop_slug text,p_payload jsonb,p_actor_label text
) returns uuid language sql security invoker set search_path=private,pg_temp as $$
  select private.import_and_publish_managed_shop_from_legacy(p_wp_shop_id,p_shop_slug,p_payload,p_actor_label)
$$;

create or replace function api.save_and_publish_managed_shop(
  p_managed_shop_id uuid,p_expected_revision integer,p_payload jsonb,p_actor_label text
) returns text language sql security invoker set search_path=private,pg_temp as $$
  select private.save_and_publish_managed_shop(p_managed_shop_id,p_expected_revision,p_payload,p_actor_label)
$$;

revoke all on function private.publish_managed_shop_revision(uuid,integer,text,text) from public,anon,authenticated;
revoke all on function private.create_and_publish_managed_shop(text,jsonb,text) from public,anon,authenticated;
revoke all on function private.import_and_publish_managed_shop_from_legacy(bigint,text,jsonb,text) from public,anon,authenticated;
revoke all on function private.save_and_publish_managed_shop(uuid,integer,jsonb,text) from public,anon,authenticated;
revoke all on function private.attach_managed_shop_asset(uuid,uuid,text,text,text,integer,integer,integer,text) from public,anon,authenticated;
revoke all on function api.create_and_publish_managed_shop(text,jsonb,text) from public,anon,authenticated;
revoke all on function api.import_and_publish_managed_shop_from_legacy(bigint,text,jsonb,text) from public,anon,authenticated;
revoke all on function api.save_and_publish_managed_shop(uuid,integer,jsonb,text) from public,anon,authenticated;
grant execute on function private.publish_managed_shop_revision(uuid,integer,text,text) to service_role;
grant execute on function private.create_and_publish_managed_shop(text,jsonb,text) to service_role;
grant execute on function private.import_and_publish_managed_shop_from_legacy(bigint,text,jsonb,text) to service_role;
grant execute on function private.save_and_publish_managed_shop(uuid,integer,jsonb,text) to service_role;
grant execute on function private.attach_managed_shop_asset(uuid,uuid,text,text,text,integer,integer,integer,text) to service_role;
grant execute on function api.create_and_publish_managed_shop(text,jsonb,text) to service_role;
grant execute on function api.import_and_publish_managed_shop_from_legacy(bigint,text,jsonb,text) to service_role;
grant execute on function api.save_and_publish_managed_shop(uuid,integer,jsonb,text) to service_role;

notify pgrst, 'reload schema';
