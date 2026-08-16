import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (file) => readFileSync(join(root, file), "utf8");

const areaHubConfig = read("lib/area-hub-config.ts");
assert.ok(
  areaHubConfig.includes("localGuide?:"),
  "Area hub config must expose optional local guide copy"
);
assert.ok(
  areaHubConfig.includes("sakaisujihonmachi") && areaHubConfig.includes("localGuide:"),
  "S-10 must add a Sakaisuji-Honmachi local guide configuration"
);
const sakaisujiStart = areaHubConfig.indexOf("  sakaisujihonmachi: {");
const sakaisujiEnd = areaHubConfig.indexOf("  shinosaka: {", sakaisujiStart);
const sakaisujiConfig = areaHubConfig.slice(sakaisujiStart, sakaisujiEnd);
for (const phrase of [
  "堺筋本町・本町・北浜の使い分け",
  "堺筋本町を中心に探す",
  "本町・北浜も候補にする",
  "未確認値を相場として補わず"
]) {
  assert.ok(sakaisujiConfig.includes(phrase), `Sakaisuji-Honmachi hub guide must include: ${phrase}`);
}

const areaHubContent = read("components/area/area-hub-content.tsx");
assert.ok(
  areaHubContent.includes("export function AreaHubLocalGuideSection"),
  "Area hub content must render a reusable local guide section"
);
assert.ok(
  areaHubContent.includes("hubContext.localGuide"),
  "Local guide section must be driven by area hub context"
);
assert.ok(
  areaHubContent.includes('id="local-guide"'),
  "Local guide section must expose a stable local-guide anchor"
);

const areaHubTemplate = read("components/area/AreaHubPageTemplate.tsx");
assert.ok(
  areaHubTemplate.includes("AreaHubLocalGuideSection"),
  "Area hub template must render the local guide section"
);
assert.ok(
  areaHubTemplate.includes("AreaHubDecisionGuide"),
  "Area hub template must render the consolidated decision guide"
);

const areaDecisionGuide = read("components/area/hub/AreaHubDecisionGuide.tsx");
assert.ok(
  areaDecisionGuide.includes('href: "#shop-list"'),
  "Sakaisuji-Honmachi selection guidance must lead into the shop list"
);

const pkg = read("package.json");
assert.ok(
  pkg.includes("test:s10-sakaisujihonmachi-hub"),
  "S-10 check must be connected to npm scripts"
);

console.log("S-10 Sakaisuji-Honmachi hub checks passed");
