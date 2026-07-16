import assert from "node:assert/strict";

export const PHASE4_BATCH_ID = "7fd28016-596d-4aa7-87bf-5700db728fb0";

const PHASE4_DATASET_KEY = "sakaisujihonmachi-phase4-2026-07-15";
const PHASE4_ROW_MARKER = "phase4-source:2026-07-15";
const EXPECTED_SUMMARY = Object.freeze({
  shops_eligible: 26,
  shop_prices: 89,
  shop_business_hours: 23,
  source_observations: 72,
  sources: 71,
  shop_source_links: 189
});

function sqlLiteral(value) {
  if (value === null || value === undefined) return "null";
  return `'${String(value).replaceAll("'", "''")}'`;
}

function jsonPayload(rows, delimiter) {
  const json = JSON.stringify(rows, null, 2);
  if (json.includes(delimiter)) {
    throw new Error(`Phase 4 payload contains reserved SQL delimiter ${delimiter}`);
  }
  return json;
}

function flattenPreview(preview) {
  const eligible = preview.shops.filter((shop) => shop.eligible_for_draft_import);
  return {
    shops: eligible.map((shop) => ({
      wp_post_id: shop.wp_post_id,
      wordpress_comparison: shop.wordpress_comparison,
      shop_patch: shop.supabase_draft_candidate.shop_patch,
      price_rows: shop.supabase_draft_candidate.prices.length,
      business_hours_rows: shop.supabase_draft_candidate.business_hours.length,
      source_rows: shop.supabase_draft_candidate.sources.length,
      source_link_rows: shop.supabase_draft_candidate.source_links.length
    })),
    prices: eligible.flatMap((shop) => shop.supabase_draft_candidate.prices),
    businessHours: eligible.flatMap((shop) => shop.supabase_draft_candidate.business_hours),
    sources: eligible.flatMap((shop) => shop.supabase_draft_candidate.sources),
    sourceLinks: eligible.flatMap((shop) => shop.supabase_draft_candidate.source_links)
  };
}

export function validatePhase4DraftPreview(preview) {
  assert.ok(preview && typeof preview === "object", "Phase 4 draft preview is required");
  assert.equal(preview.mode, "supabase-draft-preview");
  assert.equal(preview.apply_status, "not-applied");
  assert.equal(preview.public_data_source, "wordpress");
  assert.equal(preview.target_data_store, "supabase");
  assert.deepEqual(preview.target_state, {
    shops_publication_status: "draft",
    rows_is_public: false,
    public_cutover: false
  });
  assert.deepEqual(preview.summary, EXPECTED_SUMMARY);
  assert.ok(Array.isArray(preview.shops) && preview.shops.length === 30, "Phase 4 preview requires 30 shops");

  const rows = flattenPreview(preview);
  assert.equal(rows.shops.length, EXPECTED_SUMMARY.shops_eligible);
  assert.equal(rows.prices.length, EXPECTED_SUMMARY.shop_prices);
  assert.equal(rows.businessHours.length, EXPECTED_SUMMARY.shop_business_hours);
  assert.equal(rows.sources.length, EXPECTED_SUMMARY.sources);
  assert.equal(rows.sourceLinks.length, EXPECTED_SUMMARY.shop_source_links);
  assert.equal(new Set(rows.shops.map((row) => row.wp_post_id)).size, rows.shops.length);
  assert.equal(
    new Set(rows.sources.map((row) => `${row.source_kind}:${row.source_url}`)).size,
    rows.sources.length,
    "Phase 4 Supabase sources must be unique"
  );
  assert.equal(
    new Set(rows.prices.map((row) => `${row.wp_post_id}:${row.course_name}:${row.duration_minutes}:${row.amount_yen}`)).size,
    rows.prices.length,
    "Phase 4 Supabase prices must be unique"
  );
  assert.equal(
    new Set(rows.sourceLinks.map((row) => `${row.wp_post_id}:${row.source_kind}:${row.source_url}:${row.field_name}`)).size,
    rows.sourceLinks.length,
    "Phase 4 Supabase source links must be unique"
  );

  for (const row of rows.shops) {
    assert.equal(row.shop_patch.wp_post_id, row.wp_post_id);
    assert.equal(row.shop_patch.publication_status, "draft");
    assert.equal(row.shop_patch.published_at, null);
  }
  for (const row of [...rows.prices, ...rows.businessHours, ...rows.sourceLinks]) {
    assert.equal(row.is_public, false);
  }
  return preview;
}

