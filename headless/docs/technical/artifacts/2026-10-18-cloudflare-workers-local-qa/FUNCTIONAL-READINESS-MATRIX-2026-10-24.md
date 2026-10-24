# Functional readiness matrix — 2026-10-24

This records only observed checks. A contract or fixture result is not an
assertion that a protected production workflow has been exercised.

| Function | Evidence completed | Status | Remaining activation check |
| --- | --- | --- | --- |
| Public directory, area, shop pages, sitemap, canonical, robots | Workers staging HTTP checks previously covered 393 shops, 14 preserved URLs, 404, widget and `workers.dev` noindex; direct-production and deploy guards pass locally | **HTTP completed** for staging; custom-domain HTTP pending | Bind custom host after NS delegation, then repeat on apex and `www` with no global noindex |
| Public reviews and widget reader | Public reader/widget contracts pass; staging widget empty-state HTTP was previously checked | **fixture + staging HTTP** | Check a real approved-review widget after a permitted fixture or real content is available; do not create review data only for this |
| Store-management login and membership | Partner membership contract and shop-owner API contract pass | **fixture only** | Configure and test real Auth redirect/session plus named test account; no user/account created yet |
| Listing information update and approval | Partner listing editor, owner request and managed area/source contracts pass | **fixture only** | Configure server-only management bindings and test one authorized workspace without changing public data |
| Review submit, moderation, publication, edit safety | Native submit, moderation, public adapter/UI, entry-v2, and low-friction review contracts pass | **fixture only** | Real Auth/session, controlled pending review, moderator approval, public-only result and withdrawal test |
| Coupon/benefit flow | v1.1 first-pilot gate and review-entry-v2 contracts cover the benefit-code submission boundary | **fixture only** | Configure the required protected runtime and run a controlled benefit redemption test; no production benefit was issued |
| Community and corrections | Community UI/review-edit safety contract passes | **fixture only** | Configure authenticated actor/session and test one controlled post/report/correction lifecycle |
| Image/Storage | Listing-application migration Storage boundary passes; previously recorded local image contract tests covered format/EXIF/metadata rejection | **fixture/local contract only** | Configure Storage and Auth, then perform controlled upload/read/authorization/rejection lifecycle |
| Contact form | Page HTTP GET works; fallback contract and same-origin/IP controls pass locally | **not activated** | Explicitly authorize bypass-secret handling and a named test recipient; confirm the retained Vercel handler returns JSON and one controlled delivery succeeds |
| Mail | No real message sent | **configuration pending** | Provider, sender, recipient, protection-bypass scope, and controlled recipient must be explicitly approved |
| DNS/custom domain | Xserver and both assigned Cloudflare authorities return equal apex/www/wildcard A, MX, SPF and Google TXT records; public delegation remains Xserver | **delegation ready, not changed** | Registrar NS change, wait for public delegation/TLS, bind Worker custom hosts, then production HTTP matrix and rollback check |

## Required deployment-order checks

1. Keep the current Vercel deployment available as rollback.
2. Change only registrar delegation after confirming Cloudflare zone records
   remain equal to the observed Xserver set.
3. Confirm public resolvers return `dean.ns.cloudflare.com` and
   `macy.ns.cloudflare.com`, then wait for Cloudflare zone activation/TLS.
4. Attach the Worker custom hosts only after the contact path has an approved
   delivery strategy. A direct SMTP implementation is not treated as verified
   on Workers.
5. Re-run the public matrix on apex and `www`: root, reviews, areas, 393-shop
   sitemap count, all 14 legacy URLs, canonical, robots, widget, and 404.
6. Roll back by disabling/removing the Worker custom-host binding while the
   retained Vercel deployment and prior web DNS target remain available.

## Explicitly not exercised

No production database writes, user creation, authentication login, email
delivery, Storage upload, secret value retrieval, DNS update, custom-domain
binding, or deploy was performed for this matrix.
