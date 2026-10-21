# Store onboarding E2E and restoration gaps — 2026-10-21

This is a read-only readiness record. It does not authorize production DDL,
mapping, backups, external export, secret creation, scheduler setup, or deploy.

## Existing public directory versus Partner onboarding

These are separate populations and must not be joined by name similarity.

| Scope | Read-only evidence | What is still required |
| --- | --- | --- |
| Existing public directory | `app.shops`: 379 published, 3 draft. The previously applied primary-directory reader includes a published shop without an area under its stable canonical detail URL. No published shop is currently suppressed by a non-published managed identity. | Runtime cutover and public QA remain unperformed. Keep drafts and stopped/non-public records excluded. |
| Area routing | Of 379 published shops, 304 have at least one published area link; 75 have none. There are 0 primary-area links and no shop has multiple primary links. | Do not invent a primary area. Define an evidence-backed policy and review the 75 area-less public shops before any area-dependent feature is represented as complete. |
| Managed projection | `private.managed_shops` has one unlisted row and zero published rows in the current production schema. | Existing 379 public directory records do not need a managed projection merely to remain public. A projection is required only for canonical managed/Partner v1.1 workflows and must be created through the reviewed lifecycle. |
| Partner workspace migration | Three legacy workspaces each match an `app.shops` record by exact `wp_shop_id + shop_slug`; none matches a managed-shop identity. | They are candidates only. An operator must review an explicit manifest of workspace UUID, WP ID, slug, app-shop UUID, intended managed-shop UUID, and actor label before any projection or mapping DML. |

## Verification matrix

| Surface | Evidence | Status |
| --- | --- | --- |
| 51-source migration chain and exact mapping guard | Disposable Postgres 17, artificial data only; full chain and out-of-scope workspace rejection passed. | PASS, synthetic only |
| Worker build | `npm run workers:build` exit 0; no deploy. | PASS, build only |
| Review repository, submit, moderation, public adapter/UI, growth | Local source-contract checks. | PASS, not production RPC |
| Partner auth/membership, dashboard, Growth Kit/Center, widget, launch, canonical registration and email-management UI contracts | Local source-contract checks. | PASS, not real Auth/Mail |
| Community and review-entry v2 UI contract | Local source-contract checks. | PASS, not browser E2E |
| Internal proxy, POP/QR, widget HTTP | Loopback/mock-RPC checks. | PASS, synthetic transport |
| Review-entry browser E2E | Playwright binary absent; normal install retried with `/tmp` cache but official Playwright CDN returned `403 Domain forbidden`. | BLOCKED; no mirror or Mac browser used |
| Auth magic link, email delivery, Storage objects, full Partner HTTP flow | Official Supabase Mailpit image request previously returned `403 Forbidden` from `public.ecr.aws`. Both runners require that image. | BLOCKED; no alternate registry/image used |
| Review-native isolated DB E2E | Requires a local Supabase runtime/database, which is not present in this cloud. | UNRUN |
| Production anonymous/authenticated/service-role boundaries | Needs post-DDL RPC/Data API calls against a controlled approved target. | UNRUN |
| Cloudflare runtime, collector secret and scheduler | Requires existing Eskomi runtime config and action-time confirmation. | UNRUN |
| Public production browser, DNS, real mail and actual store onboarding | No production cutover or external invite/email was performed. | UNRUN |

Passing source, mock, or synthetic checks is not proof that a store can be
onboarded in production.

## Free-plan restoration gate

The organization is on a free tier. The management API does not provide a
project-specific PITR/backup inventory, and a free-tier migration therefore
needs an explicit manual recovery package before DDL. A logical database dump
alone does not include Storage object bytes.

### Required package, created only after approval

1. A timestamped, encrypted, access-controlled logical export of the production
   database. Scope must include the application schemas (`app`, `private`,
   `api`), migration ledger, RLS policies, functions, triggers, extensions,
   grants, and the relevant `auth` and `storage` schemas when they contain
   onboarding state. The export must not be committed to Git or placed in this
   shared cloud workspace.
2. A separate encrypted Storage export: bucket inventory, object metadata, and
   object bytes with count/size/checksum manifest. Database backup alone cannot
   restore those bytes.
3. A non-secret configuration inventory: deployed commit, migration SHA-256
   manifest, Edge/Worker/function names, and runtime variable **names**. Keep
   secret values in the existing secret manager; do not export or print them.
4. A roles/ACL inventory: role names, memberships, grants, RLS enabled state,
   policies, default privileges, and API schema exposure. Role password hashes,
   service keys, JWT secrets, and SMTP credentials are not collected into the
   evidence record.
5. A restore owner, encrypted destination, retention period, checksum verifier,
   and a written rule for who can decrypt. The destination must be an existing
   user-approved encrypted store; creating a new paid service is out of scope.

The package contains sensitive data: customer/partner contact details and
Auth identities, review/community content, owner requests, hashed abuse and
idempotency material, store operational information, and possibly media bytes.
Use least-privilege access, encryption at rest and in transit, no public links,
and a retention/deletion record.

### Rehearsal and rollback

- A restore rehearsal may use an operator-controlled isolated PostgreSQL/Docker
  target with no production network access and no external email delivery. Do
  not import an unsanitized production dump into this shared cloud environment.
- Database restore validates schema, data counts, migrations, functions, RLS,
  grants, and selected role behavior. Storage restore validation also needs the
  encrypted object archive and checksum manifest; it cannot be inferred from
  `storage.objects` metadata.
- The 50 migrations contain no complete down-migration set. Treat the verified
  recovery package as the rollback mechanism. A partial migration failure must
  stop release, preserve the applied-ledger evidence, and restore to the
  pre-release snapshot or receive a separately reviewed forward-fix packet.
- Scope data-changing migration effects before release: `17172000` seeds access
  observation rows and marks unprovable legacy community appeals for review;
  `17173000` converts prior `observed` access rows to `missing` and writes
  corresponding community audit events. The workspace/managed mapping remains
  a separate, later exact-ID operation.

## Release blockers

1. Manual recovery package and isolated restore rehearsal evidence.
2. Approved exact manifest for each of the three mapping candidates; no fuzzy
   matching and no automatic creation/publishing of managed projections.
3. A primary-area policy and review of the 75 published shops without area
   links before area-dependent or global-review features are advertised.
4. Real Auth/Mail/Storage/browser E2E in an approved environment, or explicit
   risk acceptance for each blocked surface.
5. Separate action-time confirmation for new runtime secret/scheduler, any
   Data API privilege/revoke change, Cloudflare deploy, and DNS.
