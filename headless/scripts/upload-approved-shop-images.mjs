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

function responseErrorFromBody(status, body, action) {
  const compact = body.replace(/\s+/g, " ").slice(0, 300);
  throw new Error(`${action} failed: HTTP ${status}${compact ? ` ${compact}` : ""}`);
}

export function isMissingBucketResponse({ status, body }) {
  if (status === 404) return true;
  if (status !== 400) return false;
  try {
    const parsed = JSON.parse(body);
    return parsed?.code === "NoSuchBucket" && (parsed.statusCode === 404 || parsed.error === "Bucket not found");
  } catch {
    return false;
  }
}

export function isMissingObjectResponse({ status, body }) {
  if (status === 404) return true;
  if (status !== 400) return false;
  try {
    const parsed = JSON.parse(body);
    return parsed?.code === "NoSuchKey" && (parsed.statusCode === 404 || parsed.error === "not_found" || parsed.error === "Object not found");
  } catch {
    return false;
  }
}

export function createStorageClient({ projectUrl = PROJECT_URL, fetchImpl = fetch } = {}) {
  const bucketUrl = `${projectUrl}/storage/v1/bucket/${BUCKET_ID}`;
  const storageObjectUrl = (key) => `${projectUrl}/storage/v1/object/${BUCKET_ID}/${key.split("/").map(encodeURIComponent).join("/")}`;
  const verifyBucket = (bucket) => {
    const actualTypes = [...(bucket.allowed_mime_types || [])].sort();
    const expectedTypes = [...ALLOWED_MIME_TYPES].sort();
    if (bucket.public !== true || bucket.file_size_limit !== FILE_SIZE_LIMIT || JSON.stringify(actualTypes) !== JSON.stringify(expectedTypes)) {
      throw new Error("Existing shop-images bucket does not match the approved public/MIME/10MiB configuration; refusing to alter it");
    }
  };
  const readAndVerifyObject = async (secret, item) => {
    const response = await fetchImpl(storageObjectUrl(item.proposed_target.object_key), { headers: secretHeaders(secret) });
    if (response.ok) {
      const stored = Buffer.from(await response.arrayBuffer());
      if (stored.length !== item.bytes || hash(stored) !== item.sha256) throw new Error(`Existing object differs; refusing overwrite: ${item.wp_media_id}`);
      return "verified";
    }
    const body = await response.text();
    if (isMissingObjectResponse({ status: response.status, body })) return "missing";
    responseErrorFromBody(response.status, body, `Existing object read for ${item.wp_media_id}`);
  };
  return {
    async ensureBucket(secret) {
      const existing = await fetchImpl(bucketUrl, { headers: secretHeaders(secret) });
      if (existing.ok) {
        verifyBucket(await existing.json());
        return "verified_existing";
      }
      const existingBody = await existing.text();
      if (!isMissingBucketResponse({ status: existing.status, body: existingBody })) {
        responseErrorFromBody(existing.status, existingBody, "Bucket read");
      }
      const created = await fetchImpl(`${projectUrl}/storage/v1/bucket`, {
        method: "POST",
        headers: secretHeaders(secret, { "Content-Type": "application/json" }),
        body: JSON.stringify({ id: BUCKET_ID, name: BUCKET_ID, public: true, file_size_limit: FILE_SIZE_LIMIT, allowed_mime_types: ALLOWED_MIME_TYPES })
      });
      if (created.ok) return "created";
      const createBody = await created.text();
      if (created.status === 409) {
        const raced = await fetchImpl(bucketUrl, { headers: secretHeaders(secret) });
        if (!raced.ok) responseErrorFromBody(raced.status, await raced.text(), "Bucket race read");
        verifyBucket(await raced.json());
        return "verified_existing";
      }
      responseErrorFromBody(created.status, createBody, "Bucket creation");
    },
    async verifyOrUploadItem(secret, manifestDir, item) {
      const localBytes = readFileSync(join(manifestDir, item.local_path));
      if (localBytes.length !== item.bytes || hash(localBytes) !== item.sha256) throw new Error(`Local preservation checksum mismatch: ${item.wp_media_id}`);
      const before = await readAndVerifyObject(secret, item);
      if (before === "verified") return "already_verified";
      const uploaded = await fetchImpl(storageObjectUrl(item.proposed_target.object_key), {
        method: "POST",
        headers: secretHeaders(secret, { "Content-Type": item.mimeType, "x-upsert": "false" }),
        body: new Blob([localBytes], { type: item.mimeType })
      });
      if (!uploaded.ok && uploaded.status !== 409) await responseError(uploaded, `Upload for ${item.wp_media_id}`);
      const after = await readAndVerifyObject(secret, item);
      if (after !== "verified") throw new Error(`Upload race did not yield a readable object: ${item.wp_media_id}`);
      return "uploaded_verified";
    }
  };
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
    const client = createStorageClient();
    const bucket = await client.ensureBucket(secret);
    const counts = { uploaded_verified: 0, already_verified: 0 };
    for (const item of plan.items) counts[await client.verifyOrUploadItem(secret, dirname(manifestPath), item)] += 1;
    console.log(JSON.stringify({ mode: "apply", bucket, ...counts, total: plan.items.length, databaseWrites: 0, pageAssetUploads: 0, unreferencedUploads: 0 }, null, 2));
  } finally {
    secret.fill?.(" ");
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await run();
