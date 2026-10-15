-- Completes the operator-only workflow for incomplete legacy records and
-- reversible publication control. No record is deleted when it is unlisted.
alter table private.managed_shops
  add column publication_state text not null default 'unlisted' check (publication_state in ('published','unlisted'));

alter table private.managed_shop_revisions alter column official_url drop not null;
alter table private.managed_shop_publications alter column official_url drop not null;
alter table private.managed_shop_revisions drop constraint if exists managed_shop_revisions_official_url_check;
alter table private.managed_shop_publications drop constraint if exists managed_shop_publications_official_url_check;
alter table private.managed_shop_revisions add constraint managed_shop_revisions_official_url_check check (official_url is null or official_url ~ '^https?://');
alter table private.managed_shop_publications add constraint managed_shop_publications_official_url_check check (official_url is null or official_url ~ '^https?://');

create or replace function private.assert_managed_shop_payload(
  p_managed_shop_id uuid, p_payload jsonb
) returns void language plpgsql security definer set search_path=private,pg_temp as $$
declare v_name text; v_area_slug text; v_area_name text; v_official_url text; v_gallery uuid[]; v_banner uuid;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object'
    or p_payload - array['shop_name','area_slug','area_name','official_url','introduction','address','business_hours','phone','line_url','booking_url','basic_price','price_90','banner_asset_id','gallery_asset_ids'] <> '{}'::jsonb then
    raise exception 'invalid managed shop payload' using errcode='22023';
  end if;
  v_name:=nullif(trim(p_payload->>'shop_name'),''); v_area_slug:=nullif(trim(p_payload->>'area_slug'),''); v_area_name:=nullif(trim(p_payload->>'area_name'),''); v_official_url:=nullif(trim(coalesce(p_payload->>'official_url','')),'');
  if v_name is null or char_length(v_name) > 120 or v_area_slug is null or v_area_slug !~ '^[^/[:space:]]{1,200}$' or v_area_name is null or char_length(v_area_name)>120
    or (v_official_url is not null and v_official_url !~ '^https?://') or char_length(nullif(trim(coalesce(p_payload->>'introduction','')),''))>5000
    or char_length(nullif(trim(coalesce(p_payload->>'address','')),''))>500 or char_length(nullif(trim(coalesce(p_payload->>'business_hours','')),''))>500
    or char_length(nullif(trim(coalesce(p_payload->>'phone','')),''))>120
    or (nullif(trim(coalesce(p_payload->>'line_url','')),'') is not null and nullif(trim(p_payload->>'line_url'),'') !~ '^https?://')
    or (nullif(trim(coalesce(p_payload->>'booking_url','')),'') is not null and nullif(trim(p_payload->>'booking_url'),'') !~ '^https?://')
    or (p_payload ? 'basic_price' and p_payload->'basic_price' <> 'null'::jsonb and (p_payload->>'basic_price') !~ '^[1-9][0-9]{0,6}$')
    or (p_payload ? 'price_90' and p_payload->'price_90' <> 'null'::jsonb and (p_payload->>'price_90') !~ '^[1-9][0-9]{0,6}$') then raise exception 'invalid managed shop payload' using errcode='22023'; end if;
  begin v_banner:=nullif(p_payload->>'banner_asset_id','')::uuid; select coalesce(array_agg(value::uuid order by ordinality),'{}'::uuid[]) into v_gallery from jsonb_array_elements_text(coalesce(p_payload->'gallery_asset_ids','[]'::jsonb)) with ordinality; exception when invalid_text_representation then raise exception 'invalid managed shop asset id' using errcode='22023'; end;
  if jsonb_typeof(coalesce(p_payload->'gallery_asset_ids','[]'::jsonb))<>'array' or cardinality(v_gallery)>10 or cardinality(v_gallery)<>cardinality(array(select distinct unnest(v_gallery))) then raise exception 'invalid managed shop gallery' using errcode='22023'; end if;
  if v_banner is not null and not exists(select 1 from private.managed_shop_assets where id=v_banner and managed_shop_id=p_managed_shop_id) then raise exception 'managed shop banner does not belong to store' using errcode='42501'; end if;
  if exists(select 1 from unnest(v_gallery) asset_id where not exists(select 1 from private.managed_shop_assets where id=asset_id and managed_shop_id=p_managed_shop_id)) then raise exception 'managed shop gallery does not belong to store' using errcode='42501'; end if;
end;
$$;

