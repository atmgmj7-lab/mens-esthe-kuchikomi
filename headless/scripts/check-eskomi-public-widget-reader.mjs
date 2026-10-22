import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import vm from "node:vm";

const widgetPath = join(process.cwd(), "lib/supabase/eskomi-widget-v11.ts");
const source = readFileSync(widgetPath, "utf8");
const output = ts.transpileModule(source, {
  fileName: widgetPath,
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const module = { exports: {} };
vm.runInNewContext(output, {
  module, exports: module.exports, URL,
  require: (name) => { if (name === "server-only") return {}; throw new Error(`unexpected dependency: ${name}`); },
});

assert.equal(typeof module.exports.getV11Widget, "function", "widget reader must be available");
assert.equal(typeof module.exports.resolvePublicWidgetTransport, "function", "widget reader must resolve only a public transport");
assert.doesNotMatch(source, /resolveSupabaseServerSecret|createSupabaseServerHeaders/u, "public widget reader must not use a server-only credential");

const environment = {
  SUPABASE_CONTENT_URL: "https://project.supabase.co",
  SUPABASE_CONTENT_PUBLISHABLE_KEY: "public-test-key",
};
const transport = module.exports.resolvePublicWidgetTransport(environment);
assert.deepEqual(JSON.parse(JSON.stringify(transport)), { origin: "https://project.supabase.co", key: "public-test-key" });
assert.equal(module.exports.resolvePublicWidgetTransport({ SUPABASE_CONTENT_URL: "http://project.invalid", SUPABASE_CONTENT_PUBLISHABLE_KEY: "key" }), null, "non-HTTPS public transports must fail closed");

const handle = "11111111-1111-4111-8111-111111111111";
let request;
const value = await module.exports.getV11Widget(handle, environment, async (url, init) => {
  request = { url, init };
  return new Response(JSON.stringify([{
    shop_name: "Fixture shop", canonical_path: "/shops/fixture/", review_count: 1,
    average_rating: 5, public_version: 1, data_as_of: "2026-10-22T00:00:00.000Z",
    review_body: "PUBLIC_ONLY", review_rating: 5, published_at: "2026-10-22T00:00:00.000Z",
    reply_body: null, reply_published_at: null,
  }]), { status: 200 });
});
assert.equal(request.url, "https://project.supabase.co/rest/v1/rpc/get_public_review_widget_v11");
assert.equal(request.init.headers.apikey, "public-test-key");
assert.equal(request.init.headers.Authorization, "Bearer public-test-key");
assert.equal(value.reviewCount, 1);
assert.equal(value.reviews[0].body, "PUBLIC_ONLY");

let fetched = false;
assert.equal(await module.exports.getV11Widget("invalid", environment, async () => { fetched = true; throw new Error("must not fetch"); }), null);
assert.equal(fetched, false, "invalid widget handles must fail before any network call");
console.log("Eskomi public widget reader contract: PASS");
