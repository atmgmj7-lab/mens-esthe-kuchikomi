# Contact-only Vercel fallback — implementation and activation plan

## Purpose

Keep the existing Vercel mail handler as the sole mail-delivery path while
the public site is served directly from `eskomi-workers-production`. This is
not a site-wide Vercel proxy and does not change the sender, recipient, SMTP
provider, or any contact payload.

## Verified preconditions

- The retained Vercel production deployment and its stable
  `escomi-headless-narikiyos-projects.vercel.app` alias are both `Ready`.
- Anonymous `GET /contact/` and `OPTIONS /api/contact/` to that alias return
  a Vercel SSO-protection redirect. The alias cannot be used anonymously by a
  Worker.
- The public hostname must never be a fallback origin: after Cloudflare DNS
  cutover it would route back to this Worker and recurse.
- Existing Vercel production has contact SMTP, sender, recipient, and dry-run
  environment variable names. Their values were not retrieved.

## Prepared code contract

### Production deploy guard

The production deploy wrapper accepts the fallback origin only through
`--contact-vercel-fallback-origin`. It rejects every origin except the reviewed
fixed Vercel alias `https://escomi-headless-narikiyos-projects.vercel.app` and
keeps arbitrary `--var` overrides rejected. This preserves direct Supabase
delivery for every route except the explicit server-side contact fallback.

- `CONTACT_VERCEL_FALLBACK_ORIGIN` is accepted only when it is exactly
  `https://escomi-headless-narikiyos-projects.vercel.app` without a path,
  query, fragment, or user info.
- `CONTACT_VERCEL_PROTECTION_BYPASS` is required as well. Without both values
  the fallback is disabled and the normal contact route behavior is retained.
- The only remote URL is the fixed `/api/contact/` endpoint. Redirects are
  rejected. No browser CORS permission is added because the Worker makes a
  server-to-server request.
- The incoming request must have an `Origin` matching `Host`; cross-origin
  form posts are rejected before validation or forwarding. `cf-connecting-ip`
  is preferred and the user-supplied `X-Forwarded-For` value is not propagated.
- The fallback returns only the upstream JSON `ok` and `message` result. It
  forwards neither response headers nor cookies and logs no payload or token.

## 2026-10-24 non-delivery path comparison

No normal contact POST or email delivery was used for this diagnosis.

- The normal `POST` handler and the former non-delivery probe both obtain the
  fallback exclusively through `resolveContactVercelFallback(process.env)`.
  The application has no `getCloudflareContext` call on this path.
- OpenNext's Worker initializer writes string bindings into `process.env`
  before it runs the request inside its AsyncLocalStorage context. Therefore
  this route has no separate async-context binding lookup to distinguish the
  normal handler from the probe.
- `check-contact-vercel-fallback-route.mjs` now compiles the actual resolver
  and actual route handler. With only fixture values in `process.env`, it
  proves the validated normal payload uses the fixed `/api/contact/` URL,
  `POST`, `redirect: "error"`, the protection-bypass header, the fixed Vercel
  `Origin`, normalized JSON, and the Cloudflare client IP. It also proves no
  local SMTP transport is constructed while the fallback is enabled.
- The route-level 503 outcomes are deliberately distinct in that test:
  non-JSON upstream response -> generic 503; rejected Worker-to-Vercel fetch
  -> generic 503; JSON upstream 503 -> its JSON message/status is preserved;
  disabled fallback plus missing local SMTP -> the separate local production
  SMTP 503 without any fetch. Local SMTP delivery failures use a separate
  500 return, not either 503 branch.

This narrows a generic 503 from a valid production submission to the
fallback's rejected-fetch/non-JSON handling unless the fallback was disabled;
it does **not** establish which case occurred for a historical real request.
The previous invalid-payload probe established a protected Vercel 400 JSON
path only, not valid-mail delivery. A future delivery test must correlate a
sanitized upstream status/content-type with its request and must not be
repeated automatically.

## 2026-10-24 production-safe failure classification

The Worker logs only on a contact fallback failure. It does not add a probe,
public diagnostic route, or any response detail. The client still receives the
same generic response.

Each log is a fixed event code and an allowlisted metadata object only:

- `contact_fallback_disabled`
- `contact_fallback_fetch_exception` with a fixed error-name allowlist
- `contact_fallback_upstream_non_json` with status, normalized media type, and
  an allowlisted Location hostname/path only
- `contact_fallback_upstream_json_503` with the same sanitized upstream
  metadata

No event records payload fields, client IP, credentials, binding values,
headers, error messages, full URLs, or Location queries. The route contract
uses mocked upstream responses to prove both each event and this redaction.

## Required separate authorization before activation

1. Confirm use of an **existing** Vercel deployment-protection bypass secret
   solely for this endpoint, or authorize creation of such a secret if none
   exists. Do not send its value in chat or commit it.
2. Authorize registering the two named bindings above only on
   `eskomi-workers-production`; the bypass value must be a Cloudflare Worker
   secret, not a plaintext variable.
3. Authorize one controlled delivery test to a specifically approved
   disposable recipient after the custom hostname is attached. Until that
   test passes, DNS cutover must not claim contact delivery works.

## Activation and rollback

1. Confirm the current Vercel alias is still `Ready` and the protection bypass
   returns JSON from the contact route without following redirects.
2. Add the two bindings to `eskomi-workers-production`, deploy the reviewed
   code, and exercise only the approved controlled test.
3. On failure, remove the two contact fallback bindings or roll back the
   Worker version. This does not change DNS, the Vercel deployment, or its
   SMTP configuration.
