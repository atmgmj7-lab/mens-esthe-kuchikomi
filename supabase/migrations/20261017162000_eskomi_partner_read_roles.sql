-- Read-only Partner surfaces are available to owners and managers. Creating
-- or changing a widget/link remains owner-only; a manager can reuse an
-- already prepared handle but cannot create one through a read request.
create or replace function private.assert_partner_v11_read_membership(
  p_workspace_id uuid,p_auth_user_id uuid
) returns uuid language plpgsql security definer set search_path=private,app,pg_temp as $$
declare v_shop uuid;
begin
  select workspace.app_shop_id into v_shop
  from private.partner_memberships membership
  join private.partner_workspaces workspace on workspace.id=membership.workspace_id
  join app.shops shop on shop.id=workspace.app_shop_id
  where membership.workspace_id=p_workspace_id and membership.auth_user_id=p_auth_user_id
    and membership.status='active' and membership.role in ('owner','manager')
    and workspace.state in ('free_official_partner','active_partner')
    and shop.publication_status='published'
  for update of membership,workspace,shop;
  if v_shop is null then raise exception 'partner membership is unavailable' using errcode='42501'; end if;
  return v_shop;
end $$;

create or replace function private.get_partner_review_widget_v11(p_workspace_id uuid,p_auth_user_id uuid)
returns table(public_handle uuid,state text,revision integer,shop_name text,canonical_path text)
language plpgsql security definer set search_path=private,app,pg_temp as $$
declare v_shop uuid; v_role text;
begin
  v_shop:=private.assert_partner_v11_read_membership(p_workspace_id,p_auth_user_id);
  select membership.role::text into v_role from private.partner_memberships membership
    where membership.workspace_id=p_workspace_id and membership.auth_user_id=p_auth_user_id and membership.status='active' for key share;
  if not exists(select 1 from private.review_widget_settings_v11 where workspace_id=p_workspace_id) and v_role='owner' then
    insert into private.review_widget_settings_v11(workspace_id,shop_id) values(p_workspace_id,v_shop) on conflict(workspace_id) do nothing;
  end if;
  return query select setting.public_handle,setting.state,setting.revision,shop.name,shop.canonical_path
    from private.review_widget_settings_v11 setting join app.shops shop on shop.id=setting.shop_id
    where setting.workspace_id=p_workspace_id and setting.shop_id=v_shop;
end $$;

create or replace function private.get_partner_canonical_growth_v11(
  p_workspace_id uuid,p_auth_user_id uuid
) returns table(workspace_id uuid,app_shop_id uuid,review_handle uuid,widget_handle uuid,shop_name text,canonical_path text,submitted_reviews bigint,pending_reviews bigint,published_reviews bigint)
language plpgsql security definer set search_path=private,app,pg_temp as $$
declare v_shop uuid; v_review_handle uuid; v_widget_handle uuid; v_role text;
begin
  v_shop:=private.assert_partner_canonical_membership(p_workspace_id,p_auth_user_id);
  select membership.role::text into v_role from private.partner_memberships membership
    where membership.workspace_id=p_workspace_id and membership.auth_user_id=p_auth_user_id and membership.status='active' for key share;
  if v_role='owner' then
    select link.public_handle into v_review_handle from private.create_partner_review_entry_link(p_workspace_id,null,'line') link;
  else
    select link.public_handle into v_review_handle
    from private.partner_review_entry_link_bindings binding
    join private.review_entry_links link on link.id=binding.link_id
    where binding.workspace_id=p_workspace_id and binding.therapist_assignment_id is null and binding.channel='line'
      and link.is_active and (link.expires_at is null or link.expires_at>now());
  end if;
  select widget.public_handle into v_widget_handle from private.get_partner_review_widget_v11(p_workspace_id,p_auth_user_id) widget;
  return query
    select p_workspace_id,v_shop,v_review_handle,v_widget_handle,shop.name,shop.canonical_path,
      (select count(*) from private.review_experiences experience where experience.shop_id=v_shop and experience.state<>'withdrawn'),
      (select count(*) from private.review_experiences experience where experience.shop_id=v_shop and experience.state in ('submitted','under_review')),
      (select count(*) from app.review_experience_publications publication where publication.shop_id=v_shop and publication.publication_state='published')
    from app.shops shop where shop.id=v_shop;
end $$;

revoke all on function private.assert_partner_v11_read_membership(uuid,uuid),private.get_partner_review_widget_v11(uuid,uuid),private.get_partner_canonical_growth_v11(uuid,uuid) from public,anon,authenticated;
grant execute on function private.assert_partner_v11_read_membership(uuid,uuid),private.get_partner_review_widget_v11(uuid,uuid),private.get_partner_canonical_growth_v11(uuid,uuid) to service_role;

notify pgrst,'reload schema';
