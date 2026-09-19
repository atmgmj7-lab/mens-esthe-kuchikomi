# Independent private-runtime review

Two reviewers without implementation ownership reviewed the source, private-baseline delta, tests, deployment and provisioning contract.

SPEC_COMPLIANCE: Critical0 / Important0 / Minor0.
CODE_QUALITY_SECURITY: Critical0 / Important0 / Minor0.

Resolved during review:

- Concrete production operation identities were still present in initial loader schema. Schema now uses generic behavioral kinds and validates private operation identity syntax/uniqueness; the existing special retry branch obtains its identity from the matching private record. Synthetic fixtures use synthetic identities.
- A missing private identity during a subsequent retry lookup could initially fall through to generic retry logic. It now returns WP_Error before comparison, and reuses the captured identity for the contract map lookup. A deterministic pure-validator regression proves that it refuses before downstream WP reads. No coverage write/reconcile executed.

Required answers:

1. Actual recovery record values absent from candidate Git source: YES; final staged privacy scan PASS.
2. Private manifests absent from candidate Git source/stage: YES; excluded and rejected by stage validation.
3. Missing private config fails closed: YES, at route entry and subsequent special-retry lookup.
4. Manifest mismatch fails closed: YES, private regular-file checks, size bound, digest and identity validation; original complete manifest business validator retained.
5. Behavior equivalent with current private values: YES for the exact normalized record objects, both manifest digests and preserved business source. Full production operation execution intentionally not performed.
6. Coverage writer safe to source-control: YES after extraction and reviewed corrections.
7. Deployment reproducible: YES with separately approved private provisioning described in PROVISIONING.md. Preflight checks before any runtime transfer and again before functions.php. Production readiness is not claimed.
8. Price/Web booking foundation intact: YES, runtime PHP unchanged and focused, full-suite and isolated SQL regressions PASS.

Other live behavior is preserved; no duplicate declarations/routes appear when both writers load. No private record or credential was imported into the staged source. Existing live backup `functions - copy.php` is not referenced by the downloaded runtime source and is not an auto-loaded WP theme file; it remains outside source adoption. No coverage business operation, permission, CAS/update/delete implementation, audit hook or manifest digest was redesigned.
