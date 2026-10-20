import assert from "node:assert/strict";

const { buildFixedPageMedia357Plan } = await import("./upload-approved-fixed-page-media-357.mjs");

const plan = buildFixedPageMedia357Plan();
assert.deepEqual({ mediaId: plan.mediaId, bucket: plan.bucket, mimeType: plan.mimeType }, { mediaId: 357, bucket: "shop-images", mimeType: "image/png" });
assert.equal(plan.bytes, 6487809);
assert.equal(plan.sha256, "96f59d37e745108178e23c1ba2533328b7ffb615c079e43228f449d28dd5486c");
assert.equal(plan.objectKey, "wordpress-media/357/96f59d37e745108178e23c1ba2533328b7ffb615c079e43228f449d28dd5486c.png");
assert.match(plan.sourcePath, /objects\/357\.png$/u);
console.log("Fixed-page media 357 upload plan contract: PASS");
