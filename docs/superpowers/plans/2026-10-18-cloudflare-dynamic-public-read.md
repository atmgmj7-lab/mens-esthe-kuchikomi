# Cloudflare Dynamic Public Read Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Cloudflare-only OpenNext build serve public Eskomi data as explicit dynamic, no-store reads without changing the normal Node/Vercel build.

**Architecture status:** **Physical-source Worker build and isolated HTTP fixture pass.** The normal build keeps Next Cache Components and native `sharp` unchanged. The derived source removes only Cloudflare-incompatible public cache directives, isolates a physical derived `next` package, and substitutes the four upload routes with a pure-JavaScript Worker image adapter. All other dependencies remain read-only links to the canonical tree. The Cloudflare worker template handles `/_next/image` before Next; the derived Next copy redirects that unreachable Node-only optimizer import to an explicit Worker shim, keeping native bindings out of workerd.

**Tech Stack:** Next.js 16.3.8, OpenNext Cloudflare 1.20.9, Webpack derived-source build, local workerd, disposable Docker fixture.

**Spec:** `docs/technical/artifacts/2026-10-18-cloudflare-workers-offline-migration-plan.md`

## Global Constraints

- Normal Node/Vercel build remains Turbopack with Cache Components enabled.
- Worker build has no Cache Components directive in public readers and emits explicit dynamic/no-store public reads.
- Preserve canonical HTML/title/canonical/robots/JSON-LD, authorization, private no-store boundaries, and existing rejection behavior.
- Do not create Cloudflare resources, change DNS/secrets/OAuth, write production data, merge main, deploy, or delete generated evidence.
- No relaxed PNG/JPEG/WebP, metadata, EXIF, dimension, size, or cross-store authorization checks.

## Review Focus

- A Worker build must not retain a `use cache`, `cacheLife`, or `cacheTag` call in any selected public reader.
- A normal build must not select webpack or lose Cache Components.
- A listing approval or unlisting must be visible without a stale public-cache dependency.
- Partner/dashboard/upload/email output must remain `private, no-store`.
- Image conversion must reject malformed/oversized/over-pixel/cross-store input before any storage write.

### Task 1: Cloudflare-only dynamic public-read build path — feasibility result

**Files:**
- Create: `headless/scripts/cloudflare-dynamic-public-read-loader.cjs`
- Create: `headless/scripts/build-next.mjs`
- Create: `headless/scripts/check-cloudflare-dynamic-public-read.mjs`
- Modify: `headless/next.config.ts`
- Modify: `headless/package.json`

- [x] Write and run a failing contract test proving the Worker path must remove selected cache directives while normal build configuration remains cached.
- [x] Implement a disposable loader/build selector experiment and rerun the contract test.
- [x] Run the normal Node build and restore the exact original Workers build after the experiment.
- [x] Record the blocking result rather than retaining an incomplete build path.

**Observed blocker:** With `cacheComponents: false`, the current route
`/area/[slug]/community/page` fails because it exports `instant`. Leaving Cache
Components enabled while the loader removes cache directives makes public
`/[slug]` fail prerendering because it calls uncached/runtime data. Adding
`instant = false` in the loader does not help: Next had already extracted the
route configuration and still prerendered the route. This is a phase-ordering
constraint, not a route-test failure.

**Decision required before Task 2:**

1. Approve a maintained physical Cloudflare staging source/tree (or equivalent
   build transform that runs before Next route discovery). This keeps the Node
   source semantics but is a significant build architecture addition.
2. Approve unconditional `instant = false` in the shared public route source.
   This changes the Node/Vercel rendering policy too, so it is not a
   Cloudflare-only modification.
3. Select the cache-parity path instead and defer dynamic-first until the
   Cache Components runtime issue is resolved.

### Physical derived-source trial (2026-10-18)

The user selected decision 1 for a local-only feasibility trial. The tracked
generator creates a fresh ignored
`headless/.eskomi-cloudflare-dynamic-builds/run-<timestamp>-<uuid>/` tree for
every run; it never mutates canonical `app/`, `lib/`, `next.config.ts`, or
`node_modules`. It copies only an allowlisted project skeleton, rejects missing
or unexpected cache-reader shapes, keeps root dotenv/npm configuration out,
and writes a manifest. The derived source removes public-reader cache
directives, adds `instant = false` before Next discovers the affected public
route modules (including the Sakai/Shin-Osaka static aliases), and substitutes
only the four public mutation invalidators with a derived no-op adapter.

The source contract passes. The `workStore` error was reproduced with a
metadata-only minimal Next app when `node_modules` was copied into a nested
derived tree, and disappears when the same app resolves the canonical
dependencies or uses an in-root symlink with Webpack. Turbopack rejects that
symlink unless its root expands to the parent workspace; doing so makes
Next's standalone tree parent-relative, which OpenNext cannot locate. The
derived command therefore uses Webpack with `outputFileTracingRoot` set to the
generated app itself. This reaches the complete 84-route Next build, emits the
expected standalone trace layout, and bundles the OpenNext middleware.

The derived build now completes OpenNext and produces `.open-next/worker.js`.
The generated source tree is retained as ignored evidence; the normal
`workers:build` command remains the pre-existing baseline, so dynamic mode is
always explicit.

### Task 2: Worker mutation revalidation compatibility

**Files:**
- Create or modify: `headless/lib/*public-cache*`
- Modify: the four public-invalidation routes and two invalidation helpers
- Test: `headless/scripts/check-cloudflare-dynamic-public-read.mjs`

- [x] Write and run a failing contract test for Node invalidation retention and Worker no-op compatibility.
- [x] Implement the smallest build-gated adapter and rerun the test.
- [x] Run the isolated Partner/dashboard HTTP fixture and verify approval plus public unlisting behavior.

### Task 3: Worker-safe image normalization

**Files:**
- Modify: `headless/lib/listing-application-image.ts` and Worker-specific runtime helper(s)
- Modify: `headless/package.json` / lockfile only for reviewed pure-JavaScript codecs
- Test: focused image contract plus isolated real HTTP fixture

- [x] Write failing tests for valid PNG/JPEG/VP8X WebP conversion, EXIF orientation, metadata stripping, invalid/oversized/over-pixel rejection, and foreign-store denial.
- [x] Implement a Worker-only pure-JavaScript codec path without changing Node `sharp` behavior.
- [x] Run focused contracts, Worker build, and the real fixture checks. The Worker fixture proves real PNG upload/re-encoded JPEG retrieval; its normal HTTP authorization boundary proves foreign-store asset denial.
