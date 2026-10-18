import assert from "node:assert/strict";
import { encode as encodeWebp } from "@stacksjs/ts-webp";
import * as jpeg from "jpeg-js";
import { inspectWorkerListingImage } from "../lib/cloudflare-worker-listing-image.mjs";

const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADElEQVQImWNgZGIGAAAOAAeCcsnOAAAAAElFTkSuQmCC", "base64");
const rgba = new Uint8Array([255, 0, 0, 255, 0, 255, 0, 255]);

function withExifOrientation(jpegBytes, orientation) {
  const exif = Uint8Array.from([
    0x45, 0x78, 0x69, 0x66, 0x00, 0x00, 0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08,
    0x00, 0x01, 0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01, 0x00, orientation, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00,
  ]);
  const app1 = Uint8Array.from([0xff, 0xe1, 0x00, exif.length + 2, ...exif]);
  return new Uint8Array([...jpegBytes.subarray(0, 2), ...app1, ...jpegBytes.subarray(2)]);
}

const result = await inspectWorkerListingImage(new File([png], "fixture.png", { type: "image/png" }));
assert.equal(result.ok, true, "a decoder-valid PNG must be accepted by the Worker image adapter");
if (result.ok) {
  assert.equal(result.type, "image/jpeg", "the Worker adapter must re-encode every accepted image as JPEG");
  assert.equal(result.bytes[0], 0xff, "re-encoded image must be JPEG SOI");
  assert.equal(result.bytes[1], 0xd8, "re-encoded image must be JPEG SOI");
  assert.equal(result.width, 1, "the Worker adapter must preserve decoded width");
  assert.equal(result.height, 1, "the Worker adapter must preserve decoded height");
  assert.match(result.sha256, /^[a-f0-9]{64}$/u, "the Worker adapter must hash stored JPEG bytes");
}

const sourceJpeg = jpeg.encode({ data: rgba, width: 2, height: 1 }, 88).data;
const oriented = await inspectWorkerListingImage(new File([withExifOrientation(sourceJpeg, 6)], "oriented.jpg", { type: "image/jpeg" }));
assert.equal(oriented.ok, true, "an EXIF-oriented JPEG must be accepted");
if (oriented.ok) {
  assert.equal(oriented.width, 1, "orientation 6 must rotate width into height");
  assert.equal(oriented.height, 2, "orientation 6 must rotate height into width");
  assert.equal(Buffer.from(oriented.bytes).includes(Buffer.from("Exif")), false, "re-encoded JPEG must strip EXIF metadata");
}

const webp = encodeWebp({ data: rgba, width: 2, height: 1, hasAlpha: true });
const webpResult = await inspectWorkerListingImage(new File([webp], "fixture.webp", { type: "image/webp" }));
assert.equal(webpResult.ok, true, "a decoder-valid WebP must be accepted by the Worker image adapter");
if (webpResult.ok) assert.deepEqual([webpResult.width, webpResult.height], [2, 1], "the Worker adapter must preserve decoded WebP dimensions");

const malformed = await inspectWorkerListingImage(new File([Buffer.from("not-an-image")], "fake.png", { type: "image/png" }));
assert.deepEqual(malformed, { ok: false, error: "PNG・JPEG・WebPの実画像（最大4096px）を選択してください。" }, "the Worker adapter must reject a signature-free non-image");

const oversized = await inspectWorkerListingImage(new File([Buffer.alloc(5 * 1024 * 1024 + 1)], "large.png", { type: "image/png" }));
assert.deepEqual(oversized, { ok: false, error: "画像は5MB以下にしてください。" }, "the Worker adapter must reject an oversized file before decoding");

const pixelBomb = new Uint8Array(24);
pixelBomb.set([137, 80, 78, 71, 13, 10, 26, 10], 0);
new DataView(pixelBomb.buffer).setUint32(16, 4097);
new DataView(pixelBomb.buffer).setUint32(20, 1);
const rejectedBomb = await inspectWorkerListingImage(new File([pixelBomb], "bomb.png", { type: "image/png" }));
assert.deepEqual(rejectedBomb, { ok: false, error: "PNG・JPEG・WebPの実画像（最大4096px）を選択してください。" }, "the Worker adapter must reject over-limit dimensions before allocating decoded pixels");

console.log("Cloudflare Worker listing image adapter: PASS");
