import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

const exporter = await import("../../scripts/analytics/export-current.mjs");
const root = await mkdtemp(join(tmpdir(), "eskomi-analytics-export-"));

test("export parser accepts only explicit period and output arguments before collection", () => {
  assert.deepEqual(exporter.parseExportArguments(["--period", "7", "--output", "/tmp/snapshot.json"]), { days: 7, output: "/tmp/snapshot.json" });
  for (const args of [[], ["--period", "14", "--output", "x"], ["--period", "7", "--period", "7", "--output", "x"], ["--period", "7", "--output", "x", "--extra"]]) {
    assert.throws(() => exporter.parseExportArguments(args), /Invalid analytics export arguments/);
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
  assert.deepEqual((await (await import("node:fs/promises")).readdir(root)).filter((name) => name !== "snapshot.json"), []);
  await rm(root, { recursive: true, force: true });
});
