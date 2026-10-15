create or replace function private.submit_listing_application(p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = private, pg_temp
as $$
declare
  v_id uuid;
begin
  if p_payload is null
    or jsonb_typeof(p_payload) <> 'object'
    or not (p_payload ?& array['idempotency_key','kind','shop_name','area','website_url','contact_name','contact_email','contact_role','edit_preference','consent_privacy','consent_accuracy','consent_image_rights']) then
    raise exception 'invalid listing application payload' using errcode = '22023';
  end if;
  insert into private.listing_applications (
    idempotency_key, kind, existing_wp_shop_id, existing_shop_slug, shop_name, area, website_url, introduction,
    contact_name, contact_email, contact_role, edit_preference, consent_privacy, consent_accuracy, consent_image_rights
  ) values (
    (p_payload->>'idempotency_key')::uuid,
    (p_payload->>'kind')::private.listing_application_kind,
    nullif(p_payload->>'existing_wp_shop_id','')::bigint,
    nullif(p_payload->>'existing_shop_slug',''),
    p_payload->>'shop_name', p_payload->>'area', p_payload->>'website_url', nullif(p_payload->>'introduction',''),
    p_payload->>'contact_name', p_payload->>'contact_email', p_payload->>'contact_role', (p_payload->>'edit_preference')::private.listing_edit_preference,
    (p_payload->>'consent_privacy')::boolean, (p_payload->>'consent_accuracy')::boolean, (p_payload->>'consent_image_rights')::boolean
  ) on conflict (idempotency_key) do update set updated_at = private.listing_applications.updated_at
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function private.submit_listing_application(jsonb) from public, anon, authenticated;
grant execute on function private.submit_listing_application(jsonb) to service_role;

create or replace function api.submit_listing_application(p_payload jsonb)
returns uuid language sql security invoker set search_path = private, pg_temp as $$
  select private.submit_listing_application(p_payload)
$$;
revoke all on function api.submit_listing_application(jsonb) from public, anon, authenticated;
grant execute on function api.submit_listing_application(jsonb) to service_role;
