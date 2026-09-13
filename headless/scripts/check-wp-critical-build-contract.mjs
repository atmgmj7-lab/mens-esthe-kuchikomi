import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

async function importRequired(path, label) {
  try {
    return await import(path);
  } catch (error) {
    assert.fail(`${label} must exist and load: ${error instanceof Error ? error.message : error}`);
  }
}

const preflight = await importRequired(
  new URL("./wp-critical-build-preflight.mjs", import.meta.url),
  "critical WordPress preflight"
);
const artifactGuard = await importRequired(
  new URL("./verify-critical-area-build-artifacts.mjs", import.meta.url),
  "critical Area artifact guard"
);

const shinosakaTerm = {
  id: 13,
  slug: "shinosaka",
  name: "新大阪",
  parent: 2,
  count: 58,
  description: "",
  acf: {}
};
const sakaiTerm = {
  id: 17,
  slug: "sakai",
  name: "堺東",
  parent: 2,
  count: 25,
  description: "",
  acf: {}
};

assert.deepEqual(
  await preflight.runCriticalAreaPreflight({
    requestArea: async (slug) => ({
      status: 200,
      body: JSON.stringify([slug === "shinosaka" ? shinosakaTerm : sakaiTerm])
    })
  }),
  [
    { slug: "shinosaka", id: 13 },
    { slug: "sakai", id: 17 }
  ],
  "preflight must accept the two canonical WordPress Area terms"
);

for (const fixture of [
  { label: "empty term array", response: { status: 200, body: "[]" } },
  { label: "wrong slug", response: { status: 200, body: JSON.stringify([sakaiTerm]) } },
  { label: "upstream HTTP failure", response: { status: 503, body: "[]" } },
  { label: "invalid JSON", response: { status: 200, body: "not-json" } }
]) {
  await assert.rejects(
    () =>
      preflight.runCriticalAreaPreflight({
        requestArea: async () => fixture.response
      }),
    Error,
    `preflight must reject ${fixture.label}`
  );
}

await assert.rejects(
  () =>
    preflight.runCriticalAreaPreflight({
      requestArea: async () => {
        throw new Error("WordPress origin request timed out");
      }
    }),
  /timed out/,
  "preflight must reject origin timeouts"
);

// Resilience must retry only network failures, never invalid origin responses.
const validResponse = (slug) => ({ status: 200, body: JSON.stringify([slug === "shinosaka" ? shinosakaTerm : sakaiTerm]) });
const networkError = (code) => Object.assign(new Error("fixture credential=https://user:password@example.invalid"), { code });
let retryCalls = [];
let delays = [];
let attemptEvidence = [];
assert.deepEqual(await preflight.runCriticalAreaPreflight({
  requestArea: async (slug) => {
    retryCalls.push(slug);
    if (retryCalls.length === 1) throw networkError("ETIMEDOUT");
    return validResponse(slug);
  },
  sleep: async (ms) => delays.push(ms),
  onAttempt: (event) => attemptEvidence.push(event),
}), [{ slug: "shinosaka", id: 13 }, { slug: "sakai", id: 17 }], "first timeout then success recovers");
assert.deepEqual(retryCalls, ["shinosaka", "shinosaka", "sakai"]);
assert.deepEqual(delays, [500]);
assert.equal(attemptEvidence.length, 3);
assert.equal(attemptEvidence[0].errorCode, "ETIMEDOUT");
assert.equal(attemptEvidence[0].transport, "fixed-ip");
assert.equal(attemptEvidence[0].attempt, 1);
assert.ok(Number.isFinite(attemptEvidence[0].elapsedMs));
assert.doesNotMatch(JSON.stringify(attemptEvidence), /password|credential|headers|example.invalid/);
for (const code of ["ETIMEDOUT", "ECONNRESET", "ENETUNREACH", "EHOSTUNREACH", "EAI_AGAIN", "ECONNREFUSED"]) {
  let calls = 0; const backoffs = [];
  await assert.rejects(() => preflight.runCriticalAreaPreflight({
    requestArea: async () => { calls++; throw networkError(code); },
    sleep: async (ms) => backoffs.push(ms),
  }));
  assert.equal(calls, 3, `${code}: all attempts fail, capped at three`);
  assert.deepEqual(backoffs, [500, 1000]);
}
for (const code of ["CERT_HAS_EXPIRED", "DEPTH_ZERO_SELF_SIGNED_CERT", "ERR_TLS_CERT_ALTNAME_INVALID", "UNABLE_TO_VERIFY_LEAF_SIGNATURE", "ENOTFOUND", "UNKNOWN"]) {
  let calls = 0;
  await assert.rejects(() => preflight.runCriticalAreaPreflight({ requestArea: async () => { calls++; throw networkError(code); } }));
  assert.equal(calls, 1, `${code}: permanent failures are not retried`);
}
for (const response of [
  { status: 500, body: "[]" }, { status: 403, body: "[]" }, { status: 200, body: "invalid" },
  { status: 200, body: JSON.stringify([sakaiTerm]) },
  ...["13", 0, -1, 1.5, null].map((id) => ({ status: 200, body: JSON.stringify([{ ...shinosakaTerm, id }]) })),
]) {
  let calls = 0;
  await assert.rejects(() => preflight.runCriticalAreaPreflight({ requestArea: async () => { calls++; return response; } }));
  assert.equal(calls, 1, "invalid WP response fails immediately rather than retrying into PASS");
}
let partialCalls = [];
await assert.rejects(() => preflight.runCriticalAreaPreflight({
  requestArea: async (slug) => { partialCalls.push(slug); if (slug === "sakai") throw networkError("ETIMEDOUT"); return validResponse(slug); },
  sleep: async () => {},
}));
assert.deepEqual(partialCalls, ["shinosaka", "sakai", "sakai", "sakai"], "second Area failure blocks whole preflight");
for (const [input, expected] of [[undefined,15000], ["5000",10000], ["12000",12000], ["90000",15000], ["bad",15000], ["0",15000], ["-1",15000], ["Infinity",15000]]) {
  assert.equal(preflight.resolvePreflightTimeoutMs(input), expected, "effective timeout is bounded, raw config not logged");
}
const { EventEmitter } = await import("node:events");
const { mock } = await import("node:test");
mock.timers.enable({ apis: ["setTimeout"] });
try {
  let requestOptions;
  let destroyed = 0;
  const pending = preflight.requestCriticalArea("shinosaka", {
    timeoutMs: 10000,
    requestImpl: (options) => {
      requestOptions = options;
      const request = new EventEmitter();
      request.setTimeout = () => request;
      request.end = () => {};
      request.destroy = (error) => { destroyed++; request.emit("error", error); };
      return request;
    },
  });
  const rejection = assert.rejects(pending, { code: "ETIMEDOUT" });
  mock.timers.tick(10000);
  await rejection;
  assert.equal(destroyed,1,"absolute deadline cancels even a pre-socket stall");
  assert.equal(requestOptions.hostname,"85.131.213.108");
  assert.equal(requestOptions.servername,"sv16727.xserver.jp");
  assert.equal(requestOptions.headers.Host,"mens-esthe-kuchikomi.com");
  assert.equal(requestOptions.rejectUnauthorized,true);
  assert.equal(requestOptions.method,"GET");
} finally { mock.timers.reset(); }