create or replace function private.review_managed_shop_revision(
  p_managed_shop_id uuid,p_expected_revision integer,p_decision text,p_reviewer_label text,p_note text default null
) returns text language plpgsql security definer set search_path=private,pg_temp as $$
declare v_shop private.managed_shops%rowtype; v_revision private.managed_shop_revisions%rowtype;
begin
  if p_decision not in ('changes_requested','approved') or char_length(trim(p_reviewer_label)) not between 1 and 120 or char_length(trim(coalesce(p_note,'')))>5000 or (p_decision='changes_requested' and nullif(trim(coalesce(p_note,'')),'') is null) then raise exception 'invalid managed shop review' using errcode='22023'; end if;
  select * into v_shop from private.managed_shops where id=p_managed_shop_id for update;
  if not found or v_shop.current_revision<>p_expected_revision then return 'conflict'; end if;
  select * into v_revision from private.managed_shop_revisions where managed_shop_id=v_shop.id and revision=v_shop.current_revision for update;
  if not found or v_revision.state<>'submitted' then return 'conflict'; end if;
  update private.managed_shop_revisions set state=p_decision where managed_shop_id=v_shop.id and revision=v_shop.current_revision;
  insert into private.managed_shop_reviews(managed_shop_id,revision,decision,reviewer_label,note) values(v_shop.id,v_shop.current_revision,p_decision,trim(p_reviewer_label),nullif(trim(coalesce(p_note,'')),''));
  if p_decision='approved' then
    insert into private.managed_shop_publications(managed_shop_id,approved_revision,shop_slug,canonical_url,directory_id,existing_wp_shop_id,shop_name,area_slug,area_name,official_url,introduction,address,business_hours,phone,line_url,booking_url,basic_price,price_90,banner_asset_id,gallery_asset_ids)
    values(v_shop.id,v_revision.revision,v_shop.shop_slug,v_shop.canonical_url,v_shop.directory_id,v_shop.existing_wp_shop_id,v_revision.shop_name,v_revision.area_slug,v_revision.area_name,v_revision.official_url,v_revision.introduction,v_revision.address,v_revision.business_hours,v_revision.phone,v_revision.line_url,v_revision.booking_url,v_revision.basic_price,v_revision.price_90,v_revision.banner_asset_id,v_revision.gallery_asset_ids)
    on conflict(managed_shop_id) do update set approved_revision=excluded.approved_revision,shop_slug=excluded.shop_slug,canonical_url=excluded.canonical_url,directory_id=excluded.directory_id,existing_wp_shop_id=excluded.existing_wp_shop_id,shop_name=excluded.shop_name,area_slug=excluded.area_slug,area_name=excluded.area_name,official_url=excluded.official_url,introduction=excluded.introduction,address=excluded.address,business_hours=excluded.business_hours,phone=excluded.phone,line_url=excluded.line_url,booking_url=excluded.booking_url,basic_price=excluded.basic_price,price_90=excluded.price_90,banner_asset_id=excluded.banner_asset_id,gallery_asset_ids=excluded.gallery_asset_ids,published_at=now();
    update private.managed_shops set publication_state='published',updated_at=now() where id=v_shop.id;
  end if;
  return 'ok';
end;
$$;

create or replace function private.set_managed_shop_visibility(
  p_managed_shop_id uuid,p_expected_revision integer,p_visibility text,p_actor_label text
) returns text language plpgsql security definer set search_path=private,pg_temp as $$
declare v private.managed_shops%rowtype; v_state text;
begin
  if p_visibility not in ('published','unlisted') or char_length(trim(p_actor_label)) not between 1 and 120 then raise exception 'invalid managed shop visibility' using errcode='22023'; end if;
  select * into v from private.managed_shops where id=p_managed_shop_id for update;
  if not found or v.current_revision<>p_expected_revision then return 'conflict'; end if;
  select state into v_state from private.managed_shop_revisions where managed_shop_id=v.id and revision=v.current_revision for key share;
  if v_state<>'approved' or not exists(select 1 from private.managed_shop_publications where managed_shop_id=v.id) then return 'conflict'; end if;
  update private.managed_shops set publication_state=p_visibility,updated_at=now() where id=v.id;
  insert into private.managed_shop_reviews(managed_shop_id,revision,decision,reviewer_label,note) values(v.id,v.current_revision,'approved',trim(p_actor_label),case when p_visibility='unlisted' then '非公開へ変更' else '公開へ変更' end);
  return 'ok';
end;
$$;

create or replace function api.list_published_managed_shops()
returns table(managed_shop_id uuid,directory_id bigint,existing_wp_shop_id bigint,shop_slug text,canonical_url text,approved_revision integer,shop_name text,area_slug text,area_name text,official_url text,introduction text,address text,business_hours text,phone text,line_url text,booking_url text,basic_price integer,price_90 integer,banner_asset_id uuid,gallery_asset_ids uuid[])
language sql security invoker set search_path=private,pg_temp as $$
  select p.managed_shop_id,p.directory_id,p.existing_wp_shop_id,p.shop_slug,p.canonical_url,p.approved_revision,p.shop_name,p.area_slug,p.area_name,p.official_url,p.introduction,p.address,p.business_hours,p.phone,p.line_url,p.booking_url,p.basic_price,p.price_90,p.banner_asset_id,p.gallery_asset_ids
  from private.managed_shop_publications p join private.managed_shops s on s.id=p.managed_shop_id where s.publication_state='published' order by p.shop_slug
$$;

create or replace function api.set_managed_shop_visibility(p_managed_shop_id uuid,p_expected_revision integer,p_visibility text,p_actor_label text)
returns text language sql security invoker set search_path=private,pg_temp as $$ select private.set_managed_shop_visibility(p_managed_shop_id,p_expected_revision,p_visibility,p_actor_label) $$;

revoke all on function private.assert_managed_shop_payload(uuid,jsonb) from public,anon,authenticated;
revoke all on function private.review_managed_shop_revision(uuid,integer,text,text,text) from public,anon,authenticated;
revoke all on function private.set_managed_shop_visibility(uuid,integer,text,text) from public,anon,authenticated;
revoke all on function api.list_published_managed_shops() from public,anon,authenticated;
revoke all on function api.set_managed_shop_visibility(uuid,integer,text,text) from public,anon,authenticated;
grant execute on function private.review_managed_shop_revision(uuid,integer,text,text,text) to service_role;
grant execute on function private.set_managed_shop_visibility(uuid,integer,text,text) to service_role;
grant execute on function api.list_published_managed_shops() to service_role;
grant execute on function api.set_managed_shop_visibility(uuid,integer,text,text) to service_role;

notify pgrst, 'reload schema';
