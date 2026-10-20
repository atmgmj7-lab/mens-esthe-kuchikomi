# Publication proposal v4: required deltas and Cloudflare handoff — 2026-10-20

## Decision

`20261019-publication-manifest-v4` (SHA-256
`b0ff37c97d707221b706796ed75c813233831b19ca772d704c4958dfe56f1955`) is
still `proposed` / `not-approved` / `blocked`. It is an inventory, not a
production apply plan. The current production projection is empty: 0 published
shops, 0 published areas, 0 published pages, and 0 public shop images.

## What v4 names, and what it still lacks

| Target | v4 inventory | Required production delta | Missing prerequisite / reason v4 alone cannot apply |
| --- | ---: | --- | --- |
| Shops | 379 | Conditional `app.shops` publication of the exact existing `wp_post_id` set | One reviewed immutable approval manifest, current-row/hash snapshot, and restore predicate. Do not create the 14 WordPress-only records or publish 1272/1255/1259. |
| Areas | 34 | Conditional `app.areas.is_published=true` for the exact `wp_term_id` set | Coupled to shop approval and sitemap parity; no primary-area inference. The optional 44 explicit primary relations remain a separate approved delta. |
| Fixed routes | 6 | Insert/reconcile six `app.contents` rows, then publish them | Production `app.contents` currently has 0 rows. Five routes need captured canonical WordPress content and provenance; `/advertise/` needs an explicitly approved application-owned canonical body. A status flag cannot create missing content. |
| Shop images | 241 | Conditional `app.shop_images.is_public=true` only | Re-read all 241 exact media IDs and assert their existing Storage URLs/checksums are still the approved target set. No URL replacement, upload, or `app.shop_images` insert is part of v4. |
| Fixed-page media | 357 | A separate no-overwrite Storage copy and an approved `/osaka-nihonbashi/` HTML reference update | Media 357 is PNG page media, not one of the 241 shop-image rows. It needs its own batch, public readback (MIME/bytes/SHA-256), and conditional content update after the fixed page exists. |

The 6-page route allowlist is `/contact/`, `/about/`, `/sitemap/`,
`/storelisting/`, `/advertise/`, and `/osaka-nihonbashi/`. The page-content
source gap is a hard cutover blocker even if every visibility flag is approved.

## Required pre-apply evidence

1. Re-run the v4 read-only preflight against production; it must still match
   the exact 379 / 34 / 241 target sets and all exclusions.
2. Capture an immutable, owner-approved content import manifest for the six
   routes, including source/provenance, title, sanitized body/body text, route,
   content type, checksum, and conditional restore predicate.
3. Keep the 241 row URLs unchanged and validate the fixed-page 357 source SHA
   before a distinct no-overwrite upload.
4. Reconcile expected primary-source configuration counts only after the
   final publication manifest exists: shops `379`, areas `34`, posts `0`, pages
   `6`. Until then, leave `CONTENT_DATA_SOURCE=wordpress` and
   `SUPABASE_CONTENT_CUTOVER_APPROVED=false`.
5. Run an approval-scoped restore rehearsal and real HTTP parity for home,
   shops, areas, detail, sitemap, the six pages, reviews, and an unlisted shop.

## Cloudflare: existing read-only result

The existing named profile `eskomi-workers-deploy` reached account
`0641c11bf1431e5ee5cd3fca94c417e2`. Read-only `deployments list` and
`secret list` both returned that Worker `eskomi-workers-prep` does not exist.
Therefore there are no Worker settings or Secret *names* to inherit, and no
value was read. No Worker, route, DNS entry, secret, binding, or billing change
was made.

## Minimum later manual setup (not performed)

| Console screen | Name / setting to enter or confirm | Why it is needed |
| --- | --- | --- |
| **Workers & Pages → Create Worker → Settings** | Worker name `eskomi-workers-prep` (or a separately approved production name) | Creates the runtime target; the current account has none. |
| **Workers & Pages → Worker → Settings → Variables and Secrets** | `SUPABASE_CONTENT_URL`, `SUPABASE_CONTENT_PUBLISHABLE_KEY`, `CONTENT_DATA_SOURCE`, `SUPABASE_CONTENT_CUTOVER_APPROVED`, `SUPABASE_CONTENT_EXPECTED_SHOPS`, `SUPABASE_CONTENT_EXPECTED_AREAS`, `SUPABASE_CONTENT_EXPECTED_POSTS`, `SUPABASE_CONTENT_EXPECTED_PAGES` | Needed only for the fully approved Supabase primary-content cutover. Enter the publishable key directly in the UI; do not add any server secret to browser-visible variables. |
| **Workers & Pages → Worker → Settings → Variables and Secrets** | Existing server-only dependencies required by the selected routes, confirmed by name/presence only: `SUPABASE_URL`, `SUPABASE_SECRET_KEY` (or legacy `SUPABASE_SERVICE_ROLE_KEY` only where still required), `SUPABASE_AUTH_PUBLISHABLE_KEY`, `SHOP_OWNER_REQUEST_RATE_LIMIT_SECRET`, SMTP variables, dashboard credentials, and WordPress compatibility variables | The generated Worker must not silently lose routes that still use these server-only paths. Register only the values needed by the final route matrix; do not copy every local development variable. |
| **Workers & Pages → Worker → Settings → Variables and Secrets** | Leave `ESKOMI_V11_PUBLIC_REVIEW_SOURCE` and `SHOP_DIRECTORY_SOURCE` unset until their separate global parity/cutover gates pass | Both are global source switches; they are not required to create the Worker and must not be enabled merely because the RPC exists. |
| **Workers & Pages → Worker → Settings → Domains & Routes** | Do not add a route or custom domain during preview. Later, specify the exact hostname, zone, origin/TLS plan, and rollback target in one approved DNS change | Workers.dev and DNS routing are distinct. This task did not create either. |

The committed `wrangler.jsonc` supplies the Worker entry, asset binding,
`nodejs_compat`, and observability declaration. It intentionally contains no
account ID, hostname, route, zone, or secret. The local Worker transport issue
and real-host parity remain separate release gates.
