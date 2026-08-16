import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const cssPath =
  process.env.SHOP_DETAIL_CONTRACT_CSS ??
  "components/shop-detail/ShopDetail.module.css";
const isMutationProbe =
  process.env.SHOP_DETAIL_CONTRACT_MUTATION_PROBE === "1";
const isHeroTitleMutationProbe =
  process.env.SHOP_DETAIL_HERO_TITLE_MUTATION_PROBE === "1";
const css = readFileSync(cssPath, "utf8");
const require = createRequire(import.meta.url);

const componentClassContract = {
  "components/shop-detail/ShopDetailActions.tsx": [
    "actions",
    "fixedActions",
    "primaryAction",
    "secondaryAction"
  ],
  "components/shop-detail/ShopDetailGallery.tsx": [
    "gallery",
    "mainImage"
  ],
  "components/shop-detail/ShopDetailHero.tsx": [
    "facts",
    "hero",
    "kicker",
    "heroReviewSummary",
    "title",
    "titleRow",
    "verified"
  ],
  "components/shop-detail/ShopDetailSections.tsx": [],
  "components/shop-detail/ShopDetailModuleList.tsx": [
    "kicker",
    "nearbyContent",
    "reviews",
    "reviewSubmitLink",
    "section",
    "sectionHeading",
    "sections",
    "sourceNote",
    "textLink"
  ],
  "components/shop-detail/ShopOverviewSection.tsx": ["catch", "informationDashboard", "kicker", "overviewBody", "richText", "section", "sectionHeading", "sourceNote", "sourceSeparated"],
  "components/shop-detail/ShopPricesSection.tsx": ["kicker", "section", "sectionHeading", "sourceNote", "table"],
  "components/shop-detail/ShopFeaturesSection.tsx": ["features", "kicker", "section", "sectionHeading"],
  "components/shop-detail/ShopAccessSection.tsx": ["infoTable", "kicker", "section", "sectionAnchor", "sectionHeading"],
  "components/shop-detail/ShopBasicInformationSection.tsx": ["infoTable", "kicker", "section", "sectionAnchor", "sectionHeading", "sourceNote"],
  "components/shop-detail/ShopInformationCoverage.tsx": ["coverageCard", "coverageCount", "coverageItems", "coverageTrack", "dashboardCardHeader", "dashboardEyebrow", "sourceNote"],
  "components/shop-detail/ShopRankingSnapshot.tsx": ["dashboardCardHeader", "dashboardEyebrow", "prLabel", "rankingCard", "rankingMeta", "rankingValue"],
  "components/shop-detail/ShopOwnerCta.tsx": [
    "kicker",
    "ownerCta",
    "ownerHeading"
  ],
  "components/shop-detail/ShopRelatedLinks.tsx": ["relatedLinks"],
  "components/shop-detail/ShopSectionNav.tsx": [
    "sectionNav",
    "sectionNavLayer",
    "sectionNavLink",
    "sectionNavList"
  ]
};

const plannedLayoutClasses = [
  "detailGrid",
  "detailContent",
  "page",
  "shell",
  "visual",
  "sectionNav"
];

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findMatchingBrace(source, openIndex) {
  let depth = 0;
  let quote = "";

  for (let index = openIndex; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];

    if (quote) {
      if (char === "\\") {
        index += 1;
      } else if (char === quote) {
        quote = "";
      }
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }

    if (char === "/" && next === "*") {
      const commentEnd = source.indexOf("*/", index + 2);
      assert.notEqual(commentEnd, -1, "CSS comment must be closed");
      index = commentEnd + 1;
      continue;
    }

    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0) return index;
  }

  assert.fail(`CSS block starting at ${openIndex} must have a closing brace`);
}

function extractTopLevelMedia(source) {
  const baseParts = [];
  const media = new Map();
  let baseCursor = 0;
  let depth = 0;
  let quote = "";

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];

    if (quote) {
      if (char === "\\") {
        index += 1;
      } else if (char === quote) {
        quote = "";
      }
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }

    if (char === "/" && next === "*") {
      const commentEnd = source.indexOf("*/", index + 2);
      assert.notEqual(commentEnd, -1, "CSS comment must be closed");
      index = commentEnd + 1;
      continue;
    }

    if (depth === 0 && source.startsWith("@media", index)) {
      const openIndex = source.indexOf("{", index + 6);
      assert.notEqual(openIndex, -1, "@media must have an opening brace");
      const closeIndex = findMatchingBrace(source, openIndex);
      const query = source
        .slice(index + 6, openIndex)
        .replace(/\s+/g, "")
        .trim();

      assert.ok(query, "@media query must not be empty");
      assert.ok(!media.has(query), `duplicate top-level @media ${query} is not allowed`);
      baseParts.push(source.slice(baseCursor, index));
      media.set(query, source.slice(openIndex + 1, closeIndex));
      baseCursor = closeIndex + 1;
      index = closeIndex;
      continue;
    }

    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    assert.ok(depth >= 0, "CSS braces must stay balanced");
  }

  assert.equal(depth, 0, "CSS braces must be balanced");
  baseParts.push(source.slice(baseCursor));
  return { base: baseParts.join("\n"), media };
}

const responsiveRegions = extractTopLevelMedia(css);
const expectedMediaQueries = [
  "(max-width:1024px)",
  "(max-width:900px)",
  "(max-width:768px)",
  "(max-width:760px)",
  "(max-width:500px)",
  "(max-width:390px)",
  "(max-width:360px)",
  "(max-width:320px)"
];
const actualMediaQueries = [...responsiveRegions.media.keys()];

const baseCss = responsiveRegions.base;
const compactCss = responsiveRegions.media.get("(max-width:1024px)");
const tabletCss = responsiveRegions.media.get("(max-width:900px)");
const mobileCss = responsiveRegions.media.get("(max-width:760px)");
const narrowCss = responsiveRegions.media.get("(max-width:360px)");

