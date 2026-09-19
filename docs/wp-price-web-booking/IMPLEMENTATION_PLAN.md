# Price / Web booking foundation implementation plan

Baseline: 16a402215b293b7e31b96d89d9c5089b26c88ecd. Isolated branch codex/wp-price-web-booking-schema-writer-foundation-01. Production mutation/push/deploy prohibited.

1. Read-only ACF source audit; retain DB management and prepare exact single-field schema artifact. Reuse price_90; select shop_booking_url after naming audit.
2. Adopt the byte-matched deployed dedicated writer/projection into this branch (they are missing from origin/main); extend only two allowed updates after focused failing tests. Preserve transaction/CAS/readback/receipt rollback.
3. Narrow public price/booking REST projection with fail-first fixtures; never expose the whole hidden price group.
4. Reuse the production TypeScript canonicalization/hash helper for exact payload construction, keeping every existing aggregate contributor evidenced and snapshot-bound.
5. Run focused fixture tests, related frontend regressions, final lint/typecheck/build; distinguish fixture proof from live WP runtime.
6. Independent specification and security/quality review; fix important findings; commit explicit files only after validation. Prepare deployment/schema/canary/readback/rollback plan and stop before production operations.

Parallel ownership: schema/projection, offline provenance/reader, dedicated writer/transport integration. Final independent reviews are separate from implementation ownership.
