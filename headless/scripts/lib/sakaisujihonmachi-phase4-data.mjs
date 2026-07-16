import assert from "node:assert/strict";

export const PHASE4_VERIFIED_ON = "2026-07-15";

export const SAKAISUJIHONMACHI_PHASE4_SHOP_IDS = Object.freeze([
  1237, 1221, 1210, 1203, 880, 883, 885, 838, 853, 799,
  805, 807, 812, 815, 817, 820, 826, 828, 794, 795,
  747, 763, 775, 779, 715, 716, 700, 717, 701, 719
]);

const VERIFICATION_STATUSES = new Set(["verified", "unverified", "not-published"]);
const SOURCE_KINDS = new Set(["official-site", "official-booking", "official-social"]);
const BOOKING_METHOD_TYPES = new Set(["phone", "web", "line", "dm", "other"]);
const BANNED_SOURCE_HOSTS = [
  "mens-esthe-kuchikomi.com",
  "refle.info"
];
const BANNED_KEYS = /(?:review|rating|口コミ|評価)/i;

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function assertIsoDate(value, label) {
  assert.match(text(value), /^\d{4}-\d{2}-\d{2}$/, `${label} must be YYYY-MM-DD`);
}

function sourceMapFor(shop) {
  assert.ok(Array.isArray(shop.sources), `shop ${shop.wp_post_id} sources must be an array`);
  const map = new Map();
  for (const source of shop.sources) {
    assert.ok(source && typeof source === "object", `shop ${shop.wp_post_id} source must be an object`);
    assert.ok(text(source.id), `shop ${shop.wp_post_id} source id is required`);
    assert.ok(!map.has(source.id), `shop ${shop.wp_post_id} source id ${source.id} is duplicated`);
    assert.ok(SOURCE_KINDS.has(source.kind), `shop ${shop.wp_post_id} source ${source.id} must be primary`);
    assert.ok(text(source.title), `shop ${shop.wp_post_id} source ${source.id} title is required`);
    assertIsoDate(source.checked_on, `shop ${shop.wp_post_id} source ${source.id} checked_on`);
    assert.ok(Array.isArray(source.fields) && source.fields.length > 0, `shop ${shop.wp_post_id} source ${source.id} fields are required`);

    const url = new URL(source.url);
    assert.ok(["http:", "https:"].includes(url.protocol), `shop ${shop.wp_post_id} source ${source.id} URL must be HTTP(S)`);
    assert.ok(
      !BANNED_SOURCE_HOSTS.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`)),
      `shop ${shop.wp_post_id} source ${source.id} uses a non-primary host`
    );
    map.set(source.id, source);
  }
  return map;
}

function assertSourceIds(sourceIds, sourceMap, label, required) {
  assert.ok(Array.isArray(sourceIds), `${label} source_ids must be an array`);
  if (required) {
    assert.ok(sourceIds.length > 0, `${label} requires a primary source`);
  }
  for (const sourceId of sourceIds) {
    assert.ok(sourceMap.has(sourceId), `${label} references unknown source ${sourceId}`);
  }
}

function assertFact(fact, sourceMap, label, { allowNotPublished = false } = {}) {
  assert.ok(fact && typeof fact === "object", `${label} must be an object`);
  assert.ok(VERIFICATION_STATUSES.has(fact.status), `${label} has an invalid status`);
  if (!allowNotPublished) {
    assert.notEqual(fact.status, "not-published", `${label} cannot be not-published`);
  }

  if (fact.status === "verified") {
    assert.notEqual(fact.value, null, `${label} verified value is required`);
    assert.notEqual(fact.value, "", `${label} verified value cannot be blank`);
    assertSourceIds(fact.source_ids, sourceMap, label, true);
    return;
  }

  if (fact.status === "not-published") {
    assertSourceIds(fact.source_ids, sourceMap, label, true);
    return;
  }

  assert.equal(fact.value, null, `${label} unverified value must be null`);
  assertSourceIds(fact.source_ids, sourceMap, label, false);
  assert.equal(fact.source_ids.length, 0, `${label} unverified value cannot cite a source`);
}

function assertNoReviewOrRatingKeys(value, path = "dataset") {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoReviewOrRatingKeys(item, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, item] of Object.entries(value)) {
    assert.ok(!BANNED_KEYS.test(key), `${path}.${key} is prohibited in Phase 4 data`);
    assertNoReviewOrRatingKeys(item, `${path}.${key}`);
  }
}

function assertBusinessHours(shop, sourceMap) {
  const hours = shop.business_hours;
  assertFact(hours, sourceMap, `shop ${shop.wp_post_id} business_hours`);
  if (hours.status !== "verified") return;
  assert.ok(text(hours.value.display), `shop ${shop.wp_post_id} business_hours display is required`);
  assert.equal(typeof hours.value.closes_next_day, "boolean", `shop ${shop.wp_post_id} closes_next_day must be boolean`);
  assert.equal(typeof hours.value.is_24_hours, "boolean", `shop ${shop.wp_post_id} is_24_hours must be boolean`);
  if (!hours.value.is_24_hours) {
    assert.match(text(hours.value.opens_at), /^\d{2}:\d{2}$/, `shop ${shop.wp_post_id} opens_at is required`);
    assert.ok(
      hours.value.closes_at === null || /^\d{2}:\d{2}$/.test(text(hours.value.closes_at)),
      `shop ${shop.wp_post_id} closes_at must be HH:MM or null`
    );
    if (hours.value.closes_at === null) {
      assert.equal(hours.value.closes_next_day, false, `shop ${shop.wp_post_id} open-ended hours cannot infer a closing day`);
    }
  }
}

function assertPrices(shop, sourceMap) {
  const prices = shop.prices;
  assert.ok(prices && typeof prices === "object", `shop ${shop.wp_post_id} prices must be an object`);
  assert.ok(["verified", "unverified"].includes(prices.status), `shop ${shop.wp_post_id} prices has an invalid status`);
  assert.ok(Array.isArray(prices.courses), `shop ${shop.wp_post_id} prices.courses must be an array`);
  assertSourceIds(prices.source_ids, sourceMap, `shop ${shop.wp_post_id} prices`, prices.status === "verified");

  if (prices.status === "unverified") {
    assert.equal(prices.courses.length, 0, `shop ${shop.wp_post_id} unverified prices cannot include courses`);
    assert.equal(prices.representative_course_index, null, `shop ${shop.wp_post_id} unverified prices cannot have a representative course`);
    assert.equal(prices.source_ids.length, 0, `shop ${shop.wp_post_id} unverified prices cannot cite a source`);
    return;
  }

  assert.ok(prices.courses.length > 0, `shop ${shop.wp_post_id} verified prices require courses`);
  for (const [index, course] of prices.courses.entries()) {
    assert.ok(text(course.name), `shop ${shop.wp_post_id} course ${index} name is required`);
    assert.ok(Number.isSafeInteger(course.duration_minutes) && course.duration_minutes > 0, `shop ${shop.wp_post_id} course ${index} duration must be positive`);
    assert.ok(Number.isSafeInteger(course.amount_yen) && course.amount_yen > 0, `shop ${shop.wp_post_id} course ${index} amount must be positive`);
    assert.equal(typeof course.representative_eligible, "boolean", `shop ${shop.wp_post_id} course ${index} representative_eligible must be boolean`);
    assertSourceIds(course.source_ids, sourceMap, `shop ${shop.wp_post_id} course ${index}`, true);
  }

  const eligible = prices.courses
    .map((course, index) => ({ course, index }))
    .filter(({ course }) => course.representative_eligible)
    .sort((left, right) =>
      left.course.duration_minutes - right.course.duration_minutes ||
      left.course.amount_yen - right.course.amount_yen ||
      left.index - right.index
    );
  assert.ok(eligible.length > 0, `shop ${shop.wp_post_id} verified prices require a representative-eligible course`);
  assert.equal(
    prices.representative_course_index,
    eligible[0].index,
    `shop ${shop.wp_post_id} representative course violates the fixed rule`
  );
}

function assertAccess(shop, sourceMap) {
  assert.ok(Array.isArray(shop.access_points), `shop ${shop.wp_post_id} access_points must be an array`);
  for (const [index, access] of shop.access_points.entries()) {
    assert.ok(text(access.station), `shop ${shop.wp_post_id} access ${index} station is required`);
    assert.ok(access.exit === null || text(access.exit), `shop ${shop.wp_post_id} access ${index} exit must be text or null`);
    assert.ok(
      access.walk_minutes === null || (Number.isSafeInteger(access.walk_minutes) && access.walk_minutes > 0),
      `shop ${shop.wp_post_id} access ${index} walk_minutes must be positive or null`
    );
    assertSourceIds(access.source_ids, sourceMap, `shop ${shop.wp_post_id} access ${index}`, true);
  }
}

function assertContact(shop, sourceMap) {
  assert.ok(shop.contact && typeof shop.contact === "object", `shop ${shop.wp_post_id} contact is required`);
  assertFact(shop.contact.phone, sourceMap, `shop ${shop.wp_post_id} contact.phone`);
  assert.ok(Array.isArray(shop.contact.booking_methods), `shop ${shop.wp_post_id} booking_methods must be an array`);
  for (const [index, method] of shop.contact.booking_methods.entries()) {
    assert.ok(BOOKING_METHOD_TYPES.has(method.type), `shop ${shop.wp_post_id} booking method ${index} type is invalid`);
    assert.ok(text(method.label), `shop ${shop.wp_post_id} booking method ${index} label is required`);
    if (method.url !== null) new URL(method.url);
    assertSourceIds(method.source_ids, sourceMap, `shop ${shop.wp_post_id} booking method ${index}`, true);
  }
}

export function validatePhase4Dataset(dataset) {
  assertNoReviewOrRatingKeys(dataset);
  assert.equal(dataset.schema_version, 1, "Phase 4 schema_version must be 1");
  assert.equal(dataset.area?.wp_term_id, 46, "Phase 4 area must be WordPress term 46");
  assert.equal(dataset.area?.slug, "sakaisujihonmachi", "Phase 4 area slug is invalid");
  assert.equal(dataset.selection?.method, "wordpress-rest-default-order", "Phase 4 selection method is invalid");
  assert.equal(dataset.selection?.selected_on, PHASE4_VERIFIED_ON, "Phase 4 selection date is invalid");
  assert.ok(Array.isArray(dataset.shops), "Phase 4 shops must be an array");
  assert.equal(dataset.shops.length, 30, "Phase 4 dataset must contain exactly 30 shops");

  const ids = dataset.shops.map((shop) => shop.wp_post_id);
  assert.equal(new Set(ids).size, 30, "Phase 4 WordPress IDs must be unique");
  assert.deepEqual(ids, [...SAKAISUJIHONMACHI_PHASE4_SHOP_IDS], "Phase 4 shop IDs or order changed");

  for (const [index, shop] of dataset.shops.entries()) {
    assert.equal(shop.selection_position, index + 1, `shop ${shop.wp_post_id} selection_position is invalid`);
    assert.ok(text(shop.wp_slug), `shop ${shop.wp_post_id} wp_slug is required`);
    assert.ok(text(shop.wordpress_title), `shop ${shop.wp_post_id} wordpress_title is required`);
    assertIsoDate(shop.verified_on, `shop ${shop.wp_post_id} verified_on`);
    assert.equal(shop.verified_on, PHASE4_VERIFIED_ON, `shop ${shop.wp_post_id} verified_on changed`);
    assert.ok(shop.wordpress_snapshot && typeof shop.wordpress_snapshot === "object", `shop ${shop.wp_post_id} WordPress snapshot is required`);

    const sourceMap = sourceMapFor(shop);
    assertFact(shop.official_name, sourceMap, `shop ${shop.wp_post_id} official_name`);
    assertFact(shop.official_url, sourceMap, `shop ${shop.wp_post_id} official_url`);
    assertFact(shop.address, sourceMap, `shop ${shop.wp_post_id} address`, { allowNotPublished: true });
    assert.ok(["public", "after-booking", "unknown"].includes(shop.address.visibility), `shop ${shop.wp_post_id} address visibility is invalid`);
    assertAccess(shop, sourceMap);
    assertBusinessHours(shop, sourceMap);
    assertPrices(shop, sourceMap);
    assertContact(shop, sourceMap);
    assertFact(shop.beginner_guidance, sourceMap, `shop ${shop.wp_post_id} beginner_guidance`);
    assert.ok(Array.isArray(shop.unverified_fields), `shop ${shop.wp_post_id} unverified_fields must be an array`);
    assert.ok(Array.isArray(shop.notes), `shop ${shop.wp_post_id} notes must be an array`);
  }

  return dataset;
}

export function buildPhase4Summary(dataset) {
  validatePhase4Dataset(dataset);
  return {
    total_shops: dataset.shops.length,
    official_name_verified: dataset.shops.filter((shop) => shop.official_name.status === "verified").length,
    hours_verified: dataset.shops.filter((shop) => shop.business_hours.status === "verified").length,
    prices_verified: dataset.shops.filter((shop) => shop.prices.status === "verified").length,
    access_points_verified: dataset.shops.reduce((sum, shop) => sum + shop.access_points.length, 0),
    booking_methods_verified: dataset.shops.reduce((sum, shop) => sum + shop.contact.booking_methods.length, 0)
  };
}
