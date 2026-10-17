-- Canonical operator-managed shops use app.shops as their durable identity.
-- These wrappers keep that identity aligned with the reviewed directory
-- publication without changing the behaviour of legacy WordPress imports.

create or replace function private.sync_canonical_managed_shop_publication_v11(
  p_managed_shop_id uuid
) returns void
language plpgsql security definer set search_path = private, app, pg_temp as $$
declare
  v_shop private.managed_shops%rowtype;
  v_publication private.managed_shop_publications%rowtype;
  v_area_id uuid;
  v_description text;
begin
  select * into v_shop from private.managed_shops where id = p_managed_shop_id for key share;
  if not found or v_shop.app_shop_id is null then
    raise exception 'canonical managed shop not found' using errcode = 'P0002';
  end if;

  select * into v_publication from private.managed_shop_publications
  where managed_shop_id = v_shop.id for key share;

  if v_shop.publication_state = 'published' and v_publication.managed_shop_id is null then
    raise exception 'published canonical managed shop has no reviewed publication' using errcode = '23514';
  end if;

  if v_publication.managed_shop_id is not null then
    insert into app.areas (slug, name, is_published, published_at)
    values (v_publication.area_slug, v_publication.area_name, v_shop.publication_state = 'published',
      case when v_shop.publication_state = 'published' then now() else null end)
    on conflict (slug) do update set
      name = excluded.name,
      is_published = app.areas.is_published or excluded.is_published,
      published_at = case when app.areas.published_at is null and excluded.is_published then now() else app.areas.published_at end,
      updated_at = now()
    returning id into v_area_id;

    v_description := replace(replace(replace(replace(replace(coalesce(v_publication.introduction, ''), '&', '&amp;'), '<', '&lt;'), '>', '&gt;'), '"', '&quot;'), '''', '&#39;');
    update app.shops set
      name = v_publication.shop_name,
      description_html = v_description,
      excerpt = coalesce(v_publication.introduction, ''),
      official_url = v_publication.official_url,
      phone = v_publication.phone,
      address_text = v_publication.address,
      booking_url = v_publication.booking_url,
      publication_status = case v_shop.publication_state
        when 'published' then 'published'
        when 'deleted' then 'archived'
        else 'review'
      end,
      published_at = case when v_shop.publication_state = 'published' then coalesce(app.shops.published_at, v_publication.published_at, now()) else null end,
      updated_at = now()
    where id = v_shop.app_shop_id;

    insert into app.shop_areas (shop_id, area_id, is_primary, source_system)
    values (v_shop.app_shop_id, v_area_id, true, 'operator-managed')
    on conflict (shop_id, area_id) do update set is_primary = true, source_system = excluded.source_system;
    update app.shop_areas set is_primary = false
    where shop_id = v_shop.app_shop_id and area_id <> v_area_id and is_primary;
  else
    update app.shops set publication_status = 'draft', published_at = null, updated_at = now()
    where id = v_shop.app_shop_id;
  end if;
end;
$$;

create or replace function private.create_and_publish_canonical_managed_shop(
  p_shop_slug text, p_payload jsonb, p_actor_label text
) returns uuid
language plpgsql security definer set search_path = private, app, pg_temp as $$
declare v_managed_shop_id uuid; v_app_shop_id uuid; v_result text;
begin
  select managed_shop_id, app_shop_id into v_managed_shop_id, v_app_shop_id
  from private.create_canonical_managed_shop(p_shop_slug, p_payload, p_actor_label);
  -- Older installations may contain a pre-foundation implementation under
  -- this function name.  Preserve the freshly-created managed row, but never
  -- allow it to be published without first binding one new app.shops record.
  select app_shop_id into v_app_shop_id from private.managed_shops where id = v_managed_shop_id for update;
  if v_app_shop_id is null then
    insert into app.shops (slug, canonical_path, name, description_html, excerpt, official_url, address_text, booking_url, publication_status)
    values (
      p_shop_slug, '/shops/' || p_shop_slug || '/', trim(p_payload ->> 'shop_name'),
      '', coalesce(nullif(trim(p_payload ->> 'introduction'), ''), ''),
      nullif(trim(p_payload ->> 'official_url'), ''), nullif(trim(p_payload ->> 'address'), ''),
      nullif(trim(p_payload ->> 'booking_url'), ''), 'draft'
    ) returning id into v_app_shop_id;
    update private.managed_shops set app_shop_id = v_app_shop_id, updated_at = now() where id = v_managed_shop_id;
  end if;
  v_result := private.publish_managed_shop_revision(v_managed_shop_id, 1, p_actor_label);
  if v_result <> 'ok' then raise exception 'canonical managed shop publication failed' using errcode = '23514'; end if;
  perform private.sync_canonical_managed_shop_publication_v11(v_managed_shop_id);
  return v_managed_shop_id;
end;
$$;

create or replace function private.save_and_publish_canonical_managed_shop(
  p_managed_shop_id uuid, p_expected_revision integer, p_payload jsonb, p_actor_label text
) returns text
language plpgsql security definer set search_path = private, app, pg_temp as $$
declare v_result text;
begin
  if not exists (select 1 from private.managed_shops where id = p_managed_shop_id and app_shop_id is not null) then return 'not_found'; end if;
  v_result := private.save_and_publish_managed_shop(p_managed_shop_id, p_expected_revision, p_payload, p_actor_label);
  if v_result = 'ok' then perform private.sync_canonical_managed_shop_publication_v11(p_managed_shop_id); end if;
  return v_result;
end;
$$;

create or replace function private.set_canonical_managed_shop_visibility(
  p_managed_shop_id uuid, p_expected_revision integer, p_visibility text, p_actor_label text
) returns text
language plpgsql security definer set search_path = private, app, pg_temp as $$
declare v_result text;
begin
  if not exists (select 1 from private.managed_shops where id = p_managed_shop_id and app_shop_id is not null) then return 'not_found'; end if;
  v_result := private.set_managed_shop_visibility(p_managed_shop_id, p_expected_revision, p_visibility, p_actor_label);
  if v_result = 'ok' then perform private.sync_canonical_managed_shop_publication_v11(p_managed_shop_id); end if;
  return v_result;
end;
$$;

create or replace function private.review_canonical_managed_shop_revision(
  p_managed_shop_id uuid, p_expected_revision integer, p_decision text, p_reviewer_label text, p_note text default null
) returns text
language plpgsql security definer set search_path = private, app, pg_temp as $$
declare v_result text;
begin
  if not exists (select 1 from private.managed_shops where id = p_managed_shop_id and app_shop_id is not null) then return 'not_found'; end if;
  v_result := private.review_managed_shop_revision(p_managed_shop_id, p_expected_revision, p_decision, p_reviewer_label, p_note);
  if v_result = 'ok' and p_decision = 'approved' then perform private.sync_canonical_managed_shop_publication_v11(p_managed_shop_id); end if;
  return v_result;
end;
$$;

create or replace function private.archive_canonical_managed_shop(
  p_managed_shop_id uuid, p_expected_revision integer, p_actor_label text
) returns text
language plpgsql security definer set search_path = private, app, pg_temp as $$
declare v_result text;
begin
  if not exists (select 1 from private.managed_shops where id = p_managed_shop_id and app_shop_id is not null) then return 'not_found'; end if;
  v_result := private.archive_managed_shop(p_managed_shop_id, p_expected_revision, p_actor_label);
  if v_result = 'ok' then perform private.sync_canonical_managed_shop_publication_v11(p_managed_shop_id); end if;
  return v_result;
end;
$$;

create or replace function private.restore_canonical_managed_shop_to_unlisted(
  p_managed_shop_id uuid, p_expected_revision integer, p_actor_label text
) returns text
language plpgsql security definer set search_path = private, app, pg_temp as $$
declare v_result text;
begin
  if not exists (select 1 from private.managed_shops where id = p_managed_shop_id and app_shop_id is not null) then return 'not_found'; end if;
  v_result := private.restore_archived_managed_shop_to_unlisted(p_managed_shop_id, p_expected_revision, p_actor_label);
  if v_result = 'ok' then perform private.sync_canonical_managed_shop_publication_v11(p_managed_shop_id); end if;
  return v_result;
end;
$$;

create or replace function api.create_and_publish_canonical_managed_shop(p_shop_slug text, p_payload jsonb, p_actor_label text)
returns uuid language sql security invoker set search_path = private, api, pg_temp as $$
  select private.create_and_publish_canonical_managed_shop(p_shop_slug, p_payload, p_actor_label)
$$;
create or replace function api.save_and_publish_canonical_managed_shop(p_managed_shop_id uuid, p_expected_revision integer, p_payload jsonb, p_actor_label text)
returns text language sql security invoker set search_path = private, api, pg_temp as $$
  select private.save_and_publish_canonical_managed_shop(p_managed_shop_id, p_expected_revision, p_payload, p_actor_label)
$$;
create or replace function api.set_canonical_managed_shop_visibility(p_managed_shop_id uuid, p_expected_revision integer, p_visibility text, p_actor_label text)
returns text language sql security invoker set search_path = private, api, pg_temp as $$
  select private.set_canonical_managed_shop_visibility(p_managed_shop_id, p_expected_revision, p_visibility, p_actor_label)
$$;
create or replace function api.review_canonical_managed_shop_revision(p_managed_shop_id uuid, p_expected_revision integer, p_decision text, p_reviewer_label text, p_note text default null)
returns text language sql security invoker set search_path = private, api, pg_temp as $$
  select private.review_canonical_managed_shop_revision(p_managed_shop_id, p_expected_revision, p_decision, p_reviewer_label, p_note)
$$;
create or replace function api.archive_canonical_managed_shop(p_managed_shop_id uuid, p_expected_revision integer, p_actor_label text)
returns text language sql security invoker set search_path = private, api, pg_temp as $$
  select private.archive_canonical_managed_shop(p_managed_shop_id, p_expected_revision, p_actor_label)
$$;
create or replace function api.restore_canonical_managed_shop_to_unlisted(p_managed_shop_id uuid, p_expected_revision integer, p_actor_label text)
returns text language sql security invoker set search_path = private, api, pg_temp as $$
  select private.restore_canonical_managed_shop_to_unlisted(p_managed_shop_id, p_expected_revision, p_actor_label)
$$;

revoke all on function private.sync_canonical_managed_shop_publication_v11(uuid), private.create_and_publish_canonical_managed_shop(text,jsonb,text), private.save_and_publish_canonical_managed_shop(uuid,integer,jsonb,text), private.set_canonical_managed_shop_visibility(uuid,integer,text,text), private.review_canonical_managed_shop_revision(uuid,integer,text,text,text), private.archive_canonical_managed_shop(uuid,integer,text), private.restore_canonical_managed_shop_to_unlisted(uuid,integer,text) from public, anon, authenticated;
revoke all on function api.create_and_publish_canonical_managed_shop(text,jsonb,text), api.save_and_publish_canonical_managed_shop(uuid,integer,jsonb,text), api.set_canonical_managed_shop_visibility(uuid,integer,text,text), api.review_canonical_managed_shop_revision(uuid,integer,text,text,text), api.archive_canonical_managed_shop(uuid,integer,text), api.restore_canonical_managed_shop_to_unlisted(uuid,integer,text) from public, anon, authenticated;
grant execute on function private.sync_canonical_managed_shop_publication_v11(uuid), private.create_and_publish_canonical_managed_shop(text,jsonb,text), private.save_and_publish_canonical_managed_shop(uuid,integer,jsonb,text), private.set_canonical_managed_shop_visibility(uuid,integer,text,text), private.review_canonical_managed_shop_revision(uuid,integer,text,text,text), private.archive_canonical_managed_shop(uuid,integer,text), private.restore_canonical_managed_shop_to_unlisted(uuid,integer,text) to service_role;
grant execute on function api.create_and_publish_canonical_managed_shop(text,jsonb,text), api.save_and_publish_canonical_managed_shop(uuid,integer,jsonb,text), api.set_canonical_managed_shop_visibility(uuid,integer,text,text), api.review_canonical_managed_shop_revision(uuid,integer,text,text,text), api.archive_canonical_managed_shop(uuid,integer,text), api.restore_canonical_managed_shop_to_unlisted(uuid,integer,text) to service_role;

notify pgrst, 'reload schema';
