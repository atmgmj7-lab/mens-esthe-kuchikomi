function uniquePositiveIds(value, name) {
  if (!Array.isArray(value) || value.some((id) => !Number.isSafeInteger(id) || id <= 0)) {
    throw new Error(`${name} must be an array of positive WordPress IDs`);
  }
  return [...new Set(value)].sort((left, right) => left - right);
}

function requireSafeText(value, name) {
  if (typeof value !== "string" || !/^[a-z0-9-]+$/i.test(value)) {
    throw new Error(`${name} must contain only letters, numbers, and hyphens`);
  }
  return value;
}

function sqlJson(value, tag) {
  const payload = JSON.stringify(value);
  if (payload.includes(`$${tag}$`)) throw new Error(`JSON payload contains reserved SQL tag ${tag}`);
  return `$${tag}$${payload}$${tag}$::jsonb`;
}

function normalizedAreaIds(value) {
  if (!Array.isArray(value)) return [];
  return uniquePositiveIds(value.filter((id) => Number.isSafeInteger(id) && id > 0), "area relation IDs");
}

function sourceModifiedGmt(row) {
  if (typeof row.modified_gmt !== "string" || Number.isNaN(Date.parse(row.modified_gmt))) {
    throw new Error(`WordPress shop ${row.id} is missing a valid modified_gmt source revision`);
  }
  return row.modified_gmt;
}

/**
 * Produces a deliberately non-inferential allocation. Only the WordPress ACF
 * primary-area value can turn into an update; a single/multiple relation by
 * itself is explicitly deferred for human data remediation.
 */
export function buildSourceGroundedPrimaryAreaPlan({
  sourceShops,
  candidateWpIds,
  reviewRequiredWpIds,
  unlistedManagedWpIds
}) {
  if (!Array.isArray(sourceShops)) throw new Error("sourceShops must be an array");
  const candidates = uniquePositiveIds(candidateWpIds, "candidateWpIds");
  const reviewRequired = new Set(uniquePositiveIds(reviewRequiredWpIds, "reviewRequiredWpIds"));
  const unlistedManaged = new Set(uniquePositiveIds(unlistedManagedWpIds, "unlistedManagedWpIds"));
  const rowsById = new Map();

  for (const row of sourceShops) {
    if (!Number.isSafeInteger(row?.id) || row.id <= 0) throw new Error("source shop ID must be a positive integer");
    if (rowsById.has(row.id)) throw new Error(`duplicate source shop ${row.id}`);
    rowsById.set(row.id, row);
  }

  const assignments = [];
  const deferred = [];
  for (const wpPostId of candidates) {
    if (reviewRequired.has(wpPostId) || unlistedManaged.has(wpPostId)) continue;
    const row = rowsById.get(wpPostId);
    if (!row) throw new Error(`candidate WordPress shop ${wpPostId} is absent from the source response`);
    if (row.status !== "publish") throw new Error(`candidate WordPress shop ${wpPostId} is not published in the source response`);
    const areaIds = normalizedAreaIds(row.area);
    if (areaIds.length === 0) {
      deferred.push({ wpPostId, reason: "no-area-relation" });
      continue;
    }
    const rawPrimary = row.acf?.shop_primary_area_term_id;
    const areaTermId = Number.isSafeInteger(rawPrimary) ? rawPrimary : Number(rawPrimary);
    if (!Number.isSafeInteger(areaTermId) || areaTermId <= 0) {
      deferred.push({
        wpPostId,
        reason: areaIds.length === 1
          ? "primary-area-field-missing-single-relation"
          : "primary-area-field-missing-multiple-relations"
      });
      continue;
    }
    if (!areaIds.includes(areaTermId)) {
      throw new Error(`WordPress shop ${wpPostId} primary area ${areaTermId} is not an existing area relation`);
    }
    assignments.push({
      wpPostId,
      areaTermId,
      sourceField: "shop_primary_area_term_id",
      sourceModifiedGmt: sourceModifiedGmt(row)
    });
  }

  const excluded = [
    ...[...unlistedManaged].filter((id) => rowsById.has(id)).map((wpPostId) => ({ wpPostId, reason: "managed-unlisted" })),
    ...[...reviewRequired].filter((id) => rowsById.has(id)).map((wpPostId) => ({ wpPostId, reason: "review-required" }))
  ];
  return { assignments, deferred, excluded };
}

