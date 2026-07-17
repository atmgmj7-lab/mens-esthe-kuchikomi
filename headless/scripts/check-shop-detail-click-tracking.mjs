import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import ts from "typescript";

const root = process.cwd();
const source = readFileSync(join(root, "components/GoogleAnalytics.tsx"), "utf8");
const shopSlugSource = readFileSync(join(root, "lib/shop-slug.ts"), "utf8");
const require = createRequire(import.meta.url);

const transpiledShopSlug = ts.transpileModule(shopSlugSource, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020
  }
});
const shopSlugModule = { exports: {} };
new Function("require", "module", "exports", transpiledShopSlug.outputText)(
  require,
  shopSlugModule,
  shopSlugModule.exports
);

for (const attribute of [
  "data-shop-cta-kind",
  "data-shop-cta-position",
  "data-shop-slug"
]) {
  assert.ok(source.includes(attribute), `tracking must read ${attribute}`);
}

for (const eventName of [
  "shop_reservation_click",
  "official_site_click",
  "shop_owner_request_click"
]) {
  assert.ok(source.includes(eventName), `tracking must emit ${eventName}`);
}

const onClickStart = source.indexOf("const onClick =");
const listenerStart = source.indexOf("document.addEventListener", onClickStart);
assert.ok(onClickStart >= 0 && listenerStart > onClickStart, "click handler must exist");
const onClickSource = source.slice(onClickStart, listenerStart);
const shopCtaStart = onClickSource.indexOf('getAttribute("data-shop-cta-kind")');
assert.ok(shopCtaStart >= 0, "shop CTA classification must be inside the existing click handler");
for (const genericMarker of [
  'href.startsWith("tel:")',
  'normalizedPathname?.includes("/contact")',
  "isListingPath(normalizedPathname",
  "isExternalHref(href)"
]) {
  const genericStart = onClickSource.indexOf(genericMarker);
  assert.ok(genericStart >= 0, `existing generic classification must keep ${genericMarker}`);
  assert.ok(
    shopCtaStart < genericStart,
    `shop CTA classification must run before ${genericMarker}`
  );
}

