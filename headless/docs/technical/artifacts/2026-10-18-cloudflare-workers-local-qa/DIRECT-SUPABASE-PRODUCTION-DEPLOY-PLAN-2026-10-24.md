# Direct Supabase production Worker — execution plan

## Purpose

Deploy the already-verified Cloudflare-derived public reader without the legacy
Vercel rewrite. This plan deliberately keeps the existing
`eskomi-workers-prep` Worker unchanged for preview and rollback comparison.

## Versioned preparation

- `wrangler.production.jsonc` names a separate Worker:
  `eskomi-workers-production`.
- The production derived bundle has no preview static `_headers` and no
  `ESKOMI_WORKERS_PREVIEW_NO_INDEX` variable.
- `proxy.ts` still marks every `*.workers.dev` hostname as `noindex,nofollow`.
  The eventual custom production hostname is therefore indexable while the
  Worker preview hostname stays excluded.
- The guarded deployment wrapper accepts only the reviewed public Supabase URL
  and publishable key, and fixes the public contract at 393 shops, 34 areas,
  zero posts, and six fixed pages. It does not accept arbitrary `--var`
  overrides, server credentials, preview flags, or Vercel proxy origin.

## Required action-time inputs

1. Confirm that the Cloudflare Zone for `mens-esthe-kuchikomi.com` is active
   and identify the exact custom hostnames to bind (`mens-esthe-kuchikomi.com`
   and, if desired, `www.mens-esthe-kuchikomi.com`).
2. Supply the existing public Supabase URL and existing publishable key only to
   the guarded command. Do not create, print, commit, or substitute a
   server/service-role key.
3. After the separate production Worker has passed its workers.dev check,
   attach the approved custom hostname route/domain and change authoritative
   DNS only under the separately approved DNS procedure. Preserve MX, SPF,
   Google verification, and other non-web records.

## Guarded deployment shape

```sh
npm run workers:production-prepare
node scripts/deploy-cloudflare-dynamic-production.mjs \
  --root <reported-derived-root> --profile eskomi-workers-deploy -- \
  --message <reviewed-release-message> \
  --supabase-url <approved-public-project-url> \
  --supabase-publishable-key <existing-publishable-key>
```

The wrapper first verifies source/config/output hashes and production provenance
before invoking Wrangler. It deploys no custom route itself.

## Verification and rollback

Before DNS changes, read the new Worker workers.dev hostname and confirm the
public page matrix, 14 preserved URLs, canonical URLs, sitemap and robots. Its
workers.dev hostname must remain `noindex,nofollow`.

After custom-domain binding, repeat the same matrix on the production hostname
and confirm absence of a global noindex header. If a public-read failure occurs,
remove or disable the custom Worker route/domain so the unchanged Vercel DNS
target resumes service. Do not delete the preview Worker or Vercel deployment.

## Explicitly excluded

No server or service-role credential, SMTP configuration, contact delivery,
Auth, Storage, collector, database migration, DNSSEC, or data change is part
of this preparation. The contact page may render, but real contact submission
remains unavailable until separately configured SMTP credentials and recipient
are approved and validated; a production Worker must not claim successful mail
delivery without them.
