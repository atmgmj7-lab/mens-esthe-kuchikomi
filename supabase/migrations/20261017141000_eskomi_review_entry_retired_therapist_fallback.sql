-- A permanent therapist link remains a permanent store invitation after that
-- assignment retires.  Do not 404 the whole store review flow or substitute a
-- different person; expose no therapist context instead.
create or replace function private.resolve_review_entry_link(p_entry_handle uuid)
returns table (entry_handle uuid, shop_slug text, shop_name text, therapist_display_name text)
language sql security definer set search_path = private, app, pg_temp as $$
  select
    link.public_handle,
    shop.slug,
    shop.name,
    assignment.display_name
  from private.review_entry_links as link
  join app.shops as shop on shop.id = link.shop_id and shop.publication_status = 'published'
  left join private.managed_shops as managed on managed.app_shop_id = shop.id
  left join app.therapist_assignments as assignment
    on assignment.id = link.therapist_assignment_id
    and assignment.shop_id = link.shop_id
    and assignment.lifecycle_state = 'active'
    and (assignment.active_until is null or assignment.active_until > now())
  where link.public_handle = p_entry_handle
    and link.is_active
    and (link.expires_at is null or link.expires_at > now())
    and (managed.id is null or managed.publication_state = 'published')
$$;

create or replace function api.resolve_review_entry_link(p_entry_handle uuid)
returns table (entry_handle uuid, shop_slug text, shop_name text, therapist_display_name text)
language sql security invoker set search_path = private, api, pg_temp as $$
  select * from private.resolve_review_entry_link(p_entry_handle)
$$;

revoke all on function private.resolve_review_entry_link(uuid), api.resolve_review_entry_link(uuid) from public, anon, authenticated;
grant execute on function private.resolve_review_entry_link(uuid), api.resolve_review_entry_link(uuid) to service_role;

notify pgrst, 'reload schema';
