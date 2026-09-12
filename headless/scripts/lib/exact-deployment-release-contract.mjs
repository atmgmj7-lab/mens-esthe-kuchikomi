import { rawSupportingDisclosureEvidence } from "./area-supporting-ppr-contract.mjs";

export const CRITICAL_AREA_RELEASE_FIXTURES = [
  {
    slug: "shinosaka",
    title: "新大阪のメンズエステおすすめ一覧｜西中島・東三国の料金比較 | Eskomi",
    h1: "新大阪のメンズエステおすすめ一覧｜西中島・東三国の料金比較",
    canonical: "https://mens-esthe-kuchikomi.com/area/shinosaka/",
    shopCount: 58,
    supportingTokens: ["公開58店舗", "30件", "51.7%", "編集部の横断確認データ", "192名", "22店舗"],
  },
  {
    slug: "sakai",
    title: "堺東のメンズエステおすすめ一覧｜堺市の料金・深夜・口コミ比較 | Eskomi",
    h1: "堺東のメンズエステおすすめ一覧｜堺市の料金・深夜・口コミ比較",
    canonical: "https://mens-esthe-kuchikomi.com/area/sakai/",
    shopCount: 25,
    supportingTokens: ["公開25店舗", "11件", "44%", "編集部の横断確認データ", "63名", "6店舗"],
  },
];

const PRODUCTION_DOMAINS = new Set([
  "mens-esthe-kuchikomi.com",
  "www.mens-esthe-kuchikomi.com",
]);

function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

function normalizedDeploymentHost(value) {
  if (typeof value !== "string" || value.trim() === "") return "";
  try {
    return new URL(value.includes("://") ? value : `https://${value}`).host.toLowerCase();
  } catch {
    return "";
  }
}

function deploymentAliasHost(value) {
  if (typeof value === "string") return normalizedDeploymentHost(value);
  if (value && typeof value === "object") {
    return normalizedDeploymentHost(value.alias ?? value.domain ?? value.url ?? "");
  }
  return "";
}

function decodeHtmlText(value) {
  return value
    .replace(/&amp;/gu, "&")
    .replace(/&quot;/gu, '"')
    .replace(/&#39;|&apos;/gu, "'")
    .replace(/&lt;/gu, "<")
    .replace(/&gt;/gu, ">")
    .replace(/\s+/gu, " ")
    .trim();
}

function tagText(html, tagName) {
  const match = html.match(new RegExp(`<${tagName}\\b[^>]*>([^]*?)<\\/${tagName}>`, "iu"));
  return match ? decodeHtmlText(match[1].replace(/<!--[^]*?-->/gu, "").replace(/<[^>]+>/gu, "")) : "";
}

function tagAttribute(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, "iu"));
  return match?.[2] ?? "";
}

function canonicalHref(html) {
  for (const match of html.matchAll(/<link\b[^>]*>/giu)) {
    const rel = tagAttribute(match[0], "rel").toLowerCase().split(/\s+/u);
    if (rel.includes("canonical")) return tagAttribute(match[0], "href");
  }
  return "";
}

function htmlRobots(html) {
  for (const match of html.matchAll(/<meta\b[^>]*>/giu)) {
    if (tagAttribute(match[0], "name").toLowerCase() === "robots") {
      return tagAttribute(match[0], "content");
    }
  }
  return "";
}

function jsonLdObjects(html) {
  return [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([^]*?)<\/script>/giu)]
    .map((match) => {
      try {
        return JSON.parse(match[1]);
      } catch (error) {
        throw new Error(`invalid JSON-LD: ${error instanceof Error ? error.message : String(error)}`);
      }
    });
}

function collectTypes(value, types = []) {
  if (!value || typeof value !== "object") return types;
  if (typeof value["@type"] === "string") types.push(value["@type"]);
  for (const nested of Object.values(value)) collectTypes(nested, types);
  return types;
}

function normalizedHeaders(headers) {
  return Object.fromEntries(Object.entries(headers ?? {}).map(([key, value]) => [
    key.toLowerCase(),
    Array.isArray(value) ? value.join(", ") : String(value ?? ""),
  ]));
}

