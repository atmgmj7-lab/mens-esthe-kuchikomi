export const TRIAL_SQL_GENERATOR_VERSION = 1;

export const SAKAISUJIHONMACHI_30_SHOP_IDS = Object.freeze([
  654, 655, 656, 657, 660, 662, 670, 674, 675, 678,
  683, 686, 687, 689, 695, 696, 697, 701, 706, 708,
  709, 715, 723, 799, 826, 853, 1203, 1210, 1221, 1237
]);

function text(value) {
  if (typeof value === "string") return value.trim();
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function rendered(value) {
  if (value && typeof value === "object" && "rendered" in value) {
    return text(value.rendered);
  }
  return text(value);
}

function nullable(value) {
  const normalized = text(value);
  return normalized || null;
}

function positiveInteger(value) {
  const normalized = text(value).replace(/[\s,，円]/g, "");
  if (!/^\d+$/.test(normalized)) return null;
  const number = Number(normalized);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

function featuredImage(shop) {
  const mediaId = positiveInteger(shop?.featured_media);
  if (!mediaId) return { featured_media: null, image_url: null };

  const media = shop?._embedded?.["wp:featuredmedia"];
  const candidates = Array.isArray(media) ? media : [];
  const matched = candidates.find((item) => Number(item?.id) === mediaId) || candidates[0];
  return {
    featured_media: mediaId,
    image_url: nullable(matched?.source_url)
  };
}

export function normalizeTrialShop(shop) {
  const wpPostId = positiveInteger(shop?.id);
  const slug = text(shop?.slug);
  if (!wpPostId || !slug) {
    throw new Error("Trial shop requires a positive WordPress ID and slug");
  }

  const acf = shop?.acf && typeof shop.acf === "object" ? shop.acf : {};
  const areaIds = Array.isArray(shop?.area)
    ? [...new Set(shop.area.map(positiveInteger).filter(Boolean))]
    : [];
  const addressSource = text(acf.shop_address);
  const addressAccessMixed = addressSource.includes("/");
  const image = featuredImage(shop);
  const basicPrice = positiveInteger(acf.basic_price);
  const officialUrl = nullable(acf.official_url);
  const issues = [];

  if (addressAccessMixed) issues.push("address-access-mixed");
  else if (!addressSource) issues.push("address-missing");
  issues.push(basicPrice ? "price-unverified" : "price-missing");
  issues.push(image.image_url ? "image-unverified" : "image-missing");
  if (!officialUrl) issues.push("official-url-missing");
  if (areaIds.length > 1) issues.push("multi-area-source");

  return {
    wp_post_id: wpPostId,
    slug,
    canonical_path: `/shops/${slug}/`,
    name: rendered(shop?.title),
    description_html: rendered(shop?.content),
    excerpt: rendered(shop?.excerpt),
    official_url: officialUrl,
    phone: nullable(acf.shop_tel),
    address_text: addressAccessMixed ? null : nullable(addressSource),
    access_text: addressAccessMixed ? addressSource : null,
    booking_url: null,
    date_gmt: nullable(shop?.date_gmt),
    modified_gmt: nullable(shop?.modified_gmt),
    area_ids: areaIds,
    featured_media: image.featured_media,
    image_url: image.image_url,
    shop_hours: nullable(acf.shop_hours),
    shop_booking: nullable(acf.shop_booking),
    basic_price: basicPrice,
    issues
  };
}

export function normalizeTrialArea(area) {
  const wpTermId = positiveInteger(area?.id);
  const slug = text(area?.slug);
  const name = text(area?.name);
  if (!wpTermId || !slug || !name) {
    throw new Error("Full import area requires a positive WordPress ID, slug, and name");
  }

  const parentWpTermId = positiveInteger(area?.parent);
  const sourceCount = Number(area?.count);
  return {
    wp_term_id: wpTermId,
    slug,
    name,
    parent_wp_term_id: parentWpTermId,
    description: text(area?.description),
    source_count: Number.isSafeInteger(sourceCount) && sourceCount >= 0 ? sourceCount : 0
  };
}

function assertUuid(value, label) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new Error(`${label} must be a UUID`);
  }
}

