create or replace function api.resolve_review_entry_link(p_entry_handle uuid)
returns table(entry_handle uuid,shop_slug text,shop_name text,therapist_display_name text)
language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.resolve_review_entry_link(p_entry_handle) $$;
notify pgrst,'reload schema';