function referencedStyleClasses(source) {
  return [
    ...new Set(
      [...source.matchAll(/styles\.([A-Za-z][A-Za-z0-9_]*)/g)].map(
        (match) => match[1]
      )
    )
  ].sort();
}

function ruleDeclarationsIn(source, selectorPattern) {
  const matches = [];
  const rulePattern = /([^{}]+)\{([^{}]*)\}/g;
  let match;

  while ((match = rulePattern.exec(source)) !== null) {
    if (selectorPattern.test(match[1])) matches.push(match[2]);
  }

  return matches.join("\n");
}

function exactSelectorDeclarationsIn(source, expectedSelector) {
  const matches = [];
  const normalizedExpectedSelector = expectedSelector.replace(/\s+/g, " ").trim();
  const rulePattern = /([^{}]+)\{([^{}]*)\}/g;
  let match;

  while ((match = rulePattern.exec(source)) !== null) {
    const selectors = match[1]
      .split(",")
      .map((selector) => selector.replace(/\s+/g, " ").trim());
    if (selectors.includes(normalizedExpectedSelector)) matches.push(match[2]);
  }

  return matches.join("\n");
}

function lastDeclarationValue(declarations, propertyName) {
  const declarationPattern = new RegExp(
    `(?:^|;)\\s*${escapeRegExp(propertyName)}\\s*:\\s*([^;]+)`,
    "gi"
  );
  let lastValue;
  let match;

  while ((match = declarationPattern.exec(declarations)) !== null) {
    lastValue = match[1].trim();
  }

  return lastValue;
}

function effectiveOutlineState(declarations) {
  const state = { color: "", style: "", width: "" };
  const declarationPattern =
    /(?:^|;)\s*(outline(?:-(?:color|style|width))?)\s*:\s*([^;]+)/gi;
  let match;

  while ((match = declarationPattern.exec(declarations)) !== null) {
    const propertyName = match[1].toLowerCase();
    const value = match[2].trim();

    if (propertyName === "outline") {
      if (/^(?:none|0(?:px)?)$/i.test(value)) {
        state.color = "";
        state.style = "none";
        state.width = "0";
        continue;
      }

      state.color =
        value.match(/(?:var\(--[a-z-]+\)|#[0-9a-f]{6})/i)?.[0] ?? "";
      state.style = value.match(/\b(?:solid|dashed|dotted|double)\b/i)?.[0] ?? "";
      state.width = value.match(/\b\d+px\b/i)?.[0] ?? "";
      continue;
    }

    state[propertyName.slice("outline-".length)] = value;
  }

  return state;
}

function ruleDeclarations(selectorPattern) {
  return ruleDeclarationsIn(css, selectorPattern);
}

function classDeclarationsIn(source, className) {
  const classPattern = new RegExp(`\\.${escapeRegExp(className)}(?![A-Za-z0-9_-])`);
  return ruleDeclarationsIn(source, classPattern);
}

function classDeclarations(className) {
  return classDeclarationsIn(css, className);
}

function assertClassDeclaration(className, declarationPattern, message) {
  assert.match(classDeclarations(className), declarationPattern, message);
}

function assertSelectorDeclaration(selectorPattern, declarationPattern, message) {
  assert.match(ruleDeclarations(selectorPattern), declarationPattern, message);
}

function assertClassDeclarationIn(source, className, declarationPattern, message) {
  assert.match(classDeclarationsIn(source, className), declarationPattern, message);
}

function assertClassDoesNotDeclareIn(source, className, declarationPattern, message) {
  assert.doesNotMatch(classDeclarationsIn(source, className), declarationPattern, message);
}

function assertMinimumTapHeight(selectorPattern, label) {
  const declarations = ruleDeclarations(selectorPattern);
  const values = [...declarations.matchAll(/min-height:\s*(\d+)px/g)].map((match) =>
    Number(match[1])
  );
  assert.ok(
    values.some((value) => value >= 44),
    `${label} must have a minimum tap height of at least 44px`
  );
}

function relativeLuminance(hexColor) {
  assert.match(hexColor, /^#[0-9a-f]{6}$/i, `unsupported color ${hexColor}`);
  const channels = [1, 3, 5].map((offset) =>
    Number.parseInt(hexColor.slice(offset, offset + 2), 16) / 255
  );
  const linearChannels = channels.map((channel) =>
    channel <= 0.03928
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4
  );
  return (
    0.2126 * linearChannels[0] +
    0.7152 * linearChannels[1] +
    0.0722 * linearChannels[2]
  );
}

function contrastRatio(firstColor, secondColor) {
  const firstLuminance = relativeLuminance(firstColor);
  const secondLuminance = relativeLuminance(secondColor);
  const lighter = Math.max(firstLuminance, secondLuminance);
  const darker = Math.min(firstLuminance, secondLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

function captureContractFailure(failures, check) {
  try {
    check();
  } catch (error) {
    failures.push(error instanceof Error ? error.message : String(error));
  }
}

const shopTitleFixtures = [
  {
    label: "long Latin, Japanese, and full-width-parentheses title",
    value: "PREMIUM RELAXATION SALON大阪日本橋（全角括弧）",
    wrapMode: "natural"
  },
  {
    label: "unspaced Latin title",
    value: "UNBROKENLATINSHOPNAMETOKEN",
    wrapMode: "emergency"
  }
];

function loadShopDetailHeroModule() {
  const componentPath = "components/shop-detail/ShopDetailHero.tsx";
  const originalSource = readFileSync(componentPath, "utf8");
  const titleExpression = "{model.title}";
  const source = isHeroTitleMutationProbe
    ? originalSource.replace(titleExpression, '{"DISCONNECTED TITLE"}')
    : originalSource;
  if (isHeroTitleMutationProbe) {
    assert.notEqual(
      source,
      originalSource,
      "shop detail hero title mutation must disconnect model.title"
    );
  }

  const result = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020
    },
    fileName: componentPath,
    reportDiagnostics: true
  });
  const errors = (result.diagnostics ?? []).filter(
    (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error
  );
  assert.equal(
    errors.length,
    0,
    `${componentPath} must transpile for rendered title checks`
  );

  const module = { exports: {} };
  const localRequire = (specifier) => {
    if (specifier === "@/components/shop-detail/ShopDetailActions") {
      return { ShopDetailActions: () => null };
    }
    if (specifier === "./ShopDetail.module.css") {
      return {
        __esModule: true,
        default: new Proxy({}, { get: (_target, property) => String(property) })
      };
    }
    return require(specifier);
  };
  new Function("require", "module", "exports", result.outputText)(
    localRequire,
    module,
    module.exports
  );
  return module.exports;
}

function renderShopTitleFixture(ShopDetailHero, fixture) {
  const html = renderToStaticMarkup(
    React.createElement(ShopDetailHero, {
      model: {
        areaName: "osaka",
        facts: [],
        title: fixture.value,
        verifiedAt: null
      },
      review: {
        status: "available",
        totalApproved: 0,
        showGraph: false,
        aggregateRating: null
      },
      rel: "nofollow sponsored noopener"
    })
  );
  const titleMatch = html.match(/<h1 class="([^"]+)">([^<]*)<\/h1>/);
  assert.ok(
    titleMatch,
    `${fixture.label} must render through the ShopDetailHero h1 path; received ${html}`
  );
  assert.equal(
    titleMatch[2],
    fixture.value,
    `${fixture.label} must render the exact model.title value`
  );
  return { className: titleMatch[1], html };
}

function loadShopDetailActionsModule() {
  const componentPath = "components/shop-detail/ShopDetailActions.tsx";
  const source = readFileSync(componentPath, "utf8");
  const result = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020
    },
    fileName: componentPath,
    reportDiagnostics: true
  });
  const errors = (result.diagnostics ?? []).filter(
    (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error
  );
  assert.equal(errors.length, 0, `${componentPath} must transpile for action checks`);

  const module = { exports: {} };
  const localRequire = (specifier) => {
    if (specifier === "@/lib/shop-slug") {
      return { normalizePublicShopSlug: (slug) => slug };
    }
    if (specifier === "./ShopDetail.module.css") {
      return {
        __esModule: true,
        default: new Proxy({}, { get: (_target, property) => String(property) })
      };
    }
    return require(specifier);
  };
  new Function("require", "module", "exports", result.outputText)(
    localRequire,
    module,
    module.exports
  );
  return module.exports;
}

