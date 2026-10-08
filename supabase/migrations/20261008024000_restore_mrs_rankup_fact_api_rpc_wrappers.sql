-- Restore the service-role-only API wrappers that are part of the approved
-- WP768 verification schema. The first production application stopped before
-- this trailing portion of the original migration, so private data exists but
-- the server-side REST RPC endpoints are absent. This adds no browser access.

create or replace function api.get_partner_shop_fact_snapshot(p_wp_shop_id bigint)
returns table (wp_shop_id bigint, shop_slug text, facts jsonb, revision bigint, updated_at timestamptz)
language sql
security invoker
set search_path = pg_catalog
as $$
  select * from private.get_partner_shop_fact_snapshot(p_wp_shop_id)
$$;

create or replace function api.import_partner_shop_fact_snapshot(
  p_wp_shop_id bigint, p_shop_slug text, p_facts jsonb, p_actor_label text
)
returns table (state text, wp_shop_id bigint, shop_slug text, facts jsonb, revision bigint, updated_at timestamptz)
language sql
security invoker
set search_path = pg_catalog
as $$
  select * from private.import_partner_shop_fact_snapshot(p_wp_shop_id, p_shop_slug, p_facts, p_actor_label)
$$;

create or replace function api.save_partner_shop_fact_snapshot(
  p_wp_shop_id bigint, p_expected_revision bigint, p_updates jsonb, p_actor_label text
)
returns table (state text, wp_shop_id bigint, shop_slug text, facts jsonb, revision bigint, updated_at timestamptz)
language sql
security invoker
set search_path = pg_catalog
as $$
  select * from private.save_partner_shop_fact_snapshot(p_wp_shop_id, p_expected_revision, p_updates, p_actor_label)
$$;

revoke all on function api.get_partner_shop_fact_snapshot(bigint) from public, anon, authenticated;
revoke all on function api.import_partner_shop_fact_snapshot(bigint, text, jsonb, text) from public, anon, authenticated;
revoke all on function api.save_partner_shop_fact_snapshot(bigint, bigint, jsonb, text) from public, anon, authenticated;

grant execute on function api.get_partner_shop_fact_snapshot(bigint) to service_role;
grant execute on function api.import_partner_shop_fact_snapshot(bigint, text, jsonb, text) to service_role;
grant execute on function api.save_partner_shop_fact_snapshot(bigint, bigint, jsonb, text) to service_role;
