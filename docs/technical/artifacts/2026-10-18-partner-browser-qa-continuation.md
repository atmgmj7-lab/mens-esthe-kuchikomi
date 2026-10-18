# 2026-10-18 Partner browser QA continuation

## Scope and isolation

All checks below used Google Chrome 155 launched by Playwright in headless
mode with a fresh temporary profile. Each fixture bound only loopback ports and
used fake UUIDs, fake users, and local mock services. No normal Chrome profile,
production page, production database, persistent Docker resource, external
mail account, or uploaded image was used.

The screenshots are deliberately local evidence, not Git deliverables and not
an additional upload. They are preserved under the pre-existing untracked
artifact root:

```text
headless/docs/technical/artifacts/v11-fixture-qa/2026-10-18-continuation/
```

## Browser fixture results

| Scope | Actual Next/UI behavior exercised | Mock boundary | Viewports and preserved evidence | Result |
| --- | --- | --- | --- | --- |
| Partner auth | Login request, visible repeated request/resend, callback state/cookie lifecycle, cross-user rejection, foreign-workspace rejection, separate dashboard Basic-Auth boundary | Auth and Partner RPC responses only | 390/1280; `auth/partner-correction-390.png`, `auth/partner-correction-1280.png` | PASS |
| Listing editor | Input, confirmation, return-to-edit persistence, revised confirmation, save | Partner listing RPC/storage fixture; no image upload | 390/1280; `listing/partner-listing-confirm-390.png`, `listing/partner-listing-confirm-1280.png` | PASS |
| Login-email management | Current account display, authenticated change request, noindex response, dashboard Basic-Auth boundary | Auth and email-management RPC responses | 390/1280; `login-email/partner-login-email-390.png`, `login-email/partner-login-email-1280.png` | PASS |
| Therapist photo errors | Actual `POST /api/partner/therapists/photo/` from the file input, bad text payload and 5MB+1 payload, returned 400 messages | Auth/workspace/list assignment RPCs only; image validation route itself is not mocked | 390/1280; `therapist-photo/partner-therapist-invalid-photo-390.png`, `therapist-photo/partner-therapist-too-large-photo-1280.png` | PASS |
| Canonical operator approval | Dashboard `承認して公開` button, confirmation prompt, real `POST /api/dashboard/managed-shops/`, and canonical review RPC body | Managed-shop detail and canonical review RPC responses | 390/1280; `canonical-approval/partner-canonical-approval-390-viewport.png`, `canonical-approval/partner-canonical-approval-1280.png` | PASS |
| Growth/POP/QR | Partner growth UI, copy controls, local QR, POP/print, foreign workspace denial and public-token failure | Auth/growth RPC fixture | 320/390/768/1280; `growth/` | PASS |

The canonical approval screen had lacked an action for the existing canonical
`review` route. The minimal UI now exposes explicit `承認して公開` and
`差し戻し` actions for submitted Partner revisions. The browser fixture proves
the approval button sends only the current managed-shop UUID, revision,
decision, optional note, and server-side operator label to
`review_canonical_managed_shop_revision`; it is browser fixture evidence, not
a real database transaction. The independent internal Partner HTTP fixture
remains the evidence for the real isolated database approval and public
projection.

Visual inspection found no banner or advertising input in the login-email,
listing-confirmation, therapist form, or canonical approval surfaces. The
growth dashboard intentionally displays B07; it is outside the input forms.
No horizontal overflow was detected in the asserted viewports.

## Previous temporary screenshot cleanup

The earlier cleanup removed only `/tmp/eskomi-v11-browser-qa.Lhoate`, a
temporary directory created by this QA run for the first transient Chrome
screenshots. It was not inside the repository and was not a user-provided
artifact. The pre-existing untracked `banner-library/` and
`headless/docs/technical/artifacts/v11-fixture-qa/` content were not modified
or deleted. The required screenshots have now been regenerated and retained in
the dedicated continuation subdirectory above. No new screenshot is staged for
Git or uploaded.

## Remaining pre-production boundaries

- A device-camera scan of the generated QR remains manual/device-only.
- The browser fixtures use local fake service responses. They do not replace a
  preview or production browser traversal.
- Login-email UI records the request; delivery and completion of a real
  Supabase email-change message are not claimed here.
- Canonical approval has fixture browser evidence and isolated real HTTP/DB
  evidence, but no production dashboard action has been performed.
- Production/preview URL, WordPress public data, deployment, database writes,
  and final production non-change checks remain outside this approved task.
