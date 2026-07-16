import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  renderPhase4ImportSql,
  renderPhase4VerifySql,
  validatePhase4DraftPreview
} from "./lib/sakaisujihonmachi-phase4-supabase-sql.mjs";

const repoRoot = join(fileURLToPath(new URL("..", import.meta.url)), "..");
const previewPath = join(
  repoRoot,
  "docs",
  "data",
  "sakaisujihonmachi-phase4-supabase-draft-preview-2026-07-15.json"
);
const importDir = join(repoRoot, "supabase", "imports");
const importPath = join(importDir, "20260715_sakaisujihonmachi_phase4_verified_draft.sql");
const verifyPath = join(importDir, "verify_20260715_sakaisujihonmachi_phase4_verified_draft.sql");

const preview = JSON.parse(readFileSync(previewPath, "utf8"));
validatePhase4DraftPreview(preview);

mkdirSync(importDir, { recursive: true });
writeFileSync(importPath, renderPhase4ImportSql(preview));
writeFileSync(verifyPath, renderPhase4VerifySql(preview));

console.log(JSON.stringify({
  shops: preview.summary.shops_eligible,
  prices: preview.summary.shop_prices,
  businessHours: preview.summary.shop_business_hours,
  sourceObservations: preview.summary.source_observations,
  sources: preview.summary.sources,
  sourceLinks: preview.summary.shop_source_links,
  importPath,
  verifyPath,
  applyStatus: "not-applied"
}, null, 2));
