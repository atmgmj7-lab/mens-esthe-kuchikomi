import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const required = [
  "app/dashboard/shops/page.tsx",
  "app/dashboard/shops/new/page.tsx",
  "app/dashboard/shops/[id]/page.tsx",
  "app/dashboard/shops/[id]/edit/page.tsx",
  "components/dashboard/OperatorShops.tsx",
  "components/dashboard/OperatorShopForms.tsx",
  "components/dashboard/OperatorShops.module.css",
  "lib/dashboard/operator-shop-projection.ts",
  "lib/dashboard/operator-shop-write-contract.ts",
  "lib/dashboard/official-facts-writer.ts",
  "lib/supabase/partner-shop-facts.ts",
  "app/api/dashboard/shops/[id]/official-facts/route.ts",
];

for (const path of required) {
  assert.equal(existsSync(join(root, path)), true, `${path} が必要です`);
}

const nav = readFileSync(join(root, "lib/dashboard/navigation.ts"), "utf8");
assert.match(nav, /href:\s*["']\/dashboard\/shops\/["']/);
assert.match(nav, /店舗管理/);

const proxy = readFileSync(join(root, "proxy.ts"), "utf8");
assert.match(proxy, /"\/dashboard\/:path\*"/, "店舗画面を含む /dashboard/ は既存Basic Auth境界で保護する");

const projection = readFileSync(join(root, "lib/dashboard/operator-shop-projection.ts"), "utf8");
assert.match(projection, /getAllShopsForListing/);
assert.match(projection, /listPartnerRegistrationReviews/);
assert.match(projection, /getPartnerReviewGrowthMetrics/);
assert.match(projection, /identity_mismatch/);
assert.doesNotMatch(projection, /\/rest\/v1\/private|Content-Profile:\s*["']private/i, "private schemaを直接読んではならない");

const writeContract = readFileSync(join(root, "lib/dashboard/operator-shop-write-contract.ts"), "utf8");
assert.match(writeContract, /WORDPRESS_WRITER_MAPPING_REQUIRED/);
assert.match(writeContract, /listing_exclusion/);
assert.doesNotMatch(writeContract, /fetch\s*\(/, "local UIはWordPressへ書き込んではならない");

const forms = readFileSync(join(root, "components/dashboard/OperatorShopForms.tsx"), "utf8");
assert.match(forms, /preventDefault\(\)/, "Create/Editフォームは承認済みWriter接続まで送信しない");
assert.match(forms, /\/api\/dashboard\/shops\/\$\{currentSnapshot\.wpShopId\}\/official-facts\//, "保存は限定サーバー経路だけを使用する");
assert.match(forms, /ブラウザ入力から根拠を作成することはありません/, "ブラウザ入力を根拠にしてはならない");
assert.match(forms, /expectedRevision:\s*currentSnapshot\.revision/, "Supabase保存は現在のrevisionを必須にする");
assert.match(forms, /response\.status === 409/, "競合時は最新snapshotへ戻して再確認させる");
const factsRoute = readFileSync(join(root, "app/api/dashboard/shops/[id]/official-facts/route.ts"), "utf8");
assert.match(factsRoute, /authorizeDashboardRequest/);
assert.match(factsRoute, /確認済みの公式根拠・canonical・監査情報が未連携/);
assert.match(factsRoute, /useSupabaseShopManagement/);
assert.match(factsRoute, /partnerShopFactsRepository\.save/);
assert.doesNotMatch(factsRoute, /new OfficialFactsWriter/, "未連携の根拠でWordPress Writerを起動してはならない");

const factsAdapter = readFileSync(join(root, "lib/supabase/partner-shop-facts.ts"), "utf8");
assert.match(factsAdapter, /Content-Profile": "api"/);
assert.doesNotMatch(factsAdapter, /rest\/v1\/private/i, "browser/public経路からprivate schemaを直接公開してはならない");

const presentation = readFileSync(join(root, "components/dashboard/OperatorShops.tsx"), "utf8");
for (const label of ["公開情報", "Partner", "口コミ", "Campaign", "QR / LINE / CTA / Widget", "掲載対象外"]) {
  assert.match(presentation, new RegExp(label));
}
assert.doesNotMatch(presentation, /contactEmail|contactName|confirmationDetails|service.?role/i, "Operator Shop統合表示は連絡先PII・service権限を投影しない");

const css = readFileSync(join(root, "components/dashboard/OperatorShops.module.css"), "utf8");
assert.match(css, /@media \(max-width: 700px\)/);
assert.match(css, /min-width: 0/);
assert.match(css, /overflow-wrap: anywhere/);

console.log("operator shop control center contract: PASS");
