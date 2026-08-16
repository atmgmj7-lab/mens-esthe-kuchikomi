import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

const CHILD_ENV_KEYS = ["PATH", "TMPDIR", "TMP", "TEMP", "LANG", "LC_ALL", "CI", "TERM"];

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
