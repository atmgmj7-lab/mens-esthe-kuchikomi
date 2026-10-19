import assert from "node:assert/strict";

const { buildMediaManifest, uniqueMediaRows } = await import("./preserve-wp-media-manifest.mjs");

assert.deepEqual(uniqueMediaRows([{ id: 7, source_url: "a" }, { id: 7, source_url: "a" }, { id: 8, source_url: "b" }]), [{ id: 7, source_url: "a" }, { id: 8, source_url: "b" }]);

const manifest = buildMediaManifest({
  label: "20261019-wp-media-test",
  media: [
    {
      id: 7,
      source_url: "https://mens-esthe-kuchikomi.com/wp-content/uploads/2026/10/featured.jpg",
      mime_type: "image/jpeg",
      bytes: 12,
      sha256: "a".repeat(64),
      local_path: "objects/7.jpg",
      retrieval_status: "downloaded"
    },
    {
      id: 8,
      source_url: "https://mens-esthe-kuchikomi.com/wp-content/uploads/2026/10/unreferenced.png",
      mime_type: "image/png",
      bytes: null,
      sha256: null,
      local_path: null,
      retrieval_status: "failed"
    }
  ],
  referencesByMediaId: new Map([[7, [{ wp_post_id: 101, slug: "example-shop", role: "featured" }]]])
});

assert.equal(manifest.summary.media_total, 2);
assert.equal(manifest.summary.referenced, 1);
assert.equal(manifest.summary.unreferenced, 1);
assert.equal(manifest.summary.downloaded, 1);
assert.equal(manifest.summary.failed, 1);
assert.deepEqual(manifest.objects[0].references, [{ wp_post_id: 101, slug: "example-shop", role: "featured" }]);
assert.equal(manifest.objects[0].classification, "referenced");
assert.equal(manifest.objects[1].classification, "unreferenced");
assert.equal(manifest.objects[0].transfer_state, "not_transferred");
assert.equal(manifest.objects[0].proposed_target.bucket, "shop-images");
assert.match(manifest.objects[0].proposed_target.object_key, /^wordpress-media\/7\/[a-f0-9]{64}\.jpg$/);
assert.equal(manifest.objects[1].proposed_target.object_key, null, "No target key is proposed before a checksum exists");

console.log("WordPress media preservation manifest contract passed.");
