import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_URL = "https://goeagrxjsjcbbatpotbu.supabase.co";
const BUCKET_ID = "shop-images";
const FILE_SIZE_LIMIT = 10 * 1024 * 1024;
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png"];
const repoRoot = join(fileURLToPath(new URL("..", import.meta.url)), "..");
const DEFAULT_MANIFEST = join(repoRoot, "supabase", "imports", "wp-media-preservation", "20261019-wp-media-preservation-v1", "manifest-shop-image-reconciled.json");

function hash(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function objectUrl(key) {
  return `${PROJECT_URL}/storage/v1/object/${BUCKET_ID}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

function assertCandidate(item) {
  if (!Number.isInteger(item.wp_media_id) || !item.source_url || !item.sha256 || !item.local_path) {
    throw new Error(`Invalid manifest item: ${item.wp_media_id ?? "unknown"}`);
  }
  if (!ALLOWED_MIME_TYPES.includes(item.source_mime_type)) throw new Error(`MIME type is not authorized for ${item.wp_media_id}: ${item.source_mime_type}`);
  if (item.proposed_target?.bucket !== BUCKET_ID || !item.proposed_target?.object_key) {
    throw new Error(`Target bucket is not authorized for ${item.wp_media_id}`);
  }
  if (item.source_bytes > FILE_SIZE_LIMIT) throw new Error(`Object exceeds the approved 10 MiB limit: ${item.wp_media_id}`);
}

export function buildUploadPlan({ manifest }) {
  const items = (manifest.objects || []).filter((item) => item.transfer_candidate);
  if (items.length !== manifest.summary?.shop_transfer_candidates) {
    throw new Error("Manifest candidate count does not match its summary");
  }
  for (const item of items) assertCandidate(item);
  return {
    projectUrl: PROJECT_URL,
    bucketId: BUCKET_ID,
    fileSizeLimit: FILE_SIZE_LIMIT,
    allowedMimeTypes: ALLOWED_MIME_TYPES,
    items: items.map((item) => ({
      wp_media_id: item.wp_media_id,
      source_url: item.source_url,
      sha256: item.sha256,
      bytes: item.source_bytes,
      mimeType: item.source_mime_type,
      local_path: item.local_path,
      proposed_target: item.proposed_target
    }))
  };
}

function secretHeaders(secret, extra = {}) {
  return { apikey: secret, Authorization: `Bearer ${secret}`, ...extra };
}

async function responseError(response, action) {
  const body = (await response.text()).replace(/\s+/g, " ").slice(0, 300);
  throw new Error(`${action} failed: HTTP ${response.status}${body ? ` ${body}` : ""}`);
}

async function ensureBucket(secret) {
  const bucketUrl = `${PROJECT_URL}/storage/v1/bucket/${BUCKET_ID}`;
  const existing = await fetch(bucketUrl, { headers: secretHeaders(secret) });
  if (existing.status === 404) {
    const created = await fetch(`${PROJECT_URL}/storage/v1/bucket`, {
      method: "POST",
      headers: secretHeaders(secret, { "Content-Type": "application/json" }),
      body: JSON.stringify({ id: BUCKET_ID, name: BUCKET_ID, public: true, file_size_limit: FILE_SIZE_LIMIT, allowed_mime_types: ALLOWED_MIME_TYPES })
    });
    if (!created.ok) await responseError(created, "Bucket creation");
    return "created";
  }
  if (!existing.ok) await responseError(existing, "Bucket read");
  const bucket = await existing.json();
  const actualTypes = [...(bucket.allowed_mime_types || [])].sort();
  const expectedTypes = [...ALLOWED_MIME_TYPES].sort();
  if (bucket.public !== true || bucket.file_size_limit !== FILE_SIZE_LIMIT || JSON.stringify(actualTypes) !== JSON.stringify(expectedTypes)) {
    throw new Error("Existing shop-images bucket does not match the approved public/MIME/10MiB configuration; refusing to alter it");
  }
  return "verified_existing";
}

async function verifyOrUploadItem(secret, manifestDir, item) {
  const localBytes = readFileSync(join(manifestDir, item.local_path));
  if (localBytes.length !== item.bytes || hash(localBytes) !== item.sha256) throw new Error(`Local preservation checksum mismatch: ${item.wp_media_id}`);
  const url = objectUrl(item.proposed_target.object_key);
  const existing = await fetch(url, { headers: secretHeaders(secret) });
  if (existing.ok) {
    const stored = Buffer.from(await existing.arrayBuffer());
    if (stored.length !== item.bytes || hash(stored) !== item.sha256) throw new Error(`Existing object differs; refusing overwrite: ${item.wp_media_id}`);
    return "already_verified";
  }
  if (existing.status !== 404) await responseError(existing, `Existing object read for ${item.wp_media_id}`);
  const uploaded = await fetch(url, {
    method: "POST",
    headers: secretHeaders(secret, { "Content-Type": item.mimeType, "x-upsert": "false" }),
    body: new Blob([localBytes], { type: item.mimeType })
  });
  if (!uploaded.ok) await responseError(uploaded, `Upload for ${item.wp_media_id}`);
  const readback = await fetch(url, { headers: secretHeaders(secret) });
  if (!readback.ok) await responseError(readback, `Readback for ${item.wp_media_id}`);
  const stored = Buffer.from(await readback.arrayBuffer());
  if (stored.length !== item.bytes || hash(stored) !== item.sha256) throw new Error(`Readback checksum mismatch: ${item.wp_media_id}`);
  return "uploaded_verified";
}

function promptHidden(question) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) throw new Error("Interactive TTY is required; the service key must not be supplied by argument, environment, or redirected input");
  return new Promise((resolve, reject) => {
    let value = "";
    const onData = (chunk) => {
      for (const character of chunk.toString("utf8")) {
        if (character === "\r" || character === "\n") return done();
        if (character === "\u0003") return failed(new Error("Cancelled"));
        if (character === "\u007f") value = value.slice(0, -1);
        else if (character >= " ") value += character;
      }
    };
    const done = () => { cleanup(); resolve(value); };
    const failed = (error) => { cleanup(); reject(error); };
    const cleanup = () => { process.stdin.off("data", onData); process.stdin.setRawMode(false); process.stdin.pause(); process.stdout.write("\n"); };
    process.stdout.write(question);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on("data", onData);
  });
}

async function run() {
  const apply = process.argv.includes("--apply");
  const dryRun = process.argv.includes("--dry-run");
  if (apply === dryRun) throw new Error("Use exactly one of --dry-run or --apply");
  const manifestPath = DEFAULT_MANIFEST;
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const plan = buildUploadPlan({ manifest });
  if (plan.items.length !== 241 || manifest.summary?.referenced_nonshop !== 1) throw new Error("Approved scope must be exactly 241 shop images plus one separately excluded page asset");
  if (dryRun) {
    console.log(JSON.stringify({ mode: "dry-run", projectUrl: plan.projectUrl, bucketId: plan.bucketId, public: true, fileSizeLimit: plan.fileSizeLimit, allowedMimeTypes: plan.allowedMimeTypes, items: plan.items.length, databaseWrites: 0, pageAssetUploads: 0, unreferencedUploads: 0 }, null, 2));
    return;
  }
  const secret = await promptHidden("Paste existing Supabase service key (hidden; never saved): ");
  if (!secret) throw new Error("A non-empty existing service key is required");
  try {
    const bucket = await ensureBucket(secret);
    const counts = { uploaded_verified: 0, already_verified: 0 };
    for (const item of plan.items) counts[await verifyOrUploadItem(secret, dirname(manifestPath), item)] += 1;
    console.log(JSON.stringify({ mode: "apply", bucket, ...counts, total: plan.items.length, databaseWrites: 0, pageAssetUploads: 0, unreferencedUploads: 0 }, null, 2));
  } finally {
    secret.fill?.(" ");
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await run();