export function renderPhase4ImportSql(preview) {
  validatePhase4DraftPreview(preview);
  const rows = flattenPreview(preview);
  const shopIds = rows.shops.map((row) => row.wp_post_id);
  const shopMarkers = shopIds.map((id) => `-- phase4 shop wp_post_id=${id}`).join("\n");

  return `begin;

set local statement_timeout = '120s';

insert into private.import_batches (
  id, source_system, source_url, status, started_at, finished_at,
  source_count, imported_count, failed_count, metadata
)
values (
  ${sqlLiteral(PHASE4_BATCH_ID)}::uuid,
  'official-primary-research',
  'repo://docs/data/sakaisujihonmachi-phase4-supabase-draft-preview-2026-07-15.json',
  'completed', now(), now(),
  ${rows.shops.length}, ${rows.shops.length}, 0,
  jsonb_build_object(
    'import_key', ${sqlLiteral(PHASE4_DATASET_KEY)},
    'price_rows', ${rows.prices.length},
    'business_hours_rows', ${rows.businessHours.length},
    'source_rows', ${rows.sources.length},
    'source_link_rows', ${rows.sourceLinks.length},
    'public_cutover', false
  )
)
on conflict (id) do update set
  source_url = excluded.source_url,
  status = excluded.status,
  finished_at = excluded.finished_at,
  source_count = excluded.source_count,
  imported_count = excluded.imported_count,
  failed_count = excluded.failed_count,
  metadata = excluded.metadata;

create temporary table phase4_draft_shops (payload jsonb not null) on commit drop;
create temporary table phase4_draft_prices (payload jsonb not null) on commit drop;
create temporary table phase4_draft_hours (payload jsonb not null) on commit drop;
create temporary table phase4_draft_sources (payload jsonb not null) on commit drop;
create temporary table phase4_draft_source_links (payload jsonb not null) on commit drop;

${shopMarkers}
insert into phase4_draft_shops (payload)
select value from jsonb_array_elements(
$phase4shops$${jsonPayload(rows.shops, "$phase4shops$")}$phase4shops$::jsonb
);

insert into phase4_draft_prices (payload)
select value from jsonb_array_elements(
$phase4prices$${jsonPayload(rows.prices, "$phase4prices$")}$phase4prices$::jsonb
);

insert into phase4_draft_hours (payload)
select value from jsonb_array_elements(
$phase4hours$${jsonPayload(rows.businessHours, "$phase4hours$")}$phase4hours$::jsonb
);

insert into phase4_draft_sources (payload)
select value from jsonb_array_elements(
$phase4sources$${jsonPayload(rows.sources, "$phase4sources$")}$phase4sources$::jsonb
);

insert into phase4_draft_source_links (payload)
select value from jsonb_array_elements(
$phase4links$${jsonPayload(rows.sourceLinks, "$phase4links$")}$phase4links$::jsonb
);

do $$
declare
  matched_shops integer;
  public_target_shops integer;
begin
  select count(*) into matched_shops
  from app.shops as shops
  join phase4_draft_shops as source
    on shops.wp_post_id = (source.payload ->> 'wp_post_id')::bigint;

  if matched_shops <> ${rows.shops.length} then
    raise exception 'Expected ${rows.shops.length} existing Phase 4 shops, found %', matched_shops;
  end if;

  select count(*) into public_target_shops
  from app.shops as shops
  join phase4_draft_shops as source
    on shops.wp_post_id = (source.payload ->> 'wp_post_id')::bigint
  where shops.publication_status <> 'draft' or shops.published_at is not null;

  if public_target_shops <> 0 then
    raise exception 'Refusing to overwrite % published or non-draft Phase 4 shops', public_target_shops;
  end if;
end
$$;

update app.shops as shops
set
  name = coalesce(nullif(source.payload -> 'shop_patch' ->> 'name', ''), shops.name),
  official_url = case
    when (source.payload -> 'shop_patch') ? 'official_url'
      then nullif(source.payload -> 'shop_patch' ->> 'official_url', '')
    else shops.official_url
  end,
  phone = case
    when (source.payload -> 'shop_patch') ? 'phone'
      then nullif(source.payload -> 'shop_patch' ->> 'phone', '')
    else shops.phone
  end,
  address_text = case
    when (source.payload -> 'shop_patch') ? 'address_text'
      then nullif(source.payload -> 'shop_patch' ->> 'address_text', '')
    else shops.address_text
  end,
  access_text = case
    when (source.payload -> 'shop_patch') ? 'access_text'
      then nullif(source.payload -> 'shop_patch' ->> 'access_text', '')
    else shops.access_text
  end,
  booking_url = case
    when (source.payload -> 'shop_patch') ? 'booking_url'
      then nullif(source.payload -> 'shop_patch' ->> 'booking_url', '')
    else shops.booking_url
  end,
  legacy_payload = shops.legacy_payload || coalesce(
    source.payload -> 'shop_patch' -> 'legacy_payload_patch',
    '{}'::jsonb
  ),
  publication_status = 'draft',
  published_at = null,
  updated_at = now()
from phase4_draft_shops as source
where shops.wp_post_id = (source.payload ->> 'wp_post_id')::bigint;

insert into app.sources (
  source_url, source_kind, title, fetched_at, verified_at, metadata
)
select
  payload ->> 'source_url',
  payload ->> 'source_kind',
  nullif(payload ->> 'title', ''),
  nullif(payload ->> 'fetched_at', '')::timestamptz,
  (payload ->> 'verified_at')::timestamptz,
  coalesce(payload -> 'metadata', '{}'::jsonb)
    || jsonb_build_object('phase4_dataset', ${sqlLiteral(PHASE4_DATASET_KEY)})
from phase4_draft_sources
on conflict (source_url, source_kind) do update set
  title = excluded.title,
  fetched_at = coalesce(excluded.fetched_at, app.sources.fetched_at),
  verified_at = excluded.verified_at,
  metadata = app.sources.metadata || excluded.metadata,
  updated_at = now();

delete from app.shop_prices as prices
using app.shops as shops, phase4_draft_shops as source
where prices.shop_id = shops.id
  and shops.wp_post_id = (source.payload ->> 'wp_post_id')::bigint
  and prices.notes like ${sqlLiteral(`${PHASE4_ROW_MARKER};%`)}
  and not prices.is_public;

insert into app.shop_prices (
  shop_id, course_name, duration_minutes, amount_yen, currency,
  notes, is_public, verified_at
)
select
  shops.id,
  price.payload ->> 'course_name',
  nullif(price.payload ->> 'duration_minutes', '')::integer,
  (price.payload ->> 'amount_yen')::integer,
  coalesce(nullif(price.payload ->> 'currency', ''), 'JPY'),
  ${sqlLiteral(`${PHASE4_ROW_MARKER}; `)} || coalesce(price.payload ->> 'notes', '確認済み料金'),
  false,
  (price.payload ->> 'verified_at')::timestamptz
from phase4_draft_prices as price
join app.shops as shops
  on shops.wp_post_id = (price.payload ->> 'wp_post_id')::bigint;

delete from app.shop_business_hours as hours
using app.shops as shops, phase4_draft_shops as source
where hours.shop_id = shops.id
  and shops.wp_post_id = (source.payload ->> 'wp_post_id')::bigint
  and hours.notes like ${sqlLiteral(`${PHASE4_ROW_MARKER};%`)}
  and not hours.is_public;

insert into app.shop_business_hours (
  shop_id, day_of_week, opens_at, closes_at, is_overnight,
  notes, is_public, verified_at
)
select
  shops.id,
  nullif(hours.payload ->> 'day_of_week', '')::smallint,
  nullif(hours.payload ->> 'opens_at', '')::time,
  nullif(hours.payload ->> 'closes_at', '')::time,
  coalesce((hours.payload ->> 'is_overnight')::boolean, false),
  ${sqlLiteral(`${PHASE4_ROW_MARKER}; `)} || (hours.payload ->> 'notes'),
  false,
  (hours.payload ->> 'verified_at')::timestamptz
from phase4_draft_hours as hours
join app.shops as shops
  on shops.wp_post_id = (hours.payload ->> 'wp_post_id')::bigint;

insert into app.shop_source_links (
  shop_id, source_id, field_name, verification_status, is_public
)
select
  shops.id,
  sources.id,
  links.payload ->> 'field_name',
  'verified',
  false
from phase4_draft_source_links as links
join app.shops as shops
  on shops.wp_post_id = (links.payload ->> 'wp_post_id')::bigint
join app.sources as sources
  on sources.source_url = links.payload ->> 'source_url'
  and sources.source_kind = links.payload ->> 'source_kind'
on conflict (shop_id, source_id, field_name) do update set
  verification_status = 'verified',
  is_public = false,
  updated_at = now();

insert into private.import_records (
  batch_id, entity_type, source_id, target_table, target_id, status,
  source_payload, transformed_payload, issues, imported_at
)
select
  ${sqlLiteral(PHASE4_BATCH_ID)}::uuid,
  'shop-phase4-verified',
  source.payload ->> 'wp_post_id',
  'app.shops',
  shops.id,
  'imported',
  source.payload -> 'wordpress_comparison',
  jsonb_build_object(
    'shop_patch', source.payload -> 'shop_patch',
    'price_rows', (source.payload ->> 'price_rows')::integer,
    'business_hours_rows', (source.payload ->> 'business_hours_rows')::integer,
    'source_rows', (source.payload ->> 'source_rows')::integer,
    'source_link_rows', (source.payload ->> 'source_link_rows')::integer,
    'publication_status', 'draft',
    'is_public', false
  ),
  '[]'::jsonb,
  now()
from phase4_draft_shops as source
join app.shops as shops
  on shops.wp_post_id = (source.payload ->> 'wp_post_id')::bigint
on conflict (batch_id, entity_type, source_id) do update set
  target_table = excluded.target_table,
  target_id = excluded.target_id,
  status = excluded.status,
  source_payload = excluded.source_payload,
  transformed_payload = excluded.transformed_payload,
  issues = excluded.issues,
  imported_at = excluded.imported_at,
  updated_at = now();

commit;
`;
}

