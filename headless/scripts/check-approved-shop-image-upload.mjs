import assert from "node:assert/strict";

const { buildUploadPlan, isMissingBucketResponse, isMissingObjectResponse } = await import("./upload-approved-shop-images.mjs");

assert.equal(isMissingBucketResponse({ status: 404, body: "" }), true);
assert.equal(isMissingBucketResponse({ status: 400, body: '{"statusCode":"404","error":"Bucket not found","message":"Bucket not found","code":"NoSuchBucket"}' }), true);
assert.equal(isMissingBucketResponse({ status: 401, body: '{"code":"NoSuchBucket"}' }), false, "Authentication failures must not be treated as missing buckets");
assert.equal(isMissingBucketResponse({ status: 403, body: '{"code":"NoSuchBucket"}' }), false, "Authorization failures must not be treated as missing buckets");
assert.equal(isMissingBucketResponse({ status: 400, body: '{"code":"BadRequest"}' }), false, "General bad requests must not create buckets");
assert.equal(isMissingBucketResponse({ status: 500, body: '{"code":"NoSuchBucket"}' }), false, "Server errors must not create buckets");
assert.equal(isMissingObjectResponse({ status: 404, body: "" }), true);
assert.equal(isMissingObjectResponse({ status: 400, body: '{"statusCode":404,"error":"not_found","code":"NoSuchKey"}' }), true);
assert.equal(isMissingObjectResponse({ status: 400, body: '{"code":"NoSuchBucket"}' }), false, "A missing bucket must not be treated as a missing object");
assert.equal(isMissingObjectResponse({ status: 403, body: '{"code":"NoSuchKey"}' }), false);

const hash = "a".repeat(64);
const plan = buildUploadPlan({
  manifest: {
    summary: { shop_transfer_candidates: 1, referenced_nonshop: 1 },
    objects: [
      { wp_media_id: 7, source_url: "http://example.test/old.jpg", transfer_candidate: true, source_mime_type: "image/jpeg", source_bytes: 123, sha256: hash, local_path: "objects/7.jpg", proposed_target: { bucket: "shop-images", object_key: `wordpress-media/7/${hash}.jpg` } },
      { wp_media_id: 357, source_url: "http://example.test/page.png", transfer_candidate: false, source_mime_type: "image/png", source_bytes: 456, sha256: "b".repeat(64), local_path: "objects/357.png", proposed_target: { bucket: null, object_key: null } }
    ]
  }
});

assert.equal(plan.projectUrl, "https://goeagrxjsjcbbatpotbu.supabase.co");
assert.equal(plan.bucketId, "shop-images");
assert.equal(plan.items.length, 1);
assert.equal(plan.items[0].wp_media_id, 7);
assert.equal(plan.items[0].mimeType, "image/jpeg");
assert.throws(() => buildUploadPlan({ manifest: { summary: { shop_transfer_candidates: 1, referenced_nonshop: 0 }, objects: [] } }), /does not match/i);
assert.throws(() => buildUploadPlan({ manifest: { summary: { shop_transfer_candidates: 1, referenced_nonshop: 1 }, objects: [{ wp_media_id: 7, source_url: "http://example.test/old.jpg", transfer_candidate: true, source_mime_type: "image/jpeg", source_bytes: 123, sha256: hash, local_path: "objects/7.jpg", proposed_target: { bucket: "other", object_key: "x" } }] } }), /not authorized/i);

console.log("Approved shop-image upload contract passed.");
