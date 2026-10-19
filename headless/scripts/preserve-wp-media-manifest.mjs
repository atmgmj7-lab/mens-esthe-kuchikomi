import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_API_BASE = "https://mens-esthe-kuchikomi.com/wp-json/wp/v2";

function normalizeApiBase(value) {
  const base = String(value || DEFAULT_API_BASE).trim().replace(/\/+$/, "");
  if (/\/wp-json\/wp\/v2$/i.test(base)) return base;
  if (/\/wp-json$/i.test(base)) return `${base}/wp/v2`;
  return `${base}/wp-json/wp/v2`;
}

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function extensionFor({ mime_type: mimeType, source_url: sourceUrl }) {
  const byMime = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "image/avif": "avif" };
  if (byMime[mimeType]) return byMime[mimeType];
  const pathname = new URL(sourceUrl).pathname;
  const match = pathname.match(/\.([a-z0-9]{1,8})$/i);
  return match ? match[1].toLowerCase() : "bin";
}

function proposedTarget(media) {
  if (!media.sha256) return { bucket: "shop-images", object_key: null, public_url: null };
  return {
    bucket: "shop-images",
    object_key: `wordpress-media/${media.id}/${media.sha256}.${extensionFor(media)}`,
    public_url: null
  };
}

export function buildMediaManifest({ label, media, referencesByMediaId }) {
  const objects = media.map((item) => {
    const references = referencesByMediaId.get(item.id) || [];
    return {
      wp_media_id: item.id,
      source_url: item.source_url,
      source_mime_type: item.mime_type || null,
      source_bytes: item.bytes,
      sha256: item.sha256,
      local_path: item.local_path,
      retrieval_status: item.retrieval_status,
      classification: references.length > 0 ? "referenced" : "unreferenced",
      references,
      proposed_target: proposedTarget(item),
      transfer_state: "not_transferred"
    };
  });
  return {
    manifest_version: 1,
    label,
    transfer_state: "not_transferred",
    objects,
    summary: {
      media_total: objects.length,
      referenced: objects.filter((object) => object.classification === "referenced").length,
      unreferenced: objects.filter((object) => object.classification === "unreferenced").length,
      downloaded: objects.filter((object) => object.retrieval_status === "downloaded").length,
      failed: objects.filter((object) => object.retrieval_status === "failed").length,
      bytes_downloaded: objects.reduce((total, object) => total + (object.source_bytes || 0), 0)
    }
  };
}

export function uniqueMediaRows(rows) {
  const byId = new Map();
  for (const row of rows) {
    if (!byId.has(row.id)) byId.set(row.id, row);
  }
  return [...byId.values()];
}

