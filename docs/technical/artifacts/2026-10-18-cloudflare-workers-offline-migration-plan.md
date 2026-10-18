# Eskomi Cloudflare Workers — offline migration plan (2026-10-18)

## Decision

Use the Cloudflare OpenNext adapter for this **offline preparation branch**.
It retains the current Next.js 16.3.8 application and `next build` model rather
than rewriting it to vinext/Vite. This is the smaller, more directly testable
route for the application's enabled Cache Components (`"use cache"`), tag/path
revalidation, PPR-capable rendering, route handlers, and existing `next/image`
usage. It is a preparation decision, not an account, deployment, DNS, or
production cutover decision.

The current official vinext check was run with `vinext` 1.2.1 and exited zero
without changing the repository. Cloudflare documents vinext as beta and marks
`next/*` imports as mostly supported and image optimization as partially
supported. Cloudflare documents OpenNext support for ISR, PPR, composable
caching, image optimization, App Router, route handlers, SSR, and Server
Actions. Given the approved requirement to avoid an unqualified framework
rewrite, OpenNext is the narrower initial adapter proof. Re-evaluate vinext only
after its compatibility dashboard explicitly covers all blocked behavior.

## Files and local-only commands

The branch will add only account-neutral configuration below `headless/`:

- `open-next.config.ts` using the official Cloudflare adapter default;
- `wrangler.jsonc` pointing at generated `.open-next/worker.js` and assets,
  with no account ID, zone ID, route, custom domain, binding, secret, or cron;
- exact trusted-registry dev/runtime dependencies and scripts named
  `workers:build`, `workers:preview`, and `test:cloudflare-workers-contract`.

There is intentionally no `workers:deploy` script and no Wrangler login,
account selection, or deployment command in this branch. `workers:preview`
must remain local-only. Both local scripts force the existing WordPress client
onto an unreachable loopback fixture origin. Wrangler reads the ignored,
non-secret `.dev.vars` generated from `.dev.vars.example` to set
`CONTACT_FORM_DRY_RUN=true` at Worker runtime; shell environment values alone
are not a substitute. Neither build nor preview may use the production default
origin while generating static output.

## Preservation rules

- Keep all canonical URLs, trailing slashes, redirects, rewrites, headers,
  `no-store` partner surfaces, authentication cookie attributes, and Supabase
  server-only credential boundaries unchanged.
- Do not cache authenticated, dashboard, partner, form, upload, email, or
  review-submission responses. Existing explicit private/no-store headers are
  regression-tested; any adapter cache backend is scoped only after local
  parity proves it cannot widen those surfaces.
- Keep Supabase external. Do not add D1, R2, KV, Durable Objects, Cloudflare
  Images storage, or a database migration to this preparation.
- Keep GitHub Actions as the owner of the daily shop updater. No Worker cron is
  configured: a cron migration changes job ownership, UTC scheduling, and
  failure/secret operations, so it needs a separate approval.

## Required local proof and known gates

| Surface | Offline proof target | Current limitation / release gate |
| --- | --- | --- |
| Public pages and SEO | OpenNext build + local Workers preview for representative public routes and canonical redirect/header contracts | A production hostname/DNS parity check needs a separately configured account and user approval. |
| Partner login and shop editing | Existing isolated fixture through local Workers preview; keep cookies and `private, no-store` behavior | Real Supabase Auth redirect allow-list must be changed only after account/hostname approval. |
| Review entry/submission and images | Existing isolated fixture; test request handling and binary object proxying without real production media | No additional image upload or production object is authorized. Cloudflare Images is not adopted. |
| WordPress origin | Build and local route exercise under Workers Node compatibility | The application uses Node `https` with explicit SNI; Cloudflare documents HTTPS support but partial TLS support, so a real origin-safe staged proof remains required. |
| Contact email | Import/build and local dry-run route behavior | SMTP delivery is not proven without the existing non-production relay configuration. Workers block port 25; do not switch providers or issue credentials. Cloudflare Email Sending is paid and explicitly out of scope. |
| Cache/revalidation | Build and contract check retain `cacheComponents`, cache tags, `no-store`, and revalidation APIs | Durable production cache semantics need an account-neutral cache-backend selection and staged parity proof before any traffic. |
| Scheduled work | None; preserve current GitHub Actions schedule | A Workers `scheduled()` handler is a separate operational migration. |

