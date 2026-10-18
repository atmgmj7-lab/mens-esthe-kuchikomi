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

const orientationRgba = new Uint8Array(2 * 3 * 4).fill(0xff);
const sourceJpeg = jpeg.encode({ data: orientationRgba, width: 2, height: 3 }, 88).data;
for (let orientation = 1; orientation <= 8; orientation++) {
  const oriented = await inspectWorkerListingImage(new File([withExifOrientation(sourceJpeg, orientation)], `orientation-${orientation}.jpg`, { type: "image/jpeg" }));
  assert.equal(oriented.ok, true, `EXIF orientation ${orientation} must be accepted`);
  if (oriented.ok) {
    const swapsDimensions = orientation >= 5;
    assert.deepEqual([oriented.width, oriented.height], swapsDimensions ? [3, 2] : [2, 3], `EXIF orientation ${orientation} must normalize output geometry`);
    assert.equal(Buffer.from(oriented.bytes).includes(Buffer.from("Exif")), false, `EXIF orientation ${orientation} metadata must be stripped`);
  }
}

const webp = encodeWebp({ data: rgba, width: 2, height: 1, hasAlpha: true });
const webpResult = await inspectWorkerListingImage(new File([webp], "fixture.webp", { type: "image/webp" }));
assert.equal(webpResult.ok, true, "a decoder-valid WebP must be accepted by the Worker image adapter");
if (webpResult.ok) assert.deepEqual([webpResult.width, webpResult.height], [2, 1], "the Worker adapter must preserve decoded WebP dimensions");

const metadataWebp = new Uint8Array(webp.length + 12);
metadataWebp.set(webp);
metadataWebp.set(Buffer.from("EXIF"), webp.length);
new DataView(metadataWebp.buffer).setUint32(webp.length + 4, 4, true);
metadataWebp.set([1, 2, 3, 4], webp.length + 8);
new DataView(metadataWebp.buffer).setUint32(4, metadataWebp.length - 8, true);
const metadataWebpResult = await inspectWorkerListingImage(new File([metadataWebp], "metadata.webp", { type: "image/webp" }));
assert.equal(metadataWebpResult.ok, true, "a WebP with metadata must be re-encoded as a clean JPEG");
if (metadataWebpResult.ok) assert.equal(Buffer.from(metadataWebpResult.bytes).includes(Buffer.from("Exif")), false, "WebP metadata must not survive JPEG normalization");

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

const corruptPng = new Uint8Array(png);
corruptPng[corruptPng.length - 1] ^= 0xff;
assert.deepEqual(await inspectWorkerListingImage(new File([corruptPng], "corrupt.png", { type: "image/png" })), { ok: false, error: "PNG・JPEG・WebPの実画像（最大4096px）を選択してください。" }, "a PNG with an invalid checksum must be rejected");
assert.deepEqual(await inspectWorkerListingImage(new File([sourceJpeg.subarray(0, 24)], "truncated.jpg", { type: "image/jpeg" })), { ok: false, error: "PNG・JPEG・WebPの実画像（最大4096px）を選択してください。" }, "a truncated JPEG must be rejected");
assert.deepEqual(await inspectWorkerListingImage(new File([webp.subarray(0, 16)], "truncated.webp", { type: "image/webp" })), { ok: false, error: "PNG・JPEG・WebPの実画像（最大4096px）を選択してください。" }, "a truncated WebP must be rejected");

const maxDimensionRgba = new Uint8Array(4096 * 4096 * 4).fill(0xff);
const maxDimensionJpeg = jpeg.encode({ data: maxDimensionRgba, width: 4096, height: 4096 }, 50).data;
const maxDimension = await inspectWorkerListingImage(new File([maxDimensionJpeg], "max-dimension.jpg", { type: "image/jpeg" }));
assert.deepEqual(maxDimension, { ok: false, error: "PNG・JPEG・WebPの実画像（最大4096px）を選択してください。" }, "a maximum-dimension JPEG that exceeds the decoder memory budget must fail closed without an unbounded decode");

console.log("Cloudflare Worker listing image adapter: PASS");
