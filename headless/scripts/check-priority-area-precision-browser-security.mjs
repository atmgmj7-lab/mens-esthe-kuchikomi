import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import {
  buildMinimalChildEnv,
  cleanupHarnessResources,
  copyTrackedProjectFiles,
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

const sandbox = await fs.mkdtemp(path.join(os.tmpdir(), "eskomi-t3a-harness-security-"));
try {
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
      ESKOMI_QA_SECRET_SENTINEL: "must-not-cross",
    },
  });
  assert.equal(result.code, 1, `failure injection must exit 1\n${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /injected failure after server/iu);
  assert.deepEqual(await fs.readdir(integrationParent), [], "failure injection must leave no temporary root");
  assert.equal(await portOpen(3113), false, "failure injection must leave no server process");
} finally {
  await fs.rm(sandbox, { recursive: true, force: true });
}

console.log("priority area browser harness security checks passed");
