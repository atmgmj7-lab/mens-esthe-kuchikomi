-- P1-RANK-02B: user-approved Data API schema exposure only.
-- No table, function definition, grant, Auth, membership, workspace or campaign changes.
-- Previous authenticator/database pgrst.db_schemas override: absent.
-- Explicit override is intentional; rollback is ALTER ROLE authenticator RESET pgrst.db_schemas,
-- followed by reload config/schema notifications, only under separate rollback approval.
DO $preflight$
DECLARE
  required_names text[] := ARRAY[
    'claim_shop_owner_request_rate_limit',
    'provision_partner_workspace',
    'register_partner_submission',
    'grant_partner_membership',
    'get_partner_auth_membership',
    'get_partner_workspace_identity',
    'list_partner_registration_reviews',
    'review_partner_registration',
    'open_partner_review_campaign',
    'record_partner_review_campaign_event',
    'get_partner_review_growth_metrics',
    'get_partner_review_widget',
    'claim_review_submission_rate_limit',
    'submit_review_with_tags',
    'list_review_moderation_queue',
    'moderate_review',
    'publish_review',
    'list_published_reviews',
    'get_published_review_metrics'
  ];
  matched_count integer;
BEGIN
  IF to_regnamespace('api') IS NULL OR to_regnamespace('private') IS NULL THEN
    RAISE EXCEPTION 'P1-RANK-02B required schema missing';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_db_role_setting s
    LEFT JOIN pg_roles r ON r.oid=s.setrole
    CROSS JOIN LATERAL unnest(s.setconfig) cfg(setting)
    WHERE (s.setrole=0 OR r.rolname='authenticator')
      AND cfg.setting LIKE 'pgrst.db_schemas=%'
  ) THEN
    RAISE EXCEPTION 'P1-RANK-02B configuration drift: schema override now exists';
  END IF;

  SELECT count(*) INTO matched_count
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='api' AND p.proname=ANY(required_names);
  IF matched_count <> 19 OR EXISTS (
    SELECT 1 FROM unnest(required_names) required(name)
    WHERE NOT EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='api' AND p.proname=required.name
    )
  ) THEN
    RAISE EXCEPTION 'P1-RANK-02B required RPC signature set mismatch';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='api'
      AND (has_function_privilege('anon',p.oid,'EXECUTE')
        OR has_function_privilege('authenticated',p.oid,'EXECUTE')
        OR NOT has_function_privilege('service_role',p.oid,'EXECUTE'))
  ) THEN
    RAISE EXCEPTION 'P1-RANK-02B function execution boundary failed';
  END IF;

  IF has_schema_privilege('anon','private','USAGE')
    OR has_schema_privilege('authenticated','private','USAGE')
    OR NOT has_schema_privilege('service_role','api','USAGE') THEN
    RAISE EXCEPTION 'P1-RANK-02B schema privilege boundary failed';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='private' AND c.relkind IN ('r','p','v','m','f')
      AND (has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE')
        OR has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE'))
  ) THEN
    RAISE EXCEPTION 'P1-RANK-02B private relation privilege boundary failed';
  END IF;
END
$preflight$;

ALTER ROLE authenticator SET pgrst.db_schemas = 'api';
NOTIFY pgrst, 'reload config';
NOTIFY pgrst, 'reload schema';;
