import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const migration = readFileSync(resolve(projectRoot, "supabase/migrations/20261022180959_preserve_wordpress_only_public_shops.sql"), "utf8");
const source = JSON.parse(migration.match(/\$source\$(?<json>[\s\S]*?)\$source\$::jsonb/u)?.groups?.json ?? "");
const base = (process.env.ESKOMI_PREVIEW_BASE_URL ?? "https://eskomi-workers-prep.eskomi.workers.dev").replace(/\/$/u, "");

for (const shop of source) {
  const response = await fetch(`${base}${shop.canonical_path}`);
  assert.equal(response.status, 200, `${shop.slug} must serve from the preview`);
  assert.match(response.headers.get("x-robots-tag") ?? "", /noindex, nofollow/u, `${shop.slug} must stay noindex on preview`);
  const html = await response.text();
  assert.match(html, new RegExp(`rel="canonical" href="https://mens-esthe-kuchikomi\\.com${shop.canonical_path}"`, "u"), `${shop.slug} must retain its existing canonical URL`);
  for (const value of [shop.phone, shop.address_text, shop.access_text, shop.booking_url, shop.shop_hours, shop.shop_booking]) {
    if (typeof value === "string" && value.length > 0) assert.ok(html.includes(value), `${shop.slug} must render its exact existing public fact`);
  }
  if (Number.isSafeInteger(shop.basic_price)) {
    const price = new Intl.NumberFormat("ja-JP").format(shop.basic_price);
    assert.ok(html.includes(price), `${shop.slug} must render its exact existing public basic price`);
  }
}

console.log(`Scoped WordPress public-facts preview QA: PASS (${source.length} shops)`);
