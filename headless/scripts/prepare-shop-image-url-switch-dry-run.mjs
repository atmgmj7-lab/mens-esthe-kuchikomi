import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export function buildShopImageUrlSwitchDryRun({ label, manifest }) {
  const operations = (manifest.objects || [])
    .filter((object) => object.transfer_candidate)
    .map((object) => {
      if (!object.source_url || !object.sha256 || object.proposed_target?.bucket !== "shop-images" || !object.proposed_target?.object_key) {
        throw new Error(`Invalid shop-image transfer candidate: ${object.wp_media_id}`);
      }
      return {
        wp_media_id: object.wp_media_id,
        source_url: object.source_url,
        sha256: object.sha256,
        proposed_bucket: object.proposed_target.bucket,
        proposed_object_key: object.proposed_target.object_key,
        proposed_public_url: `https://<project-ref>.supabase.co/storage/v1/object/public/${object.proposed_target.bucket}/${object.proposed_target.object_key}`,
        upload_state: "not_uploaded",
        checksum_verification: "pending_readback",
        database_write: "not_authorized"
      };
    });
  return {
    manifest_version: 1,
    label,
    transfer_state: "not_applied",
    operation_count: operations.length,
    operations
  };
}

function run() {
  const label = process.env.SHOP_IMAGE_URL_SWITCH_LABEL?.trim();
  if (!/^[0-9]{8}-shop-images-[a-z0-9-]+$/.test(label || "")) {
    throw new Error("SHOP_IMAGE_URL_SWITCH_LABEL must be an explicit YYYYMMDD-shop-images-label value");
  }
  const manifestPath = process.env.WP_MEDIA_PRESERVATION_MANIFEST?.trim();
  if (!manifestPath) throw new Error("WP_MEDIA_PRESERVATION_MANIFEST is required");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const repoRoot = join(fileURLToPath(new URL("..", import.meta.url)), "..");
  const outputDir = join(repoRoot, "supabase", "imports", "shop-image-url-switch");
  const outputPath = join(outputDir, `${label}.json`);
  if (existsSync(outputPath)) throw new Error(`URL switch dry-run already exists for ${label}`);
  mkdirSync(outputDir, { recursive: true });
  const dryRun = buildShopImageUrlSwitchDryRun({ label, manifest });
  writeFileSync(outputPath, `${JSON.stringify(dryRun, null, 2)}\n`, { flag: "wx" });
  console.log(JSON.stringify({ outputPath, operation_count: dryRun.operation_count, transfer_state: dryRun.transfer_state }, null, 2));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) run();
