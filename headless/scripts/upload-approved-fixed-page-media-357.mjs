import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_URL = "https://goeagrxjsjcbbatpotbu.supabase.co";
const BUCKET_ID = "shop-images";
const FILE_SIZE_LIMIT = 10 * 1024 * 1024;
const repoRoot = join(fileURLToPath(new URL("..", import.meta.url)), "..");
const manifestPath = join(repoRoot, "supabase", "imports", "wp-media-preservation", "20261019-wp-media-preservation-v1", "manifest-reconciled.json");

const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const secretHeaders = (secret, extra = {}) => ({ apikey: secret, Authorization: `Bearer ${secret}`, ...extra });
function objectUrl(projectUrl, key) { return `${projectUrl}/storage/v1/object/${BUCKET_ID}/${key.split("/").map(encodeURIComponent).join("/")}`; }
function compactError(status, body, action) { throw new Error(`${action} failed: HTTP ${status}${body ? ` ${body.replace(/\s+/g, " ").slice(0, 300)}` : ""}`); }
function missingObject(status, body) {
  if (status === 404) return true;
  if (status !== 400) return false;
  try { const parsed = JSON.parse(body); return parsed?.code === "NoSuchKey" && (parsed?.statusCode === 404 || parsed?.error === "not_found"); } catch { return false; }
}

export function buildFixedPageMedia357Plan() {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const item = manifest.objects?.find((candidate) => candidate.wp_media_id === 357);
  if (!item || item.classification !== "referenced" || item.references?.length !== 1 || item.references[0]?.wp_post_id !== 343 || item.references[0]?.role !== "featured" || item.source_mime_type !== "image/png" || item.source_bytes !== 6487809 || item.sha256 !== "96f59d37e745108178e23c1ba2533328b7ffb615c079e43228f449d28dd5486c" || item.proposed_target?.bucket !== BUCKET_ID || !item.proposed_target?.object_key) throw new Error("fixed page media 357 manifest is not the reviewed singleton");
  const sourcePath = join(dirname(manifestPath), item.local_path);
  if (!existsSync(sourcePath) || statSync(sourcePath).size !== item.source_bytes) throw new Error("fixed page media 357 preserved source is unavailable or changed");
  const bytes = readFileSync(sourcePath);
  if (hash(bytes) !== item.sha256) throw new Error("fixed page media 357 preserved source checksum changed");
  return Object.freeze({ mediaId: 357, projectUrl: PROJECT_URL, bucket: BUCKET_ID, objectKey: item.proposed_target.object_key, mimeType: item.source_mime_type, bytes: item.source_bytes, sha256: item.sha256, sourcePath, sourceUrl: item.source_url, databaseWrites: 0, bucketCreation: false, upsert: false });
}

export function createFixedPageMedia357Client({ projectUrl = PROJECT_URL, fetchImpl = fetch } = {}) {
  async function readBucket(secret) {
    const response = await fetchImpl(`${projectUrl}/storage/v1/bucket/${BUCKET_ID}`, { headers: secretHeaders(secret) });
    if (!response.ok) compactError(response.status, await response.text(), "Existing shop-images bucket read");
    const bucket = await response.json();
    const types = [...(bucket.allowed_mime_types || [])].sort();
    if (bucket.public !== true || bucket.file_size_limit !== FILE_SIZE_LIMIT || JSON.stringify(types) !== JSON.stringify(["image/jpeg", "image/png"])) throw new Error("Existing shop-images bucket does not match the approved public/MIME/10MiB configuration; refusing to alter it");
  }
  async function readObject(secret, plan) {
    const response = await fetchImpl(objectUrl(projectUrl, plan.objectKey), { headers: secretHeaders(secret) });
    if (response.ok) {
      const stored = Buffer.from(await response.arrayBuffer());
      if (stored.length !== plan.bytes || hash(stored) !== plan.sha256) throw new Error("Existing media 357 object differs; refusing overwrite");
      return "verified";
    }
    const body = await response.text();
    if (missingObject(response.status, body)) return "missing";
    compactError(response.status, body, "Existing media 357 object read");
  }
  return {
    async verifyOrUpload(secret, plan) {
      await readBucket(secret);
      const before = await readObject(secret, plan);
      if (before === "verified") return "already_verified";
      const local = readFileSync(plan.sourcePath);
      if (local.length !== plan.bytes || hash(local) !== plan.sha256) throw new Error("Local media 357 checksum changed before upload");
      const response = await fetchImpl(objectUrl(projectUrl, plan.objectKey), { method: "POST", headers: secretHeaders(secret, { "Content-Type": plan.mimeType, "x-upsert": "false" }), body: new Blob([local], { type: plan.mimeType }) });
      if (!response.ok && response.status !== 409) compactError(response.status, await response.text(), "Media 357 upload");
      if (await readObject(secret, plan) !== "verified") throw new Error("Media 357 readback verification failed");
      return "uploaded_verified";
    }
  };
}

function promptHidden(question) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) throw new Error("Interactive TTY is required; the existing storage administrative key must not be supplied by argument, environment, or redirected input");
  return new Promise((resolve, reject) => {
    let value = "";
    const cleanup = () => { process.stdin.off("data", onData); process.stdin.setRawMode(false); process.stdin.pause(); process.stdout.write("\n"); };
    const done = () => { cleanup(); resolve(value); };
    const failed = (error) => { cleanup(); reject(error); };
    const onData = (chunk) => { for (const character of chunk.toString("utf8")) { if (character === "\r" || character === "\n") return done(); if (character === "\u0003") return failed(new Error("Cancelled")); if (character === "\u007f") value = value.slice(0, -1); else if (character >= " ") value += character; } };
    process.stdout.write(question); process.stdin.setRawMode(true); process.stdin.resume(); process.stdin.on("data", onData);
  });
}

async function run() {
  const apply = process.argv.includes("--apply");
  const dryRun = process.argv.includes("--dry-run");
  if (apply === dryRun) throw new Error("Use exactly one of --dry-run or --apply");
  const plan = buildFixedPageMedia357Plan();
  if (dryRun) return console.log(JSON.stringify({ mode: "dry-run", ...plan, sourcePath: plan.sourcePath, receipt: { mediaId: plan.mediaId, bucket: plan.bucket, objectKey: plan.objectKey, sha256: plan.sha256, bytes: plan.bytes, status: "pending_existing_object_or_readback_verification" } }, null, 2));
  const secret = await promptHidden("Paste existing Supabase Storage administrative key (hidden; never saved): ");
  if (!secret) throw new Error("A non-empty existing storage administrative key is required");
  try {
    const status = await createFixedPageMedia357Client().verifyOrUpload(secret, plan);
    console.log(JSON.stringify({ schema: 1, receipt: { mediaId: plan.mediaId, bucket: plan.bucket, objectKey: plan.objectKey, sha256: plan.sha256, bytes: plan.bytes, status, verifiedAt: new Date().toISOString(), databaseWrites: 0, bucketCreation: false, upsert: false } }, null, 2));
  } finally { secret.fill?.(" "); }
}
if (process.argv[1] === fileURLToPath(import.meta.url)) await run();
