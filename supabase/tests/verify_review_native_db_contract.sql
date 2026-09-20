-- Local-only executable contract for the Supabase-native Review M1 migration.
-- All fixtures are rolled back. Production is never contacted.
begin;

do $$
declare
  v_wp_shop_id bigint := 8200000000000000000 + floor(random() * 1000000000)::bigint;
  v_other_wp_shop_id bigint;
  v_shop_id uuid;
  v_other_shop_id uuid;
  v_review_id uuid;
  v_duplicate_id uuid;
  v_created boolean;
  v_before integer;
  v_after integer;
  v_campaign_id uuid;
  v_campaign_token uuid;
  v_workspace_id uuid;
  v_other_workspace_id uuid;
  v_other_campaign_id uuid;
  v_other_campaign_token uuid;
  v_other_campaign_before jsonb;
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
  v_request_fingerprint text;
  v_abuse_count integer;
  v_rate_allowed boolean;
  v_retry_after integer;
  v_mismatch record;
begin
  v_other_wp_shop_id := v_wp_shop_id + 1;
  if to_regclass('private.review_submission_details') is null
    or to_regclass('private.review_idempotency_keys') is null
    or to_regclass('private.review_abuse_rate_limits') is null
    or to_regclass('private.review_moderation_events') is null
    or to_regprocedure('api.claim_review_submission_rate_limit(text,text,timestamp with time zone,timestamp with time zone,integer)') is null
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

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'private' and table_name = 'review_idempotency_keys'
      and column_name = 'request_fingerprint' and data_type = 'text' and is_nullable = 'NO'
  ) or exists (
    select 1 from information_schema.columns
    where table_schema = 'private' and table_name = 'review_idempotency_keys'
      and column_name = 'expires_at'
  ) or exists (
    select 1 from pg_indexes
    where schemaname = 'private' and tablename = 'review_idempotency_keys'
      and indexname = 'review_idempotency_keys_expiry_idx'
  ) then
    raise exception 'idempotency keys must store a permanent request fingerprint without expiry state';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'private' and table_name = 'review_abuse_rate_limits'
      and column_name = 'claimed_idempotency_key_hashes'
      and data_type = 'ARRAY' and is_nullable = 'NO'
  ) then
    raise exception 'Review rate-limit claims must deduplicate idempotent retries';
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
    or has_function_privilege('authenticated', 'api.record_partner_review_campaign_review(uuid,bigint,uuid)', 'execute')
    or has_function_privilege('anon', 'api.record_partner_review_campaign_submission(uuid,bigint,bigint)', 'execute')
    or has_function_privilege('authenticated', 'api.record_partner_review_campaign_submission(uuid,bigint,bigint)', 'execute') then
    raise exception 'browser roles must not execute native Review RPCs';
  end if;
  if has_function_privilege('anon', 'api.claim_review_submission_rate_limit(text,text,timestamp with time zone,timestamp with time zone,integer)', 'execute')
    or has_function_privilege('authenticated', 'api.claim_review_submission_rate_limit(text,text,timestamp with time zone,timestamp with time zone,integer)', 'execute') then
    raise exception 'browser roles must not execute Review rate-limit claims';
  end if;

  if not has_function_privilege('service_role', 'api.submit_review(bigint,text,smallint,text,text,text,text,timestamp with time zone,timestamp with time zone,smallint,smallint,smallint,text,text,text,uuid)', 'execute')
    or not has_function_privilege('service_role', 'api.claim_review_submission_rate_limit(text,text,timestamp with time zone,timestamp with time zone,integer)', 'execute')
    or not has_function_privilege('service_role', 'api.moderate_review(uuid,text,text,text)', 'execute')
    or not has_function_privilege('service_role', 'api.list_published_reviews(bigint,integer,integer)', 'execute')
    or not has_function_privilege('service_role', 'api.get_published_review_metrics(bigint)', 'execute')
    or not has_function_privilege('service_role', 'api.record_partner_review_campaign_review(uuid,bigint,uuid)', 'execute')
    or not has_function_privilege('service_role', 'api.record_partner_review_campaign_submission(uuid,bigint,bigint)', 'execute')
    or has_table_privilege('service_role', 'app.reviews', 'select,insert,update,delete,truncate,references,trigger')
    or has_table_privilege('service_role', 'private.review_submission_details', 'select,insert,update,delete,truncate,references,trigger')
    or has_table_privilege('service_role', 'private.review_idempotency_keys', 'select,insert,update,delete,truncate,references,trigger')
    or has_table_privilege('service_role', 'private.review_abuse_rate_limits', 'select,insert,update,delete,truncate,references,trigger')
    or has_table_privilege('service_role', 'private.review_moderation_events', 'select,insert,update,delete,truncate,references,trigger')
    or has_sequence_privilege('service_role', 'private.review_moderation_events_id_seq', 'usage,select,update')
    or has_table_privilege('service_role', 'private.partner_review_campaign_submissions', 'insert,update,delete,truncate,references,trigger') then
    raise exception 'service-role Review tables must be RPC-only for mutation and private Review reads';
  end if;

  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.proname in (
        'submit_review', 'moderate_review', 'list_published_reviews',
        'get_published_review_metrics', 'record_partner_review_campaign_review',
        'record_partner_review_campaign_submission', 'claim_review_submission_rate_limit'
      )
      and (
        not p.prosecdef
        or p.proconfig is distinct from array['search_path=pg_catalog']::text[]
        or pg_get_userbyid(p.proowner) in ('anon', 'authenticated', 'service_role')
        or p.prosrc ~* '(^|[^[:alnum:]_])execute[[:space:]]'
        or p.prosrc ~* '(^|[^[:alnum:]_])(format|quote_ident|quote_literal)[[:space:]]*\('
      )
  ) then
    raise exception 'private Review mutation/read functions must be hardened security definers';
  end if;
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'api'
      and p.proname in (
        'submit_review', 'moderate_review', 'list_published_reviews',
        'get_published_review_metrics', 'record_partner_review_campaign_review',
        'record_partner_review_campaign_submission', 'claim_review_submission_rate_limit'
      )
      and (
        p.prosecdef
        or p.proconfig is distinct from array['search_path=pg_catalog']::text[]
      )
  ) then
    raise exception 'api Review adapters must remain fixed-path security invokers';
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
  ) or not exists (
    select 1 from pg_indexes
    where schemaname = 'private' and tablename = 'partner_review_campaign_submissions'
      and indexname = 'partner_review_campaign_submissions_campaign_id_idx'
      and indexdef ilike '%(campaign_id)%'
  ) then
    raise exception 'Growth attribution indexes are missing';
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

  select allowed, retry_after_seconds into v_rate_allowed, v_retry_after
  from api.claim_review_submission_rate_limit(
    repeat('9', 64), repeat('8', 64), date_trunc('minute', now()),
    date_trunc('minute', now()) + interval '10 minutes', 3
  );
  if not v_rate_allowed or v_retry_after <= 0 then
    raise exception 'first distributed Review rate-limit claim must be allowed';
  end if;
  select allowed into v_rate_allowed from api.claim_review_submission_rate_limit(
    repeat('9', 64), repeat('8', 64), date_trunc('minute', now()),
    date_trunc('minute', now()) + interval '10 minutes', 3
  );
  if not v_rate_allowed then
    raise exception 'same idempotency key retry must not consume another rate-limit slot';
  end if;
  perform api.claim_review_submission_rate_limit(
    repeat('7', 64), repeat('8', 64), date_trunc('minute', now()),
    date_trunc('minute', now()) + interval '10 minutes', 3
  );
  perform api.claim_review_submission_rate_limit(
    repeat('6', 64), repeat('8', 64), date_trunc('minute', now()),
    date_trunc('minute', now()) + interval '10 minutes', 3
  );
  select allowed into v_rate_allowed from api.claim_review_submission_rate_limit(
    repeat('5', 64), repeat('8', 64), date_trunc('minute', now()),
    date_trunc('minute', now()) + interval '10 minutes', 3
  );
  if v_rate_allowed
    or (select request_count from private.review_abuse_rate_limits
        where key_hash = repeat('8', 64) and window_started_at = date_trunc('minute', now())) <> 4
    or (select cardinality(claimed_idempotency_key_hashes) from private.review_abuse_rate_limits
        where key_hash = repeat('8', 64) and window_started_at = date_trunc('minute', now())) <> 3 then
    raise exception 'distributed Review rate limit must reject the fourth distinct key';
  end if;

  insert into app.shops (wp_post_id, slug, canonical_path, name)
  values (
    v_wp_shop_id,
    'review-native-' || v_wp_shop_id::text,
    '/shops/review-native-' || v_wp_shop_id::text || '/',
    'Review Native Contract Shop'
  ) returning id into v_shop_id;

  perform api.claim_review_submission_rate_limit(
    repeat('a', 64), repeat('b', 64), date_trunc('minute', now()),
    date_trunc('minute', now()) + interval '1 minute', 3
  );

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
  select request_fingerprint into v_request_fingerprint
  from private.review_idempotency_keys
  where review_id = v_review_id;
  if v_request_fingerprint is null or v_request_fingerprint !~ '^[0-9a-f]{64}$' then
    raise exception 'idempotency request fingerprint must be a lowercase SHA-256 hex digest';
  end if;

  select review_id, created into v_duplicate_id, v_created
  from api.submit_review(
    v_wp_shop_id,
    '  This is a valid native Review contract submission body.  ',
    5::smallint,
    '  Contract Reviewer  ',
    '  https://mens-esthe-kuchikomi.com/reviews/submit/  ',
    repeat('a', 64),
    repeat('b', 64),
    date_trunc('minute', now()),
    date_trunc('minute', now()) + interval '1 minute',
    4::smallint, null::smallint, 5::smallint, '  2026-09  ', '  yes  ',
    '  CONTRACT@EXAMPLE.INVALID  ', null::uuid
  );
  if v_created or v_duplicate_id <> v_review_id
    or (select count(*) from app.reviews where shop_id = v_shop_id) <> 1 then
    raise exception 'duplicate idempotency key must return the existing Review without duplication';
  end if;

  select count(*) into v_abuse_count
  from private.review_abuse_rate_limits
  where key_hash = repeat('b', 64);
  for v_mismatch in
    select * from (values
      ('body', 'This is a different valid native Review submission body.', 5::smallint, 4::smallint, null::smallint, 5::smallint, '2026-09', 'yes', 'Contract Reviewer', 'https://mens-esthe-kuchikomi.com/reviews/submit/', 'contract@example.invalid', null::uuid),
      ('overall rating', 'This is a valid native Review contract submission body.', 4::smallint, 4::smallint, null::smallint, 5::smallint, '2026-09', 'yes', 'Contract Reviewer', 'https://mens-esthe-kuchikomi.com/reviews/submit/', 'contract@example.invalid', null::uuid),
      ('metric rating', 'This is a valid native Review contract submission body.', 5::smallint, 5::smallint, null::smallint, 5::smallint, '2026-09', 'yes', 'Contract Reviewer', 'https://mens-esthe-kuchikomi.com/reviews/submit/', 'contract@example.invalid', null::uuid),
      ('nickname', 'This is a valid native Review contract submission body.', 5::smallint, 4::smallint, null::smallint, 5::smallint, '2026-09', 'yes', 'Different Reviewer', 'https://mens-esthe-kuchikomi.com/reviews/submit/', 'contract@example.invalid', null::uuid),
      ('email', 'This is a valid native Review contract submission body.', 5::smallint, 4::smallint, null::smallint, 5::smallint, '2026-09', 'yes', 'Contract Reviewer', 'https://mens-esthe-kuchikomi.com/reviews/submit/', 'different@example.invalid', null::uuid),
      ('visit period', 'This is a valid native Review contract submission body.', 5::smallint, 4::smallint, null::smallint, 5::smallint, '2026-10', 'yes', 'Contract Reviewer', 'https://mens-esthe-kuchikomi.com/reviews/submit/', 'contract@example.invalid', null::uuid),
      ('revisit intent', 'This is a valid native Review contract submission body.', 5::smallint, 4::smallint, null::smallint, 5::smallint, '2026-09', 'no', 'Contract Reviewer', 'https://mens-esthe-kuchikomi.com/reviews/submit/', 'contract@example.invalid', null::uuid),
      ('campaign token', 'This is a valid native Review contract submission body.', 5::smallint, 4::smallint, null::smallint, 5::smallint, '2026-09', 'yes', 'Contract Reviewer', 'https://mens-esthe-kuchikomi.com/reviews/submit/', 'contract@example.invalid', gen_random_uuid()),
      ('source metadata', 'This is a valid native Review contract submission body.', 5::smallint, 4::smallint, null::smallint, 5::smallint, '2026-09', 'yes', 'Contract Reviewer', 'https://mens-esthe-kuchikomi.com/reviews/submit/?source=changed', 'contract@example.invalid', null::uuid)
    ) as mismatch(
      label, body, rating, rating_price, rating_service, rating_cleanliness,
      visit_period, revisit_intent, nickname, source_url, email, campaign_token
    )
  loop
    begin
      perform api.submit_review(
        v_wp_shop_id, v_mismatch.body, v_mismatch.rating, v_mismatch.nickname,
        v_mismatch.source_url, repeat('a', 64), repeat('b', 64),
        date_trunc('minute', now()), date_trunc('minute', now()) + interval '1 minute',
        v_mismatch.rating_price, v_mismatch.rating_service, v_mismatch.rating_cleanliness,
        v_mismatch.visit_period, v_mismatch.revisit_intent, v_mismatch.email,
        v_mismatch.campaign_token
      );
      raise exception 'idempotency payload mismatch unexpectedly succeeded: %', v_mismatch.label;
    exception when unique_violation then
      if sqlerrm <> 'idempotency key payload mismatch' then
        raise;
      end if;
    end;
  end loop;
  if (select count(*) from app.reviews where shop_id = v_shop_id) <> 1
    or (select count(*) from private.review_submission_details where review_id = v_review_id) <> 1
    or (select count(*) from private.review_idempotency_keys where review_id = v_review_id) <> 1
    or (select count(*) from private.review_abuse_rate_limits where key_hash = repeat('b', 64)) <> v_abuse_count
    or exists (select 1 from private.partner_review_campaign_submissions where review_id = v_review_id) then
    raise exception 'idempotency mismatch must not change Review, PII, abuse, key, or attribution state';
  end if;

  select count(*) into v_before from app.reviews where shop_id = v_shop_id;
  begin
    perform api.submit_review(
      v_wp_shop_id, 'Invalid rating must roll back the Review transaction.', 6::smallint,
      'Invalid Rating', 'https://mens-esthe-kuchikomi.com/reviews/submit/',
      repeat('c', 64), repeat('d', 64), now(), now() + interval '1 minute'
    );
    raise exception 'invalid rating unexpectedly succeeded';
  exception when check_violation or invalid_parameter_value then
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
  exception when check_violation or invalid_parameter_value then
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
  exception when check_violation or invalid_parameter_value then
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

  insert into app.shops (wp_post_id, slug, canonical_path, name)
  values (
    v_other_wp_shop_id,
    'review-native-' || v_other_wp_shop_id::text,
    '/shops/review-native-' || v_other_wp_shop_id::text || '/',
    'Review Native Cross-shop Contract Shop'
  ) returning id into v_other_shop_id;
  insert into private.partner_workspaces (
    wp_shop_id, shop_slug, shop_name, canonical_url, state
  ) values (
    v_other_wp_shop_id,
    'review-native-' || v_other_wp_shop_id::text,
    'Review Native Cross-shop Contract Shop',
    'https://mens-esthe-kuchikomi.com/shops/review-native-' || v_other_wp_shop_id::text || '/',
    'free_official_partner'
  ) returning id into v_other_workspace_id;
  insert into private.partner_review_campaigns (workspace_id, channel)
  values (v_other_workspace_id, 'counter_qr')
  returning id, token into v_other_campaign_id, v_other_campaign_token;

  select to_jsonb(c) into v_other_campaign_before
  from private.partner_review_campaigns c
  where c.id = v_other_campaign_id;
  select api.record_partner_review_campaign_review(
    v_other_campaign_token, v_other_wp_shop_id, v_review_id
  ) into v_recorded;
  if v_recorded
    or exists (
      select 1 from private.partner_review_campaign_submissions
      where campaign_id = v_other_campaign_id or review_id = v_review_id
    )
    or (select body from app.reviews where id = v_review_id)
       <> 'This is a valid native Review contract submission body.'
    or (select rating from app.reviews where id = v_review_id) <> 5
    or (select to_jsonb(c) from private.partner_review_campaigns c where c.id = v_other_campaign_id)
       is distinct from v_other_campaign_before then
    raise exception 'cross-shop Review UUID attribution must be rejected without partial state';
  end if;

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