## 2026-10-18 offline preview correction

The first local preview was run after granting loopback listening permission,
but its inherited normal build defaults read the public WordPress origin during
static generation. It made no write or secret access, and the preview was
stopped immediately after detection. The generated `.open-next/` and
`.wrangler/` directories are ignored and retained locally; they are never
committed. The checked-in scripts now force an unreachable loopback fixture
origin before every Workers build/preview. Any further runtime proof uses only
that mode or an existing isolated fixture.

## 2026-10-18 local Workers-runtime evidence

With the corrected isolated build and ignored `.dev.vars` (only dummy origin
values plus `CONTACT_FORM_DRY_RUN=true`), the local OpenNext preview produced
the following route-level evidence. The preview was then stopped; no process,
deployment, account, DNS, or remote data was retained or changed.

| Request | Result | Evidence boundary |
| --- | --- | --- |
| `GET /robots.txt` | `200`, `x-opennext: 1`, existing sitemap URL | Static public asset can be served by the generated Worker. This does not prove a production hostname or CDN policy. |
| `GET /dashboard/` | `503`, `Cache-Control: no-store`, `X-Robots-Tag: noindex, nofollow` | The existing dashboard proxy fails closed when auth configuration is absent. It does not prove authenticated middleware behavior. |
| `POST /api/contact` with valid synthetic payload | `200` and existing Japanese dry-run response | The route runs in the Worker and does not send mail. It does not prove SMTP delivery. |
| `POST /api/partner/auth/request-link` with the local same-origin header | `503`, `Cache-Control: no-store`, `X-Robots-Tag: noindex, nofollow` | Missing Supabase configuration fails closed. It does not prove magic-link, session, shop editing, or cross-shop rejection. |
| `GET /contact/` | no response before a 10-second timeout | Expected under the deliberately unreachable WordPress fixture. Dynamic public rendering is **not** proved by this isolated run. |

OpenNext emits its documented experimental Node-middleware warning for the
existing `proxy.ts`. That warning, the dynamic WordPress timeout, and the
absence of a Workers-visible isolated Supabase/Mailpit/Storage fixture mean
that login, editing, approval, review, therapist image, and email flows remain
unverified and are release blockers rather than passes.

The default adapter cache configuration intentionally remains dummy. It avoids
adding an unapproved shared binding, but it cannot establish durable,
multi-isolate tag/path revalidation semantics. Select and cost-review a
specific cache backend, then repeat private/no-store and revalidation parity in
a dedicated preview environment before any traffic is eligible for migration.

## Verification record

- `npm run test:cloudflare-workers-contract`: pass after the adapter security
  pin and after generated-worker lint exclusions were added.
- `npm run lint`: pass. The initial failure was traced to OpenNext/Wrangler
  generated files, which are now explicitly excluded alongside existing
  `.next/**`; application lint rules were not weakened.
- `npm run typecheck`: pass.
- `WP_API_BASE_URL=http://127.0.0.1:9/wp-json
  NEXT_PUBLIC_WP_BASE_URL=https://workers-fixture.invalid npm run build`: pass
  with documented fallback-only WordPress reads.
- `npm run workers:build`: pass; it generates `.open-next/worker.js` using
  Next 16.3.8, OpenNext 1.20.9, compatibility date 2026-10-18, and no account
  credentials.
- `npm audit --omit=dev --json`: zero production vulnerabilities after the
  1.20.9 pin. The repository-wide full test command was not run because its
  TLS preflight intentionally contacts the live WordPress origin; that would
  violate this offline/preproduction run's isolation boundary.