// Exercise the actual request adapter, including permanent status and cleanup.
for (const scenario of ["success", "http500", "oversized", "aborted", "tls"]) {
  let requestDestroyed = false;
  let responseDestroyed = false;
  const result = preflight.requestCriticalArea("shinosaka", {
    requestImpl: (_options, callback) => {
      const request = new EventEmitter();
      request.setTimeout = () => request;
      request.destroy = () => { requestDestroyed = true; };
      request.end = () => queueMicrotask(() => {
        if (scenario === "tls") { request.emit("error", networkError("ERR_TLS_CERT_ALTNAME_INVALID")); return; }
        const response = new EventEmitter();
        response.statusCode = scenario === "http500" ? 500 : 200;
        response.destroy = () => { responseDestroyed = true; };
        callback(response);
        if (scenario === "success") { response.emit("data", Buffer.from(validResponse("shinosaka").body)); response.emit("end"); }
        if (scenario === "oversized") response.emit("data", Buffer.alloc(1_000_001));
        if (scenario === "aborted") response.emit("aborted");
        // HTTP500 intentionally never ends its body; it must still fail immediately.
      });
      return request;
    },
  });
  if (scenario === "success") assert.equal((await result).status, 200);
  else {
    const codes = { http500: "WP_HTTP_STATUS", oversized: "WP_RESPONSE_TOO_LARGE", aborted: "ECONNRESET", tls: "ERR_TLS_CERT_ALTNAME_INVALID" };
    await assert.rejects(result, { code: codes[scenario] });
    if (scenario !== "tls") assert.equal(requestDestroyed, true, "failed response cancels request");
    if (scenario === "http500") assert.equal(responseDestroyed, true);
  }
}

const validNextManifest = {
  routes: {
    "/area/shinosaka": {
      renderingMode: "PARTIALLY_STATIC",
      experimentalPPR: true,
      initialRevalidateSeconds: 60,
      srcRoute: "/area/shinosaka",
      htmlSize: 278566
    },
    "/area/sakai": {
      renderingMode: "PARTIALLY_STATIC",
      experimentalPPR: true,
      initialRevalidateSeconds: 60,
      srcRoute: "/area/sakai",
      htmlSize: 132783
    }
  }
};

assert.doesNotThrow(
  () => artifactGuard.validateNextPrerenderManifest(validNextManifest),
  "fully rendered critical Area routes must pass"
);

for (const invalidManifest of [
  { routes: {} },
  {
    routes: {
      ...validNextManifest.routes,
      "/area/shinosaka": {
        ...validNextManifest.routes["/area/shinosaka"],
        initialStatus: 404
      }
    }
  },
  {
    routes: {
      ...validNextManifest.routes,
      "/area/sakai": {
        ...validNextManifest.routes["/area/sakai"],
        srcRoute: "/area/[slug]"
      }
    }
  }
]) {
  assert.throws(
    () => artifactGuard.validateNextPrerenderManifest(invalidManifest),
    Error,
    "missing, not-found, or dynamic fallback artifacts must block release"
  );
}

