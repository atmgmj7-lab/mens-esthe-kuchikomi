import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import vm from "node:vm";

const root = fileURLToPath(new URL("..", import.meta.url));
const docsRoot = join(root, "..", "docs", "data");
const readJson = (name) => JSON.parse(readFileSync(join(docsRoot, name), "utf8"));

function loadCoverageModule() {
  const source = readFileSync(join(root, "lib/shop-information-coverage.ts"), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
  }).outputText;
  const module = { exports: {} };
  const require = (id) => {
    if (id === "server-only") return {};
    if (id === "node:crypto") return { createHash };
    throw new Error(`Unexpected production coverage dependency: ${id}`);
  };
  vm.runInNewContext(compiled, { module, exports: module.exports, require, URL, Date }, { filename: "shop-information-coverage.cjs" });
  return module.exports;
}

const { canonicalizeShopFactValue, hashShopFactValue } = loadCoverageModule();

function positiveInteger(value) {
  if (typeof value === "number") return Number.isInteger(value) && value > 0 ? value : null;
  if (typeof value !== "string") return null;
  const match = value.normalize("NFKC").replace(/,/g, "").match(/\d{3,7}/);
  const amount = match ? Number(match[0]) : 0;
  return Number.isInteger(amount) && amount > 0 ? amount : null;
}

function telHref(value) {
  const digits = typeof value === "string" ? value.replace(/[^0-9]/g, "") : "";
  return digits ? `tel:${digits}` : "";
}

const emptyModel = () => ({ actions: [], images: [], infoRows: [], prices: [] });

function currentModel(snapshot) {
  const model = emptyModel();
  for (const duration of [50, 60, 70, 80, 90, 120, 150]) {
    const key = `price_${duration}`;
    const amount = positiveInteger(snapshot[key]);
    if (amount) model.prices.push({ key, label: `${duration}分`, price: { status: "confirmed", amount } });
  }
  if (typeof snapshot.shop_hours === "string" && snapshot.shop_hours.trim()) model.infoRows.push({ key: "hours", value: snapshot.shop_hours });
  if (typeof snapshot.shop_address === "string" && snapshot.shop_address.trim()) model.infoRows.push({ key: "address", value: snapshot.shop_address });
  const phone = telHref(snapshot.shop_tel);
  if (phone) model.actions.push({ kind: "tel", href: phone });
  if (typeof snapshot.official_url === "string" && snapshot.official_url.trim()) model.actions.push({ kind: "official", href: snapshot.official_url });
  return model;
}

function verifiedModel(evidence) {
  const model = emptyModel();
  for (const course of evidence.prices?.courses ?? []) {
    const duration = positiveInteger(course.duration_minutes);
    const amount = positiveInteger(course.amount_yen);
    if (duration && amount) model.prices.push({ key: `price_${duration}`, label: `${duration}分`, price: { status: "confirmed", amount } });
  }
  const hours = evidence.business_hours?.value?.display;
  if (typeof hours === "string" && hours.trim()) model.infoRows.push({ key: "hours", value: hours });
  const stations = (evidence.access_points ?? []).map((point) => [point.station, point.exit, point.walk_minutes ? `徒歩${point.walk_minutes}分` : ""].filter(Boolean).join(" ")).filter(Boolean).join("\n");
  if (stations) model.infoRows.push({ key: "station", value: stations });
  if (typeof evidence.address?.value === "string" && evidence.address.value.trim()) model.infoRows.push({ key: "address", value: evidence.address.value });
  for (const method of evidence.contact?.booking_methods ?? []) {
    const kind = method.type === "web" ? "reservation" : method.type;
    const href = kind === "tel" ? telHref(method.url) : method.url;
    if (["reservation", "line", "tel"].includes(kind) && href) model.actions.push({ kind, href });
  }
  if (model.actions.length === 0) {
    const phone = telHref(evidence.contact?.phone?.value);
    if (phone) model.actions.push({ kind: "tel", href: phone });
  }
  if (typeof evidence.official_url?.value === "string" && evidence.official_url.value.trim()) model.actions.push({ kind: "official", href: evidence.official_url.value });
  return model;
}