## 2026-10-18 isolated Workers fixture continuation

The internal Partner HTTP fixture now has two explicit application-runtime
modes. `next` remains the baseline. `workers` first builds the generated
OpenNext Worker on the host, then runs `wrangler dev --local` in the fixture's
app container. The existing prefix proxy remains loopback-only inside that
container; it maps `/auth/v1`, `/rest/v1`, `/storage/v1`, and GoTrue's
root-level `/verify` to the disposable network services. This does not change
the production hostname validator.

The fixture uses a random-suffix Docker `--internal` network with no published
ports, host network, Docker socket, account, or Cloudflare secret. A Linux
prepared runtime volume is necessary when re-running the Worker fixture: the
native `workerd` binary must be installed on Linux, not copied from the macOS
host. The runner treats such a prepared volume as borrowed and never deletes
it. That is test plumbing only; it is not a persistent application or
Cloudflare resource.

### Actual HTTP evidence and non-passes

| Runtime / request boundary | Result | Meaning |
| --- | --- | --- |
| Node Next, real GoTrue → Mailpit `/verify` → normal callback → session | PASS | The former root-level verification 404 is repaired. The test confirms a redirect and session identity without printing the token. |
| Node Next, canonical draft → changes requested → correction → approval → public listing | PASS | The normal Partner and dashboard HTTP routes publish the canonical revision. |
| Node Next, invalid and oversized photo rejection; PNG upload → Storage → JPEG public proxy/profile; individual review-link issuance; confirmed email change; old-email rejection; cross-store asset denial | PASS | Real fixture services and the ordinary Next runtime cover these boundaries. The review-link test issues a link; it is not a review submission/moderation proof. |
| OpenNext 1.20.9 / 1.20.11, real GoTrue/Mailpit session and Partner/dashboard listing routes | PASS through listing approval | Auth, cookie/session, API proxy, canonical editing, and dashboard approval run in local workerd. |
| OpenNext 1.20.9 / 1.20.11, `GET /shops/fixture-partner-store/` | **BLOCKED — 500** | Next 16.3.8 emits the Cache Components `setTimeout()` warning and workerd cancels the response as hung. The route first reaches cached managed-directory state; this is reproducible with the current compatible adapter rather than a GoTrue/proxy 404. |
| OpenNext 1.20.11, `POST /api/partner/therapists/photo/` invalid-image case | **BLOCKED — 500, expected 400** | `inspectListingImage` imports Node-native `sharp`. It is not executable in a Worker. A Cloudflare Images or Worker-compatible WASM conversion is an architectural/storage/cost decision and is not silently substituted here. |

The worker E2E deliberately executes the Worker-compatible API boundaries
before the public-shop assertion. This prevents an early public-render failure
from being reported as evidence that later image, email, or cross-store checks
ran. It is not a skip: the assertion remains mandatory and keeps the Worker
run failing until the compatibility problem is resolved.

The authoritative upstream issue reports the same class of Next Cache
Components/workerd hangs and describes its dependence on Node event-loop
semantics. The audited 1.20.9 pin remains in the documented peer range for
Next 16.3.8 and Wrangler 4.151.1. The compatible 1.20.11 was tested only in
the fixture: it did not alter the hang and its production dependency audit
introduced four High findings through `@opennextjs/aws` →
`@node-minify/core` → `glob`. It is therefore not adopted. No main merge,
deployment, DNS, remote cache binding, production database/Auth change, or
Cloudflare account action was attempted.

### Additional local compatibility investigation (not a workaround)

This follow-up used fresh temporary directories and a loopback-only Wrangler
server. It did not use the Eskomi proxy, Supabase, Mailpit, Storage, an
account, or any remote service. The minimal app contained only a cached value
with `"use cache"`, `cacheLife("minutes")`, and `cacheTag()`.

