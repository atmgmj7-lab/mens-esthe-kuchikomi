-- Local-only executable contract for the Supabase-native Review M1 migration.
-- All fixtures are rolled back. Production is never contacted.
begin;
set local role service_role;

do $$
declare
  v_wp_shop_id bigint := 8200000000000000000 + floor(random() * 1000000000)::bigint;
  v_shop_id uuid;
  v_review_id uuid;
  v_duplicate_id uuid;
  v_created boolean;
  v_before integer;
  v_after integer;
  v_event_id bigint;
  v_campaign_id uuid;
  v_campaign_token uuid;
  v_workspace_id uuid;
  v_recorded boolean;
  v_payload jsonb;
  v_body text;
  v_rating smallint;
  v_public_count bigint;
  v_rating_count bigint;
  v_average numeric;
  v_price_count bigint;
  v_price_average numeric;
  v_service_count bigint;
  v_service_average numeric;
  v_cleanliness_count bigint;
  v_cleanliness_average numeric;
  v_rls_count integer;
  v_forbidden_columns integer;
begin
  if to_regclass('private.review_submission_details') is null
    or to_regclass('private.review_idempotency_keys') is null
    or to_regclass('private.review_abuse_rate_limits') is null
    or to_regclass('private.review_moderation_events') is null
    or to_regprocedure('api.submit_review(bigint,text,smallint,text,text,text,text,timestamp with time zone,timestamp with time zone,smallint,smallint,smallint,text,text,text,uuid)') is null
    or to_regprocedure('api.moderate_review(uuid,text,text,text)') is null
    or to_regprocedure('api.list_published_reviews(bigint,integer,integer)') is null
    or to_regprocedure('api.get_published_review_metrics(bigint)') is null
    or to_regprocedure('api.record_partner_review_campaign_review(uuid,bigint,uuid)') is null then
    raise exception 'Review Native M1 migration is not applied';
  end if;

  if exists (
    select 1
    from (values
      ('rating_price'), ('rating_service'), ('rating_cleanliness'),
      ('visit_period'), ('revisit_intent'), ('reviewed_at'), ('published_at')
    ) as expected(column_name)
    where not exists (
      select 1 from information_schema.columns c
      where c.table_schema = 'app' and c.table_name = 'reviews'
        and c.column_name = expected.column_name
    )
  ) then
    raise exception 'app.reviews native columns are incomplete';
  end if;

  if (
    select column_default
    from information_schema.columns
    where table_schema = 'app' and table_name = 'reviews' and column_name = 'source_system'
  ) not like '%supabase%' then
    raise exception 'app.reviews source_system must default to supabase';
  end if;

  select count(*) into v_rls_count
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'private'
    and c.relname in (
      'review_submission_details',
      'review_idempotency_keys',
      'review_abuse_rate_limits',
      'review_moderation_events'
    )
    and c.relrowsecurity;
  if v_rls_count <> 4 then
    raise exception 'all private Review workflow tables must have RLS enabled';
  end if;

  if has_schema_privilege('anon', 'private', 'usage')
    or has_schema_privilege('authenticated', 'private', 'usage')
    or has_table_privilege('anon', 'app.reviews', 'select')
    or has_table_privilege('authenticated', 'app.reviews', 'select')
    or has_table_privilege('anon', 'api.published_reviews', 'select')
    or has_table_privilege('authenticated', 'api.published_reviews', 'select')
    or has_table_privilege('anon', 'private.review_submission_details', 'select,insert,update,delete')
    or has_table_privilege('authenticated', 'private.review_moderation_events', 'select,insert,update,delete') then
    raise exception 'browser roles must not access native Review data directly';
  end if;

  if has_function_privilege('anon', 'api.submit_review(bigint,text,smallint,text,text,text,text,timestamp with time zone,timestamp with time zone,smallint,smallint,smallint,text,text,text,uuid)', 'execute')
    or has_function_privilege('authenticated', 'api.submit_review(bigint,text,smallint,text,text,text,text,timestamp with time zone,timestamp with time zone,smallint,smallint,smallint,text,text,text,uuid)', 'execute')
    or has_function_privilege('anon', 'api.moderate_review(uuid,text,text,text)', 'execute')
    or has_function_privilege('authenticated', 'api.moderate_review(uuid,text,text,text)', 'execute')
    or has_function_privilege('anon', 'api.list_published_reviews(bigint,integer,integer)', 'execute')
    or has_function_privilege('authenticated', 'api.list_published_reviews(bigint,integer,integer)', 'execute')
    or has_function_privilege('anon', 'api.get_published_review_metrics(bigint)', 'execute')
    or has_function_privilege('authenticated', 'api.get_published_review_metrics(bigint)', 'execute')
    or has_function_privilege('anon', 'api.record_partner_review_campaign_review(uuid,bigint,uuid)', 'execute')
    or has_function_privilege('authenticated', 'api.record_partner_review_campaign_review(uuid,bigint,uuid)', 'execute') then
    raise exception 'browser roles must not execute native Review RPCs';
  end if;

  if not has_function_privilege('service_role', 'api.submit_review(bigint,text,smallint,text,text,text,text,timestamp with time zone,timestamp with time zone,smallint,smallint,smallint,text,text,text,uuid)', 'execute')
    or not has_function_privilege('service_role', 'api.moderate_review(uuid,text,text,text)', 'execute')
    or not has_function_privilege('service_role', 'api.list_published_reviews(bigint,integer,integer)', 'execute')
    or not has_function_privilege('service_role', 'api.get_published_review_metrics(bigint)', 'execute')
    or has_table_privilege('service_role', 'private.review_moderation_events', 'update,delete') then
    raise exception 'service-role Review privilege contract failed';
  end if;

  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('api', 'private')
      and p.proname in (
        'submit_review', 'moderate_review', 'list_published_reviews',
        'get_published_review_metrics', 'record_partner_review_campaign_review'
      )
      and p.prosecdef
  ) then
    raise exception 'native Review RPCs must remain security invoker';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'private' and table_name = 'partner_review_campaign_submissions'
      and column_name = 'review_id' and data_type = 'uuid' and is_nullable = 'YES'
  ) or exists (
    select 1 from information_schema.columns
    where table_schema = 'private' and table_name = 'partner_review_campaign_submissions'
      and column_name = 'wp_review_id' and is_nullable <> 'YES'
  ) then
    raise exception 'Growth UUID/legacy nullable columns are invalid';
  end if;

  if not exists (
    select 1 from pg_indexes
    where schemaname = 'private' and tablename = 'partner_review_campaign_submissions'
      and indexname = 'partner_review_campaign_submissions_review_id_uidx'
      and indexdef ilike '%where (review_id is not null)%'
  ) or not exists (
    select 1 from pg_indexes
    where schemaname = 'private' and tablename = 'partner_review_campaign_submissions'
      and indexname = 'partner_review_campaign_submissions_wp_review_id_uidx'
      and indexdef ilike '%where (wp_review_id is not null)%'
  ) then
    raise exception 'Growth partial unique indexes are missing';
  end if;
  if not exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'private'
      and t.relname = 'partner_review_campaign_submissions'
      and c.contype = 'f'
      and c.confrelid = 'app.reviews'::regclass
  ) then
    raise exception 'Growth review_id must reference app.reviews';
  end if;

  insert into app.shops (wp_post_id, slug, canonical_path, name)
  values (
    v_wp_shop_id,
    'review-native-' || v_wp_shop_id::text,
    '/shops/review-native-' || v_wp_shop_id::text || '/',
    'Review Native Contract Shop'
  ) returning id into v_shop_id;

  select review_id, created into v_review_id, v_created
  from api.submit_review(
    p_wp_shop_id => v_wp_shop_id,
    p_body => 'This is a valid native Review contract submission body.',
    p_rating => 5::smallint,
    p_nickname => 'Contract Reviewer',
    p_source_url => 'https://mens-esthe-kuchikomi.com/reviews/submit/',
    p_idempotency_key_hash => repeat('a', 64),
    p_abuse_key_hash => repeat('b', 64),
    p_abuse_window_started_at => date_trunc('minute', now()),
    p_abuse_window_expires_at => date_trunc('minute', now()) + interval '1 minute',
    p_rating_price => 4::smallint,
    p_rating_service => null::smallint,
    p_rating_cleanliness => 5::smallint,
    p_visit_period => '2026-09',
    p_revisit_intent => 'yes',
    p_email => 'contract@example.invalid',
    p_campaign_token => null::uuid
  );
  if not v_created or v_review_id is null then
    raise exception 'normal native Review submit must create a UUID row';
  end if;
  if (select source_system from app.reviews where id = v_review_id) <> 'supabase'
    or (select count(*) from private.review_submission_details where review_id = v_review_id) <> 1
    or (select count(*) from private.review_idempotency_keys where review_id = v_review_id) <> 1
    or (select count(*) from private.review_abuse_rate_limits where key_hash = repeat('b', 64)) <> 1 then
    raise exception 'normal native Review submit did not persist the complete transaction';
  end if;

  select review_id, created into v_duplicate_id, v_created
  from api.submit_review(
    v_wp_shop_id,
    'This is a valid native Review contract submission body.',
    5::smallint,
    'Contract Reviewer',
    'https://mens-esthe-kuchikomi.com/reviews/submit/',
    repeat('a', 64),
    repeat('b', 64),
    date_trunc('minute', now()),
    date_trunc('minute', now()) + interval '1 minute',
    4::smallint, null::smallint, 5::smallint, '2026-09', 'yes', 'contract@example.invalid', null::uuid
  );
  if v_created or v_duplicate_id <> v_review_id
    or (select count(*) from app.reviews where shop_id = v_shop_id) <> 1 then
    raise exception 'duplicate idempotency key must return the existing Review without duplication';
  end if;

  select count(*) into v_before from app.reviews where shop_id = v_shop_id;
  begin
    perform api.submit_review(
      v_wp_shop_id, 'Invalid rating must roll back the Review transaction.', 6::smallint,
      'Invalid Rating', 'https://mens-esthe-kuchikomi.com/reviews/submit/',
      repeat('c', 64), repeat('d', 64), now(), now() + interval '1 minute'
    );
    raise exception 'invalid rating unexpectedly succeeded';
  exception when check_violation then
    null;
  end;
  select count(*) into v_after from app.reviews where shop_id = v_shop_id;
  if v_after <> v_before or exists (
    select 1 from private.review_idempotency_keys where key_hash = repeat('c', 64)
  ) then
    raise exception 'invalid rating must leave no partial Review transaction';
  end if;

  begin
    perform api.submit_review(
      v_wp_shop_id, 'Invalid metric rating must roll back the Review transaction.', 4::smallint,
      'Invalid Metric', 'https://mens-esthe-kuchikomi.com/reviews/submit/',
      repeat('5', 64), repeat('6', 64), now(), now() + interval '1 minute',
      6::smallint
    );
    raise exception 'invalid metric rating unexpectedly succeeded';
  exception when check_violation then
    null;
  end;
  if (select count(*) from app.reviews where shop_id = v_shop_id) <> v_before
    or exists (select 1 from private.review_idempotency_keys where key_hash = repeat('5', 64)) then
    raise exception 'invalid metric rating must leave no partial Review transaction';
  end if;

  begin
    perform api.submit_review(
      v_wp_shop_id, 'Private detail failure must roll back this Review transaction.', 4::smallint,
      'Detail Failure', repeat('x', 2049),
      repeat('e', 64), repeat('f', 64), now(), now() + interval '1 minute'
    );
    raise exception 'invalid private detail unexpectedly succeeded';
  exception when check_violation then
    null;
  end;
  if (select count(*) from app.reviews where shop_id = v_shop_id) <> v_before
    or exists (select 1 from private.review_idempotency_keys where key_hash = repeat('e', 64)) then
    raise exception 'private detail failure must roll back Review and idempotency rows';
  end if;

  insert into private.partner_workspaces (
    wp_shop_id, shop_slug, shop_name, canonical_url, state
  ) values (
    v_wp_shop_id,
    'review-native-' || v_wp_shop_id::text,
    'Review Native Contract Shop',
    'https://mens-esthe-kuchikomi.com/shops/review-native-' || v_wp_shop_id::text || '/',
    'free_official_partner'
  ) returning id into v_workspace_id;
  insert into private.partner_review_campaigns (workspace_id, channel)
  values (v_workspace_id, 'counter_qr')
  returning id, token into v_campaign_id, v_campaign_token;

  begin
    insert into private.partner_review_campaign_submissions (campaign_id)
    values (v_campaign_id);
    raise exception 'attribution without either Review identifier unexpectedly succeeded';
  exception when check_violation then
    null;
  end;

  select review_id into v_duplicate_id
  from api.submit_review(
    v_wp_shop_id, 'Campaign-attributed native Review contract submission.', 4::smallint,
    'Campaign Reviewer', 'https://mens-esthe-kuchikomi.com/reviews/submit/',
    repeat('1', 64), repeat('2', 64), now(), now() + interval '1 minute',
    null::smallint, 5::smallint, 4::smallint, null, 'maybe', null, v_campaign_token
  );
  if not exists (
    select 1 from private.partner_review_campaign_submissions
    where campaign_id = v_campaign_id and review_id = v_duplicate_id and wp_review_id is null
  ) then
    raise exception 'native campaign attribution must store Review UUID only';
  end if;

  select count(*) into v_before from app.reviews where shop_id = v_shop_id;
  begin
    perform api.submit_review(
      v_wp_shop_id, 'Invalid campaign must roll back this Review transaction.', 4::smallint,
      'Campaign Failure', 'https://mens-esthe-kuchikomi.com/reviews/submit/',
      repeat('3', 64), repeat('4', 64), now(), now() + interval '1 minute',
      null::smallint, null::smallint, null::smallint, null, null, null, gen_random_uuid()
    );
    raise exception 'invalid campaign unexpectedly succeeded';
  exception when invalid_parameter_value then
    null;
  end;
  if (select count(*) from app.reviews where shop_id = v_shop_id) <> v_before
    or exists (select 1 from private.review_idempotency_keys where key_hash = repeat('3', 64)) then
    raise exception 'campaign failure must leave no partial Review transaction';
  end if;

  select api.record_partner_review_campaign_submission(
    v_campaign_token, v_wp_shop_id, v_wp_shop_id
  ) into v_recorded;
  if not v_recorded or not exists (
      select 1 from private.partner_review_campaign_submissions
      where campaign_id = v_campaign_id and wp_review_id = v_wp_shop_id and review_id is null
    ) then
    raise exception 'legacy WordPress attribution path must remain available: recorded %, rows %',
      v_recorded,
      (select count(*) from private.partner_review_campaign_submissions
       where campaign_id = v_campaign_id and wp_review_id = v_wp_shop_id and review_id is null);
  end if;

  select body, rating into v_body, v_rating from app.reviews where id = v_review_id;
  perform api.moderate_review(v_review_id, 'approved', 'contract-operator', 'approved contract fixture');
  if (select moderation_status from app.reviews where id = v_review_id) <> 'approved'
    or (select publication_status from app.reviews where id = v_review_id) <> 'published'
    or not (select is_public from app.reviews where id = v_review_id)
    or (select count(*) from private.review_moderation_events where review_id = v_review_id) <> 1
    or (select body from app.reviews where id = v_review_id) <> v_body
    or (select rating from app.reviews where id = v_review_id) <> v_rating then
    raise exception 'approve moderation must publish without mutating submitted content';
  end if;

  select count(*) into v_before from private.review_moderation_events where review_id = v_review_id;
  begin
    perform api.moderate_review(v_review_id, 'rejected', 'contract-operator', 'invalid second decision');
    raise exception 'invalid moderation transition unexpectedly succeeded';
  exception when invalid_parameter_value then
    null;
  end;
  if (select count(*) from private.review_moderation_events where review_id = v_review_id) <> v_before then
    raise exception 'invalid moderation transition must not append an audit event';
  end if;

  select id into v_event_id from private.review_moderation_events where review_id = v_review_id;
  begin
    update private.review_moderation_events set reason = 'mutated' where id = v_event_id;
    raise exception 'moderation audit update unexpectedly succeeded';
  exception when insufficient_privilege then
    null;
  end;
  begin
    delete from private.review_moderation_events where id = v_event_id;
    raise exception 'moderation audit delete unexpectedly succeeded';
  exception when insufficient_privilege then
    null;
  end;

  select to_jsonb(r) into v_payload
  from api.list_published_reviews(v_wp_shop_id, 20, 0) as r
  where r.review_id = v_review_id;
  if v_payload is null
    or v_payload ?| array[
      'nickname', 'author_name', 'email', 'actor', 'actor_label', 'reason',
      'campaign_token', 'workspace_id', 'abuse_key_hash'
    ] then
    raise exception 'published Review RPC must return a sanitized candidate';
  end if;

  select
    public_approved_review_count,
    valid_overall_rating_count,
    average_overall_rating,
    valid_price_rating_count,
    average_price_rating,
    valid_service_rating_count,
    average_service_rating,
    valid_cleanliness_rating_count,
    average_cleanliness_rating
  into
    v_public_count,
    v_rating_count,
    v_average,
    v_price_count,
    v_price_average,
    v_service_count,
    v_service_average,
    v_cleanliness_count,
    v_cleanliness_average
  from api.get_published_review_metrics(v_wp_shop_id);
  if v_public_count <> 1
    or v_rating_count <> 1 or v_average <> 5.0
    or v_price_count <> 1 or v_price_average <> 4.0
    or v_service_count <> 0 or v_service_average is not null
    or v_cleanliness_count <> 1 or v_cleanliness_average <> 5.0 then
    raise exception 'published Review metrics must derive from the same safe candidate set';
  end if;

  select count(*) into v_forbidden_columns
  from information_schema.columns
  where table_schema = 'private' and table_name = 'review_submission_details'
    and column_name in ('raw_ip', 'ip_address', 'campaign_token', 'workspace_id');
  if v_forbidden_columns <> 0 then
    raise exception 'private Review details must not store raw IP or campaign internals';
  end if;
end;
$$;

rollback;
