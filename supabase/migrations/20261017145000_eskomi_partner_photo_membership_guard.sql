create or replace function api.reserve_partner_therapist_photo_upload(p_workspace_id uuid,p_auth_user_id uuid,p_content_type text)
returns text language plpgsql security invoker set search_path=private,api,pg_temp as $$ begin perform private.assert_partner_therapist_membership(p_workspace_id,p_auth_user_id); return private.reserve_partner_therapist_photo_upload(p_workspace_id,p_content_type); end $$;
create or replace function api.attach_partner_therapist_photo(p_workspace_id uuid,p_auth_user_id uuid,p_object_key text,p_sha256 text,p_content_type text,p_byte_size integer,p_width integer,p_height integer)
returns uuid language plpgsql security invoker set search_path=private,api,pg_temp as $$ begin perform private.assert_partner_therapist_membership(p_workspace_id,p_auth_user_id); return private.attach_partner_therapist_photo(p_workspace_id,p_object_key,p_sha256,p_content_type,p_byte_size,p_width,p_height); end $$;
revoke all on function api.reserve_partner_therapist_photo_upload(uuid,uuid,text),api.attach_partner_therapist_photo(uuid,uuid,text,text,text,integer,integer,integer) from public,anon,authenticated;
grant execute on function api.reserve_partner_therapist_photo_upload(uuid,uuid,text),api.attach_partner_therapist_photo(uuid,uuid,text,text,text,integer,integer,integer) to service_role;
notify pgrst,'reload schema';
