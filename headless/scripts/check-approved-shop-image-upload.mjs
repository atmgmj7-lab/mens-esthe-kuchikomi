import assert from "node:assert/strict";

const { buildUploadPlan } = await import("./upload-approved-shop-images.mjs");

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
