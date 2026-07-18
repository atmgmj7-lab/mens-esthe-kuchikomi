import assert from "node:assert/strict";
import { chromium } from "@playwright/test";

const baseUrl = process.env.DASHBOARD_QA_BASE_URL;
assert.ok(baseUrl, "DASHBOARD_QA_BASE_URL が必要です");

const browser = await chromium.launch({ headless: true });
try {
  for (const reducedMotion of ["no-preference", "reduce"]) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      reducedMotion,
      httpCredentials: {
        username: process.env.DASHBOARD_QA_USER || "qa",
        password: process.env.DASHBOARD_QA_PASSWORD || "qa-dashboard-test",
      },
    });
    const page = await context.newPage();
    await page.goto(`${baseUrl.replace(/\/$/, "")}/dashboard/`, { waitUntil: "networkidle" });

    assert.notEqual(
      await page.evaluate(() => document.activeElement?.id),
      "dashboard-main",
      "初回mountでmainへfocusを移してはいけません"
    );

    const menu = page.locator("[data-dashboard-menu-toggle]");
    await menu.click();
    const navigation = page.locator("#dashboard-navigation[data-open='true']");
    await navigation.waitFor();
    assert.equal(
      await navigation.evaluate((element) => getComputedStyle(element).visibility),
      "visible",
      `${reducedMotion}: open直後からnavigationをfocus可能にする必要があります`
    );
    await page.waitForFunction(
      () => document.activeElement?.getAttribute("href") === "/dashboard/"
    );

    await page.locator("#dashboard-main").focus();
    await page.keyboard.press("Escape");
    await page.waitForFunction(
      () => document.querySelector("[data-dashboard-menu-toggle]")?.getAttribute("aria-expanded") === "false"
    );
    assert.equal(
      await page.evaluate(() => document.activeElement?.hasAttribute("data-dashboard-menu-toggle")),
      true,
      "document Escape後はtoggleへfocusを戻す必要があります"
    );

    await menu.click();
    await page.locator("#dashboard-navigation a[href='/dashboard/analytics/']").click();
    await page.waitForURL("**/dashboard/analytics/");
    await page.waitForFunction(() => document.activeElement?.id === "dashboard-main");
    assert.equal(await menu.getAttribute("aria-expanded"), "false");

    await page.setViewportSize({ width: 320, height: 568 });
    const geometry = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    assert.ok(geometry.scrollWidth <= geometry.clientWidth + 1, JSON.stringify(geometry));
    await context.close();
  }

  console.log("Dashboard shell browser checks passed");
} finally {
  await browser.close();
}
