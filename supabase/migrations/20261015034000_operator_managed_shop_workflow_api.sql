-- API-schema wrappers for the operator server. These preserve private-table
-- isolation while allowing the server's service-role client to invoke the
-- already validated workflow functions through PostgREST.
create or replace function api.import_managed_shop_from_legacy(p_wp_shop_id bigint,p_shop_slug text,p_payload jsonb,p_actor_label text)
returns uuid language sql security invoker set search_path=private,pg_temp as $$
  select private.import_managed_shop_from_legacy(p_wp_shop_id,p_shop_slug,p_payload,p_actor_label)
$$;

create or replace function api.create_managed_shop(p_shop_slug text,p_payload jsonb,p_actor_label text)
returns uuid language sql security invoker set search_path=private,pg_temp as $$
  select private.create_managed_shop(p_shop_slug,p_payload,p_actor_label)
$$;

create or replace function api.save_managed_shop_draft(p_managed_shop_id uuid,p_expected_revision integer,p_payload jsonb,p_actor_label text)
returns text language sql security invoker set search_path=private,pg_temp as $$
  select private.save_managed_shop_draft(p_managed_shop_id,p_expected_revision,p_payload,p_actor_label)
$$;

create or replace function api.submit_managed_shop_revision(p_managed_shop_id uuid,p_expected_revision integer,p_actor_label text)
returns text language sql security invoker set search_path=private,pg_temp as $$
  select private.submit_managed_shop_revision(p_managed_shop_id,p_expected_revision,p_actor_label)
$$;

create or replace function api.review_managed_shop_revision(p_managed_shop_id uuid,p_expected_revision integer,p_decision text,p_reviewer_label text,p_note text default null)
returns text language sql security invoker set search_path=private,pg_temp as $$
  select private.review_managed_shop_revision(p_managed_shop_id,p_expected_revision,p_decision,p_reviewer_label,p_note)
$$;

revoke all on function api.import_managed_shop_from_legacy(bigint,text,jsonb,text) from public,anon,authenticated;
revoke all on function api.create_managed_shop(text,jsonb,text) from public,anon,authenticated;
revoke all on function api.save_managed_shop_draft(uuid,integer,jsonb,text) from public,anon,authenticated;
revoke all on function api.submit_managed_shop_revision(uuid,integer,text) from public,anon,authenticated;
revoke all on function api.review_managed_shop_revision(uuid,integer,text,text,text) from public,anon,authenticated;
grant execute on function api.import_managed_shop_from_legacy(bigint,text,jsonb,text) to service_role;
grant execute on function api.create_managed_shop(text,jsonb,text) to service_role;
grant execute on function api.save_managed_shop_draft(uuid,integer,jsonb,text) to service_role;
grant execute on function api.submit_managed_shop_revision(uuid,integer,text) to service_role;
grant execute on function api.review_managed_shop_revision(uuid,integer,text,text,text) to service_role;

notify pgrst, 'reload schema';
