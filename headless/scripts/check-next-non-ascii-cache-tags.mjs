import assert from "node:assert/strict";
import { encodeCacheTag } from "next/dist/server/lib/encode-cache-tag.js";

const rawTag = "/shops/日本語の店舗/";
const encodedTag = encodeCacheTag(rawTag);

assert.match(
  encodedTag,
  /^[\x09\x20-\x7e]*$/,
  "Next.js cache tags must be safe to write to an HTTP response header"
);
assert.equal(encodeCacheTag(encodedTag), encodedTag, "cache tag encoding must be idempotent");

console.log("Next.js non-ASCII cache tag checks passed");
