-- An already-approved legacy shop can be unlisted without deleting its
-- publication audit trail. The server reads only this identity pair to remove
-- the matching WordPress row from public composition.
create or replace function api.list_unlisted_managed_shop_legacy_identities()
returns table(existing_wp_shop_id bigint,shop_slug text) language sql security invoker set search_path=private,pg_temp as $$
  select s.existing_wp_shop_id,s.shop_slug
  from private.managed_shops s
  join private.managed_shop_publications p on p.managed_shop_id=s.id
  where s.publication_state='unlisted' and s.existing_wp_shop_id is not null
$$;

revoke all on function api.list_unlisted_managed_shop_legacy_identities() from public,anon,authenticated;
grant execute on function api.list_unlisted_managed_shop_legacy_identities() to service_role;

notify pgrst, 'reload schema';
