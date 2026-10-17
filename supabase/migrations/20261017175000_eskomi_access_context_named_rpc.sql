-- PostgREST resolves JSON RPC bodies by argument name.  Keep the public
-- wrapper's names explicit; the prior positional signature silently rejected
-- the analytics context route's p_* JSON body.
drop function api.reserve_public_shop_access_context_v11(text,text,text,boolean);
create function api.reserve_public_shop_access_context_v11(
  p_shop_slug text,
  p_session_scope_hash text,
  p_network_scope_hash text,
  p_is_new_session boolean
) returns void language sql security invoker set search_path=private,api,pg_temp as $$
  select private.reserve_public_shop_access_context_v11(p_shop_slug,p_session_scope_hash,p_network_scope_hash,p_is_new_session)
$$;
revoke all on function api.reserve_public_shop_access_context_v11(text,text,text,boolean) from public,anon,authenticated;
grant execute on function api.reserve_public_shop_access_context_v11(text,text,text,boolean) to service_role;
notify pgrst,'reload schema';