async function fetchAll(apiBase, path) {
  const rows = [];
  let page = 1;
  let totalPages = 1;
  do {
    const separator = path.includes("?") ? "&" : "?";
    const response = await fetch(`${apiBase}${path}${separator}page=${page}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(30000)
    });
    if (!response.ok) throw new Error(`WordPress API failed: ${response.status} ${path}`);
    const batch = await response.json();
    if (!Array.isArray(batch)) throw new Error(`WordPress API returned a non-array payload: ${path}`);
    rows.push(...batch);
    totalPages = Math.max(1, Number(response.headers.get("x-wp-totalpages")) || 1);
    page += 1;
  } while (page <= totalPages);
  return rows;
}

function addReference(referencesByMediaId, mediaId, reference) {
  const id = Number(mediaId);
  if (!Number.isInteger(id) || id <= 0) return;
  const references = referencesByMediaId.get(id) || [];
  if (!references.some((current) => JSON.stringify(current) === JSON.stringify(reference))) references.push(reference);
  referencesByMediaId.set(id, references);
}

function contentHtml(row) {
  return `${text(row?.content?.rendered)}\n${text(row?.excerpt?.rendered)}`;
}

function collectReferences(media, contentRows) {
  const referencesByMediaId = new Map();
  const mediaByUrl = new Map(media.map((item) => [item.source_url, item.id]));
  for (const { kind, row } of contentRows) {
    const identity = { wp_post_id: row.id, slug: row.slug || null, role: "featured", content_type: kind };
    addReference(referencesByMediaId, row.featured_media, identity);
    const html = contentHtml(row);
    for (const [sourceUrl, mediaId] of mediaByUrl) {
      if (html.includes(sourceUrl)) addReference(referencesByMediaId, mediaId, { ...identity, role: "embedded" });
    }
  }
  return referencesByMediaId;
}

async function downloadMedia(media, objectDir) {
  const extension = extensionFor(media);
  const localPath = join(objectDir, `${media.id}.${extension}`);
  if (existsSync(localPath)) {
    const bytes = readFileSync(localPath);
    return {
      bytes: statSync(localPath).size,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      local_path: `objects/${media.id}.${extension}`,
      retrieval_status: "preserved"
    };
  }
  const response = await fetch(media.source_url, { signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  writeFileSync(localPath, bytes, { flag: "wx" });
  return { bytes: bytes.length, sha256, local_path: `objects/${media.id}.${extension}`, retrieval_status: "downloaded" };
}

async function mapWithConcurrency(items, limit, worker) {
  let nextIndex = 0;
  async function runWorker() {
    while (nextIndex < items.length) {
      const item = items[nextIndex];
      nextIndex += 1;
      await worker(item);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, runWorker));
}

async function run() {
  const label = process.env.WP_MEDIA_PRESERVATION_LABEL?.trim();
  if (!/^[0-9]{8}-wp-media-[a-z0-9-]+$/.test(label || "")) {
    throw new Error("WP_MEDIA_PRESERVATION_LABEL must be an explicit YYYYMMDD-wp-media-label value");
  }
  const apiBase = normalizeApiBase(process.env.WP_API_BASE_URL);
  const repoRoot = join(fileURLToPath(new URL("..", import.meta.url)), "..");
  const outputDir = join(repoRoot, "supabase", "imports", "wp-media-preservation", label);
  const resume = process.env.WP_MEDIA_PRESERVATION_RESUME === "1";
  const reconcile = process.env.WP_MEDIA_PRESERVATION_RECONCILE === "1";
  const manifestPath = join(outputDir, reconcile ? "manifest-reconciled.json" : "manifest.json");
  if (existsSync(outputDir) && !resume && !reconcile) throw new Error(`Preservation artifact already exists for ${label}; choose a new label`);
  if (resume && existsSync(join(outputDir, "manifest.json"))) throw new Error(`Preservation artifact is already complete for ${label}; choose a new label`);
  if (reconcile && !existsSync(join(outputDir, "manifest.json"))) throw new Error(`No original manifest exists for ${label}; reconciliation is not valid`);
  if (existsSync(manifestPath)) throw new Error(`Manifest artifact already exists at ${manifestPath}`);
  const objectDir = join(outputDir, "objects");
  mkdirSync(objectDir, { recursive: true });

  const [mediaRows, shops, posts, pages] = await Promise.all([
    fetchAll(apiBase, "/media?per_page=100"),
    fetchAll(apiBase, "/shop?per_page=100"),
    fetchAll(apiBase, "/posts?per_page=100"),
    fetchAll(apiBase, "/pages?per_page=100")
  ]);
  const media = uniqueMediaRows(mediaRows).map((row) => ({ id: row.id, source_url: row.source_url, mime_type: row.mime_type }));
  const referencesByMediaId = collectReferences(media, [
    ...shops.map((row) => ({ kind: "shop", row })),
    ...posts.map((row) => ({ kind: "post", row })),
    ...pages.map((row) => ({ kind: "page", row }))
  ]);

  await mapWithConcurrency(media, 8, async (item) => {
    try {
      Object.assign(item, await downloadMedia(item, objectDir));
    } catch (error) {
      Object.assign(item, { bytes: null, sha256: null, local_path: null, retrieval_status: "failed", retrieval_error: error.message });
    }
  });
  const manifest = buildMediaManifest({ label, media, referencesByMediaId });
  manifest.manifest_kind = reconcile ? "reconciled" : "initial";
  manifest.source = { api_base: apiBase, media_count: media.length, api_media_row_count: mediaRows.length, shop_count: shops.length, post_count: posts.length, page_count: pages.length };
  manifest.objects.forEach((object, index) => { object.retrieval_error = media[index].retrieval_error || null; });
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { flag: "wx" });
  console.log(JSON.stringify({ outputDir, ...manifest.summary }, null, 2));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await run();
