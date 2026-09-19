-- Local-only contract for the private Partner review-and-campaign transaction.
-- It is executed inside a transaction and rolls every fixture back.
begin;
set local role service_role;

do $$
declare
  v_shop_id bigint := 8100000000000000000 + floor(random() * 1000000000)::bigint;
  v_slug text;
  v_workspace_id uuid;
  v_submission_id uuid;
  v_state text;
  v_status text;
  v_history integer;
  v_campaigns integer;
  v_token uuid;
  v_opened integer;
  v_recorded boolean;
  v_event_columns integer;
begin
  if to_regclass('private.partner_review_campaigns') is null
    or to_regclass('private.partner_review_campaign_submissions') is null
    or to_regprocedure('api.review_partner_registration(uuid,text,text,text)') is null
    or to_regprocedure('api.list_partner_registration_reviews()') is null
    or to_regprocedure('api.open_partner_review_campaign(uuid)') is null
    or to_regprocedure('api.record_partner_review_campaign_submission(uuid,bigint,bigint)') is null then
    raise exception 'Partner review growth migration is not applied; run supabase start or supabase db reset for this project first';
  end if;

  if has_schema_privilege('anon', 'private', 'usage')
    or has_schema_privilege('authenticated', 'private', 'usage')
    or has_table_privilege('anon', 'private.partner_review_campaigns', 'select,insert,update,delete')
    or has_table_privilege('authenticated', 'private.partner_review_campaign_submissions', 'select,insert,update,delete') then
    raise exception 'browser roles must not access private partner review growth data';
  end if;
  if has_function_privilege('anon', 'api.review_partner_registration(uuid,text,text,text)', 'execute')
    or has_function_privilege('authenticated', 'api.review_partner_registration(uuid,text,text,text)', 'execute')
    or has_function_privilege('anon', 'api.list_partner_registration_reviews()', 'execute')
    or has_function_privilege('authenticated', 'api.list_partner_registration_reviews()', 'execute')
    or has_function_privilege('anon', 'api.open_partner_review_campaign(uuid)', 'execute')
    or has_function_privilege('authenticated', 'api.open_partner_review_campaign(uuid)', 'execute')
    or has_function_privilege('anon', 'api.record_partner_review_campaign_submission(uuid,bigint,bigint)', 'execute')
    or has_function_privilege('authenticated', 'api.record_partner_review_campaign_submission(uuid,bigint,bigint)', 'execute') then
    raise exception 'browser roles must not execute partner review growth RPC adapters';
  end if;

  v_slug := 'partner-growth-' || v_shop_id::text;
  select workspace_id into v_workspace_id
  from api.provision_partner_workspace(
    v_shop_id, v_slug, 'Partner Growth Contract Shop',
    'https://mens-esthe-kuchikomi.com/shops/' || v_slug || '/', 'operator'
  );
  perform api.register_partner_submission(
    v_workspace_id, 'Contract Tester', 'owner', 'contract@example.invalid',
    'review transaction contract', 'https://mens-esthe-kuchikomi.com/partner/register/', true
  );
  select id into v_submission_id from private.partner_registration_submissions where workspace_id = v_workspace_id;
  select count(*) into v_history from private.partner_state_history where workspace_id = v_workspace_id;

  begin
    perform api.review_partner_registration(v_submission_id, null, 'contract operator', 'null decision');
    raise exception 'null decision unexpectedly succeeded';
  exception when others then
    if sqlerrm <> 'invalid partner registration decision' then
      raise;
    end if;
  end;
  if (select state::text from private.partner_workspaces where id = v_workspace_id) <> 'shop_confirmed'
    or (select status from private.partner_registration_submissions where id = v_submission_id) <> 'received'
    or (select count(*) from private.partner_state_history where workspace_id = v_workspace_id) <> v_history
    or exists (select 1 from private.partner_review_campaigns where workspace_id = v_workspace_id) then
    raise exception 'null decision must reject without changes';
  end if;

  select state, status into v_state, v_status
  from api.review_partner_registration(v_submission_id, 'approved', 'contract operator', 'approved for contract');
  if v_state <> 'free_official_partner' or v_status <> 'approved' then
    raise exception 'approved review must activate workspace: state %, status %', v_state, v_status;
  end if;
  select count(*) into v_campaigns from private.partner_review_campaigns where workspace_id = v_workspace_id;
  if v_campaigns <> 4 or exists (
    select 1 from private.partner_review_campaigns where workspace_id = v_workspace_id
    group by channel having count(*) <> 1
  ) then
    raise exception 'approval must create four one-per-channel campaigns';
  end if;
  select count(*) into v_history from private.partner_state_history where workspace_id = v_workspace_id;
  perform api.review_partner_registration(v_submission_id, 'approved', 'contract operator', 'same-decision retry');
  if (select count(*) from private.partner_state_history where workspace_id = v_workspace_id) <> v_history
    or (select count(*) from private.partner_review_campaigns where workspace_id = v_workspace_id) <> 4 then
    raise exception 'same-decision retry must not add state history or campaigns';
  end if;

  insert into private.partner_registration_submissions (
    workspace_id, contact_name, contact_role, contact_email, confirmation_details, source_url, consent_terms
  ) values (
    v_workspace_id, 'Late Tester', 'staff', 'late@example.invalid',
    'must remain undecided after workspace activation', 'https://mens-esthe-kuchikomi.com/partner/register/', true
  ) returning id into v_submission_id;
  begin
    perform api.review_partner_registration(v_submission_id, 'rejected', 'contract operator', 'late rejection');
    raise exception 'non-shop_confirmed workspace decision unexpectedly succeeded';
  exception when others then
    if sqlerrm <> 'partner registration decision requires a shop_confirmed workspace' then
      raise;
    end if;
  end;
  if (select state::text from private.partner_workspaces where id = v_workspace_id) <> 'free_official_partner'
    or (select status from private.partner_registration_submissions where id = v_submission_id) <> 'received'
    or (select reviewed_at from private.partner_registration_submissions where id = v_submission_id) is not null
    or (select count(*) from private.partner_review_campaigns where workspace_id = v_workspace_id) <> 4 then
    raise exception 'non-shop_confirmed workspace must reject without changes';
  end if;

  select token into v_token from private.partner_review_campaigns where workspace_id = v_workspace_id order by channel limit 1;
  select count(*) into v_opened from api.open_partner_review_campaign(v_token);
  if v_opened <> 1 then
    raise exception 'active campaign resolution must return canonical shop data';
  end if;
  select api.record_partner_review_campaign_submission(v_token, v_shop_id, v_shop_id) into v_recorded;
  if not v_recorded then
    raise exception 'first WordPress review conversion must record';
  end if;
  select api.record_partner_review_campaign_submission(v_token, v_shop_id, v_shop_id) into v_recorded;
  if v_recorded or (select count(*) from private.partner_review_campaign_submissions where wp_review_id = v_shop_id) <> 1 then
    raise exception 'duplicate conversion must not be recorded';
  end if;
  update private.partner_review_campaigns
  set is_active = false, deactivated_at = now()
  where token = v_token;
  select count(*) into v_opened from api.open_partner_review_campaign(v_token);
  if v_opened <> 0 then
    raise exception 'inactive campaign resolution must be denied';
  end if;

  select count(*) into v_event_columns
  from information_schema.columns
  where table_schema = 'private' and table_name = 'partner_review_campaign_submissions'
    and column_name in ('contact_name', 'contact_email', 'confirmation_details', 'review_body', 'payload');
  if v_event_columns <> 0 then
    raise exception 'review conversion events must not store PII event payload';
  end if;

  -- A rejected registration never activates a workspace or creates campaigns.
  v_shop_id := v_shop_id - 1;
  v_slug := 'partner-growth-reject-' || v_shop_id::text;
  select workspace_id into v_workspace_id
  from api.provision_partner_workspace(
    v_shop_id, v_slug, 'Partner Reject Contract Shop',
    'https://mens-esthe-kuchikomi.com/shops/' || v_slug || '/', 'operator'
  );
  perform api.register_partner_submission(
    v_workspace_id, 'Reject Tester', 'manager', 'reject@example.invalid',
    'reject transaction contract', 'https://mens-esthe-kuchikomi.com/partner/register/', true
  );
  select id into v_submission_id from private.partner_registration_submissions where workspace_id = v_workspace_id;
  select state, status into v_state, v_status
  from api.review_partner_registration(v_submission_id, 'rejected', 'contract operator', 'not approved');
  if v_state <> 'shop_confirmed' or v_status <> 'rejected'
    or exists (select 1 from private.partner_review_campaigns where workspace_id = v_workspace_id) then
    raise exception 'rejection must not activate workspace or create campaigns';
  end if;
end;
$$;

rollback;
