import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const config = readFileSync(join(root, "lib/eskomi-banner-v2.ts"), "utf8");
const slot = readFileSync(join(root, "components/EskomiBannerV2Slot.tsx"), "utf8");
const detail = readFileSync(join(root, "components/ShopDetail.tsx"), "utf8");
for (const id of ["B01", "B02", "B03", "B04", "B05", "B06", "B07", "B08", "B09", "B10"]) assert.match(config, new RegExp(`${id}:`), `${id} copy must be prepared`);
assert.match(config, /assetStatus: "pending_library_approval"/, "unapproved library assets must remain marked pending");
assert.match(config, /href: "\/shops\/"/, "comparison banner needs an existing search destination");
assert.match(config, /href: "#contribute"/, "correction banner needs the store contribution anchor");
assert.match(config, /B10:[\s\S]*?href: null/, "advertising banner must not invent an unavailable destination");
assert.match(slot, /assetStatus !== "ready" \|\| !banner\.imageSrc \|\| !banner\.href/, "pending material must not render publicly");
assert.match(detail, /id="contribute"/, "shop detail must retain a real contribution anchor for B09");
console.log("Eskomi v2 banner preparation contract: PASS");
