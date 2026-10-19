# Eskomi Cloudflare account-readiness audit — 2026-10-18

## Scope and non-actions

This is a read-only preparation record for the dedicated Eskomi Cloudflare
account `0641c11bf1431e5ee5cd3fca94c417e2`. It records no token, credential,
secret value, private Supabase UUID, or production row. It did not create an
OAuth grant, login, API token, Worker, workers.dev subdomain, zone, secret,
DNS record, deployment, database migration, or billing change.

## Access finding

At the initial audit, the local Wrangler 4.151.1 `default` session was valid
but its account table contained only the older live-chat account
`78cb988048dcda850ba76c3ad4d96d04`. The target-specific follow-up below
supersedes that initial authentication result; the following facts either
remain unverified or require recurring pre-deployment confirmation:

| Required read-only fact | Status | Required evidence source |
| --- | --- | --- |
| Account name and exact ID | `Eskomi` / target ID confirmed by Dashboard and restricted-profile API result | Reconfirm before any deployment |
| Current Workers plan and billing eligibility | Unverified | Account Home > Plans / Workers & Pages overview |
| workers.dev subdomain and existing Worker routes | Unverified | Workers & Pages overview; do not claim or edit a subdomain |
| Existing Workers / Pages | Dashboard reports no projects; candidate Worker is absent | Reconfirm before deployment; no resource creation |
| KV / R2 / D1 / Queues resources | Unverified | Account-specific resource lists, recorded as names/counts only |
| Domains and zones | Unverified | Websites / Zones list, recorded as zones and status only |

### 2026-10-19 named-profile follow-up

The user completed the official Cloudflare consent flow for named profile
`eskomi-workers-deploy`, selecting only the Eskomi account and the approved
`account:read` and `workers_scripts:write` permissions (plus OAuth background
access). The existing `default` profile remains separate and unchanged; the
new profile is not bound to any directory and must be selected explicitly.

With `CLOUDFLARE_ACCOUNT_ID=0641c11bf1431e5ee5cd3fca94c417e2`, the new
profile made a read-only deployment-list request for `eskomi-workers-prep`.
Cloudflare returned `code 10007` / `This Worker does not exist on your
account`, not an authentication or authorization failure. This confirms that
the restricted profile reaches the target account and is consistent with the
user-provided Workers & Pages screen showing no projects. It does not prove a
paid plan, workers.dev registration, zone inventory, or deployment readiness.

### User-Mac browser connection follow-up

The authorized Mac device is online and Google Chrome is running. However, this
task session exposes only generic terminal/process inspection for that device;
it does not expose a Chrome tab, screenshot, accessibility, or browser-client
binding capable of reading the authenticated Dashboard. The required
browser-client `node_repl` surface is also not available to this task.

No browser was controlled during this audit. In particular, no user-Mac browser
session, cookies, saved passwords, local storage, or Cloudflare tab content was
opened or read. Generic remote-terminal control must not be used to bypass that
missing browser binding.

The minimum non-Cloudflare-auth setup to continue is to attach the already
running Chrome to the ChatGPT browser-control extension/session, with the
target Dashboard tab selected. That does not require creating a new Cloudflare
OAuth grant, CLI login, token, or secret. Once attached, this audit may navigate
only within the supplied account URL and read the inventory listed below.

## Read-only target-account survey

When an authorized operator has selected the target account in their existing
Cloudflare Dashboard session, collect this inventory without opening any
create, edit, deploy, rotate, or checkout flow:

1. **Account Home:** capture the displayed account name, account ID, current
   plan, and whether a paid Workers entitlement already exists. Stop if the
   displayed ID is not `0641c11bf1431e5ee5cd3fca94c417e2`.
2. **Workers & Pages:** list existing Worker and Pages project names, current
   deployment status, and assigned routes. Record whether a workers.dev
   subdomain already exists; do not create or change one.
3. **Websites:** list zones and their status only. Do not add the Eskomi domain,
   edit nameservers, create routes, or alter DNS records.
4. **Storage / bindings:** list existing KV, R2, D1, Queues, Durable Objects,
   and service bindings by name and environment. Do not read objects, table
   rows, values, or secrets.
5. **Observability:** record whether Workers observability is enabled and the
   applicable retention/plan limit. Do not open log-tail sessions carrying
   request content.

If CLI access is preferred, first ensure `wrangler whoami` lists the exact
target account. Use only documented list/get calls bound to that account, and
redact emails and all credential material from saved evidence. Do not extract
or copy the local OAuth token to use raw API calls.

## Application configuration findings

The committed Worker configuration is deliberately account-neutral:

- `headless/wrangler.jsonc` names only `eskomi-workers-prep`, its generated
  `.open-next/worker.js` entry, static asset binding, `nodejs_compat`, and
  observability. It has no account ID, route, zone, workers.dev subdomain, or
  secret value.
- The deployable source is a generated Cloudflare-only tree. Its checks require
  dynamic public reads and remove Cache Components only from that derived tree.
- Cloudflare image handling is pure JavaScript/WASM-compatible processing: PNG,
  JPEG, and WebP input, 5 MiB maximum upload, 4096px maximum dimension, and
  JPEG decode limits of 17 MP / 130 MiB. The local HTTP fixture passed formats,
  EXIF 1–8, metadata stripping, malformed input, oversized input, and display
  checks. The target account's actual Worker CPU/memory limits remain
  unverified and must be read before any pilot.
- `ESKOMI_V11_PUBLIC_REVIEW_SOURCE=supabase` switches global review readers,
  not a single pilot store. `SHOP_DIRECTORY_SOURCE=supabase` switches the
  managed directory source. Neither setting is a default or should be enabled
  during a minimum pilot without its separate global comparison gate.

## Supabase-primary readiness correction

