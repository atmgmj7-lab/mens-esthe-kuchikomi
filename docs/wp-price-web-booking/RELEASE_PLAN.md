# Release / canary plan — NOT EXECUTED

Task: WP-PRICE-WEB-BOOKING-SCHEMA-WRITER-FOUNDATION-01
Baseline: `16a402215b293b7e31b96d89d9c5089b26c88ecd`.
No main push, deployment, production schema mutation, shop write, or rollback is authorized by this artifact.

## Code provenance and deployment boundary

The deployed `official-facts-rest.php` and `official-facts-projection.php` were missing from baseline Git. They matched the earlier dedicated writer worktree byte-for-byte. Adopted baseline SHA-256:

- official-facts-rest.php: `78fabfad65d1fe455709cf35a3bae713150adafa1f80e15eaaacb11ce97d6885`
- official-facts-projection.php: `205bb2a40635d13f83ebbdf98a5d5c25e91695117388d920e75482b9f9635fa5`

This is an extension of that same restricted endpoint and transaction implementation, not a new direct-meta or SQL bypass. The existing transaction-internal SQL storage implementation is retained. The daily update endpoint is untouched.

The final commit also includes both runtime includes in functions.php and the three files in the existing Xserver dependency validation list. Existing CI's Xserver SSH connectivity blocker still requires live preflight; local tests do not prove deployment. The release artifact must include the child theme files together, not only the functions.php include. No independent reader/UI deployment is required by these PHP-only runtime changes.

## Ordered operations with separate approval gates

1. **Exact code release preflight:** fetch origin, compare relevant code to approved commit, require clean contract paths. Re-read deployed hashes, ACF source keys/groups and 58/25 population. Save rollback copies of current child theme files including actual deployed functions.php (not baseline Git). Review the full candidate diff against LIVE as well as Git because the dedicated writer existed outside main. Obtain exact main-push / deployment approval. Confirm the Xserver upload mechanism works; do not infer success from Vercel alone.
2. **Approved code deployment:** atomically stage child theme includes/dependencies using the existing deployment workflow. This activates the narrow public projection and writer support. It exposes existing valid physical price_90 values; these are legacy public prices, NOT newly verified official facts. No prices are backfilled or stamped reviewed. Keep the hidden price group's show_in_rest=0. Native shop REST writes of the two targets are now rejected; approved writes use the dedicated endpoint.
3. **Separately approved ACF DB schema activation:** execute the exact bounded single-field procedure in `../wp-price-web-booking-schema-foundation.md` using `../schema/shop-booking-url-field.json`. Create only `field_escomi_shop_booking_url_v1` in group66. Record new field ID, before/after definitions and untouched group fields. Never reimport/replace whole groups.
4. **Read-only runtime verification:** GET and OPTIONS `/wp-json/wp/v2/shop/{id}?context=view`; compare acf.price_90 with sanitized physical value and verify null booking before data exists. Check response/schema additions are exactly the two targets and old properties unchanged. Verify hidden other-duration prices remain unexposed. Verify list/embedded responses as well as single-shop responses. Test installed WP/ACF internal GET dispatch state; local fixtures do not certify the real plugin lifecycle.
5. **Zero-write validation:** use fresh dedicated GET snapshots and current public REST data. Build a candidate via buildWriterPayload, review fieldAudit and category constituent evidence, call the deployed validator in a read-only WP CLI invocation if authorized, never the apply handler. Verify full expected snapshot, provenance, URL purpose and source hashes. The Python client's default LOCAL_PREFLIGHT_ONLY checks artifact hashes/identity/code revision; it is NOT a server-side dry-run and is not a substitute for this validation.
6. **One canary, separate explicit shop-write approval:** prepare the exact data-bearing batch described below, obtain approval of shop ID+slug, old/new values, provenance, code SHA and artifact hashes. Execute with the existing client and a new mode0700 journal. Never retry a lost/ambiguous POST. Reconcile via read-only GET first.
7. **Readback/public QA:** verify response identity, APPLIED/NOOP state, signed receipt, exact complete raw snapshot via dedicated GET, public projection, and canonical/hash recomputation using the actual Next reader. Confirm existing LINE/phone raw values and evidence history preserved; remaining categories unchanged. Recheck 58/25, after-midnight22/9, LINE19/5, featured712/768, ordering, comparison max3, prefill4 and SEO/schema. A new verified booking aggregate must include current LINE/phone evidence, not overwrite it from a URL-only source.
8. **Resume research only in the subsequent task:** the present task stops at local foundation complete. The 83-Area-row official-site enrichment audit is not resumed here.

## Canary proposal

Preferred: **one published shop, one price_90 and one shop_booking_url** in a single dedicated transaction, plus the required price/booking provenance records. Shop and values are deliberately unselected until current official evidence exists; no fake canary price/URL is proposed. Select a shop whose official page supports an exact standard90 price and an explicit booking link, and whose existing displayed price/LINE/phone constituents can all be evidenced under the current same-source/date aggregate contract. If this cannot be satisfied safely, use the smallest separated two one-field transactions on individually evidenced shops, separately enumerated for approval. Target count is not permission to invent evidence.

Approval packet must contain exact ID, slug, current Area membership, complete existence/value snapshot, old/new strings, source URL/host, observed/reviewed dates, price duration/type, source-to-reservation purpose/link proof, canonical strings/hashes, immutable evidence archive, code SHA and hashes of payload/plan/rollback artifacts. No production write is executable until those values are real and approved.

Rollback: journal the server's original signed receipt before continuing; retain original evidence alongside expected snapshot. With separate rollback authorization, POST `/escomi/v1/official-facts/rollback` with exact `batch_id,wp_id,slug,receipt`. The HMAC receipt binds before/after/touched fields; stale-current snapshot must reject rather than overwrite later edits. Verify restored raw values AND existence flags (including originally absent booking key), public projection and original provenance/hash. If response is lost, do not replay blindly. Schema/code rollback is separate and only after data state is resolved.

## Contract constraints

- price_90 input is a positive decimal string of at most7 digits; no format/storage migration, empty deletion, other duration, campaign or FROM evidence.
- Booking is an exact absolute HTTP(S) URL in the server's conservative ASCII subset (query retained); credentials, IP/local hosts, fragments, control encodings, LINE links and unsupported serialization forms fail closed. Upstream evidence establishes identity and reservation purpose. Unsupported legitimate URLs stay unresolved for a later contract change, never guessed/rewritten.
- Public category hashes use the production canonicalizeShopFactValue/hashShopFactValue. Price verification derives visible keys from a real internal shop GET, while full physical prices remain locked by CAS. Missing public projection fails closed.
- Existing aggregate provenance has one source/date tuple. Every displayed constituent requires matching reviewed evidence; mixed-source/date aggregates are blocked. Historical evidence survives in the exact expected snapshot and signed receipt; fieldAudit retains per-constituent evidence offline. No new hash scheme or blanket verification stamp.
- Production runtime validation, approved schema activation, and the data canary are PENDING. Local MariaDB uses real InnoDB with WP boundary shims; it is not a full WordPress/ACF installation.
