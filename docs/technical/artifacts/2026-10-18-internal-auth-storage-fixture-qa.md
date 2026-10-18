# Internal Auth + Storage fixture QA artifact

## Implemented plan

1. Create uniquely named, disposable Docker resources on `docker network create --internal`.
2. Start a fresh PostgreSQL 17 fixture with only temporary GoTrue, Storage, and PostgREST roles.
3. Start official local GoTrue, Storage API, Mailpit, and PostgREST images without publishing any host port.
4. From a Node client attached to the same internal network, request a GoTrue email OTP, read the Mailpit message, consume either its OTP or confirmation link, then create, upload, and retrieve a private Storage image.
5. Compare retrieved bytes with the uploaded fixture bytes and remove only resources created by the runner.

## Result

Executed from `headless/`:

```text
npm run test:eskomi-v11-internal-auth-storage-runner
Eskomi v1.1 internal Auth/Storage runner safety contract: PASS

npm run qa:eskomi-v11-internal-auth-storage
GoTrue email OTP via Mailpit capture and verification: PASS
Storage fixture image write and byte-for-byte retrieval: PASS
Eskomi v1.1 internal Auth/Storage fixture: PASS
```

The test used a fresh fixture database and generated credentials only. It published no host ports, used no host network or socket mount, contacted no external SMTP service, and did not access the existing local stacks or production.

## Scope boundary

This proves the bounded real service path: GoTrue email delivery to local Mailpit, actual email-confirmation consumption, and Storage API object byte retrieval. It does not claim browser/Next partner-flow QA, production migration, deployment, or production data verification.
