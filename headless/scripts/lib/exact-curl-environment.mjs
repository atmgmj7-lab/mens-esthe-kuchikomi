import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

// Only reset a fixed child of the private directory owned by this invocation.
export function prepareExactCurlHome(ownedDirectory) {
  const curlHome = path.join(ownedDirectory, "curl-home");
  rmSync(curlHome, { recursive: true, force: true });
  mkdirSync(curlHome, { mode: 0o700 });
  chmodSync(curlHome, 0o700);
  writeFileSync(path.join(curlHome, ".curlrc"), "", { flag: "wx", mode: 0o600 });
  chmodSync(path.join(curlHome, ".curlrc"), 0o600);
  return curlHome;
}

export function createExactCurlEnvironment(parentEnv = process.env) {
  const ownedDirectory = mkdtempSync(
    path.join(parentEnv.RUNNER_TEMP || os.tmpdir(), "eskomi-exact-qa-"),
  );
  const cleanup = () => rmSync(ownedDirectory, { recursive: true, force: true });
  try {
    chmodSync(ownedDirectory, 0o700);
    const curlHome = prepareExactCurlHome(ownedDirectory);
    return { env: { ...parentEnv, CURL_HOME: curlHome }, cleanup };
  } catch (error) {
    cleanup();
    throw error;
  }
}
