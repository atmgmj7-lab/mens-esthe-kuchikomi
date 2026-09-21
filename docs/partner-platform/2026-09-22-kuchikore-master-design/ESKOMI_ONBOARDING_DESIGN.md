# Eskomi Partner Onboarding Design

## Principle

Do not make a store re-enter public information. Confirm identity, authorize membership, show the existing public Shop page, and guide the first neutral review-acquisition action.

## P0 flow

```text
Outreach (separate approval)
  → identity confirmation
  → invitation / magic-link login
  → membership activation
  → own Workspace confirmation
  → Partner Home
  → select QR / LINE / Website CTA / optional Widget
  → customer review
  → final confirmation
  → pending moderation
  → published aggregate / metrics
```

## First-run checklist

1. Confirm displayed shop name and public page. A mismatch stops the flow and uses the controlled correction-request route.
2. Explain neutral review policy: actual users only; no requested rating, reward, or negative-review suppression.
3. Show one recommended asset based on current operation; all assets remain available in Growth Center.
4. For Widget, explicitly say it is optional and explain preview → copy → install.
5. Explain that submission is pending moderation and that neither AI nor the store publishes it.

## States

- Login unavailable: show a safe retry/support route, never reveal membership existence.
- Workspace not yet active: explain the verified lifecycle state and avoid dead CTAs.
- No campaign: show `準備中` with no generated token or placeholder URL.
- No public review: show onboarding value, not an empty analytics score.