assert.equal(
  source.match(/document\.addEventListener\(\s*["']click["']/g)?.length ?? 0,
  1,
  "only one document click listener is allowed"
);
assert.equal(
  source.match(/document\.removeEventListener\(\s*["']click["']/g)?.length ?? 0,
  1,
  "the single document click listener must keep its cleanup"
);
for (const forbiddenKey of [
  "requesterEmail",
  "requester_email",
  "requesterName",
  "requester_name",
  "changeDetails",
  "change_details",
  "formValue",
  "form_value"
]) {
  assert.ok(!source.includes(forbiddenKey), `analytics source must not include ${forbiddenKey}`);
}

function loadGoogleAnalytics(stubs) {
  const result = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020
    },
    fileName: "components/GoogleAnalytics.tsx",
    reportDiagnostics: true
  });
  const errors = (result.diagnostics ?? []).filter(
    (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error
  );
  assert.equal(errors.length, 0, "GoogleAnalytics.tsx must transpile for click checks");

  const module = { exports: {} };
  const localRequire = (specifier) => {
    if (Object.hasOwn(stubs, specifier)) return stubs[specifier];
    if (specifier === "@/lib/shop-slug") return shopSlugModule.exports;
    return require(specifier);
  };
  new Function("require", "module", "exports", result.outputText)(
    localRequire,
    module,
    module.exports
  );
  return module.exports;
}

function withClickHarness(pathname, check) {
  const effects = [];
  const gaEvents = [];
  const addCalls = [];
  const removeCalls = [];
  let activeClickListener = null;

  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  globalThis.window = { location: { origin: "https://mens-esthe-kuchikomi.com" } };
  globalThis.document = {
    addEventListener(type, listener, options) {
      addCalls.push({ type, listener, options });
      if (type === "click") activeClickListener = listener;
    },
    removeEventListener(type, listener, options) {
      removeCalls.push({ type, listener, options });
      if (type === "click" && listener === activeClickListener && options === true) {
        activeClickListener = null;
      }
    }
  };

  try {
    const { GoogleAnalytics } = loadGoogleAnalytics({
      "next/script": { __esModule: true, default: () => null },
      "next/navigation": {
        usePathname: () => pathname,
        useSearchParams: () => ({ toString: () => "" })
      },
      react: {
        useEffect: (effect) => effects.push(effect)
      },
      "@/lib/gtag": {
        GA_MEASUREMENT_ID: "G-TEST",
        gaEvent: (eventName, params) => gaEvents.push({ eventName, params }),
        pageview: () => {}
      }
    });

    GoogleAnalytics();
    const cleanups = effects.map((effect) => effect()).filter(Boolean);
    gaEvents.length = 0;

    assert.equal(addCalls.length, 1, "rendered analytics must register one listener");
    assert.equal(addCalls[0].type, "click");
    assert.equal(addCalls[0].options, true, "click listener must keep capture mode");
    assert.equal(typeof activeClickListener, "function", "click listener must be active");

    const click = ({ href, ctaKind, ctaPosition, shopSlug, text = "private form value" }) => {
      const attributes = new Map([
        ["href", href],
        ["data-shop-cta-kind", ctaKind],
        ["data-shop-cta-position", ctaPosition],
        ["data-shop-slug", shopSlug]
      ]);
      const anchor = {
        classList: { contains: () => false },
        closest: () => null,
        getAttribute: (name) => attributes.get(name) ?? null,
        textContent: text
      };
      activeClickListener({
        target: { closest: (selector) => (selector === "a" ? anchor : null) }
      });
      return gaEvents.splice(0);
    };

    check({ click });

    for (const cleanup of cleanups) cleanup();
    assert.equal(removeCalls.length, 1, "rendered analytics must clean up one listener");
    assert.equal(removeCalls[0].type, "click");
    assert.equal(removeCalls[0].listener, addCalls[0].listener);
    assert.equal(removeCalls[0].options, true, "cleanup must keep capture mode");
    assert.equal(activeClickListener, null, "cleanup must remove the active click listener");
  } finally {
    globalThis.window = previousWindow;
    globalThis.document = previousDocument;
  }
}

const shopCtaCases = [
  { ctaKind: "reservation", href: "/contact/", eventName: "shop_reservation_click" },
  { ctaKind: "line", href: "https://line.me/R/example", eventName: "shop_reservation_click" },
  {
    ctaKind: "tel",
    href: "tel:08000000000",
    eventName: "shop_reservation_click",
    expectedLinkUrl: "tel:"
  },
  { ctaKind: "official", href: "https://official.example/", eventName: "official_site_click" },
  {
    ctaKind: "owner",
    href: "/storelisting/?shop_slug=safe-shop#shop-owner-request",
    eventName: "shop_owner_request_click"
  }
];

for (const testCase of shopCtaCases) {
  for (const ctaPosition of ["hero", "body", "fixed"]) {
    withClickHarness("/shops/path-shop/", ({ click }) => {
      const events = click({
        ...testCase,
        ctaPosition,
        shopSlug: "safe-shop",
        text: "requesterEmail=private@example.com"
      });
      assert.equal(
        events.length,
        1,
        `${testCase.ctaKind} CTA at ${ctaPosition} must emit exactly once`
      );
      assert.equal(events[0].eventName, testCase.eventName);
      assert.deepEqual(Object.keys(events[0].params).sort(), [
        "cta_kind",
        "cta_position",
        "link_url",
        "page_path",
        "shop_slug"
      ]);
      if (testCase.ctaKind === "tel") {
        const serializedParams = JSON.stringify(events[0].params);
        assert.ok(
          !serializedParams.includes("08000000000"),
          "tel CTA params must not contain the phone number"
        );
        assert.ok(
          !events[0].params.link_url.includes("08000000000"),
          "tel CTA link_url must not contain the phone number"
        );
      }
      assert.deepEqual(events[0].params, {
        shop_slug: "safe-shop",
        cta_kind: testCase.ctaKind,
        cta_position: ctaPosition,
        link_url: testCase.expectedLinkUrl ?? testCase.href,
        page_path: "/shops/path-shop/"
      });
    });
  }
}

withClickHarness("/shops/path-shop/", ({ click }) => {
  const [event] = click({
    href: "https://booking.example/",
    ctaKind: "reservation",
    ctaPosition: undefined,
    shopSlug: undefined
  });
  assert.equal(event.params.cta_position, "unknown", "missing CTA position must be unknown");
  assert.equal(event.params.shop_slug, "path-shop", "safe path slug must be the fallback");
});

withClickHarness("/shops/path-shop/", ({ click }) => {
  const [event] = click({
    href: "https://booking.example/",
    ctaKind: "reservation",
    ctaPosition: "hero",
    shopSlug: "Private@Example.COM"
  });
  assert.equal(event.params.shop_slug, "path-shop", "unsafe data slug must not be emitted");
});

withClickHarness("/shops/Unsafe_Path/", ({ click }) => {
  const [event] = click({
    href: "https://booking.example/",
    ctaKind: "reservation",
    ctaPosition: "hero",
    shopSlug: "Private@Example.COM"
  });
  assert.equal(event.params.shop_slug, "", "unsafe data and path slugs must be discarded");
});

const encodedShopSlug =
  "c-rest%ef%bc%88%e3%82%b7%e3%83%bc%e3%83%ac%e3%82%b9%e3%83%88%ef%bc%89";
withClickHarness(`/shops/${encodedShopSlug}/`, ({ click }) => {
  const [event] = click({
    href: "https://official.example/",
    ctaKind: "official",
    ctaPosition: "hero",
    shopSlug: encodedShopSlug
  });
  assert.equal(
    event.params.shop_slug,
    encodedShopSlug,
    "canonical percent-encoded WordPress slug must remain in GA params"
  );
});

const genericCases = [
  {
    ctaKind: undefined,
    href: "tel:08099999999",
    eventName: "tel_click",
    expectedLinkUrl: "tel:"
  },
  { ctaKind: undefined, href: "/contact/", eventName: "contact_click" },
  { ctaKind: undefined, href: "/storelisting/", eventName: "listing_click" },
  { ctaKind: undefined, href: "https://external.example/", eventName: "outbound_click" },
  { ctaKind: "contact", href: "/contact/", eventName: "contact_click" }
];

for (const testCase of genericCases) {
  withClickHarness("/shops/path-shop/", ({ click }) => {
    const events = click(testCase);
    assert.equal(events.length, 1, `${testCase.eventName} must remain a single generic event`);
    assert.equal(events[0].eventName, testCase.eventName);
    if (testCase.expectedLinkUrl) {
      assert.equal(events[0].params.link_url, testCase.expectedLinkUrl);
    }
    if (testCase.eventName === "tel_click") {
      assert.ok(
        !JSON.stringify(events[0].params).includes("08099999999"),
        "generic tel params must not contain the phone number"
      );
    }
  });
}

console.log("shop detail click tracking check passed");
