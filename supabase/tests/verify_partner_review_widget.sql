-- Local-only Widget v1 contract. Fixtures roll back and expose no browser RPC.
begin;
set local role service_role;

do $$
declare
  v_shop_id bigint := 8200000000000000000 + floor(random() * 1000000000)::bigint;
  v_slug text := 'partner-widget-' || v_shop_id::text;
  v_workspace_id uuid;
  v_submission_id uuid;
  v_token uuid;
begin
  if to_regprocedure('api.get_partner_review_widget(uuid)') is null then
    raise exception 'Partner Widget migration is not applied';
  end if;
  if has_function_privilege('anon', 'api.get_partner_review_widget(uuid)', 'execute')
    or has_function_privilege('authenticated', 'api.get_partner_review_widget(uuid)', 'execute')
    or not has_function_privilege('service_role', 'api.get_partner_review_widget(uuid)', 'execute') then
    raise exception 'Widget eligibility RPC must remain service-role-only';
  end if;

  select workspace_id into v_workspace_id from api.provision_partner_workspace(
    v_shop_id, v_slug, 'Partner Widget Contract Shop',
    'https://mens-esthe-kuchikomi.com/shops/' || v_slug || '/', 'operator'
  );
  perform api.register_partner_submission(
    v_workspace_id, 'Widget Tester', 'owner', 'widget@example.invalid',
    'widget contract', 'https://mens-esthe-kuchikomi.com/partner/register/', true
  );
  select id into v_submission_id from private.partner_registration_submissions where workspace_id = v_workspace_id;
  perform api.review_partner_registration(v_submission_id, 'approved', 'contract operator', 'approved for widget');
  select token into v_token from private.partner_review_campaigns
    where workspace_id = v_workspace_id and channel = 'shop_website';
  if (select count(*) from api.get_partner_review_widget(v_token)) <> 1 then
    raise exception 'approved active shop_website campaign must resolve exactly one Widget projection';
  end if;
  if exists (
    select 1 from api.get_partner_review_widget(v_token)
    where review_url <> 'https://mens-esthe-kuchikomi.com/r/' || v_token::text || '/'
  ) then
    raise exception 'Widget CTA must use the canonical shop_website campaign URL';
  end if;
  update private.partner_review_campaigns set is_active = false, deactivated_at = now() where token = v_token;
  if (select count(*) from api.get_partner_review_widget(v_token)) <> 0 then
    raise exception 'inactive campaign must not produce a Widget';
  end if;
end;
$$;

rollback;
