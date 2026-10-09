import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import http from "node:http";
import net from "node:net";
import { join } from "node:path";
import ts from "typescript";
import vm from "node:vm";

const root = process.cwd();
const writerPath = join(root, "lib/dashboard/official-facts-writer.ts");
const routePath = join(root, "app/api/dashboard/shops/[id]/official-facts/route.ts");
const cachePath = join(root, "lib/dashboard/operator-shop-public-cache.ts");
const writerSource = readFileSync(writerPath, "utf8")
  .replace('import "server-only";\n', "")
  .replace(/import \{[\s\S]*?\} from "@\/lib\/dashboard\/operator-shop-fact-dry-run";/, 'const { OPERATOR_WRITER_FIELDS } = require("dry-run");');
const output = ts.transpileModule(writerSource, {
  fileName: writerPath,
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText;
const module = { exports: {} };
vm.runInNewContext(output, {
  module,
  exports: module.exports,
  require: (name) => {
    if (name === "node:buffer") return { Buffer };
    if (name === "dry-run") return { OPERATOR_WRITER_FIELDS: ["official_url", "basic_price", "shop_hours", "shop_address", "shop_tel", "shop_line", "shop_booking", "shop_holiday", "price_90", "shop_booking_url"] };
    throw new Error(`unexpected module ${name}`);
  },
  URL,
  Headers,
  fetch,
  Buffer,
});
const { OfficialFactsWriter, readOfficialFactsWriterEnvironment } = module.exports;

function freePort() {
  return new Promise((resolve) => {
    const probe = net.createServer();
    probe.listen(0, "127.0.0.1", () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

const fields = {
  official_url: { exists: true, value: "https://fixture.example/rankup" }, basic_price: { exists: true, value: "12000" },
  shop_hours: { exists: true, value: "10:00〜翌2:00" }, shop_address: { exists: true, value: "大阪市北区 fixture" },
  shop_tel: { exists: true, value: "06-0000-0768" }, shop_line: { exists: true, value: "https://line.example/rankup" },
  shop_booking: { exists: true, value: "Web予約" }, shop_holiday: { exists: true, value: "不定休" },
  price_90: { exists: true, value: "15000" }, shop_booking_url: { exists: true, value: "https://reserve.example/rankup" },
  shop_fact_provenance: { exists: true, value: [] },
};
let snapshot = { wp_id: 768, slug: "mrs-rank-up-fixture", fields };
let postCount = 0;
let getCount = 0;
const port = await freePort();
const server = http.createServer((request, response) => {
  if (request.headers.authorization !== `Basic ${Buffer.from("fixture-user:fixture-password").toString("base64")}`) {
    response.writeHead(401).end(JSON.stringify({ code: "rest_forbidden" })); return;
  }
  if (request.method === "GET" && request.url === "/wp-json/escomi/v1/official-facts/768") {
    getCount += 1;
    response.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" }).end(JSON.stringify(snapshot)); return;
  }
  if (request.method === "POST" && request.url === "/wp-json/escomi/v1/official-facts") {
    postCount += 1;
    let text = "";
    request.on("data", (part) => { text += part; });
    request.on("end", () => {
      const input = JSON.parse(text);
      assert.deepEqual(input.expected, snapshot, "fixture writer must receive its exact current snapshot");
      assert.ok(Array.isArray(input.provenance) && input.provenance.length > 0, "fixture writer requires reviewed provenance");
      assert.ok(input.canonical && input.audit, "fixture writer requires canonical and audit evidence");
      const changed = Object.entries(input.updates).some(([field, value]) => snapshot.fields[field].value !== value);
      if (changed) snapshot = { ...snapshot, fields: { ...snapshot.fields, ...Object.fromEntries(Object.entries(input.updates).map(([field, value]) => [field, { exists: true, value }])) } };
      response.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify(changed
        ? { state: "APPLIED", snapshot, cache_published: false }
        : { state: "NOOP", wp_id: 768, slug: snapshot.slug }));
    });
    return;
  }
  response.writeHead(404).end();
});
await new Promise((resolve) => server.listen(port, "127.0.0.1", resolve));

try {
  const environment = readOfficialFactsWriterEnvironment({
    WP_OFFICIAL_FACTS_BASE_URL: `http://127.0.0.1:${port}`,
    WP_OFFICIAL_FACTS_USER: "fixture-user",
    WP_OFFICIAL_FACTS_APP_PASSWORD: "fixture-password",
  });
  assert.ok(environment, "isolated local HTTP fixture is permitted only for loopback tests");
  const writer = new OfficialFactsWriter(environment);
  const evidence = {
    provenance: [{ field: "hours", sourceUrl: "https://fixture.example/hours", sourceType: "official-site", observedAt: "2026-10-07", reviewedAt: "2026-10-07", reviewStatus: "reviewed", publishedValueHash: "fixture" }],
    canonical: { hours: '"11:00〜翌1:00"' },
    audit: { shop_hours: { source_url: "https://fixture.example/hours", checked_at: "2026-10-07" } },
  };
  const baseline = await writer.getSnapshot(768);
  const applied = await writer.apply({ expected: baseline, changes: { shop_hours: "11:00〜翌1:00" }, evidence, batchId: "11111111-1111-4111-8111-111111111111" });
  assert.equal(applied.state, "APPLIED");
  assert.equal(applied.snapshot.fields.shop_hours.value, "11:00〜翌1:00", "readback must reflect only the accepted change");
  assert.equal(applied.cachePublished, false, "Next cache invalidation is a separate server action after readback");
  assert.ok(getCount >= 3 && postCount === 1, "writer must preflight and read back around one POST");

  const noop = await writer.apply({ expected: applied.snapshot, changes: { shop_hours: "11:00〜翌1:00" }, evidence, batchId: "22222222-2222-4222-8222-222222222222" });
  assert.equal(noop.state, "NOOP");
  const stale = applied.snapshot;
  snapshot = { ...snapshot, fields: { ...snapshot.fields, shop_hours: { exists: true, value: "同時編集値" } } };
  const postsBeforeConflict = postCount;
  await assert.rejects(() => writer.apply({ expected: stale, changes: { shop_hours: "12:00〜翌2:00" }, evidence, batchId: "33333333-3333-4333-8333-333333333333" }), /snapshot conflict/);
  assert.equal(postCount, postsBeforeConflict, "CAS conflict must fail before POST");
  await assert.rejects(() => writer.apply({ expected: snapshot, changes: { shop_hours: "12:00〜翌2:00" }, evidence: { ...evidence, provenance: [] }, batchId: "44444444-4444-4444-8444-444444444444" }), /evidence required/);
  assert.match(readFileSync(routePath, "utf8"), /revalidateOperatorShopPublicCaches/, "post-readback server workflow must invoke the shared public cache contract");
  assert.match(readFileSync(cachePath, "utf8"), /revalidateTag\("wp", \{ expire: 0 \}\)/, "post-readback server workflow must invalidate the public WP cache tag");
  assert.match(readFileSync(cachePath, "utf8"), /revalidatePath\(`\/shops\/\$\{slug\}`\)/, "post-readback server workflow must refresh the affected public shop path");
  console.log("official facts writer isolated fixture: PASS");
} finally {
  await new Promise((resolve) => server.close(resolve));
}
