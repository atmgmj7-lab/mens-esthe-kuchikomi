# Eskomi v1.1 pre-production QA P1 remediation

## Scope

- Use only the disposable PostgreSQL/PostgREST/Next/Chromium environment.
- Do not mutate production Supabase, deploy, merge `main`, create credentials, or map the three legacy workspaces.
- Verify the review submission flow and the supported local HTTP/browser path; record any environment restriction as a blocker.

## P1 corrections

1. Replace the fixed 23:00 JST context expiry with a 30-minute expiry capped by the following JST midnight; test 22:59, 23:00, 23:59, and 00:00 JST.
2. Treat signed contexts as server-issued but not sufficient abuse protection. Limit short-lived context issuance by signed session and, only behind the trusted hosting proxy, by an HMAC network signal. Do not store raw IP or claim complete prevention.
3. Accept independently minted first sessions so concurrent first-context responses (including two tabs) remain valid. Serialize issuance within one client tab as an additional optimisation.
4. Compare 7/28/90-day reports through yesterday only; return today separately as provisional. Show recorded counts separately from whether the complete-period comparison is valid.
5. Remove WordPress update-job completion as evidence that access measurement completed. Without an independent collector health run, state remains unknown. Expired short-lived rows are removed only if the finalizer/pruner runs successfully; stale rows and missing finalization are operational signals.
