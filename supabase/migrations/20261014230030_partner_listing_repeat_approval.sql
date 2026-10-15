-- A stable store can retain multiple application records. An approval always
-- adds a new approved store revision, unless a Partner revision is actively
-- awaiting review; that conflict preserves the pending owner change.
drop index if exists private.listing_applications_listing_store_id_unique;
create index if not exists listing_applications_listing_store_id_idx
  on private.listing_applications(listing_store_id)
  where listing_store_id is not null;

create or replace function private.ensure_listing_store_for_application(p_application_id uuid)
returns uuid language plpgsql security definer set search_path=private,pg_temp as $$
declare
  v_application private.listing_applications%rowtype;
  v_store private.listing_stores%rowtype;
  v_revision private.listing_store_revisions%rowtype;
  v_store_id uuid;
  v_slug text;
  v_next_revision integer;
begin
  select * into v_application from private.listing_applications where id=p_application_id for update;
  if not found then raise exception 'application unavailable' using errcode='23514'; end if;

  if v_application.listing_store_id is not null then
    select * into v_store from private.listing_stores where id=v_application.listing_store_id for update;
  elsif v_application.kind = 'existing_change' then
    select * into v_store from private.listing_stores
    where existing_wp_shop_id=v_application.existing_wp_shop_id for update;
  end if;

  if v_store.id is not null then
    select * into v_revision from private.listing_store_revisions
    where listing_store_id=v_store.id and revision=v_store.current_revision for key share;
    if not found or v_revision.state <> 'approved' then
      raise exception 'listing store has an active pending revision' using errcode='40001';
    end if;
    v_next_revision := v_store.current_revision + 1;
    insert into private.listing_store_revisions(
      listing_store_id,revision,state,shop_name,area,website_url,introduction,banner_asset_id
    ) values (
      v_store.id,v_next_revision,'approved',v_application.shop_name,v_application.area,
      v_application.website_url,v_application.introduction,v_application.banner_asset_id
    );
    update private.listing_stores
    set current_revision=v_next_revision,updated_at=now() where id=v_store.id;
    insert into private.listing_store_publications(
      listing_store_id,approved_revision,shop_slug,shop_name,area,website_url,introduction,banner_asset_id
    ) values (
      v_store.id,v_next_revision,v_store.shop_slug,v_application.shop_name,v_application.area,
      v_application.website_url,v_application.introduction,v_application.banner_asset_id
    ) on conflict(listing_store_id) do update set
      approved_revision=excluded.approved_revision,shop_slug=excluded.shop_slug,
      shop_name=excluded.shop_name,area=excluded.area,website_url=excluded.website_url,
      introduction=excluded.introduction,banner_asset_id=excluded.banner_asset_id,published_at=now();
    v_store_id := v_store.id;
  elsif v_application.kind = 'existing_change' then
    insert into private.listing_stores(shop_slug,existing_wp_shop_id)
    values(v_application.existing_shop_slug,v_application.existing_wp_shop_id)
    returning id into v_store_id;
    insert into private.listing_store_revisions(
      listing_store_id,revision,state,shop_name,area,website_url,introduction,banner_asset_id
    ) values (
      v_store_id,1,'approved',v_application.shop_name,v_application.area,
      v_application.website_url,v_application.introduction,v_application.banner_asset_id
    );
    update private.listing_stores set current_revision=1,updated_at=now() where id=v_store_id;
    insert into private.listing_store_publications(
      listing_store_id,approved_revision,shop_slug,shop_name,area,website_url,introduction,banner_asset_id
    ) values (
      v_store_id,1,v_application.existing_shop_slug,v_application.shop_name,v_application.area,
      v_application.website_url,v_application.introduction,v_application.banner_asset_id
    );
  else
    v_slug := 'listing-' || replace(v_application.id::text,'-','');
    insert into private.listing_stores(shop_slug,origin_application_id)
    values(v_slug,v_application.id) returning id into v_store_id;
    insert into private.listing_store_revisions(
      listing_store_id,revision,state,shop_name,area,website_url,introduction,banner_asset_id
    ) values (
      v_store_id,1,'approved',v_application.shop_name,v_application.area,
      v_application.website_url,v_application.introduction,v_application.banner_asset_id
    );
    update private.listing_stores set current_revision=1,updated_at=now() where id=v_store_id;
    insert into private.listing_store_publications(
      listing_store_id,approved_revision,shop_slug,shop_name,area,website_url,introduction,banner_asset_id
    ) values (
      v_store_id,1,v_slug,v_application.shop_name,v_application.area,
      v_application.website_url,v_application.introduction,v_application.banner_asset_id
    );
  end if;

  update private.listing_applications
  set listing_store_id=v_store_id,updated_at=now() where id=v_application.id;
  return v_store_id;
