-- Public widget eligibility is resolved only through the server-side adapter.
-- It returns neither Partner-private state nor review body/identity data.
create or replace function private.get_partner_review_widget(p_token uuid)
returns table (
  wp_shop_id bigint,
  shop_slug text,
  shop_name text,
  canonical_url text,
  review_url text
)
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select
    w.wp_shop_id,
    w.shop_slug,
    w.shop_name,
    w.canonical_url,
    format('https://mens-esthe-kuchikomi.com/r/%s/', c.token::text)
  from private.partner_review_campaigns c
  join private.partner_workspaces w on w.id = c.workspace_id
  where c.token = p_token
    and c.channel = 'shop_website'::private.partner_review_campaign_channel
    and c.is_active
    and w.state in ('free_official_partner'::private.partner_workspace_state, 'active_partner'::private.partner_workspace_state)
$$;

revoke all on function private.get_partner_review_widget(uuid) from public, anon, authenticated;
grant execute on function private.get_partner_review_widget(uuid) to service_role;

create or replace function api.get_partner_review_widget(p_token uuid)
returns table (
  wp_shop_id bigint,
  shop_slug text,
  shop_name text,
  canonical_url text,
  review_url text
)
language sql
stable
security invoker
set search_path = pg_catalog
as $$
  select * from private.get_partner_review_widget(p_token)
$$;

revoke all on function api.get_partner_review_widget(uuid) from public, anon, authenticated;
grant execute on function api.get_partner_review_widget(uuid) to service_role;
