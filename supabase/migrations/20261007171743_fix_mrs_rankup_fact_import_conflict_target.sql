-- Keep the initial migration additive and correct its PL/pgSQL output-column
-- ambiguity without changing any persisted facts or audit rows.
create or replace function private.import_partner_shop_fact_snapshot(
  p_wp_shop_id bigint,
  p_shop_slug text,
  p_facts jsonb,
  p_actor_label text
)
returns table (
  state text,
  wp_shop_id bigint,
  shop_slug text,
  facts jsonb,
  revision bigint,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_shop app.shops%rowtype;
  v_workspace private.partner_workspaces%rowtype;
  v_snapshot private.partner_shop_fact_snapshots%rowtype;
begin
  if p_wp_shop_id <> 768 then
    raise exception using errcode = '22023', message = 'only the approved Mrs.Rank UP verification shop is supported';
  end if;
  if p_shop_slug is null or char_length(btrim(p_shop_slug)) not between 1 and 200
    or p_actor_label is null or char_length(btrim(p_actor_label)) not between 1 and 120
    or not private.is_partner_shop_fact_payload(p_facts) then
    raise exception using errcode = '22023', message = 'partner shop fact import payload is invalid';
  end if;

  select * into v_shop from app.shops where app.shops.wp_post_id = p_wp_shop_id for key share;
  if v_shop.id is null or v_shop.slug <> btrim(p_shop_slug) then
    raise exception using errcode = '22023', message = 'canonical app shop identity is required';
  end if;
  select * into v_workspace from private.partner_workspaces
    where private.partner_workspaces.wp_shop_id = p_wp_shop_id for key share;
  if v_workspace.id is null or v_workspace.shop_slug <> v_shop.slug
    or v_workspace.state not in ('free_official_partner', 'active_partner') then
    raise exception using errcode = '22023', message = 'active partner workspace is required';
  end if;

  insert into private.partner_shop_fact_snapshots (
    wp_shop_id, shop_slug, facts, imported_by, updated_by
  ) values (
    p_wp_shop_id, v_shop.slug, p_facts, btrim(p_actor_label), btrim(p_actor_label)
  ) on conflict on constraint partner_shop_fact_snapshots_pkey do nothing
  returning * into v_snapshot;

  if v_snapshot.wp_shop_id is null then
    select * into v_snapshot from private.partner_shop_fact_snapshots
      where private.partner_shop_fact_snapshots.wp_shop_id = p_wp_shop_id for key share;
    if v_snapshot.shop_slug <> v_shop.slug then
      raise exception using errcode = '22023', message = 'stored partner shop identity conflicts with canonical app shop';
    end if;
    return query select 'existing'::text, v_snapshot.wp_shop_id, v_snapshot.shop_slug,
      v_snapshot.facts, v_snapshot.revision, v_snapshot.updated_at;
    return;
  end if;

  insert into private.partner_shop_fact_audits (
    wp_shop_id, event_type, expected_revision, revision, before_facts, after_facts, actor_label
  ) values (
    v_snapshot.wp_shop_id, 'imported', null, v_snapshot.revision, null, v_snapshot.facts, btrim(p_actor_label)
  );
  return query select 'imported'::text, v_snapshot.wp_shop_id, v_snapshot.shop_slug,
    v_snapshot.facts, v_snapshot.revision, v_snapshot.updated_at;
end;
$$;
