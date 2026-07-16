import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import ts from "typescript";

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), "utf8");
const require = createRequire(import.meta.url);
const links = read("lib/shop-owner-request-links.ts");
const shopSlugSource = read("lib/shop-slug.ts");
const validationSource = read("lib/shop-owner-request-validation.ts");
const form = read("components/ShopOwnerRequestForm.tsx");
const staticPage = read("components/WpStaticPage.tsx");
const route = read("app/[slug]/page.tsx");
const css = read("app/globals.css");

const transpiledLinks = ts.transpileModule(links, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
});
const transpiledShopSlug = ts.transpileModule(shopSlugSource, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
});
const shopSlugModule = { exports: {} };
vm.runInNewContext(transpiledShopSlug.outputText, {
  exports: shopSlugModule.exports,
  module: shopSlugModule,
  decodeURIComponent,
  encodeURIComponent,
});
const linksModule = { exports: {} };
vm.runInNewContext(transpiledLinks.outputText, {
  exports: linksModule.exports,
  module: linksModule,
  require: (specifier) => {
    if (specifier === "@/lib/shop-slug") return shopSlugModule.exports;
    throw new Error(`Unexpected owner-link dependency: ${specifier}`);
  },
  URL,
  URLSearchParams,
});
const { buildShopOwnerRequestUrl, parseShopOwnerRequestInitial } = linksModule.exports;
const plain = (value) => JSON.parse(JSON.stringify(value));

const transpiledValidation = ts.transpileModule(validationSource, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
});
const validationModule = { exports: {} };
vm.runInNewContext(transpiledValidation.outputText, {
  exports: validationModule.exports,
  module: validationModule,
  URL,
  require: (specifier) => {
    if (specifier === "@/lib/shop-slug") return shopSlugModule.exports;
    throw new Error(`Unexpected validation dependency: ${specifier}`);
  },
});
const { validateShopOwnerRequestPayload } = validationModule.exports;

assert.match(links, /buildShopOwnerRequestUrl/);
assert.equal(typeof parseShopOwnerRequestInitial, "function");
for (const key of ["shop_id", "shop_slug", "shop_name", "target_url", "source"]) {
  assert.ok(links.includes(key), `owner URL must include ${key}`);
}

const longName = "<strong>店舗名</strong>" + "長".repeat(140);
assert.deepEqual(
  plain(parseShopOwnerRequestInitial({
    shop_id: ["695", "999"],
    shop_slug: "muse-osaka",
    shop_name: longName,
    target_url: "https://mens-esthe-kuchikomi.com/shops/muse-osaka/",
    source: "shop-detail",
  })),
  {
    shopId: "695",
    shopSlug: "muse-osaka",
    shopName: longName.slice(0, 120),
    targetUrl: "https://mens-esthe-kuchikomi.com/shops/muse-osaka/",
    source: "shop-detail",
  },
);
assert.equal(
  parseShopOwnerRequestInitial({ shop_id: String(Number.MAX_SAFE_INTEGER) }).shopId,
  String(Number.MAX_SAFE_INTEGER),
);
for (const shopId of ["0", "-1", "1.5", "01x", "9007199254740992"]) {
  assert.equal(parseShopOwnerRequestInitial({ shop_id: shopId }).shopId, "", `reject ID ${shopId}`);
}
assert.equal(parseShopOwnerRequestInitial({ shop_slug: "owner@example.com" }).shopSlug, "");
assert.equal(
  parseShopOwnerRequestInitial({
    shop_slug: "muse",
    target_url: "https://example.com/shops/muse/",
  }).targetUrl,
  "",
);
assert.equal(
  parseShopOwnerRequestInitial({
    shop_slug: "muse",
    target_url: "https://mens-esthe-kuchikomi.com/shops/another-shop/",
  }).targetUrl,
  "",
);
assert.equal(
  parseShopOwnerRequestInitial({
    shop_slug: "muse",
    target_url: "http://mens-esthe-kuchikomi.com/shops/muse/",
  }).targetUrl,
  "",
);
for (const targetUrl of [
  "https://mens-esthe-kuchikomi.com:443/shops/muse/",
  "https://owner:secret@mens-esthe-kuchikomi.com/shops/muse/",
  "https://mens-esthe-kuchikomi.com/shops/muse/?preview=1",
  "https://mens-esthe-kuchikomi.com/shops/muse/#details",
]) {
  assert.equal(
    parseShopOwnerRequestInitial({ shop_slug: "muse", target_url: targetUrl }).targetUrl,
    "",
    `reject non-canonical target URL ${targetUrl}`,
  );
}
assert.equal(parseShopOwnerRequestInitial({ source: "unexpected" }).source, "storelisting");