function validateOptions({ plan, batchId, sourceLabel }) {
  if (!plan || !Array.isArray(plan.assignments)) throw new Error("plan.assignments is required");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(batchId || "")) {
    throw new Error("batchId must be a UUID");
  }
  requireSafeText(sourceLabel, "sourceLabel");
  const seen = new Set();
  for (const assignment of plan.assignments) {
    if (!Number.isSafeInteger(assignment.wpPostId) || !Number.isSafeInteger(assignment.areaTermId)) {
      throw new Error("assignment IDs must be integers");
    }
    if (seen.has(assignment.wpPostId)) throw new Error(`duplicate assignment for WordPress shop ${assignment.wpPostId}`);
    seen.add(assignment.wpPostId);
  }
}

function sourceRows(plan) {
  return plan.assignments.map((assignment) => ({
    wpPostId: assignment.wpPostId,
    areaTermId: assignment.areaTermId,
    sourceField: assignment.sourceField,
    sourceModifiedGmt: assignment.sourceModifiedGmt
  }));
}

function commonSetup({ plan, batchId, sourceLabel, createBatch }) {
  const rows = sourceRows(plan);
  const batchSql = createBatch ? `
insert into private.import_batches (
  id, source_system, source_url, status, started_at, finished_at,
  source_count, imported_count, failed_count, metadata
) values (
  '${batchId}'::uuid,
  'wordpress-primary-area-delta',
  'repo://supabase/imports/primary-area-delta/${sourceLabel}.sql',
  'running', now(), null,
  ${rows.length}, 0, 0,
  jsonb_build_object('source_label', '${sourceLabel}', 'public_cutover', false, 'operation', 'set-primary-relation-only')
)
on conflict (id) do update set
  source_url = excluded.source_url,
  status = case when private.import_batches.status = 'rolled-back' then 'running' else private.import_batches.status end,
  source_count = excluded.source_count,
  metadata = excluded.metadata;
` : "";
  return `
create temporary table if not exists primary_area_delta_source (payload jsonb not null) on commit drop;
truncate primary_area_delta_source;
insert into primary_area_delta_source (payload)
select value from jsonb_array_elements(${sqlJson(rows, "primaryareadelta")});

do $$
declare
  expected_count integer := ${rows.length};
  actual_count integer;
begin
  select count(*) into actual_count from primary_area_delta_source;
  if actual_count <> expected_count then
    raise exception 'primary area delta source row count mismatch: expected %, got %', expected_count, actual_count;
  end if;

  select count(*) into actual_count
  from primary_area_delta_source as source
  join app.shops as shop on shop.wp_post_id = (source.payload ->> 'wpPostId')::bigint
  join app.areas as area on area.wp_term_id = (source.payload ->> 'areaTermId')::bigint
  join app.shop_areas as relation on relation.shop_id = shop.id and relation.area_id = area.id
  where shop.publication_status = 'draft'
    and area.is_published = false;
  if actual_count <> expected_count then
    raise exception 'primary area delta requires existing draft shops, unpublished areas, and existing relations: expected %, got %', expected_count, actual_count;
  end if;

  if exists (
    select 1
    from primary_area_delta_source as source
    join app.shops as shop on shop.wp_post_id = (source.payload ->> 'wpPostId')::bigint
    join app.shop_areas as relation on relation.shop_id = shop.id
    join app.areas as area on area.id = relation.area_id
    where relation.is_primary
      and area.wp_term_id <> (source.payload ->> 'areaTermId')::bigint
  ) then
    raise exception 'primary area delta refuses to replace an existing primary relation';
  end if;
end
$$;
${batchSql}
`;
}

