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
