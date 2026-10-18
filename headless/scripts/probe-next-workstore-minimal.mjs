import assert from "node:assert/strict";
import { cpSync, existsSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptsDirectory = dirname(fileURLToPath(import.meta.url));
const projectDirectory = resolve(scriptsDirectory, "..");
const placementArgument = process.argv.find((argument) => argument.startsWith("--placement="));
const dependencyModeArgument = process.argv.find((argument) => argument.startsWith("--dependency-mode="));
const engineArgument = process.argv.find((argument) => argument.startsWith("--engine="));
const placement = placementArgument === "--placement=isolated"
  ? "isolated"
  : placementArgument === "--placement=workspace"
    ? "workspace"
    : null;
const probeBaseDirectory = placement === "workspace"
  ? join(projectDirectory, ".eskomi-next-workstore-probes")
  : join(projectDirectory, ".eskomi-cloudflare-dynamic-builds", "minimal-workstore-probes");
const cacheComponentsArgument = process.argv.find((argument) => argument.startsWith("--cache-components="));
const turbopackRootArgument = process.argv.find((argument) => argument.startsWith("--turbopack-root="));
const cacheComponents = cacheComponentsArgument === "--cache-components=true"
  ? true
  : cacheComponentsArgument === "--cache-components=false"
    ? false
    : null;

assert.notEqual(cacheComponents, null, "pass exactly one of --cache-components=true or --cache-components=false");
assert.notEqual(placement, null, "pass exactly one of --placement=isolated or --placement=workspace");
const engine = engineArgument === "--engine=turbopack"
  ? "turbopack"
  : engineArgument === "--engine=webpack"
    ? "webpack"
    : null;
assert.notEqual(engine, null, "pass exactly one of --engine=turbopack or --engine=webpack");
const dependencyMode = placement === "workspace"
  ? "workspace"
  : dependencyModeArgument === "--dependency-mode=copy"
    ? "copy"
    : dependencyModeArgument === "--dependency-mode=symlink"
      ? "symlink"
      : null;
assert.notEqual(dependencyMode, null, "isolated probes require --dependency-mode=copy or --dependency-mode=symlink");
assert.equal(
  turbopackRootArgument === "--turbopack-root=true" || turbopackRootArgument === "--turbopack-root=false" || turbopackRootArgument === "--turbopack-root=workspace",
  true,
  "pass exactly one of --turbopack-root=true, --turbopack-root=false, or --turbopack-root=workspace",
);
const turbopackRoot = turbopackRootArgument === "--turbopack-root=true"
  ? "self"
  : turbopackRootArgument === "--turbopack-root=workspace"
    ? "workspace"
    : false;

function writeNewFile(path, contents) {
  assert.equal(existsSync(path), false, `probe must not overwrite ${path}`);
  writeFileSync(path, contents, { encoding: "utf8", flag: "wx" });
}

const runId = `${new Date().toISOString().replace(/[:.]/gu, "-")}-${randomUUID()}`;
const probeDirectory = join(probeBaseDirectory, `run-${runId}`);
mkdirSync(join(probeDirectory, "app"), { recursive: true });

if (placement === "isolated") {
  // Keep the dependency tree self-contained: a symlink made Turbopack trace files
  // outside the probe root in an earlier investigation.
  if (dependencyMode === "copy") {
    cpSync(join(projectDirectory, "node_modules"), join(probeDirectory, "node_modules"), {
      recursive: true,
      force: false,
      errorOnExist: true,
    });
  } else {
    symlinkSync(join(projectDirectory, "node_modules"), join(probeDirectory, "node_modules"), "dir");
  }

  // The app surface is minimal, but the manifest and lockfile must be byte-for-byte
  // comparable with the working canonical build.
  for (const file of ["package.json", "package-lock.json"]) {
    const source = join(projectDirectory, file);
    assert.equal(existsSync(source), true, `canonical ${file} must exist`);
    writeNewFile(join(probeDirectory, file), readFileSync(source, "utf8"));
  }
}
const rootExpression = turbopackRoot === "self"
  ? "resolve(process.cwd())"
  : turbopackRoot === "workspace"
    ? 'resolve(process.cwd(), "../../..")'
    : null;
writeNewFile(join(probeDirectory, "next.config.mjs"), `${rootExpression ? 'import { resolve } from "node:path";\n\n' : ""}export default {\n  cacheComponents: ${cacheComponents},${rootExpression ? `\n  turbopack: { root: ${rootExpression} },` : ""}\n};\n`);
writeNewFile(join(probeDirectory, "app", "layout.js"), `export const metadata = { title: "Minimal workStore probe" };\n\nexport default function RootLayout({ children }) {\n  return <html><body>{children}</body></html>;\n}\n`);
writeNewFile(join(probeDirectory, "app", "page.js"), `export default function Page() {\n  return <main>minimal workStore probe</main>;\n}\n`);

const nextBinary = placement === "isolated"
  ? join(probeDirectory, "node_modules", ".bin", "next")
  : join(projectDirectory, "node_modules", ".bin", "next");
const build = spawnSync(nextBinary, ["build", ...(engine === "webpack" ? ["--webpack"] : [])], {
  cwd: probeDirectory,
  stdio: "inherit",
  env: { ...process.env },
});
if (build.error) throw build.error;

writeNewFile(join(probeDirectory, "probe-result.json"), `${JSON.stringify({
  schema: 1,
  placement,
  dependencyMode,
  engine,
  cacheComponents,
  turbopackRoot,
  status: build.status ?? 1,
  nodeVersion: process.version,
  nextVersion: JSON.parse(readFileSync(join(placement === "isolated" ? probeDirectory : projectDirectory, "node_modules", "next", "package.json"), "utf8")).version,
}, null, 2)}\n`);
console.log(`ESKOMI_MINIMAL_WORKSTORE_PROBE_ROOT=${probeDirectory}`);
process.exitCode = build.status ?? 1;
