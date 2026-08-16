import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import {
  BROWSER_REPORT_OWNER_MARKER,
  buildMinimalChildEnv,
  cleanupHarnessResources,
  copyTrackedProjectFiles,
  resolveBrowserReportDirectory,
} from "./lib/priority-area-browser-harness.mjs";

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { ...options, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("error", reject);
    child.once("exit", (code) => resolve({ code, stdout, stderr }));
  });
}

function portOpen(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: "127.0.0.1", port });
    socket.once("connect", () => { socket.destroy(); resolve(true); });
    socket.once("error", () => resolve(false));
    socket.setTimeout(500, () => { socket.destroy(); resolve(false); });
  });
}

async function snapshotReportDirectory(root) {
  const files = [];
  async function visit(directory, prefix = "") {
    let entries;
    try {
      entries = await fs.readdir(directory, { withFileTypes: true });
    } catch (error) {
      if (error?.code === "ENOENT" && prefix === "") return false;
      throw error;
    }
    for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
      const relativePath = path.join(prefix, entry.name);
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(absolutePath, relativePath);
      } else {
        const stat = await fs.lstat(absolutePath);
        const content = await fs.readFile(absolutePath);
        files.push({
          path: relativePath,
          size: stat.size,
          mtimeMs: stat.mtimeMs,
          sha256: createHash("sha256").update(content).digest("hex"),
        });
      }
    }
    return true;
  }
  const exists = await visit(root);
  return exists === false ? null : files;
}

const sandbox = await fs.mkdtemp(path.join(os.tmpdir(), "eskomi-t3a-harness-security-"));
try {
  const projectRoot = process.cwd();
  const canonicalReport = path.join(projectRoot, "reports", "ux-prod-t3a-primary-aware");
  const canonicalBefore = await snapshotReportDirectory(canonicalReport);
  assert.equal(
    await resolveBrowserReportDirectory({ projectRoot }),
    canonicalReport,
    "the default report must remain the canonical repository report",
  );

  const reportOwner = await fs.mkdtemp(path.join(sandbox, "eskomi-t3a-browser-report-"));
  await fs.writeFile(path.join(reportOwner, BROWSER_REPORT_OWNER_MARKER), "owned by priority area browser QA\n");
  assert.equal(
    await resolveBrowserReportDirectory({ projectRoot, override: reportOwner }),
    path.join(reportOwner, "report"),
    "a marked temporary owner must resolve to its dedicated report child",
  );
  await assert.rejects(
    resolveBrowserReportDirectory({ projectRoot, override: "/" }),
    /temporary|owner|report/iu,
  );
  await assert.rejects(
    resolveBrowserReportDirectory({ projectRoot, override: projectRoot }),
    /temporary|owner|report/iu,
  );
  const unmarkedOwner = await fs.mkdtemp(path.join(sandbox, "eskomi-t3a-browser-report-"));
  await assert.rejects(
    resolveBrowserReportDirectory({ projectRoot, override: unmarkedOwner }),
    /marker/iu,
  );
  const linkedOwner = path.join(sandbox, "eskomi-t3a-browser-report-linked");
  await fs.symlink(reportOwner, linkedOwner);
  await assert.rejects(
    resolveBrowserReportDirectory({ projectRoot, override: linkedOwner }),
    /symbolic link/iu,
  );

  const source = path.join(sandbox, "source");
  const destination = path.join(sandbox, "destination");
  await fs.mkdir(path.join(source, "app"), { recursive: true });
  await fs.writeFile(path.join(source, "app", "page.tsx"), "export default function Page() { return null; }\n");
  await fs.writeFile(path.join(source, ".env.production"), "SHOULD_NOT_COPY=1\n");
  await copyTrackedProjectFiles(source, destination, ["app/page.tsx"]);
  assert.equal(await fs.readFile(path.join(destination, "app", "page.tsx"), "utf8"), "export default function Page() { return null; }\n");
  await assert.rejects(fs.access(path.join(destination, ".env.production")));

  await fs.symlink("page.tsx", path.join(source, "app", "linked-page.tsx"));
  await assert.rejects(
    copyTrackedProjectFiles(source, path.join(sandbox, "symlink-destination"), ["app/linked-page.tsx"]),
    /symbolic link/iu,
  );

  const minimalEnv = buildMinimalChildEnv({
    ...process.env,
    PATH: process.env.PATH,
    TMPDIR: sandbox,
    LANG: "ja_JP.UTF-8",
    ESKOMI_QA_SECRET_SENTINEL: "must-not-cross",
    SUPABASE_SERVICE_ROLE_KEY: "must-not-cross",
  });
  assert.equal(minimalEnv.ESKOMI_QA_SECRET_SENTINEL, undefined);
  assert.equal(minimalEnv.SUPABASE_SERVICE_ROLE_KEY, undefined);
  assert.equal(minimalEnv.NEXT_TELEMETRY_DISABLED, "1");
  assert.ok(minimalEnv.PATH);

  const cleanupRoot = path.join(sandbox, "cleanup-root");
  await fs.mkdir(cleanupRoot);
  const sleeper = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], {
    detached: true,
    stdio: "ignore",
    env: minimalEnv,
  });
  await cleanupHarnessResources({ children: [sleeper], roots: [cleanupRoot] });
  await assert.rejects(fs.access(cleanupRoot));
  assert.throws(
    () => process.kill(sleeper.pid, 0),
    (error) => error?.code === "ESRCH",
    "cleanup must terminate the child process",
  );

  const integrationParent = path.join(sandbox, "integration-parent");
  await fs.mkdir(integrationParent);
  const result = await run(process.execPath, ["scripts/check-priority-area-precision-browser.mjs"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      BROWSER_QA_FIXTURE_ONLY: "1",
      BROWSER_QA_HEADLESS: "1",
      BROWSER_QA_INJECT_FAILURE: "after-server",
      BROWSER_QA_TEMP_PARENT: integrationParent,
      BROWSER_QA_REPORT_OWNER: reportOwner,
      ESKOMI_QA_SECRET_SENTINEL: "must-not-cross",
    },
  });
  assert.equal(result.code, 1, `failure injection must exit 1\n${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /injected failure after server/iu);
  assert.deepEqual(await fs.readdir(integrationParent), [], "failure injection must leave no temporary root");
  assert.equal(await portOpen(3113), false, "failure injection must leave no server process");
  assert.deepEqual(
    await snapshotReportDirectory(canonicalReport),
    canonicalBefore,
    "failure injection must not change the canonical report evidence",
  );
} finally {
  await fs.rm(sandbox, { recursive: true, force: true });
}

console.log("priority area browser harness security checks passed");
