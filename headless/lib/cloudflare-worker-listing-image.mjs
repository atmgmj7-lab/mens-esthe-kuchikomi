import { decode as decodePng, hasPngSignature } from "fast-png";
import { decode as decodeWebp } from "@stacksjs/ts-webp";
import * as jpeg from "jpeg-js";

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_DIMENSION = 4096;
const MAX_PIXELS = MAX_DIMENSION * MAX_DIMENSION;
const INVALID_IMAGE = "PNG・JPEG・WebPの実画像（最大4096px）を選択してください。";

function readU16(bytes, offset, littleEndian = false) {
  return littleEndian ? bytes[offset] | (bytes[offset + 1] << 8) : (bytes[offset] << 8) | bytes[offset + 1];
}

function readU32(bytes, offset, littleEndian = false) {
  return littleEndian
    ? (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0
    : ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0;
}

function withinBounds(width, height) {
  return Number.isInteger(width) && Number.isInteger(height) && width > 0 && height > 0 && width <= MAX_DIMENSION && height <= MAX_DIMENSION && width * height <= MAX_PIXELS;
}

function jpegHeader(bytes) {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let width = 0;
  let height = 0;
  let orientation = 1;
  for (let offset = 2; offset + 3 < bytes.length;) {
    if (bytes[offset] !== 0xff) return null;
    while (bytes[offset] === 0xff) offset++;
    const marker = bytes[offset++];
    if (marker === 0xd9 || marker === 0xda) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 1 >= bytes.length) return null;
    const segmentLength = readU16(bytes, offset);
    if (segmentLength < 2 || offset + segmentLength > bytes.length) return null;
    const dataStart = offset + 2;
    if (marker === 0xe1) orientation = exifOrientation(bytes, dataStart, segmentLength - 2) ?? orientation;
    if (marker >= 0xc0 && marker <= 0xc3 && offset + 7 < bytes.length) {
      height = readU16(bytes, offset + 3);
      width = readU16(bytes, offset + 5);
      break;
    }
    offset += segmentLength;
  }
  return withinBounds(width, height) ? { width, height, orientation } : null;
}

function exifOrientation(bytes, start, length) {
  if (length < 14 || String.fromCharCode(...bytes.subarray(start, start + 6)) !== "Exif\0\0") return null;
  const tiff = start + 6;
  const littleEndian = bytes[tiff] === 0x49 && bytes[tiff + 1] === 0x49;
  const bigEndian = bytes[tiff] === 0x4d && bytes[tiff + 1] === 0x4d;
  if (!littleEndian && !bigEndian || readU16(bytes, tiff + 2, littleEndian) !== 42) return null;
  const ifd = tiff + readU32(bytes, tiff + 4, littleEndian);
  if (ifd + 2 > start + length) return null;
  const count = readU16(bytes, ifd, littleEndian);
  for (let index = 0; index < count; index++) {
    const entry = ifd + 2 + index * 12;
    if (entry + 12 > start + length) return null;
    if (readU16(bytes, entry, littleEndian) !== 0x0112 || readU16(bytes, entry + 2, littleEndian) !== 3 || readU32(bytes, entry + 4, littleEndian) !== 1) continue;
    const value = readU16(bytes, entry + 8, littleEndian);
    return value >= 1 && value <= 8 ? value : null;
  }
  return null;
}

function webpHeader(bytes) {
  if (bytes.length < 16 || String.fromCharCode(...bytes.subarray(0, 4)) !== "RIFF" || String.fromCharCode(...bytes.subarray(8, 12)) !== "WEBP") return null;
  if (readU32(bytes, 4, true) + 8 > bytes.length) return null;
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const fourCC = String.fromCharCode(...bytes.subarray(offset, offset + 4));
    const length = readU32(bytes, offset + 4, true);
    const data = offset + 8;
    if (length > bytes.length - data) return null;
    if (fourCC === "VP8X" && length >= 10) {
      const width = 1 + bytes[data + 4] + (bytes[data + 5] << 8) + (bytes[data + 6] << 16);
      const height = 1 + bytes[data + 7] + (bytes[data + 8] << 8) + (bytes[data + 9] << 16);
      return withinBounds(width, height) ? { width, height } : null;
    }
    if (fourCC === "VP8L" && length >= 5 && bytes[data] === 0x2f) {
      const packed = readU32(bytes, data + 1, true);
      const width = (packed & 0x3fff) + 1;
      const height = ((packed >>> 14) & 0x3fff) + 1;
      return withinBounds(width, height) ? { width, height } : null;
    }
    if (fourCC === "VP8 " && length >= 10 && bytes[data + 3] === 0x9d && bytes[data + 4] === 0x01 && bytes[data + 5] === 0x2a) {
      const width = readU16(bytes, data + 6, true) & 0x3fff;
      const height = readU16(bytes, data + 8, true) & 0x3fff;
      return withinBounds(width, height) ? { width, height } : null;
    }
    offset = data + length + (length & 1);
  }
  return null;
}

