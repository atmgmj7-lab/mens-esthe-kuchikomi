import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const CHILD_ENV_KEYS = ["PATH", "TMPDIR", "TMP", "TEMP", "LANG", "LC_ALL", "CI", "TERM"];
const BROWSER_REPORT_OWNER_PREFIX = "eskomi-t3a-browser-report-";
const BROWSER_REPORT_OWNER_MARKER_CONTENT = "owned by priority area browser QA\n";
export const BROWSER_REPORT_OWNER_MARKER = ".eskomi-t3a-browser-report-owner";

function isPathInside(root, candidate) {
  const relative = path.relative(root, candidate);
  return Boolean(relative) && !relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative);
}

async function assertNoSymbolicLinkSegments(root, candidate) {
  const relative = path.relative(root, candidate);
  let current = root;
  for (const segment of relative.split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    const stat = await fs.lstat(current);
    if (stat.isSymbolicLink()) throw new Error(`browser report owner symbolic link is not allowed: ${candidate}`);
  }
}

export async function resolveBrowserReportDirectory({ projectRoot, override } = {}) {
  const canonicalReport = path.join(path.resolve(projectRoot), "reports", "ux-prod-t3a-primary-aware");
  if (!override) return canonicalReport;

  const temporaryRoot = path.resolve(os.tmpdir());
  const owner = path.resolve(override);
  if (!isPathInside(temporaryRoot, owner)) {
    throw new Error(`browser report owner must be inside the temporary directory: ${owner}`);
  }
  if (!path.basename(owner).startsWith(BROWSER_REPORT_OWNER_PREFIX)) {
    throw new Error(`browser report owner must use the dedicated report prefix: ${owner}`);
  }
  await assertNoSymbolicLinkSegments(temporaryRoot, owner);
  const ownerStat = await fs.lstat(owner);
  if (!ownerStat.isDirectory()) throw new Error(`browser report owner must be a directory: ${owner}`);
  const [realTemporaryRoot, realOwner] = await Promise.all([
    fs.realpath(temporaryRoot),
    fs.realpath(owner),
  ]);
  if (!isPathInside(realTemporaryRoot, realOwner)) {
    throw new Error(`browser report owner must resolve inside the temporary directory: ${owner}`);
  }

  const marker = path.join(owner, BROWSER_REPORT_OWNER_MARKER);
  const markerStat = await fs.lstat(marker).catch((error) => {
    if (error?.code === "ENOENT") throw new Error(`browser report owner marker is missing: ${owner}`);
    throw error;
  });
  if (!markerStat.isFile() || markerStat.isSymbolicLink()) {
    throw new Error(`browser report owner marker must be a regular file: ${owner}`);
  }
  const markerContent = await fs.readFile(marker, "utf8");
  if (markerContent !== BROWSER_REPORT_OWNER_MARKER_CONTENT) {
    throw new Error(`browser report owner marker is invalid: ${owner}`);
  }

  const report = path.join(owner, "report");
  const reportStat = await fs.lstat(report).catch((error) => {
    if (error?.code === "ENOENT") return null;
    throw error;
  });
  if (reportStat?.isSymbolicLink() || (reportStat && !reportStat.isDirectory())) {
    throw new Error(`browser report directory must be an owned directory: ${report}`);
  }
  return report;
}

export function buildMinimalChildEnv(source = process.env) {
  const env = {};
  for (const key of CHILD_ENV_KEYS) {
    if (typeof source[key] === "string" && source[key]) env[key] = source[key];
  }
  env.CI = source.CI || "1";
  env.NODE_ENV = "production";
  env.NEXT_TELEMETRY_DISABLED = "1";
  return env;
}

async function assertRegularTrackedFile(root, relativePath) {
  if (!relativePath || path.isAbsolute(relativePath) || relativePath.split(path.sep).includes("..")) {
    throw new Error(`invalid tracked project path: ${relativePath}`);
  }
  let current = root;
  for (const segment of relativePath.split(path.sep)) {
    current = path.join(current, segment);
    const stat = await fs.lstat(current);
    if (stat.isSymbolicLink()) throw new Error(`tracked project symbolic link is not allowed: ${relativePath}`);
  }
  const stat = await fs.lstat(path.join(root, relativePath));
  if (!stat.isFile()) throw new Error(`tracked project entry is not a regular file: ${relativePath}`);
}

export async function copyTrackedProjectFiles(sourceRoot, destinationRoot, trackedFiles) {
  const uniqueFiles = [...new Set(trackedFiles)].sort();
  for (const relativePath of uniqueFiles) {
    if (path.basename(relativePath).startsWith(".env")) continue;
    await assertRegularTrackedFile(sourceRoot, relativePath);
    const destination = path.join(destinationRoot, relativePath);
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.copyFile(path.join(sourceRoot, relativePath), destination);
  }
}

function collect(command, args, options) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      ...options,
      env: buildMinimalChildEnv(options?.env),
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${command} ${args.join(" ")} failed (${code})\n${stdout}\n${stderr}`));
    });
  });
}

export async function listTrackedProjectFiles(projectRoot) {
  const [{ stdout: prefix }, { stdout: listed }] = await Promise.all([
    collect("git", ["-C", projectRoot, "rev-parse", "--show-prefix"], { env: process.env }),
    collect("git", ["-C", projectRoot, "ls-files", "-z", "--", "."], { env: process.env }),
  ]);
  const normalizedPrefix = prefix.trim();
  return listed
    .split("\0")
    .filter(Boolean)
    .map((file) => normalizedPrefix && file.startsWith(normalizedPrefix) ? file.slice(normalizedPrefix.length) : file)
    .filter((file) => file && !file.startsWith("../"));
}

export async function stopChildProcess(child) {
  if (!child || child.exitCode !== null) return;
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch (error) {
    if (error?.code !== "ESRCH") throw error;
  }
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, 3000)),
  ]);
  if (child.exitCode === null) {
    try {
      process.kill(-child.pid, "SIGKILL");
    } catch (error) {
      if (error?.code !== "ESRCH") throw error;
    }
  }
}

export async function cleanupHarnessResources({ children = [], roots = [] }) {
  const results = await Promise.allSettled([
    ...children.filter(Boolean).map((child) => stopChildProcess(child)),
    ...roots.filter(Boolean).map((root) => fs.rm(root, { recursive: true, force: true })),
  ]);
  const errors = results.filter((result) => result.status === "rejected").map((result) => result.reason);
  if (errors.length > 0) throw new AggregateError(errors, "browser harness cleanup failed");
}
