import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const config = readFileSync(join(root, "lib/eskomi-banner-v2.ts"), "utf8");
const slot = readFileSync(join(root, "components/EskomiBannerV2Slot.tsx"), "utf8");
const detail = readFileSync(join(root, "components/ShopDetail.tsx"), "utf8");
const home = readFileSync(join(root, "components/HomePageContent.tsx"), "utf8");
const listing = readFileSync(join(root, "components/StoreListingGuide.tsx"), "utf8");
const growth = readFileSync(join(root, "app/partner/growth/page.tsx"), "utf8");
const operations = readFileSync(join(root, "app/partner/operations/page.tsx"), "utf8");
const therapists = readFileSync(join(root, "app/partner/therapists/page.tsx"), "utf8");
const partner = readFileSync(join(root, "app/partner/page.tsx"), "utf8");
for (const id of ["B01", "B02", "B03", "B04", "B05", "B06", "B07", "B08", "B09", "B10"]) assert.match(config, new RegExp(`${id}:`), `${id} copy must be prepared`);
for (const id of ["B01", "B02", "B03", "B04", "B05", "B06", "B07", "B08", "B09", "B10"]) {
  assert.match(config, new RegExp(`${id}:[\\s\\S]*?imageSrc: "/images/eskomi-banners/${id}-eskomi-functional-v2\\.png"`), `${id} must reference its approved local source asset`);
}
assert.doesNotMatch(config, /pending_library_approval/, "materialized approved assets must not remain labelled as awaiting Library approval");
for (const id of ["B01", "B02", "B03", "B04", "B05", "B06", "B07", "B08", "B09"]) {
  assert.match(config, new RegExp(`${id}:[\\s\\S]*?assetStatus: "ready"`), `${id} has an implemented destination and must be publishable`);
}
assert.match(config, /B08:[\s\S]*?assetStatus: "ready"/, "the existing area-search destination makes B08 publishable");
assert.match(config, /B09:[\s\S]*?assetStatus: "ready"/, "the existing contribution anchor makes B09 publishable");
assert.match(config, /href: "\/shops\/"/, "comparison banner needs an existing search destination");
assert.match(config, /href: "#contribute"/, "correction banner needs the store contribution anchor");
assert.match(config, /B10:[\s\S]*?href: null/, "advertising banner must not invent an unavailable destination");
assert.match(slot, /assetStatus !== "ready" \|\| !banner\.imageSrc \|\| !resolvedHref/, "pending material must not render publicly");
assert.match(slot, /<Link href=\{resolvedHref\}[\s\S]*?<img src=\{banner\.imageSrc\}/, "approved banner artwork must be the single linked visual instead of duplicating its embedded copy");
assert.match(detail, /id="contribute"/, "shop detail must retain a real contribution anchor for B09");
assert.match(detail, /<EskomiBannerV2Slot id="B09" href=\{`\/shops\/\$\{shop\.slug\}\/community\/`\}/, "the B09 artwork must lead directly to the current shop's contribution route");
assert.match(home, /EskomiBannerV2Slot/, "the existing regional-search entry route must render B08");
assert.match(home, /<EskomiBannerV2Slot id="B08"/, "the existing regional-search entry route must use the approved B08 asset");
assert.match(listing, /<EskomiBannerV2Slot id="B01"/, "the listing application route must render B01 outside its form");
assert.match(growth, /<EskomiBannerV2Slot id="B02"/, "the review-request route must render B02");
assert.match(growth, /<EskomiBannerV2Slot id="B04"/, "the widget route must render B04");
assert.match(operations, /<EskomiBannerV2Slot id="B03"/, "the benefit route must render B03");
assert.match(operations, /<EskomiBannerV2Slot id="B05"/, "the reply route must render B05");
assert.match(therapists, /<EskomiBannerV2Slot id="B06"/, "the therapist route must render B06");
assert.match(partner, /<EskomiBannerV2Slot id="B07"/, "the access-report route must render B07");
console.log("Eskomi v2 banner preparation contract: PASS");
