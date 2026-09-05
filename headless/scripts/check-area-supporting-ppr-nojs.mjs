import { spawn } from "node:child_process";
import net from "node:net";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixtures = [
  {
    slug: "shinosaka",
    label: "新大阪",
    supportingTokens: ["公開58店舗", "30件", "51.7%", "編集部の横断確認データ", "192名", "22店舗"],
  },
  {
    slug: "sakai",
    label: "堺東",
    supportingTokens: ["公開25店舗", "11件", "44%", "編集部の横断確認データ", "63名", "6店舗"],
  },
];

function normalizeText(value) {
  return value.replace(/\s+/gu, " ").trim();
}

function htmlText(value) {
  return normalizeText(value.replace(/<!--[\s\S]*?-->/gu, "").replace(/<[^>]+>/gu, ""));
}

function availablePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : null;
      server.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

function startProductionServer(port) {
  const nextBin = path.join(projectRoot, "node_modules", "next", "dist", "bin", "next");
  const child = spawn(process.execPath, [nextBin, "start", "-H", "127.0.0.1", "-p", String(port)], {
    cwd: projectRoot,
    env: { ...process.env, NODE_ENV: "production" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  const append = (chunk) => {
    output = `${output}${chunk}`.slice(-8_000);
  };
  child.stdout.on("data", append);
  child.stderr.on("data", append);

  const ready = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Next production server did not become ready:\n${output}`)), 20_000);
    const inspect = (chunk) => {
      if (!/Ready in|Local:/u.test(output)) return;
      clearTimeout(timeout);
      child.stdout.off("data", inspect);
      resolve();
    };
    child.stdout.on("data", inspect);
    child.once("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`Next production server exited before ready (${code}):\n${output}`));
    });
  });

  return { child, ready, output: () => output };
}

async function stopProductionServer(child) {
  if (child.exitCode !== null) return;
  const exited = new Promise((resolve) => child.once("exit", resolve));
  child.kill("SIGTERM");
  await Promise.race([
    exited,
    new Promise((resolve) => setTimeout(resolve, 5_000)),
  ]);
  if (child.exitCode === null) child.kill("SIGKILL");
}

function rawDisclosureEvidence(html) {
  const marker = 'data-area-supporting-disclosure="true"';
  const markerIndex = html.indexOf(marker);
  const openIndex = html.lastIndexOf("<details", markerIndex);
  const closeIndex = html.indexOf("</details>", markerIndex);
  const disclosureHtml = openIndex >= 0 && closeIndex > openIndex
    ? html.slice(openIndex, closeIndex + "</details>".length)
    : "";
  const outsideHtml = disclosureHtml
    ? `${html.slice(0, openIndex)}${html.slice(closeIndex + "</details>".length)}`
    : html;
  const hiddenSegments = [...outsideHtml.matchAll(/<div hidden(?:="")? id="S:[^"]+">([\s\S]*?)(?=<div hidden(?:="")? id="S:|$)/gu)]
    .map((match) => match[1]);
  return { disclosureHtml, disclosureText: htmlText(disclosureHtml), hiddenSegments };
}

const failures = [];
const evidence = [];
let assertions = 0;
function check(condition, label, details = {}) {
  assertions += 1;
  if (!condition) failures.push({ label, details });
}

const port = await availablePort();
const server = startProductionServer(port);
await server.ready;
const baseUrl = `http://127.0.0.1:${port}`;
const browser = await chromium.launch({ headless: true });

try {
  const noJsResults = new Map();
  for (const fixture of fixtures) {
    const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const response = await page.goto(`${baseUrl}/area/${fixture.slug}/?ppr_nojs_contract=1`, {
      waitUntil: "load",
      timeout: 60_000,
    });
    const rawHtml = (await response.body()).toString("utf8");
    const { disclosureHtml, disclosureText, hiddenSegments } = rawDisclosureEvidence(rawHtml);
    const disclosure = page.locator('details[data-area-supporting-disclosure="true"]');
    const summary = disclosure.locator("summary");
    const supportingContent = disclosure.locator('[data-area-supporting-content="true"]');
    const initialOpen = await disclosure.count() === 1
      ? await disclosure.evaluate((node) => node.open)
      : null;
    const initiallyVisible = await summary.count() === 1 && await summary.isVisible();
    let nativeOpened = false;
    if (initiallyVisible) {
      await summary.click();
      nativeOpened = await disclosure.evaluate((node) => node.open);
    }
    const domText = await supportingContent.count() === 1
      ? normalizeText(await supportingContent.textContent() ?? "")
      : "";
    const coverageCount = await disclosure.locator('[data-area-depth="coverage"]').count();
    const portalCount = await disclosure.locator('[data-area-depth="portal-therapist"]').count();
    const internalLinkCount = await disclosure.locator('a[href^="#"], a[href^="/"]').count();
    const contentVisible = nativeOpened && await supportingContent.isVisible();
    const coverageVisible = nativeOpened && await disclosure.locator('[data-area-depth="coverage"]').isVisible();
    const portalVisible = nativeOpened && await disclosure.locator('[data-area-depth="portal-therapist"]').isVisible();
    let internalLinkClickable = false;
    if (nativeOpened && internalLinkCount > 0) {
      const firstInternalLink = disclosure.locator('a[href^="#"], a[href^="/"]').first();
      await firstInternalLink.click();
      internalLinkClickable = new URL(page.url()).hash.length > 0;
    }

    check(response.status() === 200, `${fixture.slug} no-JS HTTP 200`, { status: response.status() });
    check(await disclosure.count() === 1, `${fixture.slug} no-JS disclosure exists`);
    check(await summary.count() === 1, `${fixture.slug} no-JS summary exists`);
    check(initialOpen === false, `${fixture.slug} no-JS disclosure is closed initially`, { initialOpen });
    check(initiallyVisible, `${fixture.slug} no-JS summary is visible without deferred insertion`);
    check(nativeOpened, `${fixture.slug} no-JS native click opens disclosure`);
    check(contentVisible, `${fixture.slug} no-JS supporting content is visible after opening`);
    check(coverageCount === 1, `${fixture.slug} no-JS coverage is a disclosure child`, { coverageCount });
    check(portalCount === 1, `${fixture.slug} no-JS cross-source data is a disclosure child`, { portalCount });
    check(coverageVisible, `${fixture.slug} no-JS coverage is visible after opening`);
    check(portalVisible, `${fixture.slug} no-JS cross-source data is visible after opening`);
    check(internalLinkCount > 0, `${fixture.slug} no-JS disclosure retains internal links`, { internalLinkCount });
    check(internalLinkClickable, `${fixture.slug} no-JS internal link is natively clickable`);
    check(disclosureHtml.length > 0, `${fixture.slug} raw HTML contains a complete details element`);
    for (const token of fixture.supportingTokens) {
      check(disclosureText.includes(token), `${fixture.slug} raw details retains ${token}`);
    }
    check(
      !hiddenSegments.some((segment) => segment.includes('data-area-depth="coverage"')),
      `${fixture.slug} coverage does not depend on an outside hidden PPR segment`,
    );
    check(
      !hiddenSegments.some((segment) => segment.includes('id="area-decision-guide"')),
      `${fixture.slug} decision guide does not depend on an outside hidden PPR segment`,
    );
    check(
      !hiddenSegments.some((segment) => segment.includes('data-area-depth="portal-therapist"')),
      `${fixture.slug} cross-source data does not depend on an outside hidden PPR segment`,
    );

    noJsResults.set(fixture.slug, { domText, context });
    evidence.push({
      slug: fixture.slug,
      rawLength: rawHtml.length,
      rawDisclosureLength: disclosureHtml.length,
      initiallyVisible,
      nativeOpened,
      contentVisible,
      coverageCount,
      portalCount,
      internalLinkCount,
      internalLinkClickable,
      noJsSupportingTextLength: domText.length,
    });
  }

  for (const fixture of fixtures) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const consoleErrors = [];
    const pageErrors = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("pageerror", (error) => pageErrors.push(String(error)));
    const response = await page.goto(`${baseUrl}/area/${fixture.slug}/`, { waitUntil: "networkidle", timeout: 60_000 });
    const expectedText = normalizeText(
      await page.locator('[data-area-supporting-content="true"]').textContent() ?? "",
    );
    const noJsResult = noJsResults.get(fixture.slug);
    check(response?.status() === 200, `${fixture.slug} JavaScript reference HTTP 200`);
    check(consoleErrors.length === 0, `${fixture.slug} JavaScript console errors=0`, { count: consoleErrors.length });
    check(pageErrors.length === 0, `${fixture.slug} JavaScript page errors=0`, { count: pageErrors.length });
    check(expectedText.length > 0, `${fixture.slug} JavaScript reference supporting text exists`);
    check(
      noJsResult?.domText === expectedText,
      `${fixture.slug} no-JS supporting text completeness is 100%`,
      { noJsLength: noJsResult?.domText.length ?? 0, expectedLength: expectedText.length },
    );
    const item = evidence.find((entry) => entry.slug === fixture.slug);
    if (item) item.expectedSupportingTextLength = expectedText.length;
    await page.close();
  }

  for (const { context } of noJsResults.values()) await context.close();
} catch (error) {
  failures.push({ label: "PPR/no-JS contract completed", details: { message: String(error?.stack ?? error) } });
} finally {
  await browser.close();
  await stopProductionServer(server.child);
}

console.log(JSON.stringify({ assertions, failures, evidence }, null, 2));
if (failures.length > 0) process.exitCode = 1;
