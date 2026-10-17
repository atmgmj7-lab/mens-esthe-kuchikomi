-- Public therapist identities are assignments, never a display-name lookup.
create function private.get_public_therapist_profile_v11(p_assignment_id uuid,p_limit integer default 20)
returns table(assignment_id uuid,display_name text,shop_slug text,shop_name text,shop_path text,photo_asset_id uuid,review_handle uuid,rating smallint,body text,published_at timestamptz) language sql security definer set search_path=private,app,pg_temp as $$
 select assignment.id,assignment.display_name,shop.slug,shop.name,shop.canonical_path,asset.id,publication.public_handle,assessment.rating,revision.experience_comment,publication.published_at
 from app.therapist_assignments assignment
 join app.shops shop on shop.id=assignment.shop_id and shop.publication_status='published'
 join private.managed_shops managed on managed.app_shop_id=shop.id and managed.publication_state='published'
 join private.therapist_assignment_rights rights on rights.assignment_id=assignment.id
 join private.therapist_assets asset on asset.workspace_id=rights.workspace_id and asset.object_key=assignment.photo_asset_key
 left join app.review_experience_publications publication on publication.therapist_assignment_id=assignment.id and publication.publication_state='published'
 left join private.review_experience_revisions revision on revision.id=publication.active_revision_id and revision.moderation_state='approved'
 left join private.review_assessments assessment on assessment.experience_id=publication.experience_id and assessment.target_kind='therapist' and assessment.therapist_assignment_id=assignment.id
 where assignment.id=p_assignment_id and assignment.lifecycle_state='active' and assignment.photo_rights_confirmed_at is not null
 order by publication.published_at desc nulls last,publication.id desc nulls last limit greatest(1,least(p_limit,20))
$$;
create function private.get_public_therapist_photo_v11(p_assignment_id uuid)
returns table(object_key text,content_type text) language sql security definer set search_path=private,app,pg_temp as $$
 select asset.object_key,asset.content_type from app.therapist_assignments assignment join app.shops shop on shop.id=assignment.shop_id and shop.publication_status='published' join private.managed_shops managed on managed.app_shop_id=shop.id and managed.publication_state='published' join private.therapist_assignment_rights rights on rights.assignment_id=assignment.id join private.therapist_assets asset on asset.workspace_id=rights.workspace_id and asset.object_key=assignment.photo_asset_key where assignment.id=p_assignment_id and assignment.lifecycle_state='active' and assignment.photo_rights_confirmed_at is not null
$$;
create function api.get_public_therapist_profile_v11(p_assignment_id uuid,p_limit integer default 20) returns table(assignment_id uuid,display_name text,shop_slug text,shop_name text,shop_path text,photo_asset_id uuid,review_handle uuid,rating smallint,body text,published_at timestamptz) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.get_public_therapist_profile_v11(p_assignment_id,p_limit) $$;
create function api.get_public_therapist_photo_v11(p_assignment_id uuid) returns table(object_key text,content_type text) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.get_public_therapist_photo_v11(p_assignment_id) $$;
revoke all on function api.get_public_therapist_profile_v11(uuid,integer),api.get_public_therapist_photo_v11(uuid),private.get_public_therapist_profile_v11(uuid,integer),private.get_public_therapist_photo_v11(uuid) from public,anon,authenticated;
grant execute on function api.get_public_therapist_profile_v11(uuid,integer),api.get_public_therapist_photo_v11(uuid),private.get_public_therapist_profile_v11(uuid,integer),private.get_public_therapist_photo_v11(uuid) to service_role;
notify pgrst,'reload schema';
