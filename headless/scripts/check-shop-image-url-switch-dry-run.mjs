import assert from "node:assert/strict";

const { buildShopImageUrlSwitchDryRun } = await import("./prepare-shop-image-url-switch-dry-run.mjs");

const dryRun = buildShopImageUrlSwitchDryRun({
  label: "20261019-shop-images-test",
  manifest: {
    objects: [
      { wp_media_id: 7, source_url: "http://example.test/old.jpg", sha256: "a".repeat(64), transfer_candidate: true, proposed_target: { bucket: "shop-images", object_key: `wordpress-media/7/${"a".repeat(64)}.jpg` } },
      { wp_media_id: 8, source_url: "http://example.test/page.png", sha256: "b".repeat(64), transfer_candidate: false, proposed_target: { bucket: null, object_key: null } }
    ]
  }
});

assert.equal(dryRun.transfer_state, "not_applied");
assert.equal(dryRun.operations.length, 1);
assert.equal(dryRun.operations[0].wp_media_id, 7);
assert.equal(dryRun.operations[0].source_url, "http://example.test/old.jpg");
assert.equal(dryRun.operations[0].proposed_public_url, "https://<project-ref>.supabase.co/storage/v1/object/public/shop-images/wordpress-media/7/" + "a".repeat(64) + ".jpg");
assert.equal(dryRun.operations[0].database_write, "not_authorized");

console.log("Shop image URL switch dry-run contract passed.");
