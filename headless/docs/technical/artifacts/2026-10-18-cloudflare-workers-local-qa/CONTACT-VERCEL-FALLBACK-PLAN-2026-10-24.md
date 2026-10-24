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
