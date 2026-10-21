# Post-DB runtime approval packet — read-only inventory, 2026-10-21

This is a non-mutating inventory following the 15/50 database checkpoint. It
does not authorize a Worker deployment, secret/binding change, scheduler,
Auth/Storage/Mail change, mapping, DNS change, new credential, or external
message.

## Already usable without a setting change

- The committed Worker contract is account-neutral: `headless/wrangler.jsonc`
  defines `eskomi-workers-prep`, generated entrypoint, `ASSETS`,
  `nodejs_compat`, and observability only. It has no account ID, route, domain,
  binding, variable value, secret, or cron trigger.
- `headless/wrangler.preview.jsonc` remains a safe empty noindex preview. Its
  Supabase/WordPress endpoints are intentionally invalid placeholders and must
  not be promoted as runtime configuration.
- Supabase project `goeagrxjsjcbbatpotbu` is `ACTIVE_HEALTHY` in
  `ap-northeast-1`; the connected read-only inventory reports no deployed Edge
  Functions and no `cron.job` relation.
- Existing Storage buckets can remain unchanged: `listing-application-private`
  is non-public, 5 MiB, PNG/JPEG/WebP; `shop-images` is public, 10 MiB,
  JPEG/PNG. No bucket/object/policy was read or changed.

## Runtime inputs that exist in source but are not configured here

| Area | Names/purpose | Current evidence | Required later action |
| --- | --- | --- | --- |
| Public content reader | `SUPABASE_CONTENT_URL`, `SUPABASE_CONTENT_PUBLISHABLE_KEY`, expected shop/area/post/page counts; `CONTENT_DATA_SOURCE`, `SUPABASE_CONTENT_CUTOVER_APPROVED` | Preview contains placeholders; repository default is WordPress-safe. | Exact published-content manifest and full public parity gate, then named Worker variable setup. |
| Server Supabase transport | `SUPABASE_URL`; `SUPABASE_SECRET_KEY` (canonical), legacy `SUPABASE_SERVICE_ROLE_KEY` only if unavoidable; `SUPABASE_AUTH_PUBLISHABLE_KEY` | Names only; no value/presence check was made. | Bind only server-side after route matrix and secret-owner confirmation; never expose secret-role material to browser variables. |
| Source switches | `SHOP_DIRECTORY_SOURCE`, `ESKOMI_V11_PUBLIC_REVIEW_SOURCE` | Unset by example; both are global switches. | Separate global parity/cutover approval, not a pilot shortcut. |
| Partner Auth | `SUPABASE_AUTH_PUBLISHABLE_KEY`, `PARTNER_AUTH_REDIRECT_ORIGIN` | Hosted Auth redirect/provider/template configuration is not exposed by a read-only tool. | Confirm exact production origin, redirect allowlist, email-confirmation behavior, and a controlled test identity; do not create an account yet. |
| Storage routes | Existing bucket names above; server transport secret for upload/proxy routes | Bucket properties read; live object/policy and browser route behavior unverified. | Authorize a specific storage E2E with disposable data/identity; no policy/bucket change assumed. |
| Contact / mail | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `CONTACT_FROM_EMAIL`, `CONTACT_TO_EMAIL`, `CONTACT_FORM_DRY_RUN` | Example names only. Real provider, sender-domain ownership, and credentials are unknown. | Confirm provider, sender/recipient, egress policy, secret owner, and one controlled delivery test before disabling dry-run. |
| Access collector | `ESKOMI_ACCESS_COLLECTION_URL`, `ESKOMI_ACCESS_COLLECTION_SECRET` | Source intentionally leaves both unset; no schedule exists. | Specify caller identity, internal route, secret storage, cadence, retries and observability; then separately approve a scheduler and secret binding. |
| Dashboard / legacy compatibility | dashboard credentials and WordPress compatibility variables | Exact selected routes and current production binding presence unknown. | Produce route matrix; bind only required server-only values. |

## Mapping and publication remain separate data actions

Current production aggregate readout is: 379 published shops, zero primary-area
links, zero managed-shop `app_shop_id` links, and zero partner-workspace
`app_shop_id` links. No mapping has been inferred or written. A later mapping
packet must name the immutable WP ID + slug + app-shop-ID evidence for each
target, handle the 44 explicit primary-area records only, keep the 335
primary-null records null, and preserve all non-public exclusions.

## Cloudflare and DNS status

Historical evidence confirms the dedicated Eskomi account identifier and an
already-registered workers.dev subdomain, but the last target-bound inventory
reported no Worker named `eskomi-workers-prep`. This turn did not query a
current Cloudflare session; therefore plan/billing, current Worker/route list,
resource bindings, zones, and DNS ownership are **unknown**, not absent.

## Single later approval packet (do not apply yet)

When the missing values and route matrix are known, request one scoped approval
containing all of the following exact targets:

1. Worker account ID and Worker name; whether creation/deploy is allowed; the
   noindex preview versus production traffic target.
2. Variable/secret **names**, classification (public/server-only), source owner
   and route consumers; no value is included in the approval record.
3. Collector scheduler caller, cadence, retry/alert behavior and the one secret
   binding it may read.
4. Auth redirect origin/allowlist, email sender/provider and a disposable test
   identity/recipient; no store invitation or customer email.
5. Exact mapping manifest and its count/exclusion checks.
6. Exact zone, hostname, DNS/route delta, origin/TLS behavior and rollback
   destination. No domain or DNS action without this row.

Until then, keep WordPress/Vercel live, the Worker preview noindex, global
source switches disabled, real-mail dry-run enabled, and all unknown bindings
unset.
