# Supabase public-directory migration ledger reconciliation — 2026-10-20

## Recorded mapping

The approved public read-only RPC was applied to project `goeagrxjsjcbbatpotbu`
as remote migration `20261020020548_eskomi_supabase_primary_public_directory`.
The repository source remains unchanged at
`20261019090000_eskomi_supabase_primary_public_directory.sql` (SHA-256
`a05d5f2923f7d67300103b7c8d429e6c818b1e2253ab30cc8920544b5fbd48c7`).

This difference is an execution-record mapping, not a second migration:

| Local source | Remote applied record | Rule |
| --- | --- | --- |
| `20261019090000_eskomi_supabase_primary_public_directory` | `20261020020548_eskomi_supabase_primary_public_directory` | already applied; do not apply the local source again |

No migration file was renamed, deleted, or edited. No production migration
history was rewritten.

## Mandatory future preflight

Run [the read-only preflight](../../../../../supabase/imports/migration-ledger/20261020-public-directory-rpc.preflight.sql)
against the intended project before any future schema-migration command. Its
only successful result for this mapping is:

```text
status = already_applied_do_not_apply_source
```

That result is a stop for the source file, not permission to apply it again.
`stop_ledger_drift`, multiple named records, a present old version, or a missing
remote record require a new reconciliation decision. Do not use `db push`,
manual reapply, filename renaming, or migration-history repair to work around
such a result.

The source/remote mapping and source checksum are machine-checked by:

```bash
cd headless
npm run test:supabase-primary-migration-ledger
```

## Scope

This record neither publishes data nor changes RPC behavior. It has no effect
on the separate 379-shop / 34-area / 6-page / 241-image proposal, fixed-page
media 357, Cloudflare settings, or any secret.