export function renderPhase4VerifySql(preview) {
  validatePhase4DraftPreview(preview);
  const rows = flattenPreview(preview);
  const shopIds = rows.shops.map((row) => row.wp_post_id);

  return `begin;

set local statement_timeout = '120s';

do $$
declare
  phase4_shop_ids constant bigint[] := array[${shopIds.join(", ")}];
  stored_shops integer;
  stored_prices integer;
  stored_hours integer;
  stored_sources integer;
  stored_source_links integer;
  stored_batches integer;
  stored_records integer;
  duplicate_prices integer;
  duplicate_hours integer;
begin
  select count(*) into stored_shops
  from app.shops
  where wp_post_id = any(phase4_shop_ids)
    and publication_status = 'draft'
    and published_at is null
    and legacy_payload -> 'phase4' ->> 'verified_on' = '2026-07-15';

  select count(*) into stored_prices
  from app.shop_prices as prices
  join app.shops as shops on shops.id = prices.shop_id
  where shops.wp_post_id = any(phase4_shop_ids)
    and prices.notes like ${sqlLiteral(`${PHASE4_ROW_MARKER};%`)}
    and not prices.is_public
    and prices.verified_at is not null;

  select count(*) into stored_hours
  from app.shop_business_hours as hours
  join app.shops as shops on shops.id = hours.shop_id
  where shops.wp_post_id = any(phase4_shop_ids)
    and hours.notes like ${sqlLiteral(`${PHASE4_ROW_MARKER};%`)}
    and not hours.is_public
    and hours.verified_at is not null;

  select count(*) into stored_sources
  from app.sources
  where metadata ->> 'phase4_dataset' = ${sqlLiteral(PHASE4_DATASET_KEY)}
    and source_kind = 'official'
    and verified_at is not null;

  select count(*) into stored_source_links
  from app.shop_source_links as links
  join app.shops as shops on shops.id = links.shop_id
  join app.sources as sources on sources.id = links.source_id
  where shops.wp_post_id = any(phase4_shop_ids)
    and sources.metadata ->> 'phase4_dataset' = ${sqlLiteral(PHASE4_DATASET_KEY)}
    and links.verification_status = 'verified'
    and not links.is_public;

  select count(*) into stored_batches
  from private.import_batches
  where id = ${sqlLiteral(PHASE4_BATCH_ID)}::uuid
    and status = 'completed'
    and source_count = ${rows.shops.length}
    and imported_count = ${rows.shops.length}
    and failed_count = 0;

  select count(*) into stored_records
  from private.import_records
  where batch_id = ${sqlLiteral(PHASE4_BATCH_ID)}::uuid
    and entity_type = 'shop-phase4-verified'
    and status = 'imported';

  select count(*) into duplicate_prices
  from (
    select prices.shop_id, prices.course_name, prices.duration_minutes, prices.amount_yen
    from app.shop_prices as prices
    join app.shops as shops on shops.id = prices.shop_id
    where shops.wp_post_id = any(phase4_shop_ids)
      and prices.notes like ${sqlLiteral(`${PHASE4_ROW_MARKER};%`)}
    group by prices.shop_id, prices.course_name, prices.duration_minutes, prices.amount_yen
    having count(*) > 1
  ) as duplicates;

  select count(*) into duplicate_hours
  from (
    select hours.shop_id, hours.day_of_week, hours.opens_at, hours.closes_at, hours.notes
    from app.shop_business_hours as hours
    join app.shops as shops on shops.id = hours.shop_id
    where shops.wp_post_id = any(phase4_shop_ids)
      and hours.notes like ${sqlLiteral(`${PHASE4_ROW_MARKER};%`)}
    group by hours.shop_id, hours.day_of_week, hours.opens_at, hours.closes_at, hours.notes
    having count(*) > 1
  ) as duplicates;

  if stored_shops <> ${rows.shops.length} then
    raise exception 'Expected ${rows.shops.length} Phase 4 draft shops, found %', stored_shops;
  end if;
  if stored_prices <> ${rows.prices.length} then
    raise exception 'Expected ${rows.prices.length} Phase 4 nonpublic prices, found %', stored_prices;
  end if;
  if stored_hours <> ${rows.businessHours.length} then
    raise exception 'Expected ${rows.businessHours.length} Phase 4 nonpublic business hours, found %', stored_hours;
  end if;
  if stored_sources <> ${rows.sources.length} then
    raise exception 'Expected ${rows.sources.length} Phase 4 official sources, found %', stored_sources;
  end if;
  if stored_source_links <> ${rows.sourceLinks.length} then
    raise exception 'Expected ${rows.sourceLinks.length} Phase 4 nonpublic source links, found %', stored_source_links;
  end if;
  if stored_batches <> 1 or stored_records <> ${rows.shops.length} then
    raise exception 'Expected completed Phase 4 batch with ${rows.shops.length} records';
  end if;
  if duplicate_prices <> 0 or duplicate_hours <> 0 then
    raise exception 'Phase 4 import contains duplicate price/hour groups: % / %', duplicate_prices, duplicate_hours;
  end if;
end
$$;

set local role anon;

do $$
declare
  public_rows integer;
begin
  select
    (select count(*) from api.published_areas)
    + (select count(*) from api.published_shops)
    + (select count(*) from api.published_shop_areas)
    + (select count(*) from api.published_shop_prices)
    + (select count(*) from api.published_shop_business_hours)
    + (select count(*) from api.published_shop_images)
    + (select count(*) from api.published_shop_sources)
    + (select count(*) from api.published_contents)
    + (select count(*) from api.published_reviews)
  into public_rows;

  if public_rows <> 0 then
    raise exception 'Phase 4 draft import leaked into public API views: % rows', public_rows;
  end if;
end
$$;

select
  (select count(*) from api.published_areas) as published_areas,
  (select count(*) from api.published_shops) as published_shops,
  (select count(*) from api.published_shop_areas) as published_shop_areas,
  (select count(*) from api.published_shop_prices) as published_shop_prices,
  (select count(*) from api.published_shop_business_hours) as published_shop_business_hours,
  (select count(*) from api.published_shop_images) as published_shop_images,
  (select count(*) from api.published_shop_sources) as published_shop_sources,
  (select count(*) from api.published_contents) as published_contents,
  (select count(*) from api.published_reviews) as published_reviews;

rollback;
`;
}
