-- Dashboard provisioning must never reinterpret a Supabase directory_id as a
-- WordPress post id. Resolve a published managed shop by its stable slug and
-- delegate to the UUID workspace provisioner in the same database boundary.
create or replace function private.provision_partner_workspace_for_published_managed_shop(
  p_shop_slug text, p_source text default 'provisioning'
) returns table (workspace_id uuid, state text, initialized boolean)
language plpgsql security definer set search_path=private,app,pg_temp as $$
declare v_app_shop_id uuid;
begin
  if p_shop_slug !~ '^[a-z0-9][a-z0-9-]{1,118}[a-z0-9]$' then
    raise exception 'invalid canonical shop slug' using errcode='22023';
  end if;
  select managed.app_shop_id into v_app_shop_id
  from private.managed_shops managed
  join app.shops shop on shop.id=managed.app_shop_id
  where managed.shop_slug=p_shop_slug
    and managed.app_shop_id is not null
    and managed.publication_state='published'
    and shop.publication_status='published'
  for key share of managed,shop;
  if v_app_shop_id is null then return; end if;
  return query
    select * from private.provision_partner_workspace_for_app_shop(v_app_shop_id,p_source);
end $$;

create or replace function api.provision_partner_workspace_for_published_managed_shop(
  p_shop_slug text, p_source text default 'provisioning'
) returns table (workspace_id uuid, state text, initialized boolean)
language sql security invoker set search_path=private,api,pg_temp as $$
  select * from private.provision_partner_workspace_for_published_managed_shop(p_shop_slug,p_source)
$$;

revoke all on function private.provision_partner_workspace_for_published_managed_shop(text,text),api.provision_partner_workspace_for_published_managed_shop(text,text) from public,anon,authenticated;
grant execute on function private.provision_partner_workspace_for_published_managed_shop(text,text),api.provision_partner_workspace_for_published_managed_shop(text,text) to service_role;

notify pgrst,'reload schema';