The current branch is **not yet a WordPress-free public application**. The
configuration contract for `CONTENT_DATA_SOURCE=supabase` exists, but no
runtime route consumes `resolveContentReadPlan`; setting it would not migrate
the public site. `SHOP_DIRECTORY_SOURCE=supabase` is an overlay/new-publication
path: it still starts from the legacy WordPress shop and area readers for
existing inventory. Likewise, the v1.1 public-review flag changes review
projections, but normal shop identity is still resolved through the legacy
shop reader.

The following runtime surfaces still require a Supabase-primary implementation
before WordPress can be retired rather than treated as a compatibility source:

- home, `/shops/`, shop detail and sitemap use WordPress shop/area readers;
- area pages retain WordPress taxonomy, order, and legacy-shop lookups;
- `/reviews/` still reads WordPress posts for its editorial sidebar;
- review submission, review form, registration, and several dashboard routes
  resolve an existing shop through WordPress before using Supabase services.

`WP_REVIEW_SUBMIT_USER` and `WP_REVIEW_SUBMIT_APP_PASSWORD` belong only to the
legacy WordPress review-submit helper. No current public submit route imports
that helper; they must **not** be treated as standard Worker secrets for the
Supabase-primary target.

The minimum implementation sequence is therefore: introduce a complete
server-only Supabase public directory/content repository; switch every public
shop, area, sitemap, review-form identity, and editorial reader through an
explicit source interface; migrate and parity-check the required content; then
exercise a full dynamic Worker HTTP matrix before enabling the three global
source settings. Until then, `WP_API_BASE_URL`, `WP_ORIGIN_HOST`, and
`WP_ORIGIN_TLS_SERVERNAME` remain compatibility dependencies of the current
application, not optional deployment settings.

## Production data and pilot hard gates

The repository's redacted production reconciliation says the last observed
production migration ledger version was `20261015182000`, while the approved
branch's ordered manifest continues through
`20261018100000_partner_login_email_canonical_audit.sql`. This is a hard stop,
not a migration instruction.

Before any production write or deploy window, an authorized production operator
must complete the following in order:

1. Re-read the real migration ledger, compare it to the exact SHA
   `363f6b04a2e900e023db33ed6d753ea26bc9eba9` manifest and checksums, and stop
   for any non-prefix gap or mismatch.
2. Produce the normal migration tool's dry-run/plan for the complete ordered
   absent suffix. Do not select, reorder, or manually backfill individual SQL
   files.
3. Run a sanitized `20261015182000` baseline upgrade rehearsal and the
   read-only candidate/public-projection checks before touching production.
4. Obtain a fresh restricted read-only candidate result for Mrs.Rank UP (WP ID
   768): exactly one row must prove the immutable ID, slug, and canonical URL.
   Record `workspace_id`, `managed_shop_id`, and `app_shop_id` only in the
   restricted release record.
5. If the candidate is unbound, the separately authorized writer first binds
   the returned managed-shop/app-shop pair, re-reads it as `ready`, then maps
   the workspace exactly once. If already `ready`, it must not bind again.
   Zero/multiple candidates, a draft canonical shop, or any mismatch is a hard
   stop.
6. Keep both public-source flags unchanged for a widget-only operational pilot.
   A global review or directory switch requires a complete all-surface parity
   comparison, including zero/deny/tombstone behavior, and its own release
   decision.

## External-service and host-runtime cutover checklist

| Gate | Read-only / preparatory evidence required | Individually authorized change, if later needed |
| --- | --- | --- |
| Supabase | Ledger, schema, candidate mapping, published canonical projection, and backup/restore owner evidence | Applying the ordered migration and mapping a named pilot |
| Public readers | Baseline and parity of home, area, `/reviews/`, shop, widget, sitemap, robots, pagination, and unlisted paths | Setting `ESKOMI_V11_PUBLIC_REVIEW_SOURCE` or `SHOP_DIRECTORY_SOURCE` |
| SMTP | Secret **names/presence only**, sender-domain ownership, provider rate/egress policy, and a disposable-recipient delivery test plan | Adding/rotating SMTP credentials or enabling actual mail delivery |
| GA4 | Measurement ID is currently present in code; separately verify property ID, service-account/API access, consent policy, and outbound API reachability | Adding GA4 credentials/bindings or emitting production analytics |
| Worker runtime | Account plan CPU/memory/subrequest/request-size limits; image workload load test using synthetic 5 MiB/4096px cases; observability retention | Paid-plan change, limit increase, or production traffic routing |
| Domain and DNS | Exact existing zone ownership, target route/hostname, origin/TLS plan, and rollback hostname | Claiming workers.dev, adding a zone/route, or changing DNS/nameservers |

## Confirmations required before non-read-only operations

Existing approval to publish does not substitute for these scoped approvals:

1. A named Cloudflare account administrator must confirm the exact target
   account and authorize either a target-scoped existing session or a new
   least-privilege read-only audit path. Do not reuse the old live-chat account.
2. Any paid Workers plan change, billing profile use, or overage acceptance
   needs explicit cost approval.
3. Claiming a workers.dev subdomain, deploying a Worker, creating a persistent
   binding, setting a secret, creating/rotating access credentials, or changing
   observability data retention each needs an explicit owner and scope.
4. Any DNS/zone/route/nameserver change needs the exact hostname, zone owner,
   record change, and rollback plan approved together.
5. Any production Supabase migration, pilot binding/mapping, public-source
   flag, SMTP credential, or GA4 credential change needs the named system
   owner, exact target, and evidence/rollback boundary recorded first.

Until the target-account survey and these gates are satisfied, the only
completed result is the local Worker/HTTP QA recorded in this directory; it is
not a Cloudflare readiness or production-release completion.
