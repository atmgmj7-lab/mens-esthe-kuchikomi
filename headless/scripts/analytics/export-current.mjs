import { mkdtemp, open, rename, rm } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const usageError = () => new Error("Invalid analytics export arguments");

export function parseExportArguments(args) {
  if (!Array.isArray(args) || args.length !== 4) throw usageError();
  let days = null;
  let output = null;
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    const value = args[index + 1];
    if (typeof value !== "string" || value === "") throw usageError();
    if (flag === "--period" && days === null && (value === "7" || value === "28")) days = Number(value);
    else if (flag === "--output" && output === null) output = value;
    else throw usageError();
  }
  if (days === null || output === null) throw usageError();
  return { days, output };
}

async function defaultCollect({ days }) {
  const { collectAnalyticsSnapshot } = await import("../../lib/analytics/snapshot.ts");
  return collectAnalyticsSnapshot({ days });
}

const defaultFs = { mkdtemp, open, rename, rm };

export async function writeAnalyticsSnapshot({ days, output, collect = defaultCollect, fs = defaultFs }) {
  if ((days !== 7 && days !== 28) || typeof output !== "string" || output === "" || typeof collect !== "function") throw usageError();
  const destination = resolve(output);
  let temporaryDirectory = null;
  try {
    const snapshot = await collect({ days });
    temporaryDirectory = await fs.mkdtemp(join(dirname(destination), `.${basename(destination)}.`));
    const temporary = join(temporaryDirectory, basename(destination));
    const file = await fs.open(temporary, "wx", 0o600);
    try { await file.writeFile(`${JSON.stringify(snapshot)}\n`, "utf8"); }
    finally { await file.close(); }
    await fs.rename(temporary, destination);
    return snapshot;
  } finally {
    if (temporaryDirectory !== null) await fs.rm(temporaryDirectory, { recursive: true, force: true });
  }
}

async function main() {
  const { days, output } = parseExportArguments(process.argv.slice(2));
  await writeAnalyticsSnapshot({ days, output });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(() => { process.exitCode = 1; });
}