const validVercelConfig = (slug) => ({
  type: "Prerender",
  expiration: 60,
  hasPostponed: true,
  isDynamicRoute: false,
  htmlSize: 120000,
  initialHeaders: {
    "x-next-cache-tags": `wp,areas,area:${slug}`
  },
  chain: {
    outputPath: `area/${slug}`
  }
});

assert.doesNotThrow(() =>
  artifactGuard.validateVercelPrerenderConfig("shinosaka", validVercelConfig("shinosaka"))
);
assert.throws(
  () =>
    artifactGuard.validateVercelPrerenderConfig("sakai", {
      ...validVercelConfig("sakai"),
      expiration: 3600,
      initialHeaders: { "x-next-cache-tags": "_N_T_/area/sakai" }
    }),
  Error,
  "a fallback/not-found Vercel artifact without the WordPress Area cache tag must fail"
);

assert.equal(
  typeof artifactGuard.validateClientAssets,
  "function",
  "artifact guard must inspect browser assets for server-only origin configuration"
);
assert.doesNotThrow(() =>
  artifactGuard.validateClientAssets([
    { path: "safe.js", source: "globalThis.__next_chunk__ = true" }
  ])
);
for (const leaked of ["sv16727.xserver.jp", "WP_ORIGIN_TLS_SERVERNAME", "85.131.213.108"]) {
  assert.throws(
    () => artifactGuard.validateClientAssets([{ path: "leaked.js", source: leaked }]),
    /server-only WordPress origin configuration/,
    `browser assets must reject leaked origin marker ${leaked}`
  );
}

const workflow = readFileSync(join(root, "../.github/workflows/deploy-headless.yml"), "utf8");
assert.match(workflow, /preflight_only:[\s\S]*?type: boolean[\s\S]*?default: false/, "probe must be opt-in");
assert.match(workflow, /deploy:\n    if: \$\{\{ github.event_name != 'workflow_dispatch' \|\| !inputs.preflight_only \}\}/, "probe dispatch must exclude deploy job before any Secret/build step");
const probe = workflow.match(/  origin-probe:([\s\S]*?)(?=\n  deploy:)/)?.[1];
assert.ok(probe);
assert.match(probe, /github.event_name == 'workflow_dispatch' && inputs.preflight_only/);
assert.match(probe, /contents: read/);
assert.match(probe, /timeout-minutes: 3/);
assert.match(probe, /run: node scripts\/wp-critical-build-preflight\.mjs/);
assert.doesNotMatch(probe, /secrets\.|vercel|npm run build|curl|write-all/);
const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
assert.match(
  packageJson.scripts.test,
  /test:wp-critical-build/,
  "the full test suite must include the critical WordPress build contract"
);
assert.match(
  packageJson.scripts["wp:critical-preflight"],
  /--env-file-if-exists=\.env\.local/,
  "the preflight must validate the same pulled Vercel environment used by Next build"
);
const validationBuildStep = workflow.match(
  /- name: Build \(CI validation\)([\s\S]*?)(?=\n\s+- name:)/
)?.[1];
assert.ok(validationBuildStep, "CI validation build step must exist");
assert.doesNotMatch(
  validationBuildStep,
  /continue-on-error\s*:\s*true/,
  "CI validation build must fail the workflow"
);
assert.match(
  workflow,
  /- name: Critical WordPress build preflight[\s\S]*?npm run wp:critical-preflight/,
  "workflow must fail closed before build when critical WordPress Area data is unavailable"
);
assert.match(
  workflow,
  /- name: Verify critical Area build artifacts[\s\S]*?npm run verify:critical-area-build-artifacts/,
  "workflow must reject fallback/not-found critical Area artifacts"
);

const requiredReleaseSteps = [
  "Critical WordPress build preflight",
  "Build (CI validation)",
  "Verify critical Area validation artifacts",
  "Vercel build (prebuilt)",
  "Verify critical Area build artifacts",
  "Create staged Vercel production deployment",
  "Verify exact staged deployment",
  "Record staged release gate result"
];
const requiredReleaseStepPositions = requiredReleaseSteps.map((stepName) => {
  const position = workflow.indexOf(`      - name: ${stepName}`);
  assert.notEqual(position, -1, `release workflow step must exist: ${stepName}`);
  return position;
});
assert.deepEqual(
  requiredReleaseStepPositions,
  [...requiredReleaseStepPositions].sort((left, right) => left - right),
  "critical preflight and artifact guards must run before Vercel deployment"
);

const vercelArtifactGuardStep = workflow.match(
  /- name: Verify critical Area build artifacts([\s\S]*?)(?=\n\s+- name:)/
)?.[1];
assert.ok(vercelArtifactGuardStep, "Vercel artifact guard step must exist");
assert.match(
  vercelArtifactGuardStep,
  /npm run verify:critical-area-build-artifacts -- --vercel/,
  "the post-Vercel-build guard must inspect the Vercel output"
);

console.log("WordPress critical build fail-closed contract checks passed");