end;
$$;

create or replace function private.review_listing_application(
  p_application_id uuid,p_expected_revision integer,p_decision text,p_reviewer_label text,p_note text default null
) returns text language plpgsql security definer set search_path=private,pg_temp as $$
declare v private.listing_applications%rowtype;
begin
  select * into v from private.listing_applications where id=p_application_id for update;
  if not found or v.revision <> p_expected_revision then return 'conflict'; end if;
  if p_decision not in ('approved','changes_requested','rejected') then
    raise exception 'invalid decision' using errcode='22023';
  end if;
  if p_decision='approved' then
    begin
      perform private.ensure_listing_store_for_application(v.id);
    exception when serialization_failure then
      return 'conflict';
    end;
  end if;
  insert into private.listing_application_reviews(application_id,expected_revision,decision,reviewer_label,note)
  values(p_application_id,p_expected_revision,p_decision,p_reviewer_label,p_note);
  update private.listing_applications set
    state=case p_decision
      when 'approved' then 'approved_candidate'::private.listing_application_state
      when 'changes_requested' then 'changes_requested'::private.listing_application_state
      else 'rejected'::private.listing_application_state
    end,
    updated_at=now()
  where id=p_application_id;
  if p_decision='approved' then
    insert into private.listing_public_projections(
      application_id,approved_revision,shop_name,area,website_url,introduction,banner_asset_id
    ) values (
      v.id,v.revision,v.shop_name,v.area,v.website_url,v.introduction,v.banner_asset_id
    ) on conflict(application_id) do update set
      approved_revision=excluded.approved_revision,shop_name=excluded.shop_name,area=excluded.area,
      website_url=excluded.website_url,introduction=excluded.introduction,
      banner_asset_id=excluded.banner_asset_id,published_at=now();
  end if;
  return 'ok';
end;
$$;

create or replace function private.save_partner_listing_draft(
  p_workspace_id uuid,p_expected_revision integer,p_payload jsonb
) returns text language plpgsql security definer set search_path=private,pg_temp as $$
declare v_store private.listing_stores%rowtype; v_previous private.listing_store_revisions%rowtype;
declare v_name text; v_area text; v_url text; v_intro text; v_banner uuid;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'invalid listing draft' using errcode='22023';
  end if;
  select * into v_store from private.listing_stores where workspace_id=p_workspace_id for update;
  if not found then return 'forbidden'; end if;
  if v_store.current_revision <> p_expected_revision then return 'conflict'; end if;
  select * into v_previous from private.listing_store_revisions
  where listing_store_id=v_store.id and revision=v_store.current_revision;
  if v_previous.state not in ('draft','changes_requested','approved') then return 'conflict'; end if;
  v_name:=nullif(trim(p_payload->>'shop_name'),'');
  v_area:=nullif(trim(p_payload->>'area'),'');
  v_url:=nullif(trim(p_payload->>'website_url'),'');
  v_intro:=nullif(trim(coalesce(p_payload->>'introduction','')),'');
  if char_length(v_name) not between 1 and 120 or char_length(v_area) not between 1 and 120
    or v_url !~ '^https?://' or char_length(v_intro)>5000 then
    raise exception 'invalid listing draft' using errcode='22023';
  end if;
  begin
    v_banner:=nullif(p_payload->>'banner_asset_id','')::uuid;
  exception when invalid_text_representation then
    raise exception 'invalid banner asset' using errcode='22023';
  end;
  if v_banner is not null and not exists (
    select 1 from private.listing_application_assets a
    left join private.listing_applications app on app.id=a.application_id
    where a.id=v_banner and (a.listing_store_id=v_store.id or app.listing_store_id=v_store.id)
  ) then raise exception 'banner does not belong to listing' using errcode='42501'; end if;
  insert into private.listing_store_revisions(
    listing_store_id,revision,state,shop_name,area,website_url,introduction,banner_asset_id
  ) values (
    v_store.id,v_store.current_revision+1,'draft',v_name,v_area,v_url,v_intro,v_banner
  );
  update private.listing_stores
  set current_revision=current_revision+1,updated_at=now() where id=v_store.id;
  return 'ok';
end;
$$;

revoke all on function private.ensure_listing_store_for_application(uuid) from public,anon,authenticated;
revoke all on function private.review_listing_application(uuid,integer,text,text,text) from public,anon,authenticated;
revoke all on function private.save_partner_listing_draft(uuid,integer,jsonb) from public,anon,authenticated;
grant execute on function private.ensure_listing_store_for_application(uuid) to service_role;
grant execute on function private.review_listing_application(uuid,integer,text,text,text) to service_role;
grant execute on function private.save_partner_listing_draft(uuid,integer,jsonb) to service_role;

notify pgrst, 'reload schema';
