export const publicDirectoryMigrationLedger = Object.freeze({
  sourceVersion: "20261019090000",
  sourceName: "eskomi_supabase_primary_public_directory",
  sourcePath: "supabase/migrations/20261019090000_eskomi_supabase_primary_public_directory.sql",
  appliedVersion: "20261020020548",
  appliedName: "eskomi_supabase_primary_public_directory",
  projectRef: "goeagrxjsjcbbatpotbu"
});

function literal(value) {
  return `'${value.replaceAll("'", "''")}'`;
}

/**
 * This deliberately emits only a read-only report.  The mapped remote record
 * means that the old local filename must not be sent to a generic migration
 * runner, even though the filename's numeric prefix is not present remotely.
 */
export function renderPublicDirectoryMigrationLedgerPreflightSql({ transactionMode = "self" } = {}) {
  if (transactionMode !== "self" && transactionMode !== "caller") {
    throw new Error("transactionMode must be self or caller");
  }
  const entry = publicDirectoryMigrationLedger;
  const begin = transactionMode === "self" ? "begin read only;\n\n" : "";
  const commit = transactionMode === "self" ? "\n\ncommit;\n" : "";
  return `-- Read-only migration-ledger preflight. It never repairs or rewrites history.
-- STOP if status is not already_applied_do_not_apply_source.
${begin}with expected as (
  select
    ${literal(entry.sourceVersion)}::text as source_version,
    ${literal(entry.sourceName)}::text as source_name,
    ${literal(entry.appliedVersion)}::text as applied_version,
    ${literal(entry.appliedName)}::text as applied_name
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
from checks;${commit}`;
}
