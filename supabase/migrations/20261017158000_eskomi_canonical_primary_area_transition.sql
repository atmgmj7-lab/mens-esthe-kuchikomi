-- A canonical publication can change its approved area.  The shop_areas
-- primary-area constraint is immediate, so clear the previous primary while
-- holding the app shop row lock before promoting the new area.
--
-- This is an additive corrective override: do not rewrite the historical
-- directory migration, because populated ledgers already contain it.
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

  -- Serializes area primary transitions for this canonical shop. This lock is
  -- deliberately acquired before clearing and promoting shop_areas rows.
  perform 1 from app.shops where id = v_shop.app_shop_id for update;

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

    -- Do this before the new primary insert/upsert: the partial unique index
    -- app.shop_areas(shop_id) WHERE is_primary is immediate.
    update app.shop_areas set is_primary = false
    where shop_id = v_shop.app_shop_id and area_id <> v_area_id and is_primary;
    insert into app.shop_areas (shop_id, area_id, is_primary, source_system)
    values (v_shop.app_shop_id, v_area_id, true, 'operator-managed')
    on conflict (shop_id, area_id) do update set is_primary = true, source_system = excluded.source_system;
  else
    update app.shops set publication_status = 'draft', published_at = null, updated_at = now()
    where id = v_shop.app_shop_id;
  end if;
end;
$$;

revoke all on function private.sync_canonical_managed_shop_publication_v11(uuid) from public, anon, authenticated;
grant execute on function private.sync_canonical_managed_shop_publication_v11(uuid) to service_role;

notify pgrst, 'reload schema';
