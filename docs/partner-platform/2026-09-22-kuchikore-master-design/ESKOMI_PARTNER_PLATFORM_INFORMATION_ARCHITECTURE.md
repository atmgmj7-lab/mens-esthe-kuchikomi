# Eskomi Partner Platform — Information Architecture

```text
Partner Platform
├─ Home
│  ├─ Action Required
│  ├─ Review Performance
│  ├─ Collect Reviews
│  └─ Recent Activity
├─ Review Growth Center
│  ├─ QR
│  ├─ LINE review URL
│  ├─ Website CTA
│  ├─ Campaign status
│  └─ Install guidance
├─ Widget Studio
│  ├─ Preview
│  ├─ Embed snippet
│  ├─ Install verification
│  └─ Summary eligibility
├─ Analytics / Action Center
│  ├─ Funnel
│  ├─ Campaign comparison
│  ├─ Review lifecycle
│  └─ Next action
├─ Shop Information
│  ├─ Public-page confirmation
│  └─ Change request (existing controlled route only)
├─ Reports (P2)
├─ Multi-shop (P2)
└─ Team / roles (P2)

Future extension plane (not Pilot scope)
├─ Therapist
├─ Therapist Review
├─ Schedule / Today
├─ Newcomer
├─ Latest Information
├─ Shop Performance
└─ Therapist Performance

Operator Plane (separate)
├─ Partner registration review
├─ Review moderation inbox
├─ Campaign / workspace audit
└─ AI operational telemetry
```

## Source-of-truth and visibility

| Domain | Source of truth | Partner visibility | Operator visibility |
|---|---|---|---|
| Public Shop / Area identity | WordPress | canonical display only | canonical verification |
| Workspace / membership / state | Supabase `private` | server-projected own workspace | service-only audited access |
| Review lifecycle | Supabase Native Review | aggregate approved status only | moderation queue / detail by authorization |
| Campaign / attribution | Supabase `private` | own campaign aggregate and public asset | service-only management |
| Widget public summary | approved review adapter | public, noindex, read-only | diagnostic only |
| AI assist | request-scoped provider + service telemetry | customer result only | aggregate token/cost / outcome telemetry |

The public source stays WordPress for Shop / Area. Native Review stays the review system of record. No internal `private` schema becomes public to simplify a dashboard.

## Service boundary contract

Every Partner screen is a server-side projection. A browser never selects a
workspace, shop, campaign, or private-schema endpoint as an authority. The
session-derived membership is the authority; any requested identifier is only a
candidate and must match it before data is projected.

| Projection / service | Authoritative input | Safe output | Never expose / perform |
|---|---|---|---|
| Partner access resolver | authenticated user + server session | allowed / forbidden / unavailable | membership rows, service credentials, arbitrary workspace selection |
| Shop identity projection | authorized workspace membership + canonical WordPress identity | shop name, canonical URL, lifecycle state | editable WordPress data, a shop belonging to another workspace |
| Growth Kit projection | authorized identity + exactly one active campaign per channel | canonical review URL, QR payload, LINE copy, CTA, Widget URL, aggregates | raw private rows, a campaign token for an unrelated workspace, a duplicate active-channel guess |
| Review status projection | authorized workspace + approved aggregate metrics | submitted / pending / published counts and documented availability state | reviewer identity, review body, moderation controls, a missing denominator represented as `0%` |
| Widget public adapter | opaque widget token + publication threshold | noindex public summary and public review CTA | Partner session, private metrics, hidden reviews, installation success claim |
| AI review assist | bounded public review input + PII prefilter + service-only rate-limit / telemetry adapters | structured draft or `HUMAN_REVIEW` / unavailable result | rating/tag mutation, new facts, auto-publish, raw PII in telemetry |
| Operator moderation projection | operator authorization + Native Review moderation authority | queue, detail and audit-backed decision controls | Partner-route access, public access, AI-driven publication |

### Non-negotiable authorization invariants

1. **Deny by mismatch.** A membership/shop/slug/canonical-URL mismatch returns
   forbidden; the UI does not recover by substituting another record.
2. **Service role stays server-only.** It may call the documented `api` wrapper
   layer, never the `private` schema from a browser, and has no client bundle
   path.
3. **Projection over table access.** Partner pages receive the smallest
   view-model required for the next action, not a reusable private-record API.
4. **Separate human authority.** Partners may collect and view aggregates;
   authorized operators moderate. AI can assist wording only and cannot cross
   that boundary.
5. **Availability is data.** Missing campaign, inactive workspace, duplicate
   channel, zero denominator, provider outage, and unavailable metric must have
   named safe states. None may be inferred as a valid asset or a zero result.

## Role and operation matrix

| Operation | Partner owner / manager | Operator | Public visitor | Service adapter |
|---|---|---|---|---|
| View own Shop identity and aggregate Growth Kit | allowed after workspace match | diagnostic only | no | projects only own authorized scope |
| Copy own QR / LINE / CTA / Widget snippet | allowed only when canonical campaign is active | support diagnostic | public can use emitted URL only | validates active channel and scope |
| Submit a review | no privileged path | moderation later | allowed through public review flow | rate-limit and telemetry wrapper only |
| Read reviewer content or decide publication | no | authorized only | no | service-only adapter, never direct table access |
| Edit Shop / Area public source | controlled change-request route only | existing operational route | no | no direct WordPress write in Partner projection |
| Switch workspace / change role | P2 only after an explicit membership design | authorized operational workflow | no | records scoped audit after separate approval |

This matrix is deliberately narrower than the authenticated competitor UI. Its
purpose is to make the smallest Pilot experience useful without turning Eskomi
into a second CMS or a MEO product.
