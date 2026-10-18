# Internal Auth + Storage fixture QA artifact

## Implemented plan

1. Create uniquely named, disposable Docker resources on `docker network create --internal`.
2. Start a fresh PostgreSQL 17 fixture with only temporary GoTrue, Storage, and PostgREST roles.
3. Start official local GoTrue, Storage API, Mailpit, and PostgREST images without publishing any host port.
4. From a Node client attached to the same internal network, request a GoTrue email OTP, read the Mailpit message, consume either its OTP or confirmation link, prove the resulting session at GoTrue `/user`, and confirm the consumed OTP/link cannot create a second session.
5. Using the separately generated fixture service-role credential, create, upload, and retrieve a private Storage decoder-valid 1×1 PNG; compare MIME type and retrieved bytes with the uploaded fixture.
6. Remove only resources created by the runner.

## Result

Executed from `headless/`:

```text
npm run test:eskomi-v11-internal-auth-storage-runner
Eskomi v1.1 internal Auth/Storage runner safety contract: PASS

npm run qa:eskomi-v11-internal-auth-storage
GoTrue Mailpit verification, session /user identity, and consumed-token rejection: PASS
Storage service-role valid PNG MIME and byte-for-byte retrieval: PASS
Eskomi v1.1 internal Auth/Storage fixture: PASS
```

The test used a fresh fixture database and generated credentials only. It published no host ports, used no host network or socket mount, contacted no external SMTP service, and did not access the existing local stacks or production.

## Scope boundary

This proves the bounded real service path: GoTrue email delivery to local Mailpit, a verified session whose `/user` identity matches the fixture email, rejection of a consumed OTP/link, and a **service-role** Storage API write/read of a valid PNG. It does not claim that an authenticated partner user has Storage object rights; that is covered only by the separate normal Next partner-flow fixture. It does not claim browser QA, production migration, deployment, or production data verification.