| Variant | Local workerd result | Decision |
| --- | --- | --- |
| Dynamic request, Cache Components, direct cached value | `500`: workerd canceled the hung request | Reproduces the public-shop failure without Eskomi route code. |
| Same cached value inside a React `Suspense` boundary | `500`: same timeout warning and cancellation | A Suspense refactor is not a safe workaround. |
| Static page with Cache Components still enabled | `500`: same cancellation | The failure is Cache Components itself, not `connection()` or authentication. |
| Plain page with Cache Components disabled and no `"use cache"` directive | `200` | This proves the Worker shell is viable, but disabling the feature would require removing the application's tag/cache semantics and is not adopted. |

The message/stack boundary in each failing variant was the Next warning about
Cache Components and `setTimeout()`, followed by the local workerd
"code had hung" cancellation. This is evidence against changing the
production hostname validator, proxy routes, Cookie/Auth behavior, or cache
security headers: none participate in the reproduction.

For the image blocker, `@jsquash/jpeg` 1.6.0, `@jsquash/png` 3.1.1, and
`@jsquash/webp` 1.5.0 were evaluated only in temporary directories. A direct
Workerd micro-test successfully performed PNG decode → JPEG encode → JPEG
decode, proving the codec can preserve the required raster conversion and
metadata-stripping property in isolation. However, importing its Wasm binaries
from this Next 16.3.8/Turbopack application makes `npm run workers:build`
fail: Turbopack treats those files as Wasm module exports while the codecs
require binary/module loading. Node's automatic codec path also cannot load
its file URL. Therefore the candidate cannot be used without a new bundling
adapter or a larger image-runtime design. It was removed completely; the
existing `sharp` validation, dimension bounds, re-encode, metadata strip, and
size limits remain unchanged. No pass-through or reduced validation path was
introduced.

### Cache backend decision for a future approved preview

Do not add cache bindings to this branch while the public page and image route
are incompatible. If those runtime blockers are resolved and an account owner
approves a preview environment, use the minimal OpenNext small-site topology:

- R2 incremental cache (`NEXT_INC_CACHE_R2_BUCKET`), with a per-environment
  prefix;
- D1 Next-mode tag cache (`NEXT_TAG_CACHE_D1`) because this application uses
  tag/path revalidation;
- a Durable-Object queue (`NEXT_CACHE_DO_QUEUE`) plus a self-reference service
  binding for deduplicated time-based revalidation;
- cache interception explicitly disabled because the site uses PPR/Cache
  Components; do not add a regional cache initially.

Workers KV is not suitable for the initial write/revalidation path because the
OpenNext guidance calls out its eventual consistency. The local `direct` queue
is preview/debug only and must never be promoted. Same-worker Durable Object
bindings are not a valid local production-parity proof; OpenNext documents
that they need a separate Worker/configuration to develop locally. Therefore a
future proof must separately show R2/D1 binding behavior locally, and queue
deduplication in an approved preview environment. Keep Partner, dashboard,
upload, email, review-submission, and all authenticated responses
`private, no-store`; no cache configuration is allowed to weaken those
contracts.

The eventual account review must price R2 storage/operations, D1 usage,
Durable Object requests/storage, and Worker requests. It must also decide
whether a Worker-compatible image transformer replaces `sharp`. Cloudflare
Images, cache purge credentials, Email Sending, Cron, paid plan selection,
and production traffic remain outside this task.

## Account actions required later (not now)

1. Create/confirm the dedicated Eskomi Cloudflare account, independent of the
   live-chat account, and install/review the GitHub integration only in that
   account.
2. Create least-privilege, project-specific deployment credentials or use the
   account's managed Git integration; never reuse an existing Wrangler login.
3. Configure preview-only variables/secrets, Supabase Auth redirect URLs, and
   any existing SMTP relay variables in that account after secret-owner review.
4. Decide whether production cache persistence, Cloudflare Images, Email
   Sending, or Worker Cron is required and approve the associated costs before
   enabling them.
5. Perform preview/staging parity, then obtain explicit approval for DNS and
   production traffic. This document does not authorize those actions.
