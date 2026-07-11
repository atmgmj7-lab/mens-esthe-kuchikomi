import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";

const root = process.cwd();
const generatedDir = path.join(root, ".generated-tests", "promotion-disclosure");
execFileSync("rm", ["-rf", generatedDir], { stdio: "inherit" });
execFileSync("mkdir", ["-p", generatedDir], { stdio: "inherit" });

execFileSync(
  "npx",
  [
    "tsc",
    "--target",
    "ES2022",
    "--module",
    "CommonJS",
    "--moduleResolution",
    "node",
    "--esModuleInterop",
    "--skipLibCheck",
    "--outDir",
    generatedDir,
    "lib/promotion-disclosure.ts"
  ],
  { cwd: root, stdio: "inherit" }
);

const {
  resolvePromotionDisclosure,
  outboundRelForPromotion
} = await import(path.join(generatedDir, "promotion-disclosure.js"));

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const now = new Date("2026-07-11T00:00:00+09:00");

const isPr = resolvePromotionDisclosure({ is_pr: true }, now);
assert(isPr.requiresDisclosure === true, "is_pr=true はPR開示必須");
assert(isPr.canReceiveNaturalRankNumber === false, "is_pr=true は自然順位番号を受けない");
assert(outboundRelForPromotion(isPr) === "sponsored nofollow noreferrer", "PR外部リンクは sponsored/nofollow を付ける");

const sponsored = resolvePromotionDisclosure({ sponsored: "1" }, now);
assert(sponsored.promotionType === "sponsored", "sponsored=true は sponsored 扱い");
assert(sponsored.isEligibleForNaturalRanking === false, "sponsored=true は自然ランキング除外");

const affiliate = resolvePromotionDisclosure({ affiliate_network: "network-a" }, now);
assert(affiliate.requiresDisclosure === true, "affiliate は広告開示必須");
assert(affiliate.disclosureLabel === "広告", "affiliate は広告ラベル");

const featured = resolvePromotionDisclosure({ featured: true }, now);
assert(featured.requiresDisclosure === false, "featured=true だけではPRと断定しない");
assert(featured.promotionType === "manual-featured", "featured=true は手動注目枠");
assert(featured.canReceiveNaturalRankNumber === false, "featured=true は自然順位番号を受けない");

const recommended = resolvePromotionDisclosure({ recommended: true }, now);
assert(recommended.requiresDisclosure === false, "recommended=true だけではPRと断定しない");
assert(recommended.canReceiveNaturalRankNumber === false, "recommended=true は自然順位番号を受けない");

const areaRankOnly = resolvePromotionDisclosure({ area_rank: 1 }, now);
assert(areaRankOnly.requiresDisclosure === false, "area_rankのみはPR扱いしない");
assert(areaRankOnly.isEligibleForNaturalRanking === true, "area_rankのみは自然ランキング候補");
assert(outboundRelForPromotion(areaRankOnly) === "noreferrer", "通常外部リンクには sponsored/nofollow を付けない");

const expiredPr = resolvePromotionDisclosure({ is_pr: true, promotion_end_at: "2026-01-01" }, now);
assert(expiredPr.promotionType === "unknown", "終了済みPRは要確認へ送る");
assert(expiredPr.canReceiveNaturalRankNumber === false, "終了済みPRは自然順位へ戻さない");

const sourceChecks = [
  ["lib/shop-ranking.ts", "isEligibleForNaturalRanking", "自然ランキング用フィルタ関数が必要"],
  ["lib/shop-ranking.ts", "selectPromotionShops", "PR専用抽出関数が必要"],
  ["components/area/hub/AreaPromotionSection.tsx", "自然ランキングとは別枠", "PR専用セクションに別枠明示が必要"],
  ["components/area/hub/AreaPromotionSection.tsx", "rel={outboundRelForPromotion(shop.ranking.promotion)}", "PR外部リンクrel制御が必要"],
  ["components/area/AreaHubPageTemplate.tsx", "shopItemListJsonLd(allShops.filter((shop) => !shop.ranking.isPr)", "ItemList schema からPRを除外する必要"],
  ["components/common/PromotionDisclosureBadge.tsx", "PR広告", "PRラベルの可視化が必要"],
  ["package.json", "test:promotion-disclosure", "Q-05テストをnpm testへ接続する必要"]
];

for (const [file, needle, message] of sourceChecks) {
  const fullPath = path.join(root, file);
  assert(existsSync(fullPath), `${file} が存在しません`);
  const text = readFileSync(fullPath, "utf8");
  assert(text.includes(needle), message);
}

console.log("promotion disclosure checks passed");
