# Eskomi Review Growth Center

## Job to be done

Help a verified Partner share the correct neutral review route through the channel that fits the real operation, without exposing cross-shop assets or encouraging rating manipulation.

## P0 information architecture

| Module | Current service reused | Partner action | Guard |
|---|---|---|---|
| QR card | `counter_qr` campaign | preview / download | QR resolves only canonical active campaign |
| LINE message | `line_after_visit` campaign | copy neutral copy | fixed neutral wording; no incentive or rating request |
| Website CTA | `shop_website` campaign | copy markup | campaign URL only; no secret or private ID |
| Widget | `shop_website` campaign / iframe | preview / copy / install guide | noindex, same shop / token validation |
| Metrics | growth metrics RPC | understand stage | aggregate own workspace only |

## Funnel and next-action design

```text
Asset available → campaign opened → review started → submitted → pending → published
```

- Show raw counts in P0. `conversion rate` appears only when its denominator and timeframe are defined.
- `pending` always links to explanatory moderation copy, never an approval action.
- If asset is unavailable, show the one operational prerequisite, not an empty code block.
- Use asset-specific checklists: preview correct shop → copy/download → install/share → verify destination.

## Not in this center

Review-content selection, customer lists, coupon rewards, mass sending, Google review replies, MEO rank, and public Shop SEO controls.
