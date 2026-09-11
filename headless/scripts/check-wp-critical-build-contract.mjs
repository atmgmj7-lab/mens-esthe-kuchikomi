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
  "Deploy to Vercel production"
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