function renderedActionKinds(ShopDetailActions, actions, options = {}) {
  const html = renderToStaticMarkup(
    React.createElement(ShopDetailActions, {
      model: { actions, slug: "action-contract-shop" },
      position: options.fixed ? "fixed" : "hero",
      fixed: options.fixed,
      rel: "nofollow sponsored noopener"
    })
  );
  return {
    html,
    classes: [...html.matchAll(/<a[^>]*class="([^"]+)"/g)].map(
      (match) => match[1]
    ),
    kinds: [...html.matchAll(/data-shop-cta-kind="([^"]+)"/g)].map(
      (match) => match[1]
    ),
    hrefs: [...html.matchAll(/href="([^"]+)"/g)].map((match) => match[1])
  };
}

const { ShopDetailHero } = loadShopDetailHeroModule();
assert.equal(
  typeof ShopDetailHero,
  "function",
  "ShopDetailHero must export a renderable component"
);
const renderedShopTitleFixtures = shopTitleFixtures.map((fixture) => ({
  fixture,
  ...renderShopTitleFixture(ShopDetailHero, fixture)
}));
assert.deepEqual(
  [...new Set(renderedShopTitleFixtures.map(({ className }) => className))],
  ["title"],
  "all shop title fixtures must render through the same ShopDetailHero title class"
);

const shopTitleViewportContract = [
  [1440, 34],
  [1280, 34],
  [1024, 30],
  [768, 30],
  [760, 26],
  [500, 26],
  [390, 26],
  [375, 26],
  [360, 23],
  [320, 23]
];

function maxWidthFromQuery(query) {
  const match = query.match(/^\(max-width:(\d+)px\)$/);
  assert.ok(match, `unsupported responsive query ${query}`);
  return Number(match[1]);
}

function titleDeclarationLayersAtWidth(viewportWidth) {
  const layers = [exactSelectorDeclarationsIn(baseCss, ".title")];

  for (const [query, region] of responsiveRegions.media) {
    if (viewportWidth <= maxWidthFromQuery(query)) {
      layers.push(exactSelectorDeclarationsIn(region, ".title"));
    }
  }

  return layers;
}

function fontSizeFromShorthand(fontValue) {
  return (
    fontValue.match(/clamp\([^)]*\)/)?.[0] ??
    fontValue.match(/var\([^)]*\)/)?.[0] ??
    fontValue.match(/\b\d*\.?\d+(?:px|rem|vw)\b/)?.[0]
  );
}

function cssLengthToPixels(value, viewportWidth, customProperties) {
  const normalizedValue = value.trim();
  const variableMatch = normalizedValue.match(/^var\((--[a-z-]+)\)$/i);
  if (variableMatch) {
    const resolvedValue = customProperties.get(variableMatch[1]);
    assert.ok(resolvedValue, `unresolved title size variable ${normalizedValue}`);
    return cssLengthToPixels(resolvedValue, viewportWidth, customProperties);
  }

  const clampMatch = normalizedValue.match(/^clamp\((.*)\)$/i);
  if (clampMatch) {
    const parts = clampMatch[1].split(",").map((part) => part.trim());
    assert.equal(parts.length, 3, `unsupported clamp value ${normalizedValue}`);
    const [minimum, preferred, maximum] = parts.map((part) =>
      cssLengthToPixels(part, viewportWidth, customProperties)
    );
    return Math.min(maximum, Math.max(minimum, preferred));
  }

  const lengthMatch = normalizedValue.match(/^(\d*\.?\d+)(px|rem|vw)$/i);
  assert.ok(lengthMatch, `unsupported title font size ${normalizedValue}`);
  const numericValue = Number(lengthMatch[1]);
  const unit = lengthMatch[2].toLowerCase();
  if (unit === "px") return numericValue;
  if (unit === "rem") return numericValue * 16;
  return (numericValue * viewportWidth) / 100;
}

