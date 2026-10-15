import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import vm from "node:vm";

const root = process.cwd();
const filename = join(root, "lib/managed-shop-source.ts");
const source = readFileSync(filename, "utf8")
  .replace('import "server-only";\n', "")
  .replace(/import \{[\s\S]*?\} from "@\/lib\/supabase\/managed-shop-directory";/, "")
  .replace(/import \{ normalizeShopRanking \} from "@\/lib\/shop-ranking";/, "const normalizeShopRanking = () => ({ availability: 'unavailable' });")
  .replace(/import \{ unavailableStrictRanking \} from "@\/lib\/ux-production-data-boundary";/, "const unavailableStrictRanking = () => ({ availability: 'unavailable', reason: 'shop' });");
const output = ts.transpileModule(source, { fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const module = { exports: {} };
vm.runInNewContext(output, { module, exports: module.exports, process: { env: {} } });
const { composeManagedShopPublications } = module.exports;

const legacy = {
  id: 768, publicationStatus: "publish", slug: "legacy-shop", link: "https://mens-esthe-kuchikomi.com/shops/legacy-shop/", title: "旧店舗",
  contentHtml: "旧紹介", excerpt: "旧紹介", imageUrl: "", media: { cardSquare: { mediaId: null, source: "fallback", url: "", alt: "旧店舗" }, detailBanner: null },
  terms: [], acf: { basic_price: "9000" }, officialUrl: "https://example.test/old", areaSlug: "old-area", primaryArea: null,
  ranking: { availability: "unavailable" }, strictRanking: { availability: "unavailable", reason: "shop" },
};
const overlay = {
  managed_shop_id: "11111111-1111-4111-8111-111111111111", directory_id: 1_000_000_001, existing_wp_shop_id: 768,
  shop_slug: "legacy-shop", canonical_url: legacy.link, approved_revision: 3, shop_name: "更新済み店舗", area_slug: "new-area", area_name: "新エリア",
  official_url: "https://example.test/new", introduction: "<script>unsafe</script>紹介", address: "大阪市", business_hours: "10:00", phone: "06", line_url: null, booking_url: null,
  basic_price: 12000, price_90: 15000, banner_asset_id: null, gallery_asset_ids: [],
};
const created = { ...overlay, managed_shop_id: "22222222-2222-4222-8222-222222222222", directory_id: 1_000_000_002, existing_wp_shop_id: null, shop_slug: "new-managed-shop", canonical_url: "https://mens-esthe-kuchikomi.com/shops/new-managed-shop/", shop_name: "新規店舗" };

const composed = composeManagedShopPublications([legacy], [overlay, created]);
assert.equal(composed.length, 2, "published new store must be appended without a WordPress row");
assert.equal(composed[0].id, 768, "legacy review identity must be preserved");
assert.equal(composed[0].title, "更新済み店舗");
assert.equal(composed[0].areaSlug, "new-area");
assert.equal(composed[0].acf.basic_price, "12000");
assert.equal(composed[0].contentHtml, "&lt;script&gt;unsafe&lt;/script&gt;紹介", "managed text cannot become raw HTML");
assert.equal(composed[1].id, 1_000_000_002, "new stores need a stable non-WordPress directory id");
assert.equal(composed[1].slug, "new-managed-shop");
assert.equal(composed[1].acf.managed_area_name, "新エリア");

const mismatch = composeManagedShopPublications([legacy], [{ ...overlay, shop_slug: "mismatched-slug" }]);
assert.equal(mismatch.length, 1, "legacy identity mismatch must not override or append a duplicate");
assert.equal(mismatch[0].title, "旧店舗");

console.log("managed-shop public source composition: PASS");
