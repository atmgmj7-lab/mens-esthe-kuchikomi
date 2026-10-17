-- Service-role read adapter for the registration-free v2 review page.
-- It returns only the public display context selected by an active QR/link;
-- internal Shop IDs, edit receipts, and all moderation material stay private.
create or replace function private.resolve_review_entry_link(p_entry_handle uuid)
returns table (
  entry_handle uuid,
  shop_slug text,
  shop_name text,
  therapist_display_name text
)
language sql security definer set search_path = private, app, pg_temp as $$
  select
    link.public_handle,
    shop.slug,
    shop.name,
    assignment.display_name
  from private.review_entry_links as link
  join app.shops as shop on shop.id = link.shop_id
  left join app.therapist_assignments as assignment
    on assignment.id = link.therapist_assignment_id
    and assignment.shop_id = link.shop_id
  where link.public_handle = p_entry_handle
    and link.is_active
    and (link.expires_at is null or link.expires_at > now())
    and (link.therapist_assignment_id is null or (
      assignment.lifecycle_state = 'active'
      and (assignment.active_until is null or assignment.active_until > now())
    ))
$$;

create or replace function api.resolve_review_entry_link(p_entry_handle uuid)
returns table (
  entry_handle uuid,
  shop_slug text,
  shop_name text,
  therapist_display_name text
)
language sql security invoker set search_path = private, api, pg_temp as $$
  select * from private.resolve_review_entry_link(p_entry_handle)
$$;

revoke all on function private.resolve_review_entry_link(uuid) from public, anon, authenticated;
revoke all on function api.resolve_review_entry_link(uuid) from public, anon, authenticated;
grant execute on function private.resolve_review_entry_link(uuid) to service_role;
grant execute on function api.resolve_review_entry_link(uuid) to service_role;

notify pgrst, 'reload schema';
