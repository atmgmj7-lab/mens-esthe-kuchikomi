-- Keep the original WordPress-shaped registration RPCs for existing stores,
-- while giving the canonical app_shop_id path an explicit v1.1 contract.
-- No browser role receives these service-only moderation endpoints.

create or replace function private.list_partner_registration_reviews_v11()
returns table (
  submission_id uuid,
  workspace_id uuid,
  status text,
  contact_name text,
  contact_role text,
  contact_email text,
  confirmation_details text,
  source_url text,
  created_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by text,
  review_reason text,
  workspace_state text,
  identity_kind text,
  app_shop_id uuid,
  wp_shop_id bigint,
  shop_slug text,
  shop_name text,
  canonical_url text,
  campaigns jsonb
)
language sql security invoker set search_path=private,app,pg_temp as $$
  select submission.id,submission.workspace_id,submission.status,submission.contact_name,submission.contact_role,
    submission.contact_email,submission.confirmation_details,submission.source_url,submission.created_at,
    submission.reviewed_at,submission.reviewed_by,submission.review_reason,workspace.state::text,
    case when workspace.app_shop_id is not null then 'canonical' else 'legacy' end,
    workspace.app_shop_id,workspace.wp_shop_id,
    coalesce(shop.slug,workspace.shop_slug),coalesce(shop.name,workspace.shop_name),
    case when shop.id is not null then 'https://mens-esthe-kuchikomi.com' || shop.canonical_path else workspace.canonical_url end,
    coalesce(jsonb_agg(jsonb_build_object('id',campaign.id,'channel',campaign.channel::text,'token',campaign.token,
      'isActive',campaign.is_active,'createdAt',campaign.created_at) order by campaign.channel)
      filter(where campaign.id is not null),'[]'::jsonb)
  from private.partner_registration_submissions submission
  join private.partner_workspaces workspace on workspace.id=submission.workspace_id
  left join app.shops shop on shop.id=workspace.app_shop_id
  left join private.partner_review_campaigns campaign on campaign.workspace_id=workspace.id
  group by submission.id,workspace.id,shop.id
  order by submission.created_at desc
$$;

create or replace function private.review_partner_registration_v11(
  p_submission_id uuid,p_decision text,p_actor_label text,p_reason text
)
returns table (
  state text,status text,workspace_id uuid,identity_kind text,app_shop_id uuid,wp_shop_id bigint,
  shop_slug text,canonical_url text
)
language plpgsql security invoker set search_path=private,app,pg_temp as $$
declare v_workspace private.partner_workspaces%rowtype;
begin
  select workspace.* into v_workspace
  from private.partner_registration_submissions submission
  join private.partner_workspaces workspace on workspace.id=submission.workspace_id
  where submission.id=p_submission_id
  for key share of workspace;
  if v_workspace.id is null then raise exception 'partner registration submission not found' using errcode='P0002'; end if;
  if v_workspace.app_shop_id is not null and not exists (
    select 1 from private.managed_shops managed join app.shops shop on shop.id=managed.app_shop_id
    where managed.app_shop_id=v_workspace.app_shop_id and managed.publication_state='published'
      and shop.publication_status='published' and managed.shop_slug=shop.slug
  ) then
    raise exception 'canonical partner registration has no published managed shop' using errcode='23514';
  end if;
  return query
    select reviewed.state,reviewed.status,workspace.id,
      case when workspace.app_shop_id is not null then 'canonical' else 'legacy' end,
      workspace.app_shop_id,workspace.wp_shop_id,coalesce(shop.slug,workspace.shop_slug),
      case when shop.id is not null then 'https://mens-esthe-kuchikomi.com' || shop.canonical_path else workspace.canonical_url end
    from private.review_partner_registration(p_submission_id,p_decision,p_actor_label,p_reason) reviewed
    join private.partner_registration_submissions submission on submission.id=p_submission_id
    join private.partner_workspaces workspace on workspace.id=submission.workspace_id
    left join app.shops shop on shop.id=workspace.app_shop_id;
end $$;

create or replace function api.list_partner_registration_reviews_v11()
returns table (
  submission_id uuid,workspace_id uuid,status text,contact_name text,contact_role text,contact_email text,
  confirmation_details text,source_url text,created_at timestamptz,reviewed_at timestamptz,reviewed_by text,
  review_reason text,workspace_state text,identity_kind text,app_shop_id uuid,wp_shop_id bigint,shop_slug text,
  shop_name text,canonical_url text,campaigns jsonb
)
language sql security invoker set search_path=private,api,pg_temp as $$
  select * from private.list_partner_registration_reviews_v11()
$$;

create or replace function api.review_partner_registration_v11(
  p_submission_id uuid,p_decision text,p_actor_label text,p_reason text
)
returns table (
  state text,status text,workspace_id uuid,identity_kind text,app_shop_id uuid,wp_shop_id bigint,
  shop_slug text,canonical_url text
)
language sql security invoker set search_path=private,api,pg_temp as $$
  select * from private.review_partner_registration_v11(p_submission_id,p_decision,p_actor_label,p_reason)
$$;

revoke all on function private.list_partner_registration_reviews_v11(),private.review_partner_registration_v11(uuid,text,text,text),api.list_partner_registration_reviews_v11(),api.review_partner_registration_v11(uuid,text,text,text) from public,anon,authenticated;
grant execute on function private.list_partner_registration_reviews_v11(),private.review_partner_registration_v11(uuid,text,text,text),api.list_partner_registration_reviews_v11(),api.review_partner_registration_v11(uuid,text,text,text) to service_role;

notify pgrst,'reload schema';
