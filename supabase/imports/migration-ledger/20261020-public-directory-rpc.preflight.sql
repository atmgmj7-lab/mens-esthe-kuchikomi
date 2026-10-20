-- Read-only migration-ledger preflight. It never repairs or rewrites history.
-- STOP if status is not already_applied_do_not_apply_source.
begin read only;

with expected as (
  select
    '20261019090000'::text as source_version,
    'eskomi_supabase_primary_public_directory'::text as source_name,
    '20261020020548'::text as applied_version,
    'eskomi_supabase_primary_public_directory'::text as applied_name
), observed as (
  select version, name
  from supabase_migrations.schema_migrations
  where name = (select applied_name from expected)
     or version in ((select source_version from expected), (select applied_version from expected))
), checks as (
  select
    count(*) filter (where version = (select applied_version from expected)
                      and name = (select applied_name from expected)) = 1 as exact_applied_record,
    count(*) filter (where version = (select source_version from expected)) = 0 as old_source_version_absent,
    count(*) filter (where name = (select applied_name from expected)
                      and version <> (select applied_version from expected)) = 0 as no_duplicate_named_record
  from observed
)
select
  case when exact_applied_record and old_source_version_absent and no_duplicate_named_record
    then 'already_applied_do_not_apply_source'
    else 'stop_ledger_drift'
  end as status,
  exact_applied_record,
  old_source_version_absent,
  no_duplicate_named_record,
  (select jsonb_agg(jsonb_build_object('version', version, 'name', name) order by version) from observed) as observed_records
from checks;

commit;
