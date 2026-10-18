import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import QRCode from "qrcode";
import jsQR from "jsqr";
import { PNG } from "pngjs";

const popSource = await readFile(new URL("../app/partner/growth/pop/preview.svg/route.ts", import.meta.url), "utf8");
assert.match(popSource, /QRCode\.toDataURL\(qr\.value, \{ errorCorrectionLevel: "M", margin: 1, width: 720 \}\)/, "POP must generate the tested QR PNG configuration");

const target = "https://mens-esthe-kuchikomi.com/r/11111111-1111-4111-8111-111111111111/";
const dataUrl = await QRCode.toDataURL(target, { errorCorrectionLevel: "M", margin: 1, width: 720 });
const png = PNG.sync.read(Buffer.from(dataUrl.slice(dataUrl.indexOf(",") + 1), "base64"));
const decoded = jsQR(png.data, png.width, png.height, { inversionAttempts: "dontInvert" });

assert.equal(decoded?.data, target, "an independent QR decoder must recover the exact generated review URL");
console.log("Eskomi v1.1 POP QR generation independent decode: PASS");