const contracts = {
  price: { verified: (item) => item.prices?.status === "verified", sourceFields: ["prices"] },
  hours: { verified: (item) => item.business_hours?.status === "verified", sourceFields: ["business_hours"] },
  access: { verified: (item) => item.address?.status === "verified" || (item.access_points?.length ?? 0) > 0, sourceFields: ["address", "access_points"] },
  booking: { verified: (item) => (item.contact?.booking_methods?.length ?? 0) > 0, sourceFields: ["contact.phone", "contact.booking_methods"] },
  official: { verified: (item) => item.official_url?.status === "verified", sourceFields: ["official_url"] },
  image: { verified: () => false, sourceFields: [] }
};

function findSource(item, sourceFields) {
  return (item.sources ?? []).find((source) => source.kind === "official-site" && typeof source.url === "string" && typeof source.checked_on === "string" && source.fields?.some((field) => sourceFields.includes(field)));
}

const source = readJson("sakaisujihonmachi-phase4-30-shops-2026-07-15.json");
const evidenceById = readJson("sakaisujihonmachi-phase4-evidence-2026-07-15.json");
const provenanceCandidates = [];
const blocked = [];

for (const shop of source.shops) {
  const evidence = evidenceById[String(shop.wp_post_id)] ?? shop;
  const published = currentModel(shop.wordpress_snapshot ?? {});
  const verified = verifiedModel(evidence);
  for (const [field, contract] of Object.entries(contracts)) {
    if (!contract.verified(evidence)) continue;
    const evidenceSource = findSource(evidence, contract.sourceFields);
    if (!evidenceSource) {
      blocked.push({ wpPostId: shop.wp_post_id, wordpressTitle: shop.wordpress_title, field, status: "blocked-missing-source", reason: "確認済み値に対応する一次情報URLと確認日がありません。" });
      continue;
    }
    const currentCanonical = canonicalizeShopFactValue(field, published);
    const verifiedCanonical = canonicalizeShopFactValue(field, verified);
    if ((currentCanonical === '""' || currentCanonical === "[]") || currentCanonical !== verifiedCanonical) {
      blocked.push({ wpPostId: shop.wp_post_id, wordpressTitle: shop.wordpress_title, field, status: "blocked-value-mismatch", reason: "WordPressの現在公開値と一次情報で確認した値が一致しません。" });
      continue;
    }
    provenanceCandidates.push({
      wpPostId: shop.wp_post_id,
      wordpressTitle: shop.wordpress_title,
      field,
      sourceUrl: evidenceSource.url,
      sourceType: "official-site",
      observedAt: evidenceSource.checked_on,
      reviewedAt: evidenceSource.checked_on,
      reviewStatus: "reviewed",
      publishedValueHash: hashShopFactValue(field, published)
    });
  }
}

const preview = {
  schemaVersion: 1,
  preparedOn: "2026-07-18",
  mode: "local-preview-only",
  sourceFiles: ["sakaisujihonmachi-phase4-30-shops-2026-07-15.json", "sakaisujihonmachi-phase4-evidence-2026-07-15.json"],
  selection: { areaSlug: source.area.slug, shopCount: source.shops.length, rankingClaim: source.selection.ranking_claim },
  provenanceCandidates,
  blocked,
  rankingCandidates: [],
  applied: false
};

const excluded = {
  schemaVersion: 1,
  preparedOn: "2026-07-18",
  mode: "local-preview-only",
  shops: [
    { wpPostId: 1259, wordpressTitle: "あしぎぬ温泉" },
    { wpPostId: 1255, wordpressTitle: "天然温泉 ひなたの湯" }
  ].map((shop) => ({
    ...shop,
    currentState: { postType: "shop", postStatus: "publish", indexable: true },
    requestedAction: "draft",
    applied: false,
    postApplyChecks: {
      route: "WordPressの現在slugで店舗詳細が200を返さない",
      sitemap: "店舗sitemapにWordPress IDが含まれない",
      internalLinks: "店舗一覧・地域一覧・関連導線にWordPress IDが含まれない"
    }
  }))
};

writeFileSync(join(docsRoot, "shop-public-meta-seed-preview-2026-07-18.json"), `${JSON.stringify(preview, null, 2)}\n`);
writeFileSync(join(docsRoot, "excluded-shop-draft-preview-2026-07-18.json"), `${JSON.stringify(excluded, null, 2)}\n`);
console.log(`shop public meta seed preview prepared: ${provenanceCandidates.length} candidates, ${blocked.length} blocked`);
