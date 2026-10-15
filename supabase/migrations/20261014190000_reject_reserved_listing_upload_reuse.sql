-- A reservation represents one upload attempt.  Retrying after a storage failure
-- obtains a fresh short-lived capability through the application submission flow;
-- it must not make the same capability concurrently reusable.
create or replace function private.reserve_listing_application_upload(
  p_application_id uuid,
  p_token_hash text,
  p_content_type text
) returns text language plpgsql security definer set search_path = private, pg_temp as $$
declare v private.listing_application_upload_tokens%rowtype; v_extension text;
begin
  v_extension := case p_content_type when 'image/png' then 'png' when 'image/jpeg' then 'jpg' when 'image/webp' then 'webp' else null end;
  if v_extension is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid upload capability' using errcode='22023';
  end if;

  select * into v
    from private.listing_application_upload_tokens
   where application_id = p_application_id and token_hash = p_token_hash
   for update;
  if not found then
    raise exception 'upload capability rejected' using errcode='42501';
  end if;
  if v.expires_at <= now() then
    update private.listing_application_upload_tokens
       set state='expired'
     where id=v.id and state in ('issued','reserved');
    raise exception 'upload capability expired' using errcode='42501';
  end if;
  if v.state <> 'issued' then
    raise exception 'upload capability already used' using errcode='42501';
  end if;

  update private.listing_application_upload_tokens
     set state='reserved',
         reserved_at=now(),
         object_key=format('listing-applications/%s/%s.%s', p_application_id, object_id, v_extension)
   where id=v.id
   returning * into v;
  if v.object_key !~ ('^listing-applications/' || p_application_id::text || '/[0-9a-f-]+[.]' || v_extension || '$') then
    raise exception 'upload capability type mismatch' using errcode='22023';
  end if;
  return v.object_key;
end;
$$;

revoke all on function private.reserve_listing_application_upload(uuid,text,text) from public, anon, authenticated;
grant execute on function private.reserve_listing_application_upload(uuid,text,text) to service_role;