function assertTrialShops(shops) {
  if (!Array.isArray(shops) || shops.length === 0) {
    throw new Error("Trial SQL requires at least one normalized shop");
  }
  const ids = shops.map((shop) => shop?.wp_post_id);
  if (ids.some((id) => !Number.isSafeInteger(id) || id <= 0)) {
    throw new Error("Every trial shop requires a positive wp_post_id");
  }
  if (new Set(ids).size !== ids.length) {
    throw new Error("Trial shop wp_post_id values must be unique");
  }
  if (shops.some((shop) => !shop.area_ids?.includes(46))) {
    throw new Error("Every trial shop must belong to WordPress area 46");
  }
}

function sqlLiteral(value) {
  return `'${text(value).replaceAll("'", "''")}'`;
}

function sortedShops(shops) {
  return [...shops].sort((left, right) => left.wp_post_id - right.wp_post_id);
}

function trialJson(shops) {
  const json = JSON.stringify(sortedShops(shops), null, 2);
  if (json.includes("$trial$")) {
    throw new Error("Trial payload contains the reserved SQL delimiter");
  }
  return json;
}

export function renderTrialImportSql({
  shops,
  batchId,
  trialKey,
  sourceUrl,
  selectedAt,
  area = {
    wp_term_id: 46,
    slug: "sakaisujihonmachi",
    name: "堺筋本町",
    parent_wp_term_id: 2,
    source_count: 93
  }
}) {
  assertUuid(batchId, "batchId");
  assertTrialShops(shops);
  if (!/^[a-z0-9-]+$/.test(trialKey)) {
    throw new Error("trialKey must contain only lowercase letters, digits, and hyphens");
  }

  const rows = sortedShops(shops);
  const shopMarkers = rows.map((shop) => `-- shop wp_post_id=${shop.wp_post_id}`).join("\n");
  const selectedTimestamp = selectedAt || new Date().toISOString();

  return `begin;

set local statement_timeout = '30s';

insert into private.import_batches (
  id,
  source_system,
  source_url,
  status,
  started_at,
  finished_at,
  source_count,
  imported_count,
  failed_count,
  metadata
)
values (
  ${sqlLiteral(batchId)},
  'wordpress',
  ${sqlLiteral(sourceUrl)},
  'completed',
  now(),
  now(),
  ${rows.length},
  ${rows.length},
  0,
  jsonb_build_object(
    'trial_key', ${sqlLiteral(trialKey)},
    'area_wp_term_id', ${Number(area.wp_term_id)},
    'selection', jsonb_build_array(
      'all-missing-price',
      'all-missing-image',
      'all-missing-official-url',
      'complete-and-multi-area-controls'
    ),
    'selected_at', ${sqlLiteral(selectedTimestamp)},
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

create temporary table trial_import_shops (
  payload jsonb not null
) on commit drop;

${shopMarkers}
insert into trial_import_shops (payload)
select value
from jsonb_array_elements(
$trial$${trialJson(rows)}$trial$::jsonb
);

insert into app.areas (
  wp_term_id,
  slug,
  name,
  description,
  legacy_payload,
  is_published,
  published_at
)
values (
  ${Number(area.wp_term_id)},
  ${sqlLiteral(area.slug)},
  ${sqlLiteral(area.name)},
  '',
  jsonb_build_object(
    'id', ${Number(area.wp_term_id)},
    'slug', ${sqlLiteral(area.slug)},
    'name', ${sqlLiteral(area.name)},
    'parent', ${Number(area.parent_wp_term_id)},
    'description', '',
    'count_at_selection', ${Number(area.source_count)}
  ),
  false,
  null
)
on conflict (wp_term_id) do update set
  slug = excluded.slug,
  name = excluded.name,
  description = excluded.description,
  legacy_payload = excluded.legacy_payload,
  is_published = false,
  published_at = null,
  updated_at = now();

insert into app.shops (
  wp_post_id,
  slug,
  canonical_path,
  name,
  description_html,
  excerpt,
  official_url,
  phone,
  address_text,
  access_text,
  booking_url,
  legacy_payload,
  publication_status,
  published_at
)
select
  (payload ->> 'wp_post_id')::bigint,
  payload ->> 'slug',
  payload ->> 'canonical_path',
  payload ->> 'name',
  coalesce(payload ->> 'description_html', ''),
  coalesce(payload ->> 'excerpt', ''),
  nullif(payload ->> 'official_url', ''),
  nullif(payload ->> 'phone', ''),
  nullif(payload ->> 'address_text', ''),
  nullif(payload ->> 'access_text', ''),
  null,
  payload,
  'draft',
  null
from trial_import_shops
on conflict (wp_post_id) do update set
  slug = excluded.slug,
  canonical_path = excluded.canonical_path,
  name = excluded.name,
  description_html = excluded.description_html,
  excerpt = excluded.excerpt,
  official_url = excluded.official_url,
  phone = excluded.phone,
  address_text = excluded.address_text,
  access_text = excluded.access_text,
  booking_url = excluded.booking_url,
  legacy_payload = excluded.legacy_payload,
  publication_status = 'draft',
  published_at = null,
  updated_at = now();

insert into app.shop_areas (shop_id, area_id, is_primary, source_system)
select shops.id, areas.id, false, 'wordpress'
from trial_import_shops as trial
join app.shops as shops
  on shops.wp_post_id = (trial.payload ->> 'wp_post_id')::bigint
join app.areas as areas
  on areas.wp_term_id = ${Number(area.wp_term_id)}
on conflict (shop_id, area_id) do update set
  is_primary = false,
  source_system = excluded.source_system;

insert into app.shop_prices (
  shop_id,
  course_name,
  amount_yen,
  notes,
  is_public,
  verified_at
)
select
  shops.id,
  '基本料金（WordPress移行値）',
  (trial.payload ->> 'basic_price')::integer,
  'trial-source:wordpress-basic_price; verification required',
  false,
  null
from trial_import_shops as trial
join app.shops as shops
  on shops.wp_post_id = (trial.payload ->> 'wp_post_id')::bigint
where trial.payload ->> 'basic_price' is not null
  and not exists (
    select 1
    from app.shop_prices as existing
    where existing.shop_id = shops.id
      and existing.course_name = '基本料金（WordPress移行値）'
      and existing.amount_yen = (trial.payload ->> 'basic_price')::integer
  );

insert into app.shop_images (
  shop_id,
  wp_media_id,
  image_url,
  alt_text,
  image_role,
  sort_order,
  is_public,
  verified_at
)
select
  shops.id,
  (trial.payload ->> 'featured_media')::bigint,
  trial.payload ->> 'image_url',
  '',
  'featured',
  0,
  false,
  null
from trial_import_shops as trial
join app.shops as shops
  on shops.wp_post_id = (trial.payload ->> 'wp_post_id')::bigint
where nullif(trial.payload ->> 'image_url', '') is not null
on conflict (shop_id, image_url) do update set
  wp_media_id = excluded.wp_media_id,
  alt_text = excluded.alt_text,
  image_role = excluded.image_role,
  sort_order = excluded.sort_order,
  is_public = false,
  verified_at = null,
  updated_at = now();

insert into private.import_records (
  batch_id,
  entity_type,
  source_id,
  target_table,
  target_id,
  status,
  source_payload,
  transformed_payload,
  issues,
  imported_at
)
select
  ${sqlLiteral(batchId)}::uuid,
  'shop',
  trial.payload ->> 'wp_post_id',
  'app.shops',
  shops.id,
  'imported',
  trial.payload,
  jsonb_build_object(
    'publication_status', 'draft',
    'linked_area_wp_term_id', ${Number(area.wp_term_id)},
    'price_is_public', false,
    'image_is_public', false
  ),
  coalesce(trial.payload -> 'issues', '[]'::jsonb),
  now()
from trial_import_shops as trial
join app.shops as shops
  on shops.wp_post_id = (trial.payload ->> 'wp_post_id')::bigint
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

export function renderTrialVerifySql({ shops, batchId, areaWpTermId = 46 }) {
  assertUuid(batchId, "batchId");
  assertTrialShops(shops);
  const rows = sortedShops(shops);
  const shopIds = rows.map((shop) => shop.wp_post_id);
  const expectedPrices = rows.filter((shop) => shop.basic_price).length;
  const expectedImages = rows.filter((shop) => shop.image_url).length;

  return `begin;

set local statement_timeout = '30s';

do $$
declare
  trial_shop_ids constant bigint[] := array[${shopIds.join(", ")}];
  stored_areas integer;
  stored_shops integer;
  stored_links integer;
  stored_prices integer;
  stored_images integer;
  stored_batches integer;
  stored_records integer;
begin
  select count(*) into stored_areas
  from app.areas
  where wp_term_id = ${Number(areaWpTermId)}
    and not is_published
    and published_at is null;

  select count(*) into stored_shops
  from app.shops
  where wp_post_id = any(trial_shop_ids)
    and publication_status = 'draft'
    and published_at is null;

  select count(*) into stored_links
  from app.shop_areas as links
  join app.shops as shops on shops.id = links.shop_id
  join app.areas as areas on areas.id = links.area_id
  where shops.wp_post_id = any(trial_shop_ids)
    and areas.wp_term_id = ${Number(areaWpTermId)}
    and not links.is_primary;

  select count(*) into stored_prices
  from app.shop_prices as prices
  join app.shops as shops on shops.id = prices.shop_id
  where shops.wp_post_id = any(trial_shop_ids)
    and not prices.is_public
    and prices.verified_at is null;

  select count(*) into stored_images
  from app.shop_images as images
  join app.shops as shops on shops.id = images.shop_id
  where shops.wp_post_id = any(trial_shop_ids)
    and not images.is_public
    and images.verified_at is null;

  select count(*) into stored_batches
  from private.import_batches
  where id = ${sqlLiteral(batchId)}::uuid
    and status = 'completed'
    and source_count = ${rows.length}
    and imported_count = ${rows.length}
    and failed_count = 0;

  select count(*) into stored_records
  from private.import_records
  where batch_id = ${sqlLiteral(batchId)}::uuid
    and entity_type = 'shop'
    and status = 'imported';

  if not stored_areas = 1 then
    raise exception 'Expected 1 nonpublic trial area, found %', stored_areas;
  end if;
  if not stored_shops = ${rows.length} then
    raise exception 'Expected ${rows.length} draft trial shops, found %', stored_shops;
  end if;
  if not stored_links = ${rows.length} then
    raise exception 'Expected ${rows.length} non-primary trial area links, found %', stored_links;
  end if;
  if not stored_prices = ${expectedPrices} then
    raise exception 'Expected ${expectedPrices} nonpublic trial prices, found %', stored_prices;
  end if;
  if not stored_images = ${expectedImages} then
    raise exception 'Expected ${expectedImages} nonpublic trial images, found %', stored_images;
  end if;
  if not stored_batches = 1 then
    raise exception 'Expected 1 completed trial batch, found %', stored_batches;
  end if;
  if not stored_records = ${rows.length} then
    raise exception 'Expected ${rows.length} imported trial records, found %', stored_records;
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
    raise exception 'Trial data leaked into public API views: % rows', public_rows;
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

function assertFullImportRows(shops, areas) {
  if (!Array.isArray(areas) || areas.length === 0) {
    throw new Error("Full import requires at least one normalized area");
  }
  if (!Array.isArray(shops) || shops.length === 0) {
    throw new Error("Full import requires at least one normalized shop");
  }

  const areaIds = areas.map((area) => area?.wp_term_id);
  const shopIds = shops.map((shop) => shop?.wp_post_id);
  if (areaIds.some((id) => !Number.isSafeInteger(id) || id <= 0)) {
    throw new Error("Every full import area requires a positive wp_term_id");
  }
  if (shopIds.some((id) => !Number.isSafeInteger(id) || id <= 0)) {
    throw new Error("Every full import shop requires a positive wp_post_id");
  }
  if (new Set(areaIds).size !== areaIds.length || new Set(shopIds).size !== shopIds.length) {
    throw new Error("Full import WordPress IDs must be unique");
  }

  const knownAreaIds = new Set(areaIds);
  for (const area of areas) {
    if (area.parent_wp_term_id && !knownAreaIds.has(area.parent_wp_term_id)) {
      throw new Error(`Area ${area.wp_term_id} references unknown parent ${area.parent_wp_term_id}`);
    }
  }
  for (const shop of shops) {
    for (const areaId of shop.area_ids || []) {
      if (!knownAreaIds.has(areaId)) {
        throw new Error(`Shop ${shop.wp_post_id} references unknown area ${areaId}`);
      }
    }
  }
}

function sortedAreas(areas) {
  return [...areas].sort((left, right) => left.wp_term_id - right.wp_term_id);
}

function fullImportJson(rows, delimiter) {
  const json = JSON.stringify(rows, null, 2);
  if (json.includes(delimiter)) {
    throw new Error(`Full import payload contains the reserved SQL delimiter ${delimiter}`);
  }
  return json;
}

export function renderFullImportSql({ shops, areas, batchId, sourceUrl, selectedAt }) {
  assertUuid(batchId, "batchId");
  assertFullImportRows(shops, areas);
  const areaRows = sortedAreas(areas);
  const shopRows = sortedShops(shops);
  const areaMarkers = areaRows.map((area) => `-- area wp_term_id=${area.wp_term_id}`).join("\n");
  const shopMarkers = shopRows.map((shop) => `-- shop wp_post_id=${shop.wp_post_id}`).join("\n");
  const selectedTimestamp = selectedAt || new Date().toISOString();

  return `begin;

set local statement_timeout = '120s';

insert into private.import_batches (
  id, source_system, source_url, status, started_at, finished_at,
  source_count, imported_count, failed_count, metadata
)
values (
  ${sqlLiteral(batchId)}, 'wordpress', ${sqlLiteral(sourceUrl)}, 'completed', now(), now(),
  ${shopRows.length}, ${shopRows.length}, 0,
  jsonb_build_object(
    'import_key', '20260714-wordpress-full-382',
    'area_count', ${areaRows.length},
    'selected_at', ${sqlLiteral(selectedTimestamp)},
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

create temporary table full_import_areas (payload jsonb not null) on commit drop;
create temporary table full_import_shops (payload jsonb not null) on commit drop;

${areaMarkers}
insert into full_import_areas (payload)
select value from jsonb_array_elements(
$areas$${fullImportJson(areaRows, "$areas$")}$areas$::jsonb
);

${shopMarkers}
insert into full_import_shops (payload)
select value from jsonb_array_elements(
$shops$${fullImportJson(shopRows, "$shops$")}$shops$::jsonb
);

insert into app.areas (
  wp_term_id, slug, name, parent_id, description, legacy_payload, is_published, published_at
)
select
  (payload ->> 'wp_term_id')::bigint,
  payload ->> 'slug',
  payload ->> 'name',
  null,
  coalesce(payload ->> 'description', ''),
  payload,
  false,
  null
from full_import_areas
on conflict (wp_term_id) do update set
  slug = excluded.slug,
  name = excluded.name,
  parent_id = null,
  description = excluded.description,
  legacy_payload = excluded.legacy_payload,
  is_published = false,
  published_at = null,
  updated_at = now();

update app.areas as children
set parent_id = parents.id,
    updated_at = now()
from full_import_areas as source
join app.areas as parents
  on parents.wp_term_id = (source.payload ->> 'parent_wp_term_id')::bigint
where children.wp_term_id = (source.payload ->> 'wp_term_id')::bigint
  and source.payload ->> 'parent_wp_term_id' is not null;

insert into app.shops (
  wp_post_id, slug, canonical_path, name, description_html, excerpt,
  official_url, phone, address_text, access_text, booking_url,
  legacy_payload, publication_status, published_at
)
select
  (payload ->> 'wp_post_id')::bigint,
  payload ->> 'slug',
  payload ->> 'canonical_path',
  payload ->> 'name',
  coalesce(payload ->> 'description_html', ''),
  coalesce(payload ->> 'excerpt', ''),
  nullif(payload ->> 'official_url', ''),
  nullif(payload ->> 'phone', ''),
  nullif(payload ->> 'address_text', ''),
  nullif(payload ->> 'access_text', ''),
  null,
  payload,
  'draft',
  null
from full_import_shops
on conflict (wp_post_id) do update set
  slug = excluded.slug,
  canonical_path = excluded.canonical_path,
  name = excluded.name,
  description_html = excluded.description_html,
  excerpt = excluded.excerpt,
  official_url = excluded.official_url,
  phone = excluded.phone,
  address_text = excluded.address_text,
  access_text = excluded.access_text,
  booking_url = excluded.booking_url,
  legacy_payload = excluded.legacy_payload,
  publication_status = 'draft',
  published_at = null,
  updated_at = now();

delete from app.shop_areas as links
using app.shops as shops, full_import_shops as trial
where links.shop_id = shops.id
  and shops.wp_post_id = (trial.payload ->> 'wp_post_id')::bigint
  and links.source_system = 'wordpress';

insert into app.shop_areas (shop_id, area_id, is_primary, source_system)
select shops.id, areas.id, false, 'wordpress'
from full_import_shops as trial
join app.shops as shops
  on shops.wp_post_id = (trial.payload ->> 'wp_post_id')::bigint
cross join lateral jsonb_array_elements_text(
  coalesce(trial.payload -> 'area_ids', '[]'::jsonb)
) as area_term(value)
join app.areas as areas
  on areas.wp_term_id = area_term.value::bigint
on conflict (shop_id, area_id) do update set
  is_primary = false,
  source_system = excluded.source_system;

delete from app.shop_prices as prices
using app.shops as shops, full_import_shops as trial
where prices.shop_id = shops.id
  and shops.wp_post_id = (trial.payload ->> 'wp_post_id')::bigint
  and prices.course_name = '基本料金（WordPress移行値）'
  and prices.notes = 'trial-source:wordpress-basic_price; verification required'
  and not prices.is_public
  and prices.verified_at is null;

insert into app.shop_prices (shop_id, course_name, amount_yen, notes, is_public, verified_at)
select
  shops.id,
  '基本料金（WordPress移行値）',
  (trial.payload ->> 'basic_price')::integer,
  'trial-source:wordpress-basic_price; verification required',
  false,
  null
from full_import_shops as trial
join app.shops as shops
  on shops.wp_post_id = (trial.payload ->> 'wp_post_id')::bigint
where trial.payload ->> 'basic_price' is not null;

delete from app.shop_images as images
using app.shops as shops, full_import_shops as trial
where images.shop_id = shops.id
  and shops.wp_post_id = (trial.payload ->> 'wp_post_id')::bigint
  and images.image_role = 'featured'
  and images.wp_media_id is not null
  and not images.is_public
  and images.verified_at is null;

insert into app.shop_images (
  shop_id, wp_media_id, image_url, alt_text, image_role, sort_order, is_public, verified_at
)
select
  shops.id,
  (trial.payload ->> 'featured_media')::bigint,
  trial.payload ->> 'image_url',
  '',
  'featured',
  0,
  false,
  null
from full_import_shops as trial
join app.shops as shops
  on shops.wp_post_id = (trial.payload ->> 'wp_post_id')::bigint
where nullif(trial.payload ->> 'image_url', '') is not null
on conflict (shop_id, image_url) do update set
  wp_media_id = excluded.wp_media_id,
  alt_text = excluded.alt_text,
  image_role = excluded.image_role,
  sort_order = excluded.sort_order,
  is_public = false,
  verified_at = null,
  updated_at = now();

insert into private.import_records (
  batch_id, entity_type, source_id, target_table, target_id, status,
  source_payload, transformed_payload, issues, imported_at
)
select
  ${sqlLiteral(batchId)}::uuid,
  'shop',
  trial.payload ->> 'wp_post_id',
  'app.shops',
  shops.id,
  'imported',
  trial.payload,
  jsonb_build_object(
    'publication_status', 'draft',
    'linked_area_wp_term_ids', coalesce(trial.payload -> 'area_ids', '[]'::jsonb),
    'price_is_public', false,
    'image_is_public', false
  ),
  coalesce(trial.payload -> 'issues', '[]'::jsonb),
  now()
from full_import_shops as trial
join app.shops as shops
  on shops.wp_post_id = (trial.payload ->> 'wp_post_id')::bigint
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

export function renderFullVerifySql({ shops, areas, batchId }) {
  assertUuid(batchId, "batchId");
  assertFullImportRows(shops, areas);
  const areaRows = sortedAreas(areas);
  const shopRows = sortedShops(shops);
  const areaIds = areaRows.map((area) => area.wp_term_id);
  const shopIds = shopRows.map((shop) => shop.wp_post_id);
  const expectedLinks = shopRows.reduce((total, shop) => total + (shop.area_ids?.length || 0), 0);
  const expectedPrices = shopRows.filter((shop) => shop.basic_price).length;
  const expectedImages = shopRows.filter((shop) => shop.image_url).length;

  return `begin;

set local statement_timeout = '120s';

do $$
declare
  full_area_ids constant bigint[] := array[${areaIds.join(", ")}];
  full_shop_ids constant bigint[] := array[${shopIds.join(", ")}];
  stored_areas integer;
  stored_shops integer;
  stored_links integer;
  stored_prices integer;
  stored_images integer;
  stored_batches integer;
  stored_records integer;
  duplicate_prices integer;
  duplicate_images integer;
begin
  select count(*) into stored_areas
  from app.areas
  where wp_term_id = any(full_area_ids)
    and not is_published
    and published_at is null;

  select count(*) into stored_shops
  from app.shops
  where wp_post_id = any(full_shop_ids)
    and publication_status = 'draft'
    and published_at is null;

  select count(*) into stored_links
  from app.shop_areas as links
  join app.shops as shops on shops.id = links.shop_id
  join app.areas as areas on areas.id = links.area_id
  where shops.wp_post_id = any(full_shop_ids)
    and areas.wp_term_id = any(full_area_ids)
    and links.source_system = 'wordpress'
    and not links.is_primary;

  select count(*) into stored_prices
  from app.shop_prices as prices
  join app.shops as shops on shops.id = prices.shop_id
  where shops.wp_post_id = any(full_shop_ids)
    and prices.course_name = '基本料金（WordPress移行値）'
    and prices.notes = 'trial-source:wordpress-basic_price; verification required'
    and not prices.is_public
    and prices.verified_at is null;

  select count(*) into stored_images
  from app.shop_images as images
  join app.shops as shops on shops.id = images.shop_id
  where shops.wp_post_id = any(full_shop_ids)
    and images.image_role = 'featured'
    and not images.is_public
    and images.verified_at is null;

  select count(*) into stored_batches
  from private.import_batches
  where id = ${sqlLiteral(batchId)}::uuid
    and status = 'completed'
    and source_count = ${shopRows.length}
    and imported_count = ${shopRows.length}
    and failed_count = 0;

  select count(*) into stored_records
  from private.import_records
  where batch_id = ${sqlLiteral(batchId)}::uuid
    and entity_type = 'shop'
    and status = 'imported';

  select count(*) into duplicate_prices
  from (
    select prices.shop_id, prices.course_name, prices.amount_yen
    from app.shop_prices as prices
    join app.shops as shops on shops.id = prices.shop_id
    where shops.wp_post_id = any(full_shop_ids)
    group by prices.shop_id, prices.course_name, prices.amount_yen
    having count(*) > 1
  ) as duplicates;

  select count(*) into duplicate_images
  from (
    select images.shop_id, images.image_url
    from app.shop_images as images
    join app.shops as shops on shops.id = images.shop_id
    where shops.wp_post_id = any(full_shop_ids)
    group by images.shop_id, images.image_url
    having count(*) > 1
  ) as duplicates;

  if not stored_areas = ${areaRows.length} then
    raise exception 'Expected ${areaRows.length} nonpublic areas, found %', stored_areas;
  end if;
  if not stored_shops = ${shopRows.length} then
    raise exception 'Expected ${shopRows.length} draft shops, found %', stored_shops;
  end if;
  if not stored_links = ${expectedLinks} then
    raise exception 'Expected ${expectedLinks} WordPress area links, found %', stored_links;
  end if;
  if not stored_prices = ${expectedPrices} then
    raise exception 'Expected ${expectedPrices} nonpublic prices, found %', stored_prices;
  end if;
  if not stored_images = ${expectedImages} then
    raise exception 'Expected ${expectedImages} nonpublic images, found %', stored_images;
  end if;
  if not stored_batches = 1 or not stored_records = ${shopRows.length} then
    raise exception 'Expected completed full import batch with ${shopRows.length} records';
  end if;
  if duplicate_prices <> 0 or duplicate_images <> 0 then
    raise exception 'Full import contains duplicate price/image groups: % / %', duplicate_prices, duplicate_images;
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
    raise exception 'Full import leaked into public API views: % rows', public_rows;
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