const encodedShopSlug =
  "c-rest%ef%bc%88%e3%82%b7%e3%83%bc%e3%83%ac%e3%82%b9%e3%83%88%ef%bc%89";
const encodedTargetUrl =
  `https://mens-esthe-kuchikomi.com/shops/${encodedShopSlug}/`;
const encodedOwnerUrl = new URL(
  buildShopOwnerRequestUrl({ id: 865, slug: encodedShopSlug, title: "C-REST（シーレスト）" }),
  "https://mens-esthe-kuchikomi.com",
);
assert.equal(
  encodedOwnerUrl.searchParams.get("shop_slug"),
  encodedShopSlug,
  "canonical percent-encoded WordPress slug must remain prefilled",
);
assert.equal(
  encodedOwnerUrl.searchParams.get("target_url"),
  encodedTargetUrl,
  "encoded WordPress slug target must not be double encoded",
);
assert.deepEqual(
  plain(parseShopOwnerRequestInitial(Object.fromEntries(encodedOwnerUrl.searchParams))),
  {
    shopId: "865",
    shopSlug: encodedShopSlug,
    shopName: "C-REST（シーレスト）",
    targetUrl: encodedTargetUrl,
    source: "shop-detail",
  },
  "canonical percent-encoded WordPress prefill must survive parsing",
);

