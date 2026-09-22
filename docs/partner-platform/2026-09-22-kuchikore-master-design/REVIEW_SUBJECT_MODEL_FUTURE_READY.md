# Review subject model — future-ready contract

Current Pilot is **SHOP only**. No Therapist/Staff schema, UI, campaign, aggregate, or production migration is introduced by this note.

## Canonical future subjects

| Subject | Current | Future display / acquisition | Aggregate rule |
|---|---|---|---|
| SHOP | implemented | shop QR, LINE, Website CTA, Widget | shop reviews only |
| THERAPIST | not implemented | formal therapist-specific URL/QR/CTA after an identity contract | therapist reviews only; keep canonical shop relation |
| STAFF | not implemented | only after a formal Staff entity | staff reviews only; never mix with generic service evaluation |

URL/token must resolve to one canonical subject. A Shop QR cannot attribute to a therapist; a therapist QR cannot attribute to a shop or namesake therapist. An entry point with a resolved subject pre-fills it and does not ask the customer to reselect it.

The existing Partner services and view-models remain shop-scoped at the authorization boundary. Future subject expansion must add a canonical subject resolver and subject-specific aggregate projection before acquisition or public display; it must not infer identity from names or merge subject aggregates.
