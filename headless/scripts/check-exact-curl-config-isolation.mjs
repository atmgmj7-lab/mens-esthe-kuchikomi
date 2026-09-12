import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync, existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createExactCurlEnvironment, prepareExactCurlHome } from "./lib/exact-curl-environment.mjs";
import { buildExactAreaCurlOptions, parseDirectHttpResponseHeaders } from "./lib/exact-deployment-release-contract.mjs";

function run(command, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { env });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (data) => { stdout += data; });
    child.stderr.on("data", (data) => { stderr += data; });
    child.on("error", reject);
    child.on("close", (status) => resolve({ status, stdout, stderr }));
  });
}

export async function checkCurlConfigIsolation(check) {
  const root = mkdtempSync(path.join(os.tmpdir(), "eskomi-curl-isolation-test-"));
  const home = path.join(root, "home");
  const xdg = path.join(root, "xdg");
  for (const directory of [home, xdg]) mkdirSync(directory);
  let destinationHits = 0;
  const received = new Set();
  const destination = createServer((request, response) => {
    destinationHits += 1;
    for (const name of ["x-vercel-protection-bypass", "authorization", "cookie", "x-test-auth"]) {
      if (request.headers[name]) received.add(name);
    }
    response.end("wrong origin");
  });
  let responseStatus = 302;
  const source = createServer((_request, response) => {
    if (responseStatus === 302) {
      response.writeHead(302, { Location: `http://127.0.0.1:${destination.address().port}/target` });
    }
    response.end("fixture");
  });
  const listen = (server) => new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const close = (server) => new Promise((resolve) => server.close(resolve));
  try {
    await listen(destination);
    await listen(source);
    const baseEnv = { PATH: process.env.PATH, HOME: home, XDG_CONFIG_HOME: xdg, RUNNER_TEMP: root };
    for (const kind of ["HOME", "XDG", "CURL_HOME", "none"]) {
      rmSync(path.join(home, ".curlrc"), { force: true });
      rmSync(path.join(xdg, "curlrc"), { force: true });
      if (kind === "HOME" || kind === "CURL_HOME") writeFileSync(path.join(home, ".curlrc"), "location\n");
      if (kind === "XDG") writeFileSync(path.join(xdg, "curlrc"), "location\n");
      const parentEnv = { ...baseEnv, ...(kind === "CURL_HOME" ? { CURL_HOME: home } : {}) };
      const isolated = createExactCurlEnvironment(parentEnv);
      const curlHome = isolated.env.CURL_HOME;
      try {
        check(isolated.env.HOME === home && isolated.env.XDG_CONFIG_HOME === xdg, kind + ": authentication HOME and XDG unchanged");
        check(curlHome !== home && curlHome.startsWith(root + path.sep), kind + ": dedicated CURL_HOME under runner temp");
        check(readFileSync(path.join(curlHome, ".curlrc"), "utf8") === "", kind + ": explicit empty config");
        check((statSync(curlHome).mode & 0o777) === 0o700, kind + ": directory mode 700");
        check((statSync(path.join(curlHome, ".curlrc")).mode & 0o777) === 0o600, kind + ": config mode 600");
        // Case 4: reset a contaminated dedicated config, including a symlink.
        writeFileSync(path.join(curlHome, ".curlrc"), "location\n");
        prepareExactCurlHome(path.dirname(curlHome));
        check(readFileSync(path.join(curlHome, ".curlrc"), "utf8") === "", kind + ": contaminated config reset");
        rmSync(curlHome, { recursive: true });
        symlinkSync(home, curlHome);
        prepareExactCurlHome(path.dirname(curlHome));
        check(existsSync(home) && readFileSync(path.join(curlHome, ".curlrc"), "utf8") === "", kind + ": reset does not follow existing directory symlink");
        responseStatus = kind === "none" ? 200 : 302;
        const headerFile = path.join(root, "headers");
        const result = await run("curl", [
          "--url", `http://127.0.0.1:${source.address().port}/area/shinosaka/`,
          "--header", "x-vercel-protection-bypass: dummy",
          "--header", "Authorization: Bearer dummy",
          "--header", "Cookie: fixture=dummy",
          "--header", "x-test-auth: dummy",
          ...buildExactAreaCurlOptions(headerFile, path.join(root, "body")),
        ], isolated.env);
        check(result.status === 0 && Number(result.stdout) === responseStatus, kind + ": curl returns initial response");
        let accepted = true;
        try { parseDirectHttpResponseHeaders(readFileSync(headerFile, "utf8"), Number(result.stdout), "shinosaka"); }
        catch { accepted = false; }
        check(accepted === (kind === "none"), kind + ": direct 200 only");
        check(destinationHits === 0 && received.size === 0, kind + ": destination and auth/protection forwarding zero");
      } finally {
        isolated.cleanup();
      }
      check(!existsSync(curlHome), kind + ": cleanup");
    }

    // Exercise the actual runner boundary with a local Vercel adapter. It uses
    // the installed CLI's URL/header-before-passthrough argument ordering.
    writeFileSync(path.join(home, ".curlrc"), "location\n");
    writeFileSync(path.join(xdg, "curlrc"), "location\n");
    const bin = path.join(root, "bin");
    mkdirSync(bin);
    const records = path.join(root, "calls.jsonl");
    const adapter = `#!${process.execPath}
import { appendFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const args = process.argv.slice(2);
if (args[0] === 'inspect') console.log(JSON.stringify({id:'dplFixture'}));
else if (args[0] === 'api') console.log(JSON.stringify({aliases:[]}));
else if (args[0] === 'curl') {
  appendFileSync(${JSON.stringify(records)},JSON.stringify({path:args[1],home:process.env.HOME,curlHome:process.env.CURL_HOME})+'\\n');
  const result=spawnSync('curl',['--url',${JSON.stringify("http://127.0.0.1:" + source.address().port)}+args[1],'--header','x-vercel-protection-bypass: dummy',...args.slice(args.indexOf('--')+1)],{stdio:'inherit'});
  process.exit(result.status ?? 1);
} else process.exit(2);
`;
    // .mjs via a shell-free node shebang; package context is outside the repo.
    writeFileSync(path.join(bin, "vercel"), adapter, { mode: 0o700 });
    const runner = fileURLToPath(new URL("./check-exact-deployment-release.mjs", import.meta.url));
    for (const status of [302, 200]) {
      responseStatus = status;
      writeFileSync(records, "");
      const result = await run(process.execPath, [
        runner, "--url", "https://fixture.vercel.app", "--id", "dplFixture", "--expected-sha", "a".repeat(40),
      ], { ...baseEnv, PATH: bin + path.delimiter + baseEnv.PATH, VERCEL_TOKEN: "dummy", CURL_HOME: home });
      const calls = readFileSync(records, "utf8").trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));
      check(result.status !== 0, "runner fixture never claims release PASS from incomplete metadata");
      check(calls.length === (status === 302 ? 1 : 2), "runner executes expected fixed Area paths");
      check(calls.every((call) => call.home === home && call.curlHome !== home && !existsSync(call.curlHome)), "runner isolates every curl, preserves HOME and cleans up on failure");
      check(calls.map((call) => call.path).join(",") === (status === 302 ? "/area/shinosaka/" : "/area/shinosaka/,/area/sakai/"), "runner fixed paths");
      check(destinationHits === 0 && received.size === 0, "runner destination/auth forwarding zero");
    }
  } finally {
    await Promise.all([close(source), close(destination)]);
    rmSync(root, { recursive: true, force: true });
  }
  return { destinationRequestCount: destinationHits, receivedAuthHeaderNames: [...received] };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let assertions = 0;
  const failures = [];
  const evidence = await checkCurlConfigIsolation((condition, label) => {
    assertions += 1;
    if (!condition) failures.push(label);
  });
  console.log(JSON.stringify({ assertions, failures, ...evidence }, null, 2));
  if (failures.length) process.exitCode = 1;
}