function titleFontSizeAtWidth(viewportWidth) {
  const customProperties = new Map();
  let fontSizeValue;

  for (const declarations of titleDeclarationLayersAtWidth(viewportWidth)) {
    for (const match of declarations.matchAll(
      /(?:^|;)\s*(--[a-z-]+)\s*:\s*([^;]+)/gi
    )) {
      customProperties.set(match[1], match[2].trim());
    }

    const explicitFontSize = lastDeclarationValue(declarations, "font-size");
    if (explicitFontSize) fontSizeValue = explicitFontSize;

    const fontShorthand = lastDeclarationValue(declarations, "font");
    if (fontShorthand) {
      fontSizeValue = fontSizeFromShorthand(fontShorthand);
    }
  }

  assert.ok(fontSizeValue, `${viewportWidth}px title must declare a font size`);
  return cssLengthToPixels(fontSizeValue, viewportWidth, customProperties);
}

const shopTitleContractFailures = [];
captureContractFailure(shopTitleContractFailures, () => {
  assert.deepEqual(
    actualMediaQueries,
    expectedMediaQueries,
    "responsive CSS must expose the title and layout breakpoints in order"
  );
});

const baseTitleDeclarations = exactSelectorDeclarationsIn(baseCss, ".title");
const allTitleDeclarations = classDeclarations("title");
for (const fixture of shopTitleFixtures) {
  if (fixture.wrapMode === "natural") {
    captureContractFailure(shopTitleContractFailures, () => {
      assert.match(fixture.value, /[A-Za-z]+.*[\u3040-\u30ff\u3400-\u9fff]+.*（.+）/);
    });
    captureContractFailure(shopTitleContractFailures, () => {
      assert.match(
        baseTitleDeclarations,
        /word-break:\s*normal/,
        `${fixture.label} must keep normal word boundaries`
      );
    });
    captureContractFailure(shopTitleContractFailures, () => {
      assert.match(
        baseTitleDeclarations,
        /line-break:\s*strict/,
        `${fixture.label} must use strict Japanese line breaking`
      );
    });
    captureContractFailure(shopTitleContractFailures, () => {
      assert.doesNotMatch(
        allTitleDeclarations,
        /overflow-wrap:\s*anywhere/,
        `${fixture.label} must not allow arbitrary title breaks`
      );
    });
  } else {
    captureContractFailure(shopTitleContractFailures, () => {
      assert.match(fixture.value, /^[A-Z]+$/);
    });
    captureContractFailure(shopTitleContractFailures, () => {
      assert.match(
        baseTitleDeclarations,
        /overflow-wrap:\s*break-word/,
        `${fixture.label} needs emergency wrapping for an unbroken token`
      );
    });
  }
}

captureContractFailure(shopTitleContractFailures, () => {
  assert.match(
    baseTitleDeclarations,
    /line-height:\s*1\.24(?:\s*;|\s*$)/,
    "shop title line height must be 1.24"
  );
});

for (const [viewportWidth, expectedFontSize] of shopTitleViewportContract) {
  captureContractFailure(shopTitleContractFailures, () => {
    const actualFontSize = titleFontSizeAtWidth(viewportWidth);
    assert.ok(
      Math.abs(actualFontSize - expectedFontSize) < 0.01,
      `${viewportWidth}px title font size must be ${expectedFontSize}px; received ${actualFontSize.toFixed(2)}px`
    );
  });
}

captureContractFailure(shopTitleContractFailures, () => {
  assert.match(
    baseTitleDeclarations,
    /min-width:\s*0/,
    "shop title must be shrinkable inside its grid container"
  );
  assert.match(
    baseTitleDeclarations,
    /max-width:\s*100%/,
    "shop title must stay inside its grid container"
  );
  assert.match(
    ruleDeclarationsIn(baseCss, /\.titleRow\s*>\s*\*/),
    /min-width:\s*0/,
    "shop title container children must be shrinkable"
  );
});

assert.equal(
  shopTitleContractFailures.length,
  0,
  `shop title responsive contract failed:\n- ${shopTitleContractFailures.join("\n- ")}`
);

const { ShopDetailActions } = loadShopDetailActionsModule();
const unorderedActions = [
  { kind: "tel", label: "電話予約", href: "tel:0612345678", external: false },
  { kind: "line", label: "LINE予約", href: "https://line.example.test/", external: true },
  { kind: "official", label: "公式サイト", href: "https://official.example.test/", external: true },
  { kind: "reservation", label: "Web予約", href: "https://booking.example.test/", external: true },
  { kind: "line", label: "別のLINE", href: "https://line-duplicate.example.test/", external: true }
];
const topActions = renderedActionKinds(ShopDetailActions, unorderedActions);
assert.deepEqual(
  topActions.kinds,
  ["reservation", "official", "line", "tel"],
  "shop detail top actions must follow Web reservation, official, LINE, telephone and stop at four"
);

const duplicateUrlActions = renderedActionKinds(ShopDetailActions, [
  { kind: "official", label: "公式サイト", href: "https://shared.example.test/", external: true },
  { kind: "reservation", label: "Web予約", href: "https://shared.example.test/", external: true },
  { kind: "line", label: "LINE予約", href: "https://line.example.test/", external: true },
  { kind: "tel", label: "電話予約", href: "tel:0612345678", external: false }
]);
assert.deepEqual(
  duplicateUrlActions.kinds,
  ["reservation", "line", "tel"],
  "same action URL must keep only the earliest action in the priority order"
);
assert.equal(
  new Set(duplicateUrlActions.hrefs).size,
  duplicateUrlActions.hrefs.length,
  "shop detail actions must not render the same URL twice in one group"
);

