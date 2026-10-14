-- PostgREST exposes only the api schema.  Keep private relations unexposed and
-- cross the boundary through narrow service-role-only API functions.
create or replace function api.issue_listing_application_upload_token(
  p_application_id uuid, p_token_hash text, p_object_id uuid, p_expires_at timestamptz
) returns void language sql security invoker set search_path=private,pg_temp as $$
  select private.issue_listing_application_upload_token(p_application_id,p_token_hash,p_object_id,p_expires_at)
$$;

create or replace function api.reserve_listing_application_upload(
  p_application_id uuid, p_token_hash text, p_content_type text
) returns text language sql security invoker set search_path=private,pg_temp as $$
  select private.reserve_listing_application_upload(p_application_id,p_token_hash,p_content_type)
$$;

create or replace function api.review_listing_application(
  p_application_id uuid, p_expected_revision integer, p_decision text, p_reviewer_label text, p_note text
) returns text language sql security invoker set search_path=private,pg_temp as $$
  select private.review_listing_application(p_application_id,p_expected_revision,p_decision,p_reviewer_label,p_note)
$$;

create or replace function api.get_listing_application_operator_list()
returns jsonb language sql security definer set search_path=private,pg_temp as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',a.id,'kind',a.kind,'existing_wp_shop_id',a.existing_wp_shop_id,'existing_shop_slug',a.existing_shop_slug,
    'shop_name',a.shop_name,'area',a.area,'website_url',a.website_url,'state',a.state,'revision',a.revision,
    'contact_name',a.contact_name,'contact_email',a.contact_email,'contact_role',a.contact_role,
    'edit_preference',a.edit_preference,'banner_asset_id',a.banner_asset_id,'created_at',a.created_at,'updated_at',a.updated_at
  ) order by a.updated_at desc), '[]'::jsonb)
  from (select * from private.listing_applications order by updated_at desc limit 100) a
$$;

create or replace function api.get_listing_application_operator_detail(p_application_id uuid)
returns jsonb language plpgsql security definer set search_path=private,pg_temp as $$
declare v private.listing_applications%rowtype;
begin
  select * into v from private.listing_applications where id=p_application_id;
  if not found then return null; end if;
  return jsonb_build_object(
    'application', to_jsonb(v),
    'revisions', coalesce((select jsonb_agg(jsonb_build_object('revision',r.revision,'public_payload',r.public_payload,'created_at',r.created_at) order by r.revision desc) from private.listing_application_revisions r where r.application_id=v.id), '[]'::jsonb),
    'reviews', coalesce((select jsonb_agg(jsonb_build_object('expected_revision',q.expected_revision,'decision',q.decision,'reviewer_label',q.reviewer_label,'note',q.note,'created_at',q.created_at) order by q.created_at desc) from private.listing_application_reviews q where q.application_id=v.id), '[]'::jsonb),
    'assets', coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'content_type',s.content_type,'byte_size',s.byte_size,'width',s.width,'height',s.height,'created_at',s.created_at) order by s.created_at desc) from private.listing_application_assets s where s.application_id=v.id), '[]'::jsonb)
  );
end;
$$;

create or replace function api.get_public_listing_banner(p_application_id uuid)
returns table(object_key text, content_type text) language sql security definer set search_path=private,pg_temp as $$
  select a.object_key,a.content_type
  from private.listing_public_projections p
  join private.listing_application_assets a on a.id=p.banner_asset_id
  where p.application_id=p_application_id and p.banner_asset_id is not null
  limit 1
$$;

revoke all on function api.issue_listing_application_upload_token(uuid,text,uuid,timestamptz) from public,anon,authenticated;
revoke all on function api.reserve_listing_application_upload(uuid,text,text) from public,anon,authenticated;
revoke all on function api.review_listing_application(uuid,integer,text,text,text) from public,anon,authenticated;
revoke all on function api.get_listing_application_operator_list() from public,anon,authenticated;
revoke all on function api.get_listing_application_operator_detail(uuid) from public,anon,authenticated;
revoke all on function api.get_public_listing_banner(uuid) from public,anon,authenticated;
grant execute on function api.issue_listing_application_upload_token(uuid,text,uuid,timestamptz) to service_role;
grant execute on function api.reserve_listing_application_upload(uuid,text,text) to service_role;
grant execute on function api.review_listing_application(uuid,integer,text,text,text) to service_role;
grant execute on function api.get_listing_application_operator_list() to service_role;
grant execute on function api.get_listing_application_operator_detail(uuid) to service_role;
grant execute on function api.get_public_listing_banner(uuid) to service_role;
