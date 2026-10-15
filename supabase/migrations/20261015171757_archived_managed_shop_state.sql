-- A deleted listing is an operator-only archive state. It never removes the
-- managed record, revision audit, private image references, or review history.
-- Restoring an archive always returns it to unlisted, never directly public.
alter table private.managed_shops
  drop constraint if exists managed_shops_publication_state_check;
alter table private.managed_shops
  add constraint managed_shops_publication_state_check
  check (publication_state in ('published','unlisted','deleted'));

-- Public composition needs to suppress legacy WordPress identities for both
-- non-public states. It receives no additional store details.
create or replace function api.list_unlisted_managed_shop_legacy_identities()
returns table(existing_wp_shop_id bigint,shop_slug text) language sql security invoker set search_path=private,pg_temp as $$
  select s.existing_wp_shop_id,s.shop_slug
  from private.managed_shops s
  join private.managed_shop_publications p on p.managed_shop_id=s.id
  where s.publication_state in ('unlisted','deleted') and s.existing_wp_shop_id is not null
$$;

-- The operator list receives only immutable legacy identity plus its display
-- state, so it can distinguish a temporary stop from an archived deletion.
create or replace function api.list_managed_shop_legacy_listing_states()
returns table(existing_wp_shop_id bigint,shop_slug text,publication_state text) language sql security invoker set search_path=private,pg_temp as $$
  select s.existing_wp_shop_id,s.shop_slug,s.publication_state
  from private.managed_shops s
  join private.managed_shop_publications p on p.managed_shop_id=s.id
  where s.publication_state in ('unlisted','deleted') and s.existing_wp_shop_id is not null
  order by s.existing_wp_shop_id
$$;

create or replace function private.archive_managed_shop(
  p_managed_shop_id uuid,p_expected_revision integer,p_actor_label text
) returns text language plpgsql security definer set search_path=private,pg_temp as $$
declare v_shop private.managed_shops%rowtype; v_revision_state text;
begin
  if char_length(trim(p_actor_label)) not between 1 and 120 then
    raise exception 'invalid managed shop archive actor' using errcode='22023';
  end if;
  select * into v_shop from private.managed_shops where id=p_managed_shop_id for update;
  if not found then return 'not_found'; end if;
  if v_shop.current_revision <> p_expected_revision or v_shop.publication_state = 'deleted' then return 'conflict'; end if;
  select state into v_revision_state from private.managed_shop_revisions
  where managed_shop_id=v_shop.id and revision=v_shop.current_revision for key share;
  if v_revision_state <> 'approved'
    or not exists(select 1 from private.managed_shop_publications where managed_shop_id=v_shop.id) then return 'conflict'; end if;
  update private.managed_shops set publication_state='deleted',updated_at=now() where id=v_shop.id;
  insert into private.managed_shop_reviews(managed_shop_id,revision,decision,reviewer_label,note)
  values(v_shop.id,v_shop.current_revision,'approved',trim(p_actor_label),'削除済みに移動（公開データは保持）');
  return 'ok';
end;
$$;

-- Archived records must use their dedicated restore function. In particular,
-- a generic visibility change must never turn a deleted archive public again.
create or replace function private.set_managed_shop_visibility(
  p_managed_shop_id uuid,p_expected_revision integer,p_visibility text,p_actor_label text
) returns text language plpgsql security definer set search_path=private,pg_temp as $$
declare v private.managed_shops%rowtype; v_state text;
begin
  if p_visibility not in ('published','unlisted') or char_length(trim(p_actor_label)) not between 1 and 120 then
    raise exception 'invalid managed shop visibility' using errcode='22023';
  end if;
  select * into v from private.managed_shops where id=p_managed_shop_id for update;
  if not found or v.current_revision<>p_expected_revision or v.publication_state='deleted' then return 'conflict'; end if;
  select state into v_state from private.managed_shop_revisions where managed_shop_id=v.id and revision=v.current_revision for key share;
  if v_state<>'approved' or not exists(select 1 from private.managed_shop_publications where managed_shop_id=v.id) then return 'conflict'; end if;
  update private.managed_shops set publication_state=p_visibility,updated_at=now() where id=v.id;
  insert into private.managed_shop_reviews(managed_shop_id,revision,decision,reviewer_label,note)
  values(v.id,v.current_revision,'approved',trim(p_actor_label),case when p_visibility='unlisted' then '非公開へ変更' else '公開へ変更' end);
  return 'ok';
