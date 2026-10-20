import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
const { createFixedPageMedia357Client } = await import("./upload-approved-fixed-page-media-357.mjs");
const secret = "fixture-storage-key";
const bytes = Buffer.from("fixed-page-media-357");
const plan = { mediaId: 357, bucket: "shop-images", objectKey: "wordpress-media/357/fixture.png", mimeType: "image/png", bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") };
const dir = mkdtempSync(join(tmpdir(), "eskomi-media-357-"));
plan.sourcePath = join(dir, "357.png"); writeFileSync(plan.sourcePath, bytes);
async function withServer(options, test) {
  const state = { object: options.object, bucketPosts: 0, objectPosts: 0 };
  const server = createServer(async (req, res) => {
    const send = (status, body = "", type = "application/json") => { res.statusCode = status; res.setHeader("content-type", type); res.end(body); };
    if (req.headers.authorization !== `Bearer ${secret}` || req.headers.apikey !== secret) return send(401, "{}");
    if (req.url === "/storage/v1/bucket/shop-images" && req.method === "GET") return options.missingBucket ? send(404, "{}") : send(200, JSON.stringify({ public: true, file_size_limit: 10485760, allowed_mime_types: ["image/jpeg", "image/png"] }));
    if (req.url === "/storage/v1/bucket" && req.method === "POST") { state.bucketPosts++; return send(500, "bucket creation is forbidden"); }
    if (req.url?.startsWith("/storage/v1/object/shop-images/") && req.method === "GET") return state.object ? send(200, state.object, "image/png") : send(404, "");
    if (req.url?.startsWith("/storage/v1/object/shop-images/") && req.method === "POST") { state.objectPosts++; const chunks=[]; for await (const c of req) chunks.push(c); state.object=Buffer.concat(chunks); return send(200, "{}"); }
    return send(500, "{}");
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try { await test(state, createFixedPageMedia357Client({ projectUrl: `http://127.0.0.1:${server.address().port}`, fetchImpl: fetch })); } finally { await new Promise((resolve, reject) => server.close((e) => e ? reject(e) : resolve())); }
}
await withServer({}, async (state, client) => { assert.equal(await client.verifyOrUpload(secret, plan), "uploaded_verified"); assert.equal(await client.verifyOrUpload(secret, plan), "already_verified"); assert.equal(state.bucketPosts, 0); assert.equal(state.objectPosts, 1); });
await withServer({ missingBucket: true }, async (state, client) => { await assert.rejects(() => client.verifyOrUpload(secret, plan), /bucket read/i); assert.equal(state.bucketPosts, 0); assert.equal(state.objectPosts, 0); });
await withServer({ object: Buffer.from("different") }, async (state, client) => { await assert.rejects(() => client.verifyOrUpload(secret, plan), /differs/i); assert.equal(state.objectPosts, 0); });
console.log("Fixed-page media 357 uploader integration: PASS");
