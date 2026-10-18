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