set local role service_role;

do $$
begin
  begin
    insert into app.reviews (shop_id, body)
    values (gen_random_uuid(), 'Direct Review insert must be denied.');
    raise exception 'service_role direct Review insert unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
  begin
    update app.reviews set moderation_status = 'approved' where false;
    raise exception 'service_role direct Review update unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from app.reviews where false;
    raise exception 'service_role direct Review delete unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
  begin
    truncate table app.reviews;
    raise exception 'service_role direct Review truncate unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into private.review_moderation_events (
      review_id, from_state, to_state, actor_label, reason, created_at
    ) values (
      gen_random_uuid(), 'pending', 'approved', 'spoofed-actor',
      'spoofed moderation audit', '2000-01-01 00:00:00+00'
    );
    raise exception 'service_role direct moderation audit insert unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
  begin
    update private.review_moderation_events set reason = 'spoofed' where false;
    raise exception 'service_role direct moderation audit update unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from private.review_moderation_events where false;
    raise exception 'service_role direct moderation audit delete unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into private.partner_review_campaign_submissions (campaign_id, review_id)
    values (gen_random_uuid(), gen_random_uuid());
    raise exception 'service_role direct campaign attribution insert unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
  begin
    update private.partner_review_campaign_submissions set review_id = gen_random_uuid() where false;
    raise exception 'service_role direct campaign attribution update unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from private.partner_review_campaign_submissions where false;
    raise exception 'service_role direct campaign attribution delete unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
end;
$$;

rollback;
