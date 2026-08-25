import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, open, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { registerServerOnly } from "./register-server-only.mjs";

registerServerOnly();

const exporter = await import("../../scripts/analytics/export-current.mjs");
const { createAnalyticsCurrentHandler } = await import("../../app/api/dashboard/analytics/current/route.ts");
const root = await mkdtemp(join(tmpdir(), "eskomi-analytics-export-"));

test("export parser accepts only explicit period and output arguments before collection", () => {
  assert.deepEqual(exporter.parseExportArguments(["--period", "7", "--output", "/tmp/snapshot.json"]), { days: 7, output: "/tmp/snapshot.json" });
  for (const args of [[], ["--period", "14", "--output", "x"], ["--period", "7", "--period", "7", "--output", "x"], ["--period", "7", "--output", "x", "--extra"]]) {
    assert.throws(() => exporter.parseExportArguments(args), /Invalid analytics export arguments/);
  }
});

test("documented CLI loads the production server-only collector and writes aggregate JSON", async () => {
  const directory = await mkdtemp(join(tmpdir(), "eskomi-analytics-cli-"));
  const output = join(directory, "snapshot.json");
  const environment = {
    ...process.env,
    WP_API_BASE_URL: "https://wordpress.test/wp-json",
    NEXT_PUBLIC_WP_BASE_URL: "https://wordpress.test",
  };
  delete environment.GOOGLE_APPLICATION_CREDENTIALS;
  delete environment.GA4_PROPERTY_ID;

  try {
    execFileSync(
      process.execPath,
      [
        "--import",
        fileURLToPath(new URL("./fixtures/export-cli-bootstrap.mjs", import.meta.url)),
        fileURLToPath(new URL("../../scripts/analytics/export-current.mjs", import.meta.url)),
        "--period",
        "7",
        "--output",
        output,
      ],
      { env: environment, stdio: "pipe" },
    );
    const serialized = await readFile(output, "utf8");
    const snapshot = JSON.parse(serialized);
    assert.equal(snapshot.schemaVersion, "1.0.0");
    assert.equal(snapshot.period.days, 7);
    assert.deepEqual(Object.keys(snapshot.sources), ["ga4", "gsc", "web", "content"]);
    assert.equal(((await stat(output)).mode & 0o777), 0o600);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("export writes exact collector snapshot atomically and preserves destination on collection failure", async () => {
  const output = join(root, "snapshot.json");
  const expected = { schemaVersion: "1.0.0", timezone: "Asia/Tokyo", warnings: [] };
  await exporter.writeAnalyticsSnapshot({ days: 7, output, collect: async () => expected });
  assert.equal(await readFile(output, "utf8"), `${JSON.stringify(expected)}\n`);
  await writeFile(output, "existing\n", "utf8");
  await assert.rejects(() => exporter.writeAnalyticsSnapshot({ days: 7, output, collect: async () => { throw new Error("secret source failure"); } }));
  assert.equal(await readFile(output, "utf8"), "existing\n");
  assert.deepEqual((await readdir(root)).filter((name) => name !== "snapshot.json"), []);
  await rm(root, { recursive: true, force: true });
});

test("standalone export formally performs one fresh collection per invocation", async () => {
  const directory = await mkdtemp(join(tmpdir(), "eskomi-analytics-fresh-export-"));
  let collections = 0;
  const collect = async ({ days }) => ({ schemaVersion: "1.0.0", days, collection: ++collections });
  try {
    const firstOutput = join(directory, "first.json");
    const secondOutput = join(directory, "second.json");
    await exporter.writeAnalyticsSnapshot({ days: 7, output: firstOutput, collect });
    await exporter.writeAnalyticsSnapshot({ days: 7, output: secondOutput, collect });
    assert.equal(collections, 2);
    assert.equal(JSON.parse(await readFile(firstOutput, "utf8")).collection, 1);
    assert.equal(JSON.parse(await readFile(secondOutput, "utf8")).collection, 2);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("export uses unique temporary directories for deterministic same-process concurrency", async () => {
  const directory = await mkdtemp(join(tmpdir(), "eskomi-analytics-concurrent-"));
  const output = join(directory, "snapshot.json");
  const values = [{ snapshot: 1 }, { snapshot: 2 }];
  const originalNow = Date.now;
  Date.now = () => 1;
  try { await Promise.all(values.map((value) => exporter.writeAnalyticsSnapshot({ days: 7, output, collect: async () => value }))); }
  finally { Date.now = originalNow; }
  const serialized = (await readFile(output, "utf8")).trim();
  assert.equal(values.some((value) => JSON.stringify(value) === serialized), true);
  assert.deepEqual(await readdir(directory), ["snapshot.json"]);
  await rm(directory, { recursive: true, force: true });
});

test("export cleans a created temporary directory after write or rename failure without replacing destination", async () => {
  for (const failure of ["write", "rename"]) {
    const directory = await mkdtemp(join(tmpdir(), `eskomi-analytics-${failure}-`));
    const output = join(directory, "snapshot.json");
    await writeFile(output, "original\n", "utf8");
    const fs = {
      mkdtemp,
      open: async (path, flags, mode) => failure === "write"
        ? { writeFile: async () => { throw new Error("synthetic write failure"); }, close: async () => {} }
        : open(path, flags, mode),
      rename: async (...args) => failure === "rename" ? Promise.reject(new Error("synthetic rename failure")) : rename(...args),
      rm,
    };
    await assert.rejects(() => exporter.writeAnalyticsSnapshot({ days: 7, output, collect: async () => ({ snapshot: true }), fs }));
    assert.equal(await readFile(output, "utf8"), "original\n");
    assert.deepEqual(await readdir(directory), ["snapshot.json"]);
    await rm(directory, { recursive: true, force: true });
  }
});

test("API JSON and export JSON have exact semantic parity when supplied the same snapshot model", async () => {
  const directory = await mkdtemp(join(tmpdir(), "eskomi-analytics-parity-"));
  const output = join(directory, "snapshot.json");
  const model = { schemaVersion: "1.0.0", timezone: "Asia/Tokyo", sources: { ga4: { state: "partial" } }, warnings: [] };
  const handler = createAnalyticsCurrentHandler({ authorize: () => ({ ok: true, status: 200, reason: "authorized" }), collect: async () => model });
  const response = await handler(new Request("https://test.invalid/api/dashboard/analytics/current?period=7"));
  await exporter.writeAnalyticsSnapshot({ days: 7, output, collect: async () => model });
  assert.deepEqual(await response.json(), JSON.parse(await readFile(output, "utf8")));
  await rm(directory, { recursive: true, force: true });
});