export function renderPrimaryAreaDeltaSql(options) {
  validateOptions(options);
  const { plan, batchId, sourceLabel, transactionMode = "script" } = options;
  if (!["script", "caller"].includes(transactionMode)) throw new Error("transactionMode must be script or caller");
  const rows = sourceRows(plan);
  return `${transactionMode === "script" ? "begin;" : ""}

set local statement_timeout = '60s';
${commonSetup({ plan, batchId, sourceLabel, createBatch: true })}

update app.shop_areas as relation
set is_primary = true
from primary_area_delta_source as source
join app.shops as shop on shop.wp_post_id = (source.payload ->> 'wpPostId')::bigint
join app.areas as area on area.wp_term_id = (source.payload ->> 'areaTermId')::bigint
where relation.shop_id = shop.id
  and relation.area_id = area.id
  and relation.is_primary = false;

insert into private.import_records (
  batch_id, entity_type, source_id, target_table, target_id, status,
  source_payload, transformed_payload, issues, imported_at
)
select
  '${batchId}'::uuid,
  'shop-primary-area',
  source.payload ->> 'wpPostId',
  'app.shop_areas',
  shop.id,
  'imported',
  jsonb_build_object(
    'shop_primary_area_term_id', (source.payload ->> 'areaTermId')::bigint,
    'sourceField', source.payload ->> 'sourceField',
    'sourceModifiedGmt', source.payload ->> 'sourceModifiedGmt'
  ),
  jsonb_build_object(
    'operation', 'set-is-primary',
    'wpPostId', (source.payload ->> 'wpPostId')::bigint,
    'areaTermId', (source.payload ->> 'areaTermId')::bigint,
    'publication_status', 'draft',
    'is_published', false
  ),
  '[]'::jsonb,
  now()
from primary_area_delta_source as source
join app.shops as shop on shop.wp_post_id = (source.payload ->> 'wpPostId')::bigint
on conflict (batch_id, entity_type, source_id) do update set
  target_table = excluded.target_table,
  target_id = excluded.target_id,
  status = excluded.status,
  source_payload = excluded.source_payload,
  transformed_payload = excluded.transformed_payload,
  issues = excluded.issues,
  imported_at = excluded.imported_at,
  updated_at = now();

update private.import_batches
set status = 'completed', finished_at = now(), imported_count = ${rows.length}, failed_count = 0
where id = '${batchId}'::uuid;

${transactionMode === "script" ? "commit;" : ""}
`;
}

export function renderPrimaryAreaDeltaRollbackSql(options) {
  validateOptions(options);
  const { plan, batchId, sourceLabel, transactionMode = "script" } = options;
  if (!["script", "caller"].includes(transactionMode)) throw new Error("transactionMode must be script or caller");
  const rows = sourceRows(plan);
  return `${transactionMode === "script" ? "begin;" : ""}

set local statement_timeout = '60s';
${commonSetup({ plan, batchId, sourceLabel, createBatch: false })}

do $$
declare
  expected_count integer := ${rows.length};
  actual_count integer;
begin
  select count(*) into actual_count
  from private.import_records as record
  join private.import_batches as batch on batch.id = record.batch_id
  where batch.id = '${batchId}'::uuid
    and batch.source_system = 'wordpress-primary-area-delta'
    and batch.status = 'completed'
    and record.entity_type = 'shop-primary-area'
    and record.status = 'imported';
  if actual_count <> expected_count then
    raise exception 'primary area rollback requires completed batch audit records: expected %, got %', expected_count, actual_count;
  end if;

  select count(*) into actual_count
  from primary_area_delta_source as source
  join app.shops as shop on shop.wp_post_id = (source.payload ->> 'wpPostId')::bigint
  join app.areas as area on area.wp_term_id = (source.payload ->> 'areaTermId')::bigint
  join app.shop_areas as relation on relation.shop_id = shop.id and relation.area_id = area.id
  where shop.publication_status = 'draft'
    and area.is_published = false
    and relation.is_primary;
  if actual_count <> expected_count then
    raise exception 'primary area rollback requires unchanged draft target relations: expected %, got %', expected_count, actual_count;
  end if;
end
$$;

update app.shop_areas as relation
set is_primary = false
from primary_area_delta_source as source
join app.shops as shop on shop.wp_post_id = (source.payload ->> 'wpPostId')::bigint
join app.areas as area on area.wp_term_id = (source.payload ->> 'areaTermId')::bigint
where relation.shop_id = shop.id
  and relation.area_id = area.id
  and relation.is_primary;

update private.import_batches
set status = 'rolled-back', finished_at = now(), imported_count = 0, failed_count = 0
where id = '${batchId}'::uuid;

${transactionMode === "script" ? "commit;" : ""}
`;
}
