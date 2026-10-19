import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";

const { createStorageClient } = await import("./upload-approved-shop-images.mjs");
const secret = "test-service-secret-must-not-be-logged";
const bytes = Buffer.from("approved-image-bytes");
const sha256 = createHash("sha256").update(bytes).digest("hex");
const fixtureDir = mkdtempSync(join(tmpdir(), "eskomi-storage-upload-"));
writeFileSync(join(fixtureDir, "image.jpg"), bytes);
const item = { wp_media_id: 7, bytes: bytes.length, sha256, mimeType: "image/jpeg", local_path: "image.jpg", proposed_target: { object_key: `wordpress-media/7/${sha256}.jpg` } };

async function withStorageMock(options, test) {
  const state = { bucket: options.bucket ?? false, objects: new Map(options.objects || []), createCalls: 0, uploadCalls: 0, readbackFailures: 0 };
  const server = createServer(async (request, response) => {
    const url = new URL(request.url, "http://mock.invalid");
    const send = (status, body = "", type = "application/json") => { response.statusCode = status; response.setHeader("content-type", type); response.end(body); };
    const missingBucket = () => send(options.bucketMissingStatus ?? 400, options.bucketMissingBody || JSON.stringify({ statusCode: 404, error: "Bucket not found", code: "NoSuchBucket" }));
    const missingObject = () => send(options.objectMissingStatus ?? 400, JSON.stringify({ statusCode: 404, error: "not_found", code: "NoSuchKey" }));
    if (request.headers.authorization !== `Bearer ${secret}` || request.headers.apikey !== secret) return send(401, JSON.stringify({ code: "Unauthorized" }));
    if (url.pathname === "/storage/v1/bucket/shop-images" && request.method === "GET") {
      if (!state.bucket) return missingBucket();
      return send(200, JSON.stringify({ id: "shop-images", public: true, file_size_limit: 10485760, allowed_mime_types: ["image/jpeg", "image/png"] }));
    }
    if (url.pathname === "/storage/v1/bucket" && request.method === "POST") {
      state.createCalls += 1;
      state.bucket = true;
      if (options.createRace) return send(409, JSON.stringify({ code: "ResourceAlreadyExists" }));
      return send(200, JSON.stringify({ id: "shop-images" }));
    }
    if (url.pathname.startsWith("/storage/v1/object/shop-images/") && request.method === "GET") {
      const key = decodeURIComponent(url.pathname.slice("/storage/v1/object/shop-images/".length));
      if (options.readbackFailureOnce && state.uploadCalls > 0 && state.readbackFailures++ === 0) return send(500, JSON.stringify({ code: "ReadbackUnavailable" }));
      if (options.objectReadErrorStatus) return send(options.objectReadErrorStatus, options.objectReadErrorBody || JSON.stringify({ code: "ReadError" }));
      if (options.objectNoSuchBucket) return missingBucket();
      if (!state.objects.has(key)) return missingObject();
      return send(200, state.objects.get(key), "image/jpeg");
    }
    if (url.pathname.startsWith("/storage/v1/object/shop-images/") && request.method === "POST") {
      const key = decodeURIComponent(url.pathname.slice("/storage/v1/object/shop-images/".length));
      state.uploadCalls += 1;
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      state.objects.set(key, Buffer.concat(chunks));
      if (options.uploadRace) return send(409, JSON.stringify({ code: "ResourceAlreadyExists" }));
      return send(200, JSON.stringify({ Key: key }));
    }
    return send(500, JSON.stringify({ code: "UnexpectedRoute" }));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const port = server.address().port;
    await test(state, createStorageClient({ projectUrl: `http://127.0.0.1:${port}`, fetchImpl: fetch }));
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

await withStorageMock({}, async (state, client) => {
  assert.equal(await client.ensureBucket(secret), "created");
  assert.equal(await client.verifyOrUploadItem(secret, fixtureDir, item), "uploaded_verified");
  assert.equal(await client.verifyOrUploadItem(secret, fixtureDir, item), "already_verified");
  assert.equal(state.createCalls, 1);
  assert.equal(state.uploadCalls, 1);
});

await withStorageMock({ bucketMissingStatus: 404 }, async (_state, client) => assert.equal(await client.ensureBucket(secret), "created"));

await withStorageMock({ createRace: true }, async (_state, client) => assert.equal(await client.ensureBucket(secret), "verified_existing"));
await withStorageMock({ uploadRace: true, bucket: true }, async (_state, client) => assert.equal(await client.verifyOrUploadItem(secret, fixtureDir, item), "uploaded_verified"));
await withStorageMock({ readbackFailureOnce: true, bucket: true }, async (_state, client) => {
  await assert.rejects(() => client.verifyOrUploadItem(secret, fixtureDir, item), /Readback/i);
  assert.equal(await client.verifyOrUploadItem(secret, fixtureDir, item), "already_verified");
});
await withStorageMock({ bucket: true, objects: [[item.proposed_target.object_key, Buffer.from("different")]] }, async (state, client) => {
  await assert.rejects(() => client.verifyOrUploadItem(secret, fixtureDir, item), /differs/i);
  assert.equal(state.uploadCalls, 0);
});
for (const status of [401, 403, 500]) {
  await withStorageMock({ bucketMissingStatus: status }, async (state, client) => {
    await assert.rejects(() => client.ensureBucket(secret), /Bucket read/i);
    assert.equal(state.createCalls, 0);
  });
}
await withStorageMock({ bucketMissingStatus: 400, bucketMissingBody: '{"code":"BadRequest"}' }, async (state, client) => {
  await assert.rejects(() => client.ensureBucket(secret), /Bucket read/i);
  assert.equal(state.createCalls, 0);
});
await withStorageMock({ bucket: true, objectNoSuchBucket: true }, async (state, client) => {
  await assert.rejects(() => client.verifyOrUploadItem(secret, fixtureDir, item), /Existing object read/i);
  assert.equal(state.uploadCalls, 0);
});
for (const status of [401, 403, 400, 500]) {
  await withStorageMock({ bucket: true, objectReadErrorStatus: status }, async (state, client) => {
    await assert.rejects(() => client.verifyOrUploadItem(secret, fixtureDir, item), /Existing object read/i);
    assert.equal(state.uploadCalls, 0);
  });
}

console.log("Approved shop-image uploader integration contract passed.");