function pngHeader(bytes) {
  if (!hasPngSignature(bytes) || bytes.length < 24) return null;
  const width = readU32(bytes, 16);
  const height = readU32(bytes, 20);
  return withinBounds(width, height) ? { width, height } : null;
}

function toRgba(decoded) {
  const { data, width, height, channels = 4, depth = 8 } = decoded;
  if (!withinBounds(width, height) || depth !== 8 || ![1, 2, 3, 4].includes(channels) || data.length < width * height * channels) throw new Error("decoded image bounds");
  if (channels === 4) return { data: new Uint8Array(data), width, height };
  const rgba = new Uint8Array(width * height * 4);
  for (let source = 0, target = 0; target < rgba.length; source += channels, target += 4) {
    const gray = data[source];
    rgba[target] = channels < 3 ? gray : data[source];
    rgba[target + 1] = channels < 3 ? gray : data[source + 1];
    rgba[target + 2] = channels < 3 ? gray : data[source + 2];
    rgba[target + 3] = channels === 2 ? data[source + 1] : 0xff;
  }
  return { data: rgba, width, height };
}

function applyOrientation({ data, width, height }, orientation) {
  if (orientation === 1) return { data, width, height };
  const swapped = orientation >= 5 && orientation <= 8;
  const outputWidth = swapped ? height : width;
  const outputHeight = swapped ? width : height;
  const output = new Uint8Array(outputWidth * outputHeight * 4);
  for (let sourceY = 0; sourceY < height; sourceY++) {
    for (let sourceX = 0; sourceX < width; sourceX++) {
      let targetX = sourceX;
      let targetY = sourceY;
      if (orientation === 2) targetX = width - 1 - sourceX;
      if (orientation === 3) { targetX = width - 1 - sourceX; targetY = height - 1 - sourceY; }
      if (orientation === 4) targetY = height - 1 - sourceY;
      if (orientation === 5) { targetX = sourceY; targetY = sourceX; }
      if (orientation === 6) { targetX = height - 1 - sourceY; targetY = sourceX; }
      if (orientation === 7) { targetX = height - 1 - sourceY; targetY = width - 1 - sourceX; }
      if (orientation === 8) { targetX = sourceY; targetY = width - 1 - sourceX; }
      output.set(data.subarray((sourceY * width + sourceX) * 4, (sourceY * width + sourceX + 1) * 4), (targetY * outputWidth + targetX) * 4);
    }
  }
  return { data: output, width: outputWidth, height: outputHeight };
}

async function sha256(bytes) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

export async function inspectWorkerListingImage(file) {
  if (file.size < 1 || file.size > MAX_BYTES) return { ok: false, error: "画像は5MB以下にしてください。" };
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    let decoded;
    let orientation = 1;
    if (pngHeader(bytes)) decoded = toRgba(decodePng(bytes, { checkCrc: true }));
    else {
      const jpeg = jpegHeader(bytes);
      if (jpeg) {
        orientation = jpeg.orientation;
        decoded = jpegDecode(bytes);
      } else if (webpHeader(bytes)) decoded = toRgba(decodeWebp(bytes, { format: "rgba" }));
      else throw new Error("unsupported image");
    }
    const normalized = applyOrientation(decoded, orientation);
    if (!withinBounds(normalized.width, normalized.height)) throw new Error("normalized image bounds");
    const rendered = jpeg.encode(normalized, 88).data;
    const clean = new Uint8Array(rendered);
    return { ok: true, bytes: clean, type: "image/jpeg", width: normalized.width, height: normalized.height, sha256: await sha256(clean) };
  } catch {
    return { ok: false, error: INVALID_IMAGE };
  }
}

function jpegDecode(bytes) {
  const decoded = jpeg.decode(bytes, { useTArray: true, formatAsRGBA: true, tolerantDecoding: false, maxResolutionInMP: 17, maxMemoryUsageInMB: 80 });
  return toRgba({ ...decoded, channels: 4, depth: 8 });
}