function validateArea(fixture, response) {
  requireCondition(response && typeof response === "object", `${fixture.slug} response evidence is required`);
  requireCondition(response.status === 200, `${fixture.slug} HTTP status must be 200`);
  const html = typeof response.html === "string" ? response.html : "";
  requireCondition(html.length > 0, `${fixture.slug} HTML is required`);
  requireCondition(
    !/<meta\b[^>]*name=["']next-error["'][^>]*content=["']not-found["']/iu.test(html)
      && !/<title[^>]*>\s*404(?:\s*:|\s*<)/iu.test(html)
      && !/This page could not be found/iu.test(html),
    `${fixture.slug} Next notFound fallback detected`,
  );

  const headers = normalizedHeaders(response.headers);
  const xRobotsTag = headers["x-robots-tag"] ?? "";
  if (/\bnoindex\b/iu.test(xRobotsTag)) {
    requireCondition(
      /^vercel$/iu.test(headers.server ?? ""),
      `${fixture.slug} application X-Robots-Tag must not contain noindex`,
    );
  }

  const robots = htmlRobots(html);
  requireCondition(!/\bnoindex\b/iu.test(robots), `${fixture.slug} HTML robots must not contain noindex`);
  requireCondition(tagText(html, "title") === fixture.title, `${fixture.slug} title must match the production contract`);
  requireCondition(tagText(html, "h1") === fixture.h1, `${fixture.slug} H1 must match the production contract`);
  requireCondition(canonicalHref(html) === fixture.canonical, `${fixture.slug} canonical must match the production contract`);

  const shopCards = (html.match(/data-area-shop-card=["']true["']/giu) ?? []).length;
  requireCondition(shopCards === fixture.shopCount, `${fixture.slug} shop card count must be ${fixture.shopCount}`);

  const schemas = jsonLdObjects(html);
  const breadcrumbLists = schemas.filter((schema) => schema?.["@type"] === "BreadcrumbList");
  const itemLists = schemas.filter((schema) => schema?.["@type"] === "ItemList");
  const faqPages = schemas.filter((schema) => schema?.["@type"] === "FAQPage");
  requireCondition(breadcrumbLists.length === 1, `${fixture.slug} must contain one BreadcrumbList`);
  requireCondition(itemLists.length === 1, `${fixture.slug} must contain one ItemList`);
  requireCondition(faqPages.length === 1, `${fixture.slug} must contain one FAQPage`);
  requireCondition(itemLists[0].numberOfItems === fixture.shopCount, `${fixture.slug} ItemList numberOfItems must be ${fixture.shopCount}`);
  requireCondition(itemLists[0].itemListElement?.length === fixture.shopCount, `${fixture.slug} ItemList elements must be ${fixture.shopCount}`);
  const schemaTypes = schemas.flatMap((schema) => collectTypes(schema));
  for (const forbiddenType of ["Review", "Rating", "AggregateRating"]) {
    requireCondition(!schemaTypes.includes(forbiddenType), `${fixture.slug} must not contain ${forbiddenType} schema`);
  }

  const {
    disclosureHtml,
    disclosureText,
    hiddenSegments,
    disclosureInsideHiddenSegment,
  } = rawSupportingDisclosureEvidence(html);
  requireCondition(disclosureHtml.length > 0, `${fixture.slug} raw HTML must contain a complete details element`);
  requireCondition(!disclosureInsideHiddenSegment, `${fixture.slug} details must not be inside a hidden PPR segment`);
  requireCondition(/<summary\b[^>]*>/iu.test(disclosureHtml), `${fixture.slug} details must contain summary`);
  requireCondition(
    !/<details\b[^>]*\sopen(?:\s|=|>)/iu.test(disclosureHtml),
    `${fixture.slug} details must be closed by default`,
  );
  requireCondition(/data-area-supporting-content=["']true["']/iu.test(disclosureHtml), `${fixture.slug} supporting content must be inside details`);
  requireCondition(/data-area-depth=["']coverage["']/iu.test(disclosureHtml), `${fixture.slug} coverage must be inside details`);
  requireCondition(/data-area-depth=["']portal-therapist["']/iu.test(disclosureHtml), `${fixture.slug} cross-source content must be inside details`);
  requireCondition(/<a\b[^>]*href=["'](?:#|\/)/iu.test(disclosureHtml), `${fixture.slug} internal links must be inside details`);
  for (const token of fixture.supportingTokens) {
    requireCondition(disclosureText.includes(token), `${fixture.slug} details must retain ${token}`);
  }
  for (const [label, marker] of [
    ["coverage", 'data-area-depth="coverage"'],
    ["decision guide", 'id="area-decision-guide"'],
    ["cross-source content", 'data-area-depth="portal-therapist"'],
  ]) {
    requireCondition(
      !hiddenSegments.some((segment) => segment.includes(marker)),
      `${fixture.slug} ${label} must not depend on an outside hidden PPR segment`,
    );
  }

  return {
    slug: fixture.slug,
    status: response.status,
    shopCards,
    itemListItems: itemLists[0].itemListElement.length,
    platformHeaderNoindexAllowed: /\bnoindex\b/iu.test(xRobotsTag),
    htmlNoindex: false,
    supportingCompleteness: "100%",
  };
}

export function validateExactDeploymentRelease(evidence) {
  const exactDeploymentUrl = evidence?.exactDeploymentUrl ?? "";
  requireCondition(exactDeploymentUrl !== "", "exact deployment URL is required");
  let exactUrl;
  try {
    exactUrl = new URL(exactDeploymentUrl);
  } catch {
    throw new Error("exact deployment URL must be valid HTTPS");
  }
  requireCondition(exactUrl.protocol === "https:", "exact deployment URL must be valid HTTPS");
  requireCondition(exactUrl.pathname === "/" && exactUrl.search === "" && exactUrl.hash === "", "exact deployment URL must not contain a path, query, or fragment");
  requireCondition(exactUrl.hostname.endsWith(".vercel.app"), "exact deployment URL must use a Vercel deployment hostname");

  const deploymentId = evidence?.deploymentId ?? "";
  requireCondition(deploymentId !== "", "deployment ID is required");
  requireCondition(evidence?.inspect?.id === deploymentId, "deployment ID mismatch between deploy and inspect");
  requireCondition(evidence?.deployment?.id === deploymentId, "deployment ID mismatch between deploy and API");
  const exactHost = exactUrl.host.toLowerCase();
  requireCondition(normalizedDeploymentHost(evidence?.inspect?.url) === exactHost, "deployment URL mismatch between deploy and inspect");
  requireCondition(normalizedDeploymentHost(evidence?.deployment?.url) === exactHost, "deployment URL mismatch between deploy and API");
  requireCondition(evidence?.deployment?.target === "production", "deployment target must be production");
  requireCondition(evidence?.deployment?.readyState === "READY", "deployment state must be READY");

  const expectedSha = evidence?.expectedSha ?? "";
  requireCondition(/^[0-9a-f]{40}$/u.test(expectedSha), "expected Git SHA must be a full 40-character SHA");
  const actualSha = evidence?.deployment?.meta?.eskomiGitSha ?? "";
  requireCondition(actualSha === expectedSha, "deployment SHA mismatch");

  const aliases = evidence?.deployment?.aliases ?? [];
  requireCondition(Array.isArray(aliases), "deployment aliases must be an array");
  requireCondition(
    !aliases.some((alias) => PRODUCTION_DOMAINS.has(deploymentAliasHost(alias))),
    "deployment must not be promoted to the production domain",
  );

  const areaResults = CRITICAL_AREA_RELEASE_FIXTURES.map((fixture) =>
    validateArea(fixture, evidence?.areas?.[fixture.slug]));

  return {
    status: "PASS",
    deploymentId,
    deploymentUrl: exactUrl.origin,
    expectedSha,
    verifiedSha: actualSha,
    exactQa: "PASS",
    promotionStatus: "NOT_PROMOTED",
    areas: areaResults,
  };
}