const transpiledForm = ts.transpileModule(form, {
  compilerOptions: {
    esModuleInterop: true,
    jsx: ts.JsxEmit.ReactJSX,
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
  fileName: "components/ShopOwnerRequestForm.tsx",
  reportDiagnostics: true,
});
assert.equal(
  (transpiledForm.diagnostics ?? []).filter(
    (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
  ).length,
  0,
  "owner request form must transpile for the submit-path check",
);

const submittedRequests = [];
class FocusedFormData {
  constructor(formElement) {
    this.values = formElement.values;
  }

  get(name) {
    const value = this.values[name];
    return Array.isArray(value) ? value[0] ?? null : value ?? null;
  }

  getAll(name) {
    const value = this.values[name];
    if (value === undefined || value === null) return [];
    return Array.isArray(value) ? value : [value];
  }
}

const formModule = { exports: {} };
vm.runInNewContext(transpiledForm.outputText, {
  exports: formModule.exports,
  module: formModule,
  FormData: FocusedFormData,
  fetch: async (...args) => {
    submittedRequests.push(args);
    return {
      ok: true,
      json: async () => ({ ok: true }),
    };
  },
  require: (specifier) => {
    if (specifier === "next/link") return { __esModule: true, default: () => null };
    if (specifier === "react") {
      return {
        useState: (initialValue) => [initialValue, () => {}],
      };
    }
    if (specifier === "react/jsx-runtime") return require(specifier);
    if (specifier === "@/lib/gtag") return { gaEvent: () => {} };
    if (specifier === "@/lib/shop-owner-request-validation") {
      return validationModule.exports;
    }
    throw new Error(`Unexpected owner form dependency: ${specifier}`);
  },
  window: {
    location: {
      href: encodedOwnerUrl.toString(),
    },
  },
});

const encodedInitial = parseShopOwnerRequestInitial(
  Object.fromEntries(encodedOwnerUrl.searchParams),
);
const encodedFormElement = formModule.exports.ShopOwnerRequestForm({
  initial: encodedInitial,
});
assert.equal(encodedFormElement.type, "form", "encoded prefill must render the real owner form");
await encodedFormElement.props.onSubmit({
  preventDefault: () => {},
  currentTarget: {
    values: {
      requesterName: "店舗責任者",
      requesterRole: "owner",
      requesterEmail: "owner@example.jp",
      requestedFields: ["price", "hours"],
      changeDetails: "料金と営業時間を更新してください。",
      evidenceUrl: "",
      officialImageUrl: "",
      consentPrivacy: "on",
      consentAccuracy: "on",
      consentImageRights: "on",
      website: "",
    },
  },
});
assert.equal(submittedRequests.length, 1, "encoded owner form must submit once");
assert.equal(submittedRequests[0][0], "/api/shop-owner-request/");
const submittedPayload = JSON.parse(submittedRequests[0][1].body);
assert.equal(submittedPayload.shopSlug, encodedShopSlug);
assert.equal(submittedPayload.targetUrl, encodedTargetUrl);
assert.equal(
  validateShopOwnerRequestPayload(submittedPayload).ok,
  true,
  "the real owner form payload must pass API validation",
);

for (const unsafeEncodedSlug of [
  "%e3%81",
  "%2fshops",
  "%62etty-spa",
  "%E3%82%B7",
  "Ｃ-REST",
  "a".repeat(201),
]) {
  assert.equal(
    parseShopOwnerRequestInitial({ shop_slug: unsafeEncodedSlug }).shopSlug,
    "",
    `reject non-canonical encoded slug ${unsafeEncodedSlug.slice(0, 30)}`,
  );
}

assert.ok(form.startsWith('"use client";'));
assert.match(form, /\/api\/shop-owner-request\//);
assert.match(form, /requestedFields/);
assert.match(form, /officialImageUrl/);
assert.doesNotMatch(form, /type="file"/);
assert.doesNotMatch(form, /dangerouslySetInnerHTML/);
assert.match(form, /gaEvent\("shop_owner_request_submit", \{ shop_slug: initial\.shopSlug, source: initial\.source \}\)/);
assert.match(form, /href="\/contact\/"/);
assert.doesNotMatch(form, /<form id="shop-owner-request"/);
assert.match(
  form,
  /if \(!initial\.shopId \|\| !initial\.shopSlug \|\| !initial\.shopName \|\| !initial\.targetUrl\)[\s\S]*return \([\s\S]*hl-owner-request-empty[\s\S]*<form/,
  "invalid prefill must return before form and GA submission are reachable",
);

assert.match(staticPage, /slug === "storelisting"/);
assert.doesNotMatch(staticPage, /slug === "storelisting" && ownerRequestInitial/);
assert.match(staticPage, /ShopOwnerRequestForm/);
assert.match(
  staticPage,
  /slug === "storelisting"[\s\S]*<section[\s\S]*id="shop-owner-request"[\s\S]*className="hl-contact-section hl-owner-request-section"/,
  "storelisting owner section must always own the anchor, including the empty state",
);
assert.match(route, /searchParams/);
assert.match(route, /ownerRequestInitial=\{parseShopOwnerRequestInitial\(query\)\}/);
assert.match(route, /import \{ Suspense \} from "react"/);
assert.match(route, /async function StoreListingPageContent/);
assert.match(route, /slug === "storelisting"[\s\S]*<Suspense/);
assert.match(css, /\.hl-owner-request-form \.hl-contact-submit/);
assert.match(css, /\.hl-owner-request-section\s*\{[\s\S]*scroll-margin-top:/);
assert.match(
  css,
  /\.hl-owner-request-prefill strong\s*\{[^}]*overflow-wrap:\s*anywhere;/,
  "long shop names must wrap within the prefill row",
);

console.log("shop owner request form check passed");
