-- Qualify the target revision in the security-definer function.  Its RETURNS
-- TABLE column is also named revision, so the unqualified form is ambiguous.
create or replace function private.save_partner_shop_fact_snapshot(
  p_wp_shop_id bigint,
  p_expected_revision bigint,
  p_updates jsonb,
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
  v_snapshot private.partner_shop_fact_snapshots%rowtype;
  v_before jsonb;
  v_after jsonb;
  v_now timestamptz := now();
begin
  if p_wp_shop_id <> 768 or p_expected_revision is null or p_expected_revision < 1
    or p_actor_label is null or char_length(btrim(p_actor_label)) not between 1 and 120
    or not private.is_partner_shop_fact_update(p_updates) then
    raise exception using errcode = '22023', message = 'partner shop fact save payload is invalid';
  end if;

  select * into v_snapshot from private.partner_shop_fact_snapshots
  where private.partner_shop_fact_snapshots.wp_shop_id = p_wp_shop_id for update;
  if v_snapshot.wp_shop_id is null then
    raise exception using errcode = '22023', message = 'partner shop fact snapshot has not been imported';
  end if;
  if v_snapshot.revision <> p_expected_revision then
    return query select 'conflict'::text, v_snapshot.wp_shop_id, v_snapshot.shop_slug,
      v_snapshot.facts, v_snapshot.revision, v_snapshot.updated_at;
    return;
  end if;
  v_before := v_snapshot.facts;
  v_after := v_before || p_updates;
  if v_after = v_before then
    return query select 'noop'::text, v_snapshot.wp_shop_id, v_snapshot.shop_slug,
      v_snapshot.facts, v_snapshot.revision, v_snapshot.updated_at;
    return;
  end if;
  if not private.is_partner_shop_fact_payload(v_after) then
    raise exception using errcode = '22023', message = 'partner shop fact result is invalid';
  end if;

  update private.partner_shop_fact_snapshots
  set facts = v_after,
      revision = private.partner_shop_fact_snapshots.revision + 1,
      updated_at = v_now,
      updated_by = btrim(p_actor_label)
  where private.partner_shop_fact_snapshots.wp_shop_id = p_wp_shop_id
  returning * into v_snapshot;
  insert into private.partner_shop_fact_audits (
    wp_shop_id, event_type, expected_revision, revision, before_facts, after_facts, actor_label
  ) values (
    v_snapshot.wp_shop_id, 'saved', p_expected_revision, v_snapshot.revision,
    v_before, v_snapshot.facts, btrim(p_actor_label)
  );
  return query select 'saved'::text, v_snapshot.wp_shop_id, v_snapshot.shop_slug,
    v_snapshot.facts, v_snapshot.revision, v_snapshot.updated_at;
end;
$$;