end;
$$;

create or replace function private.restore_archived_managed_shop_to_unlisted(
  p_managed_shop_id uuid,p_expected_revision integer,p_actor_label text
) returns text language plpgsql security definer set search_path=private,pg_temp as $$
declare v_shop private.managed_shops%rowtype; v_revision_state text;
begin
  if char_length(trim(p_actor_label)) not between 1 and 120 then
    raise exception 'invalid managed shop archive restore actor' using errcode='22023';
  end if;
  select * into v_shop from private.managed_shops where id=p_managed_shop_id for update;
  if not found then return 'not_found'; end if;
  if v_shop.current_revision <> p_expected_revision or v_shop.publication_state <> 'deleted' then return 'conflict'; end if;
  select state into v_revision_state from private.managed_shop_revisions
  where managed_shop_id=v_shop.id and revision=v_shop.current_revision for key share;
  if v_revision_state <> 'approved'
    or not exists(select 1 from private.managed_shop_publications where managed_shop_id=v_shop.id) then return 'conflict'; end if;
  update private.managed_shops set publication_state='unlisted',updated_at=now() where id=v_shop.id;
  insert into private.managed_shop_reviews(managed_shop_id,revision,decision,reviewer_label,note)
  values(v_shop.id,v_shop.current_revision,'approved',trim(p_actor_label),'削除済みから掲載停止へ復元（再掲載は未実行）');
  return 'ok';
end;
$$;

create or replace function api.archive_managed_shop(p_managed_shop_id uuid,p_expected_revision integer,p_actor_label text)
returns text language sql security invoker set search_path=private,pg_temp as $$
  select private.archive_managed_shop(p_managed_shop_id,p_expected_revision,p_actor_label)
$$;

create or replace function api.restore_archived_managed_shop_to_unlisted(p_managed_shop_id uuid,p_expected_revision integer,p_actor_label text)
returns text language sql security invoker set search_path=private,pg_temp as $$
  select private.restore_archived_managed_shop_to_unlisted(p_managed_shop_id,p_expected_revision,p_actor_label)
$$;

revoke all on function private.archive_managed_shop(uuid,integer,text) from public,anon,authenticated;
revoke all on function private.restore_archived_managed_shop_to_unlisted(uuid,integer,text) from public,anon,authenticated;
revoke all on function private.set_managed_shop_visibility(uuid,integer,text,text) from public,anon,authenticated;
revoke all on function api.list_unlisted_managed_shop_legacy_identities() from public,anon,authenticated;
revoke all on function api.list_managed_shop_legacy_listing_states() from public,anon,authenticated;
revoke all on function api.archive_managed_shop(uuid,integer,text) from public,anon,authenticated;
revoke all on function api.restore_archived_managed_shop_to_unlisted(uuid,integer,text) from public,anon,authenticated;
grant execute on function private.archive_managed_shop(uuid,integer,text) to service_role;
grant execute on function private.restore_archived_managed_shop_to_unlisted(uuid,integer,text) to service_role;
grant execute on function private.set_managed_shop_visibility(uuid,integer,text,text) to service_role;
grant execute on function api.list_unlisted_managed_shop_legacy_identities() to service_role;
grant execute on function api.list_managed_shop_legacy_listing_states() to service_role;
grant execute on function api.archive_managed_shop(uuid,integer,text) to service_role;
grant execute on function api.restore_archived_managed_shop_to_unlisted(uuid,integer,text) to service_role;

notify pgrst, 'reload schema';