const fixedActions = renderedActionKinds(ShopDetailActions, unorderedActions, {
  fixed: true
});
assert.deepEqual(
  fixedActions.kinds,
  ["reservation", "official"],
  "mobile fixed actions must contain one primary and one secondary action"
);

const fixedWithoutOfficial = renderedActionKinds(
  ShopDetailActions,
  unorderedActions.filter((action) => action.kind !== "official"),
  { fixed: true }
);
assert.deepEqual(
  fixedWithoutOfficial.classes,
  ["primaryAction", "secondaryAction"],
  "mobile fixed actions must style only the first available action as primary"
);

function resolveColorToken(colorToken, pageColors) {
  const variableMatch = colorToken.match(/^var\((--[a-z-]+)\)$/i);
  if (variableMatch) {
    const resolvedColor = pageColors.get(variableMatch[1]);
    assert.ok(resolvedColor, `unsupported color variable ${colorToken}`);
    return resolvedColor;
  }

  assert.match(colorToken, /^#[0-9a-f]{6}$/i, `unsupported color ${colorToken}`);
  return colorToken;
}

for (const [componentPath, expectedClasses] of Object.entries(componentClassContract)) {
  const source = readFileSync(componentPath, "utf8");
  const actualClasses = referencedStyleClasses(source);
  assert.deepEqual(
    actualClasses,
    [...expectedClasses].sort(),
    `${componentPath} style references changed; update the responsive contract intentionally`
  );

  for (const className of actualClasses) {
    assert.match(
      css,
      new RegExp(`\\.${escapeRegExp(className)}(?![A-Za-z0-9_-])`),
      `${cssPath} must define .${className} referenced by ${componentPath}`
    );
  }
}

for (const className of plannedLayoutClasses) {
  assert.match(
    css,
    new RegExp(`\\.${escapeRegExp(className)}(?![A-Za-z0-9_-])`),
    `${cssPath} must define planned layout class .${className}`
  );
}

const basePageDeclarations = classDeclarationsIn(baseCss, "page");
const baseGoldMatch = basePageDeclarations.match(/--gold:\s*(#[0-9a-f]{6})/i);
assert.ok(baseGoldMatch, "base page must declare a six-digit --gold color");
const baseGoldContrast = contrastRatio(baseGoldMatch[1], "#ffffff");
assert.ok(
  baseGoldContrast >= 4.5,
  `base gold on white must reach 4.5:1 contrast; received ${baseGoldContrast.toFixed(2)}:1`
);

const pageColors = new Map(
  [...basePageDeclarations.matchAll(/(--[a-z-]+):\s*(#[0-9a-f]{6})/gi)].map(
    (match) => [match[1], match[2]]
  )
);
const green = pageColors.get("--green");
assert.ok(green, "base page must declare a six-digit --green color");

const accessibilityFailures = [];
captureContractFailure(accessibilityFailures, () => {
  assert.match(
    classDeclarationsIn(baseCss, "ownerCta"),
    /background:\s*var\(--green\)/,
    "owner CTA contrast must be measured on the shared deep-green background"
  );
  const ownerKickerDeclarations = ruleDeclarationsIn(
    baseCss,
    /\.ownerCta\s+\.kicker(?:\s|,|$)/
  );
  const ownerKickerColorMatch = ownerKickerDeclarations.match(
    /color:\s*(#[0-9a-f]{6})/i
  );
  assert.ok(
    ownerKickerColorMatch,
    "owner CTA kicker must override the base gold with a six-digit light-gold color"
  );
  const ownerKickerContrast = contrastRatio(ownerKickerColorMatch[1], green);
  assert.ok(
    ownerKickerContrast >= 4.5,
    `owner CTA kicker on deep green must reach 4.5:1 contrast; received ${ownerKickerContrast.toFixed(2)}:1`
  );

  const ownerHeadingDeclarations = ruleDeclarationsIn(
    baseCss,
    /\.ownerCta\s+\.ownerHeading(?:\s|,|$)/
  );
  const ownerHeadingColor = lastDeclarationValue(
    ownerHeadingDeclarations,
    "color"
  );
  assert.match(
    ownerHeadingColor ?? "",
    /^#[0-9a-f]{6}\s*!important$/i,
    "owner CTA heading must explicitly override the global important heading color"
  );
  const ownerHeadingContrast = contrastRatio(
    ownerHeadingColor.replace(/\s*!important$/i, ""),
    green
  );
  assert.ok(
    ownerHeadingContrast >= 4.5,
    `owner CTA heading on deep green must reach 4.5:1 contrast; received ${ownerHeadingContrast.toFixed(2)}:1`
  );
});

for (const [selector, label, surfaceColor] of [
  [".primaryAction:focus-visible", "primary and fixed primary actions", "#ffffff"],
  [".secondaryAction:focus-visible", "secondary and fixed secondary actions", "#ffffff"],
  [".sectionNavLink:focus-visible", "section navigation links", "#ffffff"],
  [".infoTable a:focus-visible", "official information links", "#ffffff"],
  [".textLink:focus-visible", "review text links", "#ffffff"],
  [".ownerCta > a:focus-visible", "owner CTA link", green]
]) {
  captureContractFailure(accessibilityFailures, () => {
    const declarations = exactSelectorDeclarationsIn(baseCss, selector);
    const outline = effectiveOutlineState(declarations);
    const outlineWidthMatch = outline.width.match(/^(\d+)px$/i);
    assert.ok(
      outlineWidthMatch && outline.style === "solid" && outline.color,
      `${label} focus outline must remain visible after cascade`
    );
    assert.ok(
      Number(outlineWidthMatch[1]) >= 2,
      `${label} focus outline must be at least 2px wide`
    );
    const offsetMatch = (lastDeclarationValue(declarations, "outline-offset") ?? "").match(
      /^(\d+)px$/i
    );
    assert.ok(offsetMatch, `${label} focus outline must declare an offset`);
    assert.ok(
      Number(offsetMatch[1]) >= 2,
      `${label} focus outline offset must be at least 2px`
    );
    const outlineColor = resolveColorToken(outline.color, pageColors);
    const outlineContrast = contrastRatio(outlineColor, surfaceColor);
    assert.ok(
      outlineContrast >= 3,
      `${label} focus outline must reach 3:1 contrast; received ${outlineContrast.toFixed(2)}:1`
    );
  });
}

assert.equal(
  accessibilityFailures.length,
  0,
  `shop detail accessibility contract failed:\n- ${accessibilityFailures.join("\n- ")}`
);

assertClassDeclarationIn(baseCss, "page", /width:\s*100%/, "base page must stay within its containing block");
assertClassDeclarationIn(baseCss, "shell", /max-width:\s*1200px/, "base desktop shell must stop at 1200px");
assertClassDeclarationIn(
  baseCss,
  "shell",
  /width:\s*calc\(\s*100%\s*-\s*80px\s*\)/,
  "desktop shell must keep 40px outer margins at 1440, 1280, and 1024"
);
assertClassDeclarationIn(baseCss, "shell", /padding-inline:\s*24px/, "desktop detail grid needs 24px inner gutters");
assertClassDeclarationIn(
  baseCss,
  "detailGrid",
  /grid-template-areas:\s*"visual hero"\s*"content content"/,
  "desktop detail grid must place the gallery beside the hero before full-width content"
);
assertClassDeclarationIn(
  baseCss,
  "detailGrid",
  /grid-template-columns:\s*minmax\(0,\s*460px\)\s+minmax\(0,\s*1fr\)/,
  "desktop detail grid must reserve a compact 460px square-media column"
);
assertClassDeclarationIn(
  baseCss,
  "detailGrid",
  /(?:gap:\s*(?:0\s+)?48px|column-gap:\s*48px)/,
  "desktop detail columns need a 48px editorial gap"
);

for (const [viewportWidth, expectedShellWidth, expectedMediaWidth] of [
  [1440, 1200, 460],
  [1280, 1200, 460]
]) {
  const shellWidth = Math.min(1200, viewportWidth - 80);
  assert.equal(shellWidth, expectedShellWidth, `${viewportWidth}px shell width must be ${expectedShellWidth}px`);
  assert.equal(460, expectedMediaWidth, `${viewportWidth}px square media column must be ${expectedMediaWidth}px`);
}

assertClassDeclarationIn(
  compactCss,
  "detailGrid",
  /grid-template-areas:\s*"visual"\s*"hero"\s*"content"/,
  "1024px and below must order gallery, facts and actions, then content"
);
assertClassDeclarationIn(
  compactCss,
  "detailGrid",
  /grid-template-columns:\s*minmax\(0,\s*1fr\)/,
  "1024px and below must collapse the detail grid to one column"
);
for (const [label, region] of [
  ["900px", tabletCss],
  ["760px", mobileCss],
  ["360px", narrowCss]
]) {
  assertClassDoesNotDeclareIn(
    region,
    "shell",
    /padding-inline:\s*24px/,
    `desktop 24px inner gutters must not be redeclared in the ${label} block`
  );
}

for (const className of ["mainImage"]) {
  assertClassDeclarationIn(
    baseCss,
    className,
    /aspect-ratio:\s*1(?:\s*\/\s*1)?/,
    `base .${className} must be square`
  );
}

for (const selectorPattern of [/\.mainImage\s+img/]) {
  const imageDeclarations = ruleDeclarations(selectorPattern);
  const imageHeights = [
    ...imageDeclarations.matchAll(/(?:^|;)\s*height:\s*([^;}]+)/g)
  ].map((match) => match[1].trim());

  assertSelectorDeclaration(selectorPattern, /width:\s*100%/, "shop images must fill media width");
  assertSelectorDeclaration(selectorPattern, /height:\s*100%/, "shop images must fill media height");
  assertSelectorDeclaration(selectorPattern, /object-fit:\s*cover/, "shop images must crop without stretching");
  assert.doesNotMatch(
    imageDeclarations,
    /min-height\s*:/,
    "shop images must not receive a conflicting min-height"
  );
  assert.deepEqual(
    [...new Set(imageHeights)],
    ["100%"],
    "shop images must not receive a forced height other than 100% of the square box"
  );
}

assertClassDeclarationIn(
  baseCss,
  "facts",
  /grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/,
  "desktop profile facts must use two columns"
);
for (const [label, region] of [
  ["900px", tabletCss],
  ["760px", mobileCss]
]) {
  assertClassDoesNotDeclareIn(
    region,
    "facts",
    /grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/,
    `the ${label} facts must inherit the base two-column contract`
  );
}
assertSelectorDeclaration(/\.facts\s*>\s*div/, /min-width:\s*0/, "fact columns must be shrinkable");
assertSelectorDeclaration(/\.facts\s+dd/, /overflow-wrap:\s*anywhere/, "long fact values must wrap");
assertSelectorDeclaration(
  /\.facts\s+dd/,
  /font:\s*500\s+18px\s*\/\s*1\.4/,
  "profile fact values must not exceed 18px"
);

for (const [selectorPattern, label] of [
  [/\.primaryAction/, "primary action"],
  [/\.secondaryAction/, "secondary action"],
  [/\.textLink/, "review text link"],
  [/\.infoTable\s+a/, "official information link"],
  [/\.sectionNavLink/, "section navigation link"],
  [/\.ownerCta\s*>\s*a/, "owner CTA link"],
  [/\.fixedActions\s+a/, "fixed action"]
]) {
  assertMinimumTapHeight(selectorPattern, label);
}

for (const [selectorPattern, label] of [
  [/\.actions\s+a/, "action label"],
  [/\.table\s+(?:th|td)/, "price table value"],
  [/\.infoTable\s+(?:th|td)/, "information table value"],
  [/\.infoTable\s+a/, "long official URL"],
  [/\.ownerCta\s*>\s*a/, "owner CTA label"],
  [/\.fixedActions\s+a/, "fixed CTA label"]
]) {
  assertSelectorDeclaration(selectorPattern, /overflow-wrap:\s*anywhere/, `${label} must wrap`);
}

assertClassDeclarationIn(baseCss, "fixedActions", /display:\s*none/, "base fixed actions must be hidden");
for (const [label, region] of [
  ["900px", tabletCss],
  ["760px", mobileCss],
  ["360px", narrowCss]
]) {
  assertClassDoesNotDeclareIn(
    region,
    "fixedActions",
    /display:\s*none/,
    `default fixed-action hiding must not be redeclared in the ${label} block`
  );
}

assertClassDeclarationIn(
  tabletCss,
  "titleRow",
  /grid-template-columns:\s*minmax\(0,\s*1fr\)/,
  "900px block must collapse the title row"
);

assertClassDeclarationIn(
  mobileCss,
  "shell",
  /width:\s*calc\(\s*100%\s*-\s*32px\s*\)/,
  "760px shell must keep 16px outer margins"
);
assertClassDeclarationIn(mobileCss, "shell", /padding-inline:\s*0/, "760px shell must not add inner gutters beyond its 16px margins");
for (const [label, region] of [
  ["base", baseCss],
  ["900px", tabletCss],
  ["360px", narrowCss]
]) {
  assertClassDoesNotDeclareIn(
    region,
    "shell",
    /width:\s*calc\(\s*100%\s*-\s*32px\s*\)/,
    `mobile 16px outer margins must only be declared in the 760px block, not ${label}`
  );
}

const gallerySource = readFileSync("components/shop-detail/ShopDetailGallery.tsx", "utf8");
assert.equal(
  gallerySource.match(/loading="eager"/g)?.length ?? 0,
  1,
  "only the main shop image may load eagerly"
);
assert.equal(
  gallerySource.match(/fetchPriority="high"/g)?.length ?? 0,
  1,
  "only the main shop image may receive high fetch priority"
);
assert.match(gallerySource, /width=\{mainImage\.width \?\? 960\}[\s\S]*height=\{mainImage\.height \?\? 960\}[\s\S]*sizes=/, "main image must declare square intrinsic size and responsive sizes");
assert.equal(gallerySource.includes('loading="lazy"'), false, "unapproved detail thumbnails must not be rendered");
for (const expectedSize of [
  "(max-width: 760px) calc(100vw - 32px)",
  "(max-width: 1024px) 520px",
  "460px"
]) {
  assert.ok(
    gallerySource.includes(expectedSize),
    `main image sizes must include ${expectedSize}`
  );
}
const nearbyImageSource = readFileSync("components/common/AreaShopCardImage.tsx", "utf8");
assert.match(nearbyImageSource, /loading="lazy"/, "nearby shop images must remain lazy");
assert.match(nearbyImageSource, /width=\{480\}[\s\S]*height=\{360\}/, "nearby shop images must keep 4:3 intrinsic dimensions");

assertClassDeclarationIn(mobileCss, "fixedActions", /display:\s*grid/, "760px fixed actions must be visible");
assert.match(
  exactSelectorDeclarationsIn(mobileCss, ".hero .actions"),
  /display:\s*none/,
  "760px hero actions must be hidden while fixed actions are visible"
);
for (const [label, region] of [
  ["base", baseCss],
  ["900px", tabletCss],
  ["360px", narrowCss]
]) {
  assertClassDoesNotDeclareIn(
    region,
    "fixedActions",
    /display:\s*grid/,
    `fixed actions must only be displayed in the 760px block, not ${label}`
  );
}
assertClassDeclarationIn(
  mobileCss,
  "fixedActions",
  /env\(safe-area-inset-bottom\)/,
  "760px fixed actions must respect the bottom safe area"
);
const mobileShellDeclarations = exactSelectorDeclarationsIn(mobileCss, ".shell");
const mobileFixedDeclarations = exactSelectorDeclarationsIn(
  mobileCss,
  ".fixedActions"
);
const mobileFixedLinkDeclarations = exactSelectorDeclarationsIn(
  mobileCss,
  ".fixedActions a"
);
const shellBottomMatch = mobileShellDeclarations.match(
  /padding-bottom:\s*calc\(\s*var\(--shop-fixed-action-height\)\s*\+\s*var\(--shop-fixed-action-clearance\)\s*\+\s*env\(safe-area-inset-bottom\)\s*\)/
);
const fixedHeightMatch = mobileFixedDeclarations.match(
  /min-height:\s*var\(--shop-fixed-action-height\)/
);
const fixedPaddingMatch = mobileFixedDeclarations.match(
  /padding:\s*(\d+)px\s+\d+px\s+calc\(\s*(\d+)px\s*\+\s*env\(safe-area-inset-bottom\)\s*\)/
);
const fixedLinkMinHeight = lastDeclarationValue(
  mobileFixedLinkDeclarations,
  "min-height"
);
assert.ok(
  shellBottomMatch,
  "760px shell bottom space must add env(safe-area-inset-bottom)"
);
assert.ok(fixedHeightMatch, "760px fixed actions must declare their minimum body height");
assert.ok(
  fixedPaddingMatch,
  "760px fixed actions must expose normal top and bottom padding around the safe area"
);
assert.match(
  fixedLinkMinHeight ?? "",
  /^\d+px$/,
  "760px fixed-action child links must declare an effective pixel min-height"
);
assert.ok(
  /--shop-fixed-action-height:\s*\d+px/.test(basePageDeclarations) &&
    /--shop-fixed-action-clearance:\s*\d+px/.test(basePageDeclarations),
  "fixed action body height and content clearance must use shared page variables"
);
for (const [label, region] of [
  ["base", baseCss],
  ["900px", tabletCss],
  ["360px", narrowCss]
]) {
  assert.doesNotMatch(
    region,
    /env\(safe-area-inset-bottom\)/,
    `safe-area declarations must stay in the 760px block, not ${label}`
  );
}

assertClassDeclarationIn(
  narrowCss,
  "facts",
  /grid-template-columns:\s*1fr/,
  "360px facts must use one column"
);
for (const [label, region] of [
  ["base", baseCss],
  ["900px", tabletCss],
  ["760px", mobileCss]
]) {
  assertClassDoesNotDeclareIn(
    region,
    "facts",
    /grid-template-columns:\s*1fr(?:\s*!important)?\s*;/,
    `one-column facts must only be declared in the 360px block, not ${label}`
  );
}

assertClassDeclaration("fixedActions", /left:\s*0/, "fixed actions must be anchored to the left edge");
assertClassDeclaration("fixedActions", /right:\s*0/, "fixed actions must be anchored to the right edge");
assertClassDeclaration(
  "fixedActions",
  /box-sizing:\s*border-box/,
  "fixed action padding must stay inside the viewport"
);
assertClassDeclaration(
  "fixedActions",
  /max-width:\s*100%/,
  "fixed actions must not exceed the viewport"
);

assert.doesNotMatch(css, /border-radius\s*:/, "editorial design must not use rounded cards");
assert.doesNotMatch(css, /box-shadow\s*:/, "editorial design must not use shadows");
assert.doesNotMatch(css, /\b100vw\b/, "CSS must not create scrollbar-width overflow");

function moveAspectRatioToNarrow(source) {
  const declaration = "  aspect-ratio: 1;\n";
  const declarationIndex = source.indexOf(declaration);
  const firstMediaIndex = source.indexOf("@media");
  assert.ok(
    declarationIndex >= 0 && declarationIndex < firstMediaIndex,
    "aspect-ratio mutation must find the base declaration"
  );
  const withoutBaseDeclaration =
    source.slice(0, declarationIndex) +
    source.slice(declarationIndex + declaration.length);
  const narrowMarker = "@media (max-width: 360px) {";
  assert.ok(
    withoutBaseDeclaration.includes(narrowMarker),
    "aspect-ratio mutation must find the 360px block"
  );
  return withoutBaseDeclaration.replace(
    narrowMarker,
    `${narrowMarker}\n  .mainImage {\n    aspect-ratio: 1;\n  }`
  );
}

function disconnectFixedActionHeightVariable(source) {
  const declaration = "min-height: var(--shop-fixed-action-height);";
  assert.ok(
    source.includes(declaration),
    "fixed-action mutation must find the shared height variable"
  );
  return source.replace(declaration, "min-height: 140px;");
}

function overrideFocusOutline(source) {
  return `${source}\n.primaryAction:focus-visible,\n.secondaryAction:focus-visible,\n.sectionNavLink:focus-visible,\n.infoTable a:focus-visible,\n.textLink:focus-visible,\n.reviewSubmitLink:focus-visible,\n.relatedLinks a:focus-visible,\n.ownerCta > a:focus-visible {\n  outline: none;\n  outline-width: 0;\n}\n`;
}

function assertMutationsAreRejected(source) {
  const mutationCases = [
    {
      name: "aspect-ratio-only-at-360px",
      mutate: moveAspectRatioToNarrow,
      expectedFailure: "base .mainImage must be square"
    },
    {
      name: "fixed-action-height-variable-disconnected",
      mutate: disconnectFixedActionHeightVariable,
      expectedFailure: "760px fixed actions must declare their minimum body height"
    },
    {
      name: "focus-outline-overridden",
      mutate: overrideFocusOutline,
      expectedFailure: "focus outline must remain visible after cascade"
    }
  ];
  const mutationFailures = [];
  const temporaryDirectory = mkdtempSync(
    join(tmpdir(), "shop-detail-responsive-contract-")
  );

  try {
    for (const mutationCase of mutationCases) {
      const temporaryCssPath = join(
        temporaryDirectory,
        `${mutationCase.name}.css`
      );
      writeFileSync(temporaryCssPath, mutationCase.mutate(source));
      const result = spawnSync(process.execPath, [fileURLToPath(import.meta.url)], {
        cwd: process.cwd(),
        encoding: "utf8",
        env: {
          ...process.env,
          SHOP_DETAIL_CONTRACT_CSS: temporaryCssPath,
          SHOP_DETAIL_CONTRACT_MUTATION_PROBE: "1"
        }
      });
      const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;

      if (result.status === 0) {
        mutationFailures.push(`${mutationCase.name} was incorrectly accepted`);
      } else if (!output.includes(mutationCase.expectedFailure)) {
        mutationFailures.push(
          `${mutationCase.name} failed for an unexpected reason:\n${output.trim()}`
        );
      }
    }
  } finally {
    rmSync(temporaryDirectory, { force: true, recursive: true });
  }

  assert.equal(
    mutationFailures.length,
    0,
    `responsive contract mutation checks failed:\n- ${mutationFailures.join("\n- ")}`
  );
}

function assertDisconnectedHeroTitleIsRejected() {
  const result = spawnSync(process.execPath, [fileURLToPath(import.meta.url)], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      SHOP_DETAIL_HERO_TITLE_MUTATION_PROBE: "1"
    }
  });
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  assert.notEqual(
    result.status,
    0,
    "disconnected ShopDetailHero model.title was incorrectly accepted"
  );
  assert.match(
    output,
    /must render the exact model\.title value/,
    `disconnected ShopDetailHero title failed for an unexpected reason:\n${output.trim()}`
  );
}

if (!isMutationProbe && !isHeroTitleMutationProbe) {
  assertMutationsAreRejected(css);
  assertDisconnectedHeroTitleIsRejected();
}

console.log("shop detail responsive contract passed");
